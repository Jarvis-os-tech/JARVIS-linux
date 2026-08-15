import React, { useEffect, useRef } from 'react';
import { ConnectionState } from '../types';
import { Mic, MicOff, Square, Sparkles, Camera, Monitor } from 'lucide-react';

interface VoiceVisualizerProps {
  connectionState: ConnectionState;
  inputVolume: number; // 0 - 100
  outputVolume: number; // 0 - 100
  personaName: string;
  personaColor: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onInterrupt: () => void;
  isVisionActive: boolean;
  visionMode: 'camera' | 'screen' | null;
  onToggleVision: (mode: 'camera' | 'screen') => void;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  connectionState,
  inputVolume,
  outputVolume,
  personaName,
  personaColor,
  isMuted,
  onToggleMute,
  onStartSession,
  onStopSession,
  onInterrupt,
  isVisionActive,
  visionMode,
  onToggleVision,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      const isConnected = connectionState !== 'disconnected' && connectionState !== 'connecting';
      const activeVolume = connectionState === 'speaking' ? outputVolume : inputVolume;
      const baseRadius = Math.min(width, height) * 0.22;
      const dynamicRadius = baseRadius + (activeVolume * 0.6);

      phase += 0.04;

      // Draw outer glowing pulsing rings
      const ringCount = 3;
      for (let i = ringCount; i >= 1; i--) {
        const ringRadius = dynamicRadius + i * 18 + Math.sin(phase + i) * 6;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, ringRadius), 0, Math.PI * 2);

        let strokeColor = 'rgba(244, 63, 94, 0.08)'; // rose default
        if (personaColor === 'cyan') strokeColor = 'rgba(6, 182, 212, 0.16)';
        if (personaColor === 'red') strokeColor = 'rgba(239, 68, 68, 0.16)';
        if (personaColor === 'amber') strokeColor = 'rgba(245, 158, 11, 0.12)';
        if (personaColor === 'emerald') strokeColor = 'rgba(16, 185, 129, 0.12)';
        if (personaColor === 'indigo') strokeColor = 'rgba(99, 102, 241, 0.12)';
        if (personaColor === 'sky') strokeColor = 'rgba(14, 165, 233, 0.12)';

        if (connectionState === 'speaking') strokeColor = 'rgba(99, 102, 241, 0.18)';
        if (connectionState === 'listening') strokeColor = 'rgba(244, 63, 94, 0.25)';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw fluid organic orb shape
      ctx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave1 = Math.sin(angle * 3 + phase) * (activeVolume * 0.2 + 4);
        const wave2 = Math.cos(angle * 5 - phase * 1.5) * (activeVolume * 0.15 + 3);
        const r = dynamicRadius + wave1 + wave2;

        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Create rich gradient fill based on persona & speaking state
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, dynamicRadius + 20);

      if (connectionState === 'speaking') {
        gradient.addColorStop(0, '#818cf8');
        gradient.addColorStop(0.5, '#6366f1');
        gradient.addColorStop(1, '#4f46e5');
      } else if (connectionState === 'listening') {
        gradient.addColorStop(0, '#fb7185');
        gradient.addColorStop(0.5, '#f43f5e');
        gradient.addColorStop(1, '#e11d48');
      } else {
        // Persona default colors
        switch (personaColor) {
          case 'cyan':
            gradient.addColorStop(0, '#22d3ee');
            gradient.addColorStop(1, '#0891b2');
            break;
          case 'red':
            gradient.addColorStop(0, '#f87171');
            gradient.addColorStop(1, '#dc2626');
            break;
          case 'amber':
            gradient.addColorStop(0, '#fbbf24');
            gradient.addColorStop(1, '#d97706');
            break;
          case 'emerald':
            gradient.addColorStop(0, '#34d399');
            gradient.addColorStop(1, '#059669');
            break;
          case 'indigo':
            gradient.addColorStop(0, '#818cf8');
            gradient.addColorStop(1, '#4f46e5');
            break;
          case 'sky':
            gradient.addColorStop(0, '#38bdf8');
            gradient.addColorStop(1, '#0284c7');
            break;
          case 'rose':
          default:
            gradient.addColorStop(0, '#f472b6');
            gradient.addColorStop(1, '#e11d48');
            break;
        }
      }

      ctx.fillStyle = gradient;
      ctx.shadowColor = connectionState === 'speaking' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(244, 63, 94, 0.3)';
      ctx.shadowBlur = isConnected ? 25 + activeVolume * 0.3 : 10;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [connectionState, inputVolume, outputVolume, personaColor]);

  const getStatusText = () => {
    switch (connectionState) {
      case 'connecting':
        return 'Connecting real-time socket...';
      case 'listening':
        return `${personaName} is listening to you...`;
      case 'speaking':
        return `${personaName} is speaking...`;
      case 'connected':
        return isMuted ? 'Microphone Muted' : 'Ready — start speaking naturally';
      case 'error':
        return 'Connection interrupted. Tap below to retry.';
      default:
        return 'Tap mic to start real-time voice chat';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-6 sm:py-10 px-4 w-full max-w-xl mx-auto">
      {/* Visualizer Canvas Frame */}
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full cursor-pointer touch-none filter drop-shadow-[0_0_30px_rgba(244,63,94,0.15)]"
          onClick={connectionState === 'disconnected' ? onStartSession : undefined}
        />

        {/* Center Overlay Icon or Avatar */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {connectionState === 'disconnected' && (
            <div className="w-20 h-20 rounded-full glass-panel shadow-2xl border border-white/20 flex items-center justify-center transition-transform hover:scale-105 pointer-events-auto cursor-pointer group" onClick={onStartSession}>
              <Mic className="w-8 h-8 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="w-16 h-16 rounded-full glass-panel shadow-2xl border border-white/20 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Status Text */}
      <div className="mt-4 text-center">
        <p className="text-sm sm:text-base font-medium text-zinc-200 animate-fade-in flex items-center justify-center gap-2">
          {connectionState === 'speaking' && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />}
          {connectionState === 'listening' && <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />}
          {getStatusText()}
        </p>

        {connectionState === 'speaking' && (
          <button
            onClick={onInterrupt}
            className="mt-2 text-xs font-semibold text-indigo-300 hover:text-white glass-pill hover:bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30 transition-all"
          >
            Tap to Interrupt
          </button>
        )}
      </div>

      {/* Controls Dock */}
      <div className="mt-6 flex items-center gap-3 glass-panel p-2.5 px-6 rounded-full shadow-2xl">
        {connectionState !== 'disconnected' ? (
          <>
            {/* Mute Mic button */}
            <button
              onClick={onToggleMute}
              className={`p-3 rounded-full transition-all ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 ring-2 ring-amber-400/50'
                  : 'glass-pill text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Camera Vision Button */}
            <button
              onClick={() => onToggleVision('camera')}
              className={`p-3 rounded-full transition-all ${
                isVisionActive && visionMode === 'camera'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40'
                  : 'glass-pill text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle Camera Vision"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Screen Share Vision Button */}
            <button
              onClick={() => onToggleVision('screen')}
              className={`p-3 rounded-full transition-all ${
                isVisionActive && visionMode === 'screen'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
                  : 'glass-pill text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle Screen Share Vision"
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* End Call / Stop Session */}
            <button
              onClick={onStopSession}
              className="p-3.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/40 hover:scale-105 ml-1"
              title="End Voice Call"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </>
        ) : (
          <>
            {/* Start Conversation Call */}
            <button
              onClick={onStartSession}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 text-white font-medium text-sm hover:opacity-95 shadow-xl shadow-rose-500/25 transition-all hover:scale-105 border border-white/20"
            >
              <Mic className="w-4 h-4" />
              Start Voice Conversation
            </button>

            {/* Camera Vision Button */}
            <button
              onClick={() => onToggleVision('camera')}
              className={`p-3 rounded-full transition-all ${
                isVisionActive && visionMode === 'camera'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40'
                  : 'glass-pill text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
              title="Test Camera Vision"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Screen Share Button */}
            <button
              onClick={() => onToggleVision('screen')}
              className={`p-3 rounded-full transition-all ${
                isVisionActive && visionMode === 'screen'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
                  : 'glass-pill text-zinc-200 hover:bg-white/10 hover:text-white'
              }`}
              title="Test Screen Share Vision"
            >
              <Monitor className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
