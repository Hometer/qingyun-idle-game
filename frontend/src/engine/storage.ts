import type { SaveState } from "./types";

const DB_NAME = "qingyun_save";
const STORE = "save";
const KEY = "current";
const BACKUP_KEY = "backup";
const META_KEY = "meta";

interface Meta {
  generation: number;
}

export interface LoadedSave {
  state: SaveState | null;
  generation: number;
}

export interface PersistResult {
  ok: boolean;
  conflict: boolean;
}

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

// 读取存档与当前代次。代次持久化在 meta 记录中，用于“重置/导入后旧标签页不得复活旧档”。
export async function loadSave(): Promise<LoadedSave> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as Meta) ?? { generation: 0 };
      const curReq = store.get(KEY);
      curReq.onsuccess = () => resolve({ state: (curReq.result as SaveState) ?? null, generation: meta.generation });
      curReq.onerror = () => reject(curReq.error);
    };
    metaReq.onerror = () => reject(metaReq.error);
  });
}

// 乐观并发：仅在「当前代次仍等于操作所属代次」且「现存修订号等于操作基准修订号」时才写入。
// 代次不匹配说明存档已被重置或整体替换，旧标签页不得重建；修订号不匹配说明另一标签页已写入。
export async function persistSave(state: SaveState, baseRevision: number, generation: number): Promise<PersistResult> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as Meta) ?? { generation: 0 };
      if (meta.generation !== generation) {
        resolve({ ok: false, conflict: true });
        return;
      }
      const curReq = store.get(KEY);
      curReq.onsuccess = () => {
        const cur = curReq.result as SaveState | undefined;
        if (cur && cur.revision !== baseRevision) {
          resolve({ ok: false, conflict: true });
          return;
        }
        store.put(state, KEY);
      };
      curReq.onerror = () => reject(curReq.error);
    };
    metaReq.onerror = () => reject(metaReq.error);
    tx.oncomplete = () => resolve({ ok: true, conflict: false });
    tx.onerror = () => reject(tx.error);
  });
}

// 整体替换（导入/恢复等场景）：校验代次后写入，并递增代次使其他标签页失效。
export async function replaceSave(state: SaveState, generation: number): Promise<{ ok: boolean; conflict: boolean; generation: number }> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let result: { ok: boolean; conflict: boolean; generation: number } | null = null;
    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as Meta) ?? { generation: 0 };
      if (meta.generation !== generation) {
        result = { ok: false, conflict: true, generation: meta.generation };
        return;
      }
      const nextGen = meta.generation + 1;
      store.put({ generation: nextGen }, META_KEY);
      store.put(state, KEY);
      result = { ok: true, conflict: false, generation: nextGen };
    };
    metaReq.onerror = () => reject(metaReq.error);
    tx.oncomplete = () => resolve(result ?? { ok: false, conflict: true, generation });
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

// 清空存档：删除 current 并递增代次，返回新代次。旧标签页因代次不匹配无法把旧档写回。
export async function clearSave(): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let nextGen = 0;
    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as Meta) ?? { generation: 0 };
      nextGen = meta.generation + 1;
      store.put({ generation: nextGen }, META_KEY);
      store.delete(KEY);
    };
    metaReq.onerror = () => reject(metaReq.error);
    tx.oncomplete = () => resolve(nextGen);
    tx.onerror = () => reject(tx.error);
  });
}
