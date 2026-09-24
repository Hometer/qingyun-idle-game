"use client";

import Link from "next/link";
import { useGame } from "@/lib/game-context";
import { REALM_NAMES, RESOURCE_LABELS, WEATHERS, fmt, resourceGains } from "@/lib/labels";

export function ResourceBar() {
  const { view, state, settleNow } = useGame();
  if (!view || !state) return null;
  const pending = resourceGains(state, view);
  const pendingParts = Object.entries(pending)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${RESOURCE_LABELS[k]} +${fmt(v)}`)
    .join("  ");
  const w = WEATHERS[state.daily.weather];
  const done = state.daily.quests.filter((q) => q.done).length;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-3 py-2 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold">
          {state.name} · {REALM_NAMES[state.realm]}
        </div>
        <button onClick={settleNow} className="text-sm text-cinnabar">
          领取收益
        </button>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
        <span title={w?.desc}>天时·{w?.name ?? "平常"}</span>
        <Link href="/renwu" className="text-cinnabar">
          今日任务 {done}/{state.daily.quests.length}
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink/80">
        {Object.entries(state.resources).map(([k, v]) => (
          <span key={k}>
            {RESOURCE_LABELS[k]} {fmt(v)}
          </span>
        ))}
      </div>
      {pendingParts && <div className="mt-0.5 text-xs text-gold">待领取 {pendingParts}</div>}
    </header>
  );
}
