"use client";

import { useGame } from "@/lib/game-context";

export function EncounterModal() {
  const { state, encounter, encounterLoading, choose } = useGame();
  if (!state?.encounter.pending) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-[520px] rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl">
        <div className="text-xs text-muted">际遇</div>
        {encounterLoading || !encounter ? (
          <p className="py-6 text-center text-muted">文案加载中…</p>
        ) : (
          <>
            <div className="text-xs text-muted">{encounter.source}</div>
            <h2 className="mt-1 text-lg font-semibold">{encounter.title}</h2>
            <p className="mt-2 leading-relaxed text-ink/90">{encounter.body}</p>
            <div className="mt-4 flex flex-col gap-2">
              {encounter.options.map((o) => (
                <button
                  key={o.option_id}
                  onClick={() => choose(o.option_id)}
                  className="rounded-lg border border-line bg-paper px-4 py-2.5 text-left hover:bg-cinnabar/10"
                >
                  {o.option_text}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
