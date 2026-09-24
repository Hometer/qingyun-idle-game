"use client";

import { useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/game-context";
import type { CopyMode } from "@/lib/prefs";
import { BottomNav } from "./BottomNav";
import { ResourceBar } from "./ResourceBar";
import { EncounterModal } from "./EncounterModal";
import { CreateCharacter } from "./CreateCharacter";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, state, notice, clearNotice, lastResult, clearResult, targets, showDataNotice, dismissDataNotice } = useGame();
  const [noticeMode, setNoticeMode] = useState<CopyMode>("ai");

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted">载入中…</div>;
  }
  if (!state) {
    return <CreateCharacter />;
  }

  const incomplete = targets.filter((t) => !t.done);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col pb-16">
      <ResourceBar />

      {incomplete.length > 0 && (
        <div className="mx-3 mt-2 rounded-lg border border-gold/40 bg-[#fdf6e3] px-4 py-3">
          <div className="text-sm font-semibold">首玩目标</div>
          {targets.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1">
              <div className="text-sm">
                {t.done ? <span className="text-gold">✓</span> : <span className="text-muted">○</span>}{" "}
                {t.label}
                {t.later && <span className="text-xs text-muted">（后续目标）</span>}
              </div>
              {!t.done && !t.later && t.href && (
                <Link href={t.href} className="text-sm text-cinnabar">
                  去完成
                </Link>
              )}
              {!t.done && !t.later && t.hint && <span className="text-xs text-muted">{t.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {notice && (
        <div className="relative mx-3 mt-2 rounded-lg border border-gold/40 bg-[#fdeeca] px-4 py-2 text-sm">
          {notice}
          <button onClick={clearNotice} className="absolute right-2 top-1 text-muted">
            ×
          </button>
        </div>
      )}

      <main className="flex-1 px-3 pb-4">{children}</main>

      <EncounterModal />

      {lastResult && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">{lastResult.title}</h2>
            <div className="mt-2 space-y-0.5">
              {lastResult.lines.map((l, i) => (
                <p key={i} className="text-sm text-ink/80">
                  {l}
                </p>
              ))}
            </div>
            <button onClick={clearResult} className="mt-4 w-full rounded-lg bg-cinnabar py-2 text-white">
              继续修行
            </button>
          </div>
        </div>
      )}

      {showDataNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[480px] rounded-2xl border border-line bg-card p-5">
            <h2 className="text-lg font-semibold">开始前说明</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              游戏进度保存在当前浏览器本地，清理浏览器数据或换设备会丢失，请定期导出存档。
              AI 际遇会把事件类型、道号或称呼、灵根、境界、地图、最近两条修行摘要及选项含义发送给国内模型服务，完整存档不会发送。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setNoticeMode("ai")}
                className={`flex-1 rounded-lg border py-2 text-sm ${noticeMode === "ai" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
              >
                AI 文案
              </button>
              <button
                onClick={() => setNoticeMode("template")}
                className={`flex-1 rounded-lg border py-2 text-sm ${noticeMode === "template" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
              >
                仅用模板
              </button>
            </div>
            <button onClick={() => dismissDataNotice(noticeMode)} className="mt-4 w-full rounded-lg bg-cinnabar py-2 text-white">
              确认并继续
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
