import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Session, Shot, ShotAnalysis, DistanceEstimate } from '@/types/session';
import { PersonalRecord } from '@/types/records';

interface GolfImproverDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-date': string };
  };
  shots: {
    key: string;
    value: Shot;
    indexes: {
      'by-session': string;
      'by-club': string;
      'by-date': string;
    };
  };
  records: {
    key: string;
    value: PersonalRecord;
    indexes: { 'by-club': string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<GolfImproverDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<GolfImproverDB>('golf-improver', 1, {
      upgrade(db) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('by-date', 'startedAt');

        const shotStore = db.createObjectStore('shots', { keyPath: 'id' });
        shotStore.createIndex('by-session', 'sessionId');
        shotStore.createIndex('by-club', 'club');
        shotStore.createIndex('by-date', 'recordedAt');

        const recordStore = db.createObjectStore('records', { keyPath: 'id' });
        recordStore.createIndex('by-club', 'club');

        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// Sessions
export async function createSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function updateSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get('sessions', id);
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex('sessions', 'by-date');
  return sessions.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'shots'], 'readwrite');
  const shotIndex = tx.objectStore('shots').index('by-session');
  const shots = await shotIndex.getAllKeys(id);
  for (const shotId of shots) {
    await tx.objectStore('shots').delete(shotId);
  }
  await tx.objectStore('sessions').delete(id);
  await tx.done;
}

// Shots
export async function createShot(shot: Shot): Promise<void> {
  const db = await getDB();
  await db.put('shots', shot);
}

export async function updateShot(shot: Shot): Promise<void> {
  const db = await getDB();
  await db.put('shots', shot);
}

export async function getShot(id: string): Promise<Shot | undefined> {
  const db = await getDB();
  return db.get('shots', id);
}

export async function getSessionShots(sessionId: string): Promise<Shot[]> {
  const db = await getDB();
  return db.getAllFromIndex('shots', 'by-session', sessionId);
}

export async function getShotsByClub(club: string): Promise<Shot[]> {
  const db = await getDB();
  return db.getAllFromIndex('shots', 'by-club', club);
}

export async function getAllShots(): Promise<Shot[]> {
  const db = await getDB();
  return db.getAllFromIndex('shots', 'by-date');
}

export async function updateShotAnalysis(
  shotId: string,
  analysis: ShotAnalysis
): Promise<void> {
  const db = await getDB();
  const shot = await db.get('shots', shotId);
  if (shot) {
    shot.analysis = analysis;
    await db.put('shots', shot);
  }
}

export async function updateShotDistance(
  shotId: string,
  distance: DistanceEstimate
): Promise<void> {
  const db = await getDB();
  const shot = await db.get('shots', shotId);
  if (shot) {
    shot.distance = distance;
    await db.put('shots', shot);
  }
}

// Records
export async function getRecords(): Promise<PersonalRecord[]> {
  const db = await getDB();
  return db.getAll('records');
}

export async function getRecordsByClub(club: string): Promise<PersonalRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('records', 'by-club', club);
}

export async function saveRecord(record: PersonalRecord): Promise<void> {
  const db = await getDB();
  await db.put('records', record);
}

// Settings
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const entry = await db.get('settings', key);
  return entry?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}
