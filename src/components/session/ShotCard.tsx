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
  const straightness = shot.analysis?.status === 'complete' ? shot.analysis.straightness : null;

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

      {/* 3 Key Metrics */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">Tiro #{shot.shotNumber}</span>
          {shot.isPersonalRecord && (
            <span className="text-yellow-400 text-xs">🏆</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Club */}
          <div className="flex items-center gap-1">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-zinc-300">
              {club.shortLabel}
            </span>
          </div>
          {/* Straightness */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Dir:</span>
            {straightness != null ? (
              <span className={`text-xs font-semibold ${
                straightness >= 80 ? 'text-accent' :
                straightness >= 50 ? 'text-warning' : 'text-danger'
              }`}>
                {Math.round(straightness)}%
              </span>
            ) : (
              <span className="text-xs text-zinc-600">--</span>
            )}
          </div>
          {/* Distance */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Dist:</span>
            {distance != null ? (
              <span className="text-xs font-semibold text-accent">
                {Math.round(distance)}m
              </span>
            ) : (
              <span className="text-xs text-zinc-600">--</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
