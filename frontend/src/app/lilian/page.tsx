"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { MAPS, REALM_NAMES, REALM_ORDER, EQUIPMENT, RESOURCE_LABELS, WORLD_TEXT, SUPPRESSION_DURATION_HOURS, SECRET_REALMS, fmt, fmtCombat, fmtTime, fmtDuration } from "@/lib/labels";
import { CONFIG } from "@/engine/config";
import { isBossNode, predictFight, predictLongTask, predictSecretRealm, repeatRewardFor, secretRealmReward } from "@/engine/engine";
import type { BattleDifficulty, MapId, SecretRealmId } from "@/engine/types";

type NodeCfg = {
  name: string;
  gate: string;
  enemy: { attack: number; defense: number; hp: number };
  firstClear: { cultivation: number; spiritStone: number; page: number; equipment: string | null };
  repeat: { cultivation: number; page: number };
  suppressRate: number;
  side?: boolean;
};

const MAPS_CFG = CONFIG.maps as unknown as Record<MapId, { name: string; nodes: Record<string, NodeCfg> }>;

function rewardText(fc: NodeCfg["firstClear"], rc: NodeCfg["repeat"], material: string | null): string {
  const parts: string[] = [];
  if (fc.cultivation) parts.push(`修为 ${fc.cultivation}`);
  if (fc.spiritStone) parts.push(`灵石 ${fc.spiritStone}`);
  if (fc.page) parts.push(`残页 ${fc.page}`);
  if (fc.equipment) parts.push(EQUIPMENT[fc.equipment]?.name ?? "");
  if (material) parts.push(`${RESOURCE_LABELS[material]} 4`);
  const repeat: string[] = [];
  if (rc.cultivation) repeat.push(`修为 ${rc.cultivation}`);
  if (rc.page) repeat.push(`残页 ${rc.page}`);
  if (material) repeat.push(`${RESOURCE_LABELS[material]} 1`);
  return `首胜：${parts.join("、") || "无"} ｜ 重复胜利：${repeat.join("、") || "无"}（共用每日奖励额度）`;
}

export default function LilianPage() {
  const { state, view, now, fight, suppress, battleLog, startLong, realmPending, realmNarrative, realmNarrativeLoading, startSecretRealm, confirmSecretRealm, cancelSecretRealm } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapId | null>(null);
  const [difficulty, setDifficulty] = useState<BattleDifficulty>("normal");
  const [trainNode, setTrainNode] = useState<{ mid: MapId; nid: string } | null>(null);
  const [trainDifficulty, setTrainDifficulty] = useState<"steady" | "risky">("steady");
  const [trainDuration, setTrainDuration] = useState(30);
  const [trainProtection, setTrainProtection] = useState(false);

  const clearedList = useMemo(() => {
    if (!state) return [] as { mid: MapId; nid: string; name: string }[];
    const list: { mid: MapId; nid: string; name: string }[] = [];
    for (const mid of Object.keys(MAPS) as MapId[]) {
      for (const [nid, n] of Object.entries(MAPS[mid].nodes)) {
        if (state.maps[mid][nid]?.cleared) list.push({ mid, nid, name: `${MAPS[mid].name}·${n.name}` });
      }
    }
    return list;
  }, [state]);

  const trainPred = useMemo(() => {
    if (!state || !trainNode) return null;
    return predictLongTask(state, "training", trainNode.mid, trainNode.nid, trainDifficulty, trainDuration, trainProtection);
  }, [state, trainNode, trainDifficulty, trainDuration, trainProtection]);

  if (!state) return null;

  const mapIds = Object.keys(MAPS) as MapId[];
  const currentMap = [...mapIds].reverse().find((mid) => {
    const firstNode = Object.values(MAPS[mid].nodes)[0];
    return REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf(firstNode.gate);
  }) ?? mapIds[0];
  const activeMap = selectedMap ?? currentMap;

  const remainingHours = (mid: MapId): number => {
    const since = state.suppressionSince[mid] || 0;
    if (!since) return 0;
    const remainMs = SUPPRESSION_DURATION_HOURS * 3600 * 1000 - (Date.now() - since);
    return Math.max(0, Math.ceil(remainMs / 3600000));
  };

  const sel = selected ? (selected.split("|") as [MapId, string]) : null;
  const selCfg = sel ? MAPS_CFG[sel[0]]?.nodes[sel[1]] : null;
  const selPred = sel ? predictFight(state, sel[0], sel[1], difficulty) : null;
  const selRepeat = sel ? repeatRewardFor(sel[0], sel[1], difficulty) : null;

  return (
    <>
      <p className="rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted">重复历练：今日已领取 {(view ?? state).daily.rewardedRepeats}/{CONFIG.rewardedRepeatBattlesPerDay} 次奖励；首通奖励不占额度，额度用尽仍可战斗。</p>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <label htmlFor="map-picker" className="shrink-0">历练地图</label>
        <select id="map-picker" value={activeMap} onChange={(e) => setSelectedMap(e.target.value as MapId)} className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2">
          {mapIds.map((mid) => {
            const cleared = Object.keys(MAPS[mid].nodes).filter((nid) => state.maps[mid][nid]?.cleared).length;
            return <option key={mid} value={mid}>{MAPS[mid].name}（{cleared}/{Object.keys(MAPS[mid].nodes).length}）</option>;
          })}
        </select>
      </div>

      <div className="mb-3 rounded-xl border border-line bg-card p-3">
        <p className="mb-2 text-sm font-medium">战斗难度</p>
        <div className="flex gap-2">
          {(["normal", "challenge"] as const).map((mode) => (
            <button key={mode} onClick={() => setDifficulty(mode)} aria-pressed={difficulty === mode}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${difficulty === mode ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
              {mode === "normal" ? "普通" : "挑战 · 奖励提升"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">普通首胜后可挑战同一敌人。挑战胜利提高每日限次重复奖励；守关 BOSS 挑战须在 12 回合内获胜。地图不限时，失败可重试。</p>
      </div>

      {[activeMap].map((mid) => (
        <Section key={mid} title={MAPS[mid].name} variant="featured">
          <p className="mb-2 text-sm text-muted">{WORLD_TEXT[mid]}</p>
          <p className="text-xs font-medium text-muted">主线与守关 BOSS</p>
          {Object.entries(MAPS[mid].nodes).map(([nid, n], index) => {
            const ns = state.maps[mid][nid];
            const supped = state.suppression[mid] === nid;
            const enough = REALM_ORDER.indexOf(state.realm) >= REALM_ORDER.indexOf(n.gate);
            const pred = predictFight(state, mid, nid, difficulty);
            const firstSide = n.side && !Object.values(MAPS[mid].nodes)[index - 1]?.side;
            return (
              <div key={nid}>
                {firstSide && <p className="mt-3 border-t border-line pt-3 text-xs font-medium text-muted">入口支线 · 可选挑战</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2 last:border-0">
                  <div className="min-w-0 text-sm">
                    <span>{n.name}</span>
                    {isBossNode(mid, nid) && <span className="ml-1 rounded bg-cinnabar/10 px-1.5 py-0.5 text-xs text-cinnabar">守关 BOSS</span>}
                    {!ns.unlocked && <span className="text-muted">（需{REALM_NAMES[n.gate]}解锁）</span>}
                    {ns.unlocked && !enough && <span className="text-cinnabar">（需{REALM_NAMES[n.gate]}方可挑战）</span>}
                    {ns.cleared && <span className="text-muted">·已通关</span>}
                    {supped && <span className="text-cinnabar">·镇压中·剩 {remainingHours(mid)} 时</span>}
                  </div>
                  <div className="flex gap-2">
                    {ns.unlocked && <button onClick={() => setSelected(`${mid}|${nid}`)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm">详情</button>}
                    {ns.unlocked && <button onClick={() => fight(mid, nid, difficulty)} disabled={!pred.ok} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40">战斗</button>}
                    {ns.cleared && !supped && <button onClick={() => suppress(mid, nid)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">镇压</button>}
                  </div>
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

      {state.firsts.suppressedFirstNodeOnce && (
        <Section title="持续历练">
          {!state.longTask ? (
            <>
              <p className="text-xs text-muted">选已首通的节点安排一段可离开的历练，到期手动领取。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {clearedList.map((n) => (
                  <button key={`${n.mid}|${n.nid}`} onClick={() => setTrainNode({ mid: n.mid, nid: n.nid })} className={`rounded-lg border px-3 py-1.5 text-sm ${trainNode?.nid === n.nid && trainNode?.mid === n.mid ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                    {n.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                {(["steady", "risky"] as const).map((d) => (
                  <button key={d} onClick={() => setTrainDifficulty(d)} className={`flex-1 rounded-lg border py-2 text-sm ${trainDifficulty === d ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                    {d === "steady" ? "稳行" : "险行"}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                {[30, 60, 120].map((d) => (
                  <button key={d} onClick={() => setTrainDuration(d)} className={`flex-1 rounded-lg border py-2 text-sm ${trainDuration === d ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                    {d} 分钟
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={trainProtection} onChange={(e) => setTrainProtection(e.target.checked)} />
                护行阵（30 灵石，本次防御 +5）
              </label>
              {trainPred?.ok && (
                <div className="mt-2 text-sm">
                  <p>
                    预计{trainPred.won ? "可胜" : "难胜"}（我方 {trainPred.playerAttack} 攻 / {trainPred.playerDefense} 防 vs 敌方 {trainPred.enemyAttack} 攻 / {trainPred.enemyDefense} 防）
                  </p>
                  <p>
                    预计所得：修为 {trainPred.reward.cultivation}、残页 {trainPred.reward.page}
                    {trainProtection ? "（护行阵 30 灵石）" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    预计 {fmtTime(now + trainDuration * 60000)} 结束（{fmtDuration(trainDuration)}）
                  </p>
                </div>
              )}
              <button
                onClick={() => trainNode && startLong({ type: "training", mapId: trainNode.mid, nodeId: trainNode.nid, difficulty: trainDifficulty, durationMinutes: trainDuration, protection: trainProtection })}
                disabled={!trainNode || !trainPred?.won}
                className="mt-3 rounded-lg bg-cinnabar px-4 py-2 text-white disabled:opacity-40"
              >
                开始持续历练
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">已有进行中的任务，请先领取或中止。</p>
          )}
        </Section>
      )}

      <Section title="秘境">
        <p className="mb-2 text-xs text-muted">主动进入的确定性探索，胜得奖励、败无奖励；每秘境每日一次。</p>
        {(Object.keys(SECRET_REALMS) as SecretRealmId[]).map((rid) => {
          const cfg = SECRET_REALMS[rid];
          const pred = predictSecretRealm(view ?? state, rid);
          const gateOk = pred.ok;
          const used = (view?.secretRealmUsed ?? state.secretRealmUsed)[rid];
          const reward = secretRealmReward(rid);
          const rewardParts = [
            reward.spiritStone ? `灵石 ${reward.spiritStone}` : "",
            reward.herb ? `灵草 ${reward.herb}` : "",
            reward.page ? `残页 ${reward.page}` : "",
            reward.iron ? `玄铁 ${reward.iron}` : "",
          ].filter(Boolean).join("、");
          return (
            <div key={rid} className="border-b border-line/60 py-2 last:border-0">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {cfg.name}
                  <span className="ml-1 text-xs text-muted">需{REALM_NAMES[cfg.gate]} · 今日 {used ? "1/1" : "0/1"}</span>
                </div>
                <button
                  onClick={() => startSecretRealm(rid)}
                  disabled={!gateOk || used}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {used ? "已探索" : gateOk ? "进入秘境" : "未解锁"}
                </button>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                敌方 攻{fmtCombat(cfg.enemy.attack)}/防{fmtCombat(cfg.enemy.defense)}/气血{fmtCombat(cfg.enemy.hp)}
                {gateOk && ` · 我方 攻${fmtCombat(pred.player.attack)}/防${fmtCombat(pred.player.defense)}/气血${fmtCombat(pred.player.hp)}`}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                奖励：{rewardParts || "无"}
                {gateOk && ` · 预估${pred.won ? "可胜" : "难胜"}`}
              </p>
            </div>
          );
        })}
      </Section>

      {sel && selCfg && selPred && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[520px] rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">
              {selCfg.name}
              <span className="ml-1 text-xs text-muted">（需{REALM_NAMES[selCfg.gate]}）</span>
            </h2>
            <p className="mt-2 text-sm">敌方：攻 {fmtCombat(difficulty === "challenge" && selPred.ok ? selPred.enemy.attack : selCfg.enemy.attack)} ／ 防 {fmtCombat(difficulty === "challenge" && selPred.ok ? selPred.enemy.defense : selCfg.enemy.defense)} ／ 气血 {fmtCombat(difficulty === "challenge" && selPred.ok ? selPred.enemy.hp : selCfg.enemy.hp)}</p>
            {selPred.ok ? (
              <p className="mt-1 text-sm">
                我方：攻 {fmtCombat(selPred.player.attack)} ／ 防 {fmtCombat(selPred.player.defense)} ／ 气血 {fmtCombat(selPred.player.hp)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{selPred.reason}</p>
            )}
            {selPred.ok && (
              <p className="mt-1 text-sm font-medium">
                预估：{selPred.won ? <span className="text-cinnabar">预计可胜</span> : <span className="text-muted">预计难胜</span>}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{difficulty === "normal" ? rewardText(selCfg.firstClear, selCfg.repeat, selRepeat?.material ?? null) : `挑战胜利：修为 ${selRepeat?.cultivation ?? 0}、残页 ${selRepeat?.page ?? 0}${selRepeat?.material ? `、${RESOURCE_LABELS[selRepeat.material]} 1` : ""}（每日限次；${isBossNode(sel[0], sel[1]) ? "12 回合内获胜" : "不限回合"}）`}</p>
            <p className="mt-1 text-xs text-muted">
              镇压产出：灵石 {selCfg.suppressRate}/秒（约 {fmt(selCfg.suppressRate * 3600)}/小时）
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  fight(sel[0], sel[1], difficulty);
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

      {realmPending && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">{realmNarrative?.title ?? SECRET_REALMS[realmPending].name}</h2>
            <p className="mt-1 text-xs text-muted">{realmNarrativeLoading ? "叙事加载中…" : realmNarrative?.source}</p>
            <p className="mt-2 text-sm leading-relaxed">
              {realmNarrativeLoading ? "正在推演此地风貌…" : realmNarrative?.body ?? "你凝神提剑，准备一探。"}
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmSecretRealm} disabled={realmNarrativeLoading} className="flex-1 rounded-lg bg-cinnabar px-4 py-2 text-white disabled:opacity-40">
                开始探索
              </button>
              <button onClick={cancelSecretRealm} className="rounded-lg border border-line bg-paper px-4 py-2">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
