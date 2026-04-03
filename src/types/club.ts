export type ClubType =
  | 'driver'
  | '3wood'
  | '5wood'
  | '3hybrid'
  | '4hybrid'
  | '5hybrid'
  | '3iron'
  | '4iron'
  | '5iron'
  | '6iron'
  | '7iron'
  | '8iron'
  | '9iron'
  | 'pw'
  | 'gw'
  | 'sw'
  | 'lw'
  | 'putter';

export interface ClubInfo {
  type: ClubType;
  label: string;
  shortLabel: string;
  typicalDistanceM: number; // metros
  category: 'madera' | 'hibrido' | 'hierro' | 'wedge' | 'putter';
}

export const CLUBS: ClubInfo[] = [
  { type: 'driver', label: 'Driver', shortLabel: 'D', typicalDistanceM: 220, category: 'madera' },
  { type: '3wood', label: 'Madera 3', shortLabel: '3W', typicalDistanceM: 200, category: 'madera' },
  { type: '5wood', label: 'Madera 5', shortLabel: '5W', typicalDistanceM: 185, category: 'madera' },
  { type: '3hybrid', label: 'Hibrido 3', shortLabel: '3H', typicalDistanceM: 180, category: 'hibrido' },
  { type: '4hybrid', label: 'Hibrido 4', shortLabel: '4H', typicalDistanceM: 170, category: 'hibrido' },
  { type: '5hybrid', label: 'Hibrido 5', shortLabel: '5H', typicalDistanceM: 160, category: 'hibrido' },
  { type: '3iron', label: 'Hierro 3', shortLabel: '3i', typicalDistanceM: 170, category: 'hierro' },
  { type: '4iron', label: 'Hierro 4', shortLabel: '4i', typicalDistanceM: 160, category: 'hierro' },
  { type: '5iron', label: 'Hierro 5', shortLabel: '5i', typicalDistanceM: 150, category: 'hierro' },
  { type: '6iron', label: 'Hierro 6', shortLabel: '6i', typicalDistanceM: 140, category: 'hierro' },
  { type: '7iron', label: 'Hierro 7', shortLabel: '7i', typicalDistanceM: 130, category: 'hierro' },
  { type: '8iron', label: 'Hierro 8', shortLabel: '8i', typicalDistanceM: 120, category: 'hierro' },
  { type: '9iron', label: 'Hierro 9', shortLabel: '9i', typicalDistanceM: 110, category: 'hierro' },
  { type: 'pw', label: 'Pitching Wedge', shortLabel: 'PW', typicalDistanceM: 100, category: 'wedge' },
  { type: 'gw', label: 'Gap Wedge', shortLabel: 'GW', typicalDistanceM: 90, category: 'wedge' },
  { type: 'sw', label: 'Sand Wedge', shortLabel: 'SW', typicalDistanceM: 80, category: 'wedge' },
  { type: 'lw', label: 'Lob Wedge', shortLabel: 'LW', typicalDistanceM: 60, category: 'wedge' },
  { type: 'putter', label: 'Putter', shortLabel: 'PT', typicalDistanceM: 10, category: 'putter' },
];

export function getClubInfo(type: ClubType): ClubInfo {
  return CLUBS.find((c) => c.type === type)!;
}
