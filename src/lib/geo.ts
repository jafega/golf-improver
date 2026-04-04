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

// Cached custom distances (loaded async from IndexedDB)
let customDistances: Record<string, number> | null = null;
let customDistancesLoaded = false;

export async function loadCustomDistances(): Promise<void> {
  if (customDistancesLoaded) return;
  try {
    const db = await import('@/lib/db');
    const saved = await db.getSetting<Record<string, number>>('customClubDistances');
    if (saved) customDistances = saved;
    customDistancesLoaded = true;
  } catch {
    // ignore
  }
}

function getClubDistance(club: ClubInfo): number {
  if (customDistances && customDistances[club.type] != null) {
    return customDistances[club.type];
  }
  return club.typicalDistanceM;
}

/**
 * Recommend the best club for a given distance.
 * Uses custom distances if configured, otherwise defaults.
 */
export function recommendClub(distanceM: number): ClubInfo | null {
  if (distanceM <= 0) return null;

  const candidates = CLUBS.filter((c) => {
    if (distanceM > 20 && c.type === 'putter') return false;
    return true;
  });

  // Sort by actual distance ascending (custom or default)
  const sorted = [...candidates].sort((a, b) => getClubDistance(a) - getClubDistance(b));

  // Find the shortest club that covers the distance
  for (const club of sorted) {
    if (getClubDistance(club) >= distanceM * 0.9) {
      return club;
    }
  }

  return sorted[sorted.length - 1] ?? null;
}

/**
 * Get the effective distance for a club (custom or default)
 */
export function getEffectiveDistance(club: ClubInfo): number {
  return getClubDistance(club);
}
