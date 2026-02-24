import { Pose, Results, POSE_LANDMARKS } from '@mediapipe/pose';
import { MotionData, Vector3, JointPositions } from '../types';
import { Vector3Filter } from '../utils/filters';

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
    let currentLandmarks: any = null;

    pose.onResults((results: Results) => {
      currentLandmarks = results.poseWorldLandmarks;
    });

    const processVideo = async () => {
      let duration = video.duration;
      if (!Number.isFinite(duration)) duration = 10;
      
      const fps = 30; 
      const interval = 1 / fps;
      let currentTime = 0;
      
      const Y_OFFSET = 0.9; 
      const SCALE = 1.0;

      let referenceLengths: Record<string, number> | null = null;

      // Initialize Filters for each joint
      // MinCutoff: 1.0 (decrease to smooth more, increase to reduce lag)
      // Beta: 0.007 (increase to reduce lag during movement)
      const filters: Record<string, Vector3Filter> = {};
      const jointNames = [
          'head', 'neck', 'l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow', 
          'l_hand', 'r_hand', 'l_fingers', 'r_fingers', 'spine', 
          'l_hip', 'r_hip', 'l_knee', 'r_knee', 'l_foot', 'r_foot', 'l_toe', 'r_toe'
      ];
      jointNames.forEach(name => {
          filters[name] = new Vector3Filter(0.5, 0.01); // Tuned for mocap
      });

      try {
        while (currentTime < duration) {
          video.currentTime = currentTime;
          await new Promise<void>((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            video.addEventListener('seeked', onSeeked);
          });

          currentLandmarks = null;
          await pose.send({ image: video });

          if (currentLandmarks) {
             const getVec = (index: number): Vector3 => {
                const lm = currentLandmarks[index];
                return {
                  x: -lm.x * SCALE, 
                  y: (-lm.y * SCALE) + Y_OFFSET, 
                  z: -lm.z * SCALE 
                };
              };

              const getBestVec = (indices: number[], prevVec: Vector3 | undefined): Vector3 => {
                  for (const idx of indices) {
                      const lm = currentLandmarks[idx];
                      if (lm.visibility !== undefined && lm.visibility < 0.5) continue;
                      return getVec(idx);
                  }
                  if (prevVec) return prevVec;
                  return getVec(indices[0]);
              };

              const prevFrame = frames.length > 0 ? frames[frames.length - 1].joints : null;

              const l_shoulder = getVec(11);
              const r_shoulder = getVec(12);
              const l_hip = getVec(23);
              const r_hip = getVec(24);
              
              const neck = midpoint(l_shoulder, r_shoulder);
              const spine = midpoint(l_hip, r_hip); 
              const head = getVec(0);

              const l_hand = getVec(15);
              const r_hand = getVec(16);
              const l_fingers = getBestVec([19, 17, 21], prevFrame?.l_fingers);
              const r_fingers = getBestVec([20, 18, 22], prevFrame?.r_fingers);
              const l_foot = getVec(27);
              const r_foot = getVec(28);
              const l_toe = getBestVec([31], prevFrame?.l_toe);
              const r_toe = getBestVec([32], prevFrame?.r_toe);

              let jointPositions: JointPositions = {
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

              // --- 1. APPLY FILTERS (Smoothing) ---
              // We filter BEFORE constraints to smooth the raw input
              const filteredJoints = {} as JointPositions;
              for (const key of Object.keys(jointPositions)) {
                  const k = key as keyof JointPositions;
                  filteredJoints[k] = filters[k].filter(currentTime, jointPositions[k]);
              }
              jointPositions = filteredJoints;

              // --- 2. CONSTRAINT SOLVER (Bone Lengths) ---
              if (!referenceLengths) {
                referenceLengths = {};
                HIERARCHY.forEach(({ parent, child }) => {
                  const p = jointPositions[parent as keyof JointPositions];
                  const c = jointPositions[child as keyof JointPositions];
                  referenceLengths![`${parent}-${child}`] = distance(p, c);
                });
              } else if (prevFrame) {
                HIERARCHY.forEach(({ parent, child }) => {
                  const key = `${parent}-${child}`;
                  const refLen = referenceLengths![key];
                  const pName = parent as keyof JointPositions;
                  const cName = child as keyof JointPositions;
                  const pPos = jointPositions[pName];
                  const cPos = jointPositions[cName];
                  
                  const currentVec = sub(cPos, pPos);
                  const currentLen = len(currentVec);
                  const deviation = Math.abs(currentLen - refLen) / (refLen || 1);
                  
                  if (deviation > 0.3) { 
                       const prevP = prevFrame[pName];
                       const prevC = prevFrame[cName];
                       const prevVec = sub(prevC, prevP);
                       jointPositions[cName] = add(pPos, prevVec);
                  } else if (deviation > 0.05) { 
                       const correctedVec = mul(norm(currentVec), refLen);
                       jointPositions[cName] = add(pPos, correctedVec);
                  }
                });
              }

              // --- 3. FOOT LOCKING (Simple IK) ---
              // If foot is near ground and velocity is low, lock it to previous position
              if (prevFrame) {
                  const checkFootLock = (footName: 'l_foot' | 'r_foot', kneeName: 'l_knee' | 'r_knee', hipName: 'l_hip' | 'r_hip') => {
                      const foot = jointPositions[footName];
                      const prevFoot = prevFrame[footName];
                      
                      // Thresholds
                      const GROUND_THRESHOLD = 0.1; // 10cm from ground (Y=0)
                      const VELOCITY_THRESHOLD = 0.05; // Movement per frame

                      const distMoved = distance(foot, prevFoot);

                      if (foot.y < GROUND_THRESHOLD && distMoved < VELOCITY_THRESHOLD) {
                          // Lock foot to previous position
                          jointPositions[footName] = { ...prevFoot };
                          
                          // Simple IK: Adjust knee to maintain leg length if possible
                          // We moved the foot, so the hip->knee->foot chain is broken.
                          // We need to recalculate knee position.
                          // For simplicity in this "Simple IK", we just leave the knee where it is 
                          // or maybe nudge it. A full 2-bone IK solver is complex.
                          // Let's just lock the foot for now to prevent sliding. 
                          // The bone length constraint solver in the NEXT frame will pull the knee/hip 
                          // to satisfy the length, effectively acting as a poor man's IK.
                      }
                  };

                  checkFootLock('l_foot', 'l_knee', 'l_hip');
                  checkFootLock('r_foot', 'r_knee', 'r_hip');
              }

              frames.push({
                time: currentTime,
                joints: jointPositions
              });
          } else if (frames.length > 0) {
              frames.push({
                  time: currentTime,
                  joints: frames[frames.length - 1].joints
              });
          }

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

    video.onloadedmetadata = () => {
       processVideo();
    };
    
    video.onerror = () => {
        reject(new Error("Failed to load video"));
    };
  });
};

