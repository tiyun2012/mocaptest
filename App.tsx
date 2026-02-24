import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Scene3D from './components/Scene3D';
import ControlPanel from './components/ControlPanel';
import { AppState, JointPositions, MotionData, INITIAL_JOINTS } from './types';
import { analyzeMotion } from './services/motionService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [motionData, setMotionData] = useState<MotionData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentJoints: JointPositions = motionData?.frames[currentFrameIndex]?.joints || INITIAL_JOINTS;

  // Create video URL
  const videoUrl = useMemo(() => {
    return videoFile ? URL.createObjectURL(videoFile) : null;
  }, [videoFile]);

  // Cleanup video URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Sync loop: Update frame index based on video time
  useEffect(() => {
    let rAF: number;
    
    const loop = () => {
      if (videoRef.current && motionData && isPlaying) {
         const t = videoRef.current.currentTime;
         const frame = Math.floor(t * motionData.fps);
         
         // Ensure we don't go out of bounds
         if (frame < motionData.frames.length) {
             setCurrentFrameIndex(frame);
         }
         
         rAF = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
        rAF = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(rAF);
  }, [isPlaying, motionData]);

  const handleFileUpload = (file: File) => {
    setVideoFile(file);
    setAppState(AppState.IDLE);
    setMotionData(null);
    setCurrentFrameIndex(0);
    setProgress(0);
    if (videoRef.current) {
        videoRef.current.currentTime = 0;
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;

    setAppState(AppState.PROCESSING);
    setProgress(0);
    try {
      const data = await analyzeMotion(videoFile, (p) => setProgress(p));
      setMotionData(data);
      setCurrentFrameIndex(0);
      setAppState(AppState.IDLE); // Ready to play
      setProgress(100);
      if (videoRef.current) {
          videoRef.current.currentTime = 0;
      }
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(`Analysis Failed: ${error.message || "Unknown Error"}`);
      setAppState(AppState.IDLE);
      setProgress(0);
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
        // If we are at the end, restart
        if (videoRef.current.ended || (motionData && currentFrameIndex >= motionData.frames.length - 1)) {
            videoRef.current.currentTime = 0;
            setCurrentFrameIndex(0);
        }
        videoRef.current.play().catch(e => console.error("Play failed", e));
    } else {
        videoRef.current.pause();
    }
  }, [motionData, currentFrameIndex]);

  const handleExport = () => {
    if (!motionData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(motionData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "motion_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500/30">
      <ControlPanel 
        appState={appState}
        onFileUpload={handleFileUpload}
        onAnalyze={handleAnalyze}
        videoFile={videoFile}
        onTogglePlay={togglePlay}
        isPlaying={isPlaying}
        onExport={handleExport}
        frameIndex={currentFrameIndex}
        totalFrames={motionData?.frames.length || 0}
        fps={motionData?.fps || 30}
        progress={progress}
      />
      
      <main className="flex-1 p-4 flex flex-col min-w-0">
        <header className="mb-4 flex justify-between items-center">
             <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${appState === AppState.PROCESSING ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></span>
                <span className="text-sm font-medium text-slate-300">
                    {appState === AppState.PROCESSING ? 'Processing Video...' : 'System Ready'}
                </span>
             </div>
             {motionData && (
                 <div className="text-xs text-slate-500 font-mono">
                     {motionData.frames.length} frames captured @ {motionData.fps} FPS
                 </div>
             )}
        </header>

        <div className="flex-1 min-h-0 flex gap-4">
            {/* 3D View */}
            <div className="flex-1 relative bg-slate-950 rounded-lg overflow-hidden border border-slate-700/50 shadow-inner">
                <Scene3D currentJoints={currentJoints} hasData={!!motionData} />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded text-xs font-medium text-white/90 pointer-events-none border border-white/10">
                    3D Reconstruction
                </div>
            </div>

            {/* Video View - Only if video exists */}
            {videoUrl && (
                <div className="flex-1 relative bg-black rounded-lg overflow-hidden border border-slate-700/50 shadow-inner flex items-center justify-center">
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="max-w-full max-h-full"
                        muted
                        playsInline
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                     <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded text-xs font-medium text-white/90 pointer-events-none border border-white/10">
                        Reference Video
                    </div>
                </div>
            )}
        </div>

        {/* Timeline visualization */}
        {motionData && (
            <div className="mt-4 h-12 bg-slate-800 rounded border border-slate-700 flex items-center px-4 overflow-hidden relative">
                 <div className="absolute inset-0 flex space-x-[2px] opacity-20">
                    {/* Fake timeline waveform visualization */}
                    {Array.from({ length: 100 }).map((_, i) => (
                        <div key={i} className="flex-1 bg-indigo-400" style={{ height: `${Math.random() * 80 + 20}%`, marginTop: 'auto', marginBottom: 'auto' }}></div>
                    ))}
                 </div>
                 <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-all duration-75 linear"
                    style={{ left: `${(currentFrameIndex / (motionData.frames.length - 1)) * 100}%`}}
                 ></div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;