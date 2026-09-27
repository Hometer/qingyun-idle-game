"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { playerStats } from "@/engine/engine";
import { CONFIG } from "@/engine/config";
import { REALM_NAMES, EQUIPMENT, BUILDINGS, TECHNIQUES, DAILY_GOALS, RESOURCE_LABELS, SECRET_REALMS, fmtTime } from "@/lib/labels";
import { getTheme, setTheme, getReduceMotion, setReduceMotion, getCopyMode, setCopyMode, type Theme, type CopyMode } from "@/lib/prefs";
import type { MapId, SecretRealmId } from "@/engine/types";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const MAPS_CFG = CONFIG.maps as unknown as Record<
  string,
  { name: string; nodes: Record<string, { name: string; firstClear: { equipment: string | null } }> }
>;

export default function RenwuPage() {
  const { state, doExport, doImport, doReset, doRestoreBackup, claimGoal, setResonance } = useGame();
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
  const base = { attack: CONFIG.baseAttack, defense: CONFIG.baseDefense, hp: CONFIG.baseHp };
  const wearing = [state.equipment.weapon, state.equipment.armor, state.equipment.accessory].filter(Boolean) as string[];
  const eqContrib: string[] = [];
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const id = state.equipment[slot];
    if (id) {
      const e = EQUIPMENT[id];
      const bits: string[] = [];
      if (e.attack) bits.push(`攻+${e.attack}`);
      if (e.defense) bits.push(`防+${e.defense}`);
      if (e.hp) bits.push(`气血+${e.hp}`);
      if (bits.length) eqContrib.push(`${e.name} ${bits.join(" ")}`);
    }
  }

  const clearedNodes: string[] = [];
  const equipSource: Record<string, string> = {};
  let totalEnemies = 0;
  for (const mid of Object.keys(MAPS_CFG) as MapId[]) {
    totalEnemies += Object.keys(MAPS_CFG[mid].nodes).length;
    for (const [nid, n] of Object.entries(MAPS_CFG[mid].nodes)) {
      if (state.maps[mid][nid]?.cleared) clearedNodes.push(`${MAPS_CFG[mid].name}·${n.name}`);
      if (n.firstClear.equipment) equipSource[n.firstClear.equipment] = `${MAPS_CFG[mid].name}·${n.name}首通`;
    }
  }
  const ownedEquip = Object.keys(EQUIPMENT).filter((id) => (state.inventory[id] || 0) > 0);
  const learnedTech = (Object.keys(TECHNIQUES) as string[]).filter((id) => state.techniqueLevel[id as "qingYun" | "xuanGui"] > 0);
  const built = (Object.keys(BUILDINGS) as string[]).filter((id) => state.buildings[id as keyof typeof state.buildings] > 0);
  const currentStage = CONFIG.realms.find((r) => r.id === state.realm)?.stage ?? 1;

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
          {state.name}（灵根：{state.spiritRoots.join("、")}）· {REALM_NAMES[state.realm]}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          经脉：{CONFIG.meridians[state.meridians].name}（产速 ×{CONFIG.meridians[state.meridians].productionMult}）· 悟性：{CONFIG.comprehensions[state.comprehension].name}（功法费用 ×{CONFIG.comprehensions[state.comprehension].pageMult}）
        </p>
        <p className="mt-0.5 text-sm text-muted">
          修炼侧重：{CONFIG.aptitudes[state.aptitude].name}（修为 ×{CONFIG.aptitudes[state.aptitude].cultivationMult}、灵气 ×{CONFIG.aptitudes[state.aptitude].spiritMult}）
        </p>
        <p className="mt-1 text-sm text-muted">
          基础 攻{base.attack} 防{base.defense} 气血{base.hp}
        </p>
        {eqContrib.length > 0 && <p className="mt-0.5 text-sm text-muted">装备：{eqContrib.join("；")}</p>}
        {(state.technique === "poYue" || state.auxiliaryTechnique === "poYue") && state.techniqueLevel.poYue >= 1 && (
          <p className="mt-0.5 text-sm text-muted">
            破岳诀：攻+{state.technique === "poYue" ? CONFIG.techniques.poYue.levels[state.techniqueLevel.poYue - 1].attack : CONFIG.techniques.poYue.levels[state.techniqueLevel.poYue - 1].auxAttack}
          </p>
        )}
        <p className="mt-1 text-sm font-medium">
          合计 攻 {stats.attack} ／ 防 {stats.defense} ／ 气血 {stats.hp}
        </p>
        <p className="mt-1 text-sm text-muted">修行进度：第 {currentStage}/20 境 · 历练首通 {clearedNodes.length}/{totalEnemies}</p>
        {wearing.length > 0 && (
          <p className="mt-1 text-sm text-muted">穿戴：{wearing.map((id) => EQUIPMENT[id].name).join("、")}</p>
        )}
      </Section>

      <Section title="灵根共鸣">
        <p className="mb-2 text-xs text-muted">同一时刻只启用一项；强度：单灵根 5%、双 4%、三 3%、四 2%、五 1%、变异 5%。</p>
        {state.spiritRoots.map((r) => (
          <div key={r} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
            <div className="text-sm">
              {r}
              {state.resonance === r && <span className="ml-1 text-xs text-cinnabar">当前</span>}
            </div>
            {state.resonance !== r && (
              <button onClick={() => setResonance(r)} className="rounded-lg border border-line bg-paper px-3 py-1 text-xs">启用</button>
            )}
          </div>
        ))}
        {state.resonance && (
          <button onClick={() => setResonance(null)} className="mt-2 rounded-lg border border-line bg-paper px-3 py-1 text-xs">关闭共鸣</button>
        )}
      </Section>

      <Section title="金丹篇章">
        {CONFIG.realms.findIndex((r) => r.id === state.realm) >= CONFIG.realms.findIndex((r) => r.id === "jindan1") ? (
          <div className="flex items-center justify-between">
            <p className="text-sm">已达金丹，可回看这段修行经历。</p>
            <Link href="/pianzhang" className="shrink-0 text-sm text-cinnabar">查看篇章 →</Link>
          </div>
        ) : (
          <p className="text-sm text-muted">尚未开启 · 需达到金丹一层（当前 {REALM_NAMES[state.realm]}）。</p>
        )}
      </Section>

      <Section title="今日目标">
        {(["battle", "suppress"] as const).map((gid) => {
          const cfg = DAILY_GOALS[gid];
          const g = state.daily.goals[gid];
          const cur = Math.min(g.progress, cfg.target);
          const rewardTxt = Object.entries(cfg.reward)
            .map(([k, v]) => `${RESOURCE_LABELS[k] || k} +${v}`)
            .join(" ");
          const claimable = !g.claimed && g.progress >= cfg.target;
          return (
            <div key={gid} className="flex items-center justify-between border-b border-line/60 py-1.5 last:border-0">
              <div className="text-sm">
                {g.claimed ? <span className="text-gold">✓</span> : <span className="text-muted">○</span>} {cfg.title}
                <span className="ml-1 text-xs text-muted">({cur}/{cfg.target})</span>
              </div>
              {g.claimed ? (
                <span className="text-xs text-muted">已领取</span>
              ) : claimable ? (
                <button onClick={() => claimGoal(gid)} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-cinnabar">
                  领取
                </button>
              ) : (
                <span className="text-xs text-muted">{rewardTxt}</span>
              )}
            </div>
          );
        })}
      </Section>

      <Section title="修仙录">
        {state.lastLongTaskResult && (
          <div className="mb-2 rounded-lg border border-line/60 p-2 text-sm">
            <div className="text-xs text-muted">最近长期任务</div>
            <div>
              {state.lastLongTaskResult.type === "training" ? "持续历练" : "闭关"}
              {state.lastLongTaskResult.nodeName ? ` · ${state.lastLongTaskResult.nodeName}` : ""}
              {state.lastLongTaskResult.difficulty ? ` · ${state.lastLongTaskResult.difficulty === "risky" ? "险行" : "稳行"}` : ""}
              {state.lastLongTaskResult.aborted ? " · 已中止" : ` · ${state.lastLongTaskResult.durationMinutes} 分钟`}
            </div>
            <div className="text-xs text-muted">
              {state.lastLongTaskResult.aborted ? "中止于" : "完成于"} {fmtTime(state.lastLongTaskResult.completedAt)}
            </div>
            {!state.lastLongTaskResult.aborted && (
              <div className="text-xs text-muted">
                所得：修为 {state.lastLongTaskResult.reward.cultivation}、灵气 {state.lastLongTaskResult.reward.spirit}、灵石 {state.lastLongTaskResult.reward.spiritStone}、灵草 {state.lastLongTaskResult.reward.herb}、残页 {state.lastLongTaskResult.reward.page}
              </div>
            )}
          </div>
        )}
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
              {clearedNodes.map((n) => (
                <div key={n}>{n}</div>
              ))}
              {totalEnemies - clearedNodes.length > 0 && (
                <div className="text-muted">另有 {totalEnemies - clearedNodes.length} 个尚未遇见</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted">装备</div>
              {ownedEquip.map((id) => (
                <div key={id}>
                  {EQUIPMENT[id].name}
                  <span className="text-xs text-muted">（{equipSource[id] ?? "来源未知"}）</span>
                </div>
              ))}
              {Object.keys(EQUIPMENT).length - ownedEquip.length > 0 && (
                <div className="text-muted">另有 {Object.keys(EQUIPMENT).length - ownedEquip.length} 件尚未获得</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted">功法</div>
              {learnedTech.map((id) => (
                <div key={id}>{TECHNIQUES[id].name}</div>
              ))}
              {Object.keys(TECHNIQUES).length - learnedTech.length > 0 && (
                <div className="text-muted">另有 {Object.keys(TECHNIQUES).length - learnedTech.length} 门尚未修习</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted">建筑</div>
              {built.map((id) => (
                <div key={id}>{BUILDINGS[id].name}</div>
              ))}
              {Object.keys(BUILDINGS).length - built.length > 0 && (
                <div className="text-muted">另有 {Object.keys(BUILDINGS).length - built.length} 座尚未建造</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted">秘境</div>
              {(Object.keys(SECRET_REALMS) as SecretRealmId[]).map((rid) => {
                const firstExplored = state.secretRealmLog.some((l) => l.realm === rid);
                const firstWon = state.secretRealmLog.some((l) => l.realm === rid && l.won);
                return (
                  <div key={rid}>
                    {SECRET_REALMS[rid].name}
                    <span className="text-xs text-muted">
                      （首次探索：{firstExplored ? "已" : "未"} · 首次成功：{firstWon ? "已" : "未"}）
                    </span>
                  </div>
                );
              })}
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
