"use client";

import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { REALM_NAMES, REALM_LIST, TECHNIQUES, fmt, fmtPct, fmtTime, fmtDuration } from "@/lib/labels";
import { productionBreakdown, predictLongTask, breakthroughCosts, breakthroughSuccessRate } from "@/engine/engine";
import type { TechniqueId, BreakthroughMethod, BreakthroughLayer } from "@/engine/types";

function eff(id: string, lvl: number, aux: boolean): string {
  if (lvl < 1) return "未研习";
  const lv = TECHNIQUES[id].levels[lvl - 1];
  if (id === "qingYun") return `修为产出 ${aux ? lv.auxCultivationMult : lv.cultivationMult}×`;
  if (id === "xuanGui") return `护劫减伤 ${fmtPct(aux ? lv.auxTribulationReduction : lv.tribulationReduction)}%`;
  if (id === "poYue") return `攻击 ${aux ? lv.auxAttack : lv.attack}`;
  return `灵气产出 ${aux ? lv.auxSpiritMult : lv.spiritMult}×`;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {fmt(value)} / {fmt(max)}
        </span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-cinnabar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function XiulianPage() {
  const { state, view, now, doBreakthrough, startTrib, tribPreview, jindanPreview, startJindanTrial, setTechnique, setAuxiliaryTechnique, upgradeTechnique, markTribPreviewViewed, startLong } = useGame();
  const [seclusionDuration, setSeclusionDuration] = useState(30);
  if (!state || !view) return null;
  const idx = REALM_LIST.findIndex((r) => r.id === state.realm);
  const next = REALM_LIST[idx + 1];
  const isQi4 = state.realm === "qi4";
  const isFoundation3 = state.realm === "foundation3";
  const isMax = state.realm === "jindan1";
  const isBreakthroughLayer = state.realm === "qi1" || state.realm === "qi2" || state.realm === "qi3" || state.realm === "foundation1" || state.realm === "foundation2";
  const prod = productionBreakdown(state);
  const seclusionPred = useMemo(() => predictLongTask(state, "seclusion", "map_qingyun", "", "steady", seclusionDuration, false), [state, seclusionDuration]);
  const enough = !isMax && !!next && view.resources.cultivation >= next.cultivationCost && view.resources.spirit >= next.spiritCost;
  const steadyCosts = useMemo(() => (isBreakthroughLayer ? breakthroughCosts(state, "steady") : null), [state, isBreakthroughLayer]);
  const riskyCosts = useMemo(() => (isBreakthroughLayer ? breakthroughCosts(state, "risky") : null), [state, isBreakthroughLayer]);
  const riskyRate = useMemo(() => (isBreakthroughLayer ? breakthroughSuccessRate(state) : 1), [state, isBreakthroughLayer]);
  const riskyFails = isBreakthroughLayer ? (state.breakthroughFails?.[state.realm as BreakthroughLayer] ?? 0) : 0;
  const steadyEnough = !!steadyCosts && view.resources.cultivation >= steadyCosts.success.cultivation && view.resources.spirit >= steadyCosts.success.spirit;
  const riskyEnough = !!riskyCosts && view.resources.cultivation >= riskyCosts.success.cultivation && view.resources.spirit >= riskyCosts.success.spirit;

  useEffect(() => {
    if (isQi4 && tribPreview?.ok) markTribPreviewViewed();
  }, [isQi4, tribPreview?.ok, markTribPreviewViewed]);

  return (
    <>
      <Section title="境界">
        <div className="text-xl font-semibold">{REALM_NAMES[state.realm]}</div>
        {!isMax && next && (
          <>
            <Bar label="修为" value={view.resources.cultivation} max={next.cultivationCost} />
            <Bar label="灵气" value={view.resources.spirit} max={next.spiritCost} />
            {isQi4 ? (
              <p className="mt-1 text-xs text-muted">圆满之境，需渡天劫方可筑基。</p>
            ) : isFoundation3 ? (
              <p className="mt-1 text-xs text-muted">筑基圆满，需首通云岭古道·护丹灵并结丹试炼方可金丹。</p>
            ) : (
              <p className="mt-1 text-xs text-muted">下一境 {next.name}：需修为 {fmt(next.cultivationCost)}、灵气 {fmt(next.spiritCost)}</p>
            )}
          </>
        )}
        {!isMax && !isQi4 && !isFoundation3 && (
          <>
            {!enough && next && (
              <p className="mt-1 text-xs text-cinnabar">
                还差 {fmt(Math.max(0, next.cultivationCost - view.resources.cultivation))} 修为、{fmt(Math.max(0, next.spiritCost - view.resources.spirit))} 灵气
              </p>
            )}
            <div className="mt-3 space-y-2">
              <button onClick={() => doBreakthrough("steady")} disabled={!steadyEnough} className="w-full rounded-lg bg-cinnabar px-4 py-2 text-white disabled:opacity-40">
                稳妥进阶
                {steadyCosts && <span className="ml-1 text-xs opacity-80">消耗修为 {fmt(steadyCosts.success.cultivation)}、灵气 {fmt(steadyCosts.success.spirit)} · 必定成功</span>}
              </button>
              <button onClick={() => doBreakthrough("risky")} disabled={!riskyEnough} className="w-full rounded-lg border border-cinnabar/60 bg-[#f6e3de] px-4 py-2 text-cinnabar disabled:opacity-40">
                冲关进阶
                {riskyCosts && (
                  <span className="ml-1 text-xs opacity-80">
                    成功率 {Math.round(riskyRate * 100)}%（已失败 {riskyFails}/2）· 失败仅扣修为 {fmt(riskyCosts.failure.cultivation)}、灵气 {fmt(riskyCosts.failure.spirit)}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </Section>

      <Section title="产速与来源">
        {prod.lines.map((l, i) => (
          <p key={i} className="py-0.5 text-sm text-ink/80">
            {l}
          </p>
        ))}
      </Section>

      <Section title="闭关">
        {!state.firsts.suppressedFirstNodeOnce ? (
          <p className="text-sm text-muted">首次镇压历练节点后解锁。</p>
        ) : !state.longTask ? (
          <>
            <p className="text-xs text-muted">额外计时修行，不锁住其他操作；到期后手动领取。</p>
            <div className="mt-2 flex gap-2">
              {[30, 60, 120].map((d) => (
                <button
                  key={d}
                  onClick={() => setSeclusionDuration(d)}
                  className={`flex-1 rounded-lg border py-2 text-sm ${seclusionDuration === d ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
                >
                  {d} 分钟
                </button>
              ))}
            </div>
            {seclusionPred.ok && (
              <>
                <p className="mt-2 text-sm">
                  预计额外获得：修为 {fmt(seclusionPred.reward.cultivation)}、灵气 {fmt(seclusionPred.reward.spirit)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  预计 {fmtTime(now + seclusionDuration * 60000)} 结束（{fmtDuration(seclusionDuration)}）
                </p>
              </>
            )}
            <button onClick={() => startLong({ type: "seclusion", durationMinutes: seclusionDuration, protection: false })} className="mt-2 rounded-lg bg-cinnabar px-4 py-2 text-white">
              开始闭关
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">已有进行中的任务，请先领取或中止。</p>
        )}
      </Section>

      <Section title="功法">
        <p className="text-sm">
          {state.technique ? (
            <>
              主修：{TECHNIQUES[state.technique].name} Lv{state.techniqueLevel[state.technique]}
              {state.auxiliaryTechnique ? ` · 辅修：${TECHNIQUES[state.auxiliaryTechnique].name} Lv${state.techniqueLevel[state.auxiliaryTechnique]}` : ""}
            </>
          ) : (
            "尚未主修功法"
          )}
        </p>
        <div className="mt-2 space-y-2">
          {(["qingYun", "xuanGui", "poYue", "juYuan"] as TechniqueId[]).map((id) => {
            const t = TECHNIQUES[id];
            const lvl = state.techniqueLevel[id];
            const nextLvl = lvl < 3 ? t.levels[lvl] : null;
            const isNew = id === "poYue" || id === "juYuan";
            const locked = isNew && state.library < 1;
            const isPrimary = state.technique === id;
            const isAux = state.auxiliaryTechnique === id;
            const canAux = state.library >= 2 && !!state.technique && !isAux;
            return (
              <div key={id} className="rounded-lg border border-line/60 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {t.name}
                    {lvl > 0 && <span className="ml-1 text-xs text-muted">Lv{lvl}</span>}
                    {isPrimary && <span className="ml-1 text-xs text-cinnabar">主修中</span>}
                    {isAux && <span className="ml-1 text-xs text-cinnabar">辅修中</span>}
                  </span>
                  <div className="flex gap-1">
                    {!locked && !isPrimary && (
                      <button onClick={() => setTechnique(id)} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs">
                        主修
                      </button>
                    )}
                    {!locked && canAux && (
                      <button onClick={() => setAuxiliaryTechnique(id)} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs">
                        辅修
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {locked ? (
                    "需一级藏经阁解锁"
                  ) : (
                    <>
                      主修 {eff(id, lvl, false)}
                      {state.library >= 2 && `；辅修 ${eff(id, lvl, true)}`}
                      {lvl > 0 && (nextLvl ? `；下级需残页 ${nextLvl.pageCost}` : "；已满级")}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        {state.technique && state.techniqueLevel[state.technique] < 3 && (
          <button onClick={upgradeTechnique} className="mt-2 rounded-lg bg-cinnabar px-4 py-2 text-white">
            升级功法
          </button>
        )}
      </Section>

      {isQi4 && tribPreview && (
        <Section title="渡劫预览">
          {tribPreview.ok ? (
            <>
              <p className="text-sm">当前气血 {tribPreview.maxHp}</p>
              <p className="mt-1 text-sm">
                减伤 {fmtPct(tribPreview.reduction)}%
                {tribPreview.sources.length > 0
                  ? `（${tribPreview.sources.map((s) => `${s.name} ${fmtPct(s.pct)}%`).join(" + ")}）`
                  : "（无减伤来源）"}
              </p>
              <div className="mt-2 space-y-0.5 text-sm">
                {tribPreview.waves.map((w, i) => (
                  <p key={i}>
                    第{i + 1}波：伤 {w.damage}，余 {w.hpAfter}
                    {tribPreview.pillHealed?.wave === i + 1 && (
                      <span className="text-cinnabar">（丹药回 {tribPreview.pillHealed.amount}）</span>
                    )}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-sm">
                丹药{tribPreview.pillPrepared ? "已预置" : "未预置"} ｜ 预计
                {tribPreview.success ? <span className="text-cinnabar">成功</span> : <span className="text-muted">失败</span>}
              </p>
              {!tribPreview.success && (
                <p className="mt-1 text-xs text-muted">建议：主修玄龟诀提升护劫减伤、穿戴减伤装备、预置护劫丹。</p>
              )}
              <button onClick={startTrib} className="mt-3 rounded-lg bg-cinnabar px-4 py-2 text-white">
                开始渡劫
              </button>
            </>
          ) : (
            <p className="text-sm">{tribPreview.reason}</p>
          )}
        </Section>
      )}

      {isFoundation3 && jindanPreview && (
        <Section title="结丹试炼">
          {jindanPreview.ok ? (
            <>
              <p className="text-sm">当前气血 {jindanPreview.maxHp}</p>
              <p className="mt-1 text-sm">
                减伤 {fmtPct(jindanPreview.reduction)}%
                {jindanPreview.sources.length > 0
                  ? `（${jindanPreview.sources.map((s) => `${s.name} ${fmtPct(s.pct)}%`).join(" + ")}）`
                  : "（无减伤来源）"}
              </p>
              <p className="mt-1 text-sm">
                消耗修为 {jindanPreview.cost.cultivation}、灵气 {jindanPreview.cost.spirit}、灵石 {jindanPreview.cost.spiritStone}
              </p>
              <div className="mt-2 space-y-0.5 text-sm">
                {jindanPreview.waves.map((w, i) => (
                  <p key={i}>
                    第{i + 1}波：伤 {w.damage}，余 {w.hpAfter}
                    {jindanPreview.pillHealed?.wave === i + 1 && (
                      <span className="text-cinnabar">（丹药回 {jindanPreview.pillHealed.amount}）</span>
                    )}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-sm">
                丹药{jindanPreview.pillPrepared ? "已预置" : "未预置"} ｜ 预计
                {jindanPreview.success ? <span className="text-cinnabar">成功</span> : <span className="text-muted">失败</span>}
              </p>
              {!jindanPreview.success && (
                <p className="mt-1 text-xs text-muted">建议：主修玄龟诀提升减伤、穿戴减伤装备、预置护劫丹。</p>
              )}
              {!jindanPreview.canAfford && (
                <p className="mt-1 text-xs text-cinnabar">
                  还差 {fmt(jindanPreview.shortfall.cultivation)} 修为、{fmt(jindanPreview.shortfall.spirit)} 灵气、{fmt(jindanPreview.shortfall.spiritStone)} 灵石
                </p>
              )}
              <button onClick={startJindanTrial} disabled={!jindanPreview.canAfford} className="mt-3 rounded-lg bg-cinnabar px-4 py-2 text-white disabled:opacity-40">
                开始结丹试炼
              </button>
            </>
          ) : (
            <p className="text-sm">{jindanPreview.reason}</p>
          )}
        </Section>
      )}

      {state.tribulationLog && (
        <Section title="渡劫战报">
          {state.tribulationLog.log.map((l, i) => (
            <p key={i} className="py-0.5 text-sm text-ink/80">
              {l}
            </p>
          ))}
          <p className="mt-1 text-sm font-medium">
            {state.tribulationLog.success ? <span className="text-cinnabar">渡劫成功</span> : <span className="text-muted">渡劫失败</span>}
          </p>
          {!state.tribulationLog.success && (
            <p className="mt-1 text-xs text-muted">重新积累门槛，建议提升减伤与气血后再试。</p>
          )}
        </Section>
      )}

      {state.jindanTrial && (
        <Section title="结丹战报">
          {state.jindanTrial.log.map((l, i) => (
            <p key={i} className="py-0.5 text-sm text-ink/80">
              {l}
            </p>
          ))}
          <p className="mt-1 text-sm font-medium">
            {state.jindanTrial.success ? <span className="text-cinnabar">结丹成功</span> : <span className="text-muted">结丹失败</span>}
          </p>
        </Section>
      )}

      <Section title="修行记录">
        {state.recentLogs.slice(-8).reverse().map((l, i) => (
          <p key={i} className="py-0.5 text-sm text-ink/70">
            {l}
          </p>
        ))}
      </Section>
    </>
  );
}
