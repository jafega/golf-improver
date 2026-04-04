'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useCampoStore } from '@/stores/campo-store';

interface DistancePanelProps {
  onCaptureMap?: () => Promise<string | null>;
}

export default function DistancePanel({ onCaptureMap }: DistancePanelProps) {
  const {
    distanceToPin,
    recommendedClub,
    pinPosition,
    gpsError,
    gpsAccuracy,
    activeCourse,
    currentHole,
  } = useCampoStore();

  const holeData = activeCourse?.holes.find((h) => h.number === currentHole);
  const par = holeData?.par ?? 4;

  const [expanded, setExpanded] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  // Reset strategy on hole change
  useEffect(() => {
    setStrategy(null);
    setExpanded(false);
  }, [currentHole]);

  const askStrategy = useCallback(async () => {
    if (!distanceToPin || !recommendedClub) return;
    setLoadingStrategy(true);
    setExpanded(true);
    setStrategy(null);

    // Capture map screenshot if available
    let mapImage: string | null = null;
    if (onCaptureMap) {
      try {
        mapImage = await onCaptureMap();
      } catch {
        // Continue without map image
      }
    }

    try {
      const response = await fetch('/api/analyze-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: [],
          club: recommendedClub.label,
          shotNumber: 0,
          strategyRequest: {
            distanceToPin: Math.round(distanceToPin),
            par,
            hole: currentHole,
            courseName: activeCourse?.name ?? 'campo desconocido',
            recommendedClub: recommendedClub.label,
            mapImage,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStrategy(data.strategy ?? 'No se pudo generar estrategia.');
      } else {
        setStrategy('Error al obtener estrategia. Intentalo de nuevo.');
      }
    } catch {
      setStrategy('Sin conexion. Intentalo de nuevo.');
    }
    setLoadingStrategy(false);
  }, [distanceToPin, recommendedClub, par, currentHole, activeCourse?.name, onCaptureMap]);

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartY.current - dragCurrentY.current;
    if (diff > 40) {
      // Swiped up
      setExpanded(true);
    } else if (diff < -40) {
      // Swiped down
      setExpanded(false);
    }
  };

  if (gpsError) {
    return (
      <div className="bg-[#111] border-t border-white/10 px-4 py-3">
        <p className="text-danger text-sm text-center">{gpsError}</p>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`bg-[#111] border-t border-white/10 transition-all duration-300 ${
        expanded ? 'max-h-[60vh] overflow-y-auto' : 'max-h-28'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="h-1 w-10 rounded-full bg-zinc-600" />
      </div>

      {pinPosition && distanceToPin != null ? (
        <div className="px-4 pb-3">
          {/* Distance + Club + Strategy button */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-white">
                {Math.round(distanceToPin)}m
              </div>
              <div className="text-[10px] text-zinc-500">
                Hoyo {currentHole} · Par {par}
                {gpsAccuracy != null && ` · ±${Math.round(gpsAccuracy)}m`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {recommendedClub && (
                <div className="text-right">
                  <div className="text-xl font-bold text-accent">
                    {recommendedClub.shortLabel}
                  </div>
                  <div className="text-[10px] text-zinc-400">{recommendedClub.label}</div>
                </div>
              )}
              <button
                onClick={askStrategy}
                disabled={loadingStrategy}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg shadow-lg transition-all active:scale-90 disabled:opacity-50"
                aria-label="Pedir estrategia IA"
              >
                {loadingStrategy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <span>🧠</span>
                )}
              </button>
            </div>
          </div>

          {/* Swipe hint when collapsed and no strategy */}
          {!expanded && !strategy && (
            <p className="text-[10px] text-zinc-600 text-center mt-1">
              Desliza arriba para ver estrategia · Pulsa 🧠 para pedir al caddie IA
            </p>
          )}

          {/* Strategy content (visible when expanded) */}
          {expanded && (
            <div className="mt-3 animate-fade-in-up">
              {loadingStrategy ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/5 p-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-sm text-zinc-400">
                    Analizando el hoyo con vision satelite...
                  </span>
                </div>
              ) : strategy ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🧠</span>
                    <span className="text-accent font-bold text-sm">Caddie IA</span>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
                    {strategy}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={askStrategy}
                      className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-black active:bg-accent/80"
                    >
                      Otra estrategia
                    </button>
                    <button
                      onClick={() => setExpanded(false)}
                      className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-zinc-300 active:bg-white/20"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <button
                    onClick={askStrategy}
                    className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-black active:bg-accent/80"
                  >
                    🧠 Pedir estrategia al caddie IA
                  </button>
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Analiza la imagen satelite para detectar bunkers, agua y arboles
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-zinc-500 text-xs text-center px-4 pb-3">
          Hoyo {currentHole} · Par {par} · Toca el mapa o arrastra 🚩
        </p>
      )}
    </div>
  );
}
