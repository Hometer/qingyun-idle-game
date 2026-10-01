import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createGame,
  settle,
  acceptCommission,
  claimCommission,
  fightNode,
  upgradeBuilding,
  importSave,
  migrateSave,
} from "./engine";
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

// 首通野狼后的存档（有战斗候选可用）
function withClear(): SaveState {
  const s = fresh();
  return fightNode(s, T0, "map_qingyun", "node_wolf").state;
}

describe("v1.8 山河委托", () => {
  it("新角色当天有候选（制作类）", () => {
    const s = fresh();
    expect(s.commission.candidates.length).toBeGreaterThan(0);
    expect(s.commission.candidates.every((c) => c.kind === "craft")).toBe(true);
  });

  it("跨日重新生成两件候选（含战斗候选）", () => {
    const s = settle(withClear(), T0 + DAY);
    expect(s.commission.candidates.length).toBe(2);
    expect(s.commission.candidates.some((c) => c.kind === "battle")).toBe(true);
    expect(s.commission.candidates.some((c) => c.kind === "craft")).toBe(true);
  });

  it("接取委托后 active 正确、候选清空、不可重复接", () => {
    const s = settle(withClear(), T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    const r = acceptCommission(s, T0 + DAY, c.id);
    expect(r.ok).toBe(true);
    expect(r.state!.commission.active?.id).toBe(c.id);
    expect(r.state!.commission.candidates.length).toBe(0);
    const again = acceptCommission(r.state!, T0 + DAY, c.id);
    expect(again.ok).toBe(false);
  });

  it("战斗委托：挑战目标获胜转 ready，领奖两选一入账并记历史", () => {
    let s = settle(withClear(), T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    expect(s.commission.active?.status).toBe("accepted");

    const f = fightNode(s, T0 + DAY + 1000, c.mapId!, c.nodeId!, c.difficulty ?? "normal", "normal");
    expect(f.won).toBe(true);
    expect(f.state.commission.active?.status).toBe("ready");

    const rewardA = structuredClone(f.state.commission.active!.rewardA);
    const claim = claimCommission(f.state, f.state.lastSettledAt, "a");
    expect(claim.ok).toBe(true);
    const st = claim.state!;
    expect(st.commission.active).toBe(null);
    expect(st.commission.history.length).toBe(1);
    expect(st.commission.history[0].rewardChoice).toBe("a");
    expect(st.commission.history[0].response).toContain("青崖");
    expect(st.resources.cultivation).toBe(f.state.resources.cultivation + rewardA.cultivation);
    expect(st.milestones.some((m) => m.type === "commission")).toBe(true);
  });

  it("制作委托：升级建筑转 ready 并领奖", () => {
    let s = settle(withClear(), T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "craft")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    s.resources.spiritStone = 100000;
    const r = upgradeBuilding(s, s.lastSettledAt, "cultivationRoom");
    expect(r.ok).toBe(true);
    expect(r.state!.commission.active?.status).toBe("ready");
    const claim = claimCommission(r.state!, r.state!.lastSettledAt, "b");
    expect(claim.ok).toBe(true);
    expect(claim.state!.commission.history.length).toBe(1);
    expect(claim.state!.commission.history[0].rewardChoice).toBe("b");
  });

  it("领奖后不可重复领", () => {
    let s = settle(withClear(), T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    const f = fightNode(s, T0 + DAY + 1000, c.mapId!, c.nodeId!, c.difficulty ?? "normal", "normal");
    const claim = claimCommission(f.state, f.state.lastSettledAt, "a");
    expect(claim.ok).toBe(true);
    const again = claimCommission(claim.state!, claim.state!.lastSettledAt, "b");
    expect(again.ok).toBe(false);
  });

  it("跨日保留已接取的进行中委托", () => {
    let s = settle(withClear(), T0 + DAY);
    const c = s.commission.candidates.find((x) => x.kind === "battle")!;
    s = acceptCommission(s, T0 + DAY, c.id).state!;
    const s2 = settle(s, T0 + 2 * DAY);
    expect(s2.commission.active?.id).toBe(c.id);
    expect(s2.commission.candidates.length).toBe(2); // 跨日重新生成候选
  });

  it("旧档迁移补 commission 默认", () => {
    const s = fresh();
    s.schemaVersion = 17;
    (s as unknown as Record<string, unknown>).commission = undefined;
    const m = migrateSave(s);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.commission).toBeTruthy();
    expect(Array.isArray(m.commission.candidates)).toBe(true);
    expect(m.commission.active).toBe(null);
    expect(Array.isArray(m.commission.history)).toBe(true);
  });

  it("旧档导入按真实境界重新生成候选（含战斗候选）", () => {
    const s = fresh();
    s.realm = "zhuji1";
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.maps.map_qingyun.node_wolf.unlocked = true;
    s.schemaVersion = 17;
    (s as unknown as Record<string, unknown>).commission = undefined;
    const imported = importSave(JSON.stringify(s));
    expect(imported.ok).toBe(true);
    const st = imported.state!;
    expect(st.commission.candidates.some((c) => c.kind === "battle")).toBe(true);
  });

  it("坏委托档拒绝导入", () => {
    const good = fresh();
    const bad = structuredClone(good) as unknown as Record<string, unknown>;
    bad.commission = { date: "bad", candidates: [{ id: "x", kind: "battle" }], active: null, history: [] };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});
