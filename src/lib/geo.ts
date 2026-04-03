import { GeoCoord } from '@/types/course';
import { CLUBS, ClubInfo } from '@/types/club';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance between two GPS coordinates in meters
 */
export function distanceMeters(a: GeoCoord, b: GeoCoord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Bearing from point A to point B in degrees (0-360)
 */
export function bearing(a: GeoCoord, b: GeoCoord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Recommend the best club for a given distance.
 * Picks the shortest club that still covers the distance.
 * Filters out putter for distances > 20m.
 */
export function recommendClub(distanceM: number): ClubInfo | null {
  if (distanceM <= 0) return null;

  const candidates = CLUBS.filter((c) => {
    if (distanceM > 20 && c.type === 'putter') return false;
    return true;
  });

  // Sort by typical distance ascending
  const sorted = [...candidates].sort((a, b) => a.typicalDistanceM - b.typicalDistanceM);

  // Find the shortest club that covers the distance
  for (const club of sorted) {
    if (club.typicalDistanceM >= distanceM * 0.9) {
      return club;
    }
  }

  // If nothing covers it, return the longest club (Driver)
  return sorted[sorted.length - 1] ?? null;
}
