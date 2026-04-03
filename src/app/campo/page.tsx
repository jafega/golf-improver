'use client';

import { useEffect, useRef, useState } from 'react';
import { useCampoStore } from '@/stores/campo-store';
import { watchPosition } from '@/lib/geolocation';
import { CourseData, createEmptyCourse } from '@/types/course';
import * as db from '@/lib/db';
import BottomNav from '@/components/ui/BottomNav';
import CourseMap from '@/components/campo/CourseMap';
import HoleSelector from '@/components/campo/HoleSelector';
import DistancePanel from '@/components/campo/DistancePanel';

export default function CampoPage() {
  const {
    activeCourse,
    setActiveCourse,
    setUserPosition,
    setGpsError,
    userPosition,
  } = useCampoStore();
  const autoDetectedRef = useRef(false);
  const [detecting, setDetecting] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState('Obteniendo ubicacion GPS...');

  // Start GPS
  useEffect(() => {
    const cleanup = watchPosition(
      (pos) => setUserPosition({ lat: pos.lat, lng: pos.lng }, pos.accuracy),
      (error) => {
        setGpsError(error);
        setDetecting(false);
        setDetectionStatus(error);
      }
    );
    return cleanup;
  }, [setUserPosition, setGpsError]);

  // Auto-detect course when GPS is ready
  useEffect(() => {
    if (!userPosition || autoDetectedRef.current || activeCourse) return;
    autoDetectedRef.current = true;

    async function autoDetect() {
      setDetectionStatus('Buscando campo de golf cercano...');

      // 1. Check saved courses first (within 2km)
      const saved = await db.getAllCourses();
      for (const course of saved) {
        const dist = haversineQuick(userPosition!, course.location);
        if (dist < 2000) {
          setActiveCourse(course);
          setDetecting(false);
          return;
        }
      }

      // 2. Search via Google Places
      try {
        await waitForGoogleMaps(5000);
        const results = await searchNearbyCourses(userPosition!.lat, userPosition!.lng);

        if (results.length > 0) {
          const best = results[0];
          // Check if already saved
          const existing = best.placeId
            ? await db.getCourseByPlaceId(best.placeId)
            : undefined;

          if (existing) {
            setActiveCourse(existing);
          } else {
            const course = createEmptyCourse(best.name, best.location, best.placeId, best.address);
            await db.saveCourse(course);
            setActiveCourse(course);
          }
          setDetecting(false);
          return;
        }
      } catch {
        // Places API failed, create generic
      }

      // 3. No course found - create a generic one at current location
      setDetectionStatus('No se encontro campo. Creando campo generico...');
      const generic = createEmptyCourse('Campo de Golf', userPosition!);
      await db.saveCourse(generic);
      setActiveCourse(generic);
      setDetecting(false);
    }

    autoDetect();
  }, [userPosition, activeCourse, setActiveCourse]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#111] border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">
              {activeCourse?.name ?? 'Detectando campo...'}
            </h1>
            {activeCourse?.address && (
              <p className="text-[10px] text-zinc-500 truncate">{activeCourse.address}</p>
            )}
          </div>
          {activeCourse && (
            <button
              onClick={() => {
                autoDetectedRef.current = false;
                useCampoStore.getState().reset();
                setDetecting(true);
                setDetectionStatus('Buscando campo de golf cercano...');
              }}
              className="flex-shrink-0 ml-2 text-zinc-500 text-xs"
            >
              Cambiar
            </button>
          )}
        </div>
        {activeCourse && <HoleSelector />}
      </header>

      {/* Main content */}
      {detecting && !activeCourse ? (
        <div className="flex flex-1 items-center justify-center bg-zinc-900">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-zinc-400">{detectionStatus}</p>
          </div>
        </div>
      ) : (
        <CourseMap />
      )}

      {/* Distance Panel */}
      {activeCourse && (
        <div className="flex-shrink-0">
          <DistancePanel />
        </div>
      )}

      <BottomNav />
    </div>
  );
}

// Quick Haversine (good enough for "is user near this course?")
function haversineQuick(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function waitForGoogleMaps(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.maps?.places) { clearInterval(interval); resolve(); }
      else if (Date.now() - start > timeoutMs) { clearInterval(interval); reject(new Error('timeout')); }
    }, 200);
  });
}

interface PlaceSearchResult {
  name: string;
  placeId: string;
  address: string;
  location: { lat: number; lng: number };
}

function searchNearbyCourses(lat: number, lng: number): Promise<PlaceSearchResult[]> {
  return new Promise((resolve) => {
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    service.nearbySearch(
      {
        location: new window.google.maps.LatLng(lat, lng),
        radius: 5000,
        type: 'golf_course' as unknown as string,
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(
            results
              .filter((r) => r.geometry?.location)
              .map((r) => ({
                name: r.name ?? 'Campo de golf',
                placeId: r.place_id ?? '',
                address: r.vicinity ?? '',
                location: { lat: r.geometry!.location!.lat(), lng: r.geometry!.location!.lng() },
              }))
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}
