"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { BUILDINGS, WORLD_TEXT, REALM_ORDER, REALM_NAMES } from "@/lib/labels";
import { CONFIG } from "@/engine/config";
import type { BuildingId } from "@/engine/types";

const GATES = CONFIG.growthGates as unknown as { furnacePage: Record<number, number> } & Record<string, Record<number, string>>;

function realmOkFor(realm: string, gate: string | null | undefined): boolean {
  return !gate || REALM_ORDER.indexOf(realm) >= REALM_ORDER.indexOf(gate);
}

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
  const libGate = GATES.library[state.library + 1] ?? "zhuji1";
  const libRealmOk = realmOkFor(state.realm, libGate);
  const libAfford = !!libCost && libRealmOk && state.resources.spiritStone >= libCost.spiritStone && state.resources.page >= libCost.page;
  const forgeCost = state.forge < CONFIG.forge.levels.length ? CONFIG.forge.levels[state.forge].cost : null;
  const forgeGate = GATES.forge[state.forge + 1] ?? "zhuji1";
  const forgeRealmOk = realmOkFor(state.realm, forgeGate);
  const forgeAfford = !!forgeCost && forgeRealmOk && state.resources.spiritStone >= forgeCost.spiritStone && state.resources.page >= forgeCost.page;

  return (
    <>
    <Section title="洞府建筑" variant="featured">
      <p className="mb-2 text-sm text-muted">{WORLD_TEXT.dongfu}</p>
      {(Object.keys(BUILDINGS) as BuildingId[]).map((id) => {
        const b = BUILDINGS[id];
        const lvl = state.buildings[id];
        const cost = lvl < b.levels.length ? b.levels[lvl].cost : null;
        const gate = GATES[id]?.[lvl + 1];
        const pageCost = id === "alchemyFurnace" ? (GATES.furnacePage[lvl + 1] ?? 0) : 0;
        const realmOk = realmOkFor(state.realm, gate);
        const affordable = cost !== null && realmOk && state.resources.spiritStone >= cost && state.resources.page >= pageCost;
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
                {!realmOk
                  ? `升级需${REALM_NAMES[gate as keyof typeof REALM_NAMES] ?? gate}`
                  : `升级需 ${cost} 灵石${pageCost ? `、${pageCost} 残页` : ""}${affordable ? "" : `（还差 ${Math.max(0, cost - state.resources.spiritStone)} 灵石${pageCost ? `、${Math.max(0, pageCost - state.resources.page)} 残页` : ""}）`}`}
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
          当前：{state.library === 0 ? "未建" : `${state.library}级${state.library === 1 ? "（已解锁破岳诀、聚元诀）" : "（已开放辅修位）"}`}{state.library >= CONFIG.library.levels.length ? " · 已满级" : ""}
        </p>
        {libCost && (
          <p className={`text-xs ${libRealmOk ? (libAfford ? "text-muted" : "text-cinnabar") : "text-cinnabar"}`}>
            {libRealmOk
              ? `升级需 ${libCost.spiritStone} 灵石、${libCost.page} 残页${libAfford ? "" : `（还差 ${Math.max(0, libCost.spiritStone - state.resources.spiritStone)} 灵石、${Math.max(0, libCost.page - state.resources.page)} 残页）`}`
              : `藏经阁需${REALM_NAMES[GATES.library[state.library + 1] as keyof typeof REALM_NAMES] ?? "筑基一层"}方可升级`}
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
              升级
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          当前：{state.forge === 0 ? "未建" : `${state.forge}级`}{state.forge >= CONFIG.forge.levels.length ? " · 已满级" : ""}
        </p>
        {forgeCost && (
          <p className={`text-xs ${forgeRealmOk ? (forgeAfford ? "text-muted" : "text-cinnabar") : "text-cinnabar"}`}>
            {forgeRealmOk
              ? `升级需 ${forgeCost.spiritStone} 灵石、${forgeCost.page} 残页${forgeAfford ? "" : `（还差 ${Math.max(0, forgeCost.spiritStone - state.resources.spiritStone)} 灵石、${Math.max(0, forgeCost.page - state.resources.page)} 残页）`}`
              : `炼器台需${REALM_NAMES[GATES.forge[state.forge + 1] as keyof typeof REALM_NAMES] ?? "筑基一层"}方可升级`}
          </p>
        )}
      </div>
    </Section>

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

    </>
  );
}
