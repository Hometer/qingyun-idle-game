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
    <header className="realm-hero relative overflow-hidden rounded-b-[28px] px-5 pb-5 pt-5 text-[#f8f3e8] sm:rounded-[28px] sm:px-7 sm:pt-7">
      <svg aria-hidden="true" viewBox="0 0 620 260" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-70">
        <circle cx="508" cy="50" r="78" fill="none" stroke="#d8b97e" strokeWidth=".8" opacity=".45" />
        <circle cx="508" cy="50" r="57" fill="none" stroke="#d8b97e" strokeWidth=".6" opacity=".3" />
        <path d="M270 215 382 70l58 75 47-48 145 145H270Z" fill="#526f67" opacity=".26" />
        <path d="M220 247 335 132l56 53 37-31 80 93H220Z" fill="#68877b" opacity=".2" />
        <path d="M0 231c115-33 190 9 302-27s216-18 318-20v76H0Z" fill="#0e2828" opacity=".33" />
        <path d="M0 236c120 9 214-15 314-6 99 9 204 2 306-14" fill="none" stroke="#e3d3ab" strokeWidth=".8" opacity=".25" />
      </svg>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-[.3em] text-[#d4bd8c]">青云修仙录 · 修行札记</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="display-font text-[30px] font-semibold leading-none tracking-[.06em] sm:text-[38px]">{REALM_NAMES[state.realm]}</h1>
            <span className="text-sm text-[#e3e2d6]">{state.name}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#c6d2c7]">
            <span title={w?.desc}>天象 {w?.name ?? "平常"}{state.daily.weather.used ? " · 已用" : ""}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#c7b17c]" />
            <span title={a?.desc}>星象 {a?.name ?? "平常"}{state.daily.astrology.used ? " · 已用" : ""}</span>
          </div>
        </div>
        <button onClick={settleNow} className="hero-claim inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl border border-[#d9bd82]/60 bg-[#cfad71] px-4 py-2 text-sm font-semibold text-[#1e302a] shadow-[0_8px_18px_rgba(8,25,23,.18)]">
          <span aria-hidden="true">✦</span> 领取收益
        </button>
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {primary.map((key) => (
          <div key={key} className="rounded-xl border border-white/10 bg-white/[.075] px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[11px] text-[#c9d4cc]">{RESOURCE_LABELS[key]}</div>
            <div className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-wide sm:text-[20px]">{fmt(state.resources[key])}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        {pendingParts ? <p className="text-[#ebce90]">待领取 · {pendingParts}</p> : <p className="text-[#c9d4cc]">静心修行，灵气自来</p>}
        <Link href="/renwu" className="rounded-full border border-white/20 px-3 py-1 text-[#f4e4bd]">今日目标 {claimed}/2 →</Link>
      </div>
      <details className="relative mt-3 border-t border-white/10 pt-2 text-xs text-[#d7ded6]">
        <summary className="cursor-pointer select-none py-1">其它资源 <span className="ml-1 text-[#e4c78d]">展开查看</span></summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pb-1 sm:grid-cols-4">
          {secondary.map(([key, value]) => <span key={key}>{RESOURCE_LABELS[key]} <strong className="ml-1 font-semibold text-white">{fmt(value)}</strong></span>)}
        </div>
      </details>
    </header>
  );
}
