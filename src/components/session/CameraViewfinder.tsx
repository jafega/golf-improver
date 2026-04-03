'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { requestCamera, stopStream } from '@/lib/camera';

interface CameraViewfinderProps {
  onStreamReady: (stream: MediaStream) => void;
  isRecording: boolean;
  facingMode: 'environment' | 'user';
  onToggleCamera: () => void;
  onReadyDetected?: () => void;
}

export default function CameraViewfinder({
  onStreamReady,
  isRecording,
  facingMode,
  onToggleCamera,
  onReadyDetected,
}: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const readyCalledRef = useRef(false);

  // Init or switch camera
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      // Stop previous stream
      if (streamRef.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
      }
      setError(null);
      setIsReady(false);
      readyCalledRef.current = false;

      try {
        const stream = await requestCamera({ facingMode });
        if (!mounted) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        onStreamReady(stream);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Necesitas dar permiso a la camara para grabar'
              : 'No se pudo acceder a la camara'
          );
        }
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        stopStream(streamRef.current);
      }
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ball + club detection loop (only when not recording)
  const detectBallAndClub = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return false;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    // Sample at lower resolution for performance
    const w = 160;
    const h = 120;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let whiteBrightPixels = 0; // Potential ball pixels
    let darkPixels = 0; // Potential club/shaft pixels
    let greenPixels = 0; // Grass detection

    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;

      // White ball detection: very bright, low saturation
      if (brightness > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
        whiteBrightPixels++;
      }

      // Dark elongated object (club shaft): very dark
      if (brightness < 60) {
        darkPixels++;
      }

      // Green grass: g channel dominant
      if (g > 80 && g > r * 1.2 && g > b * 1.1) {
        greenPixels++;
      }
    }

    const totalSampled = (data.length / 16);
    const whitePct = whiteBrightPixels / totalSampled;
    const darkPct = darkPixels / totalSampled;
    const greenPct = greenPixels / totalSampled;

    // Ball detected: small white area (0.5%-5% of frame)
    const hasBall = whitePct > 0.005 && whitePct < 0.05;
    // Club detected: some dark area (2%-25% of frame)
    const hasClub = darkPct > 0.02 && darkPct < 0.25;
    // On grass/range: reasonable green area (>5%)
    const hasGrass = greenPct > 0.05;

    // Ready when we see ball + club (grass is bonus confidence)
    return hasBall && hasClub;
  }, []);

  // Run detection when not recording
  useEffect(() => {
    if (isRecording || error) {
      // Stop detection while recording
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      setIsReady(false);
      readyCalledRef.current = false;
      return;
    }

    detectionIntervalRef.current = window.setInterval(() => {
      const detected = detectBallAndClub();
      setIsReady(detected);

      if (detected && !readyCalledRef.current) {
        readyCalledRef.current = true;
        onReadyDetected?.();
      }

      // Reset after 3 seconds so it can trigger again if scene changes
      if (!detected) {
        readyCalledRef.current = false;
      }
    }, 500); // Check every 500ms

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isRecording, error, detectBallAndClub, onReadyDetected]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black p-6">
        <div className="text-center">
          <p className="text-lg text-zinc-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent px-6 py-3 text-black font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex-1 bg-black ${isRecording ? 'ring-2 ring-danger ring-inset' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />
      {/* Hidden canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera switch button */}
      {!isRecording && (
        <button
          onClick={onToggleCamera}
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors active:bg-black/70"
          aria-label="Cambiar camara"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z"/>
          </svg>
        </button>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-danger/90 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-medium text-white">REC</span>
        </div>
      )}

      {/* Ready indicator */}
      {isReady && !isRecording && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent/90 px-4 py-2 animate-fade-in-up">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          <span className="text-sm font-bold text-black">READY</span>
        </div>
      )}
    </div>
  );
}
