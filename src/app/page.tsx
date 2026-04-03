'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '@/components/ui/BottomNav';
import { useEffect, useState } from 'react';
import * as db from '@/lib/db';

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState({ sessions: 0, shots: 0 });

  useEffect(() => {
    async function loadStats() {
      const sessions = await db.getAllSessions();
      const shots = await db.getAllShots();
      setStats({ sessions: sessions.length, shots: shots.length });
    }
    loadStats();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 pb-20">
      <div className="text-center">
        <div className="text-6xl mb-4">⛳</div>
        <h1 className="text-3xl font-bold mb-2">Golf Improver</h1>
        <p className="text-zinc-400 mb-8">Tu entrenador de golf con IA</p>

        <button
          onClick={() => router.push('/session')}
          className="w-full max-w-xs rounded-2xl bg-accent py-5 text-xl font-bold text-black transition-colors active:bg-accent/80"
        >
          Nueva Sesion
        </button>

        {stats.sessions > 0 && (
          <div className="mt-8 flex gap-8 justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.sessions}</div>
              <div className="text-xs text-zinc-500">Sesiones</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.shots}</div>
              <div className="text-xs text-zinc-500">Tiros</div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
