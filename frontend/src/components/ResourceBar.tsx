"use client";

import Link from "next/link";
import { useGame } from "@/lib/game-context";
import { REALM_NAMES, RESOURCE_LABELS, WEATHERS, ASTROLOGIES, fmt, resourceGains } from "@/lib/labels";

export function ResourceBar() {
  const { view, state, settleNow } = useGame();
  if (!view || !state) return null;
  const pending = resourceGains(state, view);
  const pendingParts = Object.entries(pending)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${RESOURCE_LABELS[k]} +${fmt(v)}`)
    .join("  ");
  const w = WEATHERS[state.daily.weather.id];
  const a = ASTROLOGIES[state.daily.astrology.id];
  const claimed = (state.daily.goals.battle.claimed ? 1 : 0) + (state.daily.goals.suppress.claimed ? 1 : 0);
  const primary = ["cultivation", "spirit", "spiritStone", "page"] as const;
  const secondary = Object.entries(state.resources).filter(([key]) => !primary.includes(key as (typeof primary)[number]));

  return (
    <header className="realm-hero relative overflow-hidden px-5 pb-4 pt-4 text-[#f8f3e8] sm:px-7 sm:pt-5">
      <div className="hero-frame pointer-events-none absolute inset-[7px]" aria-hidden="true" />
      <div className="relative mb-3 flex items-center gap-3 border-b border-[#d7bd87]/25 pb-2 text-[11px] tracking-[.22em] text-[#d9c79e]">
        <span className="hero-volume">青云纪 · 修行卷</span>
        <span className="h-px flex-1 bg-[#d7bd87]/25" />
        <span>道途漫漫</span>
      </div>
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[.32em] text-[#dccda9]">当前境界</p>
          <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h1 className="display-font text-[34px] font-semibold leading-none tracking-[.08em] sm:text-[40px]">{REALM_NAMES[state.realm]}</h1>
            <span className="hero-name display-font text-sm text-[#e3e2d6]">道号 · {state.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#dfdfcf]">
            <span className="hero-omen" title={w?.desc}>天象 · {w?.name ?? "平常"}{state.daily.weather.used ? " · 已用" : ""}</span>
            <span className="hero-omen" title={a?.desc}>星象 · {a?.name ?? "平常"}{state.daily.astrology.used ? " · 已用" : ""}</span>
          </div>
        </div>
        <button onClick={settleNow} className="hero-claim inline-flex min-h-[44px] shrink-0 items-center gap-2 border border-[#ebd9ae] bg-[#dfc494] px-5 py-2 text-sm font-semibold text-[#23312d] shadow-[0_8px_18px_rgba(8,25,23,.18)]">
          <span aria-hidden="true" className="text-lg leading-none">◇</span> 领取收益
        </button>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {primary.map((key, index) => (
          <div key={key} className="resource-tile relative overflow-hidden border border-[#d5c396]/25 px-3 py-2.5 backdrop-blur-sm">
            <span aria-hidden="true" className="resource-tile-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="text-[11px] tracking-widest text-[#d1d8ce]">{RESOURCE_LABELS[key]}</div>
            <div className="display-font mt-0.5 text-[20px] font-semibold tabular-nums tracking-wide sm:text-[23px]">{fmt(state.resources[key])}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#d7bd87]/20 pt-2 text-xs">
        {pendingParts ? <p className="text-[#ebce90]">待领取 · {pendingParts}</p> : <p className="text-[#c9d4cc]">静心修行，灵气自来</p>}
        <Link href="/renwu" className="hero-goal border border-[#d3be91]/40 px-3 py-1 text-[#f4e4bd]">今日目标 {claimed}/2 →</Link>
      </div>
      <details className="relative mt-2 text-xs text-[#d7ded6]">
        <summary className="cursor-pointer select-none py-1">其余行囊 <span className="ml-1 text-[#e4c78d]">展开查看</span></summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pb-1 sm:grid-cols-4">
          {secondary.map(([key, value]) => <span key={key}>{RESOURCE_LABELS[key]} <strong className="ml-1 font-semibold text-white">{fmt(value)}</strong></span>)}
        </div>
      </details>
    </header>
  );
}
