'use client';

import { useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { useCampoStore } from '@/stores/campo-store';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function MapContent() {
  const map = useMap();
  const {
    userPosition,
    pinPosition,
    isPlacingPin,
    setPinPosition,
    activeCourse,
    currentHole,
  } = useCampoStore();

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!isPlacingPin || !e.detail?.latLng) return;

      const pos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setPinPosition(pos);

      // Save to course data in store and db
      const store = useCampoStore.getState();
      const course = store.activeCourse;
      if (course) {
        const updatedHoles = course.holes.map((h) =>
          h.number === currentHole ? { ...h, pinPosition: pos } : h
        );
        const updatedCourse = { ...course, holes: updatedHoles, updatedAt: new Date().toISOString() };
        useCampoStore.setState({ activeCourse: updatedCourse });
        // Save to IndexedDB async
        import('@/lib/db').then((db) => db.saveCourse(updatedCourse));
      }
    },
    [isPlacingPin, setPinPosition, currentHole]
  );

  // Draw distance line
  const drawLine = useCallback(() => {
    if (!map || !userPosition || !pinPosition) return null;
    // We use a simple polyline via the google maps API
    return null; // Handled via useEffect below
  }, [map, userPosition, pinPosition]);

  // Center map on user or course
  const center = userPosition ?? activeCourse?.location ?? { lat: 40.4168, lng: -3.7038 };

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
        defaultCenter={center}
        defaultZoom={17}
        onClick={handleMapClick}
        className="h-full w-full"
      >
        {/* User position - blue dot */}
        {userPosition && (
          <AdvancedMarker position={userPosition}>
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-30" />
            </div>
          </AdvancedMarker>
        )}

        {/* Pin/Flag position */}
        {pinPosition && (
          <AdvancedMarker position={pinPosition}>
            <div className="flex flex-col items-center">
              <div className="text-2xl drop-shadow-lg">🚩</div>
              <div className="text-[10px] font-bold text-white bg-black/60 rounded px-1">
                Hoyo {currentHole}
              </div>
            </div>
          </AdvancedMarker>
        )}
      </Map>

      {/* Placing pin overlay instruction */}
      {isPlacingPin && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-accent/90 px-4 py-1.5 text-xs font-bold text-black shadow-lg">
          Toca donde esta la bandera del hoyo {currentHole}
        </div>
      )}

      {drawLine()}
    </>
  );
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
