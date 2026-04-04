'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCampoStore } from '@/stores/campo-store';

function speakText(text: string) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 1.0;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const esVoice = voices.find((v) => v.lang.startsWith('es'));
  if (esVoice) utterance.voice = esVoice;
  window.speechSynthesis.speak(utterance);
}

export default function DistancePanel() {
  const {
    distanceToPin,
    recommendedClub,
    pinPosition,
    gpsError,
    gpsAccuracy,
    activeCourse,
    currentHole,
  } = useCampoStore();

  const holeData = activeCourse?.holes.find((h) => h.number === currentHole);
  const par = holeData?.par ?? 4;

  const [strategy, setStrategy] = useState<string | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Reset on hole change
  useEffect(() => {
    setStrategy(null);
    setShowStrategy(false);
    window.speechSynthesis?.cancel();
  }, [currentHole]);

  const askStrategy = useCallback(async () => {
    if (!distanceToPin || !recommendedClub) return;
    setLoadingStrategy(true);
    setShowStrategy(true);
    setStrategy(null);

    try {
      const response = await fetch('/api/analyze-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: [],
          club: recommendedClub.label,
          shotNumber: 0,
          strategyRequest: {
            distanceToPin: Math.round(distanceToPin),
            par,
            hole: currentHole,
            courseName: activeCourse?.name ?? 'campo desconocido',
            recommendedClub: recommendedClub.label,
          },
        }),
      });

      const data = await response.json();
      if (data.strategy) {
        setStrategy(data.strategy);
        speakText(data.strategy);
      } else if (data.error) {
        setStrategy(`Error: ${data.error}`);
      } else {
        setStrategy('No se pudo generar estrategia.');
      }
    } catch {
      setStrategy('Sin conexion. Intentalo de nuevo.');
    }
    setLoadingStrategy(false);
  }, [distanceToPin, recommendedClub, par, currentHole, activeCourse?.name]);

  if (gpsError) {
    return (
      <div className="bg-[#111] border-t border-white/10 px-4 py-3">
        <p className="text-danger text-sm text-center">{gpsError}</p>
      </div>
    );
  }

  return (
    <>
      {/* === FLOATING STRATEGY OVERLAY === */}
      {showStrategy && (
        <div className="fixed inset-x-3 top-16 z-[60] rounded-2xl bg-black/90 backdrop-blur-sm p-4 shadow-2xl animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <span className="text-accent font-bold text-sm">Caddie IA</span>
            </div>
            <button
              onClick={() => { setShowStrategy(false); window.speechSynthesis?.cancel(); }}
              className="text-zinc-500 text-xs px-2 py-1 rounded-lg bg-white/10 active:bg-white/20"
            >
              Cerrar
            </button>
          </div>

          {loadingStrategy ? (
            <div className="flex items-center gap-3 py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-zinc-400">Pensando la mejor estrategia...</span>
            </div>
          ) : strategy ? (
            <div>
              <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line mb-3">
                {strategy}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => speakText(strategy)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg active:bg-white/20"
                  aria-label="Escuchar estrategia"
                >
                  🔊
                </button>
                <button
                  onClick={askStrategy}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-black active:bg-accent/80"
                >
                  Otra estrategia
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* === FIXED BOTTOM PANEL (always visible) === */}
      <div className="bg-[#111] border-t border-white/10 px-4 py-3">
        {pinPosition && distanceToPin != null ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-white">
                {Math.round(distanceToPin)}m
              </div>
              <div className="text-[10px] text-zinc-500">
                Hoyo {currentHole} · Par {par}
                {gpsAccuracy != null && ` · ±${Math.round(gpsAccuracy)}m`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {recommendedClub && (
                <div className="text-right">
                  <div className="text-xl font-bold text-accent">
                    {recommendedClub.shortLabel}
                  </div>
                  <div className="text-[10px] text-zinc-400">{recommendedClub.label}</div>
                </div>
              )}
              <button
                onClick={askStrategy}
                disabled={loadingStrategy}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xl shadow-lg transition-all active:scale-90 disabled:opacity-50"
                aria-label="Pedir estrategia IA"
              >
                {loadingStrategy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <span>🧠</span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-xs text-center">
            Hoyo {currentHole} · Par {par} · Toca el mapa o arrastra 🚩
          </p>
        )}
      </div>
    </>
  );
}
