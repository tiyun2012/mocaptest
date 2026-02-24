import { Pose, Results, POSE_LANDMARKS } from '@mediapipe/pose';
import { MotionData, Vector3, JointPositions } from '../types';

// Helper to calculate midpoint
const midpoint = (v1: Vector3, v2: Vector3): Vector3 => {
  return {
    x: (v1.x + v2.x) / 2,
    y: (v1.y + v2.y) / 2,
    z: (v1.z + v2.z) / 2
  };
};

export const analyzeMotion = async (videoFile: File, onProgress?: (percent: number) => void): Promise<MotionData> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    // Important: set preload to auto
    video.preload = "auto";

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    const frames: { time: number, joints: JointPositions }[] = [];
    
    // We need to capture the results for the *current* frame being processed
    // Since pose.send() is awaited, we can just push to a buffer or handle it sequentially
    // But onResults is a callback. 
    // We'll use a simple variable to hold the latest result for the current processing step
    let currentLandmarks: any = null;

    pose.onResults((results: Results) => {
      currentLandmarks = results.poseWorldLandmarks;
    });

    const processVideo = async () => {
      let duration = video.duration;
      if (!Number.isFinite(duration)) duration = 10; // Fallback
      
      const fps = 30; 
      const interval = 1 / fps;
      let currentTime = 0;
      
      // Coordinate mapping constants
      // MediaPipe: Y is down. We want Y up.
      // Origin is hips. We want hips to be around 0.9m high.
      const Y_OFFSET = 0.9; 
      const SCALE = 1.0; // Keep scale 1:1 for meters

      try {
        while (currentTime < duration) {
          // 1. Seek
          video.currentTime = currentTime;
          await new Promise<void>((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            video.addEventListener('seeked', onSeeked);
          });

          // 2. Process
          currentLandmarks = null; // Reset
          await pose.send({ image: video });

          // 3. Extract
          if (currentLandmarks) {
             const getVec = (index: number): Vector3 => {
                const lm = currentLandmarks[index];
                // Mapping:
                // MP X+ is Left (in mirror view) or Right? 
                // Let's assume standard: X is horizontal, Y is vertical (down), Z is depth.
                // We want: X horizontal, Y vertical (up), Z depth.
                return {
                  x: -lm.x * SCALE, // Flip X if needed
                  y: (-lm.y * SCALE) + Y_OFFSET, // Invert Y and add offset
                  z: -lm.z * SCALE // Flip Z if needed
                };
              };

              const l_shoulder = getVec(11);
              const r_shoulder = getVec(12);
              const l_hip = getVec(23);
              const r_hip = getVec(24);
              
              const neck = midpoint(l_shoulder, r_shoulder);
              const spine = midpoint(l_hip, r_hip); 
              const head = getVec(0); // Nose

              const jointPositions: JointPositions = {
                head: head,
                neck: neck,
                l_shoulder: l_shoulder,
                r_shoulder: r_shoulder,
                l_elbow: getVec(13),
                r_elbow: getVec(14),
                l_hand: getVec(15),
                r_hand: getVec(16),
                spine: spine,
                l_hip: l_hip,
                r_hip: r_hip,
                l_knee: getVec(25),
                r_knee: getVec(26),
                l_foot: getVec(27),
                r_foot: getVec(28)
              };

              frames.push({
                time: currentTime,
                joints: jointPositions
              });
          }

          // 4. Progress
          if (onProgress) {
            onProgress(Math.min(100, Math.round((currentTime / duration) * 100)));
          }

          currentTime += interval;
        }

        resolve({
          fps: fps,
          frames: frames
        });

      } catch (err) {
        reject(err);
      } finally {
        pose.close();
        URL.revokeObjectURL(url);
        video.remove();
      }
    };

    // Start processing when metadata is loaded
    video.onloadedmetadata = () => {
       processVideo();
    };
    
    video.onerror = () => {
        reject(new Error("Failed to load video"));
    };
  });
};

