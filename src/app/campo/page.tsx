'use client';

import { useEffect, useRef, useState } from 'react';
import { useCampoStore } from '@/stores/campo-store';
import { watchPosition } from '@/lib/geolocation';
import { CourseData, createEmptyCourse } from '@/types/course';
import * as db from '@/lib/db';
import { loadCustomDistances } from '@/lib/geo';
import BottomNav from '@/components/ui/BottomNav';
import CourseMap, { CourseMapHandle } from '@/components/campo/CourseMap';
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
  const mapRef = useRef<CourseMapHandle>(null);
  const [detecting, setDetecting] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState('Obteniendo ubicacion GPS...');

  useEffect(() => {
    const cleanup = watchPosition(
      (pos) => setUserPosition({ lat: pos.lat, lng: pos.lng }, pos.accuracy),
      (error) => { setGpsError(error); setDetecting(false); }
    );
    return cleanup;
  }, [setUserPosition, setGpsError]);

  useEffect(() => { loadCustomDistances(); }, []);

  useEffect(() => {
    if (!userPosition || autoDetectedRef.current || activeCourse) return;
    autoDetectedRef.current = true;

    async function autoDetect() {
      setDetectionStatus('Buscando campo de golf cercano...');
      const saved = await db.getAllCourses();
      for (const course of saved) {
        if (haversineQuick(userPosition!, course.location) < 2000) {
          setActiveCourse(course); setDetecting(false); return;
        }
      }
      try {
        await waitForGoogleMaps(5000);
        const results = await searchNearbyCourses(userPosition!.lat, userPosition!.lng);
        if (results.length > 0) {
          const best = results[0];
          const existing = best.placeId ? await db.getCourseByPlaceId(best.placeId) : undefined;
          const course = existing ?? createEmptyCourse(best.name, best.location, best.placeId, best.address);
          if (!existing) await db.saveCourse(course);
          setActiveCourse(course); setDetecting(false); return;
        }
      } catch { /* */ }
      const generic = createEmptyCourse('Campo de Golf', userPosition!);
      await db.saveCourse(generic); setActiveCourse(generic); setDetecting(false);
    }
    autoDetect();
  }, [userPosition, activeCourse, setActiveCourse]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* LAYER 1: Map background (fills everything) */}
      <div className="absolute inset-0">
        {detecting && !activeCourse ? (
          <div className="flex h-full items-center justify-center bg-zinc-900">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-zinc-400">{detectionStatus}</p>
            </div>
          </div>
        ) : (
          <CourseMap ref={mapRef} />
        )}
      </div>

      {/* LAYER 2: Header (fixed top) */}
      <div className="fixed top-0 left-0 right-0" style={{ zIndex: 20 }}>
        <header className="bg-[#111] border-b border-white/10">
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
      </div>

      {/* LAYER 3: Distance panel (fixed above bottom nav) */}
      <div className="fixed left-0 right-0" style={{ zIndex: 20, bottom: '64px' }}>
        <DistancePanel />
      </div>

      {/* LAYER 4: Bottom Nav */}
      <BottomNav />
    </div>
  );
}

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

function searchNearbyCourses(lat: number, lng: number): Promise<{ name: string; placeId: string; address: string; location: { lat: number; lng: number } }[]> {
  return new Promise((resolve) => {
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    service.nearbySearch(
      { location: new window.google.maps.LatLng(lat, lng), radius: 5000, type: 'golf_course' as unknown as string },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results.filter((r) => r.geometry?.location).map((r) => ({
            name: r.name ?? 'Campo de golf', placeId: r.place_id ?? '',
            address: r.vicinity ?? '',
            location: { lat: r.geometry!.location!.lat(), lng: r.geometry!.location!.lng() },
          })));
        } else resolve([]);
      },
    );
  });
}
