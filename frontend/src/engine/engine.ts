import { CONFIG } from "./config";
import type {
  AptitudeId,
  BreakthroughLayer,
  BreakthroughMethod,
  BreakthroughRecord,
  BuildingId,
  DailyState,
  LongTask,
  LongTaskDifficulty,
  LongTaskResult,
  LongTaskType,
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

export const SCHEMA_VERSION = 5;

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

const BREAKTHROUGH_LAYERS: BreakthroughLayer[] = ["qi1", "qi2", "qi3"];

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

function battleDamageMult(s: SaveState): number {
  return !s.daily.astrology.used && s.daily.astrology.id === "war" ? 1.2 : 1;
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
  return { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0 };
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
  const defense = base.defense + (protection ? LONG_TASK_CFG.protectionDefense : 0);
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
  s.longTask = {
    id: randomId(),
    type: params.type,
    mapId: params.type === "training" ? mapId : undefined,
    nodeId: params.type === "training" ? nodeId : undefined,
    difficulty,
    protectionUsed: params.protection,
    durationMinutes: duration,
    startAt: nowMs,
    endAt: nowMs + duration * 60 * 1000,
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
  maps[MAP_ORDER[0]][Object.keys(MAP_CFG[MAP_ORDER[0]].nodes)[0]].unlocked = true;
  const apt = validAptitude(aptitude);
  const state: SaveState = {
    schemaVersion: SCHEMA_VERSION,
    id: randomId(),
    name,
    spiritRoot: validSpiritRoot(spiritRoot),
    aptitude: apt,
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
    recentLogs: [`入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}，资质${APTITUDE_CFG[apt].name}。`],
    milestones: [{ type: "create", time: nowMs, text: `入道青云，名「${name}」，灵根属${validSpiritRoot(spiritRoot)}，资质${APTITUDE_CFG[apt].name}` }],
    firsts: { settledOnce: false, suppressedFirstNodeOnce: false, viewedTribPreviewOnce: false },
    daily: emptyDaily(todayStr(nowMs)),
    suppressionSince: { map_qingyun: 0, map_nether: 0 },
    longTask: null,
    lastLongTaskResult: null,
    breakthroughFails: { qi1: 0, qi2: 0, qi3: 0 },
    breakthroughRecords: [],
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

function aptitudeCultivationMult(s: SaveState): number {
  return APTITUDE_CFG[s.aptitude]?.cultivationMult ?? 1;
}
function aptitudeSpiritMult(s: SaveState): number {
  return APTITUDE_CFG[s.aptitude]?.spiritMult ?? 1;
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
  const cultBuilding = buildingCultivationMult(state);
  const cultTech = techniqueCultivationMult(state);
  const cultApt = aptitudeCultivationMult(state);
  const spiritBuilding = buildingSpiritMult(state);
  const spiritApt = aptitudeSpiritMult(state);
  const aptName = APTITUDE_CFG[state.aptitude]?.name ?? "均衡";
  const herb = spiritFieldRate(state);
  const stone = suppressionRate(state);
  const cultivationPerSec = CONFIG.baseCultivationPerSecond * cultBuilding * cultTech * cultApt;
  const spiritPerSec = CONFIG.baseSpiritPerSecond * spiritBuilding * spiritApt;
  const w = CONFIG.weathers[state.daily.weather.id as keyof typeof CONFIG.weathers];
  const a = CONFIG.astrologies[state.daily.astrology.id as keyof typeof CONFIG.astrologies];
  const lines: string[] = [
    `天气·${w.name}：${w.desc}${state.daily.weather.used ? "（已用）" : ""}`,
    `星象·${a.name}：${a.desc}${state.daily.astrology.used ? "（已用）" : ""}`,
    `资质·${aptName}：修为 ×${n1(cultApt)}、灵气 ×${n1(spiritApt)}`,
    `修为 ${n1(cultivationPerSec)}/秒（基础 ${n1(CONFIG.baseCultivationPerSecond)} × 资质 ${n1(cultApt)}${cultBuilding > 1 ? ` × 修炼室 ${n1(cultBuilding)}` : ""}${cultTech > 1 ? ` × 功法 ${n1(cultTech)}` : ""}）`,
    `灵气 ${n1(spiritPerSec)}/秒（基础 ${n1(CONFIG.baseSpiritPerSecond)} × 资质 ${n1(spiritApt)}${spiritBuilding > 1 ? ` × 聚灵阵 ${n1(spiritBuilding)}` : ""}）`,
    herb > 0 ? `灵草 ${n1(herb)}/秒（灵田）` : "灵草 0/秒（未建灵田）",
    stone > 0 ? `灵石 ${n1(stone)}/秒（镇压产出）` : "灵石 0/秒（未镇压节点）",
  ];
  return { cultivationPerSec, spiritPerSec, herbPerSec: herb, spiritStonePerSec: stone, lines };
}

// ---- 时间结算 ----

export function settle(state: SaveState, nowMs: number): SaveState {
  const s = structuredClone(state);
  ensureDaily(s, nowMs);

  const capMs = CONFIG.offlineCapHours * 3600 * 1000;
  const from = s.lastSettledAt;
  const to = Math.min(nowMs, from + capMs);
  const deltaMs = Math.max(0, to - from);
  const deltaSec = deltaMs / 1000;

  const cultMult = buildingCultivationMult(s) * techniqueCultivationMult(s) * aptitudeCultivationMult(s);
  const spiritMult = buildingSpiritMult(s) * aptitudeSpiritMult(s);
  const herbRate = spiritFieldRate(s);

  let spiritStoneGain = 0;
  const durMs = CONFIG.suppressionDurationHours * 3600 * 1000;
  for (const mid of Object.keys(MAP_CFG) as MapId[]) {
    const nodeId = s.suppression[mid];
    if (!nodeId) continue;
    const rate = MAP_CFG[mid].nodes[nodeId].suppressRate;
    const since = s.suppressionSince[mid] || 0;
    if (since <= 0) {
      spiritStoneGain += rate * deltaSec;
      continue;
    }
    const expiresAt = since + durMs;
    if (expiresAt <= from) {
      s.suppression[mid] = null;
      s.suppressionSince[mid] = 0;
      s.recentLogs.push(`${MAP_CFG[mid].nodes[nodeId].name}妖气复聚，镇压失效。`);
    } else if (expiresAt > to) {
      spiritStoneGain += rate * deltaSec;
    } else {
      spiritStoneGain += rate * (expiresAt - from) / 1000;
      s.suppression[mid] = null;
      s.suppressionSince[mid] = 0;
      s.recentLogs.push(`${MAP_CFG[mid].nodes[nodeId].name}妖气复聚，镇压失效。`);
    }
  }

  s.resources.cultivation += CONFIG.baseCultivationPerSecond * cultMult * deltaSec;
  s.resources.spirit += CONFIG.baseSpiritPerSecond * spiritMult * deltaSec;
  s.resources.herb += herbRate * deltaSec;
  s.resources.spiritStone += spiritStoneGain;
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
  return Math.min(1, BREAKTHROUGH_CFG.riskyBaseRate + BREAKTHROUGH_CFG.riskyFailBoost * (state.breakthroughFails?.[layer] ?? 0));
}

export function breakthrough(state: SaveState, nowMs: number, method: BreakthroughMethod = "steady", rng: () => number = Math.random): Result<SaveState> {
  const s = settle(state, nowMs);
  if (s.realm === "foundation1") return fail("已至本版最高境界");
  if (s.realm === "qi4") return fail("炼气圆满需渡劫方可筑基，请先查看劫势");
  const layer = s.realm as BreakthroughLayer;
  if (!BREAKTHROUGH_LAYERS.includes(layer)) return fail("当前境界不可小进阶");
  const next = REALMS[realmIndex(layer) + 1];
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
  dmgMult = 1,
): { won: boolean; log: string[] } {
  const log: string[] = [];
  let pHp = stats.hp;
  let eHp = enemy.hp;
  let playerTurn = true;
  let won = false;
  let guard = 0;
  while (guard++ < 100) {
    if (playerTurn) {
      const dmg = Math.max(1, Math.round((stats.attack - enemy.defense) * dmgMult));
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
  const stats = playerStats(state);
  const battle = runBattle(stats, nodeCfg.enemy, battleDamageMult(state));
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

  const stats = playerStats(s);
  const dmgMult = battleDamageMult(s);
  const battle = runBattle(stats, nodeCfg.enemy, dmgMult);
  const log = battle.log;
  const won = battle.won;
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
  const r = opt.reward;
  if (r.cultivation) s.resources.cultivation += r.cultivation;
  if (r.spirit) s.resources.spirit += r.spirit;
  if (r.spiritStone) s.resources.spiritStone += r.spiritStone;
  if (r.herb) s.resources.herb += r.herb;
  if (r.page) s.resources.page += r.page;
  s.encounter.pending = null;
  s.recentLogs.push(`际遇「${evt.title}」已定，选择「${opt.label}」。`);
  pushMilestone(s, "encounter", nowMs, `际遇「${evt.title}」`);
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
  const rawDaily = s.daily as Record<string, unknown> | undefined;
  const hasNewDaily = !!rawDaily && typeof rawDaily.weather === "object" && typeof rawDaily.astrology === "object";
  if (!hasNewDaily) {
    s.daily = emptyDaily(todayStr(Date.now()));
  }
  const lastSettled = (s.lastSettledAt as number) || Date.now();
  if (!s.suppressionSince || typeof s.suppressionSince !== "object") {
    s.suppressionSince = {
      map_qingyun: suppression["map_qingyun"] ? lastSettled : 0,
      map_nether: suppression["map_nether"] ? lastSettled : 0,
    };
  }
  if (s.longTask === undefined) s.longTask = null;
  if (s.lastLongTaskResult === undefined) s.lastLongTaskResult = null;
  if (s.aptitude === undefined) s.aptitude = "balanced";
  if (!s.breakthroughFails || typeof s.breakthroughFails !== "object") s.breakthroughFails = { qi1: 0, qi2: 0, qi3: 0 };
  if (!Array.isArray(s.breakthroughRecords)) s.breakthroughRecords = [];
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

function validateDaily(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.date !== "string") return "每日数据日期无效";
  const weather = d.weather as Record<string, unknown> | undefined;
  const astrology = d.astrology as Record<string, unknown> | undefined;
  const goals = d.goals as Record<string, unknown> | undefined;
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
  if (!isNonNegNum(t.startAt)) return "长期任务开始时间无效";
  if (!isNonNegNum(t.endAt)) return "长期任务结束时间无效";
  const expectedEnd = (t.startAt as number) + (t.durationMinutes as number) * 60 * 1000;
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
    validateDaily(o.daily),
    validateSuppressionSince(o.suppressionSince),
    validateLongTask(o.longTask),
    validateLongTaskResult(o.lastLongTaskResult),
    validateAptitude(o.aptitude),
    validateBreakthroughFails(o.breakthroughFails),
    validateBreakthroughRecords(o.breakthroughRecords),
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
  base.maps = { ...base.maps, ...((o.maps as Partial<SaveState["maps"]>) || {}) };
  base.suppression = { ...base.suppression, ...((o.suppression as Partial<SaveState["suppression"]>) || {}) };
  base.encounter = { ...base.encounter, ...((o.encounter as Partial<SaveState["encounter"]>) || {}) };
  base.tribulationLog = (o.tribulationLog as TribulationLog | null) ?? null;
  base.recentLogs = Array.isArray(o.recentLogs) ? (o.recentLogs as string[]).slice(-20) : base.recentLogs;
  base.milestones = Array.isArray(o.milestones) ? (o.milestones as Milestone[]) : [];
  base.firsts = { ...base.firsts, ...((o.firsts as Partial<SaveState["firsts"]>) || {}) };
  const rawDaily = o.daily as Record<string, unknown> | undefined;
  const hasNewDaily = !!rawDaily && typeof rawDaily.weather === "object" && typeof rawDaily.astrology === "object";
  base.daily = hasNewDaily ? (rawDaily as unknown as DailyState) : emptyDaily(todayStr(Date.now()));
  base.suppressionSince = { map_qingyun: 0, map_nether: 0, ...((o.suppressionSince as Partial<SaveState["suppressionSince"]>) || {}) };
  base.longTask = (o.longTask as LongTask | null) ?? null;
  base.lastLongTaskResult = (o.lastLongTaskResult as LongTaskResult | null) ?? null;
  base.aptitude = validAptitude(o.aptitude);
  base.breakthroughFails = { qi1: 0, qi2: 0, qi3: 0, ...((o.breakthroughFails as Partial<SaveState["breakthroughFails"]>) || {}) };
  base.breakthroughRecords = Array.isArray(o.breakthroughRecords) ? (o.breakthroughRecords as BreakthroughRecord[]) : [];
  base.lastSettledAt = o.lastSettledAt as number;
  base.revision = ((o.revision as number) || 0) + 1;
  return base;
}
