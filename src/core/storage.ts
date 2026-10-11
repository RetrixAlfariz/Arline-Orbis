import { decodeProject } from './project';
import type { Project } from './project';

export interface Snapshot { project: Project; at: string; label: string }
export interface StoredWorkspace { project: Project; history: Snapshot[]; backups?: Snapshot[]; revision: number }
const DATABASE = 'orbis-workspace';
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Orbis tabs to upgrade local storage.'));
  });
}
export async function loadWorkspace(): Promise<StoredWorkspace | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('workspace').objectStore('workspace').get('current');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      try {
        const saved = request.result as StoredWorkspace | undefined;
        if (!saved) { resolve(null); return; }
        if (!Number.isSafeInteger(saved.revision) || saved.revision < 1 || !Array.isArray(saved.history) || saved.history.length > 30) throw new Error('Invalid local recovery data.');
        resolve({ project: decodeProject(saved.project), revision: saved.revision,
          history: saved.history.map((s) => ({ ...s, project: decodeProject(s.project) })),
          backups: (saved.backups ?? []).slice(-30).map((s) => ({ ...s, project: decodeProject(s.project) })) });
      } catch (error) { reject(error); }
    };
  });
}
export async function saveWorkspace(project: Project, history: Snapshot[], expectedRevision: number, backups: Snapshot[] = []): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('workspace', 'readwrite');
    const store = transaction.objectStore('workspace');
    const request = store.get('current');
    let conflict = false;
    request.onsuccess = () => {
      if (request.result && (!Number.isSafeInteger(request.result.revision) || request.result.revision < 1)) { conflict = true; transaction.abort(); return; }
      if ((request.result?.revision ?? 0) !== expectedRevision) { conflict = true; transaction.abort(); return; }
      store.put({ project, history: history.slice(-30), backups: backups.slice(-30), revision: expectedRevision + 1 }, 'current');
    };
    transaction.oncomplete = () => resolve(expectedRevision + 1);
    transaction.onabort = () => reject(new Error(conflict ? 'Another tab saved this world. Export your changes, then reload to avoid overwriting them.' : 'Local save failed. Export a backup before closing.'));
    transaction.onerror = () => reject(transaction.error);
  });
}
