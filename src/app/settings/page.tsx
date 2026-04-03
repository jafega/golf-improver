'use client';

import { useEffect, useState } from 'react';
import { getStorageEstimate } from '@/lib/storage';
import BottomNav from '@/components/ui/BottomNav';

export default function SettingsPage() {
  const [storage, setStorage] = useState({ used: 0, quota: 0, percentage: 0 });

  useEffect(() => {
    getStorageEstimate().then(setStorage);
  }, []);

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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
            <p className="text-xs text-zinc-500 mt-2">
              Los videos se guardan localmente en tu dispositivo
            </p>
          </div>
        </section>

        {/* API Key */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">API Key</h2>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-sm text-zinc-400">
              La API key de Anthropic se configura en el archivo .env.local del servidor
            </p>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Acerca de</h2>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛳</span>
              <div>
                <p className="font-medium">Golf Improver v0.1</p>
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
