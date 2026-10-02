"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "./Modal";
import { useGame } from "@/lib/game-context";
import type { CopyMode } from "@/lib/prefs";
import { fmtTime, fmtDuration, fmtRemaining } from "@/lib/labels";
import { BottomNav, NavIcon, TABS } from "./BottomNav";
import { ResourceBar } from "./ResourceBar";
import { EncounterModal } from "./EncounterModal";
import { CreateCharacter } from "./CreateCharacter";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, state, notice, clearNotice, lastResult, clearResult, targets, showDataNotice, dismissDataNotice, claimLong, abortLong, now, loadError, retryLoad, exportRawSave, metadataError, repairMetadata, doRestoreBackup } = useGame();
  const [noticeMode, setNoticeMode] = useState<CopyMode>("ai");
  const pathname = usePathname();

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted">载入中…</div>;
  }
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">存档读取异常</h2>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
          {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={retryLoad} className="rounded-lg bg-cinnabar px-4 py-2 text-white">重试读取</button>
            <button onClick={exportRawSave} className="rounded-lg border border-line bg-paper px-4 py-2">导出原档</button>
            {metadataError && <button onClick={repairMetadata} className="rounded-lg border border-line bg-paper px-4 py-2">修复存档元数据</button>}
            <button onClick={doRestoreBackup} className="rounded-lg border border-line bg-paper px-4 py-2">恢复上次导入前的备份</button>
          </div>
          <p className="mt-3 text-xs text-muted">导出不会修改原档；恢复须确认，将用备份替换当前进度。元数据修复不改角色和备份。</p>
        </div>
      </div>
    );
  }
  if (!state) {
    return <CreateCharacter />;
  }

  const incomplete = targets.filter((t) => !t.done);
  const nextTarget = incomplete.find((t) => !t.later) ?? incomplete[0];
  const pageInfo = {
    "/xiulian": ["修炼", "凝神养气，向下一境迈进"],
    "/lilian": ["历练", "入山海，遇万象，磨砺自身"],
    "/dongfu": ["洞府", "经营一方清静地，蓄养修行根基"],
    "/beibao": ["背包", "丹药法器，各有其用"],
    "/renwu": ["人物", "回望来路，续写修行录"],
    "/pianzhang": ["修行篇章", "每一次突破，都是故事的一页"],
  }[pathname] ?? ["修行", "山高水长，道途未尽"];

  return (
    <div className="game-shell mx-auto min-h-screen w-full max-w-[1510px] lg:grid lg:grid-cols-[222px_minmax(0,1fr)] lg:gap-5 lg:px-5 xl:gap-6">
      <aside className="desktop-sidebar hidden lg:sticky lg:top-5 lg:my-5 lg:flex lg:h-[calc(100vh-40px)] lg:flex-col">
        <div className="sidebar-top flex items-center gap-3 px-5 pt-7">
          <span className="brand-seal flex h-11 w-11 items-center justify-center text-xl">青</span>
          <div><div className="display-font text-lg font-semibold tracking-[.13em]">青云修仙录</div><div className="mt-0.5 text-[10px] tracking-[.22em] text-[#b7c6bc]">一念入道 · 万象归真</div></div>
        </div>
        <div className="mx-5 mt-9 border-t border-[#d4c293]/25 pt-4 text-[10px] tracking-[.25em] text-[#a9bcb5]">修行目录 / 仙途五卷</div>
        <nav aria-label="主导航" className="mt-3 flex flex-col gap-1 px-3">
          {TABS.map((tab, index) => {
            const active = pathname.startsWith(tab.href);
            return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
              className={`sidebar-link flex items-center gap-3 px-3 py-3 ${active ? "sidebar-link-active" : ""}`}>
              <span className="sidebar-link-index">{String(index + 1).padStart(2, "0")}</span>
              <NavIcon name={tab.icon} className="h-5 w-5 shrink-0" />
              <span className="display-font text-[16px] font-semibold tracking-[.1em]">{tab.label}</span>
              <span aria-hidden="true" className="ml-auto text-sm opacity-55">{active ? "◆" : "·"}</span>
            </Link>;
          })}
        </nav>
        <div className="mt-auto px-5 pb-6">
          <div className="sidebar-verse border-t border-[#d4c293]/25 pt-5 text-xs leading-loose text-[#c2d0c4]">山高自有客，云深亦有路。<br />且行，且修。</div>
          <div className="mt-5 text-[10px] tracking-[.3em] text-[#9dbaac]">青云 · 修行纪</div>
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-10 lg:pt-5">
      <div className="game-topbar hidden lg:flex" aria-label="当前篇章">
        <span className="game-topbar-brand">青云修仙录 <span>· QINGYUN</span></span>
        <span className="game-topbar-location">仙途五卷 <span aria-hidden="true">／</span> {pageInfo[0]}篇</span>
      </div>
      <ResourceBar />

      {state.longTask && (
        <div className="mx-4 mt-3 rounded-2xl border border-gold/40 bg-card px-4 py-3 sm:mx-5 lg:mx-0">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {state.longTask.type === "training" ? "持续历练" : "闭关"} · {fmtDuration(state.longTask.durationMinutes)}
              {now >= state.longTask.endAt ? " · 可领取" : ` · 剩 ${fmtRemaining(now, state.longTask.endAt, state.longTask.durationMinutes)}`}
            </div>
            <div className="flex gap-2">
              {now >= state.longTask.endAt ? (
                <button onClick={claimLong} className="rounded-lg bg-cinnabar px-3 py-1 text-sm text-white">领取</button>
              ) : (
                <button onClick={abortLong} className="rounded-lg border border-line bg-paper px-3 py-1 text-sm">中止</button>
              )}
            </div>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            开始 {fmtTime(state.longTask.startAt)} · 预计 {fmtTime(state.longTask.endAt)} 结束
          </div>
        </div>
      )}

      {incomplete.length > 0 && (
        <details className="first-steps mx-4 mt-3 rounded-2xl border border-gold/40 px-4 py-3 sm:mx-5 lg:mx-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span><span className="display-font font-semibold">初入仙途</span><span className="ml-2 text-xs text-muted">下一步 · {nextTarget.label}</span></span>
            <span className="shrink-0 text-xs text-cinnabar">查看目标 ↓</span>
          </summary>
          <div className="mt-3 border-t border-line/70 pt-2">
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
        </details>
      )}

      {notice && (
        <div role="status" className="surface-note relative mx-4 mt-3 rounded-xl border border-gold/40 px-4 py-3 pr-9 text-sm sm:mx-5 lg:mx-0">
          {notice}
          <button onClick={clearNotice} className="absolute right-2 top-1 text-muted">
            ×
          </button>
        </div>
      )}

      <main tabIndex={-1} className="game-main mx-auto w-full max-w-[1100px] px-4 pb-4 sm:px-5 lg:px-0">
        <div className="page-intro mb-4 mt-6 flex items-end justify-between gap-4">
          <div><p className="text-[11px] font-semibold tracking-[.26em] text-gold">青云纪 · {pageInfo[0]}篇</p>
          <h2 className="display-font mt-1 text-[31px] font-semibold leading-tight tracking-[.12em] text-ink sm:text-[37px]">{pageInfo[0]}</h2>
          <p className="mt-1 text-sm text-muted">{pageInfo[1]}</p></div>
          <div aria-hidden="true" className="page-intro-mark hidden text-2xl sm:grid">道</div>
        </div>
        {children}
      </main>

      <EncounterModal />

      {lastResult && !showDataNotice && (
        <Modal title={lastResult.title}>
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
        </Modal>
      )}

      {showDataNotice && (
        <Modal title="开始前说明">
            <h2 className="text-lg font-semibold">开始前说明</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              游戏进度保存在当前浏览器本地，清理浏览器数据或换设备会丢失，请定期导出存档。
              AI 际遇会把事件类型、道号或称呼、灵根、境界、地图、最近两条修行摘要及选项含义发送给国内模型服务，完整存档不会发送。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setNoticeMode("ai")}
                className={`flex-1 rounded-lg border py-2 text-sm ${noticeMode === "ai" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}
              >
                AI 文案
              </button>
              <button
                onClick={() => setNoticeMode("template")}
                className={`flex-1 rounded-lg border py-2 text-sm ${noticeMode === "template" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}
              >
                仅用模板
              </button>
            </div>
            <button onClick={() => dismissDataNotice(noticeMode)} className="mt-4 w-full rounded-lg bg-cinnabar py-2 text-white">
              确认并继续
            </button>
        </Modal>
      )}

      <BottomNav />
      </div>
    </div>
  );
}
