'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCampoStore } from '@/stores/campo-store';
import { watchPosition } from '@/lib/geolocation';
import { CourseData } from '@/types/course';
import BottomNav from '@/components/ui/BottomNav';
import CourseMap from '@/components/campo/CourseMap';
import HoleSelector from '@/components/campo/HoleSelector';
import DistancePanel from '@/components/campo/DistancePanel';
import CourseSearchModal from '@/components/campo/CourseSearchModal';

export default function CampoPage() {
  const {
    activeCourse,
    setActiveCourse,
    setUserPosition,
    setGpsError,
  } = useCampoStore();
  const [showCourseSearch, setShowCourseSearch] = useState(false);

  // Start GPS watching
  useEffect(() => {
    const cleanup = watchPosition(
      (pos) => setUserPosition({ lat: pos.lat, lng: pos.lng }, pos.accuracy),
      (error) => setGpsError(error)
    );
    return cleanup;
  }, [setUserPosition, setGpsError]);

  // Show course search if no active course
  useEffect(() => {
    if (!activeCourse) {
      setShowCourseSearch(true);
    }
  }, [activeCourse]);

  const handleSelectCourse = useCallback(
    (course: CourseData) => {
      setActiveCourse(course);
      setShowCourseSearch(false);
    },
    [setActiveCourse]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#111] border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">
              {activeCourse?.name ?? 'Campo de Golf'}
            </h1>
            {activeCourse?.address && (
              <p className="text-[10px] text-zinc-500 truncate">{activeCourse.address}</p>
            )}
          </div>
          <button
            onClick={() => setShowCourseSearch(true)}
            className="flex-shrink-0 ml-2 text-accent text-xs font-medium"
          >
            Cambiar
          </button>
        </div>
        <HoleSelector />
      </header>

      {/* Map */}
      <CourseMap />

      {/* Distance Panel */}
      <div className="flex-shrink-0">
        <DistancePanel />
      </div>

      {/* Course Search Modal */}
      {showCourseSearch && (
        <CourseSearchModal
          onSelect={handleSelectCourse}
          onClose={() => {
            if (activeCourse) setShowCourseSearch(false);
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
