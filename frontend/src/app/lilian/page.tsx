"use client";

import { useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { MAPS, REALM_NAMES, REALM_ORDER, EQUIPMENT, WORLD_TEXT, fmt } from "@/lib/labels";
import { CONFIG } from "@/engine/config";
import { predictFight } from "@/engine/engine";
import type { MapId } from "@/engine/types";

type NodeCfg = {
  name: string;
  gate: string;
  enemy: { attack: number; defense: number; hp: number };
  firstClear: { cultivation: number; spiritStone: number; page: number; equipment: string | null };
  repeat: { cultivation: number; page: number };
  suppressRate: number;
};

const MAPS_CFG = CONFIG.maps as unknown as Record<MapId, { name: string; nodes: Record<string, NodeCfg> }>;

function rewardText(fc: NodeCfg["firstClear"], rc: NodeCfg["repeat"]): string {
  const parts: string[] = [];
  if (fc.cultivation) parts.push(`修为 ${fc.cultivation}`);
  if (fc.spiritStone) parts.push(`灵石 ${fc.spiritStone}`);
  if (fc.page) parts.push(`残页 ${fc.page}`);
  if (fc.equipment) parts.push(EQUIPMENT[fc.equipment]?.name ?? "");
  const repeat: string[] = [];
  if (rc.cultivation) repeat.push(`修为 ${rc.cultivation}`);
  if (rc.page) repeat.push(`残页 ${rc.page}`);
  return `首胜：${parts.join("、") || "无"} ｜ 重复：${repeat.join("、") || "无"}`;
}

export default function LilianPage() {
  const { state, fight, suppress, battleLog } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;

  const sel = selected ? (selected.split("|") as [MapId, string]) : null;
  const selCfg = sel ? MAPS_CFG[sel[0]]?.nodes[sel[1]] : null;
  const selPred = sel ? predictFight(state, sel[0], sel[1]) : null;

  return (
    <>
      {(Object.keys(MAPS) as MapId[]).map((mid) => (
        <Section key={mid} title={MAPS[mid].name}>
          <p className="mb-2 text-sm text-muted">{WORLD_TEXT[mid]}</p>
          {Object.entries(MAPS[mid].nodes).map(([nid, n]) => {
            const ns = state.maps[mid][nid];
            const supped = state.suppression[mid] === nid;
            const enough = REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf(n.gate);
            return (
              <div key={nid} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
                <div className="text-sm">
                  {n.name}
                  {!ns.unlocked && <span className="text-muted">（需{REALM_NAMES[n.gate]}解锁）</span>}
                  {ns.unlocked && !enough && <span className="text-cinnabar">（需{REALM_NAMES[n.gate]}方可挑战）</span>}
                  {ns.cleared && <span className="text-muted">·已通关</span>}
                  {supped && <span className="text-cinnabar">·镇压中</span>}
                </div>
                <div className="flex gap-2">
                  {ns.unlocked && (
                    <button onClick={() => setSelected(`${mid}|${nid}`)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm">
                      详情
                    </button>
                  )}
                  {ns.unlocked && (
                    <button
                      onClick={() => fight(mid, nid)}
                      disabled={!enough}
                      className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      战斗
                    </button>
                  )}
                  {ns.cleared && !supped && (
                    <button onClick={() => suppress(mid, nid)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                      镇压
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Section>
      ))}

      {battleLog.length > 0 && (
        <Section title="战报">
          {battleLog.map((l, i) => (
            <p key={i} className={`py-0.5 text-sm ${l.startsWith("短板") ? "text-cinnabar" : "text-ink/80"}`}>
              {l}
            </p>
          ))}
        </Section>
      )}

      {sel && selCfg && selPred && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[520px] rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">
              {selCfg.name}
              <span className="ml-1 text-xs text-muted">（需{REALM_NAMES[selCfg.gate]}）</span>
            </h2>
            <p className="mt-2 text-sm">敌方：攻 {selCfg.enemy.attack} ／ 防 {selCfg.enemy.defense} ／ 气血 {selCfg.enemy.hp}</p>
            {selPred.ok ? (
              <p className="mt-1 text-sm">
                我方：攻 {selPred.player.attack} ／ 防 {selPred.player.defense} ／ 气血 {selPred.player.hp}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{selPred.reason}</p>
            )}
            {selPred.ok && (
              <p className="mt-1 text-sm font-medium">
                预估：{selPred.won ? <span className="text-cinnabar">预计可胜</span> : <span className="text-muted">预计难胜</span>}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{rewardText(selCfg.firstClear, selCfg.repeat)}</p>
            <p className="mt-1 text-xs text-muted">
              镇压产出：灵石 {selCfg.suppressRate}/秒（约 {fmt(selCfg.suppressRate * 3600)}/小时）
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  fight(sel[0], sel[1]);
                  setSelected(null);
                }}
                disabled={!selPred.ok}
                className="rounded-lg bg-cinnabar px-4 py-2 text-white disabled:opacity-40"
              >
                开战
              </button>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-line bg-paper px-4 py-2">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
