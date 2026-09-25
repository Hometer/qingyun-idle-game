import { CONFIG } from "@/engine/config";
import type { SaveState } from "@/engine/types";

export const REALM_NAMES: Record<string, string> = Object.fromEntries(
  (CONFIG.realms as unknown as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
);

export const REALM_LIST = CONFIG.realms as unknown as Array<{
  id: string;
  name: string;
  cultivationCost: number;
  spiritCost: number;
}>;

export const RESOURCE_LABELS: Record<string, string> = {
  cultivation: "修为",
  spirit: "灵气",
  spiritStone: "灵石",
  herb: "灵草",
  page: "残页",
};

export const BUILDINGS = CONFIG.buildings as unknown as Record<
  string,
  { name: string; levels: Array<{ cost: number; [k: string]: number }> }
>;

export const TECHNIQUES = CONFIG.techniques as unknown as Record<
  string,
  { name: string; levels: Array<{ pageCost: number; [k: string]: number }> }
>;

export const EQUIPMENT = CONFIG.equipment as unknown as Record<
  string,
  { name: string; slot: string; attack?: number; defense?: number; hp?: number }
>;

export const MAPS = CONFIG.maps as unknown as Record<
  string,
  { name: string; nodes: Record<string, { name: string; gate: string; [k: string]: unknown }> }
>;

export const DAILY_GOALS = CONFIG.dailyGoals as unknown as Record<
  string,
  { title: string; target: number; reward: Record<string, number> }
>;

export const WEATHERS = CONFIG.weathers as unknown as Record<string, { name: string; desc: string }>;
export const ASTROLOGIES = CONFIG.astrologies as unknown as Record<string, { name: string; desc: string }>;
export const SUPPRESSION_DURATION_HOURS = CONFIG.suppressionDurationHours;

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// 百分比显示，保留 0.5 精度（2.5% 显示 2.5，5% 显示 5）
export function fmtPct(x: number): string {
  const pct = Math.round(x * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`;
}

export function fmtRemaining(now: number, endAt: number, durationMinutes: number): string {
  const min = Math.max(0, Math.min(durationMinutes, Math.ceil((endAt - now) / 60000)));
  if (min <= 0) return "0 分";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} 时 ${m} 分` : `${m} 分`;
}

export const WORLD_TEXT: Record<string, string> = {
  dongfu: "洞府隐于山腹，四壁青苔如篆。此处聚灵纳气，是你修行起居之所。",
  map_qingyun: "青云山层峦叠翠，灵气自谷底升腾。山中妖兽盘踞，正是历练之所。",
  map_nether: "幽冥谷阴气沉沉，雾锁深壑。传闻谷底藏有前人遗蜕，凶险与机缘并藏。",
  map_yunling: "云岭古道盘山而上，雾瘴缭绕。古时修士结丹必经之地，至今仍留石傀护道、山魈拦路。",
};

export const REALM_ORDER: string[] = REALM_LIST.map((r) => r.id);

export function resourceGains(from: SaveState, to: SaveState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(to.resources)) {
    out[k] = to.resources[k as keyof typeof to.resources] - from.resources[k as keyof typeof from.resources];
  }
  return out;
}
