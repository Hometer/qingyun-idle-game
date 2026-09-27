"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { EQUIPMENT, BUILDINGS, REALM_NAMES, REALM_ORDER } from "@/lib/labels";
import { CONFIG } from "@/engine/config";

export default function BeibaoPage() {
  const { state, view, equip, craftPill, togglePill, craftEquipment } = useGame();
  if (!state) return null;
  const current = view ?? state;

  const ownedEquip = Object.keys(EQUIPMENT).filter((id) => (state.inventory[id] || 0) > 0);
  const furnaceLvl = state.buildings.alchemyFurnace;
  const recipe = furnaceLvl >= 1 ? BUILDINGS.alchemyFurnace.levels[furnaceLvl - 1] : null;
  const canCraft =
    recipe !== null &&
    current.resources.herb >= (recipe.pillHerbCost ?? 0) &&
    current.resources.spiritStone >= (recipe.pillStoneCost ?? 0);

  return (
    <>
      <Section title="护劫丹">
        <p className="text-sm">
          持有 {state.inventory.tribulationPill || 0} 枚{state.preparedPill ? "（已预置）" : ""}
        </p>
        {recipe ? (
          <p className="mt-1 text-xs text-muted">
            配方：灵草 {recipe.pillHerbCost} + 灵石 {recipe.pillStoneCost}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">需先建造炼丹炉方可炼丹</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            onClick={craftPill}
            disabled={!canCraft}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
          >
            炼丹
          </button>
          <button onClick={togglePill} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            {state.preparedPill ? "取消预置" : "预置丹药"}
          </button>
        </div>
      </Section>

      <Section title="炼器">
        {state.forge < 1 ? (
          <p className="text-sm text-muted">需先建造炼器台方可炼器</p>
        ) : (
          Object.keys(CONFIG.crafts).map((id) => {
            const cfg = CONFIG.crafts[id as keyof typeof CONFIG.crafts];
            const eq = CONFIG.equipment[id as keyof typeof CONFIG.equipment] as unknown as { name: string; attack?: number; defense?: number; hp?: number; tribulationReduction?: number };
            if (!cfg || !eq) return null;
            const gateOk = REALM_ORDER.indexOf(current.realm) >= REALM_ORDER.indexOf(cfg.gate);
            const canCraft =
              gateOk && current.resources.iron >= cfg.cost.iron &&
              current.resources.spiritStone >= cfg.cost.spiritStone &&
              current.resources.herb >= cfg.cost.herb &&
              current.resources.page >= cfg.cost.page;
            const attrs = [
              eq.attack ? `攻+${eq.attack}` : "",
              eq.defense ? `防+${eq.defense}` : "",
              eq.hp ? `气血+${eq.hp}` : "",
              eq.tribulationReduction ? `护劫减伤+${Math.round(eq.tribulationReduction * 100)}%` : "",
            ].filter(Boolean).join("、");
            const shortfall = [
              Math.max(0, cfg.cost.iron - current.resources.iron) > 0 ? `玄铁 ${Math.max(0, cfg.cost.iron - current.resources.iron)}` : "",
              Math.max(0, cfg.cost.spiritStone - current.resources.spiritStone) > 0 ? `灵石 ${Math.max(0, cfg.cost.spiritStone - current.resources.spiritStone)}` : "",
              Math.max(0, cfg.cost.herb - current.resources.herb) > 0 ? `灵草 ${Math.max(0, cfg.cost.herb - current.resources.herb)}` : "",
              Math.max(0, cfg.cost.page - current.resources.page) > 0 ? `残页 ${Math.max(0, cfg.cost.page - current.resources.page)}` : "",
            ].filter(Boolean).join("、");
            return (
              <div key={id} className="border-b border-line/60 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {eq.name} <span className="text-xs text-muted">{attrs}</span>
                  </div>
                  <button
                    onClick={() => craftEquipment(id)}
                    disabled={!canCraft}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    炼制
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  材料：玄铁 {cfg.cost.iron}、灵石 {cfg.cost.spiritStone}
                  {cfg.cost.herb ? `、灵草 ${cfg.cost.herb}` : ""}
                  {cfg.cost.page ? `、残页 ${cfg.cost.page}` : ""}
                  {!gateOk ? `（需${REALM_NAMES[cfg.gate]}）` : !canCraft && shortfall ? `（还差 ${shortfall}）` : ""}
                </p>
              </div>
            );
          })
        )}
      </Section>

      <Section title="装备">
        {ownedEquip.length === 0 ? (
          <p className="text-sm text-muted">暂无可用装备，历练首通可得</p>
        ) : (
          ownedEquip.map((id) => {
            const e = EQUIPMENT[id];
            const cur = state.equipment[e.slot as "weapon" | "armor" | "accessory"];
            const wearing = cur === id;
            const curCfg = cur ? EQUIPMENT[cur] : null;
            const dAtk = (e.attack ?? 0) - (curCfg?.attack ?? 0);
            const dDef = (e.defense ?? 0) - (curCfg?.defense ?? 0);
            const dHp = (e.hp ?? 0) - (curCfg?.hp ?? 0);
            const delta: string[] = [];
            if (dAtk) delta.push(`${dAtk > 0 ? "+" : ""}${dAtk} 攻`);
            if (dDef) delta.push(`${dDef > 0 ? "+" : ""}${dDef} 防`);
            if (dHp) delta.push(`${dHp > 0 ? "+" : ""}${dHp} 气血`);
            return (
              <div key={id} className="border-b border-line/60 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {e.name}
                    <span className="ml-1 text-xs text-muted">
                      {e.attack ? `攻+${e.attack}` : ""}
                      {e.defense ? ` 防+${e.defense}` : ""}
                  {e.hp ? ` 气血+${e.hp}` : ""}
                  {e.tribulationReduction ? ` 护劫减伤+${Math.round(e.tribulationReduction * 100)}%` : ""}
                    </span>
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
                {!wearing && delta.length > 0 && (
                  <p className="mt-0.5 text-xs text-cinnabar">穿上后 {delta.join("，")}</p>
                )}
              </div>
            );
          })
        )}
      </Section>
    </>
  );
}
