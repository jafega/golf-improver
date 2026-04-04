'use client';

import { useCampoStore } from '@/stores/campo-store';
import { addHoleToCourse } from '@/types/course';
import { useRef, useEffect } from 'react';
import * as db from '@/lib/db';

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
  const totalHoles = holes.length;

  const handleAddHole = async () => {
    if (!activeCourse) return;
    const updated = addHoleToCourse(activeCourse);
    useCampoStore.setState({ activeCourse: updated });
    await db.saveCourse(updated);
    setCurrentHole(updated.holes.length);
  };

  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-3 py-2"
      style={{ scrollbarWidth: 'none' }}
    >
      {holes.map((hole) => {
        const isSelected = currentHole === hole.number;
        const hasPin = !!hole.pinPosition;
        return (
          <button
            key={hole.number}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => setCurrentHole(hole.number)}
            className={`relative flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all ${
              isSelected
                ? 'bg-accent text-black shadow-lg shadow-accent/20'
                : 'bg-white/10 text-zinc-300 active:bg-white/20'
            }`}
          >
            {hole.number}
            {hasPin && !isSelected && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
      {/* Add hole button */}
      <button
        onClick={handleAddHole}
        className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-500 text-lg active:bg-white/10"
        aria-label="Anadir hoyo"
      >
        +
      </button>
      {/* Total indicator */}
      <div className="flex-shrink-0 flex items-center px-2 text-[10px] text-zinc-600">
        {totalHoles}h
      </div>
    </div>
  );
}
