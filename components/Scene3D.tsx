import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Environment } from '@react-three/drei';
import Humanoid from './Humanoid';
import { JointPositions } from '../types';

interface Scene3DProps {
  currentJoints: JointPositions;
  hasData: boolean;
}

const Scene3D: React.FC<Scene3DProps> = ({ currentJoints, hasData }) => {
  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl relative">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
        <OrbitControls makeDefault target={[0, 1, 0]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7.5]} intensity={1} castShadow />
        <Environment preset="city" />

        {/* Floor */}
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#4f46e5" 
          cellColor="#1e293b" 
          sectionSize={1} 
          cellSize={0.1} 
        />
        
        {/* Character */}
        <Humanoid joints={currentJoints} />
      </Canvas>
      
      <div className="absolute top-4 right-4 bg-black/50 text-xs text-white p-2 rounded pointer-events-none backdrop-blur-sm border border-white/10">
        <p>Y-Up Coordinate System</p>
        <p>LMB: Rotate | RMB: Pan | Scroll: Zoom</p>
      </div>

      {/* Mode Indicator */}
      <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-lg ${
        hasData 
          ? 'bg-green-500/20 border-green-500/30 text-green-200' 
          : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-green-400 animate-pulse' : 'bg-indigo-400'}`}></div>
          {hasData ? 'PLAYBACK MODE' : 'PREVIEW MODE'}
        </div>
      </div>
      
      {!hasData && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-slate-500 text-xs text-center pointer-events-none">
              Default T-Pose
          </div>
      )}
    </div>
  );
};

export default Scene3D;