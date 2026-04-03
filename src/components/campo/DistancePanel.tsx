'use client';

import { useState } from 'react';
import { useCampoStore } from '@/stores/campo-store';

export default function DistancePanel() {
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

  const [strategy, setStrategy] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  const askStrategy = async () => {
    if (!distanceToPin || !recommendedClub) return;
    setLoadingStrategy(true);
    setStrategy(null);

    try {
      const response = await fetch('/api/analyze-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: [], // No frames - strategy only
          club: recommendedClub.label,
          shotNumber: 0,
          strategyRequest: {
            distanceToPin: Math.round(distanceToPin),
            par,
            hole: currentHole,
            courseName: activeCourse?.name ?? 'campo desconocido',
            recommendedClub: recommendedClub.label,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStrategy(data.strategy ?? data.swingTips?.join('. ') ?? 'No se pudo generar estrategia.');
      } else {
        setStrategy('Error al obtener estrategia. Intentalo de nuevo.');
      }
    } catch {
      setStrategy('Sin conexion. Intentalo de nuevo.');
    }
    setLoadingStrategy(false);
  };

  if (gpsError) {
    return (
      <div className="bg-[#111] border-t border-white/10 px-4 py-4">
        <p className="text-danger text-sm text-center">{gpsError}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border-t border-white/10 px-4 py-3">
      {pinPosition && distanceToPin != null ? (
        <div>
          {/* Distance + Club */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-4xl font-bold text-white">
                {Math.round(distanceToPin)}m
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Hoyo {currentHole} · Par {par}
                {gpsAccuracy != null && ` · GPS ±${Math.round(gpsAccuracy)}m`}
              </div>
            </div>
            {recommendedClub && (
              <div className="text-right">
                <div className="text-2xl font-bold text-accent">
                  {recommendedClub.shortLabel}
                </div>
                <div className="text-sm text-zinc-400">{recommendedClub.label}</div>
              </div>
            )}
          </div>

          {/* AI Strategy */}
          {strategy && (
            <div className="rounded-xl bg-accent/10 p-3 text-sm text-zinc-200 mb-2 animate-fade-in-up">
              <span className="text-accent font-medium">Estrategia IA:</span> {strategy}
            </div>
          )}

          {/* Ask strategy button */}
          <button
            onClick={askStrategy}
            disabled={loadingStrategy}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-black transition-colors active:bg-accent/80 disabled:opacity-60"
          >
            {loadingStrategy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Pensando estrategia...
              </span>
            ) : strategy ? (
              'Pedir otra estrategia'
            ) : (
              'Pedir estrategia al caddie IA'
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-zinc-500 text-xs">
            Hoyo {currentHole} · Par {par} · Toca el mapa o arrastra 🚩 para colocar la bandera
          </p>
        </div>
      )}
    </div>
  );
}
