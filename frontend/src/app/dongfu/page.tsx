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
  const { state, upgradeBuilding, buildLibrary } = useGame();
  if (!state) return null;
  const libCost = state.library < 2 ? CONFIG.library.levels[state.library].cost : null;
  const libRealmOk = REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf("foundation1");
  const libAfford = !!libCost && libRealmOk && state.resources.spiritStone >= libCost.spiritStone && state.resources.page >= libCost.page;

  return (
    <Section title="洞府建筑">
      <p className="mb-2 text-sm text-muted">{WORLD_TEXT.dongfu}</p>
      {(Object.keys(BUILDINGS) as BuildingId[]).map((id) => {
        const b = BUILDINGS[id];
        const lvl = state.buildings[id];
        const cost = lvl < 3 ? b.levels[lvl].cost : null;
        const affordable = cost !== null && state.resources.spiritStone >= cost;
        const current = lvl >= 1 ? effectText(id, b.levels[lvl - 1]) : "未建";
        const next = lvl < 3 ? effectText(id, b.levels[lvl]) : null;
        return (
          <div key={id} className="border-b border-line/60 py-2 last:border-0">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {b.name} <span className="text-muted">Lv{lvl}</span>
              </div>
              {lvl < 3 && (
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
          {state.library < 2 && (
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
          {state.library < 2 && (
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
    </Section>
  );
}
