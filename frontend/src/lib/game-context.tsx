"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as eng from "@/engine/engine";
import { CONFIG } from "@/engine/config";
import type { SaveState, BuildingId, MapId, SpiritRoot, TechniqueId } from "@/engine/types";
import { loadSave, persistSave, replaceSave, backupSave, clearSave } from "@/engine/storage";
import { generateEncounter, type EncounterResponse } from "@/lib/api";

export interface EncounterCopy {
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
  source: string;
}

interface GameContextValue {
  ready: boolean;
  state: SaveState | null;
  view: SaveState | null;
  notice: string;
  battleLog: string[];
  encounter: EncounterCopy | null;
  encounterLoading: boolean;
  tribPreview: eng.TribulationPreview | null;
  create: (name: string, root: SpiritRoot) => void;
  settleNow: () => void;
  doBreakthrough: () => void;
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
  clearNotice: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const REALM_NAMES: Record<string, string> = {};
for (const r of CONFIG.realms) REALM_NAMES[r.id] = r.name;

function localTemplate(eventId: string): EncounterCopy {
  const evt = CONFIG.encounters[eventId as keyof typeof CONFIG.encounters];
  return {
    title: evt.title,
    body: "机缘当前，且看你如何抉择。",
    options: Object.entries(evt.options).map(([id, o]) => ({ option_id: id, option_text: o.label })),
    source: "本地模板",
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [encounter, setEncounter] = useState<EncounterCopy | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await loadSave().catch(() => null);
      if (saved) {
        const settled = eng.settle(saved, Date.now());
        setState(settled);
        const res = await persistSave(settled);
        if (res.conflict) {
          const latest = await loadSave();
          setState(latest ? eng.settle(latest, Date.now()) : null);
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
      const resp: EncounterResponse | null = await generateEncounter(body);
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

  // 写入成功才提示；冲突则丢弃本地改动、重读最新档
  const apply = useCallback(async (next: SaveState, msg: string): Promise<boolean> => {
    const res = await persistSave(next);
    if (res.conflict) {
      const latest = await loadSave();
      setState(latest ? eng.settle(latest, Date.now()) : null);
      setNotice("检测到另一标签页正在运行，已刷新为最新进度");
      return false;
    }
    setState(next);
    setNotice(msg);
    return true;
  }, []);

  const clearNotice = useCallback(() => setNotice(""), []);

  const create = useCallback(
    async (name: string, root: SpiritRoot) => {
      const s = eng.createGame(name, root, Date.now());
      await apply(s, "角色已创建，踏上仙途");
    },
    [apply],
  );

  const settleNow = useCallback(async () => {
    if (!state) return;
    await apply(eng.settle(state, Date.now()), "已领取挂机收益");
  }, [state, apply]);

  const doBreakthrough = useCallback(async () => {
    if (!state) return;
    const r = eng.breakthrough(state, Date.now());
    await apply(r.ok && r.state ? r.state : state, r.ok ? "突破成功" : r.reason);
  }, [state, apply]);

  const upgradeBuilding = useCallback(
    async (id: BuildingId) => {
      if (!state) return;
      const r = eng.upgradeBuilding(state, Date.now(), id);
      await apply(r.ok && r.state ? r.state : state, r.ok ? "升级成功" : r.reason);
    },
    [state, apply],
  );

  const setTechnique = useCallback(
    async (id: TechniqueId) => {
      if (!state) return;
      const r = eng.setTechnique(state, Date.now(), id);
      await apply(r.ok && r.state ? r.state : state, r.ok ? "改修成功" : r.reason);
    },
    [state, apply],
  );

  const upgradeTechnique = useCallback(async () => {
    if (!state) return;
    const r = eng.upgradeTechnique(state, Date.now());
    await apply(r.ok && r.state ? r.state : state, r.ok ? "功法精进" : r.reason);
  }, [state, apply]);

  const equip = useCallback(
    async (id: string) => {
      if (!state) return;
      const r = eng.equipItem(state, Date.now(), id);
      await apply(r.ok && r.state ? r.state : state, r.ok ? "已穿戴" : r.reason);
    },
    [state, apply],
  );

  const craftPill = useCallback(async () => {
    if (!state) return;
    const r = eng.craftPill(state, Date.now());
    await apply(r.ok && r.state ? r.state : state, r.ok ? "炼得护劫丹一枚" : r.reason);
  }, [state, apply]);

  const togglePill = useCallback(async () => {
    if (!state) return;
    const r = eng.togglePreparePill(state, Date.now());
    await apply(r.ok && r.state ? r.state : state, r.ok ? "已切换预置" : r.reason);
  }, [state, apply]);

  const fight = useCallback(
    async (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const r = eng.fightNode(state, Date.now(), mapId, nodeId);
      setBattleLog(r.log);
      if (!r.ok) {
        setNotice(r.reason);
        return;
      }
      await apply(r.state, r.won ? (r.encounterTriggered ? "战斗胜利，际遇降临" : "战斗胜利") : "战败，未获得奖励");
    },
    [state, apply],
  );

  const suppress = useCallback(
    async (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const r = eng.setSuppression(state, Date.now(), mapId, nodeId);
      await apply(r.ok && r.state ? r.state : state, r.ok ? "已镇压，获得持续产出" : r.reason);
    },
    [state, apply],
  );

  const choose = useCallback(
    async (optionId: string) => {
      if (!state) return;
      const r = eng.resolveEncounter(state, Date.now(), optionId);
      if (!r.ok || !r.state) {
        setNotice(r.reason);
        return;
      }
      setEncounter(null);
      await apply(r.state, "选择已定，奖励到账");
    },
    [state, apply],
  );

  const startTrib = useCallback(async () => {
    if (!state) return;
    if (!window.confirm("确定渡劫？将消耗门槛资源与预置丹药，失败门槛不退。")) return;
    const r = eng.startTribulation(state, Date.now());
    await apply(
      r.ok && r.state ? r.state : state,
      r.ok
        ? r.state!.realm === "foundation1"
          ? "渡劫成功，晋入筑基一层"
          : "渡劫失败，可重新积累再试"
        : r.reason,
    );
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
    setNotice("存档已导出");
  }, [state]);

  const doImport = useCallback(
    async (file: File) => {
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(file);
      });
      const r = eng.importSave(text);
      if (!r.ok || !r.state) {
        setNotice("导入失败：" + r.reason);
        return;
      }
      if (state) await backupSave(state).catch(() => {});
      await replaceSave(r.state);
      setEncounter(null);
      setState(r.state);
      setNotice("存档导入成功（原档已备份）");
    },
    [state],
  );

  const doReset = useCallback(async () => {
    if (!window.confirm("确定重置？当前进度将被覆盖，建议先导出存档。")) return;
    await clearSave().catch(() => {});
    setState(null);
    setEncounter(null);
    setBattleLog([]);
    setNotice("已重置");
  }, []);

  const value: GameContextValue = {
    ready,
    state,
    view,
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
    clearNotice,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame 必须在 GameProvider 内使用");
  return ctx;
}
