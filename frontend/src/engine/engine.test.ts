import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createGame,
  settle,
  breakthrough,
  breakthroughCosts,
  breakthroughSuccessRate,
  upgradeBuilding,
  setTechnique,
  upgradeTechnique,
  setAuxiliaryTechnique,
  buildLibrary,
  buildForge,
  craftEquipment,
  predictSecretRealm,
  enterSecretRealm,
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
  migrateSave,
  recordDailySettle,
  claimDailyGoal,
  predictLongTask,
  startLongTask,
  claimLongTask,
  abortLongTask,
  playerStats,
  productionBreakdown,
  predictFight,
  startJindanTrial,
  jindanTrialGateOk,
  previewJindanTrial,
} from "./engine";
import type { SaveState, RealmId, MapId, AptitudeId, BreakthroughMethod, SecretRealmId } from "./types";

const H = 3600_000;
const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  const s = createGame("林青", "金", "balanced", nowMs);
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  s.daily.goals = { battle: { progress: 0, claimed: false }, suppress: { progress: 0, claimed: false } };
  return s;
}

describe("创建角色", () => {
  it("初始状态正确", () => {
    const s = fresh();
    expect(s.realm).toBe("qi1");
    expect(s.resources).toEqual({ cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0, iron: 0 });
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
  it("稳妥进阶按 1.15 倍成本扣费并进阶", () => {
    let s = fresh();
    s.resources.cultivation = 138;
    s.resources.spirit = 23;
    const r = breakthrough(s, T0, "steady");
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

describe("v1 存档迁移", () => {
  it("v1 存档升级到 v2，补默认字段", () => {
    const s = fresh();
    const v1 = { ...s, schemaVersion: 1 } as Record<string, unknown>;
    delete (v1 as Record<string, unknown>).milestones;
    delete (v1 as Record<string, unknown>).firsts;
    const r = importSave(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.schemaVersion).toBe(SCHEMA_VERSION);
    expect(st.milestones).toEqual([]);
    expect(st.firsts).toEqual({ settledOnce: false, suppressedFirstNodeOnce: false, viewedTribPreviewOnce: false });
  });

  it("迁移旧档时由镇压事实还原首玩标记", () => {
    const s = fresh();
    const v1 = { ...s, schemaVersion: 1, suppression: { map_qingyun: "node_wolf", map_nether: null } } as unknown as SaveState;
    delete (v1 as unknown as Record<string, unknown>).milestones;
    delete (v1 as unknown as Record<string, unknown>).firsts;
    const migrated = migrateSave(v1);
    expect(migrated.firsts.suppressedFirstNodeOnce).toBe(true);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("产速与胜负预估", () => {
  it("产速来源计算正确", () => {
    const s = fresh();
    expect(productionBreakdown(s).cultivationPerSec).toBeCloseTo(1, 5);
    expect(productionBreakdown(s).spiritPerSec).toBeCloseTo(0.25, 5);
    const s2 = fresh();
    s2.buildings.cultivationRoom = 1;
    expect(productionBreakdown(s2).cultivationPerSec).toBeCloseTo(1.2, 5);
  });

  it("天气限次奖励：首次领取收益发奖并标记已用", () => {
    const s = fresh();
    s.daily.weather = { id: "clear", used: false }; // 晴明 +100 修为
    const after = recordDailySettle(s, T0);
    expect(after.resources.cultivation).toBe(100);
    expect(after.daily.weather.used).toBe(true);
    const after2 = recordDailySettle(after, T0 + 1);
    expect(after2.resources.cultivation).toBe(100); // 不重复发
  });

  it("确定性胜负预估与战斗一致", () => {
    const s = fresh();
    const p = predictFight(s, "map_qingyun", "node_wolf");
    expect(p.ok).toBe(true);
    expect(p.won).toBe(true);
    const r = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    expect(r.won).toBe(p.won);
  });
});

describe("每日目标", () => {
  it("战斗目标达 3 次后可手动领取，不重复发", () => {
    const s = fresh();
    s.daily.goals.battle.progress = 2;
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    expect(r.state.daily.goals.battle.progress).toBe(3);
    expect(r.state.resources.page).toBe(5); // 仅首通 +5，未领取不发
    const cl = claimDailyGoal(r.state, T0, "battle");
    expect(cl.ok).toBe(true);
    expect((cl.state as SaveState).resources.page).toBe(8); // +3
    expect(claimDailyGoal(cl.state as SaveState, T0, "battle").ok).toBe(false);
  });

  it("跨天重置目标", () => {
    const s = fresh();
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    const next = settle(r.state, T0 + 24 * 3600 * 1000);
    expect(next.daily.date).not.toBe(r.state.daily.date);
    expect(next.daily.goals.battle.progress).toBe(0);
  });
});

describe("镇压复聚", () => {
  it("镇压 24 小时到期后自动失效", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    const r = setSuppression(s, T0, "map_qingyun", "node_wolf");
    const st = r.state as SaveState;
    expect(st.suppression.map_qingyun).toBe("node_wolf");
    // 先结算 12h（离线上限），镇压仍在
    const mid = settle(st, T0 + 12 * 3600 * 1000);
    expect(mid.suppression.map_qingyun).toBe("node_wolf");
    // 再结算 12h+1ms，跨过 24h 到期点
    const after = settle(mid, T0 + 24 * 3600 * 1000 + 1);
    expect(after.suppression.map_qingyun).toBe(null);
  });

  it("跨到期点按有效时段结算，不吞到期前收益", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    const r = setSuppression(s, T0, "map_qingyun", "node_wolf");
    const st = r.state as SaveState;
    const mid = settle(st, T0 + 12 * 3600 * 1000);
    expect(mid.resources.spiritStone).toBeCloseTo(4320, 0); // 0.1/s * 12h
    const end = settle(mid, T0 + 24 * 3600 * 1000 + 1);
    expect(end.resources.spiritStone).toBeCloseTo(8640, 0); // 再 12h
    expect(end.suppression.map_qingyun).toBe(null);
  });
});

describe("长期任务", () => {
  it("持续历练预测与开始", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    const p = predictLongTask(s, "training", "map_qingyun", "node_wolf", "steady", 30, false);
    expect(p.ok).toBe(true);
    expect(p.won).toBe(true);
    expect(p.reward.cultivation).toBe(8); // 野狼重复修为 4 × 2
    expect(p.reward.page).toBe(2); // 1 × 2
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "steady", durationMinutes: 30, protection: false });
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.longTask?.type).toBe("training");
    expect(st.longTask?.endAt).toBe(T0 + 30 * 60 * 1000);
  });

  it("险行倍率与护行阵扣费", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    s.resources.spiritStone = 30;
    const p = predictLongTask(s, "training", "map_qingyun", "node_wolf", "risky", 30, true);
    expect(p.ok).toBe(true);
    expect(p.reward.cultivation).toBe(12); // 4 × 2 × 1.5
    expect(p.protectionCost).toBe(30);
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "risky", durationMinutes: 30, protection: true });
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).resources.spiritStone).toBe(0);
  });

  it("到期才可领取，晚回来不增加", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "steady", durationMinutes: 30, protection: false });
    const st = r.state as SaveState;
    expect(claimLongTask(st, T0 + 29 * 60 * 1000).ok).toBe(false); // 29 分钟不可领
    const c = claimLongTask(st, T0 + 30 * 60 * 1000);
    expect(c.ok).toBe(true);
    const cs = c.state as SaveState;
    expect(cs.resources.cultivation).toBe(8);
    expect(cs.longTask).toBe(null);
    expect(cs.lastLongTaskResult?.reward.cultivation).toBe(8);
    // 晚 14 小时回来仍只 8（不增长）
    const c2 = claimLongTask(st, T0 + 14 * 3600 * 1000);
    expect(c2.ok).toBe(true);
    expect((c2.state as SaveState).resources.cultivation).toBe(8);
  });

  it("闭关按锁定产速计算", () => {
    const s = fresh();
    s.firsts.suppressedFirstNodeOnce = true;
    const p = predictLongTask(s, "seclusion", "map_qingyun", "", "steady", 30, false);
    expect(p.ok).toBe(true);
    expect(p.reward.cultivation).toBeCloseTo(180, 5); // 1/s × 30×60 × 10%
    expect(p.reward.spirit).toBeCloseTo(45, 5); // 0.25/s
    const r = startLongTask(s, T0, { type: "seclusion", durationMinutes: 30, protection: false });
    const c = claimLongTask(r.state as SaveState, T0 + 30 * 60 * 1000);
    expect((c.state as SaveState).resources.cultivation).toBeCloseTo(180, 5);
  });

  it("中止：奖励零、任务清空", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "steady", durationMinutes: 30, protection: false });
    const a = abortLongTask(r.state as SaveState, T0 + 1000);
    expect(a.ok).toBe(true);
    const as = a.state as SaveState;
    expect(as.longTask).toBe(null);
    expect(as.lastLongTaskResult?.aborted).toBe(true);
    expect(as.resources.cultivation).toBe(0);
  });

  it("缺快照的坏档导入被拒", () => {
    const s = fresh();
    const bad = { ...s, longTask: { type: "training", startAt: T0, endAt: T0 + 1000 } } as unknown as SaveState;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("到期任务不能中止", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "steady", durationMinutes: 30, protection: false });
    const a = abortLongTask(r.state as SaveState, T0 + 30 * 60 * 1000);
    expect(a.ok).toBe(false);
    expect((a as { reason: string }).reason).toContain("到期");
  });

  it("未镇压不能安排任务", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    const r = startLongTask(s, T0, { type: "seclusion", durationMinutes: 30, protection: false });
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("镇压");
  });
});

describe("长期任务坏档导入", () => {
  function inflightTraining(): SaveState {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.firsts.suppressedFirstNodeOnce = true;
    const r = startLongTask(s, T0, { type: "training", mapId: "map_qingyun", nodeId: "node_wolf", difficulty: "steady", durationMinutes: 30, protection: false });
    return r.state as SaveState;
  }

  it("合法在途 v4 任务可导入", () => {
    const st = inflightTraining();
    const r = importSave(exportSave(st));
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).longTask?.id).toBe(st.longTask?.id);
  });

  it("地图无效的任务拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as SaveState;
    (bad.longTask as unknown as Record<string, unknown>).mapId = "map_unknown";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("节点无效的任务拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as SaveState;
    (bad.longTask as unknown as Record<string, unknown>).nodeId = "node_unknown";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("快照奖励为负拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as SaveState;
    (bad.longTask as unknown as { snapshot: { expectedReward: { cultivation: number } } }).snapshot.expectedReward.cultivation = -1000;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("时长与起止时间不符拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as SaveState;
    (bad.longTask as unknown as Record<string, unknown>).durationMinutes = 999; // endAt 不变，与 999 分钟不符
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("非法时长 999 拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as SaveState;
    const lt = bad.longTask as unknown as Record<string, unknown>;
    lt.durationMinutes = 999;
    lt.endAt = (lt.startAt as number) + 999 * 60 * 1000;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("结果奖励为负拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    bad.lastLongTaskResult = {
      taskId: "x", type: "training", difficulty: "steady", durationMinutes: 30,
      reward: { cultivation: -5, spirit: 0, spiritStone: 0, herb: 0, page: 0 },
      completedAt: T0, aborted: false,
    };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("结果时长非法拒绝", () => {
    const st = inflightTraining();
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    bad.lastLongTaskResult = {
      taskId: "x", type: "training", difficulty: "steady", durationMinutes: 45,
      reward: { cultivation: 1, spirit: 0, spiritStone: 0, herb: 0, page: 0 },
      completedAt: T0, aborted: false,
    };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("修行资质", () => {
  it("均衡资质产速与基线一致", () => {
    const s = fresh();
    s.aptitude = "balanced";
    const after = settle(s, T0 + 1000);
    expect(after.resources.cultivation).toBeCloseTo(1.0, 5);
    expect(after.resources.spirit).toBeCloseTo(0.25, 5);
  });

  it("凝神资质修为×1.05、灵气×0.95", () => {
    const s = fresh();
    s.aptitude = "focus";
    const after = settle(s, T0 + 1000);
    expect(after.resources.cultivation).toBeCloseTo(1.05, 5);
    expect(after.resources.spirit).toBeCloseTo(0.2375, 5);
  });

  it("聚灵资质修为×0.95、灵气×1.05", () => {
    const s = fresh();
    s.aptitude = "spirit";
    const after = settle(s, T0 + 1000);
    expect(after.resources.cultivation).toBeCloseTo(0.95, 5);
    expect(after.resources.spirit).toBeCloseTo(0.2625, 5);
  });

  it("生产明细包含资质项", () => {
    const s = fresh();
    s.aptitude = "focus";
    const prod = productionBreakdown(s);
    expect(prod.lines.some((l) => l.includes("资质·凝神"))).toBe(true);
  });
});

describe("概率小进阶", () => {
  it("冲关初次成功：扣完整成本并进阶，保底归零", () => {
    const s = fresh();
    s.resources.cultivation = 120;
    s.resources.spirit = 20;
    const r = breakthrough(s, T0, "risky", () => 0.5);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("qi2");
    expect(st.resources.cultivation).toBe(0);
    expect(st.resources.spirit).toBe(0);
    expect(st.breakthroughFails.qi1).toBe(0);
    expect(st.breakthroughRecords.length).toBe(1);
    expect(st.breakthroughRecords[0].success).toBe(true);
  });

  it("冲关初次失败：境界不动、只扣 20%、保底+1", () => {
    const s = fresh();
    s.resources.cultivation = 120;
    s.resources.spirit = 20;
    const r = breakthrough(s, T0, "risky", () => 0.85);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("qi1");
    expect(st.breakthroughFails.qi1).toBe(1);
    expect(st.resources.cultivation).toBe(120 - 24);
    expect(st.resources.spirit).toBe(20 - 4);
    expect(st.breakthroughRecords[0].success).toBe(false);
  });

  it("冲关两次失败后第三次保底成功", () => {
    let s = fresh();
    s.resources.cultivation = 360;
    s.resources.spirit = 60;
    // 初次 80%：rng 0.85 失败
    let r = breakthrough(s, T0, "risky", () => 0.85);
    let st = r.state as SaveState;
    expect(st.realm).toBe("qi1");
    expect(st.breakthroughFails.qi1).toBe(1);
    // 二次 90%：rng 0.95 失败
    r = breakthrough(st, T0, "risky", () => 0.95);
    st = r.state as SaveState;
    expect(st.breakthroughFails.qi1).toBe(2);
    // 三次 100%：rng 0.95 < 1.0 成功
    r = breakthrough(st, T0, "risky", () => 0.95);
    st = r.state as SaveState;
    expect(st.realm).toBe("qi2");
    expect(st.breakthroughFails.qi1).toBe(0);
  });

  it("稳妥进阶必成且成本 ×1.15 向上取整", () => {
    const s = fresh();
    s.resources.cultivation = 138;
    s.resources.spirit = 23;
    const r = breakthrough(s, T0, "steady", () => 0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("qi2");
    expect(st.resources.cultivation).toBe(0);
    expect(st.resources.spirit).toBe(0);
    expect(st.breakthroughRecords[0].probability).toBe(1);
  });

  it("保底计数跨层不继承", () => {
    const s = fresh();
    s.resources.cultivation = 240;
    s.resources.spirit = 40;
    // qi1 冲关失败一次
    const r1 = breakthrough(s, T0, "risky", () => 0.85);
    const st1 = r1.state as SaveState;
    expect(st1.breakthroughFails.qi1).toBe(1);
    // qi1 稳妥成功进阶到 qi2，保底归零
    st1.resources.cultivation += 200;
    st1.resources.spirit += 40;
    const r2 = breakthrough(st1, T0, "steady");
    const st2 = r2.state as SaveState;
    expect(st2.realm).toBe("qi2");
    expect(st2.breakthroughFails.qi1).toBe(0);
    // qi2 新层保底从 0 开始
    expect(st2.breakthroughFails.qi2).toBe(0);
  });

  it("资源不足时零扣费且不判定", () => {
    const s = fresh();
    s.resources.cultivation = 100;
    s.resources.spirit = 20;
    const r = breakthrough(s, T0, "risky", () => 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("不足");
    expect(s.resources.cultivation).toBe(100);
  });
});

describe("v0.6 迁移与导入校验", () => {
  it("v4 旧档迁移补均衡资质与空保底", () => {
    const s = fresh();
    const v4 = structuredClone(s) as unknown as Record<string, unknown>;
    delete v4.aptitude;
    delete v4.breakthroughFails;
    delete v4.breakthroughRecords;
    v4.schemaVersion = 4;
    const m = migrateSave(v4 as unknown as SaveState);
    expect(m.aptitude).toBe("balanced");
    expect(m.breakthroughFails).toEqual({ qi1: 0, qi2: 0, qi3: 0, foundation1: 0, foundation2: 0 });
    expect(m.breakthroughRecords).toEqual([]);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("无效资质拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    bad.aptitude = "legendary";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("越界保底计数拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    bad.breakthroughFails = { qi1: 3, qi2: 0, qi3: 0 };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("坏进阶记录拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    bad.breakthroughRecords = [{ layer: "qi1", method: "risky", success: false, probability: 2, cost: { cultivation: 0, spirit: 0, spiritStone: 0, herb: 0, page: 0 }, at: T0 }];
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("v0.7 境界与筑基主线", () => {
  it("筑基境界增加战斗属性（相对筑基一层累计）", () => {
    const s = fresh();
    s.realm = "foundation1";
    const f1 = playerStats(s);
    s.realm = "foundation2";
    const f2 = playerStats(s);
    expect(f2.attack).toBe(f1.attack + 3);
    expect(f2.defense).toBe(f1.defense + 2);
    expect(f2.hp).toBe(f1.hp + 20);
    s.realm = "foundation3";
    const f3 = playerStats(s);
    expect(f3.attack).toBe(f1.attack + 6);
    expect(f3.hp).toBe(f1.hp + 40);
    s.realm = "jindan1";
    const j = playerStats(s);
    expect(j.attack).toBe(f1.attack + 10);
    expect(j.defense).toBe(f1.defense + 7);
    expect(j.hp).toBe(f1.hp + 60);
  });

  it("筑基一层稳妥进阶到筑基二层（成本 ×1.15）", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.resources.cultivation = 3450;
    s.resources.spirit = 460;
    const r = breakthrough(s, T0, "steady");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("foundation2");
    expect(st.resources.cultivation).toBe(0);
    expect(st.resources.spirit).toBe(0);
  });

  it("筑基二层冲关失败只扣 20% 且保底跨层不继承", () => {
    const s = fresh();
    s.realm = "foundation2";
    s.resources.cultivation = 6000;
    s.resources.spirit = 800;
    const r = breakthrough(s, T0, "risky", () => 0.9);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("foundation2");
    expect(st.breakthroughFails.foundation2).toBe(1);
    expect(st.resources.cultivation).toBe(6000 - 1200); // 20% of 6000
    expect(st.resources.spirit).toBe(800 - 160); // 20% of 800
  });

  it("渡劫成功后解锁云岭古道首节点", () => {
    const s = fresh();
    s.realm = "qi4";
    s.resources.cultivation = 1500;
    s.resources.spirit = 200;
    s.technique = "xuanGui";
    s.techniqueLevel.xuanGui = 3;
    s.equipment.armor = "a_iron";
    s.equipment.accessory = "c_jade";
    s.preparedPill = true;
    s.inventory.tribulationPill = 1;
    const r = startTribulation(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("foundation1");
    const first = Object.keys(st.maps.map_yunling)[0];
    expect(st.maps.map_yunling[first].unlocked).toBe(true);
  });
});

describe("v0.7 结丹试炼", () => {
  function readyJindan(): SaveState {
    const s = fresh();
    s.realm = "foundation3";
    s.maps.map_yunling.node_guardian.cleared = true;
    s.maps.map_yunling.node_guardian.unlocked = true;
    s.technique = "xuanGui";
    s.techniqueLevel.xuanGui = 3;
    s.equipment.armor = "a_iron";
    s.equipment.accessory = "c_jade";
    s.preparedPill = true;
    s.inventory.tribulationPill = 1;
    s.resources.cultivation = 12000;
    s.resources.spirit = 1600;
    s.resources.spiritStone = 3000;
    return s;
  }

  it("未首通护丹灵时不可结丹", () => {
    const s = readyJindan();
    s.maps.map_yunling.node_guardian.cleared = false;
    expect(jindanTrialGateOk(s).ok).toBe(false);
    expect(startJindanTrial(s, T0).ok).toBe(false);
  });

  it("结丹试炼预览与实战一致，成功晋入金丹并只扣费一次", () => {
    const s = readyJindan();
    const p = previewJindanTrial(s);
    expect(p.ok).toBe(true);
    expect(p.success).toBe(true);
    const r = startJindanTrial(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("jindan1");
    expect(st.jindanTrial?.success).toBe(true);
    expect(st.resources.cultivation).toBe(0);
    expect(st.resources.spirit).toBe(0);
    expect(st.resources.spiritStone).toBe(0);
  });

  it("结丹试炼失败不降境界", () => {
    const s = readyJindan();
    // 去掉护劫丹与减伤装备，使失败
    s.preparedPill = false;
    s.equipment.armor = null;
    s.equipment.accessory = null;
    s.technique = null;
    s.techniqueLevel.xuanGui = 0;
    const r = startJindanTrial(s, T0);
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.realm).toBe("foundation3");
    expect(st.jindanTrial?.success).toBe(false);
  });
});

describe("v0.7 迁移", () => {
  it("v5 旧档迁移补云岭古道与结丹试炼字段", () => {
    const s = fresh();
    s.realm = "foundation1";
    const v5 = structuredClone(s) as unknown as Record<string, unknown>;
    delete v5.jindanTrial;
    delete (v5.maps as Record<string, unknown>).map_yunling;
    delete (v5.suppression as Record<string, unknown>).map_yunling;
    delete (v5.suppressionSince as Record<string, unknown>).map_yunling;
    v5.schemaVersion = 5;
    const m = migrateSave(v5 as unknown as SaveState);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.jindanTrial).toBe(null);
    expect(m.maps.map_yunling).toBeDefined();
    const first = Object.keys(m.maps.map_yunling)[0];
    expect(m.maps.map_yunling[first].unlocked).toBe(true); // 筑基一层旧档直接解锁首节点
  });
});

describe("v0.7 复核修复回归", () => {
  function jindanWaves(): Array<{ damage: number; hpAfter: number }> {
    return [
      { damage: 33, hpAfter: 167 },
      { damage: 41, hpAfter: 126 },
      { damage: 48, hpAfter: 138 },
      { damage: 56, hpAfter: 82 },
      { damage: 63, hpAfter: 19 },
    ];
  }

  it("v6 缺 map_qingyun 拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete (bad.maps as Record<string, unknown>).map_qingyun;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v6 缺 map_yunling 节点拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete ((bad.maps as Record<string, unknown>).map_yunling as Record<string, unknown>).node_ape;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v5 缺 map_yunling 可迁移导入", () => {
    const s = fresh();
    const v5 = structuredClone(s) as unknown as Record<string, unknown>;
    delete (v5.maps as Record<string, unknown>).map_yunling;
    delete (v5.suppression as Record<string, unknown>).map_yunling;
    delete (v5.suppressionSince as Record<string, unknown>).map_yunling;
    v5.schemaVersion = 5;
    const r = importSave(JSON.stringify(v5));
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).maps.map_yunling).toBeDefined();
  });

  it("结丹战报缺波拒绝导入", () => {
    const s = fresh();
    s.jindanTrial = { maxHp: 200, reduction: 0.25, pillUsed: true, waves: [{ damage: 33, hpAfter: 167 }], success: true, log: ["a"] };
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
  });

  it("结丹战报对象日志拒绝导入", () => {
    const s = fresh();
    s.jindanTrial = { maxHp: 200, reduction: 0.25, pillUsed: true, waves: jindanWaves(), success: true, log: [{ bad: "x" } as unknown as string] };
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
  });

  it("资源不足时结丹预览仍显示五波与差额", () => {
    const s = fresh();
    s.realm = "foundation3";
    s.maps.map_yunling.node_guardian.cleared = true;
    s.maps.map_yunling.node_guardian.unlocked = true;
    s.resources.cultivation = 12000;
    s.resources.spirit = 1600;
    s.resources.spiritStone = 2999; // 差 1 灵石
    const p = previewJindanTrial(s);
    expect(p.ok).toBe(true);
    expect(p.canAfford).toBe(false);
    expect(p.waves.length).toBe(5);
    expect(p.shortfall.spiritStone).toBe(1);
  });
});

describe("v0.7 复核修复回归·补全", () => {
  it("v6 缺整张新地图 map_yunling 拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete (bad.maps as Record<string, unknown>).map_yunling;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v6 缺中/末节点拒绝导入", () => {
    const s = fresh();
    const badMid = structuredClone(s) as unknown as Record<string, unknown>;
    delete ((badMid.maps as Record<string, unknown>).map_yunling as Record<string, unknown>).node_golem;
    expect(importSave(JSON.stringify(badMid)).ok).toBe(false);
    const badEnd = structuredClone(s) as unknown as Record<string, unknown>;
    delete ((badEnd.maps as Record<string, unknown>).map_yunling as Record<string, unknown>).node_guardian;
    expect(importSave(JSON.stringify(badEnd)).ok).toBe(false);
  });

  it("修为/灵气差 1 时结丹预览显示对应差额", () => {
    function mk(cult: number, spirit: number, stone: number): SaveState {
      const s = fresh();
      s.realm = "foundation3";
      s.maps.map_yunling.node_guardian.cleared = true;
      s.maps.map_yunling.node_guardian.unlocked = true;
      s.resources.cultivation = cult;
      s.resources.spirit = spirit;
      s.resources.spiritStone = stone;
      return s;
    }
    const p1 = previewJindanTrial(mk(11999, 1600, 3000));
    expect(p1.canAfford).toBe(false);
    expect(p1.shortfall.cultivation).toBe(1);
    const p2 = previewJindanTrial(mk(12000, 1599, 3000));
    expect(p2.canAfford).toBe(false);
    expect(p2.shortfall.spirit).toBe(1);
  });
});

describe("v0.7 修复后复核回归", () => {
  it("挂机结算跨过门槛后，结丹预览 canAfford 翻转", () => {
    const s = fresh();
    s.realm = "foundation3";
    s.maps.map_yunling.node_guardian.cleared = true;
    s.maps.map_yunling.node_guardian.unlocked = true;
    s.resources.cultivation = 11995; // 差 5 修为
    s.resources.spirit = 1600;
    s.resources.spiritStone = 3000;
    s.lastSettledAt = T0;
    // 未结算：仍差 5，不可挑战
    const before = previewJindanTrial(s);
    expect(before.canAfford).toBe(false);
    expect(before.shortfall.cultivation).toBe(5);
    // 结算 6 秒后：修为 12001，可挑战
    const after = previewJindanTrial(settle(s, T0 + 6000));
    expect(after.canAfford).toBe(true);
    expect(after.shortfall.cultivation).toBe(0);
  });
});

describe("v0.8 藏经阁与主辅功法", () => {
  function geared(s: SaveState): SaveState {
    s.realm = "foundation1";
    s.resources.spiritStone = 10000;
    s.resources.page = 100;
    return s;
  }

  it("藏经阁：未筑基不可建，成本正确，满级拒绝", () => {
    const s = fresh();
    expect(buildLibrary(s, T0).ok).toBe(false); // qi1 未筑基
    geared(s);
    s.resources.spiritStone = 799; // 差 1 灵石
    expect(buildLibrary(s, T0).ok).toBe(false);
    s.resources.spiritStone = 800;
    s.resources.page = 10;
    const r = buildLibrary(s, T0);
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).library).toBe(1);
    expect((r.state as SaveState).resources.spiritStone).toBe(0);
    expect((r.state as SaveState).resources.page).toBe(0);
    // 补二级资源再升
    const s2 = r.state as SaveState;
    s2.resources.spiritStone = 1600;
    s2.resources.page = 20;
    const r2 = buildLibrary(s2, T0);
    expect(r2.ok).toBe(true);
    expect((r2.state as SaveState).library).toBe(2);
    expect(buildLibrary(r2.state as SaveState, T0).ok).toBe(false); // 满级
  });

  it("新功法需一级藏经阁才可主修", () => {
    const s = fresh();
    s.realm = "foundation1";
    expect(setTechnique(s, T0, "poYue").ok).toBe(false);
    s.library = 1;
    const r = setTechnique(s, T0, "poYue");
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).techniqueLevel.poYue).toBe(1);
  });

  it("破岳诀主/辅攻击加成不同", () => {
    const s = fresh();
    s.library = 2;
    s.techniqueLevel.poYue = 3;
    s.technique = "poYue";
    const mainAtk = playerStats(s).attack; // 主修 lv3 +12 → 基础 15 + 12 = 27
    s.technique = "qingYun";
    s.auxiliaryTechnique = "poYue";
    const auxAtk = playerStats(s).attack; // 辅修 lv3 +6 → 21
    expect(mainAtk).toBe(27);
    expect(auxAtk).toBe(21);
  });

  it("聚元诀主/辅灵气产速", () => {
    const s = fresh();
    s.technique = "juYuan";
    s.techniqueLevel.juYuan = 3;
    const mainSpirit = settle(s, T0 + 1000).resources.spirit;
    s.technique = "qingYun";
    s.auxiliaryTechnique = "juYuan";
    const auxSpirit = settle(s, T0 + 1000).resources.spirit;
    expect(mainSpirit).toBeCloseTo(0.25 * 1.5, 5); // 主修 ×1.5
    expect(auxSpirit).toBeCloseTo(0.25 * 1.25, 5); // 辅修 ×1.25
  });

  it("主辅不能同一本，且主辅互换", () => {
    const s = fresh();
    s.library = 2;
    s.technique = "qingYun";
    s.techniqueLevel.qingYun = 2;
    s.techniqueLevel.xuanGui = 3;
    // 设置辅修为玄龟诀
    const r1 = setAuxiliaryTechnique(s, T0, "xuanGui");
    expect(r1.ok).toBe(true);
    expect((r1.state as SaveState).auxiliaryTechnique).toBe("xuanGui");
    // 把当前辅修设为主修 → 互换
    const r2 = setTechnique(r1.state as SaveState, T0, "xuanGui");
    expect(r2.ok).toBe(true);
    expect((r2.state as SaveState).technique).toBe("xuanGui");
    expect((r2.state as SaveState).auxiliaryTechnique).toBe("qingYun");
    // 反向：把当前主修设为辅修 → 互换回来
    const r3 = setAuxiliaryTechnique(r2.state as SaveState, T0, "xuanGui");
    expect(r3.ok).toBe(true);
    expect((r3.state as SaveState).technique).toBe("qingYun");
    expect((r3.state as SaveState).auxiliaryTechnique).toBe("xuanGui");
  });

  it("无主修不能设辅修", () => {
    const s = fresh();
    s.library = 2;
    s.technique = null;
    expect(setAuxiliaryTechnique(s, T0, "qingYun").ok).toBe(false);
  });
});

describe("v0.8 迁移与校验", () => {
  it("v6 旧档迁移补藏经阁与辅修字段", () => {
    const s = fresh();
    const v6 = structuredClone(s) as unknown as Record<string, unknown>;
    delete v6.library;
    delete v6.auxiliaryTechnique;
    delete (v6.techniqueLevel as Record<string, unknown>).poYue;
    delete (v6.techniqueLevel as Record<string, unknown>).juYuan;
    v6.schemaVersion = 6;
    const m = migrateSave(v6 as unknown as SaveState);
    expect(m.library).toBe(0);
    expect(m.auxiliaryTechnique).toBe(null);
    expect(m.techniqueLevel.poYue).toBe(0);
    expect(m.techniqueLevel.juYuan).toBe(0);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("坏档：主辅同书拒绝导入", () => {
    const s = fresh();
    s.library = 2;
    s.technique = "qingYun";
    s.auxiliaryTechnique = "qingYun";
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
  });

  it("坏档：藏经阁等级越界拒绝导入", () => {
    const s = fresh();
    s.library = 3;
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
  });
});

describe("v0.8 独立复核修复回归", () => {
  it("v6 缺 map_yunling 拒绝导入（真实 v6 坏档）", () => {
    const s = fresh();
    const v6 = structuredClone(s) as unknown as Record<string, unknown>;
    v6.schemaVersion = 6;
    delete (v6.maps as Record<string, unknown>).map_yunling;
    delete v6.library;
    delete v6.auxiliaryTechnique;
    delete (v6.techniqueLevel as Record<string, unknown>).poYue;
    delete (v6.techniqueLevel as Record<string, unknown>).juYuan;
    expect(importSave(JSON.stringify(v6)).ok).toBe(false);
  });

  it("修仙录记录研习/升级/首次辅修", () => {
    const s = fresh();
    s.library = 2;
    s.technique = null;
    const r1 = setTechnique(s, T0, "qingYun");
    expect((r1.state as SaveState).milestones.some((m) => m.text.includes("研习青云诀"))).toBe(true);
    const s2 = r1.state as SaveState;
    s2.resources.page = 100;
    const r2 = upgradeTechnique(s2, T0);
    expect((r2.state as SaveState).milestones.some((m) => m.text.includes("精进至"))).toBe(true);
    const r3 = setAuxiliaryTechnique(r2.state as SaveState, T0, "xuanGui");
    expect((r3.state as SaveState).milestones.some((m) => m.text.includes("首次采用辅修"))).toBe(true);
  });

  it("资源路线与历练路线各有优势（R43）", () => {
    const base = fresh();
    base.realm = "foundation3";
    base.library = 2;
    base.techniqueLevel = { qingYun: 3, xuanGui: 0, poYue: 3, juYuan: 3 };
    const res = structuredClone(base);
    res.technique = "qingYun";
    res.auxiliaryTechnique = "juYuan";
    const combat = structuredClone(base);
    combat.technique = "poYue";
    combat.auxiliaryTechnique = "qingYun";
    const resProd = productionBreakdown(res);
    const combatProd = productionBreakdown(combat);
    expect(resProd.cultivationPerSec).toBeGreaterThan(combatProd.cultivationPerSec);
    expect(resProd.spiritPerSec).toBeGreaterThan(combatProd.spiritPerSec);
    expect(playerStats(combat).attack).toBeGreaterThan(playerStats(res).attack);
  });
});

describe("v0.9 秘境", () => {
  function strongFoundation(): SaveState {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    return s;
  }

  it("未达境界不可进入", () => {
    const s = fresh(); // qi1
    expect(enterSecretRealm(s, T0, "realm_herb").ok).toBe(false);
  });

  it("每日限次：同日第二次进入被拒", () => {
    const s = strongFoundation();
    const r1 = enterSecretRealm(s, T0, "realm_herb");
    expect(r1.ok).toBe(true);
    expect((r1.state as SaveState).secretRealmUsed.realm_herb).toBe(true);
    expect(enterSecretRealm(r1.state as SaveState, T0, "realm_herb").ok).toBe(false);
  });

  it("跨日重置后可再次进入", () => {
    const s = strongFoundation();
    const r1 = enterSecretRealm(s, T0, "realm_herb");
    expect(r1.ok).toBe(true);
    const nextDay = (r1.state as SaveState);
    nextDay.secretRealmDate = "2000-01-01"; // 旧日期
    const r2 = enterSecretRealm(nextDay, T0 + 86400000, "realm_herb");
    expect(r2.ok).toBe(true);
  });

  it("胜利发放对应奖励并记录", () => {
    const s = strongFoundation();
    const r = enterSecretRealm(s, T0, "realm_herb");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.resources.herb).toBe(30);
    expect(st.resources.spiritStone).toBe(100);
    expect(st.secretRealmLog.length).toBe(1);
    expect(st.secretRealmLog[0].won).toBe(true);
    expect(st.milestones.some((m) => m.text.includes("灵药谷"))).toBe(true);
  });

  it("战败无奖励", () => {
    const s = fresh();
    s.realm = "foundation1"; // 无装备无功法 → 必败
    const r = enterSecretRealm(s, T0, "realm_herb");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.resources.herb).toBe(0);
    expect(st.resources.spiritStone).toBe(0);
    expect(st.secretRealmLog[0].won).toBe(false);
  });
});

describe("v0.9 迁移与校验", () => {
  it("v7 旧档迁移补秘境字段", () => {
    const s = fresh();
    const v7 = structuredClone(s) as unknown as Record<string, unknown>;
    delete v7.secretRealmDate;
    delete v7.secretRealmUsed;
    delete v7.secretRealmLog;
    v7.schemaVersion = 7;
    const m = migrateSave(v7 as unknown as SaveState);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.secretRealmUsed).toEqual({ realm_herb: false, realm_relic: false, realm_deep: false });
    expect(m.secretRealmLog).toEqual([]);
  });

  it("坏档：秘境状态非布尔拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    (bad.secretRealmUsed as Record<string, unknown>).realm_herb = 1;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("v0.9 自查修复回归", () => {
  it("秘境不消耗破军星象、不计入每日战斗目标", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    s.daily.astrology = { id: "war", used: false };
    s.daily.goals.battle.progress = 0;
    const r = enterSecretRealm(s, T0, "realm_herb");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.daily.astrology.used).toBe(false);
    expect(st.daily.goals.battle.progress).toBe(0);
  });

  it("秘境战斗不受破军加成影响", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.library = 2;
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "qingYun";
    s.auxiliaryTechnique = "poYue";
    s.techniqueLevel.poYue = 1; // 辅修 +2 攻击 → 总攻 27，破军加成会翻盘
    s.daily.astrology = { id: "war", used: false };
    const predWithWar = predictSecretRealm(s, "realm_herb");
    s.daily.astrology = { id: "none", used: false };
    const predNoWar = predictSecretRealm(s, "realm_herb");
    expect(predWithWar.won).toBe(false); // 无加成应输
    expect(predWithWar.won).toBe(predNoWar.won);
  });
});

describe("v0.9 独立复核修复回归", () => {
  it("v8 缺秘境次数拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete bad.secretRealmUsed;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 缺秘境日期拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete bad.secretRealmDate;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 非法秘境日期拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    bad.secretRealmDate = "invalid-date";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 胜利奖励被改拒绝导入", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    const r = enterSecretRealm(s, T0, "realm_herb");
    const st = r.state as SaveState;
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    (bad.secretRealmLog as unknown as Array<Record<string, unknown>>)[0].reward = { cultivation: 0, spirit: 0, spiritStone: 100, herb: 999999, page: 0 };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 失败记录奖励非零拒绝导入", () => {
    const s = fresh();
    s.realm = "foundation1"; // 无装备 → 必败
    const r = enterSecretRealm(s, T0, "realm_herb");
    const st = r.state as SaveState;
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    (bad.secretRealmLog as unknown as Array<Record<string, unknown>>)[0].reward = { cultivation: 0, spirit: 0, spiritStone: 100, herb: 0, page: 0 };
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("v0.9 再次独立复核修复回归", () => {
  function wonHerbSave(): SaveState {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    const r = enterSecretRealm(s, T0, "realm_herb");
    return r.state as SaveState;
  }

  it("v8 已有当日记录但 used=false 拒绝导入", () => {
    const st = wonHerbSave();
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    (bad.secretRealmUsed as Record<string, unknown>).realm_herb = false;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 日期改成旧日期但记录在今天拒绝导入", () => {
    const st = wonHerbSave();
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    bad.secretRealmDate = "2000-01-01";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v8 非法日历日期拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    bad.secretRealmDate = "2026-99-99";
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("v0.9 秘境可达性模拟矩阵", () => {
  const equip = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
  const cases: Array<{ rid: SecretRealmId; realm: RealmId; name: string }> = [
    { rid: "realm_herb", realm: "foundation1", name: "灵药谷" },
    { rid: "realm_relic", realm: "foundation2", name: "古修遗迹" },
    { rid: "realm_deep", realm: "foundation3", name: "幽窟险境" },
  ];

  it("三秘境在破岳诀Lv3+最佳装备下均可胜", () => {
    for (const c of cases) {
      const s = fresh();
      s.realm = c.realm;
      s.equipment = equip;
      s.technique = "poYue";
      s.techniqueLevel.poYue = 3;
      const pred = predictSecretRealm(s, c.rid);
      expect(pred.ok).toBe(true);
      expect(pred.won).toBe(true);
    }
  });

  it("无功法时三秘境均难胜（体现功法取向价值）", () => {
    for (const c of cases) {
      const s = fresh();
      s.realm = c.realm;
      s.equipment = equip;
      s.technique = null;
      const pred = predictSecretRealm(s, c.rid);
      expect(pred.won).toBe(false);
    }
  });
});

describe("v0.9 最终复核修复回归", () => {
  function wonHerbSave(): SaveState {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    const r = enterSecretRealm(s, T0, "realm_herb");
    return r.state as SaveState;
  }

  it("v8 改称 v7 且改次数仍拒绝导入（防降版本绕过）", () => {
    const st = wonHerbSave();
    const bad = structuredClone(st) as unknown as Record<string, unknown>;
    bad.schemaVersion = 7; // 降版本
    (bad.secretRealmUsed as Record<string, unknown>).realm_herb = false; // 改次数
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("真正 v7 无秘境字段可迁移导入", () => {
    const s = fresh();
    const v7 = structuredClone(s) as unknown as Record<string, unknown>;
    v7.schemaVersion = 7;
    delete v7.secretRealmDate;
    delete v7.secretRealmUsed;
    delete v7.secretRealmLog;
    const r = importSave(JSON.stringify(v7));
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).secretRealmUsed).toEqual({ realm_herb: false, realm_relic: false, realm_deep: false });
  });
});

describe("v1.0 炼器", () => {
  it("未筑基不可建炼器台，成本正确", () => {
    const s = fresh();
    expect(buildForge(s, T0).ok).toBe(false); // qi1 未筑基
    s.realm = "foundation1";
    s.resources.spiritStone = 999;
    s.resources.page = 15;
    expect(buildForge(s, T0).ok).toBe(false); // 灵石差 1
    s.resources.spiritStone = 1000;
    const r = buildForge(s, T0);
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).forge).toBe(1);
    expect((r.state as SaveState).resources.spiritStone).toBe(0);
    expect((r.state as SaveState).resources.page).toBe(0);
    expect(buildForge(r.state as SaveState, T0).ok).toBe(false); // 已建
  });

  it("未建炼器台不可炼制，材料不足不可炼制", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.resources.iron = 8;
    s.resources.spiritStone = 800;
    expect(craftEquipment(s, T0, "w_steel").ok).toBe(false); // 未建台
    s.forge = 1;
    s.resources.iron = 7; // 差 1 玄铁
    expect(craftEquipment(s, T0, "w_steel").ok).toBe(false);
  });

  it("炼制成功扣料入包", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.forge = 1;
    s.resources.iron = 8;
    s.resources.spiritStone = 800;
    const r = craftEquipment(s, T0, "w_steel");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.resources.iron).toBe(0);
    expect(st.resources.spiritStone).toBe(0);
    expect(st.inventory.w_steel).toBe(1);
  });

  it("镇压产玄铁、秘境成功掉玄铁", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.suppression = { map_qingyun: "node_wolf", map_nether: null, map_yunling: null };
    s.suppressionSince = { map_qingyun: 0, map_nether: 0, map_yunling: 0 };
    const settled = settle(s, T0 + 1000);
    expect(settled.resources.iron).toBeCloseTo(0.02, 5); // 0.02/秒 × 1 秒
    // 秘境成功掉玄铁
    const s2 = fresh();
    s2.realm = "foundation1";
    s2.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s2.technique = "poYue";
    s2.techniqueLevel.poYue = 3;
    const r = enterSecretRealm(s2, T0, "realm_herb");
    expect((r.state as SaveState).resources.iron).toBe(2);
  });
});

describe("v1.0 迁移与坏档", () => {
  it("v8 旧档迁移补 forge 与 iron", () => {
    const s = fresh();
    const v8 = structuredClone(s) as unknown as Record<string, unknown>;
    delete v8.forge;
    delete (v8.resources as Record<string, unknown>).iron;
    v8.schemaVersion = 8;
    const m = migrateSave(v8 as unknown as SaveState);
    expect(m.forge).toBe(0);
    expect(m.resources.iron).toBe(0);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("v9 缺玄铁拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete (bad.resources as Record<string, unknown>).iron;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });

  it("v9 缺炼器台等级拒绝导入", () => {
    const s = fresh();
    const bad = structuredClone(s) as unknown as Record<string, unknown>;
    delete bad.forge;
    expect(importSave(JSON.stringify(bad)).ok).toBe(false);
  });
});
