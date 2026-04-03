import { ClubType } from './club';

export interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
  location?: string;
  totalShots: number;
  averageDistance: number | null;
  bestDistance: number | null;
  notes?: string;
}

export interface Shot {
  id: string;
  sessionId: string;
  shotNumber: number;
  club: ClubType;
  videoStorageKey: string;
  thumbnailDataUrl?: string;
  recordedAt: string;
  duration: number;
  analysis?: ShotAnalysis;
  distance?: DistanceEstimate;
  isPersonalRecord: boolean;
}

export interface ShotAnalysis {
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  swingTips: string[];
  overallRating: number;
  straightness: number; // 0-100: 100 = perfectly straight, 0 = completely off-line
  keyObservations: string[];
  comparisonToLast?: string;
  trajectoryPoints?: { x: number; y: number; frame: number }[];
  rawResponse?: string;
  error?: string;
}

export interface DistanceEstimate {
  estimated: number;
  confidence: 'baja' | 'media' | 'alta';
  method: 'ai_vision' | 'physics' | 'manual' | 'calibrated';
  manualOverride?: number;
}

export type SessionState = 'idle' | 'ready' | 'recording' | 'post-shot';
