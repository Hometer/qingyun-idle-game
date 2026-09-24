"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { BUILDINGS } from "@/lib/labels";
import type { BuildingId } from "@/engine/types";

export default function DongfuPage() {
  const { state, upgradeBuilding } = useGame();
  if (!state) return null;

  return (
    <Section title="洞府建筑">
      {(Object.keys(BUILDINGS) as BuildingId[]).map((id) => {
        const b = BUILDINGS[id];
        const lvl = state.buildings[id];
        const cost = lvl < 3 ? b.levels[lvl].cost : null;
        return (
          <div key={id} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
            <div>
              <div className="font-medium">
                {b.name} <span className="text-muted">Lv{lvl}</span>
              </div>
              {cost !== null ? (
                <div className="text-xs text-muted">升级需 {cost} 灵石</div>
              ) : (
                <div className="text-xs text-muted">已满级</div>
              )}
            </div>
            {lvl < 3 && (
              <button onClick={() => upgradeBuilding(id)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                升级
              </button>
            )}
          </div>
        );
      })}
    </Section>
  );
}
