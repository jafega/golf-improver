'use client';

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

  if (gpsError) {
    return (
      <div className="bg-[#111] border-t border-white/10 px-4 py-3">
        <p className="text-danger text-sm text-center">{gpsError}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border-t border-white/10 px-4 py-2">
      {pinPosition && distanceToPin != null ? (
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
          {recommendedClub && (
            <div className="text-right">
              <div className="text-xl font-bold text-accent">
                {recommendedClub.shortLabel}
              </div>
              <div className="text-xs text-zinc-400">{recommendedClub.label}</div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-zinc-500 text-xs text-center py-1">
          Hoyo {currentHole} · Par {par} · Toca el mapa para colocar 🚩
        </p>
      )}
    </div>
  );
}
