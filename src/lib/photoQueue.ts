const DB_NAME = "dona-photos";
const DB_VERSION = 1;
const STORE_NAME = "pending";

interface PendingPhotoRecord {
  id: string;
  base64: string;
  createdAt: string;
}

function openPhotoDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putPendingPhoto(itemId: string, base64: string): Promise<void> {
  const db = await openPhotoDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id: itemId,
        base64,
        createdAt: new Date().toISOString(),
      } satisfies PendingPhotoRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function getPendingPhoto(itemId: string): Promise<string | null> {
  const db = await openPhotoDb();
  if (!db) return null;
  const result = await new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(itemId);
      req.onsuccess = () => {
        const rec = req.result as PendingPhotoRecord | undefined;
        resolve(rec?.base64 ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return result;
}

export async function removePendingPhoto(itemId: string): Promise<void> {
  const db = await openPhotoDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(itemId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function getAllPendingPhotoIds(): Promise<string[]> {
  const db = await openPhotoDb();
  if (!db) return [];
  const ids = await new Promise<string[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result.map(String) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
  db.close();
  return ids;
}

export async function clearAllPendingPhotos(): Promise<void> {
  const db = await openPhotoDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
