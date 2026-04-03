'use client';

import { useCampoStore } from '@/stores/campo-store';
import { CLUBS } from '@/types/club';

function getStrategy(distanceM: number, par: number): string {
  if (par === 3) {
    if (distanceM <= 120) return 'Par 3 corto. Apunta al centro del green con un wedge suave.';
    if (distanceM <= 160) return 'Par 3 medio. Hierro medio al green, evita los bunkers.';
    return 'Par 3 largo. Hierro largo o hibrido al green. No fuerces, centro del green.';
  }
  if (par === 4) {
    if (distanceM > 200) return 'Primer golpe: Driver o madera al centro del fairway. Deja un approach comodo.';
    if (distanceM > 140) return 'Buen approach. Hierro medio apuntando al centro del green.';
    if (distanceM > 80) return 'Wedge al green. Controla la distancia, no hace falta fuerza.';
    return 'Cerca del green. Chip o pitch suave, deja la bola cerca del hoyo.';
  }
  if (par === 5) {
    if (distanceM > 300) return 'Par 5: Driver al fairway. No arriesgues, busca posicion.';
    if (distanceM > 200) return 'Segundo golpe: Madera o hibrido para acortar. Deja un wedge al green.';
    if (distanceM > 100) return 'Tercer golpe: Wedge al green. Controla la distancia.';
    return 'Cerca del green. Chip preciso, busca dejar putt corto.';
  }
  return 'Apunta al centro del green.';
}

export default function DistancePanel() {
  const {
    distanceToPin,
    recommendedClub,
    pinPosition,
    gpsError,
    gpsAccuracy,
    isPlacingPin,
    setIsPlacingPin,
    activeCourse,
    currentHole,
  } = useCampoStore();

  const holeData = activeCourse?.holes.find((h) => h.number === currentHole);
  const par = holeData?.par ?? 4;

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

          {/* Strategy */}
          <div className="rounded-xl bg-white/5 p-3 text-sm text-zinc-300">
            <span className="text-accent mr-1">💡</span>
            {getStrategy(distanceToPin, par)}
          </div>

          {/* Alternative clubs */}
          {recommendedClub && distanceToPin > 30 && (
            <div className="flex gap-2 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CLUBS.filter((c) => {
                const diff = Math.abs(c.typicalDistanceM - distanceToPin);
                return diff < 30 && c.type !== 'putter';
              }).map((c) => (
                <div
                  key={c.type}
                  className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs ${
                    c.type === recommendedClub.type
                      ? 'bg-accent/20 text-accent font-bold'
                      : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {c.shortLabel} ~{c.typicalDistanceM}m
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          {isPlacingPin ? (
            <div>
              <p className="text-accent text-sm font-medium mb-2">
                Toca el mapa donde esta la bandera del hoyo {currentHole}
              </p>
              <button
                onClick={() => setIsPlacingPin(false)}
                className="text-zinc-500 text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div>
              <p className="text-zinc-500 text-xs mb-2">
                Hoyo {currentHole} · Par {par} · Sin bandera colocada
              </p>
              <button
                onClick={() => setIsPlacingPin(true)}
                className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-black transition-colors active:bg-accent/80"
              >
                Colocar bandera en el mapa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
