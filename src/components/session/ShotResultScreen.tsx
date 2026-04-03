'use client';

import { Shot } from '@/types/session';
import { getClubInfo, CLUBS, ClubType } from '@/types/club';
import { useSessionStore } from '@/stores/session-store';
import { useEffect, useState, useRef } from 'react';
import { loadVideo } from '@/lib/storage';

interface ShotResultScreenProps {
  shot: Shot;
  onNextShot: () => void;
}

export default function ShotResultScreen({ shot, onNextShot }: ShotResultScreenProps) {
  const club = getClubInfo(shot.club);
  const distance = shot.distance?.manualOverride ?? shot.distance?.estimated;
  const { selectedClub, setSelectedClub } = useSessionStore();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let url: string | null = null;
    loadVideo(shot.videoStorageKey).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setVideoUrl(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [shot.videoStorageKey]);

  const analysis = shot.analysis;
  const isAnalyzing = !analysis || analysis.status === 'pending' || analysis.status === 'analyzing';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-sm overflow-y-auto pb-20">
      {/* Video Replay */}
      <div className="relative h-48 flex-shrink-0 bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        {shot.isPersonalRecord && (
          <div className="absolute top-3 right-3 rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black animate-bounce">
            NUEVO RECORD!
          </div>
        )}
      </div>

      {/* Shot Info */}
      <div className="px-4 py-3">
        {/* Distance + Club */}
        <div className="flex items-end justify-between">
          <div>
            {distance != null ? (
              <div className="text-5xl font-bold text-accent">{Math.round(distance)}m</div>
            ) : (
              <div className="text-2xl text-zinc-500">Calculando...</div>
            )}
            {shot.distance && (
              <div className="text-xs text-zinc-500 mt-0.5">
                Confianza: {shot.distance.confidence}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-medium">{club.label}</div>
            <div className="text-sm text-zinc-500">Tiro #{shot.shotNumber}</div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Analisis IA</h3>
          {isAnalyzing ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/5 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-zinc-400">Analizando tu swing...</span>
            </div>
          ) : analysis?.status === 'complete' ? (
            <div className="space-y-2">
              {/* Rating */}
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3">
                <span className="text-2xl font-bold text-accent">
                  {analysis.overallRating}/10
                </span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${analysis.overallRating * 10}%` }}
                  />
                </div>
              </div>

              {/* Tips */}
              {analysis.swingTips.map((tip, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white/5 p-3 text-sm animate-fade-in-up"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <span className="text-accent mr-1">💡</span> {tip}
                </div>
              ))}

              {/* Comparison */}
              {analysis.comparisonToLast && (
                <div className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
                  {analysis.comparisonToLast}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
              Error al analizar. Puedes reintentar desde el historial.
            </div>
          )}
        </div>

        {/* Next Club Selector */}
        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Siguiente palo</h3>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {CLUBS.map((c) => (
              <button
                key={c.type}
                onClick={() => setSelectedClub(c.type as ClubType)}
                className={`flex-shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                  selectedClub === c.type
                    ? 'bg-accent text-black shadow-lg'
                    : 'bg-white/10 text-zinc-300 active:bg-white/20'
                }`}
              >
                {c.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Next Shot Button */}
        <button
          onClick={onNextShot}
          className="mt-4 w-full rounded-2xl bg-accent py-4 text-lg font-bold text-black transition-colors active:bg-accent/80"
        >
          Siguiente tiro
        </button>
      </div>
    </div>
  );
}
