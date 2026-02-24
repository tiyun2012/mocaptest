import { Pose, Results, POSE_LANDMARKS } from '@mediapipe/pose';
import { MotionData, Vector3, JointPositions } from '../types';

// Vector Math Helpers
const distance = (v1: Vector3, v2: Vector3) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2) + Math.pow(v2.z - v1.z, 2));
const sub = (v1: Vector3, v2: Vector3): Vector3 => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z });
const add = (v1: Vector3, v2: Vector3): Vector3 => ({ x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z });
const mul = (v: Vector3, s: number): Vector3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const len = (v: Vector3) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const norm = (v: Vector3): Vector3 => {
  const l = len(v);
  return l > 0 ? mul(v, 1 / l) : { x: 0, y: 0, z: 0 };
};

// Helper to calculate midpoint
const midpoint = (v1: Vector3, v2: Vector3): Vector3 => {
  return {
    x: (v1.x + v2.x) / 2,
    y: (v1.y + v2.y) / 2,
    z: (v1.z + v2.z) / 2
  };
};

// Bone Hierarchy for constraints (Parent -> Child)
// Order matters: Parents must be processed before children
const HIERARCHY = [
  { parent: 'spine', child: 'neck' },
  { parent: 'neck', child: 'head' },
  { parent: 'neck', child: 'l_shoulder' },
  { parent: 'l_shoulder', child: 'l_elbow' },
  { parent: 'l_elbow', child: 'l_hand' },
  { parent: 'l_hand', child: 'l_fingers' },
  { parent: 'neck', child: 'r_shoulder' },
  { parent: 'r_shoulder', child: 'r_elbow' },
  { parent: 'r_elbow', child: 'r_hand' },
  { parent: 'r_hand', child: 'r_fingers' },
  { parent: 'spine', child: 'l_hip' },
  { parent: 'l_hip', child: 'l_knee' },
  { parent: 'l_knee', child: 'l_foot' },
  { parent: 'l_foot', child: 'l_toe' },
  { parent: 'spine', child: 'r_hip' },
  { parent: 'r_hip', child: 'r_knee' },
  { parent: 'r_knee', child: 'r_foot' },
  { parent: 'r_foot', child: 'r_toe' },
];

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

      let referenceLengths: Record<string, number> | null = null;

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

              // Helper to get best available landmark from a list, or fallback to previous frame
              const getBestVec = (indices: number[], prevVec: Vector3 | undefined): Vector3 => {
                  for (const idx of indices) {
                      const lm = currentLandmarks[idx];
                      // Simple check: if visibility exists and is low, skip
                      if (lm.visibility !== undefined && lm.visibility < 0.5) continue;
                      return getVec(idx);
                  }
                  
                  // If all failed, use the first one anyway? Or previous?
                  // User said "keep previous poses".
                  if (prevVec) return prevVec;
                  
                  // If no previous, force the first one
                  return getVec(indices[0]);
              };

              const prevFrame = frames.length > 0 ? frames[frames.length - 1].joints : null;

              const l_shoulder = getVec(11);
              const r_shoulder = getVec(12);
              const l_hip = getVec(23);
              const r_hip = getVec(24);
              
              const neck = midpoint(l_shoulder, r_shoulder);
              const spine = midpoint(l_hip, r_hip); 
              const head = getVec(0); // Nose

              // Hands: Wrist (15/16)
              const l_hand = getVec(15);
              const r_hand = getVec(16);

              // Fingers: Index(19/20), Pinky(17/18), Thumb(21/22)
              // Priority: Index -> Pinky -> Thumb
              const l_fingers = getBestVec([19, 17, 21], prevFrame?.l_fingers);
              const r_fingers = getBestVec([20, 18, 22], prevFrame?.r_fingers);

              // Feet: Ankle (27/28)
              const l_foot = getVec(27);
              const r_foot = getVec(28);

              // Toes: Foot Index (31/32), Heel (29/30 - usually back)
              // We want the "toe" tip. Foot index is best.
              const l_toe = getBestVec([31], prevFrame?.l_toe);
              const r_toe = getBestVec([32], prevFrame?.r_toe);

              const jointPositions: JointPositions = {
                head: head,
                neck: neck,
                l_shoulder: l_shoulder,
                r_shoulder: r_shoulder,
                l_elbow: getVec(13),
                r_elbow: getVec(14),
                l_hand: l_hand,
                r_hand: r_hand,
                l_fingers: l_fingers,
                r_fingers: r_fingers,
                spine: spine,
                l_hip: l_hip,
                r_hip: r_hip,
                l_knee: getVec(25),
                r_knee: getVec(26),
                l_foot: l_foot,
                r_foot: r_foot,
                l_toe: l_toe,
                r_toe: r_toe
              };

              // --- CONSTRAINT SOLVER ---
              if (!referenceLengths) {
                // Initialize reference lengths from the first frame
                referenceLengths = {};
                HIERARCHY.forEach(({ parent, child }) => {
                  const p = jointPositions[parent as keyof JointPositions];
                  const c = jointPositions[child as keyof JointPositions];
                  referenceLengths![`${parent}-${child}`] = distance(p, c);
                });
              } else if (prevFrame) {
                // Apply constraints based on reference lengths
                HIERARCHY.forEach(({ parent, child }) => {
                  const key = `${parent}-${child}`;
                  const refLen = referenceLengths![key];
                  
                  const pName = parent as keyof JointPositions;
                  const cName = child as keyof JointPositions;
                  
                  const pPos = jointPositions[pName];
                  const cPos = jointPositions[cName];
                  
                  const currentVec = sub(cPos, pPos);
                  const currentLen = len(currentVec);
                  
                  // Calculate deviation
                  const deviation = Math.abs(currentLen - refLen) / (refLen || 1); // Avoid div by zero
                  
                  if (deviation > 0.3) { 
                       // > 30% change: Assume tracking error.
                       // Use previous local vector (relative to current parent)
                       const prevP = prevFrame[pName];
                       const prevC = prevFrame[cName];
                       const prevVec = sub(prevC, prevP);
                       
                       jointPositions[cName] = add(pPos, prevVec);
                  } else if (deviation > 0.05) { 
                       // > 5% change: Constrain length, keep current direction
                       const correctedVec = mul(norm(currentVec), refLen);
                       jointPositions[cName] = add(pPos, correctedVec);
                  }
                });
              }

              frames.push({
                time: currentTime,
                joints: jointPositions
              });
          } else if (frames.length > 0) {
              // If no landmarks detected for this frame, use previous frame (keep pose)
              frames.push({
                  time: currentTime,
                  joints: frames[frames.length - 1].joints
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

