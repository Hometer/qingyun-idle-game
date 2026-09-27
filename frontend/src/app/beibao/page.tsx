"use client";

import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { EQUIPMENT, BUILDINGS, REALM_NAMES, REALM_ORDER, RESOURCE_LABELS } from "@/lib/labels";
import { CONFIG } from "@/engine/config";
import { playerStats } from "@/engine/engine";

function affixText(affixes: Array<{ id: string; value: number }> | undefined): string {
  if (!affixes || affixes.length === 0) return "";
  const cfg = CONFIG.affixes as unknown as Record<string, { name: string; type: string }>;
  return affixes.map((a) => {
    const c = cfg[a.id];
    const v = c?.type === "flat" ? `${a.value}` : `${Math.round(a.value * 100)}%`;
    return `${c?.name ?? a.id} +${v}`;
  }).join("、");
}

export default function BeibaoPage() {
  const { state, view, equip, craftPill, togglePill, craftGainPill, useGainPill: consumeGainPill, quenchEquipment, craftEquipment } = useGame();
  if (!state) return null;
  const current = view ?? state;
  const equippedStats = playerStats(current);

  const ownedEquip = Object.keys(EQUIPMENT).filter((id) => (state.inventory[id] || 0) > 0);
  const furnaceLvl = state.buildings.alchemyFurnace;
  const recipe = furnaceLvl >= 1 ? BUILDINGS.alchemyFurnace.levels[furnaceLvl - 1] : null;

  return (
    <>
      <Section title="装备" variant="featured">
        <p className="mb-2 text-xs text-muted">下列装备加成为基础值；战斗时随当前境界放大。“穿上后”显示当前实际属性变化。</p>
        {ownedEquip.length === 0 ? (
          <p className="text-sm text-muted">暂无可用装备，历练首通可得</p>
        ) : (
          ownedEquip.map((id) => {
            const e = EQUIPMENT[id];
            const cur = state.equipment[e.slot as "weapon" | "armor" | "accessory"];
            const wearing = cur === id;
            const nextStats = playerStats({ ...current, equipment: { ...current.equipment, [e.slot]: id } });
            const dAtk = nextStats.attack - equippedStats.attack;
            const dDef = nextStats.defense - equippedStats.defense;
            const dHp = nextStats.hp - equippedStats.hp;
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
                      {e.attack ? `基础攻+${e.attack}` : ""}
                      {e.defense ? ` 基础防+${e.defense}` : ""}
                  {e.hp ? ` 基础气血+${e.hp}` : ""}
                  {e.tribulationReduction ? ` 护劫减伤+${Math.round(e.tribulationReduction * 100)}%` : ""}
                    </span>
                    {wearing && <span className="text-muted">（穿戴中）</span>}
                  </div>
                  <div className="flex gap-1">
                    {CONFIG.crafts[id as keyof typeof CONFIG.crafts] && !state.quenched.includes(id) && (
                      <button onClick={() => quenchEquipment(id)} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs">
                        淬炼
                      </button>
                    )}
                    <button
                      onClick={() => equip(id)}
                      disabled={wearing}
                      className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      穿戴
                    </button>
                  </div>
                </div>
                {!wearing && delta.length > 0 && (
                  <p className="mt-0.5 text-xs text-cinnabar">穿上后 {delta.join("，")}</p>
                )}
                {state.equipmentAffixes[id]?.length ? (
                  <p className="mt-0.5 text-xs text-gold">词条：{affixText(state.equipmentAffixes[id])}</p>
                ) : null}
              </div>
            );
          })
        )}
      </Section>

      <Section title="丹药">
        <div className="mb-2 text-xs text-muted">护劫丹：试炼第三波回血，手动预置不占收益丹次数。</div>
        {[1, 2, 3, 4].map((tier) => {
          const tierName = ["凡", "灵", "仙", "道"][tier - 1];
          const pillId = tier === 1 ? "tribulationPill" : `tribulationPill_${tier}`;
          const held = state.inventory[pillId] || 0;
          const healPct = Math.round(CONFIG.pills.tribulationHealPct[tier - 1] * 100);
          const herb = tier === 1 ? (recipe?.pillHerbCost ?? 0) : CONFIG.pills.tribulationHerb[tier - 1];
          const stone = tier === 1 ? (recipe?.pillStoneCost ?? 0) : CONFIG.pills.tribulationStone[tier - 1];
          const page = tier === 1 ? 0 : CONFIG.pills.tribulationPage[tier - 1];
          const needFurnace = tier === 1 ? 1 : tier === 2 ? 4 : tier === 3 ? 5 : 6;
          const canCraft = recipe !== null && furnaceLvl >= needFurnace && current.resources.herb >= herb && current.resources.spiritStone >= stone && current.resources.page >= page;
          const isPrepared = state.preparedPill && state.preparedPillTier === tier;
          return (
            <div key={`t_${tier}`} className="border-b border-line/60 py-2 last:border-0">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  护劫丹·{tierName}品（回血 {healPct}%）
                  <span className="ml-1 text-xs text-muted">持有 {held} 枚{isPrepared ? " · 已预置" : ""}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => craftPill(tier)} disabled={!canCraft} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs disabled:opacity-40">炼</button>
                  <button onClick={() => togglePill(tier)} disabled={held < 1 && !isPrepared} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs disabled:opacity-40">{isPrepared ? "取消预置" : "预置"}</button>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {furnaceLvl < needFurnace ? `需${needFurnace}级炼丹炉` : `配方：灵草 ${herb}、灵石 ${stone}${page ? `、残页 ${page}` : ""}`}
              </p>
            </div>
          );
        })}

        <div className="mt-3 mb-2 text-xs text-muted">收益丹：服用一次性获得当前产速收益，每日合计一枚。</div>
        {(["yangYuan", "juLing"] as const).map((type) =>
          [1, 2, 3, 4].map((tier) => {
            const tierName = ["凡", "灵", "仙", "道"][tier - 1];
            const name = type === "yangYuan" ? "养元丹" : "聚灵丹";
            const pillId = `${type === "yangYuan" ? "yangYuan" : "juLing"}Dan_${tier}`;
            const held = state.inventory[pillId] || 0;
            const herb = CONFIG.pills.gainHerb[tier - 1];
            const stone = CONFIG.pills.gainStone[tier - 1];
            const page = CONFIG.pills.gainPage[tier - 1];
            const needFurnace = CONFIG.pills.gainFurnaceLevel[tier - 1];
            const minutes = CONFIG.pills.gainMinutes[tier - 1];
            const canCraft = furnaceLvl >= needFurnace && current.resources.herb >= herb && current.resources.spiritStone >= stone && current.resources.page >= page;
            const danUsed = current.daily.rewardedDan >= 1;
            return (
              <div key={`g_${type}_${tier}`} className="border-b border-line/60 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {name}·{tierName}品（{minutes} 分钟）
                    <span className="ml-1 text-xs text-muted">持有 {held} 枚</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => craftGainPill(type, tier)} disabled={!canCraft} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs disabled:opacity-40">炼</button>
                    <button onClick={() => consumeGainPill(type, tier)} disabled={held < 1 || danUsed} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs disabled:opacity-40">{danUsed ? "今日已服" : "服用"}</button>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {furnaceLvl < needFurnace ? `需${needFurnace}级炼丹炉` : `配方：灵草 ${herb}、灵石 ${stone}${page ? `、残页 ${page}` : ""}`}
                </p>
              </div>
            );
          })
        )}
      </Section>

      <Section title="炼器">
        {state.forge < CONFIG.forge.levels.length ? (
          <p className="text-sm text-muted">需先建造炼器台方可炼器</p>
        ) : (
          Object.keys(CONFIG.crafts).map((id) => {
            const cfg = CONFIG.crafts[id as keyof typeof CONFIG.crafts];
            const eq = CONFIG.equipment[id as keyof typeof CONFIG.equipment] as unknown as { name: string; attack?: number; defense?: number; hp?: number; tribulationReduction?: number };
            if (!cfg || !eq) return null;
            const gateOk = REALM_ORDER.indexOf(current.realm) >= REALM_ORDER.indexOf(cfg.gate);
            const costObj = cfg.cost as Record<string, number>;
            const canCraft =
              gateOk &&
              Object.entries(costObj).every(([k, v]) => v <= 0 || (current.resources as unknown as Record<string, number>)[k] >= v);
            const attrs = [
              eq.attack ? `攻+${eq.attack}` : "",
              eq.defense ? `防+${eq.defense}` : "",
              eq.hp ? `气血+${eq.hp}` : "",
              eq.tribulationReduction ? `护劫减伤+${Math.round(eq.tribulationReduction * 100)}%` : "",
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
                  材料：{Object.entries(costObj).filter(([, v]) => v > 0).map(([k, v]) => `${RESOURCE_LABELS[k] ?? k} ${v}`).join("、") || "无"}
                  {!gateOk ? `（需${REALM_NAMES[cfg.gate]}）` : !canCraft ? "（材料不足）" : ""}
                </p>
              </div>
            );
          })
        )}
      </Section>

    </>
  );
}
