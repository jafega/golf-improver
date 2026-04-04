'use client';

import { useEffect, useState } from 'react';
import { getStorageEstimate } from '@/lib/storage';
import { CLUBS, ClubType } from '@/types/club';
import * as db from '@/lib/db';
import BottomNav from '@/components/ui/BottomNav';

type ClubDistances = Record<string, number>;

export default function SettingsPage() {
  const [storage, setStorage] = useState({ used: 0, quota: 0, percentage: 0 });
  const [clubDistances, setClubDistances] = useState<ClubDistances>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStorageEstimate().then(setStorage);
    // Load saved custom distances
    db.getSetting<ClubDistances>('customClubDistances').then((d) => {
      if (d) setClubDistances(d);
    });
  }, []);

  const handleDistanceChange = (clubType: ClubType, value: string) => {
    const num = parseInt(value, 10);
    if (value === '') {
      setClubDistances((prev) => {
        const next = { ...prev };
        delete next[clubType];
        return next;
      });
    } else if (!isNaN(num) && num >= 0 && num <= 400) {
      setClubDistances((prev) => ({ ...prev, [clubType]: num }));
    }
    setSaved(false);
  };

  const saveDistances = async () => {
    await db.setSetting('customClubDistances', clubDistances);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="flex flex-1 flex-col pb-20">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#111] px-4 py-4">
        <h1 className="text-xl font-bold">Ajustes</h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-6" style={{ WebkitOverflowScrolling: 'touch' as const, touchAction: 'pan-y' }}>
        {/* Club Distances */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-1">Mis distancias por palo</h2>
          <p className="text-[10px] text-zinc-600 mb-3">
            Configura cuanto llegas con cada palo. Se usara para recomendaciones y estrategia IA.
          </p>
          <div className="space-y-1.5">
            {CLUBS.filter((c) => c.type !== 'putter').map((club) => (
              <div key={club.type} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className="w-8 text-sm font-bold text-accent">{club.shortLabel}</span>
                <span className="flex-1 text-xs text-zinc-400">{club.label}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={400}
                    placeholder={`${club.typicalDistanceM}`}
                    value={clubDistances[club.type] ?? ''}
                    onChange={(e) => handleDistanceChange(club.type as ClubType, e.target.value)}
                    className="w-16 rounded-lg bg-white/10 px-2 py-1.5 text-right text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-xs text-zinc-500">m</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveDistances}
            className={`mt-3 w-full rounded-xl py-3 text-sm font-bold transition-colors ${
              saved
                ? 'bg-accent/20 text-accent'
                : 'bg-accent text-black active:bg-accent/80'
            }`}
          >
            {saved ? 'Guardado!' : 'Guardar distancias'}
          </button>
        </section>

        {/* Storage */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Almacenamiento</h2>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Espacio usado</span>
              <span className="text-sm text-zinc-400">
                {formatBytes(storage.used)} / {formatBytes(storage.quota)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storage.percentage > 80 ? 'bg-danger' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(storage.percentage, 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Acerca de</h2>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛳</span>
              <div>
                <p className="font-medium">Golf Improver v0.2</p>
                <p className="text-sm text-zinc-500">Tu entrenador de golf con IA</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
