import React, { useEffect, useRef, useState } from 'react';
import { Camera, Monitor, X, RefreshCw, Send, VideoOff, Radio, Minimize2, Maximize2 } from 'lucide-react';

interface VisionPreviewModalProps {
  isOpen: boolean;
  mode: 'camera' | 'screen' | null;
  stream: MediaStream | null;
  onClose: () => void;
  onSwitchMode: (newMode: 'camera' | 'screen') => void;
  onCaptureAndSend: (base64Image: string) => void;
  isLiveStreaming: boolean;
  onToggleLiveStreaming: () => void;
  onLiveStreamFrame: (base64Image: string) => void;
}

export const VisionPreviewModal: React.FC<VisionPreviewModalProps> = ({
  isOpen,
  mode,
  stream,
  onClose,
  onSwitchMode,
  onCaptureAndSend,
  isLiveStreaming,
  onToggleLiveStreaming,
  onLiveStreamFrame,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isOpen]);

  // Automatic live streaming frame sender when isLiveStreaming is true
  useEffect(() => {
    if (!isLiveStreaming || !stream || !isOpen) return;

    const interval = setInterval(() => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Data = dataUrl.split(',')[1];
      if (base64Data) {
        onLiveStreamFrame(base64Data);
      }
    }, 1500); // Send frame every 1.5 seconds for fluid live streaming

    return () => clearInterval(interval);
  }, [isLiveStreaming, stream, isOpen, onLiveStreamFrame]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-zinc-950/90 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl animate-fade-in transition-all">
      {/* PiP Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2 text-zinc-100 font-medium text-xs">
          {mode === 'camera' ? (
            <>
              <Camera className="w-3.5 h-3.5 text-rose-400" />
              <span>PiP Camera</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-indigo-400" />
              <span>PiP Screen Share</span>
            </>
          )}
          {isLiveStreaming ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Live Streaming
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
              Ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title={isMinimized ? "Expand PiP" : "Minimize PiP"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close PiP Vision"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Content Area (Hidden when minimized) */}
      {!isMinimized && (
        <>
          <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                <VideoOff className="w-6 h-6" />
                <p className="text-xs">No stream</p>
              </div>
            )}
          </div>

          {/* PiP Action Toolbar */}
          <div className="p-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between gap-2">
            <button
              onClick={onToggleLiveStreaming}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                isLiveStreaming
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {isLiveStreaming ? 'Stop Live Stream' : 'Start Live Stream'}
            </button>

            <button
              onClick={() => onSwitchMode(mode === 'camera' ? 'screen' : 'camera')}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors"
              title="Switch Camera/Screen"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                if (!videoRef.current) return;
                const video = videoRef.current;
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                onCaptureAndSend(dataUrl.split(',')[1]);
              }}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow"
              title="Send One-shot Snapshot"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
