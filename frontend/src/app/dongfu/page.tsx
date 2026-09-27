"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { BUILDINGS, WORLD_TEXT, REALM_ORDER } from "@/lib/labels";
import { CONFIG } from "@/engine/config";
import type { BuildingId } from "@/engine/types";

function effectText(id: string, lv: Record<string, number>): string {
  switch (id) {
    case "cultivationRoom":
      return `修为产出 ${lv.cultivationMult}×`;
    case "spiritArray":
      return `灵气产出 ${lv.spiritMult}×`;
    case "spiritField":
      return `灵草 ${lv.herbPerSec}/秒`;
    case "alchemyFurnace":
      return `炼丹 ${lv.pillHerbCost} 灵草 + ${lv.pillStoneCost} 灵石`;
    default:
      return "";
  }
}

export default function DongfuPage() {
  const { state, upgradeBuilding, buildLibrary, buildForge, setAptitude } = useGame();
  if (!state) return null;
  const libCost = state.library < CONFIG.library.levels.length ? CONFIG.library.levels[state.library].cost : null;
  const libRealmOk = REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf("zhuji1");
  const libAfford = !!libCost && libRealmOk && state.resources.spiritStone >= libCost.spiritStone && state.resources.page >= libCost.page;
  const forgeCost = state.forge < CONFIG.forge.levels.length ? CONFIG.forge.levels[state.forge].cost : null;
  const forgeRealmOk = REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf("zhuji1");
  const forgeAfford = !!forgeCost && forgeRealmOk && state.resources.spiritStone >= forgeCost.spiritStone && state.resources.page >= forgeCost.page;

  return (
    <>
      <Section title="修炼侧重">
        <p className="mb-2 text-xs text-muted">切换修炼侧重，不收费、不随机；切换前先结算当前收益。</p>
        {(["balanced", "focus", "spirit"] as const).map((a) => {
          const cfg = CONFIG.aptitudes[a];
          const active = state.aptitude === a;
          return (
            <div key={a} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
              <div className="text-sm">
                {cfg.name}
                <span className="ml-1 text-xs text-muted">修为 ×{cfg.cultivationMult}、灵气 ×{cfg.spiritMult}</span>
                {active && <span className="ml-1 text-xs text-cinnabar">当前</span>}
              </div>
              {!active && (
                <button onClick={() => setAptitude(a)} className="rounded-lg border border-line bg-paper px-3 py-1 text-xs">切换</button>
              )}
            </div>
          );
        })}
      </Section>

    <Section title="洞府建筑">
      <p className="mb-2 text-sm text-muted">{WORLD_TEXT.dongfu}</p>
      {(Object.keys(BUILDINGS) as BuildingId[]).map((id) => {
        const b = BUILDINGS[id];
        const lvl = state.buildings[id];
        const cost = lvl < b.levels.length ? b.levels[lvl].cost : null;
        const affordable = cost !== null && state.resources.spiritStone >= cost;
        const current = lvl >= 1 ? effectText(id, b.levels[lvl - 1]) : "未建";
        const next = lvl < b.levels.length ? effectText(id, b.levels[lvl]) : null;
        return (
          <div key={id} className="border-b border-line/60 py-2 last:border-0">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {b.name} <span className="text-muted">Lv{lvl}</span>
              </div>
              {lvl < b.levels.length && (
                <button
                  onClick={() => upgradeBuilding(id)}
                  disabled={!affordable}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  升级
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              当前：{current}
              {next ? ` → 下级：${next}` : " · 已满级"}
            </p>
            {cost !== null && (
              <p className={`text-xs ${affordable ? "text-muted" : "text-cinnabar"}`}>
                升级需 {cost} 灵石{affordable ? "" : "（灵石不足）"}
              </p>
            )}
          </div>
        );
      })}

      <div className="mt-4 rounded-lg border border-line/60 p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            藏经阁 <span className="text-muted">Lv{state.library}</span>
          </div>
          {state.library < CONFIG.library.levels.length && (
            <button
              onClick={buildLibrary}
              disabled={!libAfford}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
            >
              升级
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          当前：{state.library === 0 ? "未建" : state.library === 1 ? "一级（已解锁破岳诀、聚元诀）" : "二级（已开放辅修位）· 已满级"}
          {state.library < CONFIG.library.levels.length && (
            <>
              {" → 下级："}
              {state.library === 0 ? "解锁破岳诀、聚元诀" : "开放辅修位"}
            </>
          )}
        </p>
        {libCost && (
          <p className={`text-xs ${libRealmOk ? (libAfford ? "text-muted" : "text-cinnabar") : "text-cinnabar"}`}>
            {libRealmOk
              ? `升级需 ${libCost.spiritStone} 灵石、${libCost.page} 残页${libAfford ? "" : `（还差 ${Math.max(0, libCost.spiritStone - state.resources.spiritStone)} 灵石、${Math.max(0, libCost.page - state.resources.page)} 残页）`}`
              : "需筑基一层方可建藏经阁"}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-line/60 p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            炼器台 <span className="text-muted">Lv{state.forge}</span>
          </div>
          {state.forge < CONFIG.forge.levels.length && (
            <button
              onClick={buildForge}
              disabled={!forgeAfford}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
            >
              建造
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          当前：{state.forge === 0 ? "未建" : "已建成（随境界解锁更多配方）"}
        </p>
        {forgeCost && (
          <p className={`text-xs ${forgeRealmOk ? (forgeAfford ? "text-muted" : "text-cinnabar") : "text-cinnabar"}`}>
            {forgeRealmOk
              ? `建造需 ${forgeCost.spiritStone} 灵石、${forgeCost.page} 残页${forgeAfford ? "" : `（还差 ${Math.max(0, forgeCost.spiritStone - state.resources.spiritStone)} 灵石、${Math.max(0, forgeCost.page - state.resources.page)} 残页）`}`
              : "需筑基一层方可建炼器台"}
          </p>
        )}
      </div>
    </Section>
    </>
  );
}
