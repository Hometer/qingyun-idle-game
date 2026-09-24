import { CONFIG } from "@/engine/config";

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
