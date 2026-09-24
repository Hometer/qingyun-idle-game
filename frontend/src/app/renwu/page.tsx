"use client";

import { useRef, useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { playerStats } from "@/engine/engine";
import { REALM_NAMES, EQUIPMENT, BUILDINGS, TECHNIQUES, MAPS } from "@/lib/labels";
import { getTheme, setTheme, getReduceMotion, setReduceMotion, getCopyMode, setCopyMode, type Theme, type CopyMode } from "@/lib/prefs";
import type { MapId } from "@/engine/types";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function RenwuPage() {
  const { state, doExport, doImport, doReset, doRestoreBackup } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("qingyun_access_code") || "" : "",
  );
  const [saved, setSaved] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [reduceMotion, setReduceMotionState] = useState<boolean>(getReduceMotion());
  const [copyMode, setCopyModeState] = useState<CopyMode>(getCopyMode());
  const [lastExport, setLastExport] = useState<string | null>(
    typeof localStorage !== "undefined" ? localStorage.getItem("qingyun_last_export") : null,
  );
  const [showAlbum, setShowAlbum] = useState(false);

  if (!state) return null;

  const stats = playerStats(state);
  const wearing = [state.equipment.weapon, state.equipment.armor, state.equipment.accessory].filter(Boolean) as string[];

  const clearedNodes: string[] = [];
  for (const mid of Object.keys(MAPS) as MapId[]) {
    for (const [nid, n] of Object.entries(MAPS[mid].nodes)) {
      if (state.maps[mid][nid]?.cleared) clearedNodes.push(`${MAPS[mid].name}·${n.name}`);
    }
  }
  const ownedEquip = Object.keys(EQUIPMENT).filter((id) => (state.inventory[id] || 0) > 0);
  const learnedTech = (Object.keys(TECHNIQUES) as string[]).filter((id) => state.techniqueLevel[id as "qingYun" | "xuanGui"] > 0);
  const built = (Object.keys(BUILDINGS) as string[]).filter((id) => state.buildings[id as keyof typeof state.buildings] > 0);

  const pickTheme = (t: Theme) => {
    setThemeState(t);
    setTheme(t);
    applyTheme(t);
  };
  const toggleReduce = () => {
    const v = !reduceMotion;
    setReduceMotionState(v);
    setReduceMotion(v);
    document.documentElement.classList.toggle("reduce-motion", v);
  };
  const pickCopy = (m: CopyMode) => {
    setCopyModeState(m);
    setCopyMode(m);
  };
  const saveCode = () => {
    localStorage.setItem("qingyun_access_code", code.trim());
    setSaved(true);
  };
  const handleExport = () => {
    doExport();
    setTimeout(() => setLastExport(localStorage.getItem("qingyun_last_export")), 300);
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

      <Section title="修仙录">
        {state.milestones.length === 0 ? (
          <p className="text-sm text-muted">此前记录未收录，从本次进入起记录。</p>
        ) : (
          [...state.milestones].reverse().map((m, i) => (
            <div key={i} className="flex items-baseline justify-between border-b border-line/60 py-1.5 last:border-0">
              <span className="text-sm text-ink/85">{m.text}</span>
              <span className="ml-2 shrink-0 text-xs text-muted">{fmtTime(m.time)}</span>
            </div>
          ))
        )}
      </Section>

      <Section
        title="图鉴"
        action={
          <button onClick={() => setShowAlbum(!showAlbum)} className="text-sm text-cinnabar">
            {showAlbum ? "收起" : "展开"}
          </button>
        }
      >
        {showAlbum && (
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-muted">敌人与地图</div>
              {clearedNodes.length ? clearedNodes.map((n) => <div key={n}>{n}</div>) : <div className="text-muted">尚未遇见</div>}
            </div>
            <div>
              <div className="text-xs text-muted">装备</div>
              {ownedEquip.length ? ownedEquip.map((id) => <div key={id}>{EQUIPMENT[id].name}</div>) : <div className="text-muted">尚未获得</div>}
            </div>
            <div>
              <div className="text-xs text-muted">功法</div>
              {learnedTech.length ? learnedTech.map((id) => <div key={id}>{TECHNIQUES[id].name}</div>) : <div className="text-muted">尚未修习</div>}
            </div>
            <div>
              <div className="text-xs text-muted">建筑</div>
              {built.length ? built.map((id) => <div key={id}>{BUILDINGS[id].name}</div>) : <div className="text-muted">尚未建造</div>}
            </div>
          </div>
        )}
      </Section>

      <Section title="际遇文案">
        <div className="flex gap-2">
          <button
            onClick={() => pickCopy("ai")}
            className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "ai" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
          >
            AI 文案
          </button>
          <button
            onClick={() => pickCopy("template")}
            className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "template" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
          >
            仅用模板
          </button>
        </div>
      </Section>

      <Section title="显示偏好">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => pickTheme(t)}
              className={`flex-1 rounded-lg border py-2 text-sm ${theme === t ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
            >
              {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reduceMotion} onChange={toggleReduce} />
          减少动效
        </label>
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
        <p className="text-xs text-muted">
          存档版本 v{state.schemaVersion} ｜ 最近发起导出：{lastExport ? fmtTime(new Date(lastExport).getTime()) : "从未"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={handleExport} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            导出存档
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            导入存档
          </button>
          <button onClick={doRestoreBackup} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
            恢复导入前档
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
