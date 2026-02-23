export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface JointPositions {
  head: Vector3;
  neck: Vector3;
  l_shoulder: Vector3;
  r_shoulder: Vector3;
  l_elbow: Vector3;
  r_elbow: Vector3;
  l_hand: Vector3;
  r_hand: Vector3;
  spine: Vector3;
  l_hip: Vector3;
  r_hip: Vector3;
  l_knee: Vector3;
  r_knee: Vector3;
  l_foot: Vector3;
  r_foot: Vector3;
}

export interface AnimationFrame {
  time: number;
  joints: JointPositions;
}

export interface MotionData {
  fps: number;
  frames: AnimationFrame[];
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  PLAYING = 'PLAYING',
}

export const INITIAL_JOINTS: JointPositions = {
  head: { x: 0, y: 1.7, z: 0 },
  neck: { x: 0, y: 1.5, z: 0 },
  l_shoulder: { x: 0.2, y: 1.4, z: 0 },
  r_shoulder: { x: -0.2, y: 1.4, z: 0 },
  l_elbow: { x: 0.3, y: 1.1, z: 0 },
  r_elbow: { x: -0.3, y: 1.1, z: 0 },
  l_hand: { x: 0.35, y: 0.8, z: 0 },
  r_hand: { x: -0.35, y: 0.8, z: 0 },
  spine: { x: 0, y: 1.0, z: 0 },
  l_hip: { x: 0.15, y: 0.9, z: 0 },
  r_hip: { x: -0.15, y: 0.9, z: 0 },
  l_knee: { x: 0.15, y: 0.5, z: 0 },
  r_knee: { x: -0.15, y: 0.5, z: 0 },
  l_foot: { x: 0.15, y: 0.0, z: 0.1 },
  r_foot: { x: -0.15, y: 0.0, z: 0.1 },
};