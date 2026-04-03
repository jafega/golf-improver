'use client';

import { useCampoStore } from '@/stores/campo-store';
import { useRef, useEffect } from 'react';

export default function HoleSelector() {
  const { currentHole, setCurrentHole, activeCourse } = useCampoStore();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentHole]);

  const holes = activeCourse?.holes ?? [];

  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-3 py-2"
      style={{ scrollbarWidth: 'none' }}
    >
      {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => {
        const isSelected = currentHole === n;
        const holeData = holes.find((h) => h.number === n);
        const hasPin = !!holeData?.pinPosition;
        return (
          <button
            key={n}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => setCurrentHole(n)}
            className={`relative flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all ${
              isSelected
                ? 'bg-accent text-black shadow-lg shadow-accent/20'
                : 'bg-white/10 text-zinc-300 active:bg-white/20'
            }`}
          >
            {n}
            {hasPin && !isSelected && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
