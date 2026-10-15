import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentItem } from '../../types';

const DB_NAME = 'voice_pro_db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('type', 'type');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllDocuments(): Promise<DocumentItem[]> {
  try {
    const db = await getDb();
    const items = await db.getAllFromIndex(STORE_NAME, 'updatedAt');
    return items.reverse(); // Newest first
  } catch (error) {
    console.error('Failed to get documents from IndexedDB:', error);
    return [];
  }
}

export async function getDocument(id: string): Promise<DocumentItem | undefined> {
  try {
    const db = await getDb();
    return await db.get(STORE_NAME, id);
  } catch (error) {
    console.error(`Failed to get document ${id}:`, error);
    return undefined;
  }
}

export async function saveDocument(doc: DocumentItem): Promise<boolean> {
  try {
    const db = await getDb();
    const itemToSave = {
      ...doc,
      updatedAt: Date.now()
    };
    await db.put(STORE_NAME, itemToSave);
    return true;
  } catch (error) {
    console.error('Failed to save document:', error);
    return false;
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
    return true;
  } catch (error) {
    console.error(`Failed to delete document ${id}:`, error);
    return false;
  }
}

export async function searchDocuments(query: string): Promise<DocumentItem[]> {
  const all = await getAllDocuments();
  if (!query.trim()) return all;
  const q = query.toLowerCase().trim();
  return all.filter(
    (doc) =>
      doc.title.toLowerCase().includes(q) ||
      doc.content.toLowerCase().includes(q)
  );
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    } catch (e) {
      console.warn('Storage estimate error:', e);
    }
  }
  return { usage: 0, quota: 0 };
}

export async function clearAllDocuments(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
    return true;
  } catch (error) {
    console.error('Failed to clear documents:', error);
    return false;
  }
}
