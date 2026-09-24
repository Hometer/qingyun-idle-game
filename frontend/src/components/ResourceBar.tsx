"use client";

import { useGame } from "@/lib/game-context";
import { REALM_NAMES, RESOURCE_LABELS, fmt } from "@/lib/labels";

export function ResourceBar() {
  const { view, state, settleNow } = useGame();
  if (!view || !state) return null;
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
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink/80">
        {Object.entries(view.resources).map(([k, v]) => (
          <span key={k}>
            {RESOURCE_LABELS[k]} {fmt(v)}
          </span>
        ))}
      </div>
    </header>
  );
}
