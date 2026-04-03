import { create } from 'zustand';
import { GeoCoord, CourseData } from '@/types/course';
import { ClubInfo } from '@/types/club';
import { distanceMeters, recommendClub } from '@/lib/geo';

interface CampoStore {
  userPosition: GeoCoord | null;
  gpsAccuracy: number | null;
  gpsError: string | null;

  activeCourse: CourseData | null;
  currentHole: number;

  pinPosition: GeoCoord | null;
  distanceToPin: number | null;
  isPlacingPin: boolean;

  recommendedClub: ClubInfo | null;

  setUserPosition: (pos: GeoCoord, accuracy: number) => void;
  setGpsError: (error: string | null) => void;
  setActiveCourse: (course: CourseData | null) => void;
  setCurrentHole: (hole: number) => void;
  setPinPosition: (pos: GeoCoord | null) => void;
  setIsPlacingPin: (placing: boolean) => void;
  reset: () => void;
}

export const useCampoStore = create<CampoStore>((set, get) => ({
  userPosition: null,
  gpsAccuracy: null,
  gpsError: null,
  activeCourse: null,
  currentHole: 1,
  pinPosition: null,
  distanceToPin: null,
  isPlacingPin: false,
  recommendedClub: null,

  setUserPosition: (pos, accuracy) => {
    const { pinPosition } = get();
    let dist: number | null = null;
    let club: ClubInfo | null = null;
    if (pinPosition) {
      dist = distanceMeters(pos, pinPosition);
      club = recommendClub(dist);
    }
    set({
      userPosition: pos,
      gpsAccuracy: accuracy,
      gpsError: null,
      distanceToPin: dist,
      recommendedClub: club,
    });
  },

  setGpsError: (error) => set({ gpsError: error }),

  setActiveCourse: (course) => {
    if (course) {
      const hole = course.holes[0];
      set({
        activeCourse: course,
        currentHole: 1,
        pinPosition: hole?.pinPosition ?? null,
        distanceToPin: null,
        recommendedClub: null,
      });
    } else {
      set({
        activeCourse: null,
        currentHole: 1,
        pinPosition: null,
        distanceToPin: null,
        recommendedClub: null,
      });
    }
  },

  setCurrentHole: (hole) => {
    const { activeCourse, userPosition } = get();
    const holeData = activeCourse?.holes.find((h) => h.number === hole);
    const pin = holeData?.pinPosition ?? null;
    let dist: number | null = null;
    let club: ClubInfo | null = null;
    if (pin && userPosition) {
      dist = distanceMeters(userPosition, pin);
      club = recommendClub(dist);
    }
    set({
      currentHole: hole,
      pinPosition: pin,
      distanceToPin: dist,
      recommendedClub: club,
      isPlacingPin: false,
    });
  },

  setPinPosition: (pos) => {
    const { userPosition } = get();
    let dist: number | null = null;
    let club: ClubInfo | null = null;
    if (pos && userPosition) {
      dist = distanceMeters(userPosition, pos);
      club = recommendClub(dist);
    }
    set({
      pinPosition: pos,
      distanceToPin: dist,
      recommendedClub: club,
      isPlacingPin: false,
    });
  },

  setIsPlacingPin: (placing) => set({ isPlacingPin: placing }),

  reset: () =>
    set({
      activeCourse: null,
      currentHole: 1,
      pinPosition: null,
      distanceToPin: null,
      isPlacingPin: false,
      recommendedClub: null,
    }),
}));
