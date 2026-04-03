// OPFS (Origin Private File System) for video storage
// Falls back to IndexedDB blob storage if OPFS is not available

let opfsRoot: FileSystemDirectoryHandle | null = null;

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (opfsRoot) return opfsRoot;
  try {
    opfsRoot = await navigator.storage.getDirectory();
    // Create videos subdirectory
    await opfsRoot.getDirectoryHandle('videos', { create: true });
    return opfsRoot;
  } catch {
    console.warn('OPFS not available, falling back to IndexedDB');
    return null;
  }
}

async function getVideosDir(): Promise<FileSystemDirectoryHandle | null> {
  const root = await getOPFSRoot();
  if (!root) return null;
  return root.getDirectoryHandle('videos', { create: true });
}

// IndexedDB fallback for video blobs
function openFallbackDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('golf-improver-videos', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('blobs');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideo(key: string, blob: Blob): Promise<void> {
  const videosDir = await getVideosDir();
  if (videosDir) {
    const fileHandle = await videosDir.getFileHandle(key, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    // IndexedDB fallback
    const db = await openFallbackDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function loadVideo(key: string): Promise<Blob | null> {
  const videosDir = await getVideosDir();
  if (videosDir) {
    try {
      const fileHandle = await videosDir.getFileHandle(key);
      const file = await fileHandle.getFile();
      return file;
    } catch {
      return null;
    }
  } else {
    const db = await openFallbackDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly');
      const request = tx.objectStore('blobs').get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
}

export async function deleteVideo(key: string): Promise<void> {
  const videosDir = await getVideosDir();
  if (videosDir) {
    try {
      await videosDir.removeEntry(key);
    } catch {
      // File might not exist
    }
  } else {
    const db = await openFallbackDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function getStorageEstimate(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    return {
      used,
      quota,
      percentage: quota > 0 ? (used / quota) * 100 : 0,
    };
  }
  return { used: 0, quota: 0, percentage: 0 };
}
