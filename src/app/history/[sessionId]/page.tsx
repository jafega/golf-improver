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
        <button onClick={() => router.back()} className="text-accent text-sm mb-1">
          ← Historial
        </button>
        <h1 className="text-lg font-bold">
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
              <div className="flex items-center justify-between">
                <span className="text-accent font-bold text-xl">
                  {selectedShot.analysis.overallRating}/10
                </span>
                {selectedShot.distance && (
                  <span className="text-accent font-medium">
                    {Math.round(selectedShot.distance.estimated)}m
                  </span>
                )}
              </div>
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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Tiro #{shot.shotNumber}</span>
                  <span className="text-xs text-zinc-500">{club.shortLabel}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {shot.distance ? `${Math.round(shot.distance.estimated)}m` : 'Sin distancia'}
                  {shot.analysis?.status === 'complete' &&
                    ` · ${shot.analysis.overallRating}/10`}
                </div>
              </div>
              {shot.isPersonalRecord && (
                <span className="text-yellow-400 text-xs">🏆</span>
              )}
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
