import {
  CONFIG,
  createGame,
  settle,
  breakthrough,
  upgradeBuilding,
  setTechnique,
  upgradeTechnique,
  equipItem,
  craftPill,
  togglePreparePill,
  fightNode,
  setSuppression,
  resolveEncounter,
  previewTribulation,
  startTribulation,
  exportSave,
  importSave,
  playerStats,
  loadSave,
  persistSave,
  clearSave,
  type SaveState,
  type BuildingId,
  type MapId,
  type SpiritRoot,
} from "./engine";

let state: SaveState | null = null;
let encounterCopy: {
  title: string;
  body: string;
  options: { option_id: string; option_text: string }[];
  source: string;
} | null = null;
let battleLog: string[] = [];
let notice = "";

const app = document.getElementById("app")!;

const REALM_NAMES: Record<string, string> = {};
for (const r of CONFIG.realms) REALM_NAMES[r.id] = r.name;

const RESOURCE_LABELS: Record<string, string> = {
  cultivation: "修为",
  spirit: "灵气",
  spiritStone: "灵石",
  herb: "灵草",
  page: "残页",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function persist() {
  if (state) void persistSave(state);
}

function realmName(id: string): string {
  return REALM_NAMES[id] ?? id;
}

function localTemplate(evtId: string) {
  const evt = CONFIG.encounters[evtId as keyof typeof CONFIG.encounters];
  return {
    title: evt.title,
    body: "机缘当前，且看你如何抉择。",
    options: Object.entries(evt.options).map(([id, o]) => ({ option_id: id, option_text: o.label })),
    source: "本地模板",
  };
}

async function fetchEncounter() {
  if (!state?.encounter.pending) return;
  const evtId = state.encounter.pending.eventId;
  const evt = CONFIG.encounters[evtId as keyof typeof CONFIG.encounters];
  if (!evt) return;
  const options = Object.entries(evt.options).map(([id, o]) => ({
    option_id: id,
    label: o.label,
    meaning: o.meaning,
  }));
  const body = {
    event_id: evtId,
    character: { name: state.name, realm: realmName(state.realm), spirit_root: state.spiritRoot },
    map_id: state.encounter.pending.mapId,
    options,
    recent_logs: state.recentLogs.slice(-2),
  };
  try {
    const resp = await fetch("/api/v1/encounter/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (resp.ok && data.options) {
      encounterCopy = { title: data.title, body: data.body, options: data.options, source: data.source === "model" ? "AI 文案" : "模板文案" };
    } else {
      encounterCopy = localTemplate(evtId);
    }
  } catch {
    encounterCopy = localTemplate(evtId);
  }
  render();
}

function handleAction(action: string, arg: string) {
  if (!state) return;
  let now = Date.now();
  let r: { ok: boolean; reason?: string; state?: SaveState | null; log?: string[]; won?: boolean; encounterTriggered?: boolean } | undefined;
  switch (action) {
    case "settle":
      state = settle(state, now);
      persist();
      break;
    case "breakthrough":
      r = breakthrough(state, now);
      break;
    case "upgradeBuilding":
      r = upgradeBuilding(state, now, arg as BuildingId);
      break;
    case "setTechnique":
      r = setTechnique(state, now, arg as "qingYun" | "xuanGui");
      break;
    case "upgradeTechnique":
      r = upgradeTechnique(state, now);
      break;
    case "equip":
      r = equipItem(state, now, arg);
      break;
    case "craftPill":
      r = craftPill(state, now);
      break;
    case "togglePill":
      r = togglePreparePill(state, now);
      break;
    case "fight":
      battleLog = [];
      const [mid, nid] = arg.split("|");
      r = fightNode(state, now, mid as MapId, nid);
      if (r?.log) battleLog = r.log;
      if (r?.encounterTriggered) {
        state = r.state as SaveState;
        persist();
        void fetchEncounter();
        return;
      }
      break;
    case "suppress":
      r = setSuppression(state, now, arg.split("|")[0] as MapId, arg.split("|")[1]);
      break;
    case "resolveEncounter":
      r = resolveEncounter(state, now, arg);
      encounterCopy = null;
      break;
    case "previewTribulation": {
      if (!state) return;
      const p = previewTribulation(state);
      notice = p.ok
        ? `预计五波伤害：${p.waves.join(" / ")}，总减伤 ${Math.round(p.reduction * 100)}%，丹药${p.pillPrepared ? "已预置" : "未预置"}，预计${p.success ? "渡劫成功" : "渡劫失败"}`
        : p.reason;
      break;
    }
    case "startTribulation":
      r = startTribulation(state, now);
      break;
    case "export":
      if (!state) return;
      const blob = new Blob([exportSave(state)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `青云修仙录存档-${state.name}.json`;
      a.click();
      notice = "已导出存档文件";
      break;
    case "import":
      document.getElementById("import-file")?.click();
      return;
    case "reset": {
      if (confirm("确定重置？将开启新的一局，当前进度会被覆盖（可先导出）。")) {
        void clearSave();
        state = null;
        encounterCopy = null;
        notice = "已重置";
        render();
      }
      return;
    }
  }
  if (r) {
    if (r.ok && r.state) {
      state = r.state;
      notice = r.won === false ? "战败，未获得奖励" : "操作成功";
      persist();
    } else {
      notice = r.reason || "操作失败";
    }
  }
  render();
}

function handleImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !state) return;
  const reader = new FileReader();
  reader.onload = () => {
    const r = importSave(String(reader.result));
    if (r.ok && r.state) {
      state = r.state;
      encounterCopy = null;
      persist();
      notice = "存档导入成功";
    } else {
      notice = "导入失败：" + r.reason;
    }
    render();
  };
  reader.readAsText(file);
  input.value = "";
}

function render() {
  if (!state) {
    app.innerHTML = createFormHtml();
    bindForm();
    return;
  }
  const stats = playerStats(state);
  const trib = state.realm === "qi4" ? previewTribulation(state) : null;
  app.innerHTML = `
    <div class="wrap">
      <h1>青云修仙录 · 验收页</h1>
      ${notice ? `<div class="notice">${notice}</div>` : ""}
      <div class="card">
        <h2>人物</h2>
        <p>${state.name}（灵根：${state.spiritRoot}）｜${realmName(state.realm)}</p>
        <p>攻 ${stats.attack} ／ 防 ${stats.defense} ／ 气血 ${stats.hp}</p>
      </div>
      <div class="card">
        <h2>资源 <button data-action="settle">领取挂机收益</button></h2>
        <p>${Object.entries(state.resources).map(([k, v]) => `${RESOURCE_LABELS[k]} ${fmt(v)}`).join(" ｜ ")}</p>
      </div>
      <div class="card">
        <h2>修炼</h2>
        <button data-action="breakthrough">小进阶</button>
        ${state.realm === "qi4" ? `<button data-action="previewTribulation">查看劫势</button><button data-action="startTribulation">渡劫</button>` : ""}
      </div>
      <div class="card">
        <h2>洞府</h2>
        ${(Object.keys(CONFIG.buildings) as BuildingId[]).map((b) => `<button data-action="upgradeBuilding" data-arg="${b}">${CONFIG.buildings[b].name} Lv${state!.buildings[b]}</button>`).join("")}
      </div>
      <div class="card">
        <h2>功法</h2>
        <p>当前：${state.technique ? CONFIG.techniques[state.technique].name + " Lv" + state.techniqueLevel[state.technique] : "无"}</p>
        <button data-action="setTechnique" data-arg="qingYun">修青云诀</button>
        <button data-action="setTechnique" data-arg="xuanGui">修玄龟诀</button>
        <button data-action="upgradeTechnique">升级功法</button>
      </div>
      <div class="card">
        <h2>背包</h2>
        <p>护劫丹 ×${state.inventory.tribulationPill || 0} ${state.preparedPill ? "（已预置）" : ""}
        <button data-action="craftPill">炼丹</button>
        <button data-action="togglePill">${state.preparedPill ? "取消预置" : "预置丹药"}</button></p>
        ${Object.entries(CONFIG.equipment).map(([id, e]) => state!.inventory[id] ? `<button data-action="equip" data-arg="${id}">穿${e.name}</button>` : "").join("")}
      </div>
      <div class="card">
        <h2>历练</h2>
        ${(Object.keys(CONFIG.maps) as MapId[]).map((m) => `
          <h3>${CONFIG.maps[m].name}</h3>
          ${Object.entries(CONFIG.maps[m].nodes).map(([nid, n]) => {
            const ns = state!.maps[m][nid];
            const supped = state!.suppression[m] === nid;
            return `<p>${n.name}${ns.unlocked ? "" : "（未解锁）"}${ns.cleared ? "·已通关" : ""}${supped ? "·镇压中" : ""}
              ${ns.unlocked ? `<button data-action="fight" data-arg="${m}|${nid}">战斗</button>` : ""}
              ${ns.cleared && !supped ? `<button data-action="suppress" data-arg="${m}|${nid}">镇压</button>` : ""}
            </p>`;
          }).join("")}
        `).join("")}
      </div>
      ${battleLog.length ? `<div class="card"><h2>战报</h2>${battleLog.map((l) => `<p>${l}</p>`).join("")}</div>` : ""}
      ${state.encounter.pending ? `<div class="card encounter">
        <h2>际遇</h2>
        ${encounterCopy ? `
          <p class="src">${encounterCopy.source}</p>
          <h3>${encounterCopy.title}</h3>
          <p>${encounterCopy.body}</p>
          ${encounterCopy.options.map((o) => `<button data-action="resolveEncounter" data-arg="${o.option_id}">${o.option_text}</button>`).join("")}
        ` : `<p>际遇文案加载中…</p>`}
      </div>` : ""}
      ${trib && trib.ok ? `<div class="card"><h2>渡劫预览</h2><p>五波伤害：${trib.waves.join(" / ")}；减伤 ${Math.round(trib.reduction * 100)}%</p></div>` : ""}
      <div class="card">
        <h2>存档</h2>
        <button data-action="export">导出存档</button>
        <button data-action="import">导入存档</button>
        <button data-action="reset">重置（新开一局）</button>
        <input id="import-file" type="file" accept=".json" style="display:none" />
      </div>
      <div class="card"><h2>最近记录</h2>${state.recentLogs.slice(-6).map((l) => `<p>${l}</p>`).join("")}</div>
    </div>`;
  document.getElementById("import-file")?.addEventListener("change", handleImport);
  notice = "";
}

function createFormHtml(): string {
  return `
    <div class="wrap">
      <h1>青云修仙录 · 创建角色</h1>
      <div class="card">
        <label>姓名 <input id="name" type="text" value="林青" maxlength="8" /></label><br/><br/>
        <label>灵根
          <select id="root">
            ${(CONFIG.spiritRoots as readonly string[]).map((r) => `<option value="${r}">${r}</option>`).join("")}
          </select>
        </label><br/><br/>
        <button id="create">踏入仙途</button>
      </div>
    </div>`;
}

function bindForm() {
  const nameInput = document.getElementById("name") as HTMLInputElement;
  const rootSelect = document.getElementById("root") as HTMLSelectElement;
  document.getElementById("create")?.addEventListener("click", () => {
    const name = nameInput.value.trim() || "无名修士";
    state = createGame(name, rootSelect.value as SpiritRoot, Date.now());
    persist();
    notice = "角色已创建";
    render();
  });
}

app.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
  if (!el) return;
  const action = el.dataset.action!;
  const arg = el.dataset.arg || "";
  handleAction(action, arg);
});

(async function init() {
  const saved = await loadSave().catch(() => null);
  if (saved) {
    state = settle(saved, Date.now());
    persist();
    if (state.encounter.pending) void fetchEncounter();
  }
  render();
})();
