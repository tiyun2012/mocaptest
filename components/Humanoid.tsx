import React, { useMemo } from 'react';
import { JointPositions, Vector3 } from '../types';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface HumanoidProps {
  joints: JointPositions;
}

const JointSphere: React.FC<{ position: Vector3; color?: string; size?: number }> = ({ position, color = "#4f46e5", size = 0.05 }) => {
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
};

const Bone: React.FC<{ start: Vector3; end: Vector3; color?: string }> = ({ start, end, color = "#94a3b8" }) => {
  const points = useMemo(() => [
    new THREE.Vector3(start.x, start.y, start.z),
    new THREE.Vector3(end.x, end.y, end.z)
  ], [start, end]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={3} 
    />
  );
};

const Humanoid: React.FC<HumanoidProps> = ({ joints }) => {
  return (
    <group>
      {/* Joints */}
      <JointSphere position={joints.head} color="#f43f5e" size={0.08} />
      <JointSphere position={joints.neck} />
      <JointSphere position={joints.spine} />
      <JointSphere position={joints.l_shoulder} />
      <JointSphere position={joints.r_shoulder} />
      <JointSphere position={joints.l_elbow} />
      <JointSphere position={joints.r_elbow} />
      <JointSphere position={joints.l_hand} color="#10b981" />
      <JointSphere position={joints.r_hand} color="#10b981" />
      <JointSphere position={joints.l_fingers} color="#34d399" size={0.04} />
      <JointSphere position={joints.r_fingers} color="#34d399" size={0.04} />
      
      <JointSphere position={joints.l_hip} />
      <JointSphere position={joints.r_hip} />
      <JointSphere position={joints.l_knee} />
      <JointSphere position={joints.r_knee} />
      <JointSphere position={joints.l_foot} color="#f59e0b" />
      <JointSphere position={joints.r_foot} color="#f59e0b" />
      <JointSphere position={joints.l_toe} color="#fbbf24" size={0.04} />
      <JointSphere position={joints.r_toe} color="#fbbf24" size={0.04} />

      {/* Bones - Torso */}
      <Bone start={joints.head} end={joints.neck} />
      <Bone start={joints.neck} end={joints.spine} />
      <Bone start={joints.neck} end={joints.l_shoulder} />
      <Bone start={joints.neck} end={joints.r_shoulder} />
      <Bone start={joints.spine} end={joints.l_hip} />
      <Bone start={joints.spine} end={joints.r_hip} />
      <Bone start={joints.l_hip} end={joints.r_hip} />

      {/* Bones - Arms */}
      <Bone start={joints.l_shoulder} end={joints.l_elbow} />
      <Bone start={joints.l_elbow} end={joints.l_hand} />
      <Bone start={joints.l_hand} end={joints.l_fingers} />
      <Bone start={joints.r_shoulder} end={joints.r_elbow} />
      <Bone start={joints.r_elbow} end={joints.r_hand} />
      <Bone start={joints.r_hand} end={joints.r_fingers} />

      {/* Bones - Legs */}
      <Bone start={joints.l_hip} end={joints.l_knee} />
      <Bone start={joints.l_knee} end={joints.l_foot} />
      <Bone start={joints.l_foot} end={joints.l_toe} />
      <Bone start={joints.r_hip} end={joints.r_knee} />
      <Bone start={joints.r_knee} end={joints.r_foot} />
      <Bone start={joints.r_foot} end={joints.r_toe} />
    </group>
  );
};

export default Humanoid;