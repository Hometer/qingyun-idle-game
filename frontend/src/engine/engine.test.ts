import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createGame,
  settle,
  breakthrough,
  upgradeBuilding,
  setTechnique,
  upgradeTechnique,
  craftPill,
  equipItem,
  togglePreparePill,
  fightNode,
  setSuppression,
  resolveEncounter,
  previewTribulation,
  startTribulation,
  exportSave,
  importSave,
  playerStats,
} from "./engine";
import type { SaveState, RealmId, MapId } from "./types";

const H = 3600_000;
const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  return createGame("林青", "金", nowMs);
}

describe("创建角色", () => {
  it("初始状态正确", () => {
    const s = fresh();
    expect(s.realm).toBe("qi1");
    expect(s.resources).toEqual({ cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0 });
    expect(s.maps.map_qingyun.node_wolf.unlocked).toBe(true);
    expect(s.maps.map_qingyun.node_bandit.unlocked).toBe(false);
    expect(s.maps.map_nether.node_shade.unlocked).toBe(false);
    expect(playerStats(s)).toEqual({ attack: 15, defense: 5, hp: 100 });
  });
});

describe("时间结算", () => {
  it("按实际时间累积基础产出", () => {
    const s = settle(fresh(), T0 + 2 * H);
    expect(s.resources.cultivation).toBeCloseTo(7200, 5); // 1/s * 7200s
    expect(s.resources.spirit).toBeCloseTo(1800, 5); // 0.25/s * 7200s
  });

  it("离线超过 12 小时只结算 12 小时", () => {
    const s = settle(fresh(), T0 + 14 * H);
    expect(s.resources.cultivation).toBeCloseTo(43200, 5); // 12h 上限
  });

  it("时间回拨不产生负收益", () => {
    const s = settle(fresh(), T0 - 1000);
    expect(s.resources.cultivation).toBe(0);
    expect(s.lastSettledAt).toBe(T0);
  });

  it("重复结算不重复领取同一时段", () => {
    const a = settle(fresh(), T0 + 1000);
    const b = settle(a, T0 + 1000);
    expect(b.resources.cultivation).toBeCloseTo(a.resources.cultivation, 5);
  });

  it("镇压节点按时间差产出灵石", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    const r = setSuppression(s, T0, "map_qingyun", "node_wolf");
    expect(r.ok).toBe(true);
    const after = settle(r.state as SaveState, T0 + 100_000);
    expect(after.resources.spiritStone).toBeCloseTo(10, 5); // 0.1/s * 100s
  });
});

describe("小进阶", () => {
  it("达标扣除门槛并进阶", () => {
    let s = fresh();
    s.resources.cultivation = 120;
    s.resources.spirit = 20;
    const r = breakthrough(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("qi2");
    expect(st.resources.cultivation).toBe(0);
    expect(st.resources.spirit).toBe(0);
  });

  it("炼气圆满不能小进阶，需渡劫", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 99999;
    s.resources.spirit = 99999;
    const r = breakthrough(s, T0);
    expect(r.ok).toBe(false);
  });
});

describe("战斗", () => {
  it("首通野狼：胜利、奖励、解锁下一节点、触发引导际遇", () => {
    const r = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    expect(r.ok).toBe(true);
    expect(r.won).toBe(true);
    expect(r.encounterTriggered).toBe(true);
    const s = r.state;
    expect(s.maps.map_qingyun.node_wolf.cleared).toBe(true);
    expect(s.maps.map_qingyun.node_bandit.unlocked).toBe(true);
    expect(s.resources.cultivation).toBe(20);
    expect(s.resources.spiritStone).toBe(50);
    expect(s.resources.page).toBe(5);
    expect(s.encounter.pending?.eventId).toBe("event_well");
  });

  it("战斗结果可复现（相同状态相同结果）", () => {
    const a = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    const b = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    expect(a.log).toEqual(b.log);
    expect(a.state.resources).toEqual(b.state.resources);
  });

  it("境界门槛不足不能挑战", () => {
    const s = fresh();
    s.maps.map_qingyun.node_demon.unlocked = true;
    const r = fightNode(s, T0, "map_qingyun", "node_demon");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("方可挑战");
  });

  it("战败不倒退境界、不给奖励", () => {
    const s = fresh();
    s.realm = "qi4";
    s.maps.map_nether.node_king.unlocked = true;
    const before = s.resources.cultivation;
    const r = fightNode(s, T0, "map_nether", "node_king");
    expect(r.won).toBe(false);
    expect(r.state.realm).toBe("qi4");
    expect(r.state.resources.cultivation).toBe(before);
  });
});

describe("洞府与功法", () => {
  it("升级建筑扣除灵石并生效", () => {
    let s = fresh();
    s.resources.spiritStone = 100;
    const r = upgradeBuilding(s, T0, "cultivationRoom");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.buildings.cultivationRoom).toBe(1);
    expect(st.resources.spiritStone).toBe(0);
    const after = settle(st, T0 + 100_000);
    expect(after.resources.cultivation).toBeCloseTo(120, 5); // 1 * 1.2 * 100
  });

  it("切换功法入门一级、升级消耗残页", () => {
    let s = fresh();
    const r1 = setTechnique(s, T0, "qingYun");
    expect(r1.ok).toBe(true);
    s = r1.state as SaveState;
    expect(s.techniqueLevel.qingYun).toBe(1);
    s.resources.page = 5;
    const r2 = upgradeTechnique(s, T0);
    expect(r2.ok).toBe(true);
    const st = r2.state as SaveState;
    expect(st.techniqueLevel.qingYun).toBe(2);
    expect(st.resources.page).toBe(0);
  });
});

describe("护劫丹", () => {
  it("炼丹炉炼制并预置", () => {
    let s = fresh();
    s.buildings.alchemyFurnace = 1;
    s.resources.herb = 50;
    s.resources.spiritStone = 100;
    const r = craftPill(s, T0);
    expect(r.ok).toBe(true);
    let st = r.state as SaveState;
    expect(st.inventory.tribulationPill).toBe(1);
    const r2 = togglePreparePill(st, T0);
    expect(r2.ok).toBe(true);
    st = r2.state as SaveState;
    expect(st.preparedPill).toBe(true);
  });
});

describe("际遇", () => {
  it("选择选项后奖励到账并清空待处理", () => {
    let s = fresh();
    const f = fightNode(s, T0, "map_qingyun", "node_wolf");
    s = f.state;
    expect(s.encounter.pending?.eventId).toBe("event_well");
    const r = resolveEncounter(s, T0 + 1, "well_a");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.encounter.pending).toBe(null);
    expect(st.resources.spiritStone).toBe(50 + 30); // 首通 50 + 际遇 30
    expect(st.resources.herb).toBe(5);
  });
});

describe("天劫", () => {
  it("预览值与实际五波一致（无减伤、无丹药→失败）", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 1500;
    s.resources.spirit = 200;
    const p = previewTribulation(s);
    expect(p.waves.map((w) => w.damage)).toEqual([20, 25, 30, 35, 40]);
    expect(p.success).toBe(false);
    const r = startTribulation(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.tribulationLog?.waves.map((w) => w.damage)).toEqual([20, 25, 30, 35, 40]);
    expect(st.realm).toBe("qi4"); // 失败不动境界
    expect(st.resources.cultivation).toBe(0); // 门槛已扣不退
  });

  it("有减伤+护劫丹可成功筑基", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 1500;
    s.resources.spirit = 200;
    s.technique = "xuanGui";
    s.techniqueLevel.xuanGui = 3; // 15%
    s.equipment.armor = "a_iron"; // 5%
    s.equipment.accessory = "c_jade"; // 5% + 60hp
    s.preparedPill = true;
    s.inventory.tribulationPill = 1;
    const p = previewTribulation(s);
    expect(p.reduction).toBeCloseTo(0.25, 5);
    expect(p.maxHp).toBe(160);
    expect(p.success).toBe(true);
    const r = startTribulation(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("foundation1");
    expect(st.tribulationLog?.success).toBe(true);
    expect(st.inventory.tribulationPill).toBe(0); // 丹药已消耗
  });

  it("失败时预置丹药仍消耗", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 1500;
    s.resources.spirit = 200;
    s.preparedPill = true;
    s.inventory.tribulationPill = 1;
    const r = startTribulation(s, T0);
    const st = r.state as SaveState;
    expect(st.realm).toBe("qi4");
    expect(st.inventory.tribulationPill).toBe(0);
    expect(st.preparedPill).toBe(false);
  });

  it("重复调用不重复扣门槛（纯函数幂等，基于已扣状态）", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 1500;
    s.resources.spirit = 200;
    const r = startTribulation(s, T0);
    const st = r.state as SaveState;
    expect(st.resources.cultivation).toBe(0);
    // 已扣完后再次渡劫（门槛不足）会被拒绝，而不是再扣成负数
    const r2 = startTribulation(st, T0 + 1);
    expect(r2.ok).toBe(false);
  });
});

describe("存档导入导出", () => {
  it("导出后导入恢复同一进度", () => {
    const s = fresh();
    const played = settle(s, T0 + 2 * H);
    const json = exportSave(played);
    const r = importSave(json);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.resources.cultivation).toBeCloseTo(played.resources.cultivation, 5);
    expect(st.realm).toBe(played.realm);
  });

  it("损坏 JSON 拒绝", () => {
    expect(importSave("{bad").ok).toBe(false);
  });

  it("版本不兼容拒绝", () => {
    const s = fresh();
    const bad = { ...s, schemaVersion: SCHEMA_VERSION + 1 };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("资源为负拒绝", () => {
    const s = fresh();
    const bad = { ...s, resources: { ...s.resources, cultivation: -1 } };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("修订号", () => {
  it("结算增加修订号", () => {
    const s = fresh();
    const after = settle(s, T0 + 1000);
    expect(after.revision).toBeGreaterThan(s.revision);
  });
});

describe("坏档导入", () => {
  it("建筑等级越界拒绝", () => {
    const s = fresh();
    const bad = { ...s, buildings: { ...s.buildings, cultivationRoom: 99 } };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
  it("非法装备拒绝", () => {
    const s = fresh();
    const bad = { ...s, equipment: { ...s.equipment, weapon: "not_real" } };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
  it("非法功法拒绝", () => {
    const s = fresh();
    const bad = { ...s, technique: "not_real" };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("数值可达性", () => {
  it("两图六节点可逐节点首通", () => {
    const order: Array<{ map: MapId; node: string; gate: RealmId; drop: string | null }> = [
      { map: "map_qingyun", node: "node_wolf", gate: "qi1", drop: "a_cloth" },
      { map: "map_qingyun", node: "node_bandit", gate: "qi2", drop: "w_azure" },
      { map: "map_qingyun", node: "node_demon", gate: "qi3", drop: "c_wood" },
      { map: "map_nether", node: "node_shade", gate: "qi3", drop: "a_iron" },
      { map: "map_nether", node: "node_ghost", gate: "qi4", drop: "c_jade" },
      { map: "map_nether", node: "node_king", gate: "qi4", drop: null },
    ];
    let s = fresh();
    for (const step of order) {
      s.realm = step.gate;
      const r = fightNode(s, T0, step.map, step.node);
      expect(r.won, `${step.map}|${step.node} 可首通`).toBe(true);
      s = r.state;
      if (step.drop) {
        const eq = equipItem(s, T0, step.drop);
        expect(eq.ok).toBe(true);
        s = eq.state as SaveState;
      }
    }
    for (const step of order) {
      expect(s.maps[step.map][step.node].cleared).toBe(true);
    }
  });
});
