'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { useCampoStore } from '@/stores/campo-store';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function MapContent() {
  const map = useMap();
  const {
    userPosition,
    pinPosition,
    setPinPosition,
    activeCourse,
    currentHole,
    distanceToPin,
    recommendedClub,
    gpsAccuracy,
  } = useCampoStore();
  const hasCenteredRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);

  const holeData = activeCourse?.holes.find((h) => h.number === currentHole);
  const par = holeData?.par ?? 4;

  // Center map on user when first GPS arrives
  useEffect(() => {
    if (!map || !userPosition || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    map.panTo(userPosition);
    map.setZoom(18);
  }, [map, userPosition]);

  // Re-center when course changes
  useEffect(() => {
    if (!map || !activeCourse) return;
    const pos = useCampoStore.getState().userPosition;
    if (pos) {
      map.panTo(pos);
      map.setZoom(18);
    } else {
      map.panTo(activeCourse.location);
      map.setZoom(17);
    }
  }, [map, activeCourse?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit user + pin when hole changes
  useEffect(() => {
    if (!map) return;
    const pin = useCampoStore.getState().pinPosition;
    const user = useCampoStore.getState().userPosition;
    if (pin && user) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(user);
      bounds.extend(pin);
      map.fitBounds(bounds, 80);
    }
    // Reset strategy on hole change
    setStrategy(null);
    setShowStrategy(false);
  }, [map, currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-estimate pin for holes without one
  useEffect(() => {
    if (!activeCourse || !userPosition) return;
    const hd = activeCourse.holes.find((h) => h.number === currentHole);
    if (hd?.pinPosition) return;

    const courseLoc = activeCourse.location;
    const dLat = courseLoc.lat - userPosition.lat;
    const dLng = courseLoc.lng - userPosition.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 0.00001) return;

    const offsetDeg = 150 / 111000;
    const estimated = {
      lat: userPosition.lat + (dLat / dist) * offsetDeg,
      lng: userPosition.lng + (dLng / dist) * offsetDeg,
    };
    setPinPosition(estimated);
  }, [activeCourse?.id, currentHole, userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!e.detail?.latLng) return;
      const pos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setPinPosition(pos);
      savePinToCourse(pos, currentHole);
    },
    [setPinPosition, currentHole]
  );

  const handleFlagDragEnd = useCallback(
    (e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = e as any;
      const latLng = evt?.latLng ?? evt?.detail?.latLng;
      if (!latLng) { setDragging(false); return; }
      const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
      const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
      const pos = { lat, lng };
      setPinPosition(pos);
      savePinToCourse(pos, currentHole);
      setDragging(false);
    },
    [setPinPosition, currentHole]
  );

  // Ask AI strategy
  const askStrategy = async () => {
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

      if (response.ok) {
        const data = await response.json();
        setStrategy(data.strategy ?? 'No se pudo generar estrategia.');
      } else {
        setStrategy('Error al obtener estrategia. Intentalo de nuevo.');
      }
    } catch {
      setStrategy('Sin conexion. Intentalo de nuevo.');
    }
    setLoadingStrategy(false);
  };

  const defaultCenter = userPosition ?? activeCourse?.location ?? { lat: 40.4168, lng: -3.7038 };

  return (
    <>
      <Map
        mapId="golf-improver-map"
        mapTypeId="satellite"
        disableDefaultUI
        gestureHandling="greedy"
        minZoom={14}
        maxZoom={21}
        tilt={0}
        defaultCenter={defaultCenter}
        defaultZoom={18}
        onClick={handleMapClick}
        className="h-full w-full"
      >
        {/* User blue dot */}
        {userPosition && (
          <AdvancedMarker position={userPosition}>
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-30" />
            </div>
          </AdvancedMarker>
        )}

        {/* Draggable flag */}
        {pinPosition && (
          <AdvancedMarker
            position={pinPosition}
            draggable={true}
            onDragStart={() => setDragging(true)}
            onDragEnd={handleFlagDragEnd}
          >
            <div className={`flex flex-col items-center ${dragging ? 'scale-125' : ''} transition-transform`}>
              <div className="text-3xl drop-shadow-lg cursor-grab active:cursor-grabbing">🚩</div>
              <div className="text-[10px] font-bold text-white bg-black/70 rounded px-1.5 py-0.5 -mt-1">
                Hoyo {currentHole}
              </div>
            </div>
          </AdvancedMarker>
        )}
      </Map>

      {/* === STRATEGY BUTTON floating on map === */}
      {pinPosition && distanceToPin != null && !dragging && !showStrategy && (
        <button
          onClick={askStrategy}
          className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black shadow-lg transition-all active:scale-95"
        >
          <span className="text-lg">🧠</span>
          Estrategia IA
        </button>
      )}

      {/* === STRATEGY OVERLAY on map === */}
      {showStrategy && (
        <div className="absolute top-3 left-3 right-3 z-10 rounded-2xl bg-black/85 backdrop-blur-sm p-4 shadow-2xl">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <span className="text-accent font-bold text-sm">Caddie IA</span>
            </div>
            <button
              onClick={() => setShowStrategy(false)}
              className="text-zinc-500 text-xs px-2 py-1"
            >
              Cerrar
            </button>
          </div>

          {/* Distance + club summary */}
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl font-bold text-white">{Math.round(distanceToPin!)}m</div>
            {recommendedClub && (
              <div className="rounded-lg bg-accent/20 px-2.5 py-1">
                <span className="text-accent font-bold text-sm">{recommendedClub.shortLabel}</span>
                <span className="text-zinc-400 text-xs ml-1">{recommendedClub.label}</span>
              </div>
            )}
            <div className="text-xs text-zinc-500">
              H{currentHole} Par {par}
              {gpsAccuracy != null && ` · ±${Math.round(gpsAccuracy)}m`}
            </div>
          </div>

          {/* Strategy text */}
          {loadingStrategy ? (
            <div className="flex items-center gap-2 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-zinc-400">Analizando el hoyo...</span>
            </div>
          ) : strategy ? (
            <div className="text-sm text-zinc-200 leading-relaxed mb-3">
              {strategy}
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={askStrategy}
              disabled={loadingStrategy}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-black transition-colors active:bg-accent/80 disabled:opacity-50"
            >
              {strategy ? 'Otra estrategia' : 'Pedir estrategia'}
            </button>
            <button
              onClick={() => setShowStrategy(false)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-zinc-300 active:bg-white/20"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Drag hint */}
      {pinPosition && !dragging && !showStrategy && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/60 px-3 py-1 text-[10px] text-zinc-300">
          Arrastra 🚩 para mover · Toca para recolocar
        </div>
      )}
      {dragging && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-accent/90 px-4 py-1.5 text-xs font-bold text-black">
          Suelta para colocar la bandera
        </div>
      )}
    </>
  );
}

function savePinToCourse(pos: { lat: number; lng: number }, holeNumber: number) {
  const store = useCampoStore.getState();
  const course = store.activeCourse;
  if (!course) return;
  const updatedHoles = course.holes.map((h) =>
    h.number === holeNumber ? { ...h, pinPosition: pos } : h
  );
  const updatedCourse = { ...course, holes: updatedHoles, updatedAt: new Date().toISOString() };
  useCampoStore.setState({ activeCourse: updatedCourse });
  import('@/lib/db').then((db) => db.saveCourse(updatedCourse));
}

export default function CourseMap() {
  if (!API_KEY) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-900 p-6">
        <p className="text-zinc-500 text-sm text-center">
          Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-zinc-900">
      <APIProvider apiKey={API_KEY} libraries={['places']}>
        <MapContent />
      </APIProvider>
    </div>
  );
}
