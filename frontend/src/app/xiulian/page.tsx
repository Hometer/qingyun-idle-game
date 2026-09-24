"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { REALM_NAMES, REALM_LIST, fmt } from "@/lib/labels";

export default function XiulianPage() {
  const { state, doBreakthrough, startTrib, tribPreview } = useGame();
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
