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
  iron: "玄铁",
  lingTaiJing: "灵胎晶",
  yunHaiSui: "云海髓",
  buXiuJin: "不朽金",
  hunYuanYu: "混元玉",
  taiChuZiJing: "太初紫晶",
};

export const BUILDINGS = CONFIG.buildings as unknown as Record<
  string,
  { name: string; levels: Array<{ cost: number; [k: string]: number }> }
>;

export const TECHNIQUES = CONFIG.techniques as unknown as Record<
  string,
  { name: string; levels: Array<{ pageCost: number; [k: string]: number }> }
>;

export const SECRET_REALMS = CONFIG.secretRealms as unknown as Record<
  string,
  { name: string; gate: string; enemy: { attack: number; defense: number; hp: number }; reward: Partial<Record<"cultivation" | "spirit" | "spiritStone" | "herb" | "page", number>> }
>;

export const EQUIPMENT = CONFIG.equipment as unknown as Record<
  string,
  { name: string; slot: string; attack?: number; defense?: number; hp?: number; tribulationReduction?: number }
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
  map_jindan: "丹火未熄，残炉仍温。循着药香深入，可见结丹修士留下的试炼痕迹。",
  map_yuanying: "灵胎初成，神识在虚实之间游走。守住本心，方能安然出入这片旧道场。",
  map_huashen: "山川如画，神念却能改换眼前景象。每一道幻影都在试探修士的本心。",
  map_lianxu: "虚空裂隙间散落着旧日道纹，路随念动，稍有迟疑便会回到原处。",
  map_heti: "阴阳二气在此交汇，孤身难渡的关隘，须以形神相合之力通过。",
  map_dacheng: "云海之上有古人问道遗迹，越往高处，越能听见自己的回答。",
  map_dujie: "九霄雷云终年不散。修士在此辨明劫意，为真正的飞升做准备。",
  map_zhenxian: "洗尽凡尘后，玉阙初开。仙籍与旧日誓言都藏在飞升台深处。",
  map_xuanxian: "玄光照见万象，真伪难分。守住一念清明，才能穿过镜门。",
  map_jinxian: "金霞凝成不朽道纹，长生之路不在躲避岁月，而在经得起岁月。",
  map_taiyi: "星轨交错如棋，太乙阵盘随步而转；每一步都要先看清来路。",
  map_daluo: "三花聚顶、五气朝元的旧迹仍在，周天法相于此守候后来者。",
  map_hunyuan: "万象归于一气，散乱的力量在此重聚，化作可追寻的道痕。",
  map_hunyuan_daluo: "太虚深处传来开天余响，古老法则交织成一条险而可行的路。",
  map_hunyuan_wuji: "有形与无形在此相接。越执着于边界，越难看见无极之门。",
  map_tiandao: "天则如细密经纬，因果自有回声。行过此境，须直面自己的选择。",
  map_dadao: "万法同源之处，太古钟声仍在；修士要辨认属于自己的那一笔。",
  map_hongmeng: "初元紫气浮沉，旧路到了尽头。守望者留下最后一问，答案仍由你写。",
};

export const REALM_ORDER: string[] = REALM_LIST.map((r) => r.id);

export function resourceGains(from: SaveState, to: SaveState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(to.resources)) {
    out[k] = to.resources[k as keyof typeof to.resources] - from.resources[k as keyof typeof from.resources];
  }
  return out;
}
