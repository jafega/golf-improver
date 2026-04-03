import { create } from 'zustand';
import { ClubType } from '@/types/club';
import { Session, Shot, SessionState } from '@/types/session';

interface SessionStore {
  // Session
  currentSession: Session | null;
  sessionState: SessionState;
  shots: Shot[];

  // Club
  selectedClub: ClubType;

  // Recording
  isRecording: boolean;
  recordingStartTime: number | null;
  lastShot: Shot | null;

  // Actions
  startSession: (session: Session) => void;
  endSession: () => void;
  setSessionState: (state: SessionState) => void;
  setSelectedClub: (club: ClubType) => void;
  addShot: (shot: Shot) => void;
  updateShot: (shot: Shot) => void;
  setRecording: (recording: boolean) => void;
  setLastShot: (shot: Shot | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentSession: null,
  sessionState: 'idle',
  shots: [],
  selectedClub: '7iron',
  isRecording: false,
  recordingStartTime: null,
  lastShot: null,

  startSession: (session) =>
    set({ currentSession: session, sessionState: 'ready', shots: [] }),

  endSession: () =>
    set({ sessionState: 'idle', isRecording: false, recordingStartTime: null }),

  setSessionState: (state) => set({ sessionState: state }),

  setSelectedClub: (club) => set({ selectedClub: club }),

  addShot: (shot) =>
    set((s) => ({
      shots: [...s.shots, shot],
      lastShot: shot,
      currentSession: s.currentSession
        ? {
            ...s.currentSession,
            totalShots: s.currentSession.totalShots + 1,
          }
        : null,
    })),

  updateShot: (shot) =>
    set((s) => ({
      shots: s.shots.map((sh) => (sh.id === shot.id ? shot : sh)),
      lastShot: s.lastShot?.id === shot.id ? shot : s.lastShot,
    })),

  setRecording: (recording) =>
    set({
      isRecording: recording,
      recordingStartTime: recording ? Date.now() : null,
      sessionState: recording ? 'recording' : 'post-shot',
    }),

  setLastShot: (shot) => set({ lastShot: shot }),

  reset: () =>
    set({
      currentSession: null,
      sessionState: 'idle',
      shots: [],
      isRecording: false,
      recordingStartTime: null,
      lastShot: null,
    }),
}));
