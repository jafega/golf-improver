export interface GeoCoord {
  lat: number;
  lng: number;
}

export interface HoleData {
  number: number;           // 1-18
  par: number;              // 3, 4, or 5
  teePosition?: GeoCoord;
  pinPosition?: GeoCoord;   // flag position - user places on map
  distanceM?: number;       // official hole distance if known
}

export interface CourseData {
  id: string;
  name: string;
  placeId?: string;         // Google Places ID
  location: GeoCoord;       // center of the course
  address?: string;
  holes: HoleData[];        // 9 or 18 entries
  createdAt: string;
  updatedAt: string;
}

export interface RoundState {
  id: string;
  courseId: string;
  currentHole: number;
  startedAt: string;
  endedAt?: string;
}

export function createEmptyCourse(name: string, location: GeoCoord, placeId?: string, address?: string): CourseData {
  return {
    id: crypto.randomUUID(),
    name,
    placeId,
    location,
    address,
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
