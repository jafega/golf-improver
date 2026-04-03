'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  const hasCenteredRef = useRef(false);

  // Center map on user position when first available or when course changes
  useEffect(() => {
    if (!map) return;
    if (userPosition && !hasCenteredRef.current) {
      map.panTo(userPosition);
      map.setZoom(18);
      hasCenteredRef.current = true;
    }
  }, [map, userPosition]);

  // Re-center when active course changes
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

  // Center on pin when hole changes and has a pin
  useEffect(() => {
    if (!map || !pinPosition) return;
    // Fit both user and pin in view
    if (userPosition) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userPosition);
      bounds.extend(pinPosition);
      map.fitBounds(bounds, 60);
    } else {
      map.panTo(pinPosition);
    }
  }, [map, currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!isPlacingPin || !e.detail?.latLng) return;

      const pos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setPinPosition(pos);

      const store = useCampoStore.getState();
      const course = store.activeCourse;
      if (course) {
        const updatedHoles = course.holes.map((h) =>
          h.number === currentHole ? { ...h, pinPosition: pos } : h
        );
        const updatedCourse = { ...course, holes: updatedHoles, updatedAt: new Date().toISOString() };
        useCampoStore.setState({ activeCourse: updatedCourse });
        import('@/lib/db').then((db) => db.saveCourse(updatedCourse));
      }
    },
    [isPlacingPin, setPinPosition, currentHole]
  );

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
        {/* User position - blue pulsing dot */}
        {userPosition && (
          <AdvancedMarker position={userPosition}>
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-30" />
            </div>
          </AdvancedMarker>
        )}

        {/* Flag position */}
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

      {/* Placing pin instruction */}
      {isPlacingPin && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-accent/90 px-4 py-1.5 text-xs font-bold text-black shadow-lg">
          Toca donde esta la bandera del hoyo {currentHole}
        </div>
      )}
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
