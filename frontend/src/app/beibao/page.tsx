"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { EQUIPMENT } from "@/lib/labels";

export default function BeibaoPage() {
  const { state, equip, craftPill, togglePill } = useGame();
  if (!state) return null;

  const ownedEquip = Object.keys(EQUIPMENT).filter((id) => (state.inventory[id] || 0) > 0);

  return (
    <>
      <Section title="护劫丹">
        <p className="text-sm">
          持有 {state.inventory.tribulationPill || 0} 枚{state.preparedPill ? "（已预置）" : ""}
        </p>
        <div className="mt-2 flex gap-2">
          <button onClick={craftPill} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            炼丹
          </button>
          <button onClick={togglePill} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            {state.preparedPill ? "取消预置" : "预置丹药"}
          </button>
        </div>
      </Section>

      <Section title="装备">
        {ownedEquip.length === 0 ? (
          <p className="text-sm text-muted">暂无可用装备，历练首通可得</p>
        ) : (
          ownedEquip.map((id) => {
            const e = EQUIPMENT[id];
            const cur = state.equipment[e.slot as "weapon" | "armor" | "accessory"];
            const wearing = cur === id;
            return (
              <div key={id} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
                <div className="text-sm">
                  {e.name}
                  {wearing && <span className="text-muted">（穿戴中）</span>}
                </div>
                <button
                  onClick={() => equip(id)}
                  disabled={wearing}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  穿戴
                </button>
              </div>
            );
          })
        )}
      </Section>
    </>
  );
}
