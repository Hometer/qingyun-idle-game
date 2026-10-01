// 全资源成长矩阵：资质 × 经脉(低/中/高) × 悟性(低/中/高) × 灵根(五行/变异) × 突破(稳妥/冲关) × 登录(1/2)。
// 保留 simulation-review.ts 的连续晋级策略；不预给资源、不修改游戏数值。
import * as e from "../../../frontend/src/engine/engine";
import { CONFIG } from "../../../frontend/src/engine/config";
import type { BuildingId, MapId, RealmId, SaveState } from "../../../frontend/src/engine/types";

const DAY = 86_400_000;
const START = new Date(2026, 8, 1, 10).getTime();
const MAPS = CONFIG.maps as unknown as Record<MapId, { nodes: Record<string, { gate: string; side?: boolean }> }>;
const REALMS = CONFIG.realms as unknown as Array<{ id: RealmId; stage: number; layer: number }>;

function stageOf(realm: RealmId) { return REALMS.find((r) => r.id === realm)?.stage ?? 0; }
function realmIndex(realm: RealmId) { return REALMS.findIndex((r) => r.id === realm); }

function craftGear(s: SaveState, now: number): SaveState {
  const tiers = ["steel", "yuanying", "xuwu", "dacheng", "feixian", "jinxian", "daluo", "hunyuan", "tianming", "dadao"];
  for (const t of tiers) for (const id of [`w_${t}`, `a_${t}`]) {
    const cfg = (CONFIG.crafts as unknown as Record<string, { gate: RealmId; cost: Record<string, number> }>)[id];
    if (!cfg || realmIndex(s.realm) < realmIndex(cfg.gate)) continue;
    if (s.forge < ((CONFIG.craftForgeLevel as Record<string, number>)[id] ?? 1)) continue;
    if (Object.entries(cfg.cost).some(([k, v]) => v > 0 && (s.resources as Record<string, number>)[k] < v)) continue;
    const slot = id.startsWith("w_") ? "weapon" : "armor";
    const curBase = s.equipment[slot] ? (s.itemInstances[s.equipment[slot]]?.baseId ?? s.equipment[slot]) : null;
    if (curBase && stageOf((CONFIG.crafts as unknown as Record<string, { gate: RealmId }>)[curBase]?.gate as RealmId) >= stageOf(cfg.gate)) continue;
    const r = e.craftEquipment(s, now, id);
    if (r.ok) s = r.state as SaveState;
  }
  for (const slot of ["weapon", "armor"] as const) {
    const best = Object.entries(s.itemInstances).filter(([, i]) => (CONFIG.equipment as Record<string, { slot: string }>)[i.baseId]?.slot === slot)
      .sort((a, b) => stageOf((CONFIG.crafts as Record<string, { gate: RealmId }>)[b[1].baseId]?.gate as RealmId) - stageOf((CONFIG.crafts as Record<string, { gate: RealmId }>)[a[1].baseId]?.gate as RealmId));
    if (best[0] && (s.inventory[best[0][0]] || 0) > 0) { const r = e.equipItem(s, now, best[0][0]); if (r.ok) s = r.state as SaveState; }
  }
  return s;
}

function upgradeCheapest(s: SaveState, now: number): SaveState {
  if (s.library >= 2 && !s.auxiliaryTechnique && s.technique === "qingYun") { const r = e.setAuxiliaryTechnique(s, now, "juYuan"); if (r.ok) s = r.state as SaveState; }
  if (s.technique) {
    const lvl = s.techniqueLevel[s.technique];
    const levels = (CONFIG.techniques as Record<string, { levels: Array<{ pageCost: number }> }>)[s.technique].levels;
    if (lvl < levels.length) { const r = e.upgradeTechnique(s, now); if (r.ok) s = r.state as SaveState; }
  }
  for (const bid of Object.keys(CONFIG.buildings) as BuildingId[]) {
    if (s.buildings[bid] >= CONFIG.buildings[bid].levels.length) continue;
    const r = e.upgradeBuilding(s, now, bid); if (r.ok) s = r.state as SaveState;
  }
  if (e.buildLibrary(s, now).ok) s = (e.buildLibrary(s, now).state ?? s);
  if (e.buildForge(s, now).ok) s = (e.buildForge(s, now).state ?? s);
  return s;
}

function clearAvailable(s: SaveState, now: number): SaveState {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [mid, map] of Object.entries(MAPS)) for (const [nid, node] of Object.entries(map.nodes)) {
      const st = s.maps[mid as MapId]?.[nid];
      if (!st?.unlocked || st.cleared || realmIndex(s.realm) < realmIndex(node.gate as RealmId)) continue;
      if (!e.predictFight(s, mid as MapId, nid).won) continue;
      const r = e.fightNode(s, now, mid as MapId, nid); if (r.won) { s = r.state; changed = true; }
    }
  }
  return s;
}

function run(p: { aptitude: string; meridian: string; comprehension: string; roots: string[]; method: "steady" | "risky"; logins: number }): number | null {
  let s = e.createGameWithFortune("矩阵", { spiritRoots: p.roots, meridians: p.meridian, comprehension: p.comprehension }, p.aptitude as "balanced", START);
  const r0 = e.setTechnique(s, START, "qingYun"); if (r0.ok) s = r0.state as SaveState;
  const rng = () => 0; // 冲关取必成下界；稳妥无随机
  for (let day = 1; day <= 120 && s.realm !== "hongmeng10"; day++) {
    const now = START + day * DAY;
    const step = Math.floor(DAY / p.logins);
    for (let k = 0; k < p.logins; k++) {
      s = e.settle(s, now + k * step);
      for (const g of ["battle", "suppress"] as const) if (s.daily.goals[g].progress >= CONFIG.dailyGoals[g].target && !s.daily.goals[g].claimed) { const r = e.claimDailyGoal(s, now + k * step, g); if (r.ok) s = r.state as SaveState; }
      s = clearAvailable(s, now + k * step);
      for (let i = 0; i < CONFIG.rewardedRepeatBattlesPerDay; i++) {
        const c = Object.entries(s.maps).flatMap(([mid, m]) => Object.entries(m).filter(([, v]) => v.cleared).map(([nid]) => ({ mid: mid as MapId, nid })));
        if (!c.length || s.daily.rewardedRepeats >= CONFIG.rewardedRepeatBattlesPerDay) break;
        const l = c.at(-1)!; const r = e.fightNode(s, now + k * step, l.mid, l.nid, "normal"); if (r.ok) s = r.state;
      }
      for (const rid of Object.keys(CONFIG.secretRealms) as import("../../../frontend/src/engine/types").SecretRealmId[]) {
        if (s.secretRealmUsed[rid]) continue;
        const pred = e.predictSecretRealm(s, rid); if (pred.ok && pred.won) { const r = e.enterSecretRealm(s, now + k * step, rid); if (r.ok) s = r.state as SaveState; }
      }
      const clearedAll = Object.entries(s.maps).flatMap(([mid, m]) => Object.entries(m).filter(([, v]) => v.cleared).map(([nid]) => ({ mid: mid as MapId, nid })));
      if (clearedAll.length) { const b = clearedAll.at(-1)!; if (s.suppression[b.mid] !== b.nid) { const r = e.setSuppression(s, now + k * step, b.mid, b.nid); if (r.ok) s = r.state as SaveState; } }
      if (!s.commission.active && s.commission.candidates.length) {
        const c = s.commission.candidates.find((x) => x.kind === "battle");
        if (c) { const acc = e.acceptCommission(s, now + k * step, c.id); if (acc.ok) { s = acc.state as SaveState; const f = e.fightNode(s, now + k * step, c.mapId!, c.nodeId!, "challenge"); if (f.ok) { s = f.state; const cl = e.claimCommission(s, now + k * step, "b"); if (cl.ok) s = cl.state as SaveState; } } }
      }
      s = craftGear(s, now + k * step);
      s = upgradeCheapest(s, now + k * step);
      for (let adv = 0; adv < 200; adv++) {
        const beforeRealm = s.realm;
        if (e.canBreakthrough(s)) {
          const next = REALMS[realmIndex(s.realm) + 1];
          const costs = e.breakthroughCosts(s, p.method);
          const c = p.method === "steady" ? costs.success : costs.failure;
          if (s.resources.cultivation >= c.cultivation && s.resources.spirit >= c.spirit) { const r = e.breakthrough(s, now + k * step, p.method, rng); if (r.ok) s = r.state as SaveState; }
        } else if (e.isTrialRealm(s.realm)) {
          const beforeTech = s.technique;
          if (s.technique !== "xuanGui") { const r = e.setTechnique(s, now + k * step, "xuanGui"); if (r.ok) s = r.state as SaveState; }
          const xu = CONFIG.techniques.xuanGui as { levels: Array<{ pageCost: number }> };
          while (s.techniqueLevel.xuanGui < 3 && s.resources.page >= xu.levels[s.techniqueLevel.xuanGui].pageCost) { const r = e.upgradeTechnique(s, now + k * step); if (!r.ok) break; s = r.state as SaveState; }
          if ((s.inventory.tribulationPill || 0) < 1 && s.buildings.alchemyFurnace >= 1 && s.resources.herb >= 50 && s.resources.spiritStone >= 100) { const r = e.craftPill(s, now + k * step, 1); if (r.ok) s = r.state as SaveState; }
          if ((s.inventory.tribulationPill || 0) >= 1 && !s.preparedPill) { const r = e.togglePreparePill(s, now + k * step, 1); if (r.ok) s = r.state as SaveState; }
          const preview = e.previewCrossStageTrial(s);
          if (preview.ok && preview.canAfford && preview.success) { const r = e.startCrossStageTrial(s, now + k * step); if (r.ok) s = r.state as SaveState; }
          if (s.realm === REALMS[realmIndex(s.realm)]?.id && beforeTech && s.technique !== beforeTech) { const r2 = e.setTechnique(s, now + k * step, beforeTech); if (r2.ok) s = r2.state as SaveState; }
        }
        if (s.realm === "hongmeng10") return Math.round((now + k * step - START) / DAY);
        if (s.realm === beforeRealm) break;
      }
    }
  }
  return null; // 120 天未完成
}

const aptitudes = ["balanced", "focus", "spirit"];
const meridians = ["blocked", "normal", "innate"];
const comprehensions = ["dull", "normal", "genius"];
const rootsList: Array<{ label: string; roots: string[] }> = [{ label: "五行", roots: ["金"] }, { label: "变异", roots: ["风"] }];
const methods: Array<"steady" | "risky"> = ["steady", "risky"];
const loginsList = [1, 2];

const results: Array<{ key: string; days: number | null }> = [];
for (const aptitude of aptitudes) for (const meridian of meridians) for (const comprehension of comprehensions)
  for (const { label, roots } of rootsList) for (const method of methods) for (const logins of loginsList) {
    const days = run({ aptitude, meridian, comprehension, roots, method, logins });
    results.push({ key: `${aptitude}/${meridian}/${comprehension}/${label}/${method}/${logins}登录`, days });
  }

const done = results.filter((r) => r.days !== null) as Array<{ key: string; days: number }>;
const unfinished = results.filter((r) => r.days === null);
const inTarget = done.filter((r) => r.days >= 42 && r.days <= 56);
const under = done.filter((r) => r.days < 42);
const over = done.filter((r) => r.days > 56);
const daysSorted = done.map((r) => r.days).sort((a, b) => a - b);

console.log(JSON.stringify({
  total: results.length,
  completed: done.length,
  unfinished: unfinished.length,
  inTarget42to56: inTarget.length,
  under42: under.length,
  over56: over.length,
  min: daysSorted[0] ?? null,
  median: daysSorted.length ? daysSorted[Math.floor(daysSorted.length / 2)] : null,
  max: daysSorted.at(-1) ?? null,
  sampleInTarget: inTarget.slice(0, 5),
  sampleUnder: under.slice(0, 3),
  sampleOver: over.slice(0, 3),
}, null, 2));
