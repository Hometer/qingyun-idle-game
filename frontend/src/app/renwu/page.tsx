"use client";

import { useRef } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { playerStats } from "@/engine/engine";
import { REALM_NAMES, EQUIPMENT } from "@/lib/labels";

export default function RenwuPage() {
  const { state, doExport, doImport, doReset } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!state) return null;

  const stats = playerStats(state);
  const wearing = [state.equipment.weapon, state.equipment.armor, state.equipment.accessory].filter(
    Boolean,
  ) as string[];

  return (
    <>
      <Section title="人物">
        <p className="text-sm">
          {state.name}（灵根：{state.spiritRoot}）· {REALM_NAMES[state.realm]}
        </p>
        <p className="mt-1 text-sm">
          攻 {stats.attack} ／ 防 {stats.defense} ／ 气血 {stats.hp}
        </p>
        {wearing.length > 0 && (
          <p className="mt-1 text-sm text-muted">穿戴：{wearing.map((id) => EQUIPMENT[id].name).join("、")}</p>
        )}
      </Section>

      <Section title="存档">
        <div className="flex flex-wrap gap-2">
          <button onClick={doExport} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            导出存档
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            导入存档
          </button>
          <button
            onClick={doReset}
            className="rounded-lg border border-cinnabar/50 bg-[#f6e3de] px-3 py-1.5 text-sm text-cinnabar"
          >
            重置（新开一局）
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </Section>
    </>
  );
}
