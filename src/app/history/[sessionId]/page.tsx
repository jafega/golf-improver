'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Session, Shot } from '@/types/session';
import { getClubInfo } from '@/types/club';
import * as db from '@/lib/db';
import { loadVideo } from '@/lib/storage';
import BottomNav from '@/components/ui/BottomNav';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await db.getSession(sessionId);
      if (s) setSession(s);
      const sh = await db.getSessionShots(sessionId);
      setShots(sh);
    }
    load();
  }, [sessionId]);

  useEffect(() => {
    let url: string | null = null;
    if (selectedShot) {
      loadVideo(selectedShot.videoStorageKey).then((blob) => {
        if (blob) {
          url = URL.createObjectURL(blob);
          setVideoUrl(url);
        }
      });
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedShot]);

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-20">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#111] px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-accent text-sm">
            ← Historial
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-danger text-sm font-medium"
          >
            Eliminar
          </button>
        </div>
        <h1 className="text-lg font-bold mt-1">
          Sesion del{' '}
          {new Date(session.startedAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
          })}
        </h1>
        <div className="text-sm text-zinc-500">
          {session.totalShots} tiros
          {session.averageDistance != null &&
            ` · Media: ${Math.round(session.averageDistance)}m`}
        </div>
      </header>

      {/* Selected shot video */}
      {selectedShot && (
        <div className="flex-shrink-0 bg-black">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full max-h-64 object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
          {selectedShot.analysis?.status === 'complete' && (
            <div className="p-3 space-y-2 bg-[#111]">
              {/* 3 Metrics */}
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-lg font-bold">{getClubInfo(selectedShot.club).shortLabel}</div>
                  <div className="text-[10px] text-zinc-500">Palo</div>
                </div>
                <div className="flex-1 rounded-lg bg-white/5 p-2 text-center">
                  <div className={`text-lg font-bold ${
                    selectedShot.analysis.straightness >= 80 ? 'text-accent' :
                    selectedShot.analysis.straightness >= 50 ? 'text-warning' : 'text-danger'
                  }`}>
                    {Math.round(selectedShot.analysis.straightness)}%
                  </div>
                  <div className="text-[10px] text-zinc-500">Direccion</div>
                </div>
                <div className="flex-1 rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-lg font-bold text-accent">
                    {selectedShot.distance ? `${Math.round(selectedShot.distance.estimated)}m` : '--'}
                  </div>
                  <div className="text-[10px] text-zinc-500">Distancia</div>
                </div>
              </div>
              <div className="text-xs text-zinc-500">{selectedShot.analysis.overallRating}/10 rating</div>
              {selectedShot.analysis.swingTips.map((tip, i) => (
                <p key={i} className="text-sm text-zinc-300">
                  💡 {tip}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shot list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {shots.map((shot) => {
          const club = getClubInfo(shot.club);
          const isSelected = selectedShot?.id === shot.id;
          return (
            <button
              key={shot.id}
              onClick={() => setSelectedShot(isSelected ? null : shot)}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                isSelected ? 'bg-accent/10 ring-1 ring-accent' : 'bg-white/5 active:bg-white/10'
              }`}
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {shot.thumbnailDataUrl ? (
                  <img src={shot.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600 text-xs">
                    #{shot.shotNumber}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">Tiro #{shot.shotNumber}</span>
                  {shot.isPersonalRecord && <span className="text-yellow-400 text-xs">🏆</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium">
                    {club.shortLabel}
                  </span>
                  {shot.analysis?.status === 'complete' && (
                    <span className={`text-xs font-semibold ${
                      shot.analysis.straightness >= 80 ? 'text-accent' :
                      shot.analysis.straightness >= 50 ? 'text-warning' : 'text-danger'
                    }`}>
                      Dir: {Math.round(shot.analysis.straightness)}%
                    </span>
                  )}
                  <span className="text-xs font-semibold text-accent">
                    {shot.distance ? `${Math.round(shot.distance.estimated)}m` : '--'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 w-full max-w-sm rounded-2xl bg-[#1a1a1a] p-6">
            <h2 className="text-lg font-bold mb-2">Eliminar sesion?</h2>
            <p className="text-sm text-zinc-400 mb-5">
              Se eliminaran todos los videos y datos de esta sesion. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium transition-colors active:bg-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await db.deleteSession(sessionId);
                  router.push('/history');
                }}
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
