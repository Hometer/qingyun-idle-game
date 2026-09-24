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
import { loadSave, persistSave, clearSave } from "@/engine/storage";
import { generateEncounter, type EncounterResponse } from "@/lib/api";

export interface EncounterCopy {
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
  source: string;
}

interface GameContextValue {
  ready: boolean;
  state: SaveState | null; // 持久化状态（动作据此结算）
  view: SaveState | null; // 展示用（按当前时间结算，每秒刷新）
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

  // 每秒刷新展示时间
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 加载存档
  useEffect(() => {
    (async () => {
      const saved = await loadSave().catch(() => null);
      if (saved) {
        const settled = eng.settle(saved, Date.now());
        setState(settled);
        void persistSave(settled);
      }
      setReady(true);
    })();
  }, []);

  // 际遇待选择时拉取文案
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

  const apply = useCallback((next: SaveState | null, msg: string) => {
    setState(next);
    if (next) void persistSave(next);
    setNotice(msg);
  }, []);

  const clearNotice = useCallback(() => setNotice(""), []);

  const create = useCallback(
    (name: string, root: SpiritRoot) => {
      const s = eng.createGame(name, root, Date.now());
      apply(s, "角色已创建，踏上仙途");
    },
    [apply],
  );

  const settleNow = useCallback(() => {
    if (!state) return;
    apply(eng.settle(state, Date.now()), "已领取挂机收益");
  }, [state, apply]);

  const doBreakthrough = useCallback(() => {
    if (!state) return;
    const r = eng.breakthrough(state, Date.now());
    apply(r.ok && r.state ? r.state : state, r.ok ? "突破成功" : r.reason);
  }, [state, apply]);

  const upgradeBuilding = useCallback(
    (id: BuildingId) => {
      if (!state) return;
      const r = eng.upgradeBuilding(state, Date.now(), id);
      apply(r.ok && r.state ? r.state : state, r.ok ? "升级成功" : r.reason);
    },
    [state, apply],
  );

  const setTechnique = useCallback(
    (id: TechniqueId) => {
      if (!state) return;
      const r = eng.setTechnique(state, Date.now(), id);
      apply(r.ok && r.state ? r.state : state, r.ok ? "改修成功" : r.reason);
    },
    [state, apply],
  );

  const upgradeTechnique = useCallback(() => {
    if (!state) return;
    const r = eng.upgradeTechnique(state, Date.now());
    apply(r.ok && r.state ? r.state : state, r.ok ? "功法精进" : r.reason);
  }, [state, apply]);

  const equip = useCallback(
    (id: string) => {
      if (!state) return;
      const r = eng.equipItem(state, Date.now(), id);
      apply(r.ok && r.state ? r.state : state, r.ok ? "已穿戴" : r.reason);
    },
    [state, apply],
  );

  const craftPill = useCallback(() => {
    if (!state) return;
    const r = eng.craftPill(state, Date.now());
    apply(r.ok && r.state ? r.state : state, r.ok ? "炼得护劫丹一枚" : r.reason);
  }, [state, apply]);

  const togglePill = useCallback(() => {
    if (!state) return;
    const r = eng.togglePreparePill(state, Date.now());
    apply(r.ok && r.state ? r.state : state, r.ok ? "已切换预置" : r.reason);
  }, [state, apply]);

  const fight = useCallback(
    (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const r = eng.fightNode(state, Date.now(), mapId, nodeId);
      setBattleLog(r.log);
      if (!r.ok) {
        apply(state, r.reason);
        return;
      }
      const next = r.state;
      setState(next);
      void persistSave(next);
      setNotice(r.won ? (r.encounterTriggered ? "战斗胜利，际遇降临" : "战斗胜利") : "战败，未获得奖励");
    },
    [state, apply],
  );

  const suppress = useCallback(
    (mapId: MapId, nodeId: string) => {
      if (!state) return;
      const r = eng.setSuppression(state, Date.now(), mapId, nodeId);
      apply(r.ok && r.state ? r.state : state, r.ok ? "已镇压，获得持续产出" : r.reason);
    },
    [state, apply],
  );

  const choose = useCallback(
    (optionId: string) => {
      if (!state) return;
      const r = eng.resolveEncounter(state, Date.now(), optionId);
      if (r.ok && r.state) {
        setEncounter(null);
        apply(r.state, "选择已定，奖励到账");
      } else {
        setNotice(r.reason);
      }
    },
    [state, apply],
  );

  const startTrib = useCallback(() => {
    if (!state) return;
    if (!window.confirm("确定渡劫？将消耗门槛资源与预置丹药，失败门槛不退。")) return;
    const r = eng.startTribulation(state, Date.now());
    apply(r.ok && r.state ? r.state : state, r.ok ? (r.state!.realm === "foundation1" ? "渡劫成功，晋入筑基一层" : "渡劫失败，可重新积累再试") : r.reason);
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
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = eng.importSave(String(reader.result));
        if (r.ok && r.state) {
          setEncounter(null);
          apply(r.state, "存档导入成功");
        } else {
          setNotice("导入失败：" + r.reason);
        }
      };
      reader.readAsText(file);
    },
    [apply],
  );

  const doReset = useCallback(() => {
    if (!window.confirm("确定重置？当前进度将被覆盖，建议先导出存档。")) return;
    void clearSave();
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
