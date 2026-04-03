'use client';

import { useEffect, useState } from 'react';
import { Session } from '@/types/session';
import * as db from '@/lib/db';
import BottomNav from '@/components/ui/BottomNav';
import Link from 'next/link';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await db.getAllSessions();
      setSessions(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-1 flex-col pb-20">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#111] px-4 py-4">
        <h1 className="text-xl font-bold">Historial</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <div className="text-4xl mb-2">📋</div>
            <p>No hay sesiones todavia</p>
            <p className="text-sm mt-1">Empieza una sesion para ver tu historial</p>
          </div>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/history/${session.id}`}
              className="block rounded-xl bg-white/5 p-4 transition-colors active:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {new Date(session.startedAt).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                  <div className="text-sm text-zinc-500 mt-0.5">
                    {session.totalShots} tiros
                    {session.averageDistance != null &&
                      ` · Media: ${Math.round(session.averageDistance)}m`}
                  </div>
                </div>
                {session.bestDistance != null && (
                  <div className="text-right">
                    <div className="text-accent font-semibold">
                      {Math.round(session.bestDistance)}m
                    </div>
                    <div className="text-xs text-zinc-500">Mejor</div>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
