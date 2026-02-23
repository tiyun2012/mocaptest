import { GoogleGenAI } from "@google/genai";
import { MotionData, Vector3 } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Increased limit to support longer videos (up to 60s at 5fps)
const FRAMES_TO_EXTRACT = 300; 
const RESIZE_DIMENSION = 128; // Keep 128px for low payload

// Helper to extract frames from video file
const extractFrames = async (videoFile: File, onProgress?: (percent: number) => void): Promise<{ parts: any[], duration: number }> => {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Create URL for the video file
  const videoUrl = URL.createObjectURL(videoFile);
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  
  // Wait for data to load
  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve(true);
    video.onerror = (e) => reject(new Error("Video load error: " + (e as any).message));
  });

  let duration = video.duration;
  if (!Number.isFinite(duration)) {
      duration = 10.0;
  }
  
  let width = video.videoWidth;
  let height = video.videoHeight;
  
  // Calculate scale to fit within RESIZE_DIMENSION
  const scale = Math.min(1, RESIZE_DIMENSION / Math.max(width, height));
  width = Math.floor(width * scale);
  height = Math.floor(height * scale);
  
  canvas.width = width;
  canvas.height = height;

  const frames: any[] = [];
  const fps = 5;
  const interval = 1.0 / fps;
  let currentTime = 0;
  
  // Analyze full duration up to the frame limit
  const maxDurationToAnalyze = Math.min(duration, FRAMES_TO_EXTRACT * interval);

  try {
    while (currentTime < maxDurationToAnalyze) {
        video.currentTime = currentTime;
        
        await new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve(true);
          };
          video.addEventListener('seeked', onSeeked);
        });
        
        ctx.drawImage(video, 0, 0, width, height);
        
        // Use 0.6 quality - slightly higher to help model see joints better despite low res
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]; 
        
        frames.push({
          inlineData: {
            data: base64,
            mimeType: 'image/jpeg'
          }
        });

        // Report progress (0-100% of extraction phase)
        if (onProgress) {
            // Calculate progress based on expected frames
            const expectedFrames = Math.ceil(maxDurationToAnalyze / interval);
            const percent = Math.min(100, Math.round((frames.length / expectedFrames) * 100));
            onProgress(percent);
        }

        currentTime += interval;
        if (frames.length >= FRAMES_TO_EXTRACT) break;
    }
  } catch (err) {
      console.warn("Frame extraction stopped early:", err);
  } finally {
      URL.revokeObjectURL(videoUrl);
      video.remove();
      canvas.remove();
  }

  return { parts: frames, duration: maxDurationToAnalyze };
};

// Helper to convert array [x,y,z] to Vector3 object
const arrToVec = (arr: number[] | undefined): Vector3 => {
  if (!arr || !Array.isArray(arr) || arr.length < 3) return { x: 0, y: 0, z: 0 };
  return { x: arr[0], y: arr[1], z: arr[2] };
};

export const analyzeMotion = async (videoFile: File, onProgress?: (percent: number) => void): Promise<MotionData> => {
  // 1. Extract frames client-side
  let parts: any[] = [];
  try {
      const result = await extractFrames(videoFile, (extractionPercent) => {
          // Extraction phase accounts for first 40%
          if (onProgress) {
              onProgress(Math.floor(extractionPercent * 0.4));
          }
      });
      parts = result.parts;
  } catch (e) {
      console.error(e);
      throw new Error("Failed to process video frames.");
  }
  
  if (parts.length === 0) {
    throw new Error("Could not extract any frames from the video.");
  }

  // Set progress to 40% (Extraction done)
  if (onProgress) onProgress(40);

  // Start a simulated progress timer for the AI waiting period
  let simulatedProgress = 40;
  const progressInterval = setInterval(() => {
    // Slower increment to match potential latency
    const remaining = 95 - simulatedProgress;
    const step = Math.max(0.05, remaining * 0.05); 
    simulatedProgress += step;
    
    if (simulatedProgress > 95) simulatedProgress = 95;
    if (onProgress) onProgress(Math.floor(simulatedProgress));
  }, 800); 

  // 2. Prepare Prompt
  // Explicitly ask for specific JSON structure.
  const prompt = `
    Analyze this sequence of ${parts.length} images extracted from a video at 5 frames per second.
    Perform 3D motion capture extraction for the primary person visible.
    
    Return ONLY a raw JSON object. Do not use Markdown code blocks.
    
    Requirements:
    1. Coordinate System: Y-UP. +Y is up, +Z is forward, +X is right.
    2. Origin: (0,0,0) at the floor.
    3. Scale: Normalize person to 1.7m tall.
    4. Joints: Estimate 3D positions as [x, y, z] arrays.
    5. Frames: One object per input image.

    JSON Structure:
    {
      "fps": 5,
      "frames": [
        {
          "time": 0.0,
          "joints": {
             "head": [0, 1.7, 0],
             "neck": [0, 1.5, 0],
             "l_shoulder": [0.2, 1.4, 0],
             "r_shoulder": [-0.2, 1.4, 0],
             "l_elbow": [0.3, 1.1, 0],
             "r_elbow": [-0.3, 1.1, 0],
             "l_hand": [0.35, 0.8, 0],
             "r_hand": [-0.35, 0.8, 0],
             "spine": [0, 1.0, 0],
             "l_hip": [0.15, 0.9, 0],
             "r_hip": [-0.15, 0.9, 0],
             "l_knee": [0.15, 0.5, 0],
             "r_knee": [-0.15, 0.5, 0],
             "l_foot": [0.15, 0.0, 0.1],
             "r_foot": [-0.15, 0.0, 0.1]
          }
        }
      ]
    }
  `;

  // 3. Call Gemini
  try {
      const apiCall = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [...parts, { text: prompt }],
        },
        config: {
          responseMimeType: "application/json",
          // Note: Removed responseSchema to reduce generation latency and avoid timeouts on complex schemas.
          // The model is strong enough to follow the prompt's JSON structure.
        },
      });

      // 300 second timeout (5 minutes)
      const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out. The model is taking too long to respond.")), 300000);
      });

      const response = await Promise.race([apiCall, timeout]) as any;

      clearInterval(progressInterval);
      if (onProgress) onProgress(100);

      const text = response.text;
      if (!text) {
        throw new Error("No response text from Gemini.");
      }

      let rawData;
      try {
        // Handle potential markdown code blocks if the model ignores the instruction
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        rawData = JSON.parse(cleanText);
      } catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid JSON response from AI");
      }
      
      const motionData: MotionData = {
        fps: rawData.fps || 5,
        frames: (rawData.frames || []).map((f: any) => ({
          time: f.time,
          joints: {
            head: arrToVec(f.joints?.head),
            neck: arrToVec(f.joints?.neck),
            l_shoulder: arrToVec(f.joints?.l_shoulder),
            r_shoulder: arrToVec(f.joints?.r_shoulder),
            l_elbow: arrToVec(f.joints?.l_elbow),
            r_elbow: arrToVec(f.joints?.r_elbow),
            l_hand: arrToVec(f.joints?.l_hand),
            r_hand: arrToVec(f.joints?.r_hand),
            spine: arrToVec(f.joints?.spine),
            l_hip: arrToVec(f.joints?.l_hip),
            r_hip: arrToVec(f.joints?.r_hip),
            l_knee: arrToVec(f.joints?.l_knee),
            r_knee: arrToVec(f.joints?.r_knee),
            l_foot: arrToVec(f.joints?.l_foot),
            r_foot: arrToVec(f.joints?.r_foot),
          }
        }))
      };

      if (motionData.frames.length === 0) {
        throw new Error("No motion frames were generated.");
      }

      return motionData;

  } catch (error: any) {
      clearInterval(progressInterval);
      console.error("Gemini API Error:", error);
      
      let friendlyMessage = error.message || "Unknown error";
      if (friendlyMessage.includes("timed out")) {
          friendlyMessage = "Request timed out. Please try a shorter video or check your connection.";
      } else if (JSON.stringify(error).includes("413") || friendlyMessage.includes("payload")) {
          friendlyMessage = "Video payload too large. Please try a shorter video.";
      }
      
      throw new Error(friendlyMessage);
  }
};