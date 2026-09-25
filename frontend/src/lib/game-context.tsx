"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as eng from "@/engine/engine";
import { CONFIG } from "@/engine/config";
import type { SaveState, BuildingId, MapId, SpiritRoot, TechniqueId, AptitudeId, BreakthroughMethod } from "@/engine/types";
import { loadSave, persistSave, replaceSave, backupSave, loadBackup, clearSave, type LoadedSave } from "@/engine/storage";
import { generateEncounter, type EncounterResponse } from "@/lib/api";
import { getCopyMode, setCopyMode, type CopyMode } from "@/lib/prefs";
import { RESOURCE_LABELS, REALM_ORDER, fmt, resourceGains } from "@/lib/labels";

export interface EncounterCopy {
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
  source: string;
}

export interface ResultPanel {
  title: string;
  lines: string[];
}

export interface Target {
  id: string;
  label: string;
  done: boolean;
  later: boolean;
  hint?: string;
  href?: string;
}

interface GameContextValue {
  ready: boolean;
  state: SaveState | null;
  view: SaveState | null;
  now: number;
  notice: string;
  battleLog: string[];
  encounter: EncounterCopy | null;
  encounterLoading: boolean;
  tribPreview: eng.TribulationPreview | null;
  create: (name: string, root: SpiritRoot, aptitude: AptitudeId) => void;
  settleNow: () => void;
  doBreakthrough: (method: BreakthroughMethod) => void;
  upgradeBuilding: (id: BuildingId) => void;
  setTechnique: (id: TechniqueId) => void;
  upgradeTechnique: () => void;
  equip: (id: string) => void;
  craftPill: () => void;
  togglePill: () => void;
  fight: (mapId: MapId, nodeId: string) => void;
  suppress: (mapId: MapId, nodeId: string) => void;
  choose: (optionId: string) => void;
  startTrib: () => void;
  doExport: () => void;
  doImport: (file: File) => void;
  doReset: () => void;
  doRestoreBackup: () => void;
  clearNotice: () => void;
  lastResult: ResultPanel | null;
  clearResult: () => void;
  targets: Target[];
  markTribPreviewViewed: () => void;
  showDataNotice: boolean;
  dismissDataNotice: (mode: CopyMode) => void;
  claimGoal: (goalId: "battle" | "suppress") => void;
  startLong: (params: {
    type: "training" | "seclusion";
    mapId?: MapId;
    nodeId?: string;
    difficulty?: "steady" | "risky";
    durationMinutes: number;
    protection: boolean;
  }) => void;
  claimLong: () => void;
  abortLong: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const REALM_NAMES: Record<string, string> = {};
for (const r of CONFIG.realms) REALM_NAMES[r.id] = r.name;

type EncounterCfg = { title: string; options: Record<string, { label: string; meaning: string; result: string }> };
const ENC = CONFIG.encounters as unknown as Record<string, EncounterCfg>;

function localTemplate(eventId: string): EncounterCopy {
  const evt = CONFIG.encounters[eventId as keyof typeof CONFIG.encounters];
  return {
    title: evt.title,
    body: "机缘当前，且看你如何抉择。",
    options: Object.entries(evt.options).map(([id, o]) => ({ option_id: id, option_text: o.label })),
    source: "本地模板",
  };
}

function deltaLines(before: SaveState, after: SaveState): string[] {
  const d = resourceGains(before, after);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v > 0) lines.push(`${RESOURCE_LABELS[k]} +${fmt(v)}`);
    else if (v < 0) lines.push(`${RESOURCE_LABELS[k]} ${fmt(v)}`);
  }
  return lines;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [encounter, setEncounter] = useState<EncounterCopy | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ResultPanel | null>(null);
  const [showDataNotice, setShowDataNotice] = useState(false);
  // baseRef：已持久化到 IndexedDB 的修订号（乐观并发基准）。只在读档/写档成功/重置/导入时更新，
  // 绝不从内存 state 推导，否则结算产生的内存修订号会被误当作已持久化基准，导致持续冲突。
  const baseRef = useRef(0);
  // genRef：当前存档代次。重置或整体替换会递增代次，使旧标签页无法复活旧档。
  const genRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const loaded = await loadSave().catch((): LoadedSave => ({ state: null, generation: 0 }));
      genRef.current = loaded.generation;
      const saved = loaded.state;
      if (saved) {
        baseRef.current = saved.revision;
        if (saved.schemaVersion < eng.SCHEMA_VERSION) {
          await backupSave(saved).catch(() => {});
        }
        const nowMs = Date.now();
        const hours = Math.max(0, (nowMs - saved.lastSettledAt) / 3600000);
        const capped = Math.min(hours, CONFIG.offlineCapHours);
        const migrated = eng.migrateSave(saved);
        const settled = eng.settle(migrated, nowMs);
        const delta = resourceGains(migrated, settled);
        setState(settled);
        const res = await persistSave(settled, saved.revision, genRef.current);
        if (res.conflict) {
          const latest = await loadSave().catch((): LoadedSave => ({ state: null, generation: genRef.current }));
          genRef.current = latest.generation;
          baseRef.current = latest.state ? latest.state.revision : 0;
          setState(latest.state ? eng.settle(latest.state, Date.now()) : null);
        } else {
          baseRef.current = settled.revision;
        }
        try {
          if (localStorage.getItem("qingyun_notice_shown") !== "1") setShowDataNotice(true);
        } catch {}
        if (hours > 0) {
          const parts = Object.entries(delta)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${RESOURCE_LABELS[k]} +${fmt(v)}`)
            .join("、");
          if (parts) {
            setNotice(`离线 ${capped >= 1 ? fmt(capped) + " 小时" : Math.round(capped * 60) + " 分钟"}，收获 ${parts}${hours > CONFIG.offlineCapHours ? "（已按 12 小时封顶）" : ""}`);
          }
        }
      }
      setReady(true);
    })();
  }, []);

  const pendingId = state?.encounter.pending?.eventId ?? null;
  useEffect(() => {
    if (!state || !pendingId) {
      setEncounter(null);
      setEncounterLoading(false);
      return;
    }
    let cancelled = false;
    setEncounter(null);
    setEncounterLoading(true);
    const evt = CONFIG.encounters[pendingId as keyof typeof CONFIG.encounters];
    const options = Object.entries(evt.options).map(([id, o]) => ({
      option_id: id,
      label: o.label,
      meaning: o.meaning,
    }));
    const body = {
      event_id: pendingId,
      character: {
        name: state.name,
        realm: REALM_NAMES[state.realm] ?? state.realm,
        spirit_root: state.spiritRoot,
      },
      map_id: state.encounter.pending!.mapId,
      options,
      recent_logs: state.recentLogs.slice(-2),
    };
    (async () => {
      const resp: EncounterResponse | null =
        getCopyMode() === "template" ? null : await generateEncounter(body);
      if (cancelled) return;
      if (resp) {
        setEncounter({
          title: resp.title,
          body: resp.body,
          options: resp.options,
          source: resp.source === "model" ? "AI 文案" : "模板文案",
        });
      } else {
        setEncounter(localTemplate(pendingId));
      }
      setEncounterLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingId, state?.encounter?.pending?.mapId]);

  const view = useMemo(() => (state ? eng.settle(state, now) : null), [state, now]);

  const tribPreview = useMemo(
    () => (state && state.realm === "qi4" ? eng.previewTribulation(state) : null),
    [state],
  );

  const targets = useMemo<Target[]>(() => {
    if (!state) return [];
    const realmIdx = REALM_ORDER.indexOf(state.realm);
    return [
      { id: "settle", label: "领取一次收益", done: state.firsts.settledOnce, later: false, hint: "点顶部「领取收益」" },
      { id: "breakthrough", label: "完成首次小进阶", done: realmIdx >= 1, later: false, href: "/xiulian" },
      { id: "suppress", label: "击败并镇压首个节点", done: state.firsts.suppressedFirstNodeOnce, later: false, href: "/lilian" },
      { id: "trib", label: "查看一次天劫预览", done: state.firsts.viewedTribPreviewOnce, later: realmIdx < 3, href: "/xiulian" },
    ];
  }, [state]);

  // 写入成功才提示；冲突则丢弃本地改动、重读最新档
  const apply = useCallback(async (next: SaveState, msg: string): Promise<boolean> => {
    const res = await persistSave(next, baseRef.current, genRef.current);
    if (res.conflict) {
      const loaded = await loadSave().catch((): LoadedSave => ({ state: null, generation: genRef.current }));
      genRef.current = loaded.generation;
      const latest = loaded.state;
      baseRef.current = latest ? latest.revision : 0;
      setState(latest ? eng.settle(latest, Date.now()) : null);
      setNotice(latest ? "检测到另一标签页正在运行，已刷新为最新进度" : "存档已在其他标签页被重置");
      return false;
    }
    baseRef.current = next.revision;
    setState(next);
    setNotice(msg);
    return true;
  }, []);

  const clearNotice = useCallback(() => setNotice(""), []);
  const clearResult = useCallback(() => setLastResult(null), []);

  const dismissDataNotice = useCallback((mode: CopyMode) => {
    setCopyMode(mode);
    try {
      localStorage.setItem("qingyun_notice_shown", "1");
    } catch {}
    setShowDataNotice(false);
  }, []);

  const markTribPreviewViewed = useCallback(async () => {
    if (!state || state.realm !== "qi4" || state.firsts.viewedTribPreviewOnce) return;
    const next = structuredClone(state);
    next.firsts.viewedTribPreviewOnce = true;
    next.revision += 1;
    const res = await persistSave(next, baseRef.current, genRef.current);
    if (!res.conflict) {
      baseRef.current = next.revision;
      setState(next);
    }
  }, [state]);

  const claimGoal = useCallback(
    async (goalId: "battle" | "suppress") => {
      if (!state) return;
      const before = state;
      const r = eng.claimDailyGoal(before, Date.now(), goalId);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      const ok = await apply(r.state, "已领取今日目标奖励");
      if (ok) setLastResult({ title: "领取目标奖励", lines: deltaLines(before, r.state) });
    },
    [state, apply],
  );

  const startLong = useCallback(
    async (params: { type: "training" | "seclusion"; mapId?: MapId; nodeId?: string; difficulty?: "steady" | "risky"; durationMinutes: number; protection: boolean }) => {
      if (!state) return;
      const nowMs = Date.now();
      const settled = eng.settle(state, nowMs);
      const r = eng.startLongTask(settled, nowMs, params);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      const ok = await apply(r.state, params.type === "training" ? "持续历练已开始" : "闭关已开始");
      if (ok) {
        setLastResult({
          title: params.type === "training" ? "持续历练已开始" : "闭关已开始",
          lines: [`时长 ${params.durationMinutes} 分钟`, ...deltaLines(settled, r.state)],
        });
      }
    },
    [state, apply],
  );

  const claimLong = useCallback(async () => {
    if (!state) return;
    const nowMs = Date.now();
    const settled = eng.settle(state, nowMs);
    const r = eng.claimLongTask(settled, nowMs);
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    const ok = await apply(r.state, "已领取任务结果");
    if (ok) {
      const taskLines = deltaLines(settled, r.state);
      const ordinaryLines = deltaLines(state, settled);
      const lines = [
        ...(taskLines.length ? [`任务所得：${taskLines.join("、")}`] : []),
        ...(ordinaryLines.length ? [`普通离线收益：${ordinaryLines.join("、")}`] : ["普通离线收益：无"]),
      ];
      setLastResult({ title: "任务完成", lines });
    }
  }, [state, apply]);

  const abortLong = useCallback(async () => {
    if (!state) return;
    if (!window.confirm("确定中止任务？本次任务奖励为零，护行阵费用不返还。")) return;
    const nowMs = Date.now();
    const settled = eng.settle(state, nowMs);
    const r = eng.abortLongTask(settled, nowMs);
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    await apply(r.state, "已中止任务");
  }, [state, apply]);

  const create = useCallback(
    async (name: string, root: SpiritRoot, aptitude: AptitudeId) => {
      const s = eng.createGame(name, root, aptitude, Date.now());
      try {
        localStorage.setItem("qingyun_notice_shown", "1");
      } catch {}
      setLastResult(null);
      await apply(s, "角色已创建，踏上仙途");
    },
    [apply],
  );

  const settleNow = useCallback(async () => {
    if (!state) return;
    const settled = eng.settle(state, Date.now());
    settled.firsts.settledOnce = true;
    const withDaily = eng.recordDailySettle(settled, Date.now());
    const delta = resourceGains(state, withDaily);
    const parts = Object.entries(delta)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${RESOURCE_LABELS[k]} +${fmt(v)}`)
      .join("、");
    await apply(withDaily, parts ? `本次领取：${parts}` : "暂无新收益");
  }, [state, apply]);

  const doBreakthrough = useCallback(
    async (method: BreakthroughMethod) => {
      if (!state) return;
      const nowMs = Date.now();
      const settled = eng.settle(state, nowMs);
      const costs = eng.breakthroughCosts(settled, method);
      const rate = eng.breakthroughSuccessRate(settled);
      const msg =
        method === "steady"
          ? `确定稳妥进阶？消耗修为 ${costs.success.cultivation}、灵气 ${costs.success.spirit}，必定成功。`
          : `确定冲关进阶？成功率 ${Math.round(rate * 100)}%，失败仅扣修为 ${costs.failure.cultivation}、灵气 ${costs.failure.spirit}，且不降境界。`;
      if (!window.confirm(msg)) return;
      const r = eng.breakthrough(settled, nowMs, method);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      const success = r.state.realm !== settled.realm;
      const ok = await apply(r.state, success ? "突破成功" : "冲关失败，可再尝试或改选稳妥");
      if (ok) {
        if (success) {
          setLastResult({ title: `晋入 ${REALM_NAMES[r.state.realm]}`, lines: deltaLines(settled, r.state) });
        } else {
          const nextRate = eng.breakthroughSuccessRate(r.state);
          setLastResult({ title: "冲关失败", lines: [...deltaLines(settled, r.state), `下次成功率 ${Math.round(nextRate * 100)}%`] });
        }
      }
    },
    [state, apply],
  );

  const upgradeBuilding = useCallback(
    async (id: BuildingId) => {
      if (!state) return;
      const r = eng.upgradeBuilding(state, Date.now(), id);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      await apply(r.state, "升级成功");
    },
    [state, apply],
  );

  const setTechnique = useCallback(
    async (id: TechniqueId) => {
      if (!state) return;
      const r = eng.setTechnique(state, Date.now(), id);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      await apply(r.state, "改修成功");
    },
    [state, apply],
  );

  const upgradeTechnique = useCallback(async () => {
    if (!state) return;
    const r = eng.upgradeTechnique(state, Date.now());
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    await apply(r.state, "功法精进");
  }, [state, apply]);

  const equip = useCallback(
    async (id: string) => {
      if (!state) return;
      const r = eng.equipItem(state, Date.now(), id);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      await apply(r.state, "已穿戴");
    },
    [state, apply],
  );

  const craftPill = useCallback(async () => {
    if (!state) return;
    const r = eng.craftPill(state, Date.now());
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    await apply(r.state, "炼得护劫丹一枚");
  }, [state, apply]);

  const togglePill = useCallback(async () => {
    if (!state) return;
    const r = eng.togglePreparePill(state, Date.now());
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    await apply(r.state, "已切换预置");
  }, [state, apply]);

  const fight = useCallback(
    async (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const nowMs = Date.now();
      const settled = eng.settle(state, nowMs);
      const r = eng.fightNode(settled, nowMs, mapId, nodeId);
      setBattleLog(r.log);
      if (!r.ok) {
        setNotice(r.reason);
        return;
      }
      const ok = await apply(
        r.state,
        r.won ? (r.encounterTriggered ? "战斗胜利，际遇降临" : "战斗胜利") : "战败，未获得奖励",
      );
      if (ok) {
        if (r.won) {
          const lines = deltaLines(settled, r.state);
          if (r.encounterTriggered) lines.push("触发际遇");
          setLastResult({ title: "战斗胜利", lines });
        } else {
          setLastResult({ title: "战斗落败", lines: ["未获得奖励", ...r.log.filter((l) => l.startsWith("短板"))] });
        }
      }
    },
    [state, apply],
  );

  const suppress = useCallback(
    async (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const r = eng.setSuppression(state, Date.now(), mapId, nodeId);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      await apply(r.state, "已镇压，获得持续产出");
    },
    [state, apply],
  );

  const choose = useCallback(
    async (optionId: string) => {
      if (!state) return;
      const nowMs = Date.now();
      const settled = eng.settle(state, nowMs);
      const r = eng.resolveEncounter(settled, nowMs, optionId);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      setEncounter(null);
      const evtId = state.encounter.pending?.eventId ?? "";
      const evtCfg = ENC[evtId];
      const optCfg = evtCfg?.options[optionId];
      const optLabel = optCfg?.label ?? "";
      const optResult = optCfg?.result ?? "";
      const title = evtCfg ? `际遇「${evtCfg.title}」` : "际遇";
      const ok = await apply(r.state, "选择已定，奖励到账");
      if (ok) {
        const lines: string[] = [];
        if (optLabel) lines.push(`选择「${optLabel}」`);
        if (optResult) lines.push(optResult);
        lines.push(...deltaLines(settled, r.state));
        setLastResult({ title, lines });
      }
    },
    [state, apply],
  );

  const startTrib = useCallback(async () => {
    if (!state) return;
    if (!window.confirm("确定渡劫？将消耗门槛资源与预置丹药，失败门槛不退。")) return;
    const nowMs = Date.now();
    const settled = eng.settle(state, nowMs);
    const r = eng.startTribulation(settled, nowMs);
    if (!r.ok || !r.state) {
      setNotice(r.reason);
      return;
    }
    const ok = await apply(
      r.state,
      r.state.realm === "foundation1" ? "渡劫成功，晋入筑基一层" : "渡劫失败，可重新积累再试",
    );
    if (ok) {
      setLastResult({
        title: r.state.realm === "foundation1" ? "渡劫成功" : "渡劫失败",
        lines: [...deltaLines(settled, r.state), ...(r.state.tribulationLog?.log ?? [])],
      });
    }
  }, [state, apply]);

  const doExport = useCallback(() => {
    if (!state) return;
    const blob = new Blob([eng.exportSave(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `青云修仙录存档-${state.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem("qingyun_last_export", new Date().toISOString());
    } catch {}
    setNotice("存档已导出");
  }, [state]);

  const doImport = useCallback(
    async (file: File) => {
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        setNotice("导入失败：文件过大（上限 2MB）");
        return;
      }
      if (!/\.json$/i.test(file.name)) {
        setNotice("导入失败：请选择 JSON 存档文件");
        return;
      }
      let text: string;
      try {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read error"));
          reader.onabort = () => reject(new Error("aborted"));
          reader.readAsText(file);
        });
      } catch {
        setNotice("导入失败：文件读取失败，请重试");
        return;
      }
      const r = eng.importSave(text);
      if (!r.ok || !r.state) {
        setNotice("导入失败：" + r.reason);
        return;
      }
      if (!window.confirm("导入将替换当前进度，确定导入？")) return;
      try {
        if (state) await backupSave(state);
        const res = await replaceSave(r.state, genRef.current);
        if (res.conflict) {
          setNotice("导入失败：存档已在其他标签页被修改，请刷新后重试");
          return;
        }
        genRef.current = res.generation;
      } catch {
        setNotice("备份或写入失败，已保留当前进度");
        return;
      }
      baseRef.current = r.state.revision;
      setEncounter(null);
      setState(r.state);
      setNotice("存档导入成功（原档已备份）");
    },
    [state],
  );

  const doReset = useCallback(async () => {
    if (!window.confirm("确定重置？当前进度将被覆盖，建议先导出存档。")) return;
    const gen = await clearSave().catch(() => genRef.current);
    genRef.current = gen;
    baseRef.current = 0;
    setState(null);
    setEncounter(null);
    setBattleLog([]);
    setLastResult(null);
    setNotice("已重置");
  }, []);

  const doRestoreBackup = useCallback(async () => {
    const backup = await loadBackup().catch(() => null);
    if (!backup) {
      setNotice("没有可恢复的备份");
      return;
    }
    if (!window.confirm("恢复导入前的存档？当前进度将被替换。")) return;
    try {
      const res = await replaceSave(backup, genRef.current);
      if (res.conflict) {
        setNotice("恢复失败：存档已在其他标签页被修改，请刷新后重试");
        return;
      }
      genRef.current = res.generation;
    } catch {
      setNotice("写入失败，已保留当前进度");
      return;
    }
    baseRef.current = backup.revision;
    setState(backup);
    setEncounter(null);
    setNotice("已恢复导入前的存档");
  }, []);

  const value: GameContextValue = {
    ready,
    state,
    view,
    now,
    notice,
    battleLog,
    encounter,
    encounterLoading,
    tribPreview,
    create,
    settleNow,
    doBreakthrough,
    upgradeBuilding,
    setTechnique,
    upgradeTechnique,
    equip,
    craftPill,
    togglePill,
    fight,
    suppress,
    choose,
    startTrib,
    doExport,
    doImport,
    doReset,
    doRestoreBackup,
    clearNotice,
    lastResult,
    clearResult,
    targets,
    markTribPreviewViewed,
    showDataNotice,
    dismissDataNotice,
    claimGoal,
    startLong,
    claimLong,
    abortLong,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame 必须在 GameProvider 内使用");
  return ctx;
}
