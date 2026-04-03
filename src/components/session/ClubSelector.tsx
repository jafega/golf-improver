'use client';

import { CLUBS, ClubType } from '@/types/club';
import { useSessionStore } from '@/stores/session-store';
import { useRef, useEffect } from 'react';

export default function ClubSelector() {
  const selectedClub = useSessionStore((s) => s.selectedClub);
  const setSelectedClub = useSessionStore((s) => s.setSelectedClub);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selectedClub]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-hide"
      style={{ scrollbarWidth: 'none' }}
    >
      {CLUBS.map((club) => {
        const isSelected = selectedClub === club.type;
        return (
          <button
            key={club.type}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => setSelectedClub(club.type as ClubType)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isSelected
                ? 'bg-accent text-black shadow-lg shadow-accent/20'
                : 'bg-white/10 text-zinc-300 active:bg-white/20'
            }`}
          >
            {club.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
