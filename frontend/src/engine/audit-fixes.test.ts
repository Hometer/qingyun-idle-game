import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createGame,
  settle,
  importSave,
  exportSave,
  craftGainPill,
  startLongTask,
  craftEquipment,
  lockAffix,
  reforgeEquipment,
  marrow,
  acceptCommission,
  claimCommission,
  fightNode,
  migrateSave,
  upgradeBuilding,
  upgradeTechnique,
  buildLibrary,
  setResonance,
  settleRoots,
} from "./engine";
import { CONFIG } from "./config";
import type { SaveState } from "./types";

const H = 3600_000;
const DAY = 24 * H;
const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  const s = createGame("林青", "金", "balanced", nowMs);
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  s.daily.goals = { battle: { progress: 0, claimed: false }, suppress: { progress: 0, claimed: false } };
  return s;
}

function rich(): SaveState {
  const s = fresh();
  for (const k of Object.keys(s.resources)) (s.resources as unknown as Record<string, number>)[k] = 1e8;
  s.encounter.guideDone = true;
  return s;
}

describe("全局审查回归（P1/P2 修复）", () => {
  it("P1-01 收益丹库存可导出导入（含零数量残留）", () => {
    const s = rich();
    s.realm = "zhuji1";
    s.buildings.alchemyFurnace = 1;
    const r = craftGainPill(s, T0, "yangYuan", 1);
    expect(r.ok).toBe(true);
    // 服用后残留 0 数量也应可导入
    const used = { ...r.state! } as unknown as Record<string, unknown>;
    (used.resources as Record<string, number>).nothing = 0;
    const exported = exportSave(r.state!);
    const imported = importSave(exported);
    expect(imported.ok).toBe(true);
  });

  it("P1-01 风共鸣闭关合法耗时可导出导入", () => {
    const s = rich();
    s.spiritRoots = ["风"];
    s.resonance = "风";
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "seclusion", durationMinutes: 30, protection: false });
    expect(r.ok).toBe(true);
    expect(r.state!.longTask!.effectiveMinutes).toBeLessThan(30);
    const imported = importSave(exportSave(r.state!));
    expect(imported.ok).toBe(true);
  });

  it("P1-01 封存词条反复重铸不超上限", () => {
    let s = rich();
    s.realm = "hunyuan_daluo2";
    s.forge = 1;
    const r = craftEquipment(s, T0, "w_hunyuan");
    expect(r.ok).toBe(true);
    s = r.state!;
    const id = Object.keys(s.itemInstances).find((k) => s.itemInstances[k].baseId === "w_hunyuan")!;
    const lock = lockAffix(s, T0, id, s.itemInstances[id].affixes[0].id);
    expect(lock.ok).toBe(true);
    s = lock.state!;
    for (let i = 0; i < 30; i++) {
      const rr = reforgeEquipment(s, T0, id);
      expect(rr.ok).toBe(true);
      s = rr.state!;
      expect(s.itemInstances[id].affixes.length).toBeLessThanOrEqual(4);
    }
  });

  it("P1-02 坏洗髓历史/重复灵根/越界共鸣拒绝导入", () => {
    const a = fresh();
    (a.marrowHistory as unknown) = [null];
    expect(importSave(exportSave(a)).ok).toBe(false);

    const b = fresh();
    b.spiritRoots = ["金", "金"];
    expect(importSave(exportSave(b)).ok).toBe(false);

    const c = fresh();
    c.spiritRoots = ["金", "水"];
    c.resonance = "雷";
    expect(importSave(exportSave(c)).ok).toBe(false);
  });

  it("P1-02 已领奖历史复制为 active 后拒绝导入", () => {
    let s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    s = settle(s, T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    const f = fightNode(s, T0 + DAY + 1000, c.mapId!, c.nodeId!, "challenge");
    const claimed = claimCommission(f.state, f.state.lastSettledAt, "b").state!;
    const edited = structuredClone(claimed);
    edited.commission.active = structuredClone(edited.commission.history[0]);
    edited.commission.active.status = "ready";
    expect(importSave(exportSave(edited)).ok).toBe(false);
  });

  it("P1-05 日期回拨不重新生成候选", () => {
    let s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    s = settle(s, T0 + 2 * DAY); // 前进到第 3 天
    const count3 = s.commission.candidates.length;
    const rollback = settle(s, T0 + DAY); // 回拨到第 2 天
    expect(rollback.commission.date).toBe(s.commission.date);
    expect(rollback.commission.candidates.length).toBe(count3);
  });

  it("P2-01 一次炼制只产生一个实例", () => {
    const s = rich();
    s.realm = "zhuji1";
    s.forge = 1;
    const r = craftEquipment(s, T0, "w_steel");
    expect(r.ok).toBe(true);
    const inv = r.state!.inventory;
    const steelKeys = Object.keys(inv).filter((k) => k === "w_steel" || k.startsWith("w_steel#"));
    expect(steelKeys.length).toBe(1);
  });

  it("P2-02 洗髓移除共鸣中的灵根后清空共鸣", () => {
    const s = rich();
    s.realm = "zhuji1";
    s.spiritRoots = ["金", "水"];
    s.resonance = "金";
    const r = marrow(s, T0, "removeRoot", "金");
    expect(r.ok).toBe(true);
    expect(r.state!.resonance).toBe(null);
  });

  it("P2-07 schema 为 v18，缺委托的新档拒绝导入", () => {
    expect(SCHEMA_VERSION).toBe(18);
    const s = fresh();
    s.schemaVersion = 18;
    (s as unknown as Record<string, unknown>).commission = undefined;
    expect(importSave(exportSave(s)).ok).toBe(false);
    // v17 旧档缺委托仍可迁移导入
    const old = fresh();
    old.schemaVersion = 17;
    (old as unknown as Record<string, unknown>).commission = undefined;
    const imported = importSave(exportSave(old));
    expect(imported.ok).toBe(true);
    expect(migrateSave(old).commission).toBeTruthy();
  });

  it("P1-04 建筑/功法/藏经阁/炼器台有逐级境界门槛", () => {
    // 炼气一层不能把修炼室升到 Lv4
    const b = rich();
    b.buildings.cultivationRoom = 3;
    expect(upgradeBuilding(b, T0, "cultivationRoom").ok).toBe(false);
    b.realm = "yuanying1";
    expect(upgradeBuilding(b, T0, "cultivationRoom").ok).toBe(true);

    // 炼气一层不能把青云诀升到 Lv4（需金丹）
    const t = rich();
    t.technique = "qingYun";
    t.techniqueLevel.qingYun = 3;
    expect(upgradeTechnique(t, T0).ok).toBe(false);
    t.realm = "jindan1";
    expect(upgradeTechnique(t, T0).ok).toBe(true);

    // 筑基一层不能把藏经阁升到 Lv3（需元婴）
    const l = rich();
    l.library = 2;
    l.realm = "zhuji1";
    expect(buildLibrary(l, T0).ok).toBe(false);
    l.realm = "yuanying1";
    expect(buildLibrary(l, T0).ok).toBe(true);

    // 一级炼器台不能炼虚空刃（需 Lv2）
    const f = rich();
    f.realm = "lianxu2";
    f.forge = 1;
    expect(craftEquipment(f, T0, "w_xuwu").ok).toBe(false);
    f.forge = 2;
    expect(craftEquipment(f, T0, "w_xuwu").ok).toBe(true);
  });

  it("P1-04 炼丹炉 Lv4 扣残页、凡品收益丹需筑基", () => {
    const s = rich();
    s.buildings.alchemyFurnace = 3;
    s.realm = "yuanying1";
    s.resources.page = 0;
    expect(upgradeBuilding(s, T0, "alchemyFurnace").ok).toBe(false); // 缺残页 100
    s.resources.page = 100;
    expect(upgradeBuilding(s, T0, "alchemyFurnace").ok).toBe(true);

    const g = rich();
    g.buildings.alchemyFurnace = 1;
    g.realm = "qi10";
    expect(craftGainPill(g, T0, "yangYuan", 1).ok).toBe(false); // 凡品需筑基
    g.realm = "zhuji1";
    expect(craftGainPill(g, T0, "yangYuan", 1).ok).toBe(true);
  });

  it("P1-01 跨日同目标委托可导入；同日不能二次接取", () => {
    let s = rich();
    s.realm = "zhuji1";
    s.maps.map_qingyun.node_wolf.cleared = true;
    s = settle(s, T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    const f = fightNode(s, T0 + DAY + 1000, c.mapId!, c.nodeId!, "challenge");
    const claimed = claimCommission(f.state, f.state.lastSettledAt, "b").state!;
    // 跨日同目标接取可导入（ID 含日期，不误判冲突）
    const next = settle(claimed, T0 + 2 * DAY);
    const c2 = next.commission.candidates.find((x) => x.kind === "battle")!;
    expect(c2.id).not.toBe(c.id);
    const acc2 = acceptCommission(next, T0 + 2 * DAY, c2.id);
    expect(acc2.ok).toBe(true);
    expect(importSave(exportSave(acc2.state!)).ok).toBe(true);
    // 同日再首通新节点后不能二次接取
    const side = fightNode(claimed, T0 + DAY + 2000, "map_qingyun", "node_bandit");
    expect(side.state.commission.acceptedDate).toBeTruthy();
    const tryAgain = acceptCommission(side.state, T0 + DAY + 2000, side.state.commission.candidates[0]?.id ?? "x");
    expect(tryAgain.ok).toBe(false);
  });

  it("P1-01 旧 v17 在途闭关（缺 effectiveMinutes）可导入", () => {
    const s = rich();
    s.spiritRoots = ["风"];
    s.resonance = "风";
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "seclusion", durationMinutes: 30, protection: false });
    const old = structuredClone(r.state!);
    old.schemaVersion = 17;
    delete (old.longTask as unknown as Record<string, unknown>).effectiveMinutes;
    expect(importSave(exportSave(old)).ok).toBe(true);
  });

  it("P1-03 旧档缺灵材迁移补零并补发已首通节点灵材", () => {
    const s = rich();
    s.schemaVersion = 13;
    s.realm = "yuanying4";
    for (const k of ["lingTaiJing", "yunHaiSui", "buXiuJin", "hunYuanYu", "taiChuZiJing"]) {
      delete (s.resources as unknown as Record<string, number>)[k];
    }
    const firstNode = Object.entries((CONFIG.maps as unknown as Record<string, { nodes: Record<string, { side?: boolean }> }>).map_yuanying.nodes)
      .filter(([, v]) => !v.side)[0][0];
    s.maps.map_yuanying[firstNode].cleared = true;
    s.maps.map_yuanying[firstNode].unlocked = true;
    const m = migrateSave(s);
    expect(m.resources.lingTaiJing).toBeGreaterThan(0); // 已首通元婴节点补灵胎晶
    expect(m.resources.yunHaiSui).toBe(0);
  });

  it("P1-02 删除每日目标/负服丹次数/坏洗髓拒绝导入", () => {
    const a = fresh();
    delete (a.daily as unknown as Record<string, unknown>).goals;
    expect(importSave(exportSave(a)).ok).toBe(false);
    const b = fresh();
    b.daily.rewardedDan = -1;
    expect(importSave(exportSave(b)).ok).toBe(false);
    const c = fresh();
    (c.marrowHistory as unknown) = [{ type: "unknown", from: "x", to: "y", spiritStone: -1, herb: -1, at: -1 }];
    expect(importSave(exportSave(c)).ok).toBe(false);
  });

  it("R1 初始/旧装备空词条可导出导入两轮", () => {
    const s = migrateSave(fresh()); // 初始装备迁移成空词条实例
    const one = importSave(exportSave(s));
    expect(one.ok).toBe(true);
    const two = importSave(exportSave(one.state!));
    expect(two.ok).toBe(true);
    // v13 旧档（无 itemInstances）迁移后同样可导回
    const old = fresh();
    old.schemaVersion = 13;
    delete (old as unknown as Record<string, unknown>).itemInstances;
    const m = migrateSave(old);
    expect(importSave(exportSave(m)).ok).toBe(true);
  });

  it("A2 v18 缺修订号拒绝导入；旧档迁移补修订号", () => {
    const s = fresh();
    delete (s as unknown as Record<string, unknown>).revision;
    expect(importSave(exportSave(s)).ok).toBe(false);
    const old = fresh();
    old.schemaVersion = 17;
    delete (old as unknown as Record<string, unknown>).revision;
    const m = migrateSave(old);
    expect(typeof m.revision).toBe("number");
    expect(Number.isFinite(m.revision)).toBe(true);
  });

  it("A3 委托时间回拨不能再接取", () => {
    let s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    for (const k of Object.keys(s.resources)) (s.resources as unknown as Record<string, number>)[k] = 1e7;
    s = settle(s, T0 + 2 * DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + 2 * DAY, c.id).state!;
    // 回拨到更早日期
    const back = fightNode(s, T0 + DAY, "map_qingyun", "node_side_1");
    const backCandidate = back.state.commission.candidates.find((x) => x.kind === "battle");
    if (backCandidate) {
      expect(acceptCommission(back.state, T0 + DAY, backCandidate.id).ok).toBe(false);
    }
  });

  it("B3 矛盾委托进度（ready 但 progress=0）拒绝导入", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    for (const k of Object.keys(s.resources)) (s.resources as unknown as Record<string, number>)[k] = 1e7;
    const day = settle(s, T0 + DAY);
    const c = day.commission.candidates[0];
    c.status = "ready";
    c.progress = 0;
    c.target = 1;
    expect(importSave(exportSave(day)).ok).toBe(false);
  });

  it("P2-02 旧式灵根待免费定根，定根前不可共鸣，定根只提交一次", () => {
    const s = fresh();
    s.schemaVersion = 13;
    delete (s as unknown as Record<string, unknown>).spiritRoots;
    delete (s as unknown as Record<string, unknown>).legacyRootPending;
    const m = migrateSave(s);
    expect(m.legacyRootPending).toBe(true);
    expect(setResonance(m, T0, "金").ok).toBe(false); // 未定根不可共鸣
    const r = settleRoots(m, T0, ["金", "水"]);
    expect(r.ok).toBe(true);
    expect(r.state!.legacyRootPending).toBe(false);
    expect(r.state!.spiritRoots).toEqual(["金", "水"]);
    expect(settleRoots(r.state!, T0, ["木"]).ok).toBe(false); // 只能定根一次
    expect(setResonance(r.state!, T0, "金").ok).toBe(true); // 定根后可共鸣
  });
});
