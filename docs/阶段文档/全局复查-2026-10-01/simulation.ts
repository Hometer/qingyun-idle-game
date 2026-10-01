// 全资源路线模拟：新建角色 qi1 → hongmeng10，真实配方/建筑/材料/委托现金流。
// 从 frontend 运行：node node_modules/vite-node/vite-node.mjs ../docs/阶段文档/全局复查-2026-10-01/simulation.ts
import * as e from "../../../frontend/src/engine/engine";
import { CONFIG } from "../../../frontend/src/engine/config";
import type { BuildingId, MapId, RealmId, SaveState } from "../../../frontend/src/engine/types";

const DAY = 86_400_000;
const START = new Date(2026, 8, 1, 10).getTime();

const MAPS = CONFIG.maps as unknown as Record<MapId, { nodes: Record<string, { gate: string; side?: boolean }> }>;
const REALMS = CONFIG.realms as unknown as Array<{ id: RealmId; stage: number; layer: number; cultivationCost: number; spiritCost: number }>;

function stageOf(realm: RealmId): number {
  return REALMS.find((r) => r.id === realm)?.stage ?? 0;
}
function realmIndex(realm: RealmId): number {
  return REALMS.findIndex((r) => r.id === realm);
}

// 当前境界应装备的剑/衣
function tierForStage(stage: number): string {
  if (stage >= 19) return "dadao";
  if (stage >= 16) return "hunyuan";
  if (stage >= 12) return "jinxian";
  if (stage >= 8) return "dacheng";
  if (stage >= 6) return "xuwu";
  if (stage >= 10) return "feixian";
  if (stage >= 14) return "daluo";
  if (stage >= 18) return "tianming";
  if (stage >= 4) return "yuanying";
  return "steel";
}

// 尝试用当前资源打造当前档的剑/衣（能炼就炼，不预给）
function craftGear(s: SaveState, now: number): SaveState {
  const stage = stageOf(s.realm);
  const tiers = ["steel", "yuanying", "xuwu", "dacheng", "feixian", "jinxian", "daluo", "hunyuan", "tianming", "dadao"];
  for (const t of tiers) {
    const w = `w_${t}`;
    const a = `a_${t}`;
    for (const id of [w, a]) {
      const cfg = (CONFIG.crafts as unknown as Record<string, { gate: RealmId; cost: Record<string, number> }>)[id];
      if (!cfg) continue;
      if (realmIndex(s.realm) < realmIndex(cfg.gate)) continue;
      const forgeNeed = (CONFIG.craftForgeLevel as Record<string, number>)[id] ?? 1;
      if (s.forge < forgeNeed) continue;
      const cost = cfg.cost;
      const res = s.resources as unknown as Record<string, number>;
      if (Object.entries(cost).some(([k, v]) => v > 0 && res[k] < v)) continue;
      // 已有同档或更高档装备就跳过
      const curBase = s.equipment[id.startsWith("w_") ? "weapon" : "armor"];
      const curId = curBase ? (s.itemInstances[curBase]?.baseId ?? curBase) : null;
      if (curId) {
        const curStage = stageOf((CONFIG.crafts as unknown as Record<string, { gate: RealmId }>)[curId]?.gate as RealmId);
        const newStage = stageOf(cfg.gate);
        if (curStage >= newStage) continue; // 已有同档或更高档
      }
      const r = e.craftEquipment(s, now, id);
      if (r.ok) s = r.state as SaveState;
    }
  }
  // 穿戴当前最好的剑/衣
  for (const slot of ["weapon", "armor"] as const) {
    const best = Object.entries(s.itemInstances)
      .filter(([, inst]) => (CONFIG.equipment as unknown as Record<string, { slot: string }>)[inst.baseId]?.slot === slot)
      .sort((a, b) => {
        const ga = stageOf((CONFIG.crafts as unknown as Record<string, { gate: RealmId }>)[a[1].baseId]?.gate as RealmId);
        const gb = stageOf((CONFIG.crafts as unknown as Record<string, { gate: RealmId }>)[b[1].baseId]?.gate as RealmId);
        return gb - ga;
      });
    if (best[0] && (s.inventory[best[0][0]] || 0) > 0) {
      const r = e.equipItem(s, now, best[0][0]);
      if (r.ok) s = r.state as SaveState;
    }
  }
  return s;
}

// 升级最便宜的可用建筑/藏经阁/炼器台/功法
function upgradeCheapest(s: SaveState, now: number): SaveState {
  // 藏经阁二级后设辅修聚元诀（灵气产出）
  if (s.library >= 2 && !s.auxiliaryTechnique && s.technique === "qingYun") {
    const r = e.setAuxiliaryTechnique(s, now, "juYuan");
    if (r.ok) s = r.state as SaveState;
  }
  // 功法优先（残页）
  if (s.technique) {
    const lvl = s.techniqueLevel[s.technique];
    const levels = (CONFIG.techniques as unknown as Record<string, { levels: Array<{ pageCost: number }> }>)[s.technique].levels;
    if (lvl < levels.length) {
      const r = e.upgradeTechnique(s, now);
      if (r.ok) s = r.state as SaveState;
    }
  }
  // 建筑（最便宜）
  for (const bid of Object.keys(CONFIG.buildings) as BuildingId[]) {
    const lvl = s.buildings[bid];
    if (lvl >= CONFIG.buildings[bid].levels.length) continue;
    const r = e.upgradeBuilding(s, now, bid);
    if (r.ok) s = r.state as SaveState;
  }
  if (e.buildLibrary(s, now).ok) s = (e.buildLibrary(s, now).state ?? s);
  if (e.buildForge(s, now).ok) s = (e.buildForge(s, now).state ?? s);
  return s;
}

function clearAvailable(s: SaveState, now: number): SaveState {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [mid, map] of Object.entries(MAPS)) {
      for (const [nid, node] of Object.entries(map.nodes)) {
        const st = s.maps[mid as MapId]?.[nid];
        if (!st?.unlocked || st.cleared || realmIndex(s.realm) < realmIndex(node.gate as RealmId)) continue;
        if (!e.predictFight(s, mid as MapId, nid).won) continue;
        const r = e.fightNode(s, now, mid as MapId, nid);
        if (r.won) { s = r.state; changed = true; }
      }
    }
  }
  return s;
}

function run(cfg: { aptitude: "balanced" | "focus" | "spirit"; method: "steady" | "risky"; loginsPerDay: number }) {
  let s = e.createGame("模拟", "金", cfg.aptitude, START);
  // 初始主修青云诀（修为产速）
  const r0 = e.setTechnique(s, START, "qingYun");
  if (r0.ok) s = r0.state as SaveState;
  const arrival: Record<number, number> = {};
  let prevStage = 1;
  const lastAction: string[] = [];
  for (let day = 1; day <= 120 && s.realm !== "hongmeng10"; day++) {
    const now = START + day * DAY;
    // 每日登录次数：分多次 settle 模拟
    const step = Math.floor(DAY / cfg.loginsPerDay);
    for (let k = 0; k < cfg.loginsPerDay; k++) {
      s = e.settle(s, now + k * step);
      // 领每日目标
      for (const g of ["battle", "suppress"] as const) {
        if (s.daily.goals[g].progress >= CONFIG.dailyGoals[g].target && !s.daily.goals[g].claimed) {
          const r = e.claimDailyGoal(s, now + k * step, g);
          if (r.ok) s = r.state as SaveState;
        }
      }
      // 战斗：首通 + 每日三次重复历练
      s = clearAvailable(s, now + k * step);
      for (let i = 0; i < CONFIG.rewardedRepeatBattlesPerDay; i++) {
        const cleared = Object.entries(s.maps).flatMap(([mid, m]) => Object.entries(m).filter(([, v]) => v.cleared).map(([nid]) => ({ mid: mid as MapId, nid })));
        if (!cleared.length || s.daily.rewardedRepeats >= CONFIG.rewardedRepeatBattlesPerDay) break;
        const latest = cleared.at(-1)!;
        const r = e.fightNode(s, now + k * step, latest.mid, latest.nid, "normal");
        if (r.ok) s = r.state;
      }
      // 秘境（材料 + 资源，每日各一次，可胜才进）
      for (const rid of Object.keys(CONFIG.secretRealms) as import("../../../frontend/src/engine/types").SecretRealmId[]) {
        if ((s.secretRealmUsed[rid])) continue;
        const pred = e.predictSecretRealm(s, rid);
        if (pred.ok && pred.won) {
          const r = e.enterSecretRealm(s, now + k * step, rid);
          if (r.ok) s = r.state as SaveState;
        }
      }
      // 镇压最好节点（灵石/玄铁收入）
      const clearedAll = Object.entries(s.maps).flatMap(([mid, m]) => Object.entries(m).filter(([, v]) => v.cleared).map(([nid]) => ({ mid: mid as MapId, nid })));
      if (clearedAll.length) {
        const best = clearedAll.at(-1)!;
        if (s.suppression[best.mid] !== best.nid) {
          const r = e.setSuppression(s, now + k * step, best.mid, best.nid);
          if (r.ok) s = r.state as SaveState;
        }
      }
      // 委托：接战斗委托 → 挑战 → 领奖
      if (!s.commission.active && s.commission.candidates.length) {
        const c = s.commission.candidates.find((x) => x.kind === "battle");
        if (c) {
          const acc = e.acceptCommission(s, now + k * step, c.id);
          if (acc.ok) {
            s = acc.state as SaveState;
            const f = e.fightNode(s, now + k * step, c.mapId!, c.nodeId!, "challenge");
            if (f.ok) {
              s = f.state;
              const cl = e.claimCommission(s, now + k * step, "b");
              if (cl.ok) s = cl.state as SaveState;
            }
          }
        }
      }
      // 装备/升级
      s = craftGear(s, now + k * step);
      s = upgradeCheapest(s, now + k * step);
      // 突破 / 跨境试炼
      if (e.canBreakthrough(s)) {
        const next = REALMS[realmIndex(s.realm) + 1];
        const costs = e.breakthroughCosts(s, cfg.method);
        const c = cfg.method === "steady" ? costs.success : costs.failure;
        if (s.resources.cultivation >= c.cultivation && s.resources.spirit >= c.spirit) {
          const r = e.breakthrough(s, now + k * step, cfg.method);
          if (r.ok) s = r.state as SaveState;
        }
      } else if (e.isTrialRealm(s.realm)) {
        // 跨境前：转修玄龟诀减伤 + 升到至少 3 重 + 预置护劫丹
        const beforeTech = s.technique;
        if (s.technique !== "xuanGui") {
          const r = e.setTechnique(s, now + k * step, "xuanGui");
          if (r.ok) s = r.state as SaveState;
        }
        const xu = CONFIG.techniques.xuanGui as unknown as { levels: Array<{ pageCost: number }> };
        while (s.techniqueLevel.xuanGui < 3 && s.resources.page >= xu.levels[s.techniqueLevel.xuanGui].pageCost) {
          const r = e.upgradeTechnique(s, now + k * step);
          if (!r.ok) break;
          s = r.state as SaveState;
        }
        if ((s.inventory.tribulationPill || 0) < 1 && s.buildings.alchemyFurnace >= 1 && s.resources.herb >= 50 && s.resources.spiritStone >= 100) {
          const r = e.craftPill(s, now + k * step, 1);
          if (r.ok) s = r.state as SaveState;
        }
        if ((s.inventory.tribulationPill || 0) >= 1 && !s.preparedPill) {
          const r = e.togglePreparePill(s, now + k * step, 1);
          if (r.ok) s = r.state as SaveState;
        }
        const preview = e.previewCrossStageTrial(s);
        if (preview.ok && preview.canAfford && preview.success) {
          const r = e.startCrossStageTrial(s, now + k * step);
          if (r.ok) s = r.state as SaveState;
        } else if (day % 5 === 0 && lastAction.length < 8) {
          lastAction.push(`day${day} 跨境卡: ${preview.ok ? (preview.canAfford ? "预计失败(减伤"+Math.round((e.tribulationReductionInfo(s).reduction||0)*100)+"%)" : "费用不足") : preview.reason}`);
        }
        if (s.realm === REALMS[realmIndex(s.realm)]?.id && beforeTech && s.technique !== beforeTech) {
          const r2 = e.setTechnique(s, now + k * step, beforeTech);
          if (r2.ok) s = r2.state as SaveState;
        }
      }
    }
    const st = stageOf(s.realm);
    if (st > prevStage) { arrival[st] = day; prevStage = st; }
  }
  return { realm: s.realm, arrival, lastAction, buildings: s.buildings, forge: s.forge, library: s.library };
}

console.log(JSON.stringify({
  steady: run({ aptitude: "balanced", method: "steady", loginsPerDay: 2 }),
  // 仅跑一条主路线作为首轮；扩展矩阵后续补
}, null, 2));
