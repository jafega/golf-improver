'use client';

import { useState, useEffect, useRef } from 'react';
import { useCampoStore } from '@/stores/campo-store';
import { CourseData, createEmptyCourse } from '@/types/course';
import * as db from '@/lib/db';

interface CourseSearchModalProps {
  onSelect: (course: CourseData) => void;
  onClose: () => void;
}

interface PlaceResult {
  name: string;
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

export default function CourseSearchModal({ onSelect, onClose }: CourseSearchModalProps) {
  const userPosition = useCampoStore((s) => s.userPosition);
  const [savedCourses, setSavedCourses] = useState<CourseData[]>([]);
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showManual, setShowManual] = useState(false);
  const searchedRef = useRef(false);

  // Load saved courses once
  useEffect(() => {
    db.getAllCourses().then(setSavedCourses);
  }, []);

  // Search nearby ONCE when position is available
  useEffect(() => {
    if (!userPosition || searchedRef.current) return;
    searchedRef.current = true;

    async function searchNearby() {
      setSearching(true);
      try {
        if (!window.google?.maps?.places) {
          // Google Maps not loaded yet, wait a bit
          await new Promise((r) => setTimeout(r, 2000));
          if (!window.google?.maps?.places) {
            setSearching(false);
            setSearchDone(true);
            return;
          }
        }

        const service = new window.google.maps.places.PlacesService(
          document.createElement('div')
        );

        service.nearbySearch(
          {
            location: new window.google.maps.LatLng(userPosition!.lat, userPosition!.lng),
            radius: 10000,
            type: 'golf_course' as unknown as string,
          },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const mapped: PlaceResult[] = results
                .filter((r) => r.geometry?.location)
                .map((r) => ({
                  name: r.name ?? 'Campo de golf',
                  placeId: r.place_id ?? '',
                  address: r.vicinity ?? '',
                  lat: r.geometry!.location!.lat(),
                  lng: r.geometry!.location!.lng(),
                }))
                .slice(0, 10);
              setNearbyResults(mapped);
            }
            setSearching(false);
            setSearchDone(true);
          }
        );
      } catch {
        setSearching(false);
        setSearchDone(true);
      }
    }

    searchNearby();
  }, [userPosition]);

  const handleSelectPlace = async (place: PlaceResult) => {
    const existing = place.placeId
      ? await db.getCourseByPlaceId(place.placeId)
      : undefined;

    if (existing) {
      onSelect(existing);
    } else {
      const course = createEmptyCourse(
        place.name,
        { lat: place.lat, lng: place.lng },
        place.placeId,
        place.address
      );
      await db.saveCourse(course);
      onSelect(course);
    }
  };

  const handleCreateManual = async () => {
    if (!manualName.trim() || !userPosition) return;
    const course = createEmptyCourse(manualName.trim(), userPosition);
    await db.saveCourse(course);
    onSelect(course);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#111] px-4 py-3">
        <h2 className="text-lg font-bold">Seleccionar campo</h2>
        <button onClick={onClose} className="text-zinc-500 text-sm">
          Cerrar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {/* Saved courses */}
        {savedCourses.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Campos guardados</h3>
            <div className="space-y-2">
              {savedCourses.map((course) => {
                const pinsSet = course.holes.filter((h) => h.pinPosition).length;
                return (
                  <button
                    key={course.id}
                    onClick={() => onSelect(course)}
                    className="w-full rounded-xl bg-white/5 p-3 text-left active:bg-white/10"
                  >
                    <div className="font-medium">{course.name}</div>
                    <div className="text-xs text-zinc-500">
                      {pinsSet}/18 banderas colocadas
                      {course.address && ` · ${course.address}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Nearby search */}
        <section>
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Campos cercanos</h3>
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-zinc-500 ml-2">Buscando campos cercanos...</span>
            </div>
          ) : nearbyResults.length > 0 ? (
            <div className="space-y-2">
              {nearbyResults.map((place) => (
                <button
                  key={place.placeId || place.name}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full rounded-xl bg-white/5 p-3 text-left active:bg-white/10"
                >
                  <div className="font-medium">{place.name}</div>
                  <div className="text-xs text-zinc-500">{place.address}</div>
                </button>
              ))}
            </div>
          ) : searchDone ? (
            <p className="text-zinc-600 text-sm text-center py-4">
              No se encontraron campos cercanos
            </p>
          ) : (
            <p className="text-zinc-600 text-sm text-center py-4">
              Esperando ubicacion GPS...
            </p>
          )}
        </section>

        {/* Manual entry */}
        <section>
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Crear manualmente</h3>
          {showManual ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nombre del campo"
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={handleCreateManual}
                disabled={!manualName.trim() || !userPosition}
                className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-40"
              >
                Crear
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowManual(true)}
              className="w-full rounded-xl bg-white/5 p-3 text-sm text-zinc-400 active:bg-white/10"
            >
              + Anadir campo manualmente
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
