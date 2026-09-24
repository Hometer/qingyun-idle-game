"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { MAPS } from "@/lib/labels";
import type { MapId } from "@/engine/types";

export default function LilianPage() {
  const { state, fight, suppress, battleLog } = useGame();
  if (!state) return null;

  return (
    <>
      {(Object.keys(MAPS) as MapId[]).map((mid) => (
        <Section key={mid} title={MAPS[mid].name}>
          {Object.entries(MAPS[mid].nodes).map(([nid, n]) => {
            const ns = state.maps[mid][nid];
            const supped = state.suppression[mid] === nid;
            return (
              <div key={nid} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
                <div className="text-sm">
                  {n.name}
                  {!ns.unlocked && <span className="text-muted">（未解锁）</span>}
                  {ns.cleared && <span className="text-muted">·已通关</span>}
                  {supped && <span className="text-cinnabar">·镇压中</span>}
                </div>
                <div className="flex gap-2">
                  {ns.unlocked && (
                    <button onClick={() => fight(mid, nid)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                      战斗
                    </button>
                  )}
                  {ns.cleared && !supped && (
                    <button onClick={() => suppress(mid, nid)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                      镇压
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Section>
      ))}

      {battleLog.length > 0 && (
        <Section title="战报">
          {battleLog.map((l, i) => (
            <p key={i} className="py-0.5 text-sm text-ink/80">
              {l}
            </p>
          ))}
        </Section>
      )}
    </>
  );
}
