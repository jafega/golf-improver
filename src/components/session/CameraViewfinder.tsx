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

    const whiteCells: { col: number; row: number; count: number }[] = [];
    const darkCells: { col: number; row: number; count: number }[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let whiteCount = 0;
        let darkCount = 0;
        const startX = col * cellW;
        const startY = row * cellH;

        // Sample every 2nd pixel in cell for speed
        for (let y = startY; y < startY + cellH; y += 2) {
          for (let x = startX; x < startX + cellW; x += 2) {
            const i = (y * W + x) * 4;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const brightness = (r + g + b) / 3;

            // White ball: very bright, low saturation
            if (brightness > 195 && Math.abs(r - g) < 35 && Math.abs(g - b) < 35 && Math.abs(r - b) < 35) {
              whiteCount++;
            }
            // Dark club: very dark
            if (brightness < 55) {
              darkCount++;
            }
          }
        }

        const samplesPerCell = (cellW / 2) * (cellH / 2); // 64
        if (whiteCount > samplesPerCell * 0.25) {
          whiteCells.push({ col, row, count: whiteCount });
        }
        if (darkCount > samplesPerCell * 0.3) {
          darkCells.push({ col, row, count: darkCount });
        }
      }
    }

    const boxes: DetectionBox[] = [];
    let hasBall = false;
    let hasClub = false;

    // Cluster white cells into ball bounding box
    if (whiteCells.length >= 1 && whiteCells.length <= 8) {
      const cluster = clusterCells(whiteCells);
      if (cluster) {
        hasBall = true;
        boxes.push({
          x: (cluster.minCol * cellW) / W,
          y: (cluster.minRow * cellH) / H,
          w: ((cluster.maxCol - cluster.minCol + 1) * cellW) / W,
          h: ((cluster.maxRow - cluster.minRow + 1) * cellH) / H,
          label: 'Bola',
          color: '#22c55e', // green
        });
      }
    }

    // Cluster dark cells into club bounding box
    if (darkCells.length >= 2 && darkCells.length <= 30) {
      const cluster = clusterCells(darkCells);
      if (cluster) {
        hasClub = true;
        boxes.push({
          x: (cluster.minCol * cellW) / W,
          y: (cluster.minRow * cellH) / H,
          w: ((cluster.maxCol - cluster.minCol + 1) * cellW) / W,
          h: ((cluster.maxRow - cluster.minRow + 1) * cellH) / H,
          label: 'Palo',
          color: '#3b82f6', // blue
        });
      }
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

// Cluster adjacent cells into a bounding box
function clusterCells(
  cells: { col: number; row: number; count: number }[]
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  if (cells.length === 0) return null;

  // Find the largest connected cluster using simple flood fill
  const key = (c: number, r: number) => `${c},${r}`;
  const cellSet = new Set(cells.map((c) => key(c.col, c.row)));
  const visited = new Set<string>();
  let bestCluster: { col: number; row: number }[] = [];

  for (const cell of cells) {
    const k = key(cell.col, cell.row);
    if (visited.has(k)) continue;

    // BFS
    const cluster: { col: number; row: number }[] = [];
    const queue = [{ col: cell.col, row: cell.row }];
    visited.add(k);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      cluster.push(cur);

      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        const nk = key(nc, nr);
        if (cellSet.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push({ col: nc, row: nr });
        }
      }
    }

    if (cluster.length > bestCluster.length) {
      bestCluster = cluster;
    }
  }

  if (bestCluster.length === 0) return null;

  return {
    minCol: Math.min(...bestCluster.map((c) => c.col)),
    maxCol: Math.max(...bestCluster.map((c) => c.col)),
    minRow: Math.min(...bestCluster.map((c) => c.row)),
    maxRow: Math.max(...bestCluster.map((c) => c.row)),
  };
}
