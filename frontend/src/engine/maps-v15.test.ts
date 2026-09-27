import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, fightNode, importSave, isBossNode, mainNodeIds, predictFight, repeatRewardFor, SCHEMA_VERSION } from "./engine";
import type { MapId, SaveState } from "./types";

const NOW = 1_700_000_000_000;

describe("v1.5 历练地图", () => {
  it("21 张地图各有两只支线怪和一只守关 BOSS，新角色入口可选三只", () => {
    expect(Object.keys(CONFIG.maps)).toHaveLength(21);
    for (const mid of Object.keys(CONFIG.maps) as MapId[]) {
      const nodes = (CONFIG.maps as unknown as Record<MapId, { nodes: Record<string, { side?: boolean }> }>)[mid].nodes;
      expect(Object.values(nodes).filter((node) => node.side), mid).toHaveLength(2);
      expect(isBossNode(mid, mainNodeIds(mid).at(-1)!), mid).toBe(true);
      expect(mainNodeIds(mid).every((nid) => !nodes[nid].side), mid).toBe(true);
    }
    const s = createGame("试炼", "金", "balanced", NOW);
    expect(Object.entries(s.maps.map_qingyun).filter(([, node]) => node.unlocked).map(([nid]) => nid))
      .toEqual(["node_wolf", "node_side_1", "node_side_2"]);
  });

  it("支线首胜不推进主线；挑战须普通首胜且结算高难奖励", () => {
    let s = createGame("试炼", "金", "balanced", NOW);
    expect(predictFight(s, "map_qingyun", "node_side_1", "challenge").ok).toBe(false);
    const side = fightNode(s, NOW, "map_qingyun", "node_side_1");
    expect(side.won).toBe(true);
    s = side.state;
    expect(s.maps.map_qingyun.node_bandit.unlocked).toBe(false);
    expect(s.maps.map_qingyun.node_side_1.cleared).toBe(true);
    const reward = repeatRewardFor("map_qingyun", "node_side_1", "challenge");
    expect(reward.material).toBeNull();
    expect(repeatRewardFor("map_yuanying", "node_1", "challenge").material).toBe("lingTaiJing");
    expect(reward.cultivation).toBeGreaterThan(repeatRewardFor("map_qingyun", "node_side_1").cultivation);
    const before = s.resources.cultivation;
    const battle = fightNode(s, NOW, "map_qingyun", "node_side_1", "challenge");
    expect(battle.won).toBe(predictFight(s, "map_qingyun", "node_side_1", "challenge").won);
    expect(battle.won).toBe(true);
    expect(battle.state.resources.cultivation - before).toBe(reward.cultivation);
    expect(battle.state.daily.rewardedRepeats).toBe(1);
  });

  it("BOSS 挑战第 12 回合仍未胜则失败，保留当日奖励额度", () => {
    const s = createGame("试炼", "金", "balanced", NOW);
    s.realm = "qi3";
    s.equipment.armor = "a_hunyuan";
    s.maps.map_qingyun.node_demon.unlocked = true;
    s.maps.map_qingyun.node_demon.cleared = true;
    const predicted = predictFight(s, "map_qingyun", "node_demon", "challenge");
    expect(predicted.ok).toBe(true);
    expect(predicted.won).toBe(false);
    expect(predicted.log.at(-1)).toContain("12 回合已到");
    const fought = fightNode(s, NOW, "map_qingyun", "node_demon", "challenge");
    expect(fought.won).toBe(false);
    expect(fought.log).toContain("12 回合已到，挑战失败。");
    expect(fought.state.daily.rewardedRepeats).toBe(0);
  });

  it("v14 旧档补入支线并保留主线首通、镇压和重复奖励计数", () => {
    const old = createGame("旧档", "金", "balanced", NOW);
    old.schemaVersion = 14;
    old.maps.map_qingyun.node_wolf.cleared = true;
    old.maps.map_qingyun.node_bandit.unlocked = true;
    old.suppression.map_qingyun = "node_wolf";
    old.daily.rewardedRepeats = 2;
    for (const mid of Object.keys(CONFIG.maps) as MapId[]) {
      delete old.maps[mid].node_side_1;
      delete old.maps[mid].node_side_2;
    }
    const imported = importSave(JSON.stringify(old));
    expect(imported.ok).toBe(true);
    const s = imported.state as SaveState;
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.maps.map_qingyun.node_wolf.cleared).toBe(true);
    expect(s.maps.map_qingyun.node_bandit.unlocked).toBe(true);
    expect(s.maps.map_qingyun.node_side_1.unlocked).toBe(true);
    expect(s.suppression.map_qingyun).toBe("node_wolf");
    expect(s.daily.rewardedRepeats).toBe(2);
    delete s.maps.map_qingyun.node_side_1;
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
  });
});
