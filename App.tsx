import React, { useState, useEffect, useRef, useCallback } from 'react';
import Scene3D from './components/Scene3D';
import ControlPanel from './components/ControlPanel';
import { AppState, JointPositions, MotionData, INITIAL_JOINTS } from './types';
import { analyzeMotion } from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [motionData, setMotionData] = useState<MotionData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Ref to hold the interval ID
  const playbackIntervalRef = useRef<number | null>(null);

  const currentJoints: JointPositions = motionData?.frames[currentFrameIndex]?.joints || INITIAL_JOINTS;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        window.clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  const handleFileUpload = (file: File) => {
    setVideoFile(file);
    setAppState(AppState.IDLE);
    setMotionData(null);
    setCurrentFrameIndex(0);
    setProgress(0);
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
    } catch (error: any) {
      console.error("Analysis failed:", error);
      // Use the specific error message thrown from the service
      alert(`Analysis Failed: ${error.message || "Unknown Error"}`);
      setAppState(AppState.IDLE);
      setProgress(0);
    }
  };

  const togglePlay = useCallback(() => {
    if (!motionData) return;

    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      if (playbackIntervalRef.current) {
        window.clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    } else {
      // Play
      setIsPlaying(true);
      const fps = motionData.fps || 10;
      const intervalMs = 1000 / fps;

      playbackIntervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= motionData.frames.length) {
            // Loop or stop
            return 0; 
          }
          return next;
        });
      }, intervalMs);
    }
  }, [isPlaying, motionData]);

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

  // Sync isPlaying state changes to start/stop loop
  useEffect(() => {
      // This effect just ensures that if the component re-renders while playing, logic holds.
      // But the togglePlay logic handles the interval directly. 
      // We need to ensure we clear interval if we navigate away or data is cleared.
      if (!motionData && playbackIntervalRef.current) {
          window.clearInterval(playbackIntervalRef.current);
      }
  }, [motionData]);

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
        fps={motionData?.fps || 10}
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
                     {motionData.frames.length} frames captured
                 </div>
             )}
        </header>

        <div className="flex-1 min-h-0">
            <Scene3D currentJoints={currentJoints} hasData={!!motionData} />
        </div>

        {/* Timeline visualization (Simple) */}
        {motionData && (
            <div className="mt-4 h-12 bg-slate-800 rounded border border-slate-700 flex items-center px-4 overflow-hidden relative">
                 <div className="absolute inset-0 flex space-x-[2px] opacity-20">
                    {/* Fake timeline waveform visualization */}
                    {Array.from({ length: 100 }).map((_, i) => (
                        <div key={i} className="flex-1 bg-indigo-400" style={{ height: `${Math.random() * 80 + 20}%`, marginTop: 'auto', marginBottom: 'auto' }}></div>
                    ))}
                 </div>
                 <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-all duration-100 linear"
                    style={{ left: `${(currentFrameIndex / (motionData.frames.length - 1)) * 100}%`}}
                 ></div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;