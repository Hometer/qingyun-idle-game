import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  createGame,
  craftEquipment,
  equipItem,
  fightNode,
  importSave,
  lockAffix,
  reforgeEquipment,
  reforgeCost,
  unlockAffix,
} from "./engine";
import type { SaveState } from "./types";

const T0 = Date.parse("2026-01-01T00:00:00Z");

function fresh(realm: SaveState["realm"] = "qi1"): SaveState {
  const s = createGame("测试", "金", "balanced", T0);
  s.realm = realm;
  s.forge = 1;
  s.resources.spiritStone = 10_000_000;
  s.resources.iron = 100_000;
  s.resources.herb = 100_000;
  s.resources.page = 100_000;
  return s;
}

function firstInstanceOf(s: SaveState, baseId: string): string {
  const id = Object.keys(s.itemInstances).find((k) => s.itemInstances[k].baseId === baseId);
  if (!id) throw new Error(`无 ${baseId} 实例`);
  return id;
}

function setAffix(s: SaveState, instId: string, id: string, value: number): void {
  s.itemInstances[instId].affixes = [{ id, value }];
}

describe("v1.6 装备词条", () => {
  it("同名装备独立实例，重铸一件不改另一件", () => {
    let s = fresh("zhuji1");
    const r1 = craftEquipment(s, T0, "w_steel");
    expect(r1.ok).toBe(true);
    s = r1.state as SaveState;
    const r2 = craftEquipment(s, T0, "w_steel");
    expect(r2.ok).toBe(true);
    s = r2.state as SaveState;

    const ids = Object.keys(s.itemInstances).filter((k) => s.itemInstances[k].baseId === "w_steel");
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    const aff1 = s.itemInstances[ids[0]].affixes;
    const aff2 = s.itemInstances[ids[1]].affixes;

    const rr = reforgeEquipment(s, T0, ids[0]);
    expect(rr.ok).toBe(true);
    s = rr.state as SaveState;
    expect(s.itemInstances[ids[0]].affixes.length).toBeGreaterThanOrEqual(1);
    expect(s.itemInstances[ids[0]].affixes).not.toEqual(aff1); // 重铸后词条变化
    expect(s.itemInstances[ids[1]].affixes).toEqual(aff2); // 另一件不变
  });

  it("坏词条实例档拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    (bad as Record<string, unknown>).itemInstances = { "w_bronze#1": { baseId: "w_bronze", affixes: 42 } };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("坏锁定关系档拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    (bad as Record<string, unknown>).lockedAffixes = { "w_bronze#1": "critRate" };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("词条条数按境界限额（1/2/8/16 境）", () => {
    // 炼气（stage 1）首通掉落应只有 1 条
    let s = fresh("qi1");
    const f = fightNode(s, T0, "map_qingyun", "node_wolf");
    expect(f.won).toBe(true);
    s = f.state as SaveState;
    const cloth = firstInstanceOf(s, "a_cloth");
    expect(s.itemInstances[cloth].affixes).toHaveLength(1);

    // 筑基（stage 2）炼钢剑最多 2 条
    s = fresh("zhuji1");
    let r = craftEquipment(s, T0, "w_steel");
    s = r.state as SaveState;
    const steel = firstInstanceOf(s, "w_steel");
    expect(s.itemInstances[steel].affixes.length).toBeGreaterThanOrEqual(1);
    expect(s.itemInstances[steel].affixes.length).toBeLessThanOrEqual(2);

    // 大乘（stage 8）最多 3 条
    s = fresh("dacheng2");
    r = craftEquipment(s, T0, "w_dacheng");
    s = r.state as SaveState;
    expect(s.itemInstances[firstInstanceOf(s, "w_dacheng")].affixes.length).toBeLessThanOrEqual(3);

    // 混元大罗（stage 16）最多 4 条
    s = fresh("hunyuan_daluo2");
    r = craftEquipment(s, T0, "w_hunyuan");
    s = r.state as SaveState;
    expect(s.itemInstances[firstInstanceOf(s, "w_hunyuan")].affixes.length).toBeLessThanOrEqual(4);
  });

  it("重铸保留锁定词条，锁定后费用提高", () => {
    let s = fresh("zhuji1");
    const r = craftEquipment(s, T0, "w_steel");
    s = r.state as SaveState;
    const inst = firstInstanceOf(s, "w_steel");
    // 锁定第一条
    const lockId = s.itemInstances[inst].affixes[0].id;
    const lk = lockAffix(s, T0, inst, lockId);
    expect(lk.ok).toBe(true);
    s = lk.state as SaveState;
    expect(s.lockedAffixes[inst]).toBe(lockId);

    const costLocked = reforgeCost(s, inst);
    expect(costLocked.spiritStone).toBe(Math.round(CONFIG.reforge.baseCost.spiritStone * CONFIG.reforge.lockedCostMult));

    const rr = reforgeEquipment(s, T0, inst);
    expect(rr.ok).toBe(true);
    s = rr.state as SaveState;
    // 锁定词条保留
    expect(s.itemInstances[inst].affixes.some((a) => a.id === lockId)).toBe(true);

    const ul = unlockAffix(s, T0, inst);
    expect(ul.ok).toBe(true);
    s = ul.state as SaveState;
    expect(reforgeCost(s, inst).spiritStone).toBe(CONFIG.reforge.baseCost.spiritStone);
  });

  it("战斗所得修为计入每日重复奖励额度", () => {
    let s = fresh("zhuji1");
    const r = craftEquipment(s, T0, "w_steel");
    expect(r.ok).toBe(true);
    s = r.state as SaveState;
    const steel = firstInstanceOf(s, "w_steel");
    setAffix(s, steel, "battleCultivation", 50);
    const eq = equipItem(s, T0, steel);
    expect(eq.ok).toBe(true);
    s = eq.state as SaveState;

    // 首通 node_wolf
    const f0 = fightNode(s, T0, "map_qingyun", "node_wolf");
    expect(f0.won).toBe(true);
    s = f0.state as SaveState;

    // 打满每日 3 次重复后，再打一场不再得战斗修为
    s.daily.rewardedRepeats = CONFIG.rewardedRepeatBattlesPerDay;
    const before = s.resources.cultivation;
    const f = fightNode(s, T0, "map_qingyun", "node_wolf");
    s = f.state as SaveState;
    expect(s.resources.cultivation).toBe(before); // 已领尽，不再得战斗修为
  });
});
