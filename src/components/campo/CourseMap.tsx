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
  } = useCampoStore();
  const hasCenteredRef = useRef(false);
  const [dragging, setDragging] = useState(false);

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

  // Fit user + pin when hole changes and has pin
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
  }, [map, currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-estimate pin position for holes without one:
  // Place it ~150m ahead of user in the direction of the course center
  useEffect(() => {
    if (!activeCourse || !userPosition) return;
    const holeData = activeCourse.holes.find((h) => h.number === currentHole);
    if (holeData?.pinPosition) return; // already has pin

    // Estimate: place pin ~150m from user toward course center
    const courseLoc = activeCourse.location;
    const dLat = courseLoc.lat - userPosition.lat;
    const dLng = courseLoc.lng - userPosition.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 0.00001) return;

    const offsetDeg = 150 / 111000; // ~150m in degrees
    const normLat = dLat / dist;
    const normLng = dLng / dist;

    const estimated = {
      lat: userPosition.lat + normLat * offsetDeg,
      lng: userPosition.lng + normLng * offsetDeg,
    };

    setPinPosition(estimated);
    // Don't save estimated pin to DB - only save when user drags/confirms
  }, [activeCourse?.id, currentHole, userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle map tap to place/move flag
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!e.detail?.latLng) return;
      const pos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setPinPosition(pos);
      savePinToCourse(pos, currentHole);
    },
    [setPinPosition, currentHole]
  );

  // Handle flag drag end
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

      {/* Drag hint */}
      {pinPosition && !dragging && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/60 px-3 py-1 text-[10px] text-zinc-300">
          Arrastra 🚩 para mover la bandera · Toca el mapa para recolocar
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
