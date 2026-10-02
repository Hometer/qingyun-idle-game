import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import * as engine from "./engine";
import * as storage from "./storage";
import { CONFIG } from "./config";
import type { SaveState } from "./types";
import { commissionTarget } from "../lib/commission-target";

const T = new Date(2026, 9, 1, 10).getTime();
const DAY = 86400000;
const fresh = () => engine.createGame("修复回归", "金", "balanced", T);
const json = (s: unknown) => engine.importSave(JSON.stringify(s));

async function put(key: string, value: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("qingyun_save", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("save");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("save", "readwrite");
    tx.objectStore("save").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function strong() {
  const s = fresh(); s.realm = "zhuji1";
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  return engine.fightNode(s, T, "map_qingyun", "node_wolf").state;
}

describe("全量复查缺陷回归", () => {
  it("2094 个字段/子字段异常不会接受后启动崩溃，读档入口不修改原对象", () => {
    const paths = Object.keys(fresh()).map((k) => [k]);
    for (const [key, value] of Object.entries(fresh())) if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const sub of Object.keys(value)) paths.push([key, sub]);
    }
    let count = 0;
    for (const path of paths) for (const value of [undefined, null, {}, [], "invalid", -1]) {
      const s = fresh() as unknown as Record<string, unknown>;
      const parent = path.length === 1 ? s : s[path[0]] as Record<string, unknown>;
      if (value === undefined) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = value;
      const original = structuredClone(s);
      const result = engine.readSave(s, T + 1000);
      expect(s).toEqual(original);
      if (result.ok) {
        expect(() => engine.playerStats(result.state!)).not.toThrow();
        expect(() => engine.recordDailySettle(result.state!, T + 1000)).not.toThrow();
        expect(json(result.state!).ok).toBe(true);
      }
      count++;
    }
    expect(count).toBe(2094);
  });

  it.each(["buildings", "equipment", "suppression", "encounter"])("当前档缺少 %s 拒绝，合法旧档补齐保留资源", (key) => {
    const s = fresh() as unknown as Record<string, unknown>;
    delete s[key];
    expect(json(s).ok).toBe(false);
    s.schemaVersion = 1;
    const old = engine.readSave(s, T + 1000);
    expect(old.ok).toBe(true);
    expect(old.state?.name).toBe("修复回归");
  });

  it("未知天气/星象拒绝，未来版本和不安全修订号拒绝", () => {
    for (const field of ["weather", "astrology"] as const) for (const id of ["unknown", "toString", "__proto__"]) { const s = fresh(); s.daily[field].id = id; expect(json(s).ok).toBe(false); }
    const s = fresh(); s.revision = Number.MAX_SAFE_INTEGER + 1; expect(json(s).ok).toBe(false);
  });

  it.each([NaN, -1, 1.5, "bad", undefined, Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])("坏代次 %s 在所有写入口拒绝，修复保留角色/备份并使旧页失效", async (value) => {
    globalThis.indexedDB = new IDBFactory();
    const s = fresh();
    await storage.persistSave(s, 0, 0); await storage.backupSave(s); await put("meta", { generation: value });
    await expect(storage.loadSave()).rejects.toBeInstanceOf(storage.SaveMetadataError);
    await expect(storage.persistSave(s, 0, 0)).rejects.toBeInstanceOf(storage.SaveMetadataError);
    await expect(storage.replaceSave(s, 0)).rejects.toBeInstanceOf(storage.SaveMetadataError);
    await expect(storage.clearSave()).rejects.toBeInstanceOf(storage.SaveMetadataError);
    expect(await storage.loadRawSave()).toEqual(s);
    const gen = await storage.repairSaveMetadata();
    expect(Number.isSafeInteger(gen)).toBe(true); expect(gen).toBeGreaterThan(0);
    expect(await storage.loadBackup()).toEqual(s); expect((await storage.loadSave()).state).toEqual(s);
    expect((await storage.persistSave(s, 0, 0)).conflict).toBe(true);
    expect((await storage.persistSave(engine.settle(s, T + 1000), 0, gen)).ok).toBe(true);
  });

  it("修复代次在时钟回拨时严格前进；丢失 meta 不会回到代次 0", async () => {
    globalThis.indexedDB = new IDBFactory(); const s = fresh();
    await storage.persistSave(s, 0, 0); await put("meta", { generation: NaN });
    const first = await storage.repairSaveMetadata();
    await put("meta", {});
    const clock = vi.spyOn(Date, "now").mockReturnValue(T - DAY);
    try {
      const second = await storage.repairSaveMetadata();
      expect(second).toBeGreaterThan(first);
      expect((await storage.persistSave(s, 0, first)).conflict).toBe(true);
      await put("meta", { generation: 0 });
      await expect(storage.loadSave()).rejects.toBeInstanceOf(storage.SaveMetadataError);
      expect((await storage.loadRawSave())?.id).toBe(s.id);
    } finally { clock.mockRestore(); }
  });

  it("代次耗尽时拒绝替换和清档，不能提交下一次无法读取的代次", async () => {
    globalThis.indexedDB = new IDBFactory(); const s = fresh();
    await storage.persistSave(s, 0, 0);
    const generation = Number.MAX_SAFE_INTEGER - 1;
    await put("meta", { generation });
    await expect(storage.replaceSave(s, generation)).rejects.toBeInstanceOf(storage.SaveMetadataError);
    await expect(storage.clearSave()).rejects.toBeInstanceOf(storage.SaveMetadataError);
    expect(await storage.loadSave()).toEqual({ state: s, generation });
  });

  it("未接取的未来候选在回拨日期不可接，恢复日期首通后仍只能交付一件", () => {
    let s = engine.settle(strong(), T + DAY);
    const future = s.commission.candidates[0];
    expect(s.commission.acceptedDate).toBeNull();
    expect(engine.acceptCommission(s, T, future.id).ok).toBe(false);
    const back = engine.refreshCommissionCandidates(s, T);
    expect(back.commission.candidates.map(c => c.id)).toEqual(s.commission.candidates.map(c => c.id));
    s = engine.acceptCommission(s, T + DAY, future.id).state!;
    s = engine.fightNode(s, T + DAY, future.mapId!, future.nodeId!, "challenge").state;
    s = engine.claimCommission(s, T + DAY, "a").state!;
    s = engine.fightNode(s, T + DAY, "map_qingyun", "node_side_1").state;
    expect(s.commission.candidates).toEqual([]);
    expect(s.commission.history).toHaveLength(1);
    expect(engine.claimCommission(s, T + DAY, "b").ok).toBe(false);
    expect(engine.acceptCommission(s, T, future.id).ok).toBe(false);
  });

  it("合法跨日任务与历史导回，回拨也不能重复领奖", () => {
    let s = engine.settle(strong(), T + DAY); const c = s.commission.candidates[0];
    s = engine.acceptCommission(s, T + DAY, c.id).state!;
    s = engine.settle(s, T + 2 * DAY); expect(json(s).ok).toBe(true);
    s = engine.fightNode(s, T + 2 * DAY, c.mapId!, c.nodeId!, "challenge").state;
    s = engine.claimCommission(s, T + 2 * DAY, "a").state!;
    expect(json(s).ok).toBe(true); expect(engine.claimCommission(s, T, "b").ok).toBe(false);
  });

  it("候选/历史/active 矛盾、动作参数和日期拒绝，领奖再验进度和奖励选项", () => {
    const mutations = [
      (s: SaveState) => { s.commission.acceptedDate = "invalid"; },
      (s: SaveState) => { delete (s.commission as unknown as Record<string, unknown>).acceptedDate; },
      (s: SaveState) => { s.commission.candidates[0].status = "ready"; s.commission.candidates[0].progress = 1; },
      (s: SaveState) => { s.commission.history = [s.commission.candidates[0]]; s.commission.candidates = []; },
      (s: SaveState) => { s.commission.candidates[0].action = "upgradeBuilding"; s.commission.candidates[0].actionParam = "unknown"; },
      (s: SaveState) => { s.commission.candidates.push(structuredClone(s.commission.candidates[0])); },
    ];
    for (const mutate of mutations) { const s = fresh(); mutate(s); expect(json(s).ok).toBe(false); }
    const s = fresh(); s.commission.active = { ...s.commission.candidates[0], status: "ready", progress: 0 };
    expect(engine.claimCommission(s, T, "a").ok).toBe(false);
    s.commission.active.progress = 1;
    expect(engine.claimCommission(s, T, "invalid" as "a").ok).toBe(false);
  });

  it("合法暴击边界不依赖随机生成或接取；早中晚期有两件确定可接的目标", () => {
    const s = fresh(); s.realm = "yuanying1";
    s.itemInstances = { "w_bronze#1": { baseId: "w_bronze", affixes: [{ id: "critRate", value: .1 }] } };
    s.inventory = { "w_bronze#1": 1 }; s.equipment.weapon = "w_bronze#1";
    s.maps.map_jindan.node_danjie = { unlocked: true, cleared: true };
    s.daily.astrology = { id: "none", used: false };
    const rng = vi.spyOn(Math, "random");
    try {
      rng.mockReturnValue(0); const allCrit = engine.settle(s, T + DAY).commission.candidates;
      rng.mockReturnValue(.999); const noCrit = engine.settle(s, T + DAY).commission.candidates;
      expect(allCrit).toEqual(noCrit);
      expect(noCrit.some(c => c.nodeId === "node_danjie")).toBe(false);
      for (const realm of ["zhuji1", "yuanying1", "hongmeng10"] as const) {
        const st = strong(); st.realm = realm;
        const ready = engine.settle(st, T + DAY);
        expect(ready.commission.candidates).toHaveLength(2);
        for (const candidate of ready.commission.candidates) expect(engine.acceptCommission(ready, T + DAY, candidate.id).ok).toBe(true);
      }
    } finally { rng.mockRestore(); }
  });

  it("配置枚举拒绝原型名称，际遇和委托不会接受后崩溃", () => {
    for (const key of ["toString", "__proto__", "constructor"]) {
      const s = fresh(); s.encounter.pending = { eventId: key, mapId: "map_qingyun" };
      expect(json(s).ok).toBe(false);
      for (const action of ["craftEquipment", "upgradeBuilding"]) {
        const c = fresh(); c.commission.candidates[0].action = action; c.commission.candidates[0].actionParam = key;
        expect(json(c).ok).toBe(false);
      }
    }
  });

  it("每个可生成制作目标有准确入口，战斗含地图/节点/难度", () => {
    const c = strong().commission.candidates.find(c => c.kind === "battle")!;
    const href = commissionTarget(c).href;
    expect(href).toContain(`map=${c.mapId}`); expect(href).toContain(`node=${c.nodeId}`); expect(href).toContain("difficulty=challenge");
    for (const id of Object.keys(CONFIG.crafts)) expect(commissionTarget({ ...fresh().commission.candidates[0], action: "craftEquipment", actionParam: id }).href).toContain(`commission-craft-${id}`);
  });
});
