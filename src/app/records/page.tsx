'use client';

import { useEffect, useState } from 'react';
import { CLUBS, ClubType } from '@/types/club';
import * as db from '@/lib/db';
import { Shot } from '@/types/session';
import BottomNav from '@/components/ui/BottomNav';

interface ClubStat {
  club: ClubType;
  label: string;
  shortLabel: string;
  totalShots: number;
  bestDistance: number | null;
  avgDistance: number | null;
  bestRating: number | null;
}

export default function RecordsPage() {
  const [clubStats, setClubStats] = useState<ClubStat[]>([]);
  const [totalShots, setTotalShots] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const allShots = await db.getAllShots();
      const allSessions = await db.getAllSessions();
      setTotalShots(allShots.length);
      setTotalSessions(allSessions.length);

      const stats: ClubStat[] = CLUBS.map((club) => {
        const clubShots = allShots.filter((s: Shot) => s.club === club.type);
        const distances = clubShots
          .filter((s: Shot) => s.distance?.estimated)
          .map((s: Shot) => s.distance!.estimated);
        const ratings = clubShots
          .filter((s: Shot) => s.analysis?.status === 'complete' && s.analysis.overallRating > 0)
          .map((s: Shot) => s.analysis!.overallRating);

        return {
          club: club.type,
          label: club.label,
          shortLabel: club.shortLabel,
          totalShots: clubShots.length,
          bestDistance: distances.length > 0 ? Math.max(...distances) : null,
          avgDistance:
            distances.length > 0
              ? distances.reduce((a: number, b: number) => a + b, 0) / distances.length
              : null,
          bestRating: ratings.length > 0 ? Math.max(...ratings) : null,
        };
      }).filter((s) => s.totalShots > 0);

      setClubStats(stats);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-1 flex-col pb-20">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#111] px-4 py-4">
        <h1 className="text-xl font-bold">Records Personales</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Global stats */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 rounded-xl bg-white/5 p-4 text-center">
                <div className="text-3xl font-bold">{totalSessions}</div>
                <div className="text-xs text-zinc-500">Sesiones</div>
              </div>
              <div className="flex-1 rounded-xl bg-white/5 p-4 text-center">
                <div className="text-3xl font-bold">{totalShots}</div>
                <div className="text-xs text-zinc-500">Tiros totales</div>
              </div>
            </div>

            {clubStats.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-2">🏆</div>
                <p>Aun no hay records</p>
                <p className="text-sm mt-1">Completa una sesion para empezar a registrar records</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clubStats.map((stat) => (
                  <div key={stat.club} className="rounded-xl bg-white/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-sm font-medium text-accent">
                          {stat.shortLabel}
                        </span>
                        <span className="text-sm font-medium">{stat.label}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{stat.totalShots} tiros</span>
                    </div>
                    <div className="flex gap-6">
                      {stat.bestDistance != null && (
                        <div>
                          <div className="text-lg font-bold text-accent">
                            {Math.round(stat.bestDistance)}m
                          </div>
                          <div className="text-xs text-zinc-500">Mejor</div>
                        </div>
                      )}
                      {stat.avgDistance != null && (
                        <div>
                          <div className="text-lg font-medium">
                            {Math.round(stat.avgDistance)}m
                          </div>
                          <div className="text-xs text-zinc-500">Media</div>
                        </div>
                      )}
                      {stat.bestRating != null && (
                        <div>
                          <div className="text-lg font-medium">
                            {stat.bestRating}/10
                          </div>
                          <div className="text-xs text-zinc-500">Rating</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
