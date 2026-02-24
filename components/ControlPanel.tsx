import React, { useRef, useMemo, useEffect } from 'react';
import { Upload, Video, Play, Square, Download, Activity, Loader2, Lock } from 'lucide-react';
import { AppState, MotionData } from '../types';

interface ControlPanelProps {
  appState: AppState;
  onFileUpload: (file: File) => void;
  onAnalyze: () => void;
  videoFile: File | null;
  onTogglePlay: () => void;
  isPlaying: boolean;
  onExport: () => void;
  frameIndex: number;
  totalFrames: number;
  fps: number;
  progress: number;
  motionLabel?: string | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  appState,
  onFileUpload,
  onAnalyze,
  videoFile,
  onTogglePlay,
  isPlaying,
  onExport,
  frameIndex,
  totalFrames,
  fps,
  progress,
  motionLabel
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Create object URL safely
  const videoUrl = useMemo(() => {
    if (videoFile) return URL.createObjectURL(videoFile);
    return null;
  }, [videoFile]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const isProcessing = appState === AppState.PROCESSING;
  const hasVideo = !!videoFile;
  const hasData = totalFrames > 0;

  return (
    <div className="w-80 flex flex-col gap-6 bg-slate-800 p-6 border-r border-slate-700 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
          AI Motion Capture
        </h1>
        <p className="text-slate-400 text-sm">
          Video to 3D Motion Extractor
        </p>
      </div>

      {/* Input Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">1. Input</h2>
        
        <input
          type="file"
          accept="video/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-all ${
            hasVideo 
            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' 
            : 'border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300'
          }`}
        >
          {hasVideo ? (
            <>
              <Video className="w-5 h-5" />
              <span className="truncate max-w-[180px] text-sm">{videoFile?.name}</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span className="text-sm">Upload Video (MP4/MOV)</span>
            </>
          )}
        </button>

        {videoUrl && (
            <video 
                src={videoUrl} 
                controls 
                className="w-full rounded-md border border-slate-700 max-h-40 object-cover bg-black"
            />
        )}
      </div>

      {/* Process Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">2. Process</h2>
        <button
          onClick={onAnalyze}
          disabled={!hasVideo || isProcessing}
          className={`
            flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium shadow-lg transition-all
            ${!hasVideo || isProcessing
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25'
            }
          `}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing... ({progress}%)</span>
            </>
          ) : (
            <>
              <Activity className="w-5 h-5" />
              <span>Extract Motion</span>
            </>
          )}
        </button>
        {isProcessing && (
          <div className="flex flex-col gap-2 animate-in fade-in zoom-in duration-300">
             <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                />
             </div>
             <p className="text-xs text-center text-indigo-300">
               {progress < 50 ? 'Step 1: Extracting Frames...' : 
                progress > 90 ? 'Step 2: AI Finalizing (Almost done)...' :
                'Step 2: AI Processing...'}
             </p>
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
        <h2 className={`text-sm font-semibold uppercase tracking-wider ${hasData ? 'text-slate-300' : 'text-slate-600'}`}>
          3. Review & Export
        </h2>
        
        {hasData ? (
          <>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">FPS: {fps}</span>
                  <span className="text-xs text-slate-400">Frame: {frameIndex} / {totalFrames}</span>
              </div>
              {motionLabel && (
                  <div className="mb-3 px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded text-center">
                      <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                          Action: {motionLabel}
                      </span>
                  </div>
              )}
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div 
                      className="bg-indigo-500 h-full transition-all duration-100 ease-linear"
                      style={{ width: `${(frameIndex / Math.max(1, totalFrames - 1)) * 100}%` }}
                  />
              </div>
              <div className="flex items-center justify-center mt-4">
                  <button
                      onClick={onTogglePlay}
                      className="flex items-center justify-center w-12 h-12 bg-white text-slate-900 rounded-full hover:bg-slate-200 transition-colors"
                  >
                      {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
              </div>
            </div>

            <button
              onClick={onExport}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium border border-slate-600 hover:border-slate-500 hover:bg-slate-700 text-slate-300 transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Export JSON</span>
            </button>
          </>
        ) : (
          <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center text-slate-600 gap-2 text-center border-dashed border-2 border-slate-800">
            <Lock className="w-6 h-6" />
            <p className="text-xs font-medium">Complete extraction<br/>to enable tools</p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-700 text-xs text-slate-500">
        <p>Model: MediaPipe Pose (Client-side)</p>
        <p className="mt-1">Use a clear video with full body visibility.</p>
        <p className="mt-1 text-amber-500/80">Note: Processing happens locally in your browser.</p>
      </div>
    </div>
  );
};

export default ControlPanel;