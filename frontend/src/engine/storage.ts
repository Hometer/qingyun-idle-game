import type { SaveState } from "./types";

const DB_NAME = "qingyun_save";
const STORE = "save";
const KEY = "current";
const BACKUP_KEY = "backup";
const META_KEY = "meta";
const HIGH_WATER_KEY = "generationHighWater";

export interface LoadedSave { state: SaveState | null; generation: number }
export interface PersistResult { ok: boolean; conflict: boolean }

export class SaveMetadataError extends Error {
  constructor() { super("存档元数据损坏，请导出原档后修复元数据；角色和备份均已保留"); }
}

function generationOf(meta: unknown): number {
  // 不存在的记录兼容最早的存档；存在但损坏的记录不能伪装成代次 0。
  if (meta === undefined) return 0;
  const value = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as { generation?: unknown }).generation : undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) throw new SaveMetadataError();
  return value;
}

function nextGeneration(generation: number): number {
  if (!Number.isSafeInteger(generation + 1) || generation + 1 === Number.MAX_SAFE_INTEGER) throw new SaveMetadataError();
  return generation + 1;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("存档数据库被其他页面占用，请关闭旧页面后重试"));
  });
}

function get(store: IDBObjectStore, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await open();
  try {
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("存档读写失败"));
      tx.onabort = () => reject(tx.error ?? new Error("存档读写已中止"));
    });
    // 工作失败时也消费事务失败，避免未处理 Promise。
    void done.catch(() => {});
    try {
      const result = await work(tx.objectStore(STORE));
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  } finally { db.close(); }
}

async function readGeneration(store: IDBObjectStore): Promise<number> {
  const actual = generationOf(await get(store, META_KEY));
  const highWater = generationOf(await get(store, HIGH_WATER_KEY));
  if (actual < highWater) throw new SaveMetadataError();
  return actual;
}

export async function loadSave(): Promise<LoadedSave> {
  return transaction("readonly", async (store) => {
    const generation = await readGeneration(store);
    return { state: (await get(store, KEY) as SaveState | undefined) ?? null, generation };
  });
}

// 元数据坏时仍能独立导出角色原档。
export async function loadRawSave(): Promise<SaveState | null> {
  return transaction("readonly", async (store) => (await get(store, KEY) as SaveState | undefined) ?? null);
}

export async function persistSave(state: SaveState, baseRevision: number, generation: number): Promise<PersistResult> {
  return transaction("readwrite", async (store) => {
    const actual = await readGeneration(store);
    if (actual !== generation) return { ok: false, conflict: true };
    const cur = await get(store, KEY) as SaveState | undefined;
    const revision = cur && cur.schemaVersion < 18 && cur.revision === undefined ? 0 : cur?.revision;
    if (cur && revision !== baseRevision) return { ok: false, conflict: true };
    store.put(state, KEY);
    store.put({ generation: actual }, HIGH_WATER_KEY);
    return { ok: true, conflict: false };
  });
}

export async function replaceSave(state: SaveState, generation: number): Promise<PersistResult & { generation: number }> {
  return transaction("readwrite", async (store) => {
    const actual = await readGeneration(store);
    if (actual !== generation) return { ok: false, conflict: true, generation: actual };
    const next = nextGeneration(actual);
    store.put({ generation: next }, META_KEY);
    store.put({ generation: next }, HIGH_WATER_KEY);
    store.put(state, KEY);
    return { ok: true, conflict: false, generation: next };
  });
}

export async function backupSave(state: SaveState): Promise<void> {
  return transaction("readwrite", async (store) => { store.put(state, BACKUP_KEY); });
}

export async function loadBackup(): Promise<SaveState | null> {
  return transaction("readonly", async (store) => (await get(store, BACKUP_KEY) as SaveState | undefined) ?? null);
}

// 只修复元数据；独立高水位使修复在时钟回拨时也严格前进，角色及备份不改。
export async function repairSaveMetadata(): Promise<number> {
  return transaction("readwrite", async (store) => {
    const highWater = generationOf(await get(store, HIGH_WATER_KEY));
    try { return await readGeneration(store); } catch (error) {
      if (!(error instanceof SaveMetadataError)) throw error;
      const next = Math.max(highWater + 1, Date.now() * 1024);
      if (!Number.isSafeInteger(next) || next < 0 || next === Number.MAX_SAFE_INTEGER) throw new SaveMetadataError();
      store.put({ generation: next }, META_KEY);
      store.put({ generation: next }, HIGH_WATER_KEY);
      return next;
    }
  });
}

export async function clearSave(): Promise<number> {
  return transaction("readwrite", async (store) => {
    const next = nextGeneration(await readGeneration(store));
    store.put({ generation: next }, META_KEY);
    store.put({ generation: next }, HIGH_WATER_KEY);
    store.delete(KEY);
    return next;
  });
}
