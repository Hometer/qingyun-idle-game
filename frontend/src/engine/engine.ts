import { CONFIG } from "./config";
import type {
  BuildingId,
  DailyCounters,
  DailyState,
  MapId,
  Milestone,
  RealmId,
  Resources,
  Result,
  SaveState,
  SpiritRoot,
  TechniqueId,
  TribulationLog,
  TribulationWave,
} from "./types";

export const SCHEMA_VERSION = 3;

// ---- 配置的类型化视图（便于用 string 键索引） ----

const REALMS = CONFIG.realms as unknown as ReadonlyArray<{
  id: string;
  name: string;
  cultivationCost: number;
  spiritCost: number;
}>;

const MAP_CFG = CONFIG.maps as unknown as Record<
  MapId,
  {
    name: string;
    nodes: Record<
      string,
      {
        name: string;
        gate: string;
        enemy: { attack: number; defense: number; hp: number };
        firstClear: { cultivation: number; spiritStone: number; page: number; equipment: string | null };
        repeat: { cultivation: number; page: number };
        suppressRate: number;
      }
    >;
  }
>;

const MAP_ORDER: MapId[] = ["map_qingyun", "map_nether"];

const EQUIP_CFG = CONFIG.equipment as unknown as Record<
  string,
  {
    name: string;
    slot: "weapon" | "armor" | "accessory";
    attack?: number;
    defense?: number;
    hp?: number;
    tribulationReduction?: number;
  }
>;

const ENC_CFG = CONFIG.encounters as unknown as Record<
  string,
  { title: string; options: Record<string, { label: string; meaning: string; reward: Partial<Resources> }> }
>;

type WeatherCfg = {
  name: string;
  desc: string;
  cultivationMult?: number;
  spiritMult?: number;
  herbMult?: number;
  spiritStoneMult?: number;
  battleAtkMult?: number;
};
const WEATHER_CFG = CONFIG.weathers as unknown as Record<string, WeatherCfg>;

const realmOrder: RealmId[] = ["qi1", "qi2", "qi3", "qi4", "foundation1"];

function realmIndex(realm: RealmId): number {
  return realmOrder.indexOf(realm);
}
function realmName(realm: RealmId): string {
  return REALMS[realmOrder.indexOf(realm)].name;
}

function todayStr(nowMs: number): string {
  const d = new Date(nowMs);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function validSpiritRoot(x: unknown): SpiritRoot {
  return (CONFIG.spiritRoots as readonly string[]).includes(x as string) ? (x as SpiritRoot) : "金";
}

function fail<T>(reason: string): Result<T> {
  return { ok: false, reason };
}

function pushMilestone(s: SaveState, type: string, time: number, text: string): void {
  s.milestones.push({ type, time, text });
}

const DAILY_QUEST_IDS = ["settle", "breakthrough", "battle", "suppress", "craft", "encounter"] as const;
const WEATHER_IDS = ["clear", "rain", "spirit_vein", "battle_mark", "none"] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function weatherOfDate(dateStr: string): string {
  return WEATHER_IDS[hashString(dateStr) % WEATHER_IDS.length];
}

export function rollDailyQuests(dateStr: string): string[] {
  const h = hashString(dateStr);
  const pool = [...DAILY_QUEST_IDS] as string[];
  const picked: string[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = (h + i * 7) % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function emptyDaily(dateStr: string): DailyState {
  return {
    date: dateStr,
    weather: weatherOfDate(dateStr),
    quests: rollDailyQuests(dateStr).map((id) => ({ id, done: false })),
    counters: { settle: 0, battle: 0, craft: 0, suppress: 0, breakthrough: 0, encounter: 0 },
  };
}

function ensureDaily(s: SaveState, nowMs: number): void {
  const today = todayStr(nowMs);
  if (s.daily.date !== today) s.daily = emptyDaily(today);
}

function applyReward(s: SaveState, reward: Partial<Resources>): void {
  if (reward.cultivation) s.resources.cultivation += reward.cultivation;
  if (reward.spirit) s.resources.spirit += reward.spirit;
  if (reward.spiritStone) s.resources.spiritStone += reward.spiritStone;
  if (reward.herb) s.resources.herb += reward.herb;
  if (reward.page) s.resources.page += reward.page;
}

function recordDailyEvent(s: SaveState, nowMs: number, event: keyof DailyCounters): void {
  ensureDaily(s, nowMs);
  s.daily.counters[event] += 1;
  for (const q of s.daily.quests) {
    if (q.done) continue;
    const cfg = CONFIG.dailyQuests[q.id as keyof typeof CONFIG.dailyQuests] as unknown as {
      title: string;
      target: number;
      reward: Partial<Resources>;
    };
    if (s.daily.counters[q.id as keyof DailyCounters] >= cfg.target) {
      q.done = true;
      applyReward(s, cfg.reward);
      pushMilestone(s, "daily", nowMs, `完成今日任务「${cfg.title}」`);
    }
  }
}

function applySuppressionExpiry(s: SaveState, nowMs: number): void {
  const durMs = CONFIG.suppressionDurationHours * 3600 * 1000;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodeId = s.suppression[mid];
    if (nodeId && s.suppressionSince[mid] > 0 && nowMs - s.suppressionSince[mid] >= durMs) {
      s.suppression[mid] = null;
      s.suppressionSince[mid] = 0;
      s.recentLogs.push(`${MAP_CFG[mid].nodes[nodeId].name}妖气复聚，镇压失效。`);
    }
  }
}

function battleStats(s: SaveState): { attack: number; defense: number; hp: number } {
  const stats = playerStats(s);
  const w = WEATHER_CFG[s.daily.weather];
  if (w?.battleAtkMult) return { ...stats, attack: Math.round(stats.attack * w.battleAtkMult) };
  return stats;
}

export function recordDailySettle(state: SaveState, nowMs: number): SaveState {
  const s = structuredClone(state);
  recordDailyEvent(s, nowMs, "settle");
  s.revision += 1;
  return s;
}

// ---- 新建 / 重置 ----

export function createGame(name: string, spiritRoot: SpiritRoot, nowMs = Date.now()): SaveState {
  const maps = {} as SaveState["maps"];
  for (const [mid, m] of Object.entries(CONFIG.maps)) {
    const nodes: Record<string, { unlocked: boolean; cleared: boolean }> = {};
    for (const nid of Object.keys((m as { nodes: object }).nodes)) {
      nodes[nid] = { unlocked: false, cleared: false };
    }
    maps[mid as MapId] = nodes;
  }
  // 仅第一张图的第一个节点初始解锁
  maps[MAP_ORDER[0]][Object.keys(MAP_CFG[MAP_ORDER[0]].nodes)[0]].unlocked = true;
  const state: SaveState = {
    schemaVersion: SCHEMA_VERSION,
    id: randomId(),
    name,
    spiritRoot: validSpiritRoot(spiritRoot),
    resources: { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0 },
    realm: "qi1",
    buildings: { cultivationRoom: 0, spiritArray: 0, spiritField: 0, alchemyFurnace: 0 },
    technique: null,
    techniqueLevel: { qingYun: 0, xuanGui: 0 },
    equipment: { weapon: CONFIG.initialEquipment, armor: null, accessory: null },
    inventory: { [CONFIG.initialEquipment]: 1, tribulationPill: 0 },
    preparedPill: false,
    maps,
    suppression: { map_qingyun: null, map_nether: null },
    encounter: { pending: null, triggeredToday: 0, lastTriggerDate: todayStr(nowMs), guideDone: false },
    tribulationLog: null,
    recentLogs: [`入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}。`],
    milestones: [{ type: "create", time: nowMs, text: `入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}` }],
    firsts: { settledOnce: false, suppressedFirstNodeOnce: false, viewedTribPreviewOnce: false },
    daily: emptyDaily(todayStr(nowMs)),
    suppressionSince: { map_qingyun: 0, map_nether: 0 },
    lastSettledAt: nowMs,
    revision: 0,
  };
  return state;
}

// ---- 属性与产出 ----

function buildingCultivationMult(s: SaveState): number {
  const lvl = s.buildings.cultivationRoom;
  return lvl >= 1 ? CONFIG.buildings.cultivationRoom.levels[lvl - 1].cultivationMult : 1;
}
function buildingSpiritMult(s: SaveState): number {
  const lvl = s.buildings.spiritArray;
  return lvl >= 1 ? CONFIG.buildings.spiritArray.levels[lvl - 1].spiritMult : 1;
}
function spiritFieldRate(s: SaveState): number {
  const lvl = s.buildings.spiritField;
  return lvl >= 1 ? CONFIG.buildings.spiritField.levels[lvl - 1].herbPerSec : 0;
}
function techniqueCultivationMult(s: SaveState): number {
  if (s.technique === "qingYun" && s.techniqueLevel.qingYun >= 1) {
    return CONFIG.techniques.qingYun.levels[s.techniqueLevel.qingYun - 1].cultivationMult;
  }
  return 1;
}
function suppressionRate(s: SaveState): number {
  let rate = 0;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodeId = s.suppression[mid];
    if (nodeId && MAP_CFG[mid].nodes[nodeId]) rate += MAP_CFG[mid].nodes[nodeId].suppressRate;
  }
  return rate;
}

export function playerStats(s: SaveState): { attack: number; defense: number; hp: number } {
  let attack = CONFIG.baseAttack;
  let defense = CONFIG.baseDefense;
  let hp = CONFIG.baseHp;
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const eqId = s.equipment[slot];
    if (eqId && EQUIP_CFG[eqId]) {
      const c = EQUIP_CFG[eqId];
      attack += c.attack ?? 0;
      defense += c.defense ?? 0;
      hp += c.hp ?? 0;
    }
  }
  return { attack, defense, hp };
}

function n1(x: number): string {
  if (Number.isInteger(x)) return String(x);
  const r = Math.round(x * 100) / 100;
  return String(r);
}

export interface ProductionBreakdown {
  cultivationPerSec: number;
  spiritPerSec: number;
  herbPerSec: number;
  spiritStonePerSec: number;
  lines: string[];
}

export function productionBreakdown(state: SaveState): ProductionBreakdown {
  const w = WEATHER_CFG[state.daily.weather];
  const cultBuilding = buildingCultivationMult(state);
  const cultTech = techniqueCultivationMult(state);
  const spiritBuilding = buildingSpiritMult(state);
  const herb = spiritFieldRate(state) * (w?.herbMult ?? 1);
  const stone = suppressionRate(state) * (w?.spiritStoneMult ?? 1);
  const cultivationPerSec = CONFIG.baseCultivationPerSecond * cultBuilding * cultTech * (w?.cultivationMult ?? 1);
  const spiritPerSec = CONFIG.baseSpiritPerSecond * spiritBuilding * (w?.spiritMult ?? 1);
  const lines: string[] = [
    `天时·${w?.name ?? "平常"}${w?.desc ? `：${w.desc}` : ""}`,
    `修为 ${n1(cultivationPerSec)}/秒（基础 ${n1(CONFIG.baseCultivationPerSecond)}${cultBuilding > 1 ? ` × 修炼室 ${n1(cultBuilding)}` : ""}${cultTech > 1 ? ` × 功法 ${n1(cultTech)}` : ""}${w?.cultivationMult ? ` × 天时 ${w.cultivationMult}` : ""}）`,
    `灵气 ${n1(spiritPerSec)}/秒（基础 ${n1(CONFIG.baseSpiritPerSecond)}${spiritBuilding > 1 ? ` × 聚灵阵 ${n1(spiritBuilding)}` : ""}${w?.spiritMult ? ` × 天时 ${w.spiritMult}` : ""}）`,
    herb > 0 ? `灵草 ${n1(herb)}/秒（灵田${w?.herbMult ? ` × 天时 ${w.herbMult}` : ""}）` : "灵草 0/秒（未建灵田）",
    stone > 0 ? `灵石 ${n1(stone)}/秒（镇压产出${w?.spiritStoneMult ? ` × 天时 ${w.spiritStoneMult}` : ""}）` : "灵石 0/秒（未镇压节点）",
  ];
  return { cultivationPerSec, spiritPerSec, herbPerSec: herb, spiritStonePerSec: stone, lines };
}

// ---- 时间结算 ----

export function settle(state: SaveState, nowMs: number): SaveState {
  const s = structuredClone(state);
  ensureDaily(s, nowMs);
  applySuppressionExpiry(s, nowMs);
  const capSec = CONFIG.offlineCapHours * 3600;
  const deltaSec = Math.max(0, Math.min((nowMs - s.lastSettledAt) / 1000, capSec));
  const cultMult = buildingCultivationMult(s) * techniqueCultivationMult(s);
  const spiritMult = buildingSpiritMult(s);
  s.resources.cultivation += CONFIG.baseCultivationPerSecond * cultMult * deltaSec;
  s.resources.spirit += CONFIG.baseSpiritPerSecond * spiritMult * deltaSec;
  s.resources.herb += spiritFieldRate(s) * deltaSec;
  s.resources.spiritStone += suppressionRate(s) * deltaSec;
  s.lastSettledAt = Math.max(s.lastSettledAt, nowMs);
  s.revision += 1;
  return s;
}

// ---- 小进阶 ----

export function breakthrough(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.realm === "foundation1") return fail("已至本版最高境界");
  const idx = realmIndex(s.realm);
  if (s.realm === "qi4") return fail("炼气圆满需渡劫方可筑基，请先查看劫势");
  const next = REALMS[idx + 1];
  if (!next) return fail("已至本版最高境界");
  if (s.resources.cultivation < next.cultivationCost || s.resources.spirit < next.spiritCost) {
    return fail("修为或灵气不足");
  }
  s.resources.cultivation -= next.cultivationCost;
  s.resources.spirit -= next.spiritCost;
  s.realm = next.id as RealmId;
  s.recentLogs.push(`闭关突破，晋入${next.name}。`);
  pushMilestone(s, "breakthrough", nowMs, `晋入${next.name}`);
  recordDailyEvent(s, nowMs, "breakthrough");
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 洞府 ----

export function upgradeBuilding(state: SaveState, nowMs: number, id: BuildingId): Result<SaveState> {
  const s = settle(state, nowMs);
  const lvl = s.buildings[id];
  if (lvl >= 3) return fail("已满级");
  const cfg = CONFIG.buildings[id].levels[lvl];
  if (s.resources.spiritStone < cfg.cost) return fail("灵石不足");
  s.resources.spiritStone -= cfg.cost;
  s.buildings[id] = lvl + 1;
  s.recentLogs.push(`洞府扩建，${CONFIG.buildings[id].name}升至${lvl + 1}级。`);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 功法与装备 ----

export function setTechnique(state: SaveState, nowMs: number, id: TechniqueId): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.technique === id) return fail("已是当前主修");
  s.technique = id;
  if (s.techniqueLevel[id] < 1) s.techniqueLevel[id] = 1;
  s.recentLogs.push(`改修${CONFIG.techniques[id].name}。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function upgradeTechnique(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const t = s.technique;
  if (!t) return fail("未装备功法");
  const lvl = s.techniqueLevel[t];
  if (lvl >= 3) return fail("功法已满级");
  const cost = CONFIG.techniques[t].levels[lvl].pageCost;
  if (s.resources.page < cost) return fail("残页不足");
  s.resources.page -= cost;
  s.techniqueLevel[t] = lvl + 1;
  s.recentLogs.push(`${CONFIG.techniques[t].name}精进至${lvl + 1}重。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function equipItem(state: SaveState, nowMs: number, equipId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const cfg = EQUIP_CFG[equipId];
  if (!cfg) return fail("无此装备");
  if (!(s.inventory[equipId] > 0)) return fail("未获得此装备");
  s.equipment[cfg.slot] = equipId;
  s.recentLogs.push(`佩戴${cfg.name}。`);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 炼丹与护劫丹 ----

export function craftPill(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const lvl = s.buildings.alchemyFurnace;
  if (lvl < 1) return fail("需先建炼丹炉");
  const c = CONFIG.buildings.alchemyFurnace.levels[lvl - 1];
  if (s.resources.herb < c.pillHerbCost || s.resources.spiritStone < c.pillStoneCost) {
    return fail("灵草或灵石不足");
  }
  s.resources.herb -= c.pillHerbCost;
  s.resources.spiritStone -= c.pillStoneCost;
  s.inventory.tribulationPill = (s.inventory.tribulationPill || 0) + 1;
  s.recentLogs.push("开炉炼丹，得护劫丹一枚。");
  recordDailyEvent(s, nowMs, "craft");
  s.revision += 1;
  return { state: s, ok: true };
}

export function togglePreparePill(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.preparedPill) {
    s.preparedPill = false;
    return { state: s, ok: true };
  }
  if ((s.inventory.tribulationPill || 0) < 1) return fail("无护劫丹可预置");
  s.preparedPill = true;
  return { state: s, ok: true };
}

// ---- 历练与战斗 ----

export interface FightOutcome {
  ok: boolean;
  reason: string;
  state: SaveState;
  log: string[];
  won: boolean;
  encounterTriggered: boolean;
}

function analyzeFailure(
  stats: { attack: number; defense: number; hp: number },
  enemy: { attack: number; defense: number; hp: number },
): string {
  const dmg = Math.max(1, stats.attack - enemy.defense);
  const taken = Math.max(1, enemy.attack - stats.defense);
  if (dmg <= 1) return `短板：攻击不足、无法破防（对方防御 ${enemy.defense}），建议更换更强武器。`;
  if (taken >= stats.hp / 3) return `短板：承伤过高（每击受 ${taken} 点），建议强化护甲与佩饰提升防御/气血。`;
  return `短板：输出不足（每击仅 ${dmg} 点），建议提升攻击或先通关可得装备的节点。`;
}

function unlockNext(s: SaveState, mapId: MapId, nodeId: string): void {
  const nodeIds = Object.keys(MAP_CFG[mapId].nodes);
  const i = nodeIds.indexOf(nodeId);
  if (i >= 0 && i + 1 < nodeIds.length) {
    s.maps[mapId][nodeIds[i + 1]].unlocked = true;
  } else if (i >= 0 && i + 1 >= nodeIds.length) {
    // 本图最后一个节点通关，解锁下一张图的第一个节点
    const mapIdx = MAP_ORDER.indexOf(mapId);
    if (mapIdx >= 0 && mapIdx + 1 < MAP_ORDER.length) {
      const nextMap = MAP_ORDER[mapIdx + 1];
      const nextFirst = Object.keys(MAP_CFG[nextMap].nodes)[0];
      s.maps[nextMap][nextFirst].unlocked = true;
    }
  }
}

function rollEncounter(s: SaveState, nowMs: number): boolean {
  const today = todayStr(nowMs);
  if (s.encounter.lastTriggerDate !== today) {
    s.encounter.lastTriggerDate = today;
    s.encounter.triggeredToday = 0;
  }
  if (s.encounter.triggeredToday >= CONFIG.encounter.dailyMax) return false;
  return Math.random() < CONFIG.encounter.probability;
}

function randomEventId(): string {
  const ids = Object.keys(ENC_CFG);
  return ids[Math.floor(Math.random() * ids.length)];
}

function triggerEncounter(s: SaveState, mapId: MapId, eventId: string): void {
  s.encounter.pending = { eventId, mapId };
  s.encounter.triggeredToday += 1;
}

function runBattle(
  stats: { attack: number; defense: number; hp: number },
  enemy: { attack: number; defense: number; hp: number },
): { won: boolean; log: string[] } {
  const log: string[] = [];
  let pHp = stats.hp;
  let eHp = enemy.hp;
  let playerTurn = true;
  let won = false;
  let guard = 0;
  while (guard++ < 100) {
    if (playerTurn) {
      const dmg = Math.max(1, stats.attack - enemy.defense);
      eHp -= dmg;
      log.push(`你出手，伤敌${dmg}点，敌余${Math.max(0, eHp)}气血。`);
      if (eHp <= 0) {
        won = true;
        break;
      }
    } else {
      const dmg = Math.max(1, enemy.attack - stats.defense);
      pHp -= dmg;
      log.push(`敌反击，伤你${dmg}点，你余${Math.max(0, pHp)}气血。`);
      if (pHp <= 0) break;
    }
    playerTurn = !playerTurn;
  }
  return { won, log };
}

export interface FightPrediction {
  ok: boolean;
  reason: string;
  won: boolean;
  log: string[];
  enemy: { attack: number; defense: number; hp: number };
  player: { attack: number; defense: number; hp: number };
}

export function predictFight(state: SaveState, mapId: MapId, nodeId: string): FightPrediction {
  const mapCfg = MAP_CFG[mapId];
  const nodeCfg = mapCfg?.nodes[nodeId];
  const nodeState = state.maps[mapId]?.[nodeId];
  const empty = { attack: 0, defense: 0, hp: 0 };
  if (!nodeCfg || !nodeState) return { ok: false, reason: "无此节点", won: false, log: [], enemy: empty, player: empty };
  if (!nodeState.unlocked) return { ok: false, reason: "节点未解锁", won: false, log: [], enemy: empty, player: empty };
  if (realmIndex(state.realm) < realmIndex(nodeCfg.gate as RealmId)) {
    return { ok: false, reason: `需${realmName(nodeCfg.gate as RealmId)}方可挑战`, won: false, log: [], enemy: empty, player: empty };
  }
  const stats = battleStats(state);
  const battle = runBattle(stats, nodeCfg.enemy);
  return { ok: true, reason: "", won: battle.won, log: battle.log, enemy: { ...nodeCfg.enemy }, player: stats };
}

export function fightNode(state: SaveState, nowMs: number, mapId: MapId, nodeId: string): FightOutcome {
  const s = settle(state, nowMs);
  const mapCfg = MAP_CFG[mapId];
  const nodeCfg = mapCfg?.nodes[nodeId];
  const nodeState = s.maps[mapId]?.[nodeId];
  if (!nodeCfg || !nodeState) return { ok: false, reason: "无此节点", state: s, log: [], won: false, encounterTriggered: false };
  if (!nodeState.unlocked) return { ok: false, reason: "节点未解锁", state: s, log: [], won: false, encounterTriggered: false };
  if (realmIndex(s.realm) < realmIndex(nodeCfg.gate as RealmId)) {
    return { ok: false, reason: `需${realmName(nodeCfg.gate as RealmId)}方可挑战`, state: s, log: [], won: false, encounterTriggered: false };
  }

  const stats = battleStats(s);
  const battle = runBattle(stats, nodeCfg.enemy);
  const log = battle.log;
  const won = battle.won;
  recordDailyEvent(s, nowMs, "battle");

  if (!won) {
    log.push(analyzeFailure(stats, nodeCfg.enemy));
    s.recentLogs.push(`与${nodeCfg.name}交手，不敌落败。`);
    s.revision += 1;
    return { ok: true, reason: "战败", state: s, log, won: false, encounterTriggered: false };
  }

  const first = !nodeState.cleared;
  nodeState.cleared = true;
  if (first) {
    const fc = nodeCfg.firstClear;
    s.resources.cultivation += fc.cultivation;
    s.resources.spiritStone += fc.spiritStone;
    s.resources.page += fc.page;
    if (fc.equipment) {
      s.inventory[fc.equipment] = 1;
      s.recentLogs.push(`得装备「${EQUIP_CFG[fc.equipment].name}」。`);
    }
    s.recentLogs.push(`首通${mapCfg.name}·${nodeCfg.name}。`);
    pushMilestone(s, "firstClear", nowMs, `首通${mapCfg.name}·${nodeCfg.name}`);
    unlockNext(s, mapId, nodeId);
  } else {
    const rc = nodeCfg.repeat;
    s.resources.cultivation += rc.cultivation;
    s.resources.page += rc.page;
    s.recentLogs.push(`再胜${nodeCfg.name}。`);
  }

  let encounterTriggered = false;
  const isGuide = mapId === CONFIG.encounter.guideMapId && nodeId === CONFIG.encounter.guideNodeId;
  if (first && isGuide && !s.encounter.guideDone) {
    triggerEncounter(s, mapId, CONFIG.encounter.guideEventId);
    s.encounter.guideDone = true;
    encounterTriggered = true;
  } else if (rollEncounter(s, nowMs)) {
    triggerEncounter(s, mapId, randomEventId());
    encounterTriggered = true;
  }

  s.revision += 1;
  return { ok: true, reason: "", state: s, log, won: true, encounterTriggered };
}

export function setSuppression(state: SaveState, nowMs: number, mapId: MapId, nodeId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const nodeState = s.maps[mapId]?.[nodeId];
  if (!nodeState) return fail("无此节点");
  if (!nodeState.cleared) return fail("需先通关该节点");
  s.suppression[mapId] = nodeId;
  s.suppressionSince[mapId] = nowMs;
  const supText = `于${MAP_CFG[mapId].name}镇压${MAP_CFG[mapId].nodes[nodeId].name}`;
  s.recentLogs.push(`${supText}，得其产出。`);
  pushMilestone(s, "suppress", nowMs, supText);
  if (mapId === "map_qingyun" && nodeId === Object.keys(MAP_CFG.map_qingyun.nodes)[0]) {
    s.firsts.suppressedFirstNodeOnce = true;
  }
  recordDailyEvent(s, nowMs, "suppress");
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 际遇 ----

export function resolveEncounter(state: SaveState, nowMs: number, optionId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const pending = s.encounter.pending;
  if (!pending) return fail("无待处理的际遇");
  const evt = ENC_CFG[pending.eventId];
  if (!evt) return fail("未知际遇");
  const opt = evt.options[optionId];
  if (!opt) return fail("无效选项");
  const r = opt.reward;
  if (r.cultivation) s.resources.cultivation += r.cultivation;
  if (r.spirit) s.resources.spirit += r.spirit;
  if (r.spiritStone) s.resources.spiritStone += r.spiritStone;
  if (r.herb) s.resources.herb += r.herb;
  if (r.page) s.resources.page += r.page;
  s.encounter.pending = null;
  s.recentLogs.push(`际遇「${evt.title}」已定，选择「${opt.label}」。`);
  pushMilestone(s, "encounter", nowMs, `际遇「${evt.title}」`);
  recordDailyEvent(s, nowMs, "encounter");
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 天劫 ----

export interface ReductionSource {
  name: string;
  pct: number;
}

export function tribulationReductionInfo(state: SaveState): { reduction: number; sources: ReductionSource[] } {
  const sources: ReductionSource[] = [];
  if (state.technique === "xuanGui" && state.techniqueLevel.xuanGui >= 1) {
    sources.push({
      name: CONFIG.techniques.xuanGui.name,
      pct: CONFIG.techniques.xuanGui.levels[state.techniqueLevel.xuanGui - 1].tribulationReduction,
    });
  }
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const eqId = state.equipment[slot];
    if (eqId && EQUIP_CFG[eqId]?.tribulationReduction) {
      sources.push({ name: EQUIP_CFG[eqId].name, pct: EQUIP_CFG[eqId].tribulationReduction as number });
    }
  }
  const sum = sources.reduce((a, x) => a + x.pct, 0);
  return { reduction: Math.min(CONFIG.tribulation.reductionCap, sum), sources };
}

export interface TribulationSim {
  maxHp: number;
  reduction: number;
  sources: ReductionSource[];
  waves: TribulationWave[];
  pillHealed: { wave: number; amount: number } | null;
  success: boolean;
  log: string[];
}

export function simulateTribulation(state: SaveState): TribulationSim {
  const maxHp = playerStats(state).hp;
  const info = tribulationReductionInfo(state);
  const pill = state.preparedPill;
  let hp = maxHp;
  let success = true;
  const waves: TribulationWave[] = [];
  const log: string[] = [];
  let pillHealed: { wave: number; amount: number } | null = null;
  CONFIG.tribulation.wavesPct.forEach((pct, i) => {
    const dmg = Math.ceil(maxHp * pct * (1 - info.reduction));
    hp -= dmg;
    log.push(`第${i + 1}波天劫，伤${dmg}点，余${Math.max(0, hp)}气血。`);
    if (i + 1 === CONFIG.tribulation.pillWave && pill && hp > 0) {
      const healed = Math.round(maxHp * CONFIG.tribulation.pillHealPct);
      hp = Math.min(maxHp, hp + healed);
      pillHealed = { wave: i + 1, amount: healed };
      log.push(`护劫丹生效，回复${healed}点气血。`);
    }
    waves.push({ damage: dmg, hpAfter: Math.max(0, hp) });
    if (hp <= 0) success = false;
  });
  return { maxHp, reduction: info.reduction, sources: info.sources, waves, pillHealed, success, log };
}

export interface TribulationPreview {
  ok: boolean;
  reason: string;
  maxHp: number;
  reduction: number;
  sources: ReductionSource[];
  waves: TribulationWave[];
  pillHealed: { wave: number; amount: number } | null;
  success: boolean;
  pillPrepared: boolean;
}

export function previewTribulation(state: SaveState): TribulationPreview {
  if (state.realm !== "qi4") {
    return { ok: false, reason: "仅炼气圆满可渡劫", maxHp: 0, reduction: 0, sources: [], waves: [], pillHealed: null, success: false, pillPrepared: false };
  }
  const sim = simulateTribulation(state);
  return { ok: true, reason: "", maxHp: sim.maxHp, reduction: sim.reduction, sources: sim.sources, waves: sim.waves, pillHealed: sim.pillHealed, success: sim.success, pillPrepared: state.preparedPill };
}

export function startTribulation(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.realm !== "qi4") return fail("仅炼气圆满可渡劫");
  const idx = realmIndex("qi4");
  const next = REALMS[idx + 1];
  if (!next) return fail("渡劫门槛未配置");
  if (s.resources.cultivation < next.cultivationCost || s.resources.spirit < next.spiritCost) {
    return fail(`渡劫门槛未足（需修为${next.cultivationCost}、灵气${next.spiritCost}）`);
  }
  s.resources.cultivation -= next.cultivationCost;
  s.resources.spirit -= next.spiritCost;

  const sim = simulateTribulation(s);
  const pill = s.preparedPill;
  if (pill) s.inventory.tribulationPill = Math.max(0, (s.inventory.tribulationPill || 0) - 1);
  s.preparedPill = false;

  if (sim.success) {
    s.realm = "foundation1";
    s.recentLogs.push("五波天劫尽数扛下，于雷霆中筑基，晋入筑基一层。");
    pushMilestone(s, "tribulation", nowMs, "渡劫成功，晋入筑基一层");
  } else {
    s.recentLogs.push("渡劫失败，境界不动，可重新积累再试。");
    pushMilestone(s, "tribulation", nowMs, "渡劫失败");
  }
  s.tribulationLog = { maxHp: sim.maxHp, reduction: sim.reduction, pillUsed: pill, waves: sim.waves, success: sim.success, log: sim.log };
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 存档导入导出 ----

export function migrateSave(raw: SaveState): SaveState {
  const s = structuredClone(raw) as unknown as Record<string, unknown>;
  const firstNode = Object.keys(MAP_CFG.map_qingyun.nodes)[0];
  const suppression = (s.suppression ?? {}) as Record<string, unknown>;
  if (!Array.isArray(s.milestones)) s.milestones = [];
  if (!s.firsts || typeof s.firsts !== "object") {
    s.firsts = {
      settledOnce: false,
      suppressedFirstNodeOnce: suppression["map_qingyun"] === firstNode,
      viewedTribPreviewOnce: false,
    };
  }
  if (!s.daily || typeof s.daily !== "object") {
    s.daily = emptyDaily(todayStr(Date.now()));
  }
  if (!s.suppressionSince || typeof s.suppressionSince !== "object") {
    s.suppressionSince = { map_qingyun: 0, map_nether: 0 };
  }
  s.schemaVersion = SCHEMA_VERSION;
  return s as unknown as SaveState;
}

export function exportSave(state: SaveState): string {
  return JSON.stringify(state, null, 2);
}

const EQUIP_IDS = new Set(Object.keys(EQUIP_CFG));

function validateResources(v: unknown): string | null {
  if (!v || typeof v !== "object") return "资源数据缺失";
  const o = v as Record<string, unknown>;
  for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
    const x = o[k];
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return "资源数据无效";
  }
  return null;
}

function validateBuildings(v: unknown): string | null {
  const o = (v ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(CONFIG.buildings)) {
    const x = o[id];
    if (x !== undefined && (!Number.isInteger(x) || (x as number) < 0 || (x as number) > 3)) return "建筑等级无效";
  }
  return null;
}

function validateTechnique(tech: unknown, levels: unknown): string | null {
  if (tech !== null && tech !== undefined && !Object.keys(CONFIG.techniques).includes(tech as string)) return "功法无效";
  const o = (levels ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(CONFIG.techniques)) {
    const x = o[id];
    if (x !== undefined && (!Number.isInteger(x) || (x as number) < 0 || (x as number) > 3)) return "功法等级无效";
  }
  return null;
}

function validateEquipmentAndInventory(eq: unknown, inv: unknown): string | null {
  const e = (eq ?? {}) as Record<string, unknown>;
  for (const slot of ["weapon", "armor", "accessory"]) {
    const x = e[slot];
    if (x !== null && x !== undefined && !EQUIP_IDS.has(x as string)) return "装备无效";
  }
  const i = (inv ?? {}) as Record<string, unknown>;
  for (const [k, x] of Object.entries(i)) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return "库存数量无效";
    if (k !== "tribulationPill" && !EQUIP_IDS.has(k)) return "库存装备无效";
  }
  return null;
}

function validateMaps(maps: unknown, suppression: unknown): string | null {
  const m = (maps ?? {}) as Record<string, unknown>;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodes = m[mid];
    if (!nodes || typeof nodes !== "object") return "地图数据无效";
    const rec = nodes as Record<string, unknown>;
    for (const nid of Object.keys(MAP_CFG[mid].nodes)) {
      const ns = rec[nid] as Record<string, unknown> | undefined;
      if (ns && (typeof ns.unlocked !== "boolean" || typeof ns.cleared !== "boolean")) return "节点数据无效";
    }
  }
  const sup = (suppression ?? {}) as Record<string, unknown>;
  for (const [mid, nid] of Object.entries(sup)) {
    if (nid !== null && nid !== undefined && !MAP_CFG[mid as MapId]?.nodes[nid as string]) return "镇压节点无效";
  }
  return null;
}

function validateEncounter(v: unknown): string | null {
  const e = (v ?? {}) as Record<string, unknown>;
  const pending = e.pending as Record<string, unknown> | null | undefined;
  if (pending !== null && pending !== undefined) {
    if (!ENC_CFG[pending.eventId as string]) return "际遇事件无效";
  }
  return null;
}

function validateMilestonesAndFirsts(milestones: unknown, firsts: unknown): string | null {
  if (milestones !== undefined && !Array.isArray(milestones)) return "修仙录数据无效";
  if (firsts !== undefined) {
    const f = firsts as Record<string, unknown>;
    for (const k of ["settledOnce", "suppressedFirstNodeOnce", "viewedTribPreviewOnce"]) {
      if (f[k] !== undefined && typeof f[k] !== "boolean") return "首玩目标数据无效";
    }
  }
  return null;
}

export function importSave(json: string): Result<SaveState> {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return fail("文件不是有效 JSON");
  }
  if (!d || typeof d !== "object") return fail("存档结构无效");
  const o = d as Record<string, unknown>;
  const ver = o.schemaVersion;
  if (ver !== 1 && ver !== SCHEMA_VERSION) return fail(`存档版本不兼容（支持版本 1 或 ${SCHEMA_VERSION}）`);
  if (typeof o.name !== "string" || !o.name.trim()) return fail("存档缺少姓名");
  if (!realmOrder.includes(o.realm as RealmId)) return fail("境界无效");
  if (typeof o.lastSettledAt !== "number" || !Number.isFinite(o.lastSettledAt)) return fail("时间数据无效");

  const checks: Array<string | null> = [
    validateResources(o.resources),
    validateBuildings(o.buildings),
    validateTechnique(o.technique, o.techniqueLevel),
    validateEquipmentAndInventory(o.equipment, o.inventory),
    validateMaps(o.maps, o.suppression),
    validateEncounter(o.encounter),
    validateMilestonesAndFirsts(o.milestones, o.firsts),
  ];
  for (const c of checks) if (c) return fail(c);

  const s = normalizeSave(o);
  return { state: s, ok: true };
}

function normalizeSave(o: Record<string, unknown>): SaveState {
  const base = createGame(o.name as string, validSpiritRoot(o.spiritRoot), o.lastSettledAt as number);
  base.id = (o.id as string) || base.id;
  base.resources = { ...base.resources, ...(o.resources as Resources) };
  base.realm = o.realm as RealmId;
  base.buildings = { ...base.buildings, ...((o.buildings as Partial<SaveState["buildings"]>) || {}) };
  base.technique = (o.technique as TechniqueId | null) ?? null;
  base.techniqueLevel = { ...base.techniqueLevel, ...((o.techniqueLevel as Partial<SaveState["techniqueLevel"]>) || {}) };
  base.equipment = { ...base.equipment, ...((o.equipment as Partial<SaveState["equipment"]>) || {}) };
  base.inventory = { ...base.inventory, ...((o.inventory as Record<string, number>) || {}) };
  base.preparedPill = !!o.preparedPill;
  base.maps = { ...base.maps, ...((o.maps as Partial<SaveState["maps"]>) || {}) };
  base.suppression = { ...base.suppression, ...((o.suppression as Partial<SaveState["suppression"]>) || {}) };
  base.encounter = { ...base.encounter, ...((o.encounter as Partial<SaveState["encounter"]>) || {}) };
  base.tribulationLog = (o.tribulationLog as TribulationLog | null) ?? null;
  base.recentLogs = Array.isArray(o.recentLogs) ? (o.recentLogs as string[]).slice(-20) : base.recentLogs;
  base.milestones = Array.isArray(o.milestones) ? (o.milestones as Milestone[]) : [];
  base.firsts = { ...base.firsts, ...((o.firsts as Partial<SaveState["firsts"]>) || {}) };
  base.daily = (o.daily as DailyState) ?? emptyDaily(todayStr(Date.now()));
  base.suppressionSince = { map_qingyun: 0, map_nether: 0, ...((o.suppressionSince as Partial<SaveState["suppressionSince"]>) || {}) };
  base.lastSettledAt = o.lastSettledAt as number;
  base.revision = ((o.revision as number) || 0) + 1;
  return base;
}
