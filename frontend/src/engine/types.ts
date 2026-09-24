export type RealmId = "qi1" | "qi2" | "qi3" | "qi4" | "foundation1";
export type SpiritRoot = "金" | "木" | "水" | "火" | "土";
export type BuildingId = "cultivationRoom" | "spiritArray" | "spiritField" | "alchemyFurnace";
export type TechniqueId = "qingYun" | "xuanGui";
export type EquipSlot = "weapon" | "armor" | "accessory";
export type ItemId = "tribulationPill";
export type MapId = "map_qingyun" | "map_nether";

export interface Resources {
  cultivation: number;
  spirit: number;
  spiritStone: number;
  herb: number;
  page: number;
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

export interface EncounterState {
  pending: { eventId: string; mapId: string } | null;
  triggeredToday: number;
  lastTriggerDate: string; // "YYYY-MM-DD"
  guideDone: boolean;
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

export interface SaveState {
  schemaVersion: number;
  id: string;
  name: string;
  spiritRoot: SpiritRoot;
  resources: Resources;
  realm: RealmId;
  buildings: Record<BuildingId, number>;
  technique: TechniqueId | null;
  techniqueLevel: Record<TechniqueId, number>;
  equipment: Equipment;
  inventory: Record<string, number>;
  preparedPill: boolean;
  maps: Record<MapId, Record<string, NodeState>>;
  suppression: Record<MapId, string | null>;
  encounter: EncounterState;
  tribulationLog: TribulationLog | null;
  recentLogs: string[];
  milestones: Milestone[];
  firsts: Firsts;
  lastSettledAt: number; // epoch ms
  revision: number;
}

export type Result<T> =
  | { state: T; ok: true }
  | { state?: undefined; ok: false; reason: string };
