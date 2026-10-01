import { describe, expect, it } from "vitest";
import { createGame, fightNode, predictFight } from "./engine";
import type { RealmId, SaveState, TacticId } from "./types";

const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  const s = createGame("林青", "金", "balanced", nowMs);
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  s.daily.goals = { battle: { progress: 0, claimed: false }, suppress: { progress: 0, claimed: false } };
  return s;
}

// 造一个已普通首胜某节点、可打挑战的存档
function challengeable(realm: RealmId, mid: "map_qingyun", nid: string): SaveState {
  const s = fresh();
  s.realm = realm;
  s.maps[mid][nid].unlocked = true;
  s.maps[mid][nid].cleared = true;
  s.encounter.guideDone = true;
  return s;
}

describe("v1.8 战前战术", () => {
  it("三种战术在挑战难度改变预估", () => {
    const s = challengeable("qi3", "map_qingyun", "node_demon");
    const a = predictFight(s, "map_qingyun", "node_demon", "challenge", "normal");
    const b = predictFight(s, "map_qingyun", "node_demon", "challenge", "break");
    const c = predictFight(s, "map_qingyun", "node_demon", "challenge", "guard");
    const rounds = [a.log.length, b.log.length, c.log.length];
    expect(new Set(rounds).size).toBeGreaterThan(1);
  });

  it("挑战结算记录所选战术", () => {
    const s = challengeable("qi3", "map_qingyun", "node_demon");
    const r = fightNode(s, T0, "map_qingyun", "node_demon", "challenge", "guard");
    expect(r.ok).toBe(true);
    expect(r.state.lastBattle!.tactic).toBe("guard");
  });

  it("普通难度忽略战术，固定常法", () => {
    const s = challengeable("qi3", "map_qingyun", "node_demon");
    const r = fightNode(s, T0, "map_qingyun", "node_demon", "normal", "break");
    expect(r.state.lastBattle!.tactic).toBe("normal");
  });

  it("挑战战败不扣每日重复奖励额度", () => {
    const s = challengeable("qi3", "map_qingyun", "node_demon");
    s.daily.rewardedRepeats = 0;
    const before = s.daily.rewardedRepeats;
    const r = fightNode(s, T0, "map_qingyun", "node_demon", "challenge", "guard");
    if (!r.won) expect(r.state.daily.rewardedRepeats).toBe(before);
  });

  it("破势输出更高承伤更重、守拙输出更低承伤更轻（无唯一最优）", () => {
    const s = challengeable("qi3", "map_qingyun", "node_demon");
    const parse = (tactic: TacticId) => {
      const p = predictFight(s, "map_qingyun", "node_demon", "challenge", tactic);
      let dealt = 0, dealtN = 0, taken = 0, takenN = 0;
      for (const l of p.log) {
        let m = l.match(/伤敌(\d+)点/);
        if (m) { dealt += Number(m[1]); dealtN++; }
        m = l.match(/伤你(\d+)点/);
        if (m) { taken += Number(m[1]); takenN++; }
      }
      return { dealt: dealtN ? dealt / dealtN : 0, taken: takenN ? taken / takenN : 0 };
    };
    const n = parse("normal");
    const b = parse("break");
    const g = parse("guard");
    expect(b.dealt).toBeGreaterThan(n.dealt);
    expect(g.dealt).toBeLessThan(n.dealt);
    expect(b.taken).toBeGreaterThan(n.taken);
    expect(g.taken).toBeLessThan(n.taken);
  });
});
