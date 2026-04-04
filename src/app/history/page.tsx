'use client';

import { useEffect, useState } from 'react';
import { Session } from '@/types/session';
import * as db from '@/lib/db';
import BottomNav from '@/components/ui/BottomNav';
import Link from 'next/link';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await db.getAllSessions();
      setSessions(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await db.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#111] px-4 py-4">
        <h1 className="text-xl font-bold">Historial</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 space-y-3">
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
            <div key={session.id} className="relative rounded-xl bg-white/5 transition-colors active:bg-white/10">
              <Link
                href={`/history/${session.id}`}
                className="block p-4"
              >
                <div className="flex items-center justify-between pr-10">
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
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteId(session.id);
                }}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:text-danger hover:bg-danger/10 transition-colors"
                aria-label="Eliminar sesion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 w-full max-w-sm rounded-2xl bg-[#1a1a1a] p-6">
            <h2 className="text-lg font-bold mb-2">Eliminar sesion?</h2>
            <p className="text-sm text-zinc-400 mb-5">
              Se eliminaran todos los videos y datos de esta sesion. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium transition-colors active:bg-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-xl bg-danger py-3 text-sm font-bold text-white transition-colors active:bg-danger/80"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
