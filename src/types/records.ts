import { ClubType } from './club';

export interface PersonalRecord {
  id: string;
  club: ClubType;
  metric: 'distance' | 'rating';
  value: number;
  shotId: string;
  sessionId: string;
  achievedAt: string;
}

export interface ClubStats {
  club: ClubType;
  totalShots: number;
  bestDistance: number | null;
  averageDistance: number | null;
  bestRating: number | null;
  averageRating: number | null;
  lastUsed: string | null;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}
