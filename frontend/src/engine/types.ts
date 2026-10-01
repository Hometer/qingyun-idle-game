export type RealmStagePrefix =
  | "qi" | "zhuji" | "jindan" | "yuanying" | "huashen" | "lianxu" | "heti" | "dacheng"
  | "dujie" | "zhenxian" | "xuanxian" | "jinxian" | "taiyi" | "daluo" | "hunyuan"
  | "hunyuan_daluo" | "hunyuan_wuji" | "tiandao" | "dadao" | "hongmeng";
export type RealmLayerNum = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";
export type RealmId = `${RealmStagePrefix}${RealmLayerNum}`;
export type SpiritRoot = "金" | "木" | "水" | "火" | "土";
export type MeridianId = "blocked" | "sluggish" | "normal" | "smooth" | "innate"; // 经脉：闭塞/滞涩/平通/通达/天成
export type ComprehensionId = "dull" | "slow" | "normal" | "clever" | "genius"; // 悟性：迟钝/偏慢/平常/聪慧/通明
export type AptitudeId = "balanced" | "focus" | "spirit"; // 均衡 / 凝神 / 聚灵
export type BreakthroughLayer = `${RealmStagePrefix}${Exclude<RealmLayerNum, "10">}`;
export type BreakthroughMethod = "steady" | "risky"; // 稳妥 / 冲关
export type BattleDifficulty = "normal" | "challenge";
export type TacticId = "normal" | "break" | "guard";
export type BuildingId = "cultivationRoom" | "spiritArray" | "spiritField" | "alchemyFurnace";
export type TechniqueId = "qingYun" | "xuanGui" | "poYue" | "juYuan" | "ningYing" | "yunHai" | "buXiu" | "hunYuanGuiYi" | "taiChu";
export type EquipSlot = "weapon" | "armor" | "accessory";
export type ItemId = "tribulationPill";
export type MapId = "map_qingyun" | "map_nether" | "map_yunling" | `map_${RealmStagePrefix}`;
export type SecretRealmId = "realm_herb" | "realm_relic" | "realm_deep" | "realm_soul" | "realm_cloud" | "realm_lotus" | "realm_origin" | "realm_hongmeng";

export const MATERIAL_RESOURCES = ["lingTaiJing", "yunHaiSui", "buXiuJin", "hunYuanYu", "taiChuZiJing"] as const;
export type MaterialResource = typeof MATERIAL_RESOURCES[number];

export interface Resources {
  cultivation: number;
  spirit: number;
  spiritStone: number;
  herb: number;
  page: number;
  iron: number;
  lingTaiJing: number;
  yunHaiSui: number;
  buXiuJin: number;
  hunYuanYu: number;
  taiChuZiJing: number;
}

export interface Equipment {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

export interface NodeState {
  unlocked: boolean;
  cleared: boolean;
}

export type StoryId = "well" | "beast" | "cave";

export interface ContinuityStory {
  storyId: StoryId;        // 故事
  originOptionId: string;  // 玩家当初的原选择（如 well_a）
  originDate: string;      // 完成初始事件的本地日期 YYYY-MM-DD
  stage: "awaiting" | "active"; // awaiting=待触发后续；active=后续已触发、待选择
}

export interface EncounterState {
  pending: { eventId: string; mapId: string } | null;
  triggeredToday: number;
  lastTriggerDate: string; // "YYYY-MM-DD"
  guideDone: boolean;
  continuity: ContinuityStory | null; // 当前挂起的连续际遇（最多一条）
  completedStories: StoryId[]; // 已完整走完的故事（防止重复开启）
}

export interface TribulationWave {
  damage: number;
  hpAfter: number;
}

export interface TribulationLog {
  maxHp: number;
  reduction: number;
  pillUsed: boolean;
  waves: TribulationWave[];
  success: boolean;
  log: string[];
}

export interface Milestone {
  type: string;
  time: number; // epoch ms
  text: string;
}

export interface Firsts {
  settledOnce: boolean;
  suppressedFirstNodeOnce: boolean;
  viewedTribPreviewOnce: boolean;
}

export interface DailyGoalState {
  progress: number;
  claimed: boolean;
}

export interface DailyGoals {
  battle: DailyGoalState;
  suppress: DailyGoalState;
}

export interface DailyState {
  date: string;
  weather: { id: string; used: boolean };
  astrology: { id: string; used: boolean };
  goals: DailyGoals;
  rewardedRepeats: number;
  rewardedDan: number;
}

export type LongTaskType = "training" | "seclusion";
export type LongTaskDifficulty = "steady" | "risky";

export interface LongTask {
  id: string;
  type: LongTaskType;
  mapId?: MapId;
  nodeId?: string;
  difficulty: LongTaskDifficulty;
  protectionUsed: boolean;
  durationMinutes: number;
  effectiveMinutes: number;
  startAt: number;
  endAt: number;
  ruleVersion: number;
  snapshot: {
    playerAttack: number;
    playerDefense: number;
    playerHp: number;
    cultivationPerSec: number;
    spiritPerSec: number;
    enemyAttack?: number;
    enemyDefense?: number;
    enemyHp?: number;
    expectedReward: Resources;
  };
}

export interface LongTaskResult {
  taskId: string;
  type: LongTaskType;
  nodeName?: string;
  difficulty?: string;
  durationMinutes: number;
  reward: Resources;
  completedAt: number;
  aborted: boolean;
}

export interface BreakthroughRecord {
  layer: BreakthroughLayer;
  method: BreakthroughMethod;
  success: boolean;
  probability: number; // 当次成功率 0.8 / 0.9 / 1.0
  cost: Resources; // 实际扣除
  at: number; // epoch ms
}

export interface SecretRealmLog {
  realm: SecretRealmId;
  won: boolean;
  reward: Resources;
  at: number;
}

export type CommissionKind = "battle" | "craft";
export type CommissionStatus = "accepted" | "ready" | "claimed";

export interface Commission {
  id: string;
  kind: CommissionKind;
  title: string;
  mapId?: MapId;            // battle 目标地图
  nodeId?: string;          // battle 目标节点
  difficulty?: BattleDifficulty; // battle 目标难度
  action?: string;          // craft 动作
  actionParam?: string;     // craft 动作参数
  target: number;           // 需完成次数
  progress: number;         // 已完成次数
  rewardA: Resources;
  rewardB: Resources;
  status: CommissionStatus;
  rewardChoice?: "a" | "b";
  claimedAt?: number;
  response?: string;        // 固定人物后续回应
}

export interface CommissionState {
  date: string;             // 候选生成日期 YYYY-MM-DD
  candidates: Commission[]; // 当日候选（未接取）
  active: Commission | null; // 已接取
  history: Commission[];    // 已领奖
  acceptedDate: string | null; // 当日已接取日期（同日只接一件）
}

export interface BattleRoundEvent {
  round: number; // 第几回合（从 1 起）
  actor: "player" | "enemy";
  kind: "attack" | "crit" | "regen" | "low_hp" | "limit";
  amount: number; // 伤害或回复量
  playerHpAfter: number;
  enemyHpAfter: number;
  text: string;
  key?: boolean; // 是否为关键事件（暴击/回血/低血增伤）
}

export interface LastBattle {
  won: boolean;
  kind: "map" | "secret";
  mapName: string;
  enemyName: string;
  difficulty: string; // normal / challenge / secret
  tactic: TacticId; // 所选战术（挑战战时有效；其余为 normal）
  maxRounds: number;
  roundLimitReached: boolean;
  rounds: number; // 实际回合数
  player: { attack: number; defense: number; hp: number; hpAfter: number };
  enemy: { attack: number; defense: number; hp: number; hpAfter: number };
  events: BattleRoundEvent[]; // 逐回合精简记录（有界）
  keyEvents: string[]; // 实际发生的关键事件描述
  rewardLines: string[]; // 实际获得奖励（人话）
  noRewardNote?: string; // 如「本次无重复奖励」
  at: number;
}

export interface SaveState {
  schemaVersion: number;
  id: string;
  name: string;
  spiritRoot: SpiritRoot;
  spiritRoots: string[]; // 灵根组合（五行不重复；变异单元素）
  meridians: MeridianId; // 经脉档
  comprehension: ComprehensionId; // 悟性档
  resonance: string | null; // 当前启用共鸣（五行或变异），未启用为 null
  marrowHistory: Array<{ type: string; from: string; to: string; spiritStone: number; herb: number; at: number }>; // 洗髓历史
  resources: Resources;
  realm: RealmId;
  buildings: Record<BuildingId, number>;
  technique: TechniqueId | null;
  techniqueLevel: Record<TechniqueId, number>;
  equipment: Equipment;
  inventory: Record<string, number>; // 装备实例 ID → 数量（每件 1）；丹药按基础 ID
  preparedPill: boolean;
  preparedPillTier: number; // 预置护劫丹品阶 1~4（凡/灵/仙/道）
  quenched: string[]; // 已淬炼装备实例 ID，每件最多一次
  itemInstances: Record<string, { baseId: string; affixes: Affix[] }>; // 装备实例 ID → 基础装备 + 词条
  lockedAffixes: Record<string, string>; // 实例 ID → 锁定词条 ID（每件最多一条）
  learnedNewTechs: string[]; // 已首通获得的新功法 ID
  maps: Record<MapId, Record<string, NodeState>>;
  suppression: Record<MapId, string | null>;
  encounter: EncounterState;
  tribulationLog: TribulationLog | null;
  recentLogs: string[];
  milestones: Milestone[];
  firsts: Firsts;
  daily: DailyState;
  suppressionSince: Record<MapId, number>;
  longTask: LongTask | null;
  lastLongTaskResult: LongTaskResult | null;
  lastSettledAt: number; // epoch ms
  revision: number;
  aptitude: AptitudeId;
  breakthroughFails: Partial<Record<BreakthroughLayer, number>>; // 每层保底计数 0~2
  breakthroughRecords: BreakthroughRecord[];
  jindanTrial: TribulationLog | null;
  yuanyingTrial: TribulationLog | null;
  library: number; // 藏经阁等级 0/1/2
  auxiliaryTechnique: TechniqueId | null; // 辅修功法，与主修不能相同
  secretRealmDate: string;
  secretRealmUsed: Record<SecretRealmId, boolean>;
  secretRealmLog: SecretRealmLog[];
  forge: number; // 炼器台等级 0/1
  lastBattle: LastBattle | null;
  commission: CommissionState;
}

export type Result<T> =
  | { state: T; ok: true }
  | { state?: undefined; ok: false; reason: string };

export interface Affix {
  id: string;
  value: number;
}
