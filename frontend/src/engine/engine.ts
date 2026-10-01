import { CONFIG, combatScaleForStage, scaleCombatStats } from "./config";
import { MATERIAL_RESOURCES } from "./types";
import type {
  Affix,
  AptitudeId,
  BattleDifficulty,
  BattleRoundEvent,
  BreakthroughLayer,
  BreakthroughMethod,
  BreakthroughRecord,
  BuildingId,
  Commission,
  ContinuityStory,
  DailyState,
  LastBattle,
  LongTask,
  LongTaskDifficulty,
  LongTaskResult,
  LongTaskType,
  MapId,
  MeridianId,
  ComprehensionId,
  Milestone,
  RealmId,
  Resources,
  Result,
  SaveState,
  SecretRealmId,
  SpiritRoot,
  StoryId,
  TacticId,
  TechniqueId,
  TribulationLog,
  TribulationWave,
} from "./types";

export const SCHEMA_VERSION = 18;

// ---- 配置的类型化视图（便于用 string 键索引） ----

const REALMS = CONFIG.realms as unknown as ReadonlyArray<{
  id: string;
  stage: number;
  layer: number;
  name: string;
  cultivationCost: number;
  spiritCost: number;
  attack: number;
  defense: number;
  hp: number;
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
        side?: boolean;
      }
    >;
  }
>;

const MAP_ORDER: MapId[] = Object.keys(MAP_CFG) as MapId[];
export function mainNodeIds(mapId: MapId): string[] {
  return Object.keys(MAP_CFG[mapId].nodes).filter((nid) => !MAP_CFG[mapId].nodes[nid].side);
}

export function isBossNode(mapId: MapId, nodeId: string): boolean {
  return mainNodeIds(mapId).at(-1) === nodeId;
}
function emptySuppression(): Record<MapId, string | null> {
  return Object.fromEntries(MAP_ORDER.map((m) => [m, null])) as Record<MapId, string | null>;
}
function emptySuppressionSince(): Record<MapId, number> {
  return Object.fromEntries(MAP_ORDER.map((m) => [m, 0])) as Record<MapId, number>;
}
// map_yunling 在 schema v6 引入；v1~v5 旧档可缺失，v6 及以后缺失即坏档
const MAP_YUNLING_INTRO_VERSION = 6;
const MAP_JINDAN_INTRO_VERSION = 10; // v1.2 引入
// v10 的旧地图可能尚未包含 v1.2 扩展的中间节点。
const MAP_EXPANDED_VERSION = 11;
const REPEAT_REWARDS_INTRO_VERSION = 12;
const LEGACY_MISSING_NODES: Record<string, ReadonlySet<string>> = {
  map_nether: new Set(["node_wraith", "node_zombie", "node_specter"]),
  map_yunling: new Set(["node_stoneking", "node_lingyuan", "node_shanxiaowang"]),
};
// secretRealm 三字段在 schema v8 引入；v1~v7 旧档可缺失，v8 及以后缺失即坏档
const SECRET_REALM_INTRO_VERSION = 8;

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
  { minStage?: number; title: string; options: Record<string, { label: string; meaning: string; result?: string; reward?: Partial<Resources> }> }
>;

const CONTINUITY_CFG = CONFIG.continuity as unknown as {
  stories: Record<string, { originEventId: string; followUps: Record<string, string> }>;
};

const BATTLE_REPORT_CFG = CONFIG.battleReport as unknown as { maxEvents: number; maxKeyEvents: number };

const TACTIC_CFG = CONFIG.tactics as unknown as Record<
  TacticId,
  { name: string; damageMult: number; takenMult: number; note: string }
>;

const COMMISSION_CFG = CONFIG.commission as unknown as { fixedNpcName: string; dailyCandidates: number; rewardShare: number };

function followUpEventId(cont: ContinuityStory): string | null {
  return CONTINUITY_CFG.stories[cont.storyId]?.followUps[cont.originOptionId] ?? null;
}

function isContinuityOriginEvent(eventId: string): StoryId | null {
  for (const [sid, cfg] of Object.entries(CONTINUITY_CFG.stories)) {
    if (cfg.originEventId === eventId) return sid as StoryId;
  }
  return null;
}

function isFollowUpEvent(eventId: string): boolean {
  for (const cfg of Object.values(CONTINUITY_CFG.stories)) {
    if (Object.values(cfg.followUps).includes(eventId)) return true;
  }
  return false;
}

const LONG_TASK_CFG = CONFIG.longTask as unknown as {
  durations: readonly number[];
  multipliers: Record<number, number>;
  riskyMultiplier: number;
  protectionCost: number;
  protectionDefense: number;
  riskyEnemyMultiplier: number;
  seclusionRateFactor: number;
  ruleVersion: number;
};

const APTITUDE_CFG = CONFIG.aptitudes as unknown as Record<
  AptitudeId,
  { name: string; cultivationMult: number; spiritMult: number }
>;

const BREAKTHROUGH_CFG = CONFIG.breakthrough as unknown as {
  riskyBaseRate: number;
  riskyFailBoost: number;
  steadyCostMult: number;
  riskyFailCostMult: number;
};

const TRIAL_CFG = CONFIG.trials as unknown as Record<
  number,
  { name: string; description: string; wavesPct: readonly number[]; spiritStoneCost: number; gateMap: string | null }
>;

const SECRET_REALM_CFG = CONFIG.secretRealms as unknown as Record<
  SecretRealmId,
  { name: string; gate: string; enemy: { attack: number; defense: number; hp: number }; reward: Partial<Resources> }
>;

const SECRET_REALM_IDS = Object.keys(SECRET_REALM_CFG) as SecretRealmId[];
const LEGACY_SECRET_REALM_IDS: SecretRealmId[] = ["realm_herb", "realm_relic", "realm_deep"];
const SECRET_REALM_EXPANSION_VERSION = 13;

function emptySecretRealmUsed(): Record<SecretRealmId, boolean> {
  return Object.fromEntries(SECRET_REALM_IDS.map((id) => [id, false])) as Record<SecretRealmId, boolean>;
}

const FORGE_CFG = CONFIG.forge as unknown as { levels: Array<{ cost: { spiritStone: number; page: number } }> };
const IRON_CFG = CONFIG.iron as unknown as { suppressionPerSec: number; realmDrop: Record<SecretRealmId, number> };
const CRAFT_CFG = CONFIG.crafts as unknown as Record<string, { gate: RealmId; cost: Record<string, number> }>;

const GROWTH_GATES = CONFIG.growthGates as unknown as {
  cultivationRoom: Record<number, string>;
  spiritArray: Record<number, string>;
  spiritField: Record<number, string>;
  alchemyFurnace: Record<number, string>;
  library: Record<number, string>;
  forge: Record<number, string>;
  technique: Record<number, string>;
  furnacePage: Record<number, number>;
};
const CRAFT_FORGE_LEVEL = CONFIG.craftForgeLevel as unknown as Record<string, number>;
const MATERIAL_FORGE_LEVEL = CONFIG.materialForgeLevel as unknown as Record<string, number>;

function realmGateFail(realm: RealmId, gate: string): string | null {
  if (!gate) return null;
  return realmIndex(realm) >= realmIndex(gate as RealmId) ? null : `需${realmName(gate as RealmId)}`;
}
const MERIDIAN_CFG = CONFIG.meridians as unknown as Record<string, { name: string; probability: number; productionMult: number }>;
const COMPREHENSION_CFG = CONFIG.comprehensions as unknown as Record<string, { name: string; probability: number; pageMult: number }>;
const AFFIX_CFG = CONFIG.affixes as unknown as Record<string, { name: string; min: number; max: number; type: string; bias: string }> & { maxByStage: number[] };
const MATERIAL_CFG = CONFIG.materials as unknown as Record<
  string,
  { name: string; startStage: number; endStage: number; secretRealm: string }
>;
const RESOURCE_NAMES: Record<string, string> = {
  cultivation: "修为", spirit: "灵气", spiritStone: "灵石", herb: "灵草", page: "残页", iron: "玄铁",
  ...Object.fromEntries(Object.entries(MATERIAL_CFG).map(([id, cfg]) => [id, cfg.name])),
};

function materialForStage(stage: number): string | null {
  for (const [id, cfg] of Object.entries(MATERIAL_CFG)) {
    if (stage >= cfg.startStage && stage <= cfg.endStage) return id;
  }
  return null;
}

function stageOfGate(gate: string): number {
  const idx = realmIndex(gate as RealmId);
  return REALMS[idx]?.stage ?? 1;
}

function materialForSecretRealm(realmId: string): string | null {
  for (const [id, cfg] of Object.entries(MATERIAL_CFG)) {
    if (cfg.secretRealm === realmId) return id;
  }
  return null;
}

const realmOrder: RealmId[] = REALMS.map((r) => r.id as RealmId);
const BREAKTHROUGH_LAYERS: BreakthroughLayer[] = REALMS
  .filter((r, i) => r.layer < 10 && i + 1 < REALMS.length && REALMS[i + 1].stage === r.stage)
  .map((r) => r.id as BreakthroughLayer);
// 旧 schema（v≤9）境界 ID → 新体系。旧“圆满”对应新“十层”，旧筑基前缀 foundation→zhuji。
const OLD_REALM_TO_NEW: Record<string, string> = {
  qi4: "qi10",
  foundation1: "zhuji1",
  foundation2: "zhuji2",
  foundation3: "zhuji10",
};

// 旧 schema（v≤9）境界相关字段 → 新体系；新版（v10+）不再映射。
function migrateRealmRefs(o: Record<string, unknown>, ver: number): void {
  if (ver >= 10) return;
  const mapId = (id: unknown): string => {
    const str = typeof id === "string" ? id : "";
    return OLD_REALM_TO_NEW[str] ?? str;
  };
  if (typeof o.realm === "string") o.realm = mapId(o.realm);
  const fails = o.breakthroughFails;
  if (fails && typeof fails === "object" && !Array.isArray(fails)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fails as Record<string, unknown>)) out[mapId(k)] = v;
    o.breakthroughFails = out;
  }
  if (Array.isArray(o.breakthroughRecords)) {
    for (const r of o.breakthroughRecords as Array<Record<string, unknown>>) {
      if (r && typeof r === "object" && typeof r.layer === "string") r.layer = mapId(r.layer);
    }
  }
}

// 当前境界是否可小进阶（非本境圆满、非本版最高）
export function canBreakthrough(state: SaveState): boolean {
  const idx = realmIndex(state.realm);
  return idx >= 0 && idx < realmOrder.length - 1 && REALMS[idx].layer < 10;
}

// 当前境界是否需跨境试炼（本境十层、非最高境）
export function isTrialRealm(realm: RealmId): boolean {
  const idx = realmIndex(realm);
  return idx >= 0 && idx < realmOrder.length - 1 && REALMS[idx].layer === 10;
}

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

function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function validSpiritRoot(x: unknown): SpiritRoot {
  return (CONFIG.spiritRoots as readonly string[]).includes(x as string) ? (x as SpiritRoot) : "金";
}

function validAptitude(x: unknown): AptitudeId {
  return (Object.keys(APTITUDE_CFG) as string[]).includes(x as string) ? (x as AptitudeId) : "balanced";
}

function fail<T>(reason: string): Result<T> {
  return { ok: false, reason };
}

function pushMilestone(s: SaveState, type: string, time: number, text: string): void {
  s.milestones.push({ type, time, text });
}

const WEATHER_IDS = ["rain", "clear", "vein", "none"] as const;
const ASTROLOGY_IDS = ["lucky", "war", "none"] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function weatherOfDate(dateStr: string): string {
  return WEATHER_IDS[hashString("w" + dateStr) % WEATHER_IDS.length];
}

export function astrologyOfDate(dateStr: string): string {
  return ASTROLOGY_IDS[hashString("a" + dateStr) % ASTROLOGY_IDS.length];
}

function emptyDaily(dateStr: string): DailyState {
  return {
    date: dateStr,
    weather: { id: weatherOfDate(dateStr), used: false },
    astrology: { id: astrologyOfDate(dateStr), used: false },
    goals: {
      battle: { progress: 0, claimed: false },
      suppress: { progress: 0, claimed: false },
    },
    rewardedRepeats: 0,
    rewardedDan: 0,
  };
}

function ensureDaily(s: SaveState, nowMs: number): void {
  const today = todayStr(nowMs);
  if (today > s.daily.date) s.daily = emptyDaily(today); // 回拨不刷新
  ensureSecretRealm(s, nowMs);
}

function ensureSecretRealm(s: SaveState, nowMs: number): void {
  const today = todayStr(nowMs);
  if (today > s.secretRealmDate) {
    s.secretRealmDate = today;
    s.secretRealmUsed = emptySecretRealmUsed();
  }
}

// ---- 山河委托（v1.8） ----

function commissionProgress(s: SaveState, kind: Commission["kind"], match: (c: Commission) => boolean): void {
  const c = s.commission?.active;
  if (!c || c.kind !== kind || c.status !== "accepted") return;
  if (!match(c)) return;
  c.progress = Math.min(c.target, c.progress + 1);
  if (c.progress >= c.target) c.status = "ready";
}

function commissionRewards(s: SaveState): { a: Resources; b: Resources } {
  const prod = productionBreakdown(s);
  const share = COMMISSION_CFG.rewardShare;
  const day = 86400;
  const cult = Math.max(1, Math.round(prod.cultivationPerSec * day * share));
  const spirit = Math.max(1, Math.round(prod.spiritPerSec * day * share));
  const herb = Math.max(0, Math.round(prod.herbPerSec * day * share));
  const stone = Math.max(0, Math.round(prod.spiritStonePerSec * day * share));
  const a: Resources = { ...emptyResources(), cultivation: cult, spirit };
  const b: Resources = {
    ...emptyResources(),
    spiritStone: Math.max(1, stone + cult),
    herb: Math.max(1, herb + 1),
    page: Math.max(1, Math.round(cult / 5)),
  };
  return { a, b };
}

function makeCraftCommission(s: SaveState, id: string, title: string, action: string, actionParam: string | undefined): Commission {
  const r = commissionRewards(s);
  return {
    id,
    kind: "craft",
    title,
    action,
    actionParam,
    target: 1,
    progress: 0,
    rewardA: r.a,
    rewardB: r.b,
    status: "accepted",
  };
}

function clearedNodes(s: SaveState): Array<{ mid: MapId; nid: string }> {
  const out: Array<{ mid: MapId; nid: string }> = [];
  for (const mid of MAP_ORDER) {
    for (const nid of Object.keys(MAP_CFG[mid].nodes)) {
      if (s.maps[mid]?.[nid]?.cleared) out.push({ mid, nid });
    }
  }
  return out;
}

function battleCandidate(s: SaveState): Commission | null {
  const cleared = clearedNodes(s);
  if (cleared.length === 0) return null;
  const current = MAP_ORDER.slice().reverse().find((mid) => {
    const firstNode = mainNodeIds(mid)[0];
    return realmIndex(s.realm) >= realmIndex(MAP_CFG[mid].nodes[firstNode].gate as RealmId);
  });
  const preferred = cleared.filter((c) => c.mid === current);
  const pick = (preferred.length ? preferred : cleared)[0];
  const node = MAP_CFG[pick.mid].nodes[pick.nid];
  const r = commissionRewards(s);
  return {
    id: `battle:${pick.mid}:${pick.nid}`,
    kind: "battle",
    title: `在「${MAP_CFG[pick.mid].name}·${node.name}」赢得一场挑战`,
    mapId: pick.mid,
    nodeId: pick.nid,
    difficulty: "challenge",
    target: 1,
    progress: 0,
    rewardA: r.a,
    rewardB: r.b,
    status: "accepted",
  };
}

function craftCandidate(s: SaveState): Commission | null {
  if (s.forge >= 1) {
    const recipe = Object.entries(CRAFT_CFG).find(([, cfg]) => realmIndex(s.realm) >= realmIndex(cfg.gate as RealmId));
    if (recipe) {
      const id = recipe[0];
      return makeCraftCommission(s, `craft:craftEquipment:${id}`, `炼制 1 件「${EQUIP_CFG[id].name}」`, "craftEquipment", id);
    }
  }
  if (s.buildings.alchemyFurnace >= 1) {
    return makeCraftCommission(s, "craft:craftPill:1", "炼制 1 枚护劫丹", "craftPill", "1");
  }
  for (const bid of Object.keys(CONFIG.buildings) as BuildingId[]) {
    if (s.buildings[bid] < CONFIG.buildings[bid].levels.length) {
      return makeCraftCommission(s, `craft:upgradeBuilding:${bid}`, `升级 1 次「${CONFIG.buildings[bid].name}」`, "upgradeBuilding", bid);
    }
  }
  if (s.technique && s.techniqueLevel[s.technique] < CONFIG.techniques[s.technique].levels.length) {
    return makeCraftCommission(s, "craft:upgradeTechnique", `精进 1 次「${CONFIG.techniques[s.technique].name}」`, "upgradeTechnique", undefined);
  }
  for (const t of ["yangYuan", "juLing"] as const) {
    if (s.daily.rewardedDan >= 1) break; // 今日已服用，不生成无法当天完成的候选
    for (let tier = 1; tier <= 4; tier++) {
      const pillId = t === "yangYuan" ? `yangYuanDan_${tier}` : `juLingDan_${tier}`;
      if ((s.inventory[pillId] || 0) > 0) {
        return makeCraftCommission(s, `craft:useGainPill:${t}:${tier}`, `服用 1 枚${t === "yangYuan" ? "养元丹" : "聚灵丹"}`, "useGainPill", `${t}:${tier}`);
      }
    }
  }
  return null;
}

function generateCandidates(s: SaveState): Commission[] {
  const out: Commission[] = [];
  const battle = battleCandidate(s);
  if (battle) out.push(battle);
  const craft = craftCandidate(s) ?? battle;
  if (craft && !out.some((c) => c.id === craft.id)) out.push(craft);
  return out.slice(0, COMMISSION_CFG.dailyCandidates);
}

function ensureCommission(s: SaveState, nowMs: number): void {
  const today = todayStr(nowMs);
  if (!s.commission) s.commission = { date: "", candidates: [], active: null, history: [] };
  if (!(today > s.commission.date)) return; // 同日或回拨不重新生成
  s.commission.date = today;
  s.commission.candidates = generateCandidates(s);
}

function commissionResponse(c: Commission): string {
  const npc = COMMISSION_CFG.fixedNpcName;
  return c.kind === "battle"
    ? `${npc} 传话：这场仗打得漂亮，山河之间又少了一处隐患。`
    : `${npc} 传话：炉火已熄，这份心意我记下了，改日再叙。`;
}

// 候选在生成后被玩家手动完成（如把目标建筑升满）时可能不再可完成；接取前再验一次
function commissionCompletable(s: SaveState, c: Commission): boolean {
  if (c.kind === "battle") {
    return !!c.mapId && !!c.nodeId && !!s.maps[c.mapId]?.[c.nodeId]?.cleared;
  }
  switch (c.action) {
    case "upgradeBuilding": {
      const bid = c.actionParam as BuildingId | undefined;
      return !!bid && s.buildings[bid] !== undefined && s.buildings[bid] < CONFIG.buildings[bid].levels.length;
    }
    case "upgradeTechnique": {
      const t = s.technique;
      return !!t && s.techniqueLevel[t] < CONFIG.techniques[t].levels.length;
    }
    case "useGainPill": {
      if (s.daily.rewardedDan >= 1) return false; // 今日已服用，明日再来
      const [type, tier] = (c.actionParam ?? "").split(":");
      const pillId = type === "yangYuan" ? `yangYuanDan_${tier}` : `juLingDan_${tier}`;
      return (s.inventory[pillId] || 0) > 0;
    }
    default:
      return true; // craftEquipment / craftPill 等可重复动作
  }
}

export function acceptCommission(state: SaveState, nowMs: number, id: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const idx = s.commission.candidates.findIndex((c) => c.id === id);
  if (idx < 0) return fail("无此委托");
  if (s.commission.active) return fail("已有进行中的委托");
  const c = s.commission.candidates[idx];
  if (!commissionCompletable(s, c)) {
    s.commission.candidates = generateCandidates(s); // 目标已变化，刷新候选
    return fail("该委托目标已变化，已刷新候选，请重新选择");
  }
  c.status = "accepted";
  s.commission.active = c;
  s.commission.candidates = [];
  s.recentLogs.push(`接下委托「${c.title}」。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function claimCommission(state: SaveState, nowMs: number, choice: "a" | "b"): Result<SaveState> {
  const s = settle(state, nowMs);
  const c = s.commission.active;
  if (!c) return fail("无进行中的委托");
  if (c.status !== "ready") return fail("委托尚未完成");
  const reward = choice === "a" ? c.rewardA : c.rewardB;
  applyReward(s, reward);
  c.status = "claimed";
  c.rewardChoice = choice;
  c.claimedAt = nowMs;
  c.response = commissionResponse(c);
  s.commission.history.push(c);
  s.commission.active = null;
  s.recentLogs.push(`委托「${c.title}」完成，得${fmtReward(reward)}。`);
  pushMilestone(s, "commission", nowMs, `山河委托「${c.title}」完成`);
  s.revision += 1;
  return { state: s, ok: true };
}

function applyReward(s: SaveState, reward: Partial<Resources>): void {
  if (reward.cultivation) s.resources.cultivation += reward.cultivation;
  if (reward.spirit) s.resources.spirit += reward.spirit;
  if (reward.spiritStone) s.resources.spiritStone += reward.spiritStone;
  if (reward.herb) s.resources.herb += reward.herb;
  if (reward.page) s.resources.page += reward.page;
  if (reward.iron) s.resources.iron += reward.iron;
}

function battleDamageMult(s: SaveState): number {
  const war = !s.daily.astrology.used && s.daily.astrology.id === "war" ? 1.2 : 1;
  const gold = s.resonance === "金" ? 1 + resonanceStrength(s) : 1;
  const affix = 1 + affixSum(s, "damageMult");
  return war * gold * affix;
}

function battleTakenMult(s: SaveState): number {
  const earth = s.resonance === "土" ? 1 - resonanceStrength(s) : 1;
  const affix = Math.max(0.5, 1 - affixSum(s, "takenMult"));
  return earth * affix;
}

function battleMods(s: SaveState): { critRate: number; regen: number; lowHpBoost: number } {
  return { critRate: affixSum(s, "critRate"), regen: affixSum(s, "regen"), lowHpBoost: affixSum(s, "lowHpBoost") };
}

// 秘境伤害倍率：只吃装备“战斗伤害”词条，不受破军/金之共鸣等历练专属加成影响
function secretRealmDamageMult(s: SaveState): number {
  return 1 + affixSum(s, "damageMult");
}

// ---- 装备词条（v1.6）----
const AFFIX_IDS = Object.keys(CONFIG.affixes).filter((k) => k !== "maxByStage");

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function seededRng(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

function maxAffixesForStage(stage: number): number {
  if (stage < 2) return CONFIG.affixes.maxByStage[0];
  if (stage <= 7) return CONFIG.affixes.maxByStage[1];
  if (stage <= 15) return CONFIG.affixes.maxByStage[2];
  return CONFIG.affixes.maxByStage[3];
}

function currentStage(s: SaveState): number {
  return REALMS[realmIndex(s.realm)]?.stage ?? 1;
}

function randomAffixes(rng: () => number = Math.random, maxCount = 4): Affix[] {
  const count = Math.min(maxCount, 1 + Math.floor(rng() * maxCount)); // 1~maxCount 条
  const out: Affix[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < 100) {
    const id = AFFIX_IDS[Math.floor(rng() * AFFIX_IDS.length)];
    if (used.has(id)) continue;
    used.add(id);
    const cfg = AFFIX_CFG[id];
    const value = cfg.type === "flat"
      ? Math.round(cfg.min + rng() * (cfg.max - cfg.min))
      : Math.round((cfg.min + rng() * (cfg.max - cfg.min)) * 100) / 100;
    out.push({ id, value });
  }
  return out;
}

export function baseIdOf(s: SaveState, id: string): string {
  return s.itemInstances[id]?.baseId ?? id;
}

function instanceAffixes(s: SaveState, id: string): Affix[] {
  return s.itemInstances[id]?.affixes ?? [];
}

function makeInstanceId(instances: Record<string, { baseId: string; affixes: Affix[] }>, baseId: string): string {
  let n = 1;
  for (const inst of Object.values(instances)) {
    if (inst.baseId === baseId) n++;
  }
  return `${baseId}#${n}`;
}

function createInstance(s: SaveState, baseId: string, rng?: () => number): string {
  const instId = makeInstanceId(s.itemInstances, baseId);
  // 确定性种子：装备 ID 哈希 + 当前已生成实例数；每件实例独立、可复现
  const seed = hashSeed(baseId) + Object.keys(s.itemInstances).length + 1;
  s.itemInstances[instId] = {
    baseId,
    affixes: randomAffixes(rng ?? seededRng(seed), maxAffixesForStage(currentStage(s))),
  };
  s.inventory[instId] = 1;
  return instId;
}

function equippedAffixes(s: SaveState): Affix[] {
  const out: Affix[] = [];
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const id = s.equipment[slot];
    if (id) out.push(...instanceAffixes(s, id));
  }
  return out;
}

function affixSum(s: SaveState, id: string): number {
  return equippedAffixes(s).filter((a) => a.id === id).reduce((sum, a) => sum + a.value, 0);
}

export function reforgeCost(s: SaveState, itemId: string): { spiritStone: number; iron: number } {
  const mult = s.lockedAffixes[itemId] ? CONFIG.reforge.lockedCostMult : 1;
  return {
    spiritStone: Math.round(CONFIG.reforge.baseCost.spiritStone * mult),
    iron: Math.round(CONFIG.reforge.baseCost.iron * mult),
  };
}

export function reforgeEquipment(state: SaveState, nowMs: number, itemId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const inst = s.itemInstances[itemId];
  if (!inst) return fail("该装备暂无词条");
  const cost = reforgeCost(s, itemId);
  if (s.resources.spiritStone < cost.spiritStone || s.resources.iron < cost.iron) {
    return fail(`重铸需灵石${cost.spiritStone}、玄铁${cost.iron}`);
  }
  const baseId = inst.baseId;
  const lockedId = s.lockedAffixes[itemId];
  const locked = lockedId ? inst.affixes.find((a) => a.id === lockedId) : undefined;
  const seed = hashSeed(baseId) + s.revision + 1;
  const maxCount = maxAffixesForStage(currentStage(s));
  const newAffixes = randomAffixes(seededRng(seed), locked ? Math.max(1, maxCount - 1) : maxCount);
  const filtered = newAffixes.filter((a) => a.id !== lockedId);
  const oldAffixes = inst.affixes;
  const nextAffixes = locked ? [locked, ...filtered].slice(0, maxCount) : newAffixes;
  const fmt = (list: Affix[]) => list.map((a) => `${AFFIX_CFG[a.id]?.name ?? a.id}+${a.value}`).join("、") || "无";
  s.resources.spiritStone -= cost.spiritStone;
  s.resources.iron -= cost.iron;
  inst.affixes = nextAffixes;
  s.recentLogs.push(`重铸${EQUIP_CFG[baseId]?.name ?? baseId}词条：旧【${fmt(oldAffixes)}】→ 新【${fmt(nextAffixes)}】。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function lockAffix(state: SaveState, nowMs: number, itemId: string, affixId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const inst = s.itemInstances[itemId];
  if (!inst || !inst.affixes.some((a) => a.id === affixId)) return fail("该装备无此词条");
  if (s.lockedAffixes[itemId]) return fail("已锁定过一条词条");
  const cost = CONFIG.reforge.lockCost;
  if (s.resources.spiritStone < cost.spiritStone || s.resources.iron < cost.iron) {
    return fail(`锁定需灵石${cost.spiritStone}、玄铁${cost.iron}`);
  }
  s.lockedAffixes[itemId] = affixId;
  s.resources.spiritStone -= cost.spiritStone;
  s.resources.iron -= cost.iron;
  s.revision += 1;
  return { state: s, ok: true };
}

export function unlockAffix(state: SaveState, nowMs: number, itemId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  if (!s.lockedAffixes[itemId]) return fail("该装备未锁定词条");
  delete s.lockedAffixes[itemId];
  s.revision += 1;
  return { state: s, ok: true };
}

export function recordDailySettle(state: SaveState, nowMs: number): SaveState {
  const s = structuredClone(state);
  ensureDaily(s, nowMs);
  if (!s.daily.weather.used && s.daily.weather.id !== "none") {
    s.daily.weather.used = true;
    const cfg = CONFIG.weathers[s.daily.weather.id as keyof typeof CONFIG.weathers] as unknown as {
      reward?: Partial<Resources>;
    };
    applyReward(s, cfg.reward ?? {});
  }
  s.revision += 1;
  return s;
}

export function claimDailyGoal(state: SaveState, nowMs: number, goalId: "battle" | "suppress"): Result<SaveState> {
  const s = structuredClone(state);
  ensureDaily(s, nowMs);
  const goal = s.daily.goals[goalId];
  const cfg = CONFIG.dailyGoals[goalId];
  if (goal.claimed) return fail("已领取");
  if (goal.progress < cfg.target) return fail("目标未达成");
  goal.claimed = true;
  applyReward(s, cfg.reward);
  pushMilestone(s, "daily", nowMs, `领取今日目标「${cfg.title}」`);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 长期任务（持续历练 / 闭关） ----

function emptyResources(): Resources {
  return { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0, iron: 0, lingTaiJing: 0, yunHaiSui: 0, buXiuJin: 0, hunYuanYu: 0, taiChuZiJing: 0 };
}

function trainingReward(nodeCfg: { repeat: { cultivation: number; page: number } }, durationMinutes: number, difficulty: LongTaskDifficulty): Resources {
  const mult = LONG_TASK_CFG.multipliers[durationMinutes];
  const risky = difficulty === "risky" ? LONG_TASK_CFG.riskyMultiplier : 1;
  return {
    cultivation: Math.floor(nodeCfg.repeat.cultivation * mult * risky),
    spirit: 0,
    spiritStone: 0,
    herb: 0,
    page: Math.floor(nodeCfg.repeat.page * mult * risky),
    iron: 0,
    lingTaiJing: 0,
    yunHaiSui: 0,
    buXiuJin: 0,
    hunYuanYu: 0,
    taiChuZiJing: 0,
  };
}

function seclusionReward(cultivationPerSec: number, spiritPerSec: number, durationMinutes: number): Resources {
  const sec = durationMinutes * 60;
  const f = LONG_TASK_CFG.seclusionRateFactor;
  return {
    cultivation: Math.round(cultivationPerSec * sec * f * 10) / 10,
    spirit: Math.round(spiritPerSec * sec * f * 10) / 10,
    spiritStone: 0,
    herb: 0,
    page: 0,
    iron: 0,
    lingTaiJing: 0,
    yunHaiSui: 0,
    buXiuJin: 0,
    hunYuanYu: 0,
    taiChuZiJing: 0,
  };
}

export function canArrange(state: SaveState): boolean {
  return state.firsts.suppressedFirstNodeOnce;
}

export interface LongTaskPrediction {
  ok: boolean;
  reason: string;
  won?: boolean;
  playerAttack: number;
  playerDefense: number;
  playerHp: number;
  enemyAttack?: number;
  enemyDefense?: number;
  enemyHp?: number;
  reward: Resources;
  protectionCost: number;
}

export function predictLongTask(
  state: SaveState,
  type: LongTaskType,
  mapId: MapId,
  nodeId: string,
  difficulty: LongTaskDifficulty,
  durationMinutes: number,
  protection: boolean,
): LongTaskPrediction {
  const cost = protection ? LONG_TASK_CFG.protectionCost : 0;
  const base = playerStats(state);
  const failPred = (reason: string): LongTaskPrediction => ({
    ok: false, reason, playerAttack: base.attack, playerDefense: base.defense, playerHp: base.hp,
    reward: emptyResources(), protectionCost: cost,
  });

  if (!canArrange(state)) return failPred("需先镇压首个节点方可安排任务");

  if (type === "seclusion") {
    const prod = productionBreakdown(state);
    return {
      ok: true, reason: "", playerAttack: base.attack, playerDefense: base.defense, playerHp: base.hp,
      reward: seclusionReward(prod.cultivationPerSec, prod.spiritPerSec, durationMinutes), protectionCost: cost,
    };
  }

  const nodeCfg = MAP_CFG[mapId]?.nodes[nodeId];
  const nodeState = state.maps[mapId]?.[nodeId];
  if (!nodeCfg || !nodeState) return failPred("无此节点");
  if (!nodeState.cleared) return failPred("需先首通该节点");
  if (realmIndex(state.realm) < realmIndex(nodeCfg.gate as RealmId)) {
    return failPred(`需${realmName(nodeCfg.gate as RealmId)}境界`);
  }
  const stage = REALMS[realmIndex(state.realm)]?.stage ?? 1;
  const protectionDefense = Math.round(LONG_TASK_CFG.protectionDefense * combatScaleForStage(stage));
  const defense = base.defense + (protection ? protectionDefense : 0);
  const enemy = difficulty === "risky"
    ? {
        attack: Math.ceil(nodeCfg.enemy.attack * LONG_TASK_CFG.riskyEnemyMultiplier),
        defense: Math.ceil(nodeCfg.enemy.defense * LONG_TASK_CFG.riskyEnemyMultiplier),
        hp: Math.ceil(nodeCfg.enemy.hp * LONG_TASK_CFG.riskyEnemyMultiplier),
      }
    : { ...nodeCfg.enemy };
  const battle = runBattle({ attack: base.attack, defense, hp: base.hp }, enemy, 1);
  return {
    ok: true, reason: "", won: battle.won,
    playerAttack: base.attack, playerDefense: defense, playerHp: base.hp,
    enemyAttack: enemy.attack, enemyDefense: enemy.defense, enemyHp: enemy.hp,
    reward: trainingReward(nodeCfg, durationMinutes, difficulty), protectionCost: cost,
  };
}

export interface StartLongTaskParams {
  type: LongTaskType;
  mapId?: MapId;
  nodeId?: string;
  difficulty?: LongTaskDifficulty;
  durationMinutes: number;
  protection: boolean;
}

export function startLongTask(state: SaveState, nowMs: number, params: StartLongTaskParams): Result<SaveState> {
  const s = structuredClone(state);
  if (s.longTask) return fail("已有进行中的任务，请先领取或中止");
  if (!canArrange(s)) return fail("需先镇压首个节点方可安排任务");
  const duration = params.durationMinutes;
  if (!(LONG_TASK_CFG.durations as readonly number[]).includes(duration)) return fail("无效时长");
  const mapId = params.mapId ?? "map_qingyun";
  const nodeId = params.nodeId ?? "";
  const difficulty = params.difficulty ?? "steady";
  const pred = predictLongTask(s, params.type, mapId, nodeId, difficulty, duration, params.protection);
  if (!pred.ok) return fail(pred.reason);
  if (params.type === "training" && !pred.won) return fail("预计难胜，无法开始");
  const cost = params.protection ? LONG_TASK_CFG.protectionCost : 0;
  if (cost > 0 && s.resources.spiritStone < cost) return fail(`灵石不足（需 ${cost}）`);
  if (cost > 0) s.resources.spiritStone -= cost;
  const prod = productionBreakdown(s);
  const effectiveMinutes = s.resonance === "风" ? Math.max(1, Math.ceil(duration * CONFIG.resonance.windTimeMult)) : duration;
  s.longTask = {
    id: randomId(),
    type: params.type,
    mapId: params.type === "training" ? mapId : undefined,
    nodeId: params.type === "training" ? nodeId : undefined,
    difficulty,
    protectionUsed: params.protection,
    durationMinutes: duration,
    effectiveMinutes,
    startAt: nowMs,
    endAt: nowMs + effectiveMinutes * 60 * 1000,
    ruleVersion: LONG_TASK_CFG.ruleVersion,
    snapshot: {
      playerAttack: pred.playerAttack,
      playerDefense: pred.playerDefense,
      playerHp: pred.playerHp,
      cultivationPerSec: prod.cultivationPerSec,
      spiritPerSec: prod.spiritPerSec,
      enemyAttack: pred.enemyAttack,
      enemyDefense: pred.enemyDefense,
      enemyHp: pred.enemyHp,
      expectedReward: pred.reward,
    },
  };
  s.recentLogs.push(`安排${params.type === "training" ? "持续历练" : "闭关"}（${duration} 分钟）。`);
  s.revision += 1;
  return { state: s, ok: true };
}

function taskNodeName(task: LongTask): string | undefined {
  if (!task.mapId || !task.nodeId) return undefined;
  return MAP_CFG[task.mapId]?.nodes[task.nodeId]?.name;
}

export function claimLongTask(state: SaveState, nowMs: number): Result<SaveState> {
  const s = structuredClone(state);
  const task = s.longTask;
  if (!task) return fail("无进行中的任务");
  if (nowMs < task.endAt) return fail("任务尚未到期");
  const reward = task.snapshot.expectedReward;
  applyReward(s, reward);
  s.lastLongTaskResult = {
    taskId: task.id, type: task.type, nodeName: taskNodeName(task),
    difficulty: task.difficulty, durationMinutes: task.durationMinutes,
    reward, completedAt: nowMs, aborted: false,
  };
  s.longTask = null;
  pushMilestone(s, "longtask", nowMs, `领取${task.type === "training" ? "持续历练" : "闭关"}结果`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function abortLongTask(state: SaveState, nowMs: number): Result<SaveState> {
  const s = structuredClone(state);
  const task = s.longTask;
  if (!task) return fail("无进行中的任务");
  if (nowMs >= task.endAt) return fail("任务已到期，请领取");
  s.lastLongTaskResult = {
    taskId: task.id, type: task.type, nodeName: taskNodeName(task),
    difficulty: task.difficulty, durationMinutes: task.durationMinutes,
    reward: emptyResources(), completedAt: nowMs, aborted: true,
  };
  s.longTask = null;
  s.recentLogs.push("中止了进行中的任务。");
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 新建 / 重置 ----

export interface Fortune {
  spiritRoots: string[];
  meridians: MeridianId;
  comprehension: ComprehensionId;
}

function weightedPick(cfg: Record<string, { probability: number }>, rng: () => number): string {
  const r = rng();
  let acc = 0;
  for (const [id, c] of Object.entries(cfg)) {
    acc += c.probability;
    if (r < acc) return id;
  }
  return Object.keys(cfg)[0];
}

function randomCombination(elements: readonly string[], count: number, rng: () => number): string[] {
  const n = elements.length;
  const idx = Array.from({ length: count }, (_, i) => i);
  const combos: string[][] = [idx.map((i) => elements[i])];
  while (true) {
    let i = count - 1;
    while (i >= 0 && idx[i] === n - count + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < count; j++) idx[j] = idx[j - 1] + 1;
    combos.push(idx.map((x) => elements[x]));
  }
  return combos[Math.floor(rng() * combos.length)];
}

export function randomFortune(rng: () => number = Math.random): Fortune {
  const pool = CONFIG.spiritRootPool;
  const elements = pool.elements as readonly string[];
  let spiritRoots: string[];
  if (rng() < pool.variantProbability) {
    const variants = pool.variants as readonly string[];
    spiritRoots = [variants[Math.floor(rng() * variants.length)]];
  } else {
    const r = rng();
    let acc = 0;
    let count = 1;
    for (let i = 0; i < pool.formProbability.length; i++) {
      acc += pool.formProbability[i];
      if (r < acc) { count = 5 - i; break; }
    }
    spiritRoots = randomCombination(elements, count, rng);
  }
  const meridians = weightedPick(CONFIG.meridians as unknown as Record<string, { probability: number }>, rng) as MeridianId;
  const comprehension = weightedPick(CONFIG.comprehensions as unknown as Record<string, { probability: number }>, rng) as ComprehensionId;
  return { spiritRoots, meridians, comprehension };
}

export function createGameWithFortune(name: string, fortune: Fortune, aptitude: AptitudeId = "balanced", nowMs = Date.now()): SaveState {
  const first = fortune.spiritRoots[0] ?? "金";
  const legacyRoot = (CONFIG.spiritRoots as readonly string[]).includes(first) ? (first as SpiritRoot) : "金";
  const s = createGame(name, legacyRoot, aptitude, nowMs);
  s.spiritRoots = [...fortune.spiritRoots];
  s.meridians = fortune.meridians;
  s.comprehension = fortune.comprehension;
  const label = fortune.spiritRoots.join("、");
  s.recentLogs[0] = `入道青云，名「${name}」，灵根属${label}，${APTITUDE_CFG[aptitude].name}。`;
  s.milestones[0].text = s.recentLogs[0];
  return s;
}

export function createGame(name: string, spiritRoot: SpiritRoot, aptitude: AptitudeId = "balanced", nowMs = Date.now()): SaveState {
  const maps = {} as SaveState["maps"];
  for (const [mid, m] of Object.entries(CONFIG.maps)) {
    const nodes: Record<string, { unlocked: boolean; cleared: boolean }> = {};
    for (const nid of Object.keys((m as { nodes: object }).nodes)) {
      nodes[nid] = { unlocked: false, cleared: false };
    }
    maps[mid as MapId] = nodes;
  }
  // 仅第一张图的第一个节点初始解锁
  maps[MAP_ORDER[0]][mainNodeIds(MAP_ORDER[0])[0]].unlocked = true;
  for (const [nid, node] of Object.entries(MAP_CFG[MAP_ORDER[0]].nodes)) {
    if (node.side) maps[MAP_ORDER[0]][nid].unlocked = true;
  }
  const apt = validAptitude(aptitude);
  const state: SaveState = {
    schemaVersion: SCHEMA_VERSION,
    id: randomId(),
    name,
    spiritRoot: validSpiritRoot(spiritRoot),
    spiritRoots: [validSpiritRoot(spiritRoot)],
    meridians: "normal",
    comprehension: "normal",
    resonance: null,
    marrowHistory: [],
    itemInstances: {},
    lockedAffixes: {},
    aptitude: apt,
    resources: { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0, iron: 0, lingTaiJing: 0, yunHaiSui: 0, buXiuJin: 0, hunYuanYu: 0, taiChuZiJing: 0 },
    realm: "qi1",
    buildings: { cultivationRoom: 0, spiritArray: 0, spiritField: 0, alchemyFurnace: 0 },
    technique: null,
    techniqueLevel: { qingYun: 0, xuanGui: 0, poYue: 0, juYuan: 0, ningYing: 0, yunHai: 0, buXiu: 0, hunYuanGuiYi: 0, taiChu: 0 },
    equipment: { weapon: CONFIG.initialEquipment, armor: null, accessory: null },
    inventory: { [CONFIG.initialEquipment]: 1, tribulationPill: 0 },
    preparedPill: false,
    preparedPillTier: 1,
    quenched: [],
    learnedNewTechs: [],
    maps,
    suppression: emptySuppression(),
    encounter: { pending: null, triggeredToday: 0, lastTriggerDate: todayStr(nowMs), guideDone: false, continuity: null, completedStories: [] },
    tribulationLog: null,
    jindanTrial: null,
    yuanyingTrial: null,
    library: 0,
    auxiliaryTechnique: null,
    secretRealmDate: todayStr(nowMs),
    secretRealmUsed: emptySecretRealmUsed(),
    secretRealmLog: [],
    forge: 0,
    lastBattle: null,
    commission: { date: todayStr(nowMs), candidates: [], active: null, history: [] },
    recentLogs: [`入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}，资质${APTITUDE_CFG[apt].name}。`],
    milestones: [{ type: "create", time: nowMs, text: `入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}，资质${APTITUDE_CFG[apt].name}` }],
    firsts: { settledOnce: false, suppressedFirstNodeOnce: false, viewedTribPreviewOnce: false },
    daily: emptyDaily(todayStr(nowMs)),
    suppressionSince: emptySuppressionSince(),
    longTask: null,
    lastLongTaskResult: null,
    breakthroughFails: Object.fromEntries(BREAKTHROUGH_LAYERS.map((l) => [l, 0])) as Partial<Record<BreakthroughLayer, number>>,
    breakthroughRecords: [],
    lastSettledAt: nowMs,
    revision: 0,
  };
  state.commission.candidates = generateCandidates(state);
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
  const lvl = s.techniqueLevel.qingYun;
  let m = 1;
  if (lvl >= 1) {
    const lv = CONFIG.techniques.qingYun.levels[lvl - 1];
    if (s.technique === "qingYun") m = lv.cultivationMult;
    else if (s.auxiliaryTechnique === "qingYun") m = lv.auxCultivationMult;
  }
  const hy = newTechEffect(s, "hunYuanGuiYi", "cultivationMult");
  if (hy > 0) m *= hy;
  return m;
}

function techniqueSpiritMult(s: SaveState): number {
  const lvl = s.techniqueLevel.juYuan;
  let m = 1;
  if (lvl >= 1) {
    const lv = CONFIG.techniques.juYuan.levels[lvl - 1];
    if (s.technique === "juYuan") m = lv.spiritMult;
    else if (s.auxiliaryTechnique === "juYuan") m = lv.auxSpiritMult;
  }
  for (const id of ["ningYing", "hunYuanGuiYi"] as TechniqueId[]) {
    const v = newTechEffect(s, id, "spiritMult");
    if (v > 0) m *= v;
  }
  return m;
}

function techniqueAttackBonus(s: SaveState): number {
  const lvl = s.techniqueLevel.poYue;
  let a = 0;
  if (lvl >= 1) {
    const lv = CONFIG.techniques.poYue.levels[lvl - 1];
    if (s.technique === "poYue") a = lv.attack;
    else if (s.auxiliaryTechnique === "poYue") a = lv.auxAttack;
  }
  a += newTechEffect(s, "yunHai", "attack") + newTechEffect(s, "taiChu", "attack");
  return a;
}

function xuanGuiReduction(s: SaveState): number {
  const lvl = s.techniqueLevel.xuanGui;
  if (lvl < 1) return 0;
  const lv = CONFIG.techniques.xuanGui.levels[lvl - 1];
  if (s.technique === "xuanGui") return lv.tribulationReduction;
  if (s.auxiliaryTechnique === "xuanGui") return lv.auxTribulationReduction;
  return 0;
}

// 新功法效果：按主/辅取主修或辅修值
function newTechEffect(s: SaveState, id: TechniqueId, key: string): number {
  const lvl = s.techniqueLevel[id] ?? 0;
  if (lvl < 1) return 0;
  const lv = CONFIG.techniques[id].levels[lvl - 1] as unknown as Record<string, number>;
  if (s.technique === id) return lv[key] ?? 0;
  if (s.auxiliaryTechnique === id) return lv["aux" + key[0].toUpperCase() + key.slice(1)] ?? 0;
  return 0;
}

function techniqueDefenseBonus(s: SaveState): number {
  return newTechEffect(s, "yunHai", "defense");
}
function techniqueHpMult(s: SaveState): number {
  return 1 + newTechEffect(s, "ningYing", "hpMult") + newTechEffect(s, "buXiu", "hpMult");
}

function aptitudeCultivationMult(s: SaveState): number {
  return APTITUDE_CFG[s.aptitude]?.cultivationMult ?? 1;
}
function aptitudeSpiritMult(s: SaveState): number {
  return APTITUDE_CFG[s.aptitude]?.spiritMult ?? 1;
}
function meridianProductionMult(s: SaveState): number {
  return MERIDIAN_CFG[s.meridians]?.productionMult ?? 1;
}
function comprehensionPageMult(s: SaveState): number {
  return COMPREHENSION_CFG[s.comprehension]?.pageMult ?? 1;
}

function resonanceStrength(s: SaveState): number {
  if (!s.resonance) return 0;
  const n = s.spiritRoots.length;
  if (n === 1 && ["雷", "冰", "风"].includes(s.spiritRoots[0])) return CONFIG.resonance.variantStrength;
  return (CONFIG.resonance.strengths as unknown as Record<number, number>)[n] ?? 0;
}

export function availableResonances(s: SaveState): string[] {
  return s.spiritRoots;
}

export function setResonance(state: SaveState, nowMs: number, resonance: string | null): Result<SaveState> {
  const s = settle(state, nowMs);
  if (resonance !== null && !s.spiritRoots.includes(resonance)) return fail("该共鸣不属于当前灵根");
  s.resonance = resonance;
  s.revision += 1;
  return { state: s, ok: true };
}

const MERIDIAN_ORDER: MeridianId[] = ["blocked", "sluggish", "normal", "smooth", "innate"];
const COMPREHENSION_ORDER: ComprehensionId[] = ["dull", "slow", "normal", "clever", "genius"];

export function marrowTiersReached(s: SaveState): number {
  let count = 0;
  for (const tier of CONFIG.marrow.tiers) {
    if (realmIndex(s.realm) >= realmIndex(tier.realm as RealmId)) count++;
  }
  return count;
}

export function marrowCost(s: SaveState): { spiritStone: number; herb: number } | null {
  const used = s.marrowHistory.length;
  const reached = marrowTiersReached(s);
  if (used >= reached) return null;
  const tier = CONFIG.marrow.tiers[used];
  return { spiritStone: tier.spiritStone, herb: tier.herb };
}

export function marrow(state: SaveState, nowMs: number, choice: "meridian" | "comprehension" | "removeRoot", removeRoot?: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const cost = marrowCost(s);
  if (!cost) return fail("暂无可用洗髓机会");
  if (s.resources.spiritStone < cost.spiritStone || s.resources.herb < cost.herb) {
    return fail(`洗髓需灵石${cost.spiritStone}、灵草${cost.herb}`);
  }
  let from = "";
  let to = "";
  if (choice === "meridian") {
    const idx = MERIDIAN_ORDER.indexOf(s.meridians);
    if (idx >= MERIDIAN_ORDER.length - 1) return fail("经脉已至最高档");
    from = s.meridians;
    s.meridians = MERIDIAN_ORDER[idx + 1];
    to = s.meridians;
  } else if (choice === "comprehension") {
    const idx = COMPREHENSION_ORDER.indexOf(s.comprehension);
    if (idx >= COMPREHENSION_ORDER.length - 1) return fail("悟性已至最高档");
    from = s.comprehension;
    s.comprehension = COMPREHENSION_ORDER[idx + 1];
    to = s.comprehension;
  } else {
    if (s.spiritRoots.length <= 1) return fail("单灵根不能再减");
    if (s.spiritRoots.length === 1 && ["雷", "冰", "风"].includes(s.spiritRoots[0])) return fail("变异灵根不能移除");
    if (!removeRoot || !s.spiritRoots.includes(removeRoot)) return fail("请指定要移除的灵根");
    from = s.spiritRoots.join("、");
    s.spiritRoots = s.spiritRoots.filter((r) => r !== removeRoot);
    to = s.spiritRoots.join("、");
    if (s.resonance === removeRoot) s.resonance = null; // 移除正在共鸣的灵根时清空共鸣
  }
  s.resources.spiritStone -= cost.spiritStone;
  s.resources.herb -= cost.herb;
  s.marrowHistory.push({ type: choice, from, to, spiritStone: cost.spiritStone, herb: cost.herb, at: nowMs });
  s.revision += 1;
  return { state: s, ok: true };
}
function realmProductionMult(s: SaveState): number {
  const stage = REALMS[realmIndex(s.realm)]?.stage ?? 1;
  const cfg = CONFIG.realmProduction;
  return stage < cfg.startStage ? 1 : cfg.startMult * cfg.growthPerStage ** (stage - cfg.startStage);
}
function suppressionRate(s: SaveState): number {
  let rate = 0;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodeId = s.suppression[mid];
    if (nodeId && MAP_CFG[mid].nodes[nodeId]) rate += MAP_CFG[mid].nodes[nodeId].suppressRate;
  }
  return rate;
}

export function realmStatBonus(realm: RealmId): { attack: number; defense: number; hp: number } {
  const idx = realmIndex(realm);
  const r = REALMS[idx];
  if (!r) return { attack: 0, defense: 0, hp: 0 };
  return { attack: r.attack ?? 0, defense: r.defense ?? 0, hp: r.hp ?? 0 };
}

export function playerStats(s: SaveState): { attack: number; defense: number; hp: number } {
  let attack: number = CONFIG.baseAttack;
  let defense: number = CONFIG.baseDefense;
  let hp: number = CONFIG.baseHp;
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const eqId = s.equipment[slot];
    const baseId = eqId ? baseIdOf(s, eqId) : null;
    if (baseId && EQUIP_CFG[baseId]) {
      const c = EQUIP_CFG[baseId];
      const q = s.quenched?.includes(eqId as string) ? 1.05 : 1;
      attack += Math.floor((c.attack ?? 0) * q);
      defense += Math.floor((c.defense ?? 0) * q);
      hp += Math.floor((c.hp ?? 0) * q);
    }
  }
  const bonus = realmStatBonus(s.realm);
  attack += bonus.attack;
  defense += bonus.defense;
  hp += bonus.hp;
  attack += techniqueAttackBonus(s);
  defense += techniqueDefenseBonus(s);
  hp = Math.floor(hp * techniqueHpMult(s));
  attack += affixSum(s, "attack");
  defense += affixSum(s, "defense");
  hp += affixSum(s, "hp");
  return scaleCombatStats({ attack, defense, hp }, REALMS[realmIndex(s.realm)]?.stage ?? 1);
}

export interface TechniqueSummary {
  cultivationPerSec: number;
  spiritPerSec: number;
  attack: number;
  reduction: number;
}

export function buildSummary(state: SaveState): TechniqueSummary {
  const prod = productionBreakdown(state);
  const stats = playerStats(state);
  const tri = tribulationReductionInfo(state);
  return {
    cultivationPerSec: prod.cultivationPerSec,
    spiritPerSec: prod.spiritPerSec,
    attack: stats.attack,
    reduction: tri.reduction,
  };
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
  ironPerSec: number;
  lines: string[];
}

export function productionBreakdown(state: SaveState): ProductionBreakdown {
  const cultBuilding = buildingCultivationMult(state);
  const cultTech = techniqueCultivationMult(state);
  const cultApt = aptitudeCultivationMult(state);
  const spiritBuilding = buildingSpiritMult(state);
  const spiritTech = techniqueSpiritMult(state);
  const spiritApt = aptitudeSpiritMult(state);
  const realmMult = realmProductionMult(state);
  const aptName = APTITUDE_CFG[state.aptitude]?.name ?? "均衡";
  const herb = spiritFieldRate(state) * (state.resonance === "木" ? 1 + resonanceStrength(state) : 1);
  const stone = suppressionRate(state);
  const iron = suppressionRate(state) > 0 ? IRON_CFG.suppressionPerSec * Object.keys(state.suppression).filter((m) => state.suppression[m as MapId]).length : 0;
  const cultivationPerSec = CONFIG.baseCultivationPerSecond * cultBuilding * cultTech * cultApt * realmMult * meridianProductionMult(state) * (state.resonance === "火" ? 1 + resonanceStrength(state) : 1) * (1 + affixSum(state, "cultivationRate"));
  const spiritPerSec = CONFIG.baseSpiritPerSecond * spiritBuilding * spiritTech * spiritApt * realmMult * meridianProductionMult(state) * (state.resonance === "水" ? 1 + resonanceStrength(state) : 1) * (1 + affixSum(state, "spiritRate"));
  const w = CONFIG.weathers[state.daily.weather.id as keyof typeof CONFIG.weathers];
  const a = CONFIG.astrologies[state.daily.astrology.id as keyof typeof CONFIG.astrologies];
  const lines: string[] = [
    `天气·${w.name}：${w.desc}${state.daily.weather.used ? "（已用）" : ""}`,
    `星象·${a.name}：${a.desc}${state.daily.astrology.used ? "（已用）" : ""}`,
    `资质·${aptName}：修为 ×${n1(cultApt)}、灵气 ×${n1(spiritApt)}`,
    `修为 ${n1(cultivationPerSec)}/秒（基础 ${n1(CONFIG.baseCultivationPerSecond)} × 资质 ${n1(cultApt)}${cultBuilding > 1 ? ` × 修炼室 ${n1(cultBuilding)}` : ""}${cultTech > 1 ? ` × 功法 ${n1(cultTech)}` : ""}${realmMult > 1 ? ` × 境界 ${n1(realmMult)}` : ""}）`,
    `灵气 ${n1(spiritPerSec)}/秒（基础 ${n1(CONFIG.baseSpiritPerSecond)} × 资质 ${n1(spiritApt)}${spiritBuilding > 1 ? ` × 聚灵阵 ${n1(spiritBuilding)}` : ""}${spiritTech > 1 ? ` × 功法 ${n1(spiritTech)}` : ""}${realmMult > 1 ? ` × 境界 ${n1(realmMult)}` : ""}）`,
    herb > 0 ? `灵草 ${n1(herb)}/秒（灵田）` : "灵草 0/秒（未建灵田）",
    stone > 0 ? `灵石 ${n1(stone)}/秒（镇压产出）` : "灵石 0/秒（未镇压节点）",
    iron > 0 ? `玄铁 ${n1(iron)}/秒（镇压产出）` : "玄铁 0/秒（未镇压节点）",
  ];
  return { cultivationPerSec, spiritPerSec, herbPerSec: herb, spiritStonePerSec: stone, ironPerSec: iron, lines };
}

// ---- 时间结算 ----

export function settle(state: SaveState, nowMs: number): SaveState {
  const s = structuredClone(state);
  ensureDaily(s, nowMs);
  ensureCommission(s, nowMs);

  const capMs = CONFIG.offlineCapHours * 3600 * 1000;
  const from = s.lastSettledAt;
  const to = Math.min(nowMs, from + capMs);
  const deltaMs = Math.max(0, to - from);
  const deltaSec = deltaMs / 1000;

  const production = productionBreakdown(s);

  let spiritStoneGain = 0;
  let ironGain = 0;
  const durMs = CONFIG.suppressionDurationHours * 3600 * 1000;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodeId = s.suppression[mid];
    if (!nodeId) continue;
    const rate = MAP_CFG[mid].nodes[nodeId].suppressRate;
    const since = s.suppressionSince[mid] || 0;
    if (since <= 0) {
      spiritStoneGain += rate * deltaSec;
      ironGain += IRON_CFG.suppressionPerSec * deltaSec;
      continue;
    }
    const expiresAt = since + durMs;
    if (expiresAt <= from) {
      s.suppression[mid] = null;
      s.suppressionSince[mid] = 0;
      s.recentLogs.push(`${MAP_CFG[mid].nodes[nodeId].name}妖气复聚，镇压失效。`);
    } else if (expiresAt > to) {
      spiritStoneGain += rate * deltaSec;
      ironGain += IRON_CFG.suppressionPerSec * deltaSec;
    } else {
      spiritStoneGain += rate * (expiresAt - from) / 1000;
      ironGain += IRON_CFG.suppressionPerSec * (expiresAt - from) / 1000;
      s.suppression[mid] = null;
      s.suppressionSince[mid] = 0;
      s.recentLogs.push(`${MAP_CFG[mid].nodes[nodeId].name}妖气复聚，镇压失效。`);
    }
  }

  s.resources.cultivation += production.cultivationPerSec * deltaSec;
  s.resources.spirit += production.spiritPerSec * deltaSec;
  s.resources.herb += production.herbPerSec * deltaSec;
  s.resources.spiritStone += spiritStoneGain;
  s.resources.iron += ironGain;
  s.lastSettledAt = Math.max(s.lastSettledAt, nowMs);
  s.revision += 1;
  return s;
}

// ---- 小进阶 ----

export function breakthroughCosts(state: SaveState, method: BreakthroughMethod): { success: Resources; failure: Resources } {
  const layer = state.realm as BreakthroughLayer;
  const next = REALMS[realmIndex(layer) + 1];
  const full = { cultivation: next ? next.cultivationCost : 0, spirit: next ? next.spiritCost : 0 };
  const zero = emptyResources();
  if (method === "steady") {
    return {
      success: {
        ...zero,
        cultivation: Math.ceil(full.cultivation * BREAKTHROUGH_CFG.steadyCostMult),
        spirit: Math.ceil(full.spirit * BREAKTHROUGH_CFG.steadyCostMult),
      },
      failure: { ...zero },
    };
  }
  return {
    success: { ...zero, cultivation: full.cultivation, spirit: full.spirit },
    failure: {
      ...zero,
      cultivation: Math.ceil(full.cultivation * BREAKTHROUGH_CFG.riskyFailCostMult),
      spirit: Math.ceil(full.spirit * BREAKTHROUGH_CFG.riskyFailCostMult),
    },
  };
}

export function breakthroughSuccessRate(state: SaveState): number {
  const layer = state.realm as BreakthroughLayer;
  if (!BREAKTHROUGH_LAYERS.includes(layer)) return 1;
  return Math.min(1, BREAKTHROUGH_CFG.riskyBaseRate + BREAKTHROUGH_CFG.riskyFailBoost * (state.breakthroughFails?.[layer] ?? 0) + (state.resonance === "雷" ? CONFIG.resonance.thunderBoost : 0) + affixSum(state, "breakthroughBonus"));
}

export function breakthrough(state: SaveState, nowMs: number, method: BreakthroughMethod = "steady", rng: () => number = Math.random): Result<SaveState> {
  const s = settle(state, nowMs);
  const realmIdx = realmIndex(s.realm);
  const realmCfg = REALMS[realmIdx];
  if (realmIdx >= realmOrder.length - 1) return fail("已至本版最高境界");
  if (realmCfg.layer === 10) return fail("已至本境圆满，需挑战跨境试炼方可晋入下一境");
  const layer = s.realm as BreakthroughLayer;
  if (!BREAKTHROUGH_LAYERS.includes(layer)) return fail("当前境界不可小进阶");
  const next = REALMS[realmIdx + 1];
  if (!next) return fail("已至本版最高境界");

  const costs = breakthroughCosts(s, method);
  if (s.resources.cultivation < costs.success.cultivation || s.resources.spirit < costs.success.spirit) {
    return fail("修为或灵气不足");
  }
  const deduct = (r: Resources) => {
    s.resources.cultivation -= r.cultivation;
    s.resources.spirit -= r.spirit;
  };

  if (method === "risky") {
    const rate = breakthroughSuccessRate(s);
    if (rng() < rate) {
      deduct(costs.success);
      s.realm = next.id as RealmId;
      s.breakthroughFails[layer] = 0;
      s.breakthroughRecords.push({ layer, method, success: true, probability: rate, cost: { ...costs.success }, at: nowMs });
      s.recentLogs.push(`冲关成功，晋入${next.name}。`);
      pushMilestone(s, "breakthrough", nowMs, `冲关成功，晋入${next.name}（成功率 ${Math.round(rate * 100)}%）`);
    } else {
      deduct(costs.failure);
      s.breakthroughFails[layer] = Math.min(2, (s.breakthroughFails[layer] ?? 0) + 1);
      const nextRate = breakthroughSuccessRate(s);
      s.breakthroughRecords.push({ layer, method, success: false, probability: rate, cost: { ...costs.failure }, at: nowMs });
      s.recentLogs.push(`冲关失败，下次成功率 ${Math.round(nextRate * 100)}%。`);
      pushMilestone(s, "breakthrough", nowMs, `冲关晋入${next.name}失败（当次成功率 ${Math.round(rate * 100)}%，扣修为 ${costs.failure.cultivation}/灵气 ${costs.failure.spirit}，下次成功率 ${Math.round(nextRate * 100)}%）`);
    }
  } else {
    deduct(costs.success);
    s.realm = next.id as RealmId;
    s.breakthroughFails[layer] = 0;
    s.breakthroughRecords.push({ layer, method, success: true, probability: 1, cost: { ...costs.success }, at: nowMs });
    s.recentLogs.push(`稳妥进阶，晋入${next.name}。`);
    pushMilestone(s, "breakthrough", nowMs, `稳妥进阶，晋入${next.name}`);
  }
  if (s.realm !== layer) syncRealmMaps(s);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 洞府 ----

export function upgradeBuilding(state: SaveState, nowMs: number, id: BuildingId): Result<SaveState> {
  const s = settle(state, nowMs);
  const lvl = s.buildings[id];
  if (lvl >= CONFIG.buildings[id].levels.length) return fail("已满级");
  const gate = GROWTH_GATES[id]?.[lvl + 1]; // 升到下一级的境界门槛
  const gateFail = realmGateFail(s.realm, gate);
  if (gateFail) return fail(`${CONFIG.buildings[id].name}${gateFail}方可升级`);
  const cfg = CONFIG.buildings[id].levels[lvl];
  if (s.resources.spiritStone < cfg.cost) return fail("灵石不足");
  const pageCost = id === "alchemyFurnace" ? (GROWTH_GATES.furnacePage[lvl + 1] ?? 0) : 0;
  if (s.resources.page < pageCost) return fail(`残页不足（需${pageCost}）`);
  s.resources.spiritStone -= cfg.cost;
  if (pageCost > 0) s.resources.page -= pageCost;
  s.buildings[id] = lvl + 1;
  s.recentLogs.push(`洞府扩建，${CONFIG.buildings[id].name}升至${lvl + 1}级。`);
  commissionProgress(s, "craft", (c) => c.action === "upgradeBuilding" && c.actionParam === id);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 功法与装备 ----

// 新功法解锁要求（藏经阁等级 + 境界 + 首通本境首节点）
const NEW_TECH_REQUIREMENT: Record<string, { library: number; realm: RealmId; grantMap: MapId }> = {
  ningYing: { library: 3, realm: "yuanying1", grantMap: "map_yuanying" },
  yunHai: { library: 4, realm: "dacheng1", grantMap: "map_dacheng" },
  buXiu: { library: 5, realm: "jinxian1", grantMap: "map_jinxian" },
  hunYuanGuiYi: { library: 6, realm: "hunyuan_daluo1", grantMap: "map_hunyuan_daluo" },
  taiChu: { library: 7, realm: "dadao1", grantMap: "map_dadao" },
};

function newTechUnlocked(s: SaveState, id: TechniqueId): string | null {
  const req = NEW_TECH_REQUIREMENT[id];
  if (!req) return null;
  if (!s.learnedNewTechs.includes(id)) return "需首通本境首节点方可获得该功法";
  if (s.library < req.library) return `需${req.library}级藏经阁方可研习该功法`;
  if (realmIndex(s.realm) < realmIndex(req.realm)) return `需${realmName(req.realm)}方可研习该功法`;
  return null;
}

export function techniqueLockReason(s: SaveState, id: TechniqueId): string | null {
  if ((id === "poYue" || id === "juYuan") && s.library < 1) return "需一级藏经阁解锁";
  return newTechUnlocked(s, id);
}

export function setAptitude(state: SaveState, nowMs: number, aptitude: AptitudeId): Result<SaveState> {
  const s = settle(state, nowMs);
  if (!APTITUDE_CFG[aptitude]) return fail("无此修炼侧重");
  if (s.aptitude === aptitude) return fail("已是该修炼侧重");
  s.aptitude = aptitude;
  s.recentLogs.push(`转修${APTITUDE_CFG[aptitude].name}侧重。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function setTechnique(state: SaveState, nowMs: number, id: TechniqueId): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.technique === id) return fail("已是当前主修");
  const unlockFail = techniqueLockReason(s, id);
  if (unlockFail) return fail(unlockFail);
  const oldPrimary = s.technique;
  const oldAux = s.auxiliaryTechnique;
  if (oldAux === id) {
    // 把当前辅修改为主修 → 主辅互换
    s.technique = id;
    s.auxiliaryTechnique = oldPrimary;
  } else {
    s.technique = id;
  }
  const newlyLearned = s.techniqueLevel[id] < 1;
  if (newlyLearned) s.techniqueLevel[id] = 1;
  s.recentLogs.push(`改修${CONFIG.techniques[id].name}。`);
  if (newlyLearned) pushMilestone(s, "technique", nowMs, `研习${CONFIG.techniques[id].name}`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function setAuxiliaryTechnique(state: SaveState, nowMs: number, id: TechniqueId): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.library < 2) return fail("需先建二级藏经阁");
  const unlockFail = techniqueLockReason(s, id);
  if (unlockFail) return fail(unlockFail);
  if (!s.technique) return fail("需先主修功法");
  if (s.auxiliaryTechnique === id) return fail("已是当前辅修");
  const wasNull = s.auxiliaryTechnique === null;
  if (s.technique === id) {
    if (!s.auxiliaryTechnique) return fail("主辅不能为同一本");
    // 把当前主修设为辅修 → 主辅互换
    const oldAux = s.auxiliaryTechnique;
    s.auxiliaryTechnique = id;
    s.technique = oldAux;
  } else {
    s.auxiliaryTechnique = id;
  }
  if (s.techniqueLevel[id] < 1) s.techniqueLevel[id] = 1;
  s.recentLogs.push(`辅修${CONFIG.techniques[id].name}。`);
  if (wasNull) pushMilestone(s, "technique", nowMs, `首次采用辅修${CONFIG.techniques[id].name}`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function buildLibrary(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.library >= CONFIG.library.levels.length) return fail("藏经阁已满级");
  const gate = GROWTH_GATES.library[s.library + 1] ?? "zhuji1";
  const gateFail = realmGateFail(s.realm, gate);
  if (gateFail) return fail(`藏经阁${gateFail}方可升级`);
  const cfg = CONFIG.library.levels[s.library];
  if (s.resources.spiritStone < cfg.cost.spiritStone || s.resources.page < cfg.cost.page) {
    return fail(`藏经阁升级需灵石${cfg.cost.spiritStone}、残页${cfg.cost.page}`);
  }
  s.resources.spiritStone -= cfg.cost.spiritStone;
  s.resources.page -= cfg.cost.page;
  s.library += 1;
  s.recentLogs.push(`藏经阁升至${s.library}级。`);
  pushMilestone(s, "library", nowMs, `藏经阁升至${s.library}级`);
  commissionProgress(s, "craft", (c) => c.action === "buildLibrary");
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 炼器（v1.0） ----

export function buildForge(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.forge >= CONFIG.forge.levels.length) return fail("炼器台已满级");
  const gate = GROWTH_GATES.forge[s.forge + 1] ?? "zhuji1";
  const gateFail = realmGateFail(s.realm, gate);
  if (gateFail) return fail(`炼器台${gateFail}方可升级`);
  const forgeCfg = FORGE_CFG.levels[s.forge];
  if (s.resources.spiritStone < forgeCfg.cost.spiritStone || s.resources.page < forgeCfg.cost.page) {
    return fail(`炼器台需灵石${forgeCfg.cost.spiritStone}、残页${forgeCfg.cost.page}`);
  }
  s.resources.spiritStone -= forgeCfg.cost.spiritStone;
  s.resources.page -= forgeCfg.cost.page;
  s.forge += 1;
  s.recentLogs.push("炼器台扩建，可炼制更高阶装备。");
  pushMilestone(s, "forge", nowMs, `炼器台升至${s.forge}级`);
  commissionProgress(s, "craft", (c) => c.action === "buildForge");
  s.revision += 1;
  return { state: s, ok: true };
}

export function craftEquipment(state: SaveState, nowMs: number, id: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const cfg = CRAFT_CFG[id];
  if (!cfg) return fail("无此配方");
  if (!EQUIP_CFG[id]) return fail("无此装备");
  if (s.forge < 1) return fail("需先建炼器台");
  const forgeNeed = CRAFT_FORGE_LEVEL[id] ?? 1;
  if (s.forge < forgeNeed) return fail(`需${forgeNeed}级炼器台方可炼制`);
  if (realmIndex(s.realm) < realmIndex(cfg.gate)) return fail(`需${realmName(cfg.gate)}方可炼制`);
  const cost = cfg.cost;
  const res = s.resources as unknown as Record<string, number>;
  const short: string[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if (v > 0 && res[k] < v) short.push(`${RESOURCE_NAMES[k] ?? k}${v}`);
  }
  if (short.length > 0) return fail(`材料不足（需${short.join("、")}）`);
  for (const [k, v] of Object.entries(cost)) {
    if (v > 0) res[k] -= v;
  }
  createInstance(s, id); // 只创建独立实例，不再双写基础 ID 库存
  s.recentLogs.push(`炼得${EQUIP_CFG[id].name}。`);
  pushMilestone(s, "craft", nowMs, `炼得${EQUIP_CFG[id].name}`);
  commissionProgress(s, "craft", (c) => c.action === "craftEquipment" && c.actionParam === id);
  s.revision += 1;
  return { state: s, ok: true };
}

export function quenchEquipment(state: SaveState, nowMs: number, equipId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const eq = EQUIP_CFG[baseIdOf(s, equipId)];
  if (!eq) return fail("无此装备");
  const craft = CRAFT_CFG[baseIdOf(s, equipId)];
  if (!craft) return fail("此装备不可淬炼");
  if (s.quenched.includes(equipId)) return fail("已淬炼过该装备");
  const owned = (s.inventory[equipId] || 0) > 0 || s.equipment.weapon === equipId || s.equipment.armor === equipId || s.equipment.accessory === equipId;
  if (!owned) return fail("未拥有此装备");
  const iron = Math.ceil((craft.cost.iron ?? 0) * 0.25);
  const stone = Math.ceil((craft.cost.spiritStone ?? 0) * 0.25);
  const mat = materialForStage(stageOfGate(craft.gate as string));
  if (mat) {
    const forgeNeed = MATERIAL_FORGE_LEVEL[mat] ?? 1;
    if (s.forge < forgeNeed) return fail(`需${forgeNeed}级炼器台方可淬炼`);
  }
  const res = s.resources as unknown as Record<string, number>;
  if ((res.iron ?? 0) < iron || (res.spiritStone ?? 0) < stone || (mat && (res[mat] ?? 0) < 2)) {
    return fail("淬炼材料不足");
  }
  res.iron -= iron;
  res.spiritStone -= stone;
  if (mat) res[mat] -= 2;
  s.quenched = [...s.quenched, equipId];
  s.recentLogs.push(`淬炼${eq.name}，属性提升。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function upgradeTechnique(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const t = s.technique;
  if (!t) return fail("未装备功法");
  if ((t === "poYue" || t === "juYuan") && s.library < 1) return fail("需先建一级藏经阁");
  const lvl = s.techniqueLevel[t];
  if (lvl >= CONFIG.techniques[t].levels.length) return fail("功法已满级");
  const gate = GROWTH_GATES.technique[lvl + 1];
  const gateFail = realmGateFail(s.realm, gate);
  if (gateFail) return fail(`功法精进${gateFail}方可`);
  const cost = Math.floor(CONFIG.techniques[t].levels[lvl].pageCost * comprehensionPageMult(s) + 0.5);
  if (s.resources.page < cost) return fail("残页不足");
  s.resources.page -= cost;
  s.techniqueLevel[t] = lvl + 1;
  s.recentLogs.push(`${CONFIG.techniques[t].name}精进至${lvl + 1}重。`);
  pushMilestone(s, "technique", nowMs, `${CONFIG.techniques[t].name}精进至${lvl + 1}重`);
  commissionProgress(s, "craft", (c) => c.action === "upgradeTechnique");
  s.revision += 1;
  return { state: s, ok: true };
}

export function equipItem(state: SaveState, nowMs: number, equipId: string): Result<SaveState> {
  const s = settle(state, nowMs);
  const cfg = EQUIP_CFG[baseIdOf(s, equipId)];
  if (!cfg) return fail("无此装备");
  if (!(s.inventory[equipId] > 0)) return fail("未获得此装备");
  s.equipment[cfg.slot] = equipId;
  s.recentLogs.push(`佩戴${cfg.name}。`);
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 炼丹与护劫丹 ----

export function craftPill(state: SaveState, nowMs: number, tier = 1): Result<SaveState> {
  const s = settle(state, nowMs);
  const lvl = s.buildings.alchemyFurnace;
  if (lvl < 1) return fail("需先建炼丹炉");
  if (tier === 1) {
    const c = CONFIG.buildings.alchemyFurnace.levels[lvl - 1];
    if (s.resources.herb < c.pillHerbCost || s.resources.spiritStone < c.pillStoneCost) {
      return fail("灵草或灵石不足");
    }
    s.resources.herb -= c.pillHerbCost;
    s.resources.spiritStone -= c.pillStoneCost;
    s.inventory.tribulationPill = (s.inventory.tribulationPill || 0) + 1;
  } else {
    const needFurnace = tier === 2 ? 4 : tier === 3 ? 5 : 6;
    if (lvl < needFurnace) return fail(`需${needFurnace}级炼丹炉方可炼制该品护劫丹`);
    const herb = CONFIG.pills.tribulationHerb[tier - 1];
    const stone = CONFIG.pills.tribulationStone[tier - 1];
    const page = CONFIG.pills.tribulationPage[tier - 1];
    if (s.resources.herb < herb || s.resources.spiritStone < stone || s.resources.page < page) {
      return fail("灵草、灵石或残页不足");
    }
    s.resources.herb -= herb;
    s.resources.spiritStone -= stone;
    s.resources.page -= page;
    s.inventory[`tribulationPill_${tier}`] = (s.inventory[`tribulationPill_${tier}`] || 0) + 1;
  }
  const tierName = ["凡", "灵", "仙", "道"][tier - 1];
  s.recentLogs.push(`开炉炼丹，得护劫丹（${tierName}品）一枚。`);
  commissionProgress(s, "craft", (c) => c.action === "craftPill" && c.actionParam === String(tier));
  s.revision += 1;
  return { state: s, ok: true };
}

export function craftGainPill(state: SaveState, nowMs: number, type: "yangYuan" | "juLing", tier: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (tier === 1 && realmIndex(s.realm) < realmIndex("zhuji1")) return fail("需筑基一层方可炼制凡品收益丹");
  const needFurnace = CONFIG.pills.gainFurnaceLevel[tier - 1];
  if (s.buildings.alchemyFurnace < needFurnace) return fail(`需${needFurnace}级炼丹炉方可炼制该品丹药`);
  const herb = CONFIG.pills.gainHerb[tier - 1];
  const stone = CONFIG.pills.gainStone[tier - 1];
  const page = CONFIG.pills.gainPage[tier - 1];
  if (s.resources.herb < herb || s.resources.spiritStone < stone || s.resources.page < page) {
    return fail("灵草、灵石或残页不足");
  }
  s.resources.herb -= herb;
  s.resources.spiritStone -= stone;
  s.resources.page -= page;
  const pillId = type === "yangYuan" ? `yangYuanDan_${tier}` : `juLingDan_${tier}`;
  s.inventory[pillId] = (s.inventory[pillId] || 0) + 1;
  const tierName = ["凡", "灵", "仙", "道"][tier - 1];
  s.recentLogs.push(`开炉炼丹，得${type === "yangYuan" ? "养元丹" : "聚灵丹"}（${tierName}品）一枚。`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function useGainPill(state: SaveState, nowMs: number, type: "yangYuan" | "juLing", tier: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.daily.rewardedDan >= 1) return fail("今日收益丹已服用，明日再来");
  const pillId = type === "yangYuan" ? `yangYuanDan_${tier}` : `juLingDan_${tier}`;
  if ((s.inventory[pillId] || 0) < 1) return fail("无此丹药");
  const minutes = CONFIG.pills.gainMinutes[tier - 1];
  const prod = productionBreakdown(s);
  const perSec = type === "yangYuan" ? prod.cultivationPerSec : prod.spiritPerSec;
  const amount = Math.floor(perSec * minutes * 60);
  if (type === "yangYuan") s.resources.cultivation += amount;
  else s.resources.spirit += amount;
  s.inventory[pillId] -= 1;
  s.daily.rewardedDan += 1;
  s.recentLogs.push(`服下${type === "yangYuan" ? "养元丹" : "聚灵丹"}，得${type === "yangYuan" ? "修为" : "灵气"}${amount}。`);
  commissionProgress(s, "craft", (c) => c.action === "useGainPill" && c.actionParam === `${type}:${tier}`);
  s.revision += 1;
  return { state: s, ok: true };
}

export function togglePreparePill(state: SaveState, nowMs: number, tier = 1): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.preparedPill) {
    s.preparedPill = false;
    return { state: s, ok: true };
  }
  const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
  if ((s.inventory[pillId] || 0) < 1) return fail("无此品护劫丹可预置");
  s.preparedPill = true;
  s.preparedPillTier = tier;
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
  const nodeIds = mainNodeIds(mapId);
  const i = nodeIds.indexOf(nodeId);
  if (i < 0) return; // 支线首通不改变主线顺序。
  if (i >= 0 && i + 1 < nodeIds.length) {
    s.maps[mapId][nodeIds[i + 1]].unlocked = true;
    return;
  }
  // 跨图解锁仅 map_qingyun → map_nether；map_yunling 由境界解锁（见 syncYunlingUnlock），不在此处串图。
  if (mapId === "map_qingyun") {
    const first = mainNodeIds("map_nether")[0];
    s.maps.map_nether[first].unlocked = true;
    syncRealmMaps(s);
  }
}

function syncRealmMaps(s: SaveState): void {
  for (const mid of MAP_ORDER) {
    const first = mainNodeIds(mid)[0];
    if (mid !== "map_qingyun" && mid !== "map_nether") {
      const gate = MAP_CFG[mid].nodes[first].gate;
      if (realmIndex(s.realm) >= realmIndex(gate as RealmId) && s.maps[mid]?.[first]) {
        s.maps[mid][first].unlocked = true;
      }
    }
    if (s.maps[mid]?.[first]?.unlocked) {
      for (const [nid, node] of Object.entries(MAP_CFG[mid].nodes)) {
        if (node.side && realmIndex(s.realm) >= realmIndex(node.gate as RealmId)) {
          s.maps[mid][nid].unlocked = true;
        }
      }
    }
  }
}

function rollEncounterDay(s: SaveState, nowMs: number): void {
  const today = todayStr(nowMs);
  if (s.encounter.lastTriggerDate !== today) {
    s.encounter.lastTriggerDate = today;
    s.encounter.triggeredToday = 0;
  }
}

function rollEncounter(s: SaveState, nowMs: number): boolean {
  rollEncounterDay(s, nowMs);
  if (s.encounter.triggeredToday >= CONFIG.encounter.dailyMax) return false;
  return Math.random() < CONFIG.encounter.probability;
}

function randomEventId(s: SaveState): string {
  const stage = REALMS[realmIndex(s.realm)]?.stage ?? 1;
  const ids = Object.keys(ENC_CFG).filter((id) => {
    const min = ENC_CFG[id].minStage;
    return min !== undefined && min <= stage;
  });
  return ids[Math.floor(Math.random() * ids.length)];
}

function triggerEncounter(s: SaveState, mapId: MapId, eventId: string): void {
  s.encounter.pending = { eventId, mapId };
  s.encounter.triggeredToday += 1;
}

function runBattle(
  stats: { attack: number; defense: number; hp: number },
  enemy: { attack: number; defense: number; hp: number },
  dmgMult = 1,
  takenMult = 1,
  maxRounds = 50,
  mods: { critRate: number; regen: number; lowHpBoost: number } = { critRate: 0, regen: 0, lowHpBoost: 0 },
  rng: () => number = Math.random,
): { won: boolean; log: string[]; rounds: BattleRoundEvent[]; keyEvents: string[]; roundLimitReached: boolean } {
  const log: string[] = [];
  const rounds: BattleRoundEvent[] = [];
  const keyEvents: string[] = [];
  let pHp = stats.hp;
  let eHp = enemy.hp;
  let playerTurn = true;
  let won = false;
  let guard = 0;
  let round = 0;
  while (guard++ < maxRounds * 2) {
    if (playerTurn) {
      round += 1;
      if (mods.regen > 0 && pHp > 0) {
        const healed = Math.min(stats.hp - pHp, mods.regen);
        if (healed > 0) {
          pHp += healed;
          const text = `回血${healed}点，你余${pHp}气血。`;
          log.push(text);
          rounds.push({ round, actor: "player", kind: "regen", amount: healed, playerHpAfter: pHp, enemyHpAfter: Math.max(0, eHp), text, key: true });
          keyEvents.push(`第${round}回合回复 ${healed} 气血`);
        }
      }
      const isCrit = rng() < mods.critRate;
      const crit = isCrit ? 1.5 : 1;
      const lowHpBoostOn = mods.lowHpBoost > 0 && pHp < stats.hp * 0.3;
      const lowHp = lowHpBoostOn ? 1 + mods.lowHpBoost : 1;
      const dmg = Math.max(1, Math.round((stats.attack - enemy.defense) * dmgMult * crit * lowHp));
      eHp -= dmg;
      const eHpAfter = Math.max(0, eHp);
      const kind: BattleRoundEvent["kind"] = isCrit ? "crit" : "attack";
      const text = isCrit ? `你暴击，伤敌${dmg}点，敌余${eHpAfter}气血。` : `你出手，伤敌${dmg}点，敌余${eHpAfter}气血。`;
      log.push(text);
      rounds.push({ round, actor: "player", kind, amount: dmg, playerHpAfter: pHp, enemyHpAfter: eHpAfter, text, key: isCrit || lowHpBoostOn });
      if (isCrit) keyEvents.push(`第${round}回合暴击`);
      if (lowHpBoostOn) keyEvents.push(`第${round}回合低血增伤生效`);
      if (eHp <= 0) {
        won = true;
        break;
      }
    } else {
      const dmg = Math.max(1, Math.round((enemy.attack - stats.defense) * takenMult));
      pHp -= dmg;
      const pHpAfter = Math.max(0, pHp);
      const text = `敌反击，伤你${dmg}点，你余${pHpAfter}气血。`;
      log.push(text);
      rounds.push({ round, actor: "enemy", kind: "attack", amount: dmg, playerHpAfter: pHpAfter, enemyHpAfter: Math.max(0, eHp), text });
      if (pHp <= 0) break;
    }
    playerTurn = !playerTurn;
  }
  let roundLimitReached = false;
  if (!won && pHp > 0 && eHp > 0 && maxRounds < 50) {
    roundLimitReached = true;
    const text = `${maxRounds} 回合已到，挑战失败。`;
    log.push(text);
    rounds.push({ round, actor: "player", kind: "limit", amount: 0, playerHpAfter: Math.max(0, pHp), enemyHpAfter: Math.max(0, eHp), text, key: true });
    keyEvents.push(`${maxRounds} 回合已到`);
  }
  return { won, log, rounds, keyEvents, roundLimitReached };
}

function buildBattleReport(
  kind: "map" | "secret",
  mapName: string,
  enemyName: string,
  difficulty: string,
  tactic: TacticId,
  maxRounds: number,
  battle: { won: boolean; log: string[]; rounds: BattleRoundEvent[]; keyEvents: string[]; roundLimitReached: boolean },
  player: { attack: number; defense: number; hp: number },
  enemy: { attack: number; defense: number; hp: number },
  nowMs: number,
  rewardLines: string[],
  noRewardNote?: string,
): LastBattle {
  const last = battle.rounds[battle.rounds.length - 1];
  return {
    won: battle.won,
    kind,
    mapName,
    enemyName,
    difficulty,
    tactic,
    maxRounds,
    roundLimitReached: battle.roundLimitReached,
    rounds: last ? last.round : 0,
    player: { attack: player.attack, defense: player.defense, hp: player.hp, hpAfter: last ? last.playerHpAfter : player.hp },
    enemy: { attack: enemy.attack, defense: enemy.defense, hp: enemy.hp, hpAfter: last ? last.enemyHpAfter : enemy.hp },
    events: battle.rounds.slice(-BATTLE_REPORT_CFG.maxEvents),
    keyEvents: battle.keyEvents.slice(-BATTLE_REPORT_CFG.maxKeyEvents),
    rewardLines,
    noRewardNote,
    at: nowMs,
  };
}

function fightRules(mapId: MapId, nodeId: string, difficulty: BattleDifficulty) {
  const node = MAP_CFG[mapId].nodes[nodeId];
  if (difficulty === "normal") return { enemy: { ...node.enemy }, reward: 1, maxRounds: 50 };
  const rule = isBossNode(mapId, nodeId) ? CONFIG.battleDifficulty.bossChallenge : CONFIG.battleDifficulty.challenge;
  return {
    enemy: {
      attack: Math.ceil(node.enemy.attack * rule.attack),
      defense: Math.ceil(node.enemy.defense * rule.defense),
      hp: Math.ceil(node.enemy.hp * rule.hp),
    },
    reward: rule.reward,
    maxRounds: isBossNode(mapId, nodeId) ? CONFIG.battleDifficulty.bossChallenge.maxRounds : 50,
  };
}

export function repeatRewardFor(mapId: MapId, nodeId: string, difficulty: BattleDifficulty = "normal") {
  const node = MAP_CFG[mapId].nodes[nodeId];
  const base = node.repeat;
  const factor = fightRules(mapId, nodeId, difficulty).reward;
  const raised = (value: number) => difficulty === "normal" || value === 0 ? value : Math.max(value + 1, Math.floor(value * factor));
  return { cultivation: raised(base.cultivation), page: raised(base.page), material: node.side ? null : materialForStage(stageOfGate(node.gate)) };
}

export interface FightPrediction {
  ok: boolean;
  reason: string;
  won: boolean;
  log: string[];
  enemy: { attack: number; defense: number; hp: number };
  player: { attack: number; defense: number; hp: number };
}

export function predictFight(state: SaveState, mapId: MapId, nodeId: string, difficulty: BattleDifficulty = "normal", tactic: TacticId = "normal"): FightPrediction {
  const mapCfg = MAP_CFG[mapId];
  const nodeCfg = mapCfg?.nodes[nodeId];
  const nodeState = state.maps[mapId]?.[nodeId];
  const empty = { attack: 0, defense: 0, hp: 0 };
  if (!nodeCfg || !nodeState) return { ok: false, reason: "无此节点", won: false, log: [], enemy: empty, player: empty };
  if (!nodeState.unlocked) return { ok: false, reason: "节点未解锁", won: false, log: [], enemy: empty, player: empty };
  if (realmIndex(state.realm) < realmIndex(nodeCfg.gate as RealmId)) {
    return { ok: false, reason: `需${realmName(nodeCfg.gate as RealmId)}方可挑战`, won: false, log: [], enemy: empty, player: empty };
  }
  if (difficulty === "challenge" && !nodeState.cleared) return { ok: false, reason: "需先普通首胜，方可挑战高难度", won: false, log: [], enemy: empty, player: empty };
  const stats = playerStats(state);
  const rules = fightRules(mapId, nodeId, difficulty);
  const t = difficulty === "challenge" ? TACTIC_CFG[tactic] : TACTIC_CFG.normal;
  const battle = runBattle(stats, rules.enemy, battleDamageMult(state) * t.damageMult, battleTakenMult(state) * t.takenMult, rules.maxRounds, battleMods(state));
  return { ok: true, reason: "", won: battle.won, log: battle.log, enemy: rules.enemy, player: stats };
}

export function fightNode(state: SaveState, nowMs: number, mapId: MapId, nodeId: string, difficulty: BattleDifficulty = "normal", tactic: TacticId = "normal"): FightOutcome {
  const s = settle(state, nowMs);
  const mapCfg = MAP_CFG[mapId];
  const nodeCfg = mapCfg?.nodes[nodeId];
  const nodeState = s.maps[mapId]?.[nodeId];
  if (!nodeCfg || !nodeState) return { ok: false, reason: "无此节点", state: s, log: [], won: false, encounterTriggered: false };
  if (!nodeState.unlocked) return { ok: false, reason: "节点未解锁", state: s, log: [], won: false, encounterTriggered: false };
  if (realmIndex(s.realm) < realmIndex(nodeCfg.gate as RealmId)) {
    return { ok: false, reason: `需${realmName(nodeCfg.gate as RealmId)}方可挑战`, state: s, log: [], won: false, encounterTriggered: false };
  }
  if (difficulty === "challenge" && !nodeState.cleared) return { ok: false, reason: "需先普通首胜，方可挑战高难度", state: s, log: [], won: false, encounterTriggered: false };

  const stats = playerStats(s);
  const dmgMult = battleDamageMult(s);
  const rules = fightRules(mapId, nodeId, difficulty);
  const t = difficulty === "challenge" ? TACTIC_CFG[tactic] : TACTIC_CFG.normal;
  const effTactic: TacticId = difficulty === "challenge" ? tactic : "normal";
  const battle = runBattle(stats, rules.enemy, dmgMult * t.damageMult, battleTakenMult(s) * t.takenMult, rules.maxRounds, battleMods(s));
  const log = battle.log;
  const won = battle.won;
  const rewardLines: string[] = [];
  let noRewardNote: string | undefined;
  s.daily.goals.battle.progress = Math.min(s.daily.goals.battle.progress + 1, CONFIG.dailyGoals.battle.target);
  if (!s.daily.astrology.used && s.daily.astrology.id !== "none") {
    if (s.daily.astrology.id === "war") {
      s.daily.astrology.used = true;
    } else if (s.daily.astrology.id === "lucky" && won) {
      s.daily.astrology.used = true;
      applyReward(s, CONFIG.astrologies.lucky.reward);
    }
  }

  if (!won) {
    log.push(analyzeFailure(stats, rules.enemy));
    s.recentLogs.push(`与${nodeCfg.name}交手，不敌落败。`);
    noRewardNote = "未获得奖励";
    s.lastBattle = buildBattleReport("map", mapCfg.name, nodeCfg.name, difficulty, effTactic, rules.maxRounds, battle, stats, rules.enemy, nowMs, rewardLines, noRewardNote);
    s.revision += 1;
    return { ok: true, reason: "战败", state: s, log, won: false, encounterTriggered: false };
  }

  const first = !nodeState.cleared;
  nodeState.cleared = true;
  const battleCult = affixSum(s, "battleCultivation");
  if (first) {
    const fc = nodeCfg.firstClear;
    s.resources.cultivation += fc.cultivation;
    if (battleCult > 0) s.resources.cultivation += battleCult;
    s.resources.spiritStone += fc.spiritStone;
    s.resources.page += fc.page;
    const mat = materialForStage(stageOfGate(nodeCfg.gate as string));
    if (mat && !nodeCfg.side) (s.resources as unknown as Record<string, number>)[mat] += 4;
    if (fc.equipment) {
      createInstance(s, fc.equipment as string);
      s.recentLogs.push(`得装备「${EQUIP_CFG[fc.equipment].name}」。`);
      rewardLines.push(`装备「${EQUIP_CFG[fc.equipment].name}」`);
    }
    if (fc.cultivation) rewardLines.push(`修为 ${fc.cultivation}`);
    if (battleCult > 0) rewardLines.push(`战斗修为 ${battleCult}`);
    if (fc.spiritStone) rewardLines.push(`灵石 ${fc.spiritStone}`);
    if (fc.page) rewardLines.push(`残页 ${fc.page}`);
    if (mat && !nodeCfg.side) rewardLines.push(`${RESOURCE_NAMES[mat]} 4`);
    s.recentLogs.push(`首通${mapCfg.name}·${nodeCfg.name}。`);
    pushMilestone(s, "firstClear", nowMs, `首通${mapCfg.name}·${nodeCfg.name}`);
    // 首通授予：新功法按本境首节点，鸿蒙印按终点守关
    for (const [techId, req] of Object.entries(NEW_TECH_REQUIREMENT)) {
      const firstNode = mainNodeIds(req.grantMap)[0];
      if (mapId === req.grantMap && nodeId === firstNode && !s.learnedNewTechs.includes(techId)) {
        s.learnedNewTechs.push(techId);
        s.recentLogs.push(`得新功法《${CONFIG.techniques[techId as TechniqueId].name}》。`);
        rewardLines.push(`功法《${CONFIG.techniques[techId as TechniqueId].name}》`);
      }
    }
    const hmLast = mainNodeIds("map_hongmeng").at(-1)!;
    if (mapId === "map_hongmeng" && nodeId === hmLast) {
      createInstance(s, "c_hongmeng");
      s.recentLogs.push("通关鸿蒙守关，得纪念佩饰「鸿蒙印」。");
      rewardLines.push("鸿蒙印");
    }
    unlockNext(s, mapId, nodeId);
  } else {
    const rc = repeatRewardFor(mapId, nodeId, difficulty);
    if (s.daily.rewardedRepeats < CONFIG.rewardedRepeatBattlesPerDay) {
      s.daily.rewardedRepeats += 1;
      s.resources.cultivation += rc.cultivation;
      if (battleCult > 0) s.resources.cultivation += battleCult;
      s.resources.page += rc.page;
      if (rc.material) (s.resources as unknown as Record<string, number>)[rc.material] += 1;
      if (rc.cultivation) rewardLines.push(`修为 ${rc.cultivation}`);
      if (battleCult > 0) rewardLines.push(`战斗修为 ${battleCult}`);
      if (rc.page) rewardLines.push(`残页 ${rc.page}`);
      if (rc.material) rewardLines.push(`${RESOURCE_NAMES[rc.material]} 1`);
      s.recentLogs.push(`再胜${nodeCfg.name}，领取今日重复历练奖励。`);
    } else {
      s.recentLogs.push(`再胜${nodeCfg.name}，今日重复历练奖励已领尽。`);
      noRewardNote = "本次无重复奖励";
    }
  }

  if (first && !s.commission.active) {
    s.commission.candidates = generateCandidates(s); // 首胜后即时刷新候选（补入战斗候选）
  }

  let encounterTriggered = false;
  const isGuide = mapId === CONFIG.encounter.guideMapId && nodeId === CONFIG.encounter.guideNodeId;
  if (!s.encounter.pending) {
    rollEncounterDay(s, nowMs);
    if (first && isGuide && !s.encounter.guideDone) {
      triggerEncounter(s, mapId, CONFIG.encounter.guideEventId);
      s.encounter.guideDone = true;
      encounterTriggered = true;
    } else {
      const cont = s.encounter.continuity;
      if (cont && cont.stage === "awaiting" && todayStr(nowMs) > cont.originDate) {
        const fId = followUpEventId(cont);
        if (fId && s.encounter.triggeredToday < CONFIG.encounter.dailyMax) {
          triggerEncounter(s, mapId, fId);
          cont.stage = "active";
          encounterTriggered = true;
        }
      } else if (rollEncounter(s, nowMs)) {
        triggerEncounter(s, mapId, randomEventId(s));
        encounterTriggered = true;
      }
    }
  }

  s.lastBattle = buildBattleReport("map", mapCfg.name, nodeCfg.name, difficulty, effTactic, rules.maxRounds, battle, stats, rules.enemy, nowMs, rewardLines, noRewardNote);
  commissionProgress(s, "battle", (c) => c.mapId === mapId && c.nodeId === nodeId && (c.difficulty ?? "normal") === difficulty);
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
  if (mapId === "map_qingyun" && nodeId === mainNodeIds("map_qingyun")[0]) {
    s.firsts.suppressedFirstNodeOnce = true;
  }
  s.daily.goals.suppress.progress = Math.min(s.daily.goals.suppress.progress + 1, CONFIG.dailyGoals.suppress.target);
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

  // 连续际遇后续事件：纯叙事，不发奖励，记录「起因—选择—回响」
  if (isFollowUpEvent(pending.eventId)) {
    const cont = s.encounter.continuity;
    if (!cont || cont.stage !== "active") return fail("无对应的连续际遇");
    const originEvt = ENC_CFG[CONTINUITY_CFG.stories[cont.storyId].originEventId];
    const originLabel = originEvt?.options[cont.originOptionId]?.label ?? "";
    const originTitle = originEvt?.title ?? "";
    const echoLabel = opt.label;
    s.encounter.pending = null;
    s.encounter.continuity = null;
    if (!s.encounter.completedStories.includes(cont.storyId)) s.encounter.completedStories.push(cont.storyId);
    const record = `连续际遇「${originTitle}」· ${originLabel} → 回响「${echoLabel}」`;
    s.recentLogs.push(`${record}。`);
    pushMilestone(s, "continuity", nowMs, record);
    s.revision += 1;
    return { state: s, ok: true };
  }

  const r = opt.reward;
  if (r?.cultivation) s.resources.cultivation += r.cultivation;
  if (r?.spirit) s.resources.spirit += r.spirit;
  if (r?.spiritStone) s.resources.spiritStone += r.spiritStone;
  if (r?.herb) s.resources.herb += r.herb;
  if (r?.page) s.resources.page += r.page;
  s.encounter.pending = null;
  s.recentLogs.push(`际遇「${evt.title}」已定，选择「${opt.label}」。`);
  pushMilestone(s, "encounter", nowMs, `际遇「${evt.title}」`);

  // 连续际遇起源事件：每档每故事只开一次；已有挂起/已完成的故事不重开
  const storyId = isContinuityOriginEvent(pending.eventId);
  if (storyId && !s.encounter.continuity && !s.encounter.completedStories.includes(storyId)) {
    s.encounter.continuity = {
      storyId,
      originOptionId: optionId,
      originDate: todayStr(nowMs),
      stage: "awaiting",
    };
  }

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
  const xg = xuanGuiReduction(state);
  if (xg > 0) {
    sources.push({ name: CONFIG.techniques.xuanGui.name, pct: xg });
  }
  const bx = newTechEffect(state, "buXiu", "tribulationReduction");
  if (bx > 0) sources.push({ name: CONFIG.techniques.buXiu.name, pct: bx });
  const tc = newTechEffect(state, "taiChu", "tribulationReduction");
  if (tc > 0) sources.push({ name: CONFIG.techniques.taiChu.name, pct: tc });
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const eqId = state.equipment[slot];
    const eqBase = eqId ? baseIdOf(state, eqId) : null;
    if (eqBase && EQUIP_CFG[eqBase]?.tribulationReduction) {
      sources.push({ name: EQUIP_CFG[eqBase].name, pct: EQUIP_CFG[eqBase].tribulationReduction as number });
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

export function simulateTribulation(state: SaveState, wavesPct: readonly number[] = CONFIG.tribulation.wavesPct, label = "天劫"): TribulationSim {
  const maxHp = playerStats(state).hp;
  const info = tribulationReductionInfo(state);
  const pill = state.preparedPill;
  let hp = maxHp;
  let success = true;
  const waves: TribulationWave[] = [];
  const log: string[] = [];
  let pillHealed: { wave: number; amount: number } | null = null;
  wavesPct.forEach((pct, i) => {
    const dmg = Math.ceil(maxHp * pct * (1 - info.reduction) * (state.resonance === "冰" ? CONFIG.resonance.iceDamageMult : 1));
    hp -= dmg;
    log.push(`第${i + 1}波${label}，伤${dmg}点，余${Math.max(0, hp)}气血。`);
    if (i + 1 === CONFIG.tribulation.pillWave && pill && hp > 0) {
      const healed = Math.round(maxHp * (CONFIG.pills.tribulationHealPct[(state.preparedPillTier ?? 1) - 1] ?? 0.30));
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
  if (state.realm !== "qi10") {
    return { ok: false, reason: "仅炼气十层可渡劫", maxHp: 0, reduction: 0, sources: [], waves: [], pillHealed: null, success: false, pillPrepared: false };
  }
  const sim = simulateTribulation(state);
  return { ok: true, reason: "", maxHp: sim.maxHp, reduction: sim.reduction, sources: sim.sources, waves: sim.waves, pillHealed: sim.pillHealed, success: sim.success, pillPrepared: state.preparedPill };
}

export function startTribulation(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.realm !== "qi10") return fail("仅炼气十层可渡劫");
  const idx = realmIndex("qi10");
  const next = REALMS[idx + 1];
  if (!next) return fail("渡劫门槛未配置");
  if (s.resources.cultivation < next.cultivationCost || s.resources.spirit < next.spiritCost) {
    return fail(`渡劫门槛未足（需修为${next.cultivationCost}、灵气${next.spiritCost}）`);
  }
  s.resources.cultivation -= next.cultivationCost;
  s.resources.spirit -= next.spiritCost;

  const sim = simulateTribulation(s);
  const pill = s.preparedPill;
  if (pill) {
    const tier = s.preparedPillTier ?? 1;
    const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
    s.inventory[pillId] = Math.max(0, (s.inventory[pillId] || 0) - 1);
  }
  s.preparedPill = false;

  if (sim.success) {
    s.realm = "zhuji1";
    syncRealmMaps(s);
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

// ---- 结丹试炼（v0.7） ----

export interface JindanTrialPreview {
  ok: boolean;
  reason: string;
  canAfford: boolean;
  shortfall: { cultivation: number; spirit: number; spiritStone: number };
  maxHp: number;
  reduction: number;
  sources: ReductionSource[];
  waves: TribulationWave[];
  pillHealed: { wave: number; amount: number } | null;
  success: boolean;
  pillPrepared: boolean;
  cost: { cultivation: number; spirit: number; spiritStone: number };
}

export function jindanTrialCost(): { cultivation: number; spirit: number; spiritStone: number } {
  const next = REALMS[realmIndex("zhuji10") + 1];
  if (!next) return { cultivation: 0, spirit: 0, spiritStone: 0 };
  return { cultivation: next.cultivationCost, spirit: next.spiritCost, spiritStone: TRIAL_CFG[2].spiritStoneCost };
}

export function jindanTrialGateOk(state: SaveState): { ok: boolean; reason: string } {
  if (state.realm !== "zhuji10") return { ok: false, reason: "仅筑基十层可结丹" };
  const nodeIds = mainNodeIds("map_yunling");
  const guardian = nodeIds[nodeIds.length - 1]; // 护丹灵（第三节点）
  if (!state.maps.map_yunling?.[guardian]?.cleared) return { ok: false, reason: "需先首通云岭古道·护丹灵" };
  return { ok: true, reason: "" };
}

export function previewJindanTrial(state: SaveState): JindanTrialPreview {
  const gate = jindanTrialGateOk(state);
  const empty: JindanTrialPreview = {
    ok: false, reason: gate.reason, canAfford: false,
    shortfall: { cultivation: 0, spirit: 0, spiritStone: 0 },
    maxHp: 0, reduction: 0, sources: [], waves: [], pillHealed: null, success: false, pillPrepared: false,
    cost: { cultivation: 0, spirit: 0, spiritStone: 0 },
  };
  if (!gate.ok) return empty;
  const sim = simulateTribulation(state, TRIAL_CFG[2].wavesPct, "结丹试炼");
  const cost = jindanTrialCost();
  const canAfford =
    state.resources.cultivation >= cost.cultivation &&
    state.resources.spirit >= cost.spirit &&
    state.resources.spiritStone >= cost.spiritStone;
  const shortfall = {
    cultivation: Math.max(0, cost.cultivation - state.resources.cultivation),
    spirit: Math.max(0, cost.spirit - state.resources.spirit),
    spiritStone: Math.max(0, cost.spiritStone - state.resources.spiritStone),
  };
  return {
    ok: true, reason: "", canAfford, shortfall,
    maxHp: sim.maxHp, reduction: sim.reduction, sources: sim.sources,
    waves: sim.waves, pillHealed: sim.pillHealed, success: sim.success, pillPrepared: state.preparedPill,
    cost,
  };
}

export function startJindanTrial(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const gate = jindanTrialGateOk(s);
  if (!gate.ok) return fail(gate.reason);
  const cost = jindanTrialCost();
  if (
    s.resources.cultivation < cost.cultivation ||
    s.resources.spirit < cost.spirit ||
    s.resources.spiritStone < cost.spiritStone
  ) {
    return fail(`结丹门槛未足（需修为${cost.cultivation}、灵气${cost.spirit}、灵石${cost.spiritStone}）`);
  }
  s.resources.cultivation -= cost.cultivation;
  s.resources.spirit -= cost.spirit;
  s.resources.spiritStone -= cost.spiritStone;

  const sim = simulateTribulation(s, TRIAL_CFG[2].wavesPct, "结丹试炼");
  const pill = s.preparedPill;
  if (pill) {
    const tier = s.preparedPillTier ?? 1;
    const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
    s.inventory[pillId] = Math.max(0, (s.inventory[pillId] || 0) - 1);
  }
  s.preparedPill = false;

  if (sim.success) {
    s.realm = "jindan1";
    syncRealmMaps(s);
    s.recentLogs.push("结丹试炼五波尽数扛下，凝气成丹，晋入金丹一层。");
    pushMilestone(s, "jindan", nowMs, "结丹试炼成功，晋入金丹一层");
  } else {
    s.recentLogs.push("结丹试炼失败，境界不动，可按短板准备后重试。");
    pushMilestone(s, "jindan", nowMs, "结丹试炼失败");
  }
  s.jindanTrial = { maxHp: sim.maxHp, reduction: sim.reduction, pillUsed: pill, waves: sim.waves, success: sim.success, log: sim.log };
  s.revision += 1;
  return { state: s, ok: true };
}

export function yuanyingTrialCost(): { cultivation: number; spirit: number; spiritStone: number } {
  const next = REALMS[realmIndex("jindan10") + 1];
  if (!next) return { cultivation: 0, spirit: 0, spiritStone: 0 };
  return { cultivation: next.cultivationCost, spirit: next.spiritCost, spiritStone: TRIAL_CFG[3].spiritStoneCost };
}

export function yuanyingTrialGateOk(state: SaveState): { ok: boolean; reason: string } {
  if (state.realm !== "jindan10") return { ok: false, reason: "仅金丹十层可冲击元婴" };
  const nodeIds = mainNodeIds("map_jindan");
  const guardian = nodeIds[nodeIds.length - 1]; // 元婴裂隙（末节点）
  if (!state.maps.map_jindan?.[guardian]?.cleared) return { ok: false, reason: "需先首通金丹秘境·元婴裂隙" };
  return { ok: true, reason: "" };
}

export function previewYuanyingTrial(state: SaveState): JindanTrialPreview {
  const gate = yuanyingTrialGateOk(state);
  const empty: JindanTrialPreview = {
    ok: false, reason: gate.reason, canAfford: false,
    shortfall: { cultivation: 0, spirit: 0, spiritStone: 0 },
    maxHp: 0, reduction: 0, sources: [], waves: [], pillHealed: null, success: false, pillPrepared: false,
    cost: { cultivation: 0, spirit: 0, spiritStone: 0 },
  };
  if (!gate.ok) return empty;
  const sim = simulateTribulation(state, TRIAL_CFG[3].wavesPct, "元婴天劫");
  const cost = yuanyingTrialCost();
  const canAfford =
    state.resources.cultivation >= cost.cultivation &&
    state.resources.spirit >= cost.spirit &&
    state.resources.spiritStone >= cost.spiritStone;
  const shortfall = {
    cultivation: Math.max(0, cost.cultivation - state.resources.cultivation),
    spirit: Math.max(0, cost.spirit - state.resources.spirit),
    spiritStone: Math.max(0, cost.spiritStone - state.resources.spiritStone),
  };
  return {
    ok: true, reason: "", canAfford, shortfall,
    maxHp: sim.maxHp, reduction: sim.reduction, sources: sim.sources,
    waves: sim.waves, pillHealed: sim.pillHealed, success: sim.success, pillPrepared: state.preparedPill,
    cost,
  };
}

export function startYuanyingTrial(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const gate = yuanyingTrialGateOk(s);
  if (!gate.ok) return fail(gate.reason);
  const cost = yuanyingTrialCost();
  if (
    s.resources.cultivation < cost.cultivation ||
    s.resources.spirit < cost.spirit ||
    s.resources.spiritStone < cost.spiritStone
  ) {
    return fail(`元婴门槛未足（需修为${cost.cultivation}、灵气${cost.spirit}、灵石${cost.spiritStone}）`);
  }
  s.resources.cultivation -= cost.cultivation;
  s.resources.spirit -= cost.spirit;
  s.resources.spiritStone -= cost.spiritStone;

  const sim = simulateTribulation(s, TRIAL_CFG[3].wavesPct, "元婴天劫");
  const pill = s.preparedPill;
  if (pill) {
    const tier = s.preparedPillTier ?? 1;
    const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
    s.inventory[pillId] = Math.max(0, (s.inventory[pillId] || 0) - 1);
  }
  s.preparedPill = false;

  if (sim.success) {
    s.realm = "yuanying1";
    s.recentLogs.push("元婴天劫五波尽数扛下，神魂凝婴，晋入元婴一层。");
    pushMilestone(s, "yuanying", nowMs, "元婴天劫成功，晋入元婴一层");
  } else {
    s.recentLogs.push("元婴天劫失败，境界不动，可按短板准备后重试。");
    pushMilestone(s, "yuanying", nowMs, "元婴天劫失败");
  }
  s.yuanyingTrial = { maxHp: sim.maxHp, reduction: sim.reduction, pillUsed: pill, waves: sim.waves, success: sim.success, log: sim.log };
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 跨境试炼（通用：覆盖渡劫/结丹/元婴及后续各境）----

function trialFor(state: SaveState): { toRealm: RealmId; stage: number; cfg: (typeof TRIAL_CFG)[number] } | null {
  const idx = realmIndex(state.realm);
  const r = REALMS[idx];
  if (!r || r.layer !== 10 || idx >= realmOrder.length - 1) return null;
  const cfg = TRIAL_CFG[r.stage];
  if (!cfg) return null;
  return { toRealm: REALMS[idx + 1].id as RealmId, stage: r.stage, cfg };
}

export function crossStageTrialInfo(state: SaveState): { name: string; description: string } | null {
  const trial = trialFor(state);
  return trial ? { name: trial.cfg.name, description: trial.cfg.description } : null;
}

export function crossStageTrialGateOk(state: SaveState): { ok: boolean; reason: string } {
  const t = trialFor(state);
  if (!t) return { ok: false, reason: "当前境界不可跨境" };
  if (t.cfg.gateMap) {
    const mid = t.cfg.gateMap as MapId;
    const nodeIds = mainNodeIds(mid);
    const guardian = nodeIds[nodeIds.length - 1];
    if (!state.maps[mid]?.[guardian]?.cleared) {
      return { ok: false, reason: `需先首通${MAP_CFG[mid].name}·${MAP_CFG[mid].nodes[guardian].name}` };
    }
  }
  return { ok: true, reason: "" };
}

export function crossStageTrialCost(state: SaveState): { cultivation: number; spirit: number; spiritStone: number } {
  const t = trialFor(state);
  if (!t) return { cultivation: 0, spirit: 0, spiritStone: 0 };
  const to = REALMS[realmIndex(t.toRealm)];
  return { cultivation: to.cultivationCost, spirit: to.spiritCost, spiritStone: t.cfg.spiritStoneCost };
}

export function previewCrossStageTrial(state: SaveState): JindanTrialPreview {
  const gate = crossStageTrialGateOk(state);
  const t = trialFor(state);
  const empty: JindanTrialPreview = {
    ok: false, reason: gate.reason, canAfford: false,
    shortfall: { cultivation: 0, spirit: 0, spiritStone: 0 },
    maxHp: 0, reduction: 0, sources: [], waves: [], pillHealed: null, success: false, pillPrepared: false,
    cost: { cultivation: 0, spirit: 0, spiritStone: 0 },
  };
  if (!t || !gate.ok) return empty;
  const sim = simulateTribulation(state, t.cfg.wavesPct, t.cfg.name);
  const cost = crossStageTrialCost(state);
  const canAfford =
    state.resources.cultivation >= cost.cultivation &&
    state.resources.spirit >= cost.spirit &&
    state.resources.spiritStone >= cost.spiritStone;
  const shortfall = {
    cultivation: Math.max(0, cost.cultivation - state.resources.cultivation),
    spirit: Math.max(0, cost.spirit - state.resources.spirit),
    spiritStone: Math.max(0, cost.spiritStone - state.resources.spiritStone),
  };
  return {
    ok: true, reason: "", canAfford, shortfall,
    maxHp: sim.maxHp, reduction: sim.reduction, sources: sim.sources,
    waves: sim.waves, pillHealed: sim.pillHealed, success: sim.success, pillPrepared: state.preparedPill,
    cost,
  };
}

export function startCrossStageTrial(state: SaveState, nowMs: number): Result<SaveState> {
  const s = settle(state, nowMs);
  const t = trialFor(s);
  const gate = crossStageTrialGateOk(s);
  if (!t || !gate.ok) return fail(gate.reason || "当前境界不可跨境");
  const cost = crossStageTrialCost(s);
  if (
    s.resources.cultivation < cost.cultivation ||
    s.resources.spirit < cost.spirit ||
    s.resources.spiritStone < cost.spiritStone
  ) {
    return fail(`跨境门槛未足（需修为${cost.cultivation}、灵气${cost.spirit}、灵石${cost.spiritStone}）`);
  }
  s.resources.cultivation -= cost.cultivation;
  s.resources.spirit -= cost.spirit;
  s.resources.spiritStone -= cost.spiritStone;
  const to = REALMS[realmIndex(t.toRealm)];
  const sim = simulateTribulation(s, t.cfg.wavesPct, t.cfg.name);
  const pill = s.preparedPill;
  if (pill) {
    const tier = s.preparedPillTier ?? 1;
    const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
    s.inventory[pillId] = Math.max(0, (s.inventory[pillId] || 0) - 1);
  }
  s.preparedPill = false;
  if (sim.success) {
    s.realm = t.toRealm;
    syncRealmMaps(s);
    s.recentLogs.push(`${t.cfg.name}五波尽数扛下，晋入${to.name}。`);
    pushMilestone(s, "breakthrough", nowMs, `${t.cfg.name}成功，晋入${to.name}`);
  } else {
    s.recentLogs.push(`${t.cfg.name}失败，境界不动，可按短板准备后重试。`);
    pushMilestone(s, "breakthrough", nowMs, `${t.cfg.name}失败`);
  }
  s.tribulationLog = { maxHp: sim.maxHp, reduction: sim.reduction, pillUsed: pill, waves: sim.waves, success: sim.success, log: sim.log };
  s.revision += 1;
  return { state: s, ok: true };
}

// ---- 秘境（v0.9） ----

export function secretRealmReward(realmId: SecretRealmId): Resources {
  const cfg = SECRET_REALM_CFG[realmId];
  return { ...emptyResources(), spiritStone: cfg.reward.spiritStone ?? 0, herb: cfg.reward.herb ?? 0, page: cfg.reward.page ?? 0, iron: IRON_CFG.realmDrop[realmId] ?? 0 };
}

export function predictSecretRealm(state: SaveState, realmId: SecretRealmId): { ok: boolean; reason: string; won: boolean; enemy: { attack: number; defense: number; hp: number }; player: { attack: number; defense: number; hp: number } } {
  const cfg = SECRET_REALM_CFG[realmId];
  if (!cfg) return { ok: false, reason: "无此秘境", won: false, enemy: { attack: 0, defense: 0, hp: 0 }, player: { attack: 0, defense: 0, hp: 0 } };
  if (realmIndex(state.realm) < realmIndex(cfg.gate as RealmId)) {
    return { ok: false, reason: `需${realmName(cfg.gate as RealmId)}方可进入`, won: false, enemy: { ...cfg.enemy }, player: playerStats(state) };
  }
  const stats = playerStats(state);
  const battle = runBattle(stats, cfg.enemy, secretRealmDamageMult(state), battleTakenMult(state), 50, battleMods(state), seededRng(hashSeed(realmId)));
  return { ok: true, reason: "", won: battle.won, enemy: { ...cfg.enemy }, player: stats };
}

export function enterSecretRealm(state: SaveState, nowMs: number, realmId: SecretRealmId): Result<SaveState> {
  const s = settle(state, nowMs);
  const cfg = SECRET_REALM_CFG[realmId];
  if (!cfg) return fail("无此秘境");
  if (realmIndex(s.realm) < realmIndex(cfg.gate as RealmId)) return fail(`需${realmName(cfg.gate as RealmId)}方可进入`);
  if (s.secretRealmUsed[realmId]) return fail("今日已挑战该秘境");
  const stats = playerStats(s);
  const battle = runBattle(stats, cfg.enemy, secretRealmDamageMult(s), battleTakenMult(s), 50, battleMods(s), seededRng(hashSeed(realmId)));
  const reward = battle.won ? secretRealmReward(realmId) : emptyResources();
  const rewardLines: string[] = [];
  let noRewardNote: string | undefined;
  if (battle.won) {
    applyReward(s, reward);
    const mat = materialForSecretRealm(realmId);
    if (mat) (s.resources as unknown as Record<string, number>)[mat] += 4;
    if (reward.spiritStone) rewardLines.push(`灵石 ${reward.spiritStone}`);
    if (reward.herb) rewardLines.push(`灵草 ${reward.herb}`);
    if (reward.page) rewardLines.push(`残页 ${reward.page}`);
    if (reward.iron) rewardLines.push(`玄铁 ${reward.iron}`);
    if (mat) rewardLines.push(`${RESOURCE_NAMES[mat]} 4`);
  } else {
    noRewardNote = "未获得奖励";
  }
  s.secretRealmUsed[realmId] = true;
  s.secretRealmLog.push({ realm: realmId, won: battle.won, reward: { ...reward }, at: nowMs });
  const rewardTxt = battle.won ? `得 ${fmtReward(reward)}` : "未获奖励";
  s.recentLogs.push(`秘境「${cfg.name}」${battle.won ? "探索成功" : "探索失败"}，${rewardTxt}。`);
  pushMilestone(s, "realm", nowMs, `秘境「${cfg.name}」${battle.won ? "探索成功" : "探索失败"}，${rewardTxt}`);
  s.lastBattle = buildBattleReport("secret", cfg.name, cfg.name, "secret", "normal", 50, battle, stats, cfg.enemy, nowMs, rewardLines, noRewardNote);
  s.revision += 1;
  return { state: s, ok: true };
}

function fmtReward(r: Resources): string {
  const parts: string[] = [];
  if (r.cultivation) parts.push(`修为 ${r.cultivation}`);
  if (r.spirit) parts.push(`灵气 ${r.spirit}`);
  if (r.spiritStone) parts.push(`灵石 ${r.spiritStone}`);
  if (r.herb) parts.push(`灵草 ${r.herb}`);
  if (r.page) parts.push(`残页 ${r.page}`);
  if (r.iron) parts.push(`玄铁 ${r.iron}`);
  return parts.join("、") || "无";
}

// ---- 存档导入导出 ----

function migrateEquipmentInstances(s: SaveState): void {
  if (s.itemInstances && typeof s.itemInstances === "object" && Object.keys(s.itemInstances).length > 0) return;
  const oldAffixes = (s as unknown as Record<string, unknown>).equipmentAffixes as Record<string, Affix[]> | undefined;
  const oldLocked = s.lockedAffixes ?? {};
  const instances: Record<string, { baseId: string; affixes: Affix[] }> = {};
  const baseToFirst: Record<string, string> = {};
  const newInventory: Record<string, number> = {};
  const oldInventory = s.inventory ?? {};
  for (const [key, count] of Object.entries(oldInventory)) {
    if (EQUIP_CFG[key] && typeof count === "number" && count > 0) {
      for (let i = 0; i < count; i++) {
        const instId = makeInstanceId(instances, key);
        const affixes = (i === 0 && Array.isArray(oldAffixes?.[key]))
          ? (oldAffixes as Record<string, Affix[]>)[key]
          : randomAffixes(seededRng(hashSeed(key) + Object.keys(instances).length + 1), maxAffixesForStage(currentStage(s)));
        instances[instId] = { baseId: key, affixes };
        newInventory[instId] = 1;
        if (i === 0) baseToFirst[key] = instId;
      }
    } else if (typeof count === "number" && count > 0) {
      newInventory[key] = count;
    }
  }
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const oldId = s.equipment[slot];
    if (oldId && baseToFirst[oldId]) s.equipment[slot] = baseToFirst[oldId];
  }
  s.quenched = Array.isArray(s.quenched) ? s.quenched.map((id) => baseToFirst[id] ?? id) : [];
  const newLocked: Record<string, string> = {};
  for (const [baseId, affixId] of Object.entries(oldLocked)) {
    if (baseToFirst[baseId]) newLocked[baseToFirst[baseId]] = affixId;
  }
  s.lockedAffixes = newLocked;
  s.itemInstances = instances;
  s.inventory = newInventory;
}

export function migrateSave(raw: SaveState): SaveState {
  const s = structuredClone(raw) as unknown as Record<string, unknown>;
  migrateRealmRefs(s, (s.schemaVersion as number) ?? 0);  const firstNode = mainNodeIds("map_qingyun")[0];
  const suppression = (s.suppression ?? {}) as Record<string, unknown>;
  if (!Array.isArray(s.milestones)) s.milestones = [];
  if (!s.firsts || typeof s.firsts !== "object") {
    s.firsts = {
      settledOnce: false,
      suppressedFirstNodeOnce: suppression["map_qingyun"] === firstNode,
      viewedTribPreviewOnce: false,
    };
  }
  const rawDaily = s.daily as Record<string, unknown> | undefined;
  const hasNewDaily = !!rawDaily && typeof rawDaily.weather === "object" && typeof rawDaily.astrology === "object";
  if (!hasNewDaily) {
    s.daily = emptyDaily(todayStr(Date.now()));
  } else if (rawDaily.rewardedRepeats === undefined) {
    rawDaily.rewardedRepeats = 0;
  }
  if (s.daily && (s.daily as unknown as Record<string, unknown>).rewardedDan === undefined) {
    (s.daily as unknown as Record<string, unknown>).rewardedDan = 0;
  }
  const lastSettled = (s.lastSettledAt as number) || Date.now();
  if (!s.suppressionSince || typeof s.suppressionSince !== "object") {
    s.suppressionSince = emptySuppressionSince();
    if (suppression["map_qingyun"]) (s.suppressionSince as Record<string, unknown>)["map_qingyun"] = lastSettled;
    if (suppression["map_nether"]) (s.suppressionSince as Record<string, unknown>)["map_nether"] = lastSettled;
  }
  // 补齐缺失地图、旧地图新增节点与镇压位。
  const maps = (s.maps ?? {}) as Record<string, Record<string, unknown>>;
  for (const mid of MAP_ORDER) {
    if (!maps[mid]) maps[mid] = {};
    const nodeIds = mainNodeIds(mid);
    for (const nid of Object.keys(MAP_CFG[mid].nodes)) {
      if (!maps[mid][nid]) maps[mid][nid] = { unlocked: false, cleared: false };
    }
    for (let i = 1; i < nodeIds.length; i++) {
      const previous = maps[mid][nodeIds[i - 1]] as { cleared: boolean };
      if (previous.cleared) (maps[mid][nodeIds[i]] as { unlocked: boolean }).unlocked = true;
    }
    if (!suppression[mid]) {
      (s.suppression as Record<string, unknown>)[mid] = null;
    }
    if ((s.suppressionSince as Record<string, unknown>)[mid] === undefined) {
      (s.suppressionSince as Record<string, unknown>)[mid] = 0;
    }
  }
  s.maps = maps;
  if (s.longTask === undefined) s.longTask = null;
  if (s.lastLongTaskResult === undefined) s.lastLongTaskResult = null;
  if (s.longTask && typeof s.longTask === "object") {
    const lt = s.longTask as unknown as Record<string, unknown>;
    if (lt.effectiveMinutes === undefined && typeof lt.startAt === "number" && typeof lt.endAt === "number") {
      lt.effectiveMinutes = Math.max(1, Math.round((lt.endAt - lt.startAt) / 60000)); // 从实际耗时回推，兼容风共鸣旧档
    }
  }
  if (s.jindanTrial === undefined) s.jindanTrial = null;
  if (s.yuanyingTrial === undefined) s.yuanyingTrial = null;
  if (s.preparedPillTier === undefined) s.preparedPillTier = 1;
  if (!Array.isArray(s.quenched)) s.quenched = [];
  if (!Array.isArray(s.learnedNewTechs)) s.learnedNewTechs = [];
  if (!Array.isArray(s.spiritRoots) || s.spiritRoots.length === 0) s.spiritRoots = [validSpiritRoot(s.spiritRoot)];
  if (typeof s.meridians !== "string" || !MERIDIAN_CFG[s.meridians]) s.meridians = "normal";
  if (typeof s.comprehension !== "string" || !COMPREHENSION_CFG[s.comprehension]) s.comprehension = "normal";
  if (s.resonance === undefined) s.resonance = null;
  if (!Array.isArray(s.marrowHistory)) s.marrowHistory = [];
  if (!s.lockedAffixes || typeof s.lockedAffixes !== "object") s.lockedAffixes = {};
  migrateEquipmentInstances(s as unknown as SaveState);
  // 清理 v1.8 前一次炼制双写：同一装备既写基础 ID 又写实例，只保留实例（未穿戴的基础 ID 视为重复）
  {
    const inv = (s.inventory ?? {}) as Record<string, number>;
    const insts = (s.itemInstances ?? {}) as Record<string, { baseId: string }>;
    const instBaseIds = new Set(Object.values(insts).map((i) => i.baseId));
    const eq = (s.equipment ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(inv)) {
      if (EQUIP_IDS.has(k) && instBaseIds.has(k) && eq.weapon !== k && eq.armor !== k && eq.accessory !== k) {
        delete inv[k];
      }
    }
  }
  delete s.equipmentAffixes;
  if (s.library === undefined) s.library = 0;
  if (s.auxiliaryTechnique === undefined) s.auxiliaryTechnique = null;
  if (s.forge === undefined) s.forge = 0;
  if (!s.resources || typeof s.resources !== "object") {
    s.resources = { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0, iron: 0, lingTaiJing: 0, yunHaiSui: 0, buXiuJin: 0, hunYuanYu: 0, taiChuZiJing: 0 };
  } else if ((s.resources as Record<string, unknown>).iron === undefined) {
    (s.resources as Record<string, unknown>).iron = 0;
  }
  if (s.secretRealmDate === undefined) s.secretRealmDate = todayStr(Date.now());
  if (!s.secretRealmUsed || typeof s.secretRealmUsed !== "object") s.secretRealmUsed = emptySecretRealmUsed();
  if ((s.schemaVersion as number) < SECRET_REALM_EXPANSION_VERSION) {
    s.secretRealmUsed = { ...emptySecretRealmUsed(), ...(s.secretRealmUsed as Record<string, boolean>) };
  }
  if (!Array.isArray(s.secretRealmLog)) s.secretRealmLog = [];
  if (s.aptitude === undefined) s.aptitude = "balanced";
  if (!s.techniqueLevel || typeof s.techniqueLevel !== "object") {
    s.techniqueLevel = { qingYun: 0, xuanGui: 0, poYue: 0, juYuan: 0, ningYing: 0, yunHai: 0, buXiu: 0, hunYuanGuiYi: 0, taiChu: 0 };
  } else {
    for (const k of ["poYue", "juYuan"]) {
      if ((s.techniqueLevel as Record<string, unknown>)[k] === undefined) (s.techniqueLevel as Record<string, unknown>)[k] = 0;
    }
  }
  if (!s.breakthroughFails || typeof s.breakthroughFails !== "object") {
    s.breakthroughFails = {};
  }
  for (const l of BREAKTHROUGH_LAYERS) {
    if ((s.breakthroughFails as Record<string, unknown>)[l] === undefined) (s.breakthroughFails as Record<string, unknown>)[l] = 0;
  }
  if (!Array.isArray(s.breakthroughRecords)) s.breakthroughRecords = [];
  const rawEncounter = (s.encounter ?? {}) as Record<string, unknown>;
  if (rawEncounter.continuity === undefined) rawEncounter.continuity = null;
  if (!Array.isArray(rawEncounter.completedStories)) rawEncounter.completedStories = [];
  s.encounter = rawEncounter;
  if (s.lastBattle === undefined || s.lastBattle === null) {
    s.lastBattle = null;
  } else if (typeof s.lastBattle === "object" && (s.lastBattle as Record<string, unknown>).tactic === undefined) {
    (s.lastBattle as Record<string, unknown>).tactic = "normal";
  }
  if (!s.commission || typeof s.commission !== "object") {
    s.commission = { date: "", candidates: [], active: null, history: [] };
  } else {
    const comm = s.commission as unknown as Record<string, unknown>;
    if (!Array.isArray(comm.candidates)) comm.candidates = [];
    if (comm.active === undefined) comm.active = null;
    if (!Array.isArray(comm.history)) comm.history = [];
    if (typeof comm.date !== "string") comm.date = "";
  }
  s.schemaVersion = SCHEMA_VERSION;
  const migrated = s as unknown as SaveState;
  syncRealmMaps(migrated);
  // 补记已首通的新功法（旧档）与鸿蒙印
  for (const [techId, req] of Object.entries(NEW_TECH_REQUIREMENT)) {
    const firstNode = mainNodeIds(req.grantMap)[0];
    const cleared = (migrated.maps[req.grantMap] as Record<string, { cleared: boolean }>)?.[firstNode]?.cleared;
    if (cleared && !migrated.learnedNewTechs.includes(techId)) migrated.learnedNewTechs.push(techId);
  }
  const hmLast = mainNodeIds("map_hongmeng").at(-1)!;
  if ((migrated.maps.map_hongmeng as Record<string, { cleared: boolean }>)?.[hmLast]?.cleared) {
    // 鸿蒙印按实例补发（避免与旧基础 ID 冲突）
    const hasHongmeng = Object.values(migrated.itemInstances).some((i) => i.baseId === "c_hongmeng");
    if (!hasHongmeng) createInstance(migrated, "c_hongmeng");
  }
  return migrated;
}

export function exportSave(state: SaveState): string {
  return JSON.stringify(state, null, 2);
}

const EQUIP_IDS = new Set(Object.keys(EQUIP_CFG));

function validateResources(v: unknown, schemaVersion: number): string | null {
  if (!v || typeof v !== "object") return "资源数据缺失";
  const o = v as Record<string, unknown>;
  for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
    const x = o[k];
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return "资源数据无效";
  }
  const iron = o["iron"];
  if (schemaVersion >= 9) {
    if (typeof iron !== "number" || !Number.isFinite(iron) || iron < 0) return "玄铁数据无效";
  } else if (iron !== undefined && (typeof iron !== "number" || !Number.isFinite(iron) || iron < 0)) {
    return "玄铁数据无效";
  }
  for (const k of MATERIAL_RESOURCES) {
    const x = o[k];
    if (schemaVersion >= 14) {
      if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return "资源数据无效";
    } else if (x !== undefined && (typeof x !== "number" || !Number.isFinite(x) || x < 0)) {
      return "资源数据无效";
    }
  }
  return null;
}

function validateForge(v: unknown, schemaVersion: number): string | null {
  const max = CONFIG.forge.levels.length;
  if (schemaVersion >= 9) {
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) return "炼器台等级无效";
  } else if (v !== undefined && v !== null && (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max)) {
    return "炼器台等级无效";
  }
  return null;
}

function validateBuildings(v: unknown): string | null {
  const o = (v ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(CONFIG.buildings)) {
    const x = o[id];
    const max = (CONFIG.buildings as unknown as Record<string, { levels: unknown[] }>)[id].levels.length;
    if (x !== undefined && (!Number.isInteger(x) || (x as number) < 0 || (x as number) > max)) return "建筑等级无效";
  }
  return null;
}

function validateTechnique(tech: unknown, levels: unknown, library: unknown): string | null {
  if (tech !== null && tech !== undefined && !Object.keys(CONFIG.techniques).includes(tech as string)) return "功法无效";
  if ((tech === "poYue" || tech === "juYuan") && ((library as number) ?? 0) < 1) return "功法未解锁";
  const o = (levels ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(CONFIG.techniques)) {
    const x = o[id];
    const max = (CONFIG.techniques as unknown as Record<string, { levels: unknown[] }>)[id].levels.length;
    if (x !== undefined && (!Number.isInteger(x) || (x as number) < 0 || (x as number) > max)) return "功法等级无效";
  }
  return null;
}

function validateLibrary(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > CONFIG.library.levels.length) return "藏经阁等级无效";
  return null;
}

function validateAuxiliaryTechnique(tech: unknown, aux: unknown, library: unknown): string | null {
  if (aux === undefined || aux === null) return null;
  if (!Object.keys(CONFIG.techniques).includes(aux as string)) return "辅修功法无效";
  if (aux === tech) return "主辅不能为同一本";
  if (tech === null || tech === undefined) return "无主修却有辅修";
  if (((library as number) ?? 0) < 2) return "辅修需二级藏经阁";
  return null;
}

function validateSecretRealm(used: unknown, log: unknown, date: unknown, schemaVersion: number): string | null {
  const isCurrent = schemaVersion >= SECRET_REALM_INTRO_VERSION;
  const hasDate = date !== undefined && date !== null;
  const hasUsed = used !== undefined && used !== null;
  const hasLog = log !== undefined && log !== null;

  // v8 必须三字段齐全
  if (isCurrent) {
    if (!hasDate || typeof date !== "string" || !isValidDateStr(date)) return "秘境日期无效";
    if (!hasUsed || typeof used !== "object") return "秘境状态无效";
    if (!hasLog || !Array.isArray(log)) return "秘境记录无效";
  }

  // 无论版本，只要字段存在就做结构与一致性校验（防“改称旧版绕过”）
  if (hasDate && (typeof date !== "string" || !isValidDateStr(date))) return "秘境日期无效";
  const dateStr = hasDate && typeof date === "string" ? (date as string) : null;

  let u: Record<string, unknown> = {};
  if (hasUsed) {
    if (typeof used !== "object") return "秘境状态无效";
    u = used as Record<string, unknown>;
    for (const id of schemaVersion >= SECRET_REALM_EXPANSION_VERSION ? SECRET_REALM_IDS : LEGACY_SECRET_REALM_IDS) {
      if (typeof u[id] !== "boolean") return "秘境状态无效";
    }
    for (const id of SECRET_REALM_IDS) {
      if (u[id] !== undefined && typeof u[id] !== "boolean") return "秘境状态无效";
    }
  }

  const sameDayCount: Record<string, number> = {};
  if (hasLog) {
    if (!Array.isArray(log)) return "秘境记录无效";
    for (const l of log as unknown[]) {
      if (!l || typeof l !== "object") return "秘境记录无效";
      const r = l as Record<string, unknown>;
      if (!SECRET_REALM_IDS.includes(r.realm as SecretRealmId)) return "秘境记录无效";
      if (typeof r.won !== "boolean") return "秘境记录无效";
      if (typeof r.at !== "number" || !Number.isFinite(r.at)) return "秘境记录无效";
      const reward = r.reward as Record<string, unknown> | undefined;
      if (!reward || typeof reward !== "object") return "秘境记录无效";
      for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
        if (!isNonNegNum(reward[k])) return "秘境记录无效";
      }
      if (reward.iron !== undefined && !isNonNegNum(reward.iron)) return "秘境记录无效";
      const expected = r.won ? secretRealmReward(r.realm as SecretRealmId) : emptyResources();
      const expRec = expected as unknown as Record<string, number>;
      for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page", "iron"]) {
        if ((reward[k] ?? 0) !== (expRec[k] ?? 0)) return "秘境记录奖励不符";
      }
      if (dateStr) {
        const lDate = todayStr(r.at as number);
        if (lDate > dateStr) return "秘境记录时间无效"; // 记录晚于日期标记
        if (lDate === dateStr) {
          sameDayCount[r.realm as string] = (sameDayCount[r.realm as string] ?? 0) + 1;
        }
      }
    }
  }

  if (dateStr && hasUsed) {
    for (const id of SECRET_REALM_IDS) {
      const usedVal = u[id];
      const cnt = sameDayCount[id] ?? 0;
      if (usedVal === true && cnt !== 1) return "秘境次数与记录矛盾";
      if (usedVal === false && cnt !== 0) return "秘境次数与记录矛盾";
      if (usedVal === undefined && cnt !== 0) return "秘境次数与记录矛盾";
    }
  }
  return null;
}

function validateAffixList(list: unknown): string | null {
  if (!Array.isArray(list)) return "词条列表无效";
  if (list.length < 1 || list.length > 4) return "词条条数无效";
  const seen = new Set<string>();
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "词条无效";
    const a = raw as Record<string, unknown>;
    const cfg = AFFIX_CFG[a.id as string];
    if (typeof a.id !== "string" || !cfg) return "词条 ID 无效";
    if (typeof a.value !== "number" || !Number.isFinite(a.value)) return "词条数值无效";
    if (a.value < cfg.min || a.value > cfg.max) return "词条数值超出范围";
    if (seen.has(a.id as string)) return "词条重复";
    seen.add(a.id as string);
  }
  return null;
}

function validateItemInstances(o: Record<string, unknown>, ver: number): string | null {
  const insts = o.itemInstances as Record<string, unknown> | undefined;
  const locked = o.lockedAffixes as Record<string, unknown> | undefined;
  if (ver >= 16) {
    if (!insts || typeof insts !== "object") return "装备实例无效";
    for (const [instId, raw] of Object.entries(insts)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "装备实例无效";
      const inst = raw as Record<string, unknown>;
      if (typeof inst.baseId !== "string" || !EQUIP_IDS.has(inst.baseId)) return "装备实例基础装备无效";
      const err = validateAffixList(inst.affixes);
      if (err) return err;
    }
    if (locked !== undefined && typeof locked !== "object") return "锁定词条无效";
    if (locked && typeof locked === "object") {
      for (const [instId, affixId] of Object.entries(locked)) {
        if (!insts[instId]) return "锁定装备无效";
        if (typeof affixId !== "string") return "锁定词条无效";
        const inst = insts[instId] as { affixes: Affix[] };
        if (!inst.affixes.some((a) => a.id === affixId)) return "锁定词条不在装备上";
      }
    }
  } else {
    const old = o.equipmentAffixes as Record<string, unknown> | undefined;
    if (old !== undefined && typeof old !== "object") return "装备词条无效";
    if (old && typeof old === "object") {
      for (const [baseId, list] of Object.entries(old)) {
        if (!EQUIP_IDS.has(baseId)) return "装备词条基础装备无效";
        const err = validateAffixList(list);
        if (err) return err;
      }
    }
  }
  return null;
}

function validateEquipmentAndInventory(eq: unknown, inv: unknown, itemInstances: unknown): string | null {
  const e = (eq ?? {}) as Record<string, unknown>;
  const insts = (itemInstances ?? {}) as Record<string, unknown>;
  for (const slot of ["weapon", "armor", "accessory"]) {
    const x = e[slot];
    if (x !== null && x !== undefined && !EQUIP_IDS.has(x as string) && !insts[x as string]) return "装备无效";
  }
  const i = (inv ?? {}) as Record<string, unknown>;
  for (const [k, x] of Object.entries(i)) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return "库存数量无效";
    if (k === "tribulationPill" || k.startsWith("tribulationPill_") || k.startsWith("yangYuanDan_") || k.startsWith("juLingDan_")) continue;
    if (EQUIP_IDS.has(k) || insts[k]) continue;
    return "库存装备无效";
  }
  return null;
}

function validateMaps(maps: unknown, suppression: unknown, schemaVersion: number): string | null {
  const m = (maps ?? {}) as Record<string, unknown>;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodes = m[mid];
    const allowMissing =
      (mid === "map_yunling" && schemaVersion < MAP_YUNLING_INTRO_VERSION) ||
      (mid !== "map_qingyun" && mid !== "map_nether" && mid !== "map_yunling" && schemaVersion < MAP_JINDAN_INTRO_VERSION); // 旧档缺新地图，迁移补默认
    if (nodes === undefined) {
      if (allowMissing) continue;
      return "地图数据无效";
    }
    if (!nodes || typeof nodes !== "object") return "地图数据无效";
    const rec = nodes as Record<string, unknown>;
    for (const nid of Object.keys(MAP_CFG[mid].nodes)) {
      const ns = rec[nid] as Record<string, unknown> | undefined;
      if (!ns) {
        if (schemaVersion < MAP_EXPANDED_VERSION && LEGACY_MISSING_NODES[mid]?.has(nid)) continue;
        if (schemaVersion < 15 && MAP_CFG[mid].nodes[nid].side) continue;
        return "节点数据无效";
      }
      if (typeof ns.unlocked !== "boolean" || typeof ns.cleared !== "boolean") return "节点数据无效";
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
  const cont = e.continuity as Record<string, unknown> | null | undefined;
  if (cont !== null && cont !== undefined) {
    if (!cont || typeof cont !== "object") return "连续际遇数据无效";
    if (!(Object.keys(CONTINUITY_CFG.stories) as string[]).includes(cont.storyId as string)) return "连续际遇故事无效";
    if (typeof cont.originOptionId !== "string" || !cont.originOptionId.trim()) return "连续际遇原选择无效";
    if (typeof cont.originDate !== "string" || !isValidDateStr(cont.originDate)) return "连续际遇日期无效";
    if (cont.stage !== "awaiting" && cont.stage !== "active") return "连续际遇状态无效";
  }
  const done = e.completedStories;
  if (done !== undefined) {
    if (!Array.isArray(done)) return "已完成故事数据无效";
    const ids = Object.keys(CONTINUITY_CFG.stories) as string[];
    if ((done as unknown[]).some((x) => typeof x !== "string" || !ids.includes(x))) return "已完成故事无效";
  }
  return null;
}

function isNonNegFinite(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0;
}

function validateLastBattle(v: unknown, ver: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "最近战报无效";
  const b = v as Record<string, unknown>;
  if (typeof b.won !== "boolean") return "最近战报胜负无效";
  if (b.kind !== "map" && b.kind !== "secret") return "最近战报类型无效";
  if (b.tactic === undefined) {
    if (ver >= 18) return "最近战报战术无效"; // v18 起战术为必填，缺则残缺新档
  } else if (!["normal", "break", "guard"].includes(b.tactic as string)) {
    return "最近战报战术无效";
  }
  for (const k of ["mapName", "enemyName", "difficulty"]) {
    if (typeof b[k] !== "string") return "最近战报字段无效";
  }
  if (!Number.isInteger(b.maxRounds) || (b.maxRounds as number) < 0) return "最近战报回合上限无效";
  if (!Number.isInteger(b.rounds) || (b.rounds as number) < 0) return "最近战报回合数无效";
  if (typeof b.roundLimitReached !== "boolean") return "最近战报限制标记无效";
  if (!isNonNegFinite(b.at)) return "最近战报时间无效";
  for (const side of ["player", "enemy"]) {
    const o = b[side] as Record<string, unknown> | undefined;
    if (!o || typeof o !== "object") return "最近战报双方数据无效";
    for (const k of ["attack", "defense", "hp", "hpAfter"]) {
      if (!isNonNegFinite(o[k])) return "最近战报双方属性无效";
    }
  }
  const events = b.events;
  if (!Array.isArray(events) || events.length > BATTLE_REPORT_CFG.maxEvents) return "最近战报回合记录无效";
  for (const ev of events as unknown[]) {
    const e = ev as Record<string, unknown>;
    if (!e || typeof e !== "object") return "最近战报回合记录无效";
    if (!Number.isInteger(e.round) || (e.round as number) < 0) return "最近战报回合序号无效";
    if (e.actor !== "player" && e.actor !== "enemy") return "最近战报行动方无效";
    if (!["attack", "crit", "regen", "low_hp", "limit"].includes(e.kind as string)) return "最近战报行动类型无效";
    if (typeof e.amount !== "number" || !Number.isFinite(e.amount)) return "最近战报行动数值无效";
    if (!isNonNegFinite(e.playerHpAfter) || !isNonNegFinite(e.enemyHpAfter)) return "最近战报剩余气血无效";
    if (typeof e.text !== "string") return "最近战报行动描述无效";
    if (e.key !== undefined && typeof e.key !== "boolean") return "最近战报关键标记无效";
  }
  const keyEvents = b.keyEvents;
  if (!Array.isArray(keyEvents) || keyEvents.length > BATTLE_REPORT_CFG.maxKeyEvents) return "最近战报关键事件无效";
  if ((keyEvents as unknown[]).some((x) => typeof x !== "string")) return "最近战报关键事件无效";
  const rewardLines = b.rewardLines;
  if (!Array.isArray(rewardLines) || (rewardLines as unknown[]).some((x) => typeof x !== "string")) return "最近战报奖励无效";
  if (b.noRewardNote !== undefined && typeof b.noRewardNote !== "string") return "最近战报奖励说明无效";
  return null;
}

function validateCommissionItem(c: unknown): string | null {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "委托数据无效";
  const o = c as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return "委托 ID 无效";
  if (o.kind !== "battle" && o.kind !== "craft") return "委托类型无效";
  if (typeof o.title !== "string" || !o.title.trim()) return "委托标题无效";
  if (o.kind === "battle") {
    if (typeof o.mapId !== "string" || !MAP_CFG[o.mapId as MapId]) return "委托地图无效";
    if (typeof o.nodeId !== "string" || !MAP_CFG[o.mapId as MapId]?.nodes[o.nodeId]) return "委托节点无效";
    if (o.difficulty !== undefined && o.difficulty !== "normal" && o.difficulty !== "challenge") return "委托难度无效";
  }
  if (o.kind === "craft") {
    if (typeof o.action !== "string") return "委托动作无效";
    if (o.actionParam !== undefined && typeof o.actionParam !== "string") return "委托动作参数无效";
  }
  if (!Number.isInteger(o.target) || (o.target as number) < 1) return "委托目标无效";
  if (!Number.isInteger(o.progress) || (o.progress as number) < 0 || (o.progress as number) > (o.target as number)) return "委托进度无效";
  if (!["accepted", "ready", "claimed"].includes(o.status as string)) return "委托状态无效";
  for (const key of ["rewardA", "rewardB"]) {
    const r = o[key] as Record<string, unknown> | undefined;
    if (!r || typeof r !== "object") return "委托奖励无效";
    for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page", "iron"]) {
      if (!isNonNegFinite(r[k])) return "委托奖励无效";
    }
  }
  if (o.rewardChoice !== undefined && o.rewardChoice !== "a" && o.rewardChoice !== "b") return "委托奖励选择无效";
  if (o.claimedAt !== undefined && !isNonNegFinite(o.claimedAt)) return "委托领奖时间无效";
  if (o.response !== undefined && typeof o.response !== "string") return "委托回应无效";
  // 状态与领奖字段一致性：只有已领奖才允许携带奖励选择/时间
  if (o.status === "claimed") {
    if (o.rewardChoice === undefined || o.claimedAt === undefined) return "已领奖委托缺领奖信息";
  } else if (o.rewardChoice !== undefined || o.claimedAt !== undefined) {
    return "未领奖委托不应含领奖信息";
  }
  return null;
}

function validateCommission(v: unknown, ver: number): string | null {
  if (v === undefined || v === null) {
    return ver < 18 ? null : "委托数据缺失"; // v18 起委托为必填字段
  }
  if (typeof v !== "object") return "委托数据无效";
  const o = v as Record<string, unknown>;
  if (typeof o.date !== "string" || !isValidDateStr(o.date)) return "委托日期无效";
  const candidates = o.candidates;
  if (!Array.isArray(candidates) || candidates.length > COMMISSION_CFG.dailyCandidates) return "委托候选无效";
  for (const c of candidates as unknown[]) {
    const err = validateCommissionItem(c);
    if (err) return err;
  }
  if (o.active !== null && o.active !== undefined) {
    const err = validateCommissionItem(o.active);
    if (err) return err;
  }
  const history = o.history;
  if (!Array.isArray(history)) return "委托历史无效";
  for (const c of history as unknown[]) {
    const err = validateCommissionItem(c);
    if (err) return err;
  }
  // 进行中与历史不得共用同一实例身份（防止把已领奖记录复制为 active 再领奖）
  if (o.active && typeof o.active === "object") {
    const aid = (o.active as Record<string, unknown>).id as string;
    if (history.some((h) => (h as Record<string, unknown>).id === aid)) return "进行中与历史委托冲突";
  }
  return null;
}

function validateMilestonesAndFirsts(milestones: unknown, firsts: unknown): string | null {
  if (milestones !== undefined && !Array.isArray(milestones)) return "修仙录数据无效";
  if (Array.isArray(milestones)) {
    for (const item of milestones) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "修仙录记录无效";
      const m = item as Record<string, unknown>;
      if (typeof m.type !== "string" || typeof m.text !== "string" ||
        typeof m.time !== "number" || !Number.isFinite(m.time) || m.time < 0) return "修仙录记录无效";
    }
  }
  if (firsts !== undefined) {
    if (!firsts || typeof firsts !== "object" || Array.isArray(firsts)) return "首玩目标数据无效";
    const f = firsts as Record<string, unknown>;
    for (const k of ["settledOnce", "suppressedFirstNodeOnce", "viewedTribPreviewOnce"]) {
      if (f[k] !== undefined && typeof f[k] !== "boolean") return "首玩目标数据无效";
    }
  }
  return null;
}

function validateMarrowHistory(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return "洗髓历史数据无效";
  for (const item of v) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "洗髓历史记录无效";
    const m = item as Record<string, unknown>;
    if (typeof m.type !== "string" || typeof m.from !== "string" || typeof m.to !== "string") return "洗髓历史记录无效";
    if (!Number.isFinite(m.spiritStone) || !Number.isFinite(m.herb) || !Number.isFinite(m.at)) return "洗髓历史记录无效";
  }
  return null;
}

function validateSpiritRoots(roots: unknown, spiritRoot: unknown, resonance: unknown): string | null {
  if (roots === undefined || roots === null) return null;
  if (!Array.isArray(roots) || roots.length === 0) return "灵根数据无效";
  const pool = CONFIG.spiritRootPool as unknown as { elements: readonly string[]; variants: readonly string[] };
  const valid = [...pool.elements, ...pool.variants];
  const seen = new Set<string>();
  for (const r of roots) {
    if (typeof r !== "string" || !valid.includes(r)) return "灵根数据无效";
    if (seen.has(r)) return "灵根重复无效";
    seen.add(r);
  }
  const hasVariant = (roots as string[]).some((r) => pool.variants.includes(r));
  if (hasVariant && roots.length !== 1) return "变异灵根不能与其他灵根并存";
  if (resonance !== null && resonance !== undefined) {
    if (typeof resonance !== "string" || !(roots as string[]).includes(resonance)) return "共鸣不属于当前灵根";
  }
  return null;
}

function validateRecentLogs(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.some((line) => typeof line !== "string")) return "修行记录数据无效";
  return null;
}

function validateDaily(v: unknown, schemaVersion: number): string | null {
  if (v === undefined || v === null) return schemaVersion >= REPEAT_REWARDS_INTRO_VERSION ? "每日数据无效" : null;
  const d = v as Record<string, unknown>;
  if (typeof d.date !== "string") return "每日数据日期无效";
  const weather = d.weather as Record<string, unknown> | undefined;
  const astrology = d.astrology as Record<string, unknown> | undefined;
  const goals = d.goals as Record<string, unknown> | undefined;
  const rewardedRepeats = d.rewardedRepeats;
  if (schemaVersion >= REPEAT_REWARDS_INTRO_VERSION || rewardedRepeats !== undefined) {
    if (!Number.isInteger(rewardedRepeats) || (rewardedRepeats as number) < 0 ||
      (rewardedRepeats as number) > CONFIG.rewardedRepeatBattlesPerDay) return "重复历练次数无效";
  }
  if (weather && (typeof weather.id !== "string" || typeof weather.used !== "boolean")) return "天气数据无效";
  if (astrology && (typeof astrology.id !== "string" || typeof astrology.used !== "boolean")) return "星象数据无效";
  if (goals) {
    for (const gid of ["battle", "suppress"]) {
      const g = goals[gid] as Record<string, unknown> | undefined;
      if (g && (typeof g.progress !== "number" || typeof g.claimed !== "boolean")) return "每日目标数据无效";
    }
  }
  return null;
}

function validateSuppressionSince(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = v as Record<string, unknown>;
  for (const mid of Object.keys(MAP_CFG)) {
    const x = s[mid];
    if (x !== undefined && (typeof x !== "number" || !Number.isFinite(x) || x < 0)) return "镇压时间无效";
  }
  return null;
}

function isNonNegNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0;
}

function validateLongTask(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "长期任务数据无效";
  const t = v as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id.trim()) return "长期任务 ID 无效";
  if (typeof t.type !== "string" || !["training", "seclusion"].includes(t.type)) return "长期任务类型无效";
  if (typeof t.difficulty !== "string" || !["steady", "risky"].includes(t.difficulty)) return "长期任务难度无效";
  if (typeof t.protectionUsed !== "boolean") return "长期任务护行阵无效";
  if (
    typeof t.durationMinutes !== "number" ||
    !Number.isInteger(t.durationMinutes) ||
    !(LONG_TASK_CFG.durations as readonly number[]).includes(t.durationMinutes)
  ) {
    return "长期任务时长无效";
  }
  if (typeof t.ruleVersion !== "number" || t.ruleVersion !== LONG_TASK_CFG.ruleVersion) return "长期任务规则版本无效";
  const effMin = t.effectiveMinutes;
  if (typeof effMin !== "number" || !Number.isInteger(effMin) || effMin < 1) return "长期任务实际耗时无效";
  if (!isNonNegNum(t.startAt)) return "长期任务开始时间无效";
  if (!isNonNegNum(t.endAt)) return "长期任务结束时间无效";
  const expectedEnd = (t.startAt as number) + effMin * 60 * 1000;
  if ((t.endAt as number) !== expectedEnd) return "长期任务起止时间与时长不符";

  if (t.type === "training") {
    const mapId = t.mapId as string;
    const nodeId = t.nodeId as string;
    if (!MAP_CFG[mapId as MapId]) return "长期任务地图无效";
    if (!MAP_CFG[mapId as MapId].nodes[nodeId]) return "长期任务节点无效";
  } else {
    if (t.mapId !== undefined && t.mapId !== null) return "闭关任务不应含地图";
    if (t.nodeId !== undefined && t.nodeId !== null) return "闭关任务不应含节点";
  }

  const snap = t.snapshot as Record<string, unknown> | undefined;
  if (!snap || typeof snap !== "object") return "长期任务快照无效";
  for (const k of ["playerAttack", "playerDefense", "playerHp"]) {
    if (typeof snap[k] !== "number" || !Number.isFinite(snap[k]) || (snap[k] as number) <= 0) return "长期任务快照属性无效";
  }
  for (const k of ["cultivationPerSec", "spiritPerSec"]) {
    if (!isNonNegNum(snap[k])) return "长期任务快照产速无效";
  }
  if (t.type === "training") {
    for (const k of ["enemyAttack", "enemyDefense", "enemyHp"]) {
      if (!isNonNegNum(snap[k])) return "长期任务快照敌方无效";
    }
  }
  const reward = snap.expectedReward as Record<string, unknown> | undefined;
  if (!reward || typeof reward !== "object") return "长期任务快照奖励无效";
  for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
    if (!isNonNegNum(reward[k])) return "长期任务快照奖励无效";
  }
  return null;
}

function validateLongTaskResult(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "任务结果记录无效";
  const r = v as Record<string, unknown>;
  if (typeof r.taskId !== "string" || !r.taskId.trim()) return "任务结果记录无效";
  if (typeof r.type !== "string" || !["training", "seclusion"].includes(r.type)) return "任务结果类型无效";
  if (r.nodeName !== undefined && r.nodeName !== null && typeof r.nodeName !== "string") return "任务结果节点无效";
  if (r.difficulty !== undefined && r.difficulty !== null && (typeof r.difficulty !== "string" || !["steady", "risky"].includes(r.difficulty))) return "任务结果难度无效";
  if (
    typeof r.durationMinutes !== "number" ||
    !Number.isInteger(r.durationMinutes) ||
    !(LONG_TASK_CFG.durations as readonly number[]).includes(r.durationMinutes)
  ) {
    return "任务结果时长无效";
  }
  const reward = r.reward as Record<string, unknown> | undefined;
  if (!reward || typeof reward !== "object") return "任务结果奖励无效";
  for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
    if (!isNonNegNum(reward[k])) return "任务结果奖励无效";
  }
  if (typeof r.completedAt !== "number" || !Number.isFinite(r.completedAt)) return "任务结果时间无效";
  if (typeof r.aborted !== "boolean") return "任务结果状态无效";
  return null;
}

function validateAptitude(v: unknown): string | null {
  if (v === undefined || v === null) return null; // 旧档缺失，迁移补均衡
  if (!(Object.keys(APTITUDE_CFG) as string[]).includes(v as string)) return "资质无效";
  return null;
}

function validateBreakthroughFails(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "进阶保底数据无效";
  const o = v as Record<string, unknown>;
  for (const k of BREAKTHROUGH_LAYERS) {
    const x = o[k];
    if (x !== undefined && (!Number.isInteger(x) || (x as number) < 0 || (x as number) > 2)) return "进阶保底数据无效";
  }
  return null;
}

function validateBreakthroughRecords(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return "进阶记录无效";
  for (const r of v as unknown[]) {
    if (!r || typeof r !== "object") return "进阶记录无效";
    const rec = r as Record<string, unknown>;
    if (!BREAKTHROUGH_LAYERS.includes(rec.layer as BreakthroughLayer)) return "进阶记录层级无效";
    if (rec.method !== "steady" && rec.method !== "risky") return "进阶记录方式无效";
    if (typeof rec.success !== "boolean") return "进阶记录结果无效";
    if (typeof rec.probability !== "number" || !Number.isFinite(rec.probability) || (rec.probability as number) < 0 || (rec.probability as number) > 1) return "进阶记录概率无效";
    const cost = rec.cost as Record<string, unknown> | undefined;
    if (!cost || typeof cost !== "object") return "进阶记录成本无效";
    for (const k of ["cultivation", "spirit", "spiritStone", "herb", "page"]) {
      if (!isNonNegNum(cost[k])) return "进阶记录成本无效";
    }
    if (typeof rec.at !== "number" || !Number.isFinite(rec.at)) return "进阶记录时间无效";
  }
  return null;
}

function validateJindanTrial(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "结丹试炼记录无效";
  const r = v as Record<string, unknown>;
  if (!isNonNegNum(r.maxHp)) return "结丹试炼记录气血无效";
  if (!isNonNegNum(r.reduction) || (r.reduction as number) > 1) return "结丹试炼记录减伤无效";
  if (typeof r.pillUsed !== "boolean") return "结丹试炼记录丹药无效";
  if (typeof r.success !== "boolean") return "结丹试炼记录结果无效";
  if (!Array.isArray(r.waves) || r.waves.length !== TRIAL_CFG[2].wavesPct.length) return "结丹试炼记录波次无效";
  for (const w of r.waves as unknown[]) {
    const wv = w as Record<string, unknown>;
    if (!wv || !isNonNegNum(wv.damage) || !isNonNegNum(wv.hpAfter)) return "结丹试炼记录波次无效";
  }
  if (!Array.isArray(r.log)) return "结丹试炼记录日志无效";
  for (const l of r.log as unknown[]) {
    if (typeof l !== "string") return "结丹试炼记录日志无效";
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
  if (typeof ver !== "number" || ver < 1 || ver > SCHEMA_VERSION) {
    return fail(`存档版本不兼容（支持版本 1～${SCHEMA_VERSION}）`);
  }
  migrateRealmRefs(o, ver);
  if (typeof o.name !== "string" || !o.name.trim()) return fail("存档缺少姓名");
  if (!realmOrder.includes(o.realm as RealmId)) return fail("境界无效");
  if (typeof o.lastSettledAt !== "number" || !Number.isFinite(o.lastSettledAt)) return fail("时间数据无效");

  const checks: Array<string | null> = [
    validateResources(o.resources, ver),
    validateForge(o.forge, ver),
    validateBuildings(o.buildings),
    validateTechnique(o.technique, o.techniqueLevel, o.library),
    validateLibrary(o.library),
    validateAuxiliaryTechnique(o.technique, o.auxiliaryTechnique, o.library),
    validateSecretRealm(o.secretRealmUsed, o.secretRealmLog, o.secretRealmDate, ver),
    validateItemInstances(o, ver),
    validateEquipmentAndInventory(o.equipment, o.inventory, o.itemInstances),
    validateMaps(o.maps, o.suppression, ver),
    validateEncounter(o.encounter),
    validateMilestonesAndFirsts(o.milestones, o.firsts),
    validateMarrowHistory(o.marrowHistory),
    validateSpiritRoots(o.spiritRoots, o.spiritRoot, o.resonance),
    validateRecentLogs(o.recentLogs),
    validateDaily(o.daily, ver),
    validateSuppressionSince(o.suppressionSince),
    validateLongTask(o.longTask),
    validateLongTaskResult(o.lastLongTaskResult),
    validateAptitude(o.aptitude),
    validateBreakthroughFails(o.breakthroughFails),
    validateBreakthroughRecords(o.breakthroughRecords),
    validateJindanTrial(o.jindanTrial),
    validateLastBattle(o.lastBattle, ver),
    validateCommission(o.commission, ver),
  ];
  for (const c of checks) if (c) return fail(c);

  const s = normalizeSave(o);
  return { state: s, ok: true };
}

function normalizeSave(o: Record<string, unknown>): SaveState {
  const base = createGame(o.name as string, validSpiritRoot(o.spiritRoot), validAptitude(o.aptitude), o.lastSettledAt as number);
  base.id = (o.id as string) || base.id;
  base.resources = { ...base.resources, ...(o.resources as Resources) };
  base.realm = o.realm as RealmId;
  base.buildings = { ...base.buildings, ...((o.buildings as Partial<SaveState["buildings"]>) || {}) };
  base.technique = (o.technique as TechniqueId | null) ?? null;
  base.techniqueLevel = { ...base.techniqueLevel, ...((o.techniqueLevel as Partial<SaveState["techniqueLevel"]>) || {}) };
  base.equipment = { ...base.equipment, ...((o.equipment as Partial<SaveState["equipment"]>) || {}) };
  base.inventory = { ...base.inventory, ...((o.inventory as Record<string, number>) || {}) };
  base.preparedPill = !!o.preparedPill;
  base.preparedPillTier = Number.isInteger(o.preparedPillTier) && (o.preparedPillTier as number) >= 1 && (o.preparedPillTier as number) <= 4 ? (o.preparedPillTier as number) : 1;
  base.quenched = Array.isArray(o.quenched) ? (o.quenched as string[]) : [];
  base.learnedNewTechs = Array.isArray(o.learnedNewTechs) ? (o.learnedNewTechs as string[]) : [];
  base.spiritRoots = Array.isArray(o.spiritRoots) && o.spiritRoots.length > 0 ? (o.spiritRoots as string[]) : [base.spiritRoot];
  base.meridians = typeof o.meridians === "string" && (o.meridians as string) in MERIDIAN_CFG ? (o.meridians as MeridianId) : "normal";
  base.comprehension = typeof o.comprehension === "string" && (o.comprehension as string) in COMPREHENSION_CFG ? (o.comprehension as ComprehensionId) : "normal";
  base.resonance = typeof o.resonance === "string" ? (o.resonance as string) : null;
  base.marrowHistory = Array.isArray(o.marrowHistory) ? (o.marrowHistory as SaveState["marrowHistory"]) : [];
  base.itemInstances = (o.itemInstances && typeof o.itemInstances === "object") ? (o.itemInstances as SaveState["itemInstances"]) : {};
  base.lockedAffixes = (o.lockedAffixes && typeof o.lockedAffixes === "object") ? (o.lockedAffixes as Record<string, string>) : {};
  if (Object.keys(base.itemInstances).length === 0) {
    (base as unknown as Record<string, unknown>).equipmentAffixes = (o.equipmentAffixes && typeof o.equipmentAffixes === "object") ? o.equipmentAffixes : {};
  }
  base.maps = { ...base.maps, ...((o.maps as Partial<SaveState["maps"]>) || {}) };
  base.suppression = { ...base.suppression, ...((o.suppression as Partial<SaveState["suppression"]>) || {}) };
  base.encounter = { ...base.encounter, ...((o.encounter as Partial<SaveState["encounter"]>) || {}) };
  base.tribulationLog = (o.tribulationLog as TribulationLog | null) ?? null;
  base.jindanTrial = (o.jindanTrial as TribulationLog | null) ?? null;
  base.library = typeof o.library === "number" ? (o.library as number) : 0;
  base.forge = typeof o.forge === "number" ? (o.forge as number) : 0;
  base.auxiliaryTechnique = (o.auxiliaryTechnique as TechniqueId | null) ?? null;
  base.secretRealmDate = typeof o.secretRealmDate === "string" ? (o.secretRealmDate as string) : todayStr(Date.now());
  base.secretRealmUsed = { ...emptySecretRealmUsed(), ...((o.secretRealmUsed as Partial<SaveState["secretRealmUsed"]>) || {}) };
  base.secretRealmLog = Array.isArray(o.secretRealmLog) ? (o.secretRealmLog as SaveState["secretRealmLog"]) : [];
  base.recentLogs = Array.isArray(o.recentLogs) ? (o.recentLogs as string[]).slice(-20) : base.recentLogs;
  base.milestones = Array.isArray(o.milestones) ? (o.milestones as Milestone[]) : [];
  base.firsts = { ...base.firsts, ...((o.firsts as Partial<SaveState["firsts"]>) || {}) };
  const rawDaily = o.daily as Record<string, unknown> | undefined;
  const hasNewDaily = !!rawDaily && typeof rawDaily.weather === "object" && typeof rawDaily.astrology === "object";
  base.daily = hasNewDaily ? (rawDaily as unknown as DailyState) : emptyDaily(todayStr(Date.now()));
  base.suppressionSince = { ...emptySuppressionSince(), ...((o.suppressionSince as Partial<SaveState["suppressionSince"]>) || {}) };
  base.longTask = (o.longTask as LongTask | null) ?? null;
  base.lastLongTaskResult = (o.lastLongTaskResult as LongTaskResult | null) ?? null;
  base.lastBattle = (o.lastBattle as LastBattle | null) ?? null;
  base.commission = { ...base.commission, ...((o.commission as Partial<SaveState["commission"]>) || {}) };
  if (o.commission === undefined || o.commission === null) {
    // 旧档（v17 及更早）没有委托：按导入后的真实境界/地图重新生成候选，而不是沿用新建角色的默认候选
    base.commission.candidates = generateCandidates(base);
  }
  base.aptitude = validAptitude(o.aptitude);
  base.breakthroughFails = { ...base.breakthroughFails, ...((o.breakthroughFails as Record<string, number>) || {}) };
  base.breakthroughRecords = Array.isArray(o.breakthroughRecords) ? (o.breakthroughRecords as BreakthroughRecord[]) : [];
  base.lastSettledAt = o.lastSettledAt as number;
  base.revision = ((o.revision as number) || 0) + 1;
  return migrateSave(base);
}
