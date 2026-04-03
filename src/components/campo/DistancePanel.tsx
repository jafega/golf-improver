'use client';

import { useCampoStore } from '@/stores/campo-store';

export default function DistancePanel() {
  const {
    distanceToPin,
    recommendedClub,
    pinPosition,
    gpsError,
    gpsAccuracy,
    isPlacingPin,
    setIsPlacingPin,
  } = useCampoStore();

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
        <div className="flex items-center justify-between">
          <div>
            <div className="text-4xl font-bold text-white">
              {Math.round(distanceToPin)}m
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              a la bandera
              {gpsAccuracy != null && ` · GPS ±${Math.round(gpsAccuracy)}m`}
            </div>
          </div>
          {recommendedClub && (
            <div className="text-right">
              <div className="text-2xl font-bold text-accent">
                {recommendedClub.shortLabel}
              </div>
              <div className="text-sm text-zinc-400">{recommendedClub.label}</div>
              <div className="text-xs text-zinc-600">
                ~{recommendedClub.typicalDistanceM}m tipico
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          {isPlacingPin ? (
            <div>
              <p className="text-accent text-sm font-medium mb-2">
                Toca el mapa donde esta la bandera
              </p>
              <button
                onClick={() => setIsPlacingPin(false)}
                className="text-zinc-500 text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsPlacingPin(true)}
              className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-black transition-colors active:bg-accent/80"
            >
              Colocar bandera en el mapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
