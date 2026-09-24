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

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const WORLD_TEXT: Record<string, string> = {
  dongfu: "洞府隐于山腹，四壁青苔如篆。此处聚灵纳气，是你修行起居之所。",
  map_qingyun: "青云山层峦叠翠，灵气自谷底升腾。山中妖兽盘踞，正是历练之所。",
  map_nether: "幽冥谷阴气沉沉，雾锁深壑。传闻谷底藏有前人遗蜕，凶险与机缘并藏。",
};

export const REALM_ORDER: string[] = REALM_LIST.map((r) => r.id);

export function resourceGains(from: SaveState, to: SaveState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(to.resources)) {
    out[k] = to.resources[k as keyof typeof to.resources] - from.resources[k as keyof typeof from.resources];
  }
  return out;
}
