import type { SaveState } from "./types";

const DB_NAME = "qingyun_save";
const STORE = "save";
const KEY = "current";
const BACKUP_KEY = "backup";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSave(): Promise<SaveState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(KEY);
    rq.onsuccess = () => resolve((rq.result as SaveState) ?? null);
    rq.onerror = () => reject(rq.error);
  });
}

// 修订号 compare-and-swap：仅当新值 revision 严格大于现存值才写入，防双标签页覆盖。
export async function persistSave(state: SaveState): Promise<{ ok: boolean; conflict: boolean }> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(KEY);
    getReq.onsuccess = () => {
      const cur = getReq.result as SaveState | undefined;
      if (cur && state.revision <= cur.revision) {
        resolve({ ok: false, conflict: true });
        return;
      }
      store.put(state, KEY);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve({ ok: true, conflict: false });
    tx.onerror = () => reject(tx.error);
  });
}

// 强制替换（导入/恢复等场景，不做修订号比较）。
export async function replaceSave(state: SaveState): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function backupSave(state: SaveState): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, BACKUP_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadBackup(): Promise<SaveState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(BACKUP_KEY);
    rq.onsuccess = () => resolve((rq.result as SaveState) ?? null);
    rq.onerror = () => reject(rq.error);
  });
}

export async function clearSave(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
