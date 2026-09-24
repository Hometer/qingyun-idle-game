"use client";

import { useRef, useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { playerStats } from "@/engine/engine";
import { REALM_NAMES, EQUIPMENT } from "@/lib/labels";

export default function RenwuPage() {
  const { state, doExport, doImport, doReset } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("qingyun_access_code") || "" : "",
  );
  const [saved, setSaved] = useState(false);
  if (!state) return null;

  const stats = playerStats(state);
  const wearing = [state.equipment.weapon, state.equipment.armor, state.equipment.accessory].filter(
    Boolean,
  ) as string[];

  const saveCode = () => {
    localStorage.setItem("qingyun_access_code", code.trim());
    setSaved(true);
  };

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

      <Section title="访问码">
        <p className="text-xs text-muted">后端开启访问码后，填这里际遇才会调用 AI；不填则自动用模板。</p>
        <div className="mt-2 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="访问码（可留空）"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
          />
          <button onClick={saveCode} className="rounded-lg bg-cinnabar px-3 py-1.5 text-sm text-white">
            保存
          </button>
        </div>
        {saved && <p className="mt-1 text-xs text-muted">已保存</p>}
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
