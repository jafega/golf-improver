'use client';

import { useEffect, useRef, useState } from 'react';
import { requestCamera, stopStream } from '@/lib/camera';

interface CameraViewfinderProps {
  onStreamReady: (stream: MediaStream) => void;
  isRecording: boolean;
}

export default function CameraViewfinder({ onStreamReady, isRecording }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      try {
        const stream = await requestCamera();
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        className="h-full w-full object-cover"
      />
      {isRecording && (
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-danger/90 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-medium text-white">REC</span>
        </div>
      )}
    </div>
  );
}
