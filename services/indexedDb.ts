// Simple Wrapper for IndexedDB to store audio chunks safely
const DB_NAME = 'SmartDocAudioDB';
const STORE_NAME = 'chunks';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveChunk = async (chunk: Blob) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add({ data: chunk, timestamp: Date.now() });
};

export const getStoredAudio = async (): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result;
      if (results.length === 0) {
        resolve(null);
        return;
      }
      // Sort by auto-increment key implicitly, but ensuring content
      const chunks = results.map((item: any) => item.data);
      const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' }); // Standard web audio
      resolve(blob);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearStoredAudio = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();
};
