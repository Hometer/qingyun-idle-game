"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { REALM_NAMES, REALM_LIST, TECHNIQUES, fmt } from "@/lib/labels";
import type { TechniqueId } from "@/engine/types";

function eff(id: string, lvl: number): string {
  if (lvl < 1) return "未修";
  const lv = TECHNIQUES[id].levels[lvl - 1];
  if (id === "qingYun") return `修为产出 ${lv.cultivationMult}×`;
  return `护劫减伤 ${Math.round((lv.tribulationReduction ?? 0) * 100)}%`;
}

export default function XiulianPage() {
  const { state, doBreakthrough, startTrib, tribPreview, setTechnique, upgradeTechnique } = useGame();
  if (!state) return null;
  const idx = REALM_LIST.findIndex((r) => r.id === state.realm);
  const next = REALM_LIST[idx + 1];
  const isQi4 = state.realm === "qi4";
  const isMax = state.realm === "foundation1";

  return (
    <>
      <Section title="境界">
        <div className="text-xl font-semibold">{REALM_NAMES[state.realm]}</div>
        {!isMax && !isQi4 && next && (
          <p className="mt-1 text-sm text-muted">
            下一境 {next.name}：需修为 {fmt(next.cultivationCost)}、灵气 {fmt(next.spiritCost)}
          </p>
        )}
        {isQi4 && next && (
          <p className="mt-1 text-sm text-muted">
            圆满之境，需渡天劫方可筑基（修为 {fmt(next.cultivationCost)}、灵气 {fmt(next.spiritCost)}）
          </p>
        )}
        {!isMax && !isQi4 && (
          <button onClick={doBreakthrough} className="mt-3 rounded-lg bg-cinnabar px-4 py-2 text-white">
            小进阶
          </button>
        )}
      </Section>

      <Section title="功法">
        {state.technique ? (
          <p className="text-sm">
            主修：{TECHNIQUES[state.technique].name} Lv{state.techniqueLevel[state.technique]}
          </p>
        ) : (
          <p className="text-sm text-muted">尚未主修功法</p>
        )}
        <div className="mt-2 space-y-2">
          {(["qingYun", "xuanGui"] as TechniqueId[]).map((id) => {
            const t = TECHNIQUES[id];
            const lvl = state.techniqueLevel[id];
            const nextLvl = lvl < 3 ? t.levels[lvl] : null;
            return (
              <div key={id} className="rounded-lg border border-line/60 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  {state.technique !== id ? (
                    <button onClick={() => setTechnique(id)} className="rounded-lg border border-line bg-paper px-3 py-1 text-sm">
                      主修
                    </button>
                  ) : (
                    <span className="text-xs text-cinnabar">主修中</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {eff(id, lvl)}
                  {nextLvl
                    ? ` → 下级 ${eff(id, lvl + 1)}（需残页 ${nextLvl.pageCost}）`
                    : " · 已满级"}
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
              <p className="text-sm">五波伤害：{tribPreview.waves.join(" / ")}</p>
              <p className="mt-1 text-sm">
                减伤 {Math.round(tribPreview.reduction * 100)}% ｜ 丹药{tribPreview.pillPrepared ? "已预置" : "未预置"}
              </p>
              <p className="mt-1 text-sm">
                预计结果：
                {tribPreview.success ? <span className="text-cinnabar">渡劫成功</span> : <span className="text-muted">可能失败</span>}
              </p>
              <button onClick={startTrib} className="mt-3 rounded-lg bg-cinnabar px-4 py-2 text-white">
                开始渡劫
              </button>
            </>
          ) : (
            <p className="text-sm">{tribPreview.reason}</p>
          )}
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
