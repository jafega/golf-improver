'use client';

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { useCampoStore } from '@/stores/campo-store';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface CourseMapHandle {
  captureScreenshot: () => Promise<string | null>;
}

function MapContent({ onMapReady }: { onMapReady: (map: google.maps.Map | null) => void }) {
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

  // Pass map reference up
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  // Center on user first time
  useEffect(() => {
    if (!map || !userPosition || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    map.panTo(userPosition);
    map.setZoom(18);
  }, [map, userPosition]);

  // Re-center on course change
  useEffect(() => {
    if (!map || !activeCourse) return;
    const pos = useCampoStore.getState().userPosition;
    if (pos) { map.panTo(pos); map.setZoom(18); }
    else { map.panTo(activeCourse.location); map.setZoom(17); }
  }, [map, activeCourse?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit user + pin on hole change
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

  // Auto-estimate pin
  useEffect(() => {
    if (!activeCourse || !userPosition) return;
    const hd = activeCourse.holes.find((h) => h.number === currentHole);
    if (hd?.pinPosition) return;
    const cl = activeCourse.location;
    const dLat = cl.lat - userPosition.lat;
    const dLng = cl.lng - userPosition.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 0.00001) return;
    const off = 150 / 111000;
    setPinPosition({ lat: userPosition.lat + (dLat / dist) * off, lng: userPosition.lng + (dLng / dist) * off });
  }, [activeCourse?.id, currentHole, userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!e.detail?.latLng) return;
    const pos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
    setPinPosition(pos);
    savePinToCourse(pos, currentHole);
  }, [setPinPosition, currentHole]);

  const handleFlagDragEnd = useCallback((e: unknown) => {
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
  }, [setPinPosition, currentHole]);

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
        {userPosition && (
          <AdvancedMarker position={userPosition}>
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-30" />
            </div>
          </AdvancedMarker>
        )}
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

      {/* Hints */}
      {pinPosition && !dragging && (
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

const CourseMap = forwardRef<CourseMapHandle>(function CourseMap(_, ref) {
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const handleMapReady = useCallback((map: google.maps.Map | null) => {
    mapInstanceRef.current = map;
  }, []);

  useImperativeHandle(ref, () => ({
    captureScreenshot: async () => {
      // Use the Google Maps Static API to get a satellite screenshot
      const state = useCampoStore.getState();
      const { userPosition, pinPosition, currentHole } = state;
      const center = pinPosition ?? userPosition;
      if (!center) return null;

      try {
        // Build Static Maps URL with markers
        const params = new URLSearchParams({
          center: `${center.lat},${center.lng}`,
          zoom: '18',
          size: '640x400',
          maptype: 'satellite',
          key: API_KEY,
        });

        if (userPosition) {
          params.append('markers', `color:blue|label:T|${userPosition.lat},${userPosition.lng}`);
        }
        if (pinPosition) {
          params.append('markers', `color:red|label:${currentHole}|${pinPosition.lat},${pinPosition.lng}`);
        }

        const url = `https://maps.googleapis.com/maps/api/staticmap?${params}`;
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    },
  }));

  if (!API_KEY) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-900 p-6">
        <p className="text-zinc-500 text-sm text-center">
          Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-zinc-900" style={{ zIndex: 0 }}>
      <APIProvider apiKey={API_KEY} libraries={['places']}>
        <MapContent onMapReady={handleMapReady} />
      </APIProvider>
    </div>
  );
});

export default CourseMap;
