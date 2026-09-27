import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { breakthrough, canBreakthrough, createGame, fightNode, isTrialRealm, predictFight, previewCrossStageTrial, setSuppression, settle, startCrossStageTrial } from "./engine";
import type { MapId, RealmId, SaveState } from "./types";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

function stageOf(realm: RealmId): number {
  return CONFIG.realms.find((r) => r.id === realm)?.stage ?? 0;
}

function equipForStage(s: SaveState): void {
  const stage = stageOf(s.realm);
  const tier = stage >= 19 ? "dadao" : stage >= 16 ? "hunyuan" : stage >= 12 ? "jinxian" : stage >= 8 ? "dacheng" : stage >= 4 ? "yuanying" : "steel";
  s.equipment.weapon = `w_${tier}`;
  s.equipment.armor = `a_${tier}`;
  s.inventory[`w_${tier}`] = 1;
  s.inventory[`a_${tier}`] = 1;
}

function clearAvailable(s: SaveState, now: number): SaveState {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [mid, map] of Object.entries(CONFIG.maps)) {
      for (const [nid, node] of Object.entries(map.nodes)) {
        const state = s.maps[mid as MapId]?.[nid];
        if (!state?.unlocked || state.cleared || stageOf(s.realm) < stageOf(node.gate as RealmId)) continue;
        if (!predictFight(s, mid as MapId, nid).won) continue;
        const result = fightNode(s, now, mid as MapId, nid);
        if (result.won) {
          s = result.state;
          changed = true;
        }
      }
    }
  }
  return s;
}

describe("二十境长线数值", () => {
  it("12 小时/日、每日三次重复历练能抵达最高境；记录逐境天数", () => {
    let normalArrival = 0;
    for (const rewardMode of ["normal", "challenge"] as const) {
      let s = createGame("校准", "金", "balanced", START);
      s.realm = "yuanying1";
      s.buildings = { cultivationRoom: 2, spiritArray: 2, spiritField: 2, alchemyFurnace: 2 };
      s.library = 2;
      s.technique = "qingYun";
      s.auxiliaryTechnique = "juYuan";
      s.techniqueLevel = { qingYun: 3, xuanGui: 3, poYue: 3, juYuan: 3, ningYing: 0, yunHai: 0, buXiu: 0, hunYuanGuiYi: 0, taiChu: 0 };
      s.equipment = { weapon: "w_yuanying", armor: "a_yuanying", accessory: "c_jade" };
      s.inventory.w_yuanying = 1;
      s.inventory.a_yuanying = 1;
      s.inventory.c_jade = 1;
      s.resources.spiritStone = 1_000_000_000; // 仅测修为/灵气时间，灵石与材料另验。
      s.encounter.triggeredToday = CONFIG.encounter.dailyMax;
      const arrival: Record<number, number> = { 4: 0 };
      let previous = 4;
      for (let day = 1; day <= 100 && s.realm !== "hongmeng10"; day++) {
        const now = START + day * DAY;
        s = settle(s, now);
        s.encounter.triggeredToday = CONFIG.encounter.dailyMax;
        let progress = true;
        while (progress) {
          equipForStage(s);
          const oldRealm = s.realm;
          const oldClear = Object.values(s.maps).reduce((n, map) => n + Object.values(map).filter((v) => v.cleared).length, 0);
          s = clearAvailable(s, now);
          if (canBreakthrough(s)) {
            const next = CONFIG.realms[CONFIG.realms.findIndex((r) => r.id === s.realm) + 1];
            if (s.resources.cultivation >= Math.ceil(next.cultivationCost * CONFIG.breakthrough.steadyCostMult) && s.resources.spirit >= Math.ceil(next.spiritCost * CONFIG.breakthrough.steadyCostMult)) {
              const r = breakthrough(s, now, "steady");
              if (r.ok) s = r.state as SaveState;
            }
          } else if (isTrialRealm(s.realm)) {
            s.technique = "xuanGui";
            s.preparedPill = true;
            s.inventory.tribulationPill = 1;
            const preview = previewCrossStageTrial(s);
            if (preview.ok && preview.canAfford && preview.success) {
              const r = startCrossStageTrial(s, now);
              if (r.ok) s = r.state as SaveState;
            }
            s.technique = "qingYun";
          }
          const newClear = Object.values(s.maps).reduce((n, map) => n + Object.values(map).filter((v) => v.cleared).length, 0);
          progress = s.realm !== oldRealm || newClear !== oldClear;
        }
        const stage = stageOf(s.realm);
        for (let i = previous + 1; i <= stage; i++) arrival[i] = day;
        previous = stage;
        const cleared = Object.entries(s.maps).flatMap(([mid, map]) => Object.entries(map).filter(([, v]) => v.cleared).map(([nid]) => ({ mid: mid as MapId, nid })));
        if (cleared.length) {
          const latest = cleared.at(-1)!;
          const difficulty = rewardMode === "challenge" && predictFight(s, latest.mid, latest.nid, "challenge").won ? "challenge" : "normal";
          for (let i = 0; i < CONFIG.rewardedRepeatBattlesPerDay; i++) s = fightNode(s, now, latest.mid, latest.nid, difficulty).state;
          const sup = setSuppression(s, now, latest.mid, latest.nid);
          if (sup.ok) s = sup.state as SaveState;
        }
      }
      expect(s.realm).toBe("hongmeng10");
      expect(arrival[20]).toBeGreaterThanOrEqual(42);
      expect(arrival[20]).toBeLessThanOrEqual(56);
      if (rewardMode === "normal") normalArrival = arrival[20];
      else expect(arrival[20]).toBeLessThanOrEqual(normalArrival);
      for (const [mid, map] of Object.entries(CONFIG.maps)) {
        if (mid === "map_qingyun" || mid === "map_nether" || mid === "map_yunling" || mid === "map_jindan") continue;
        expect(Object.keys(map.nodes).every((nid) => s.maps[mid as MapId][nid].cleared), mid).toBe(true);
      }
    }
  });

  it("新装备的首张地图可用上一档装备开荒", () => {
    const tiers: Array<[MapId, string, string]> = [
      ["map_yuanying", "w_steel", "a_steel"],
      ["map_dacheng", "w_yuanying", "a_yuanying"],
      ["map_jinxian", "w_dacheng", "a_dacheng"],
      ["map_hunyuan_daluo", "w_jinxian", "a_jinxian"],
      ["map_dadao", "w_hunyuan", "a_hunyuan"],
    ];
    for (const [mid, weapon, armor] of tiers) {
      const s = createGame("开荒", "金", "balanced", START);
      const maps = CONFIG.maps as unknown as Record<string, { nodes: Record<string, { gate: string }> }>;
      const node = Object.entries(maps[mid].nodes)[0];
      s.realm = node[1].gate as RealmId;
      s.maps[mid][node[0]].unlocked = true;
      s.equipment = { weapon, armor, accessory: "c_jade" };
      s.technique = "poYue";
      s.techniqueLevel.poYue = 3;
      expect(predictFight(s, mid, node[0]).won, mid).toBe(true);
    }
  });
});
