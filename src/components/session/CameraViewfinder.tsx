'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { requestCamera, stopStream } from '@/lib/camera';

interface DetectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

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
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const readyCalledRef = useRef(false);
  const detectionsRef = useRef<DetectionBox[]>([]);

  // Init or switch camera
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
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

  // Detect ball and club, returns bounding boxes in normalized coords (0-1)
  const runDetection = useCallback((): { boxes: DetectionBox[]; hasBall: boolean; hasClub: boolean } => {
    const video = videoRef.current;
    const canvas = analysisCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return { boxes: [], hasBall: false, hasClub: false };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { boxes: [], hasBall: false, hasClub: false };

    const W = 192;
    const H = 144;
    canvas.width = W;
    canvas.height = H;
    ctx.drawImage(video, 0, 0, W, H);

    const imageData = ctx.getImageData(0, 0, W, H);
    const d = imageData.data;

    // Grid-based clustering for speed: divide into 12x9 cells
    const cellW = 16;
    const cellH = 16;
    const cols = W / cellW;
    const rows = H / cellH;

    // === BALL DETECTION ===
    // Golf ball at 192x144 from 2-5m behind: only ~2-6px diameter
    // Strategy: find bright pixels that are BRIGHTER than their immediate surroundings
    // (local contrast), neutral color, in the lower portion of the frame
    const ballCandidates: { cx: number; cy: number; score: number }[] = [];

    const startScanY = Math.floor(H * 0.3);
    for (let y = startScanY + 3; y < H - 3; y += 2) {
      for (let x = 3; x < W - 3; x += 2) {
        const i = (y * W + x) * 4;
        const cr = d[i], cg = d[i + 1], cb = d[i + 2];
        const cBright = (cr + cg + cb) / 3;

        // Must be bright-ish and neutral (white/grey ball)
        if (cBright < 160) continue;
        if (Math.abs(cr - cg) > 35 || Math.abs(cg - cb) > 35) continue;

        // Check local contrast: this pixel must be significantly brighter
        // than the average of its surrounding ring (radius 3-5px)
        let surroundBright = 0;
        let surroundCount = 0;
        let innerBright = 0;
        let innerCount = 0;

        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = (ny * W + nx) * 4;
            const nb = (d[ni] + d[ni + 1] + d[ni + 2]) / 3;
            const dist2 = dx * dx + dy * dy;

            if (dist2 <= 4) { // radius ~2px = inner (ball core)
              innerBright += nb;
              innerCount++;
            } else if (dist2 <= 25) { // radius 3-5px = surrounding
              surroundBright += nb;
              surroundCount++;
            }
          }
        }

        const avgInner = innerCount > 0 ? innerBright / innerCount : 0;
        const avgSurround = surroundCount > 0 ? surroundBright / surroundCount : 255;

        // Ball must be at least 40 brightness units above surroundings (local contrast)
        // and the surrounding must NOT be very bright (reject white surfaces)
        const contrast = avgInner - avgSurround;
        if (contrast > 35 && avgSurround < 180) {
          ballCandidates.push({ cx: x, cy: y, score: contrast });
        }
      }
    }

    // Deduplicate nearby candidates (within 8px = same ball)
    const dedupedBalls: typeof ballCandidates = [];
    for (const c of ballCandidates.sort((a, b) => b.score - a.score)) {
      const tooClose = dedupedBalls.some(
        (d2) => Math.abs(d2.cx - c.cx) < 8 && Math.abs(d2.cy - c.cy) < 8
      );
      if (!tooClose) dedupedBalls.push(c);
    }

    // === CLUB DETECTION ===
    // Golf club shaft: thin dark elongated line, roughly vertical or angled
    // Scan for vertical runs of dark pixels
    const shaftCandidates: { x: number; yStart: number; yEnd: number; score: number }[] = [];

    for (let x = 4; x < W - 4; x += 4) {
      let runStart = -1;
      let runLen = 0;
      let thinCount = 0;

      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const isDark = brightness < 65;

        if (isDark) {
          if (runStart === -1) runStart = y;
          runLen++;

          // Check thinness: pixels ±4px to left/right should NOT be dark
          const leftI = (y * W + Math.max(0, x - 4)) * 4;
          const rightI = (y * W + Math.min(W - 1, x + 4)) * 4;
          const leftBright = (d[leftI] + d[leftI + 1] + d[leftI + 2]) / 3;
          const rightBright = (d[rightI] + d[rightI + 1] + d[rightI + 2]) / 3;
          if (leftBright > 80 || rightBright > 80) thinCount++;
        } else {
          if (runLen >= 15 && thinCount >= runLen * 0.4) {
            // This looks like a shaft: long dark run that is thin
            shaftCandidates.push({
              x,
              yStart: runStart,
              yEnd: runStart + runLen,
              score: runLen * (thinCount / runLen),
            });
          }
          runStart = -1;
          runLen = 0;
          thinCount = 0;
        }
      }
      // Close any open run
      if (runLen >= 15 && thinCount >= runLen * 0.4) {
        shaftCandidates.push({
          x,
          yStart: runStart,
          yEnd: runStart + runLen,
          score: runLen * (thinCount / runLen),
        });
      }
    }

    const boxes: DetectionBox[] = [];
    let hasBall = false;
    let hasClub = false;

    // Pick best ball candidate (highest local contrast)
    if (dedupedBalls.length > 0 && dedupedBalls.length <= 5) {
      // If too many candidates (>5), it's probably a noisy scene, skip
      const best = dedupedBalls[0];
      hasBall = true;
      const boxSize = 16;
      boxes.push({
        x: (best.cx - boxSize / 2) / W,
        y: (best.cy - boxSize / 2) / H,
        w: boxSize / W,
        h: boxSize / H,
        label: 'Bola',
        color: '#22c55e',
      });
    }

    // Pick best shaft candidate
    if (shaftCandidates.length > 0) {
      shaftCandidates.sort((a, b) => b.score - a.score);
      const best = shaftCandidates[0];
      hasClub = true;
      boxes.push({
        x: (best.x - 6) / W,
        y: best.yStart / H,
        w: 12 / W,
        h: (best.yEnd - best.yStart) / H,
        label: 'Palo',
        color: '#3b82f6',
      });
    }

    return { boxes, hasBall, hasClub };
  }, []);

  // Draw detection overlay
  const drawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    const rect = video.getBoundingClientRect();
    if (overlay.width !== rect.width || overlay.height !== rect.height) {
      overlay.width = rect.width;
      overlay.height = rect.height;
    }

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const boxes = detectionsRef.current;
    const isMirrored = facingMode === 'user';

    for (const box of boxes) {
      let bx = box.x * overlay.width;
      const by = box.y * overlay.height;
      const bw = box.w * overlay.width;
      const bh = box.h * overlay.height;

      // Mirror for front camera
      if (isMirrored) {
        bx = overlay.width - bx - bw;
      }

      // Draw box
      ctx.strokeStyle = box.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Corner accents (solid)
      const cornerLen = Math.min(bw, bh) * 0.25;
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      // Label
      ctx.font = 'bold 11px sans-serif';
      const textW = ctx.measureText(box.label).width + 8;
      ctx.fillStyle = box.color;
      ctx.fillRect(bx, by - 18, textW, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(box.label, bx + 4, by - 5);
    }
  }, [facingMode]);

  // Animation loop: detect + draw
  useEffect(() => {
    if (error) return;

    let running = true;

    const loop = () => {
      if (!running) return;

      const now = performance.now();

      // Run detection every 150ms
      if (!isRecording && now - lastDetectTimeRef.current > 150) {
        lastDetectTimeRef.current = now;
        const { boxes, hasBall, hasClub } = runDetection();
        detectionsRef.current = boxes;

        const ready = hasBall && hasClub;
        setIsReady(ready);

        if (ready && !readyCalledRef.current) {
          readyCalledRef.current = true;
          onReadyDetected?.();
        }
        if (!ready) {
          readyCalledRef.current = false;
        }
      }

      // Clear overlay while recording
      if (isRecording) {
        detectionsRef.current = [];
      }

      // Draw overlay every frame for smooth rendering
      drawOverlay();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, error, runDetection, drawOverlay, onReadyDetected]);

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
      <canvas ref={analysisCanvasRef} className="hidden" />
      {/* Overlay canvas for drawing detection boxes */}
      <canvas
        ref={overlayCanvasRef}
        className={`absolute inset-0 h-full w-full pointer-events-none ${facingMode === 'user' ? '' : ''}`}
      />

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

