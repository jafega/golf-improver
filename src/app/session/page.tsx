'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useSessionStore } from '@/stores/session-store';
import { stopSpeaking } from '@/lib/speech';
import { createRecorder, getVideoExtension } from '@/lib/camera';
import { saveVideo } from '@/lib/storage';
import { generateThumbnail } from '@/lib/video-processing';
import * as db from '@/lib/db';
import { Shot, Session } from '@/types/session';
import CameraViewfinder from '@/components/session/CameraViewfinder';
import ClubSelector from '@/components/session/ClubSelector';
import RecordButton from '@/components/session/RecordButton';
import ShotCard from '@/components/session/ShotCard';
import ShotResultScreen from '@/components/session/ShotResultScreen';

export default function SessionPage() {
  const {
    currentSession,
    sessionState,
    shots,
    selectedClub,
    isRecording,
    lastShot,
    startSession,
    setSessionState,
    addShot,
    updateShot,
    setRecording,
    setLastShot,
    endSession,
  } = useSessionStore();

  const router = useRouter();
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [showShotList, setShowShotList] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const sessionSavedRef = useRef(false);

  // Auto-start session in memory (NOT in DB yet - only saved on first shot)
  useEffect(() => {
    if (!currentSession) {
      sessionSavedRef.current = false;
      const session: Session = {
        id: uuidv4(),
        startedAt: new Date().toISOString(),
        totalShots: 0,
        averageDistance: null,
        bestDistance: null,
      };
      startSession(session);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStreamReady = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
  }, []);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      // Stop recording
      recorderRef.current?.stop();
    } else {
      // Start recording
      if (!streamRef.current || !currentSession) return;

      const shotId = uuidv4();
      const videoKey = `${shotId}.${getVideoExtension()}`;

      const recorder = createRecorder(
        streamRef.current,
        async (blob) => {
          // Save video
          await saveVideo(videoKey, blob);

          // Generate thumbnail
          let thumbnail: string | undefined;
          try {
            thumbnail = await generateThumbnail(blob);
          } catch {
            // Thumbnail generation failed, that's ok
          }

          // Create shot record
          const shot: Shot = {
            id: shotId,
            sessionId: currentSession.id,
            shotNumber: shots.length + 1,
            club: selectedClub,
            videoStorageKey: videoKey,
            thumbnailDataUrl: thumbnail,
            recordedAt: new Date().toISOString(),
            duration: blob.size > 0 ? 0 : 0, // Will be updated
            analysis: { status: 'pending', swingTips: [], overallRating: 0, straightness: 0, keyObservations: [] },
            isPersonalRecord: false,
          };

          // Save session to DB on first shot only
          if (!sessionSavedRef.current) {
            sessionSavedRef.current = true;
            await db.createSession(currentSession);
          }

          addShot(shot);
          await db.createShot(shot);

          // Trigger AI analysis in background
          analyzeShot(shot);
        },
        () => {
          // Recording stopped
        }
      );

      recorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      setRecording(true);

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, [isRecording, currentSession, selectedClub, shots.length, addShot, setRecording]);

  const handleStopRecording = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setRecording(false);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }
  }, [isRecording, setRecording]);

  const analyzeShot = async (shot: Shot) => {
    try {
      const updatedShot = {
        ...shot,
        analysis: { ...shot.analysis!, status: 'analyzing' as const },
      };
      updateShot(updatedShot);
      await db.updateShot(updatedShot);

      const response = await fetch('/api/analyze-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoKey: shot.videoStorageKey,
          club: shot.club,
          shotNumber: shot.shotNumber,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const analysis = await response.json();
      const analyzedShot: Shot = {
        ...updatedShot,
        analysis: {
          status: 'complete',
          swingTips: analysis.swingTips ?? [],
          overallRating: analysis.overallRating ?? 0,
          straightness: analysis.straightness ?? 50,
          keyObservations: analysis.keyObservations ?? [],
          comparisonToLast: analysis.comparisonToLast,
        },
        distance: analysis.distance
          ? {
              estimated: analysis.distance.estimated,
              confidence: analysis.distance.confidence,
              method: 'ai_vision',
            }
          : undefined,
      };

      updateShot(analyzedShot);
      await db.updateShot(analyzedShot);
    } catch (err) {
      console.error('Analysis error:', err);
      const errorShot = {
        ...shot,
        analysis: {
          status: 'error' as const,
          swingTips: [],
          overallRating: 0,
          straightness: 0,
          keyObservations: [],
          error: 'Error al analizar el tiro',
        },
      };
      updateShot(errorShot);
      await db.updateShot(errorShot);
    }
  };

  const handleNextShot = () => {
    setLastShot(null);
    setSessionState('ready');
  };

  const handleEndSession = async () => {
    stopSpeaking();
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
    }
    // Only update session in DB if it was saved (i.e., had at least 1 shot)
    if (currentSession && sessionSavedRef.current && shots.length > 0) {
      const shotsWithDist = shots.filter((s) => s.distance?.estimated);
      const avg = shotsWithDist.length > 0
        ? shotsWithDist.reduce((sum, s) => sum + (s.distance!.estimated ?? 0), 0) / shotsWithDist.length
        : null;
      const best = shotsWithDist.length > 0
        ? Math.max(...shotsWithDist.map((s) => s.distance!.estimated))
        : null;
      const updated: Session = {
        ...currentSession,
        endedAt: new Date().toISOString(),
        totalShots: shots.length,
        averageDistance: avg,
        bestDistance: best,
      };
      await db.updateSession(updated);
    }
    endSession();
    useSessionStore.getState().reset();
    router.push('/');
  };

  // Calculate stats
  const shotsWithDistance = shots.filter((s) => s.distance?.estimated);
  const avgDistance =
    shotsWithDistance.length > 0
      ? shotsWithDistance.reduce((sum, s) => sum + (s.distance!.estimated ?? 0), 0) /
        shotsWithDistance.length
      : null;
  const lastDistance = shots.length > 0 ? shots[shots.length - 1]?.distance?.estimated : null;

  return (
    <div className="relative flex h-full flex-col">
      {/* Club Selector + Exit Button */}
      <div className="flex-shrink-0 flex items-center bg-[#111] border-b border-white/5">
        <div className="flex-1 overflow-hidden">
          <ClubSelector />
        </div>
        <button
          onClick={() => setShowExitConfirm(true)}
          disabled={isRecording}
          className="flex-shrink-0 px-3 py-2 mr-1 text-danger text-sm font-medium disabled:opacity-30"
        >
          Salir
        </button>
      </div>

      {/* Camera Viewfinder */}
      <CameraViewfinder
        onStreamReady={handleStreamReady}
        isRecording={isRecording}
      />

      {/* Stats Bar */}
      <div className="flex-shrink-0 flex items-center justify-around bg-[#111] px-4 py-2 text-xs border-t border-white/5">
        <span className="text-zinc-400">
          Tiro <span className="text-white font-medium">#{shots.length + 1}</span>
        </span>
        <span className="text-zinc-400">
          Ultimo:{' '}
          <span className="text-accent font-medium">
            {lastDistance != null ? `${Math.round(lastDistance)}m` : '--'}
          </span>
        </span>
        <span className="text-zinc-400">
          Media:{' '}
          <span className="text-white font-medium">
            {avgDistance != null ? `${Math.round(avgDistance)}m` : '--'}
          </span>
        </span>
        {shots.length > 0 && (
          <button
            onClick={() => setShowShotList(!showShotList)}
            className="text-accent"
          >
            Ver tiros
          </button>
        )}
      </div>

      {/* Record Button */}
      <div className="flex-shrink-0 flex justify-center py-4 bg-[#111]">
        <RecordButton
          isRecording={isRecording}
          onPress={isRecording ? handleStopRecording : handleRecord}
        />
      </div>

      {/* Shot List (expandable) */}
      {showShotList && shots.length > 0 && (
        <div className="absolute bottom-36 left-0 right-0 max-h-60 overflow-y-auto bg-[#111]/95 backdrop-blur-sm border-t border-white/10 p-2 shot-list">
          {[...shots].reverse().map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              onTap={() => {
                setLastShot(shot);
                setSessionState('post-shot');
                setShowShotList(false);
              }}
            />
          ))}
        </div>
      )}

      {/* Post-Shot Result Screen */}
      {sessionState === 'post-shot' && lastShot && (
        <ShotResultScreen shot={lastShot} onNextShot={handleNextShot} />
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 w-full max-w-sm rounded-2xl bg-[#1a1a1a] p-6">
            <h2 className="text-lg font-bold mb-2">Terminar sesion?</h2>
            <p className="text-sm text-zinc-400 mb-5">
              Has hecho {shots.length} tiro{shots.length !== 1 ? 's' : ''} en esta sesion.
              {shots.length > 0 ? ' Los datos se guardaran en el historial.' : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium transition-colors active:bg-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 rounded-xl bg-danger py-3 text-sm font-bold text-white transition-colors active:bg-danger/80"
              >
                Terminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
