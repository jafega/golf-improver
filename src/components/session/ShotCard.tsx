'use client';

import { Shot } from '@/types/session';
import { getClubInfo } from '@/types/club';

interface ShotCardProps {
  shot: Shot;
  onTap?: () => void;
}

export default function ShotCard({ shot, onTap }: ShotCardProps) {
  const club = getClubInfo(shot.club);
  const distance = shot.distance?.manualOverride ?? shot.distance?.estimated;
  const analysisStatus = shot.analysis?.status ?? 'pending';

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors active:bg-white/10"
    >
      {/* Thumbnail */}
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
        {shot.thumbnailDataUrl ? (
          <img
            src={shot.thumbnailDataUrl}
            alt={`Tiro ${shot.shotNumber}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600 text-xs">
            #{shot.shotNumber}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Tiro #{shot.shotNumber}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
            {club.shortLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {distance != null ? (
            <span className="text-accent text-sm font-semibold">{Math.round(distance)}m</span>
          ) : (
            <span className="text-zinc-500 text-xs">Sin distancia</span>
          )}
          {analysisStatus === 'analyzing' && (
            <span className="text-warning text-xs">Analizando...</span>
          )}
          {analysisStatus === 'complete' && shot.analysis && (
            <span className="text-zinc-400 text-xs">
              {shot.analysis.overallRating}/10
            </span>
          )}
        </div>
      </div>

      {/* Record badge */}
      {shot.isPersonalRecord && (
        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 font-medium">
          Record!
        </span>
      )}
    </button>
  );
}
