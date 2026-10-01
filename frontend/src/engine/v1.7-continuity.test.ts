import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createGame,
  fightNode,
  resolveEncounter,
  enterSecretRealm,
  importSave,
  migrateSave,
} from "./engine";
import { CONFIG } from "./config";
import type { SaveState, StoryId } from "./types";

const H = 3600_000;
const DAY = 24 * H;
const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  const s = createGame("林青", "金", "balanced", nowMs);
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  s.daily.goals = { battle: { progress: 0, claimed: false }, suppress: { progress: 0, claimed: false } };
  return s;
}

function d(ms: number): string {
  const x = new Date(ms);
  const m = x.getMonth() + 1;
  const day = x.getDate();
  return `${x.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

// 首通野狼 → 引导古井 → 选择探查井底，返回开启连续际遇后的存档
function startWellStory(optionId = "well_a"): SaveState {
  const s0 = fresh();
  const f = fightNode(s0, T0, "map_qingyun", "node_wolf");
  const r = resolveEncounter(f.state, T0 + 1000, optionId);
  return r.state as SaveState;
}

describe("v1.7 连续际遇", () => {
  it("初始事件选择后开启故事，记 awaiting", () => {
    const s = startWellStory("well_a");
    expect(s.encounter.pending).toBe(null);
    expect(s.encounter.continuity).toEqual({
      storyId: "well",
      originOptionId: "well_a",
      originDate: d(T0 + 1000),
      stage: "awaiting",
    });
    expect(s.encounter.completedStories).toEqual([]);
  });

  it("同日再胜不触发后续（未跨自然日）", () => {
    const s = startWellStory("well_a");
    s.encounter.triggeredToday = CONFIG.encounter.dailyMax; // 防随机际遇干扰
    const r = fightNode(s, T0 + 2 * H, "map_qingyun", "node_wolf");
    expect(r.won).toBe(true);
    expect(r.state.encounter.pending).toBe(null);
    expect(r.state.encounter.continuity?.stage).toBe("awaiting");
  });

  it("次日胜利优先触发后续（占用一次额度、不发奖励路径预留）", () => {
    const s = startWellStory("well_a");
    const next = T0 + DAY;
    const r = fightNode(s, next, "map_qingyun", "node_wolf");
    expect(r.won).toBe(true);
    expect(r.state.encounter.pending?.eventId).toBe("event_well_down");
    expect(r.state.encounter.continuity?.stage).toBe("active");
    expect(r.encounterTriggered).toBe(true);
  });

  it("绕行分支走对后续事件", () => {
    const s = startWellStory("well_b");
    const r = fightNode(s, T0 + DAY, "map_qingyun", "node_wolf");
    expect(r.state.encounter.pending?.eventId).toBe("event_well_around");
  });

  it("后续选择纯叙事、不发奖励、记回响并清空挂起", () => {
    const s = fresh(T0);
    s.encounter.pending = { eventId: "event_well_down", mapId: "map_qingyun" };
    s.encounter.continuity = { storyId: "well", originOptionId: "well_a", originDate: d(T0 - DAY), stage: "active" };
    const before = structuredClone(s.resources);
    const r = resolveEncounter(s, T0, "well_down_a");
    expect(r.ok).toBe(true);
    const st = r.state as SaveState;
    expect(st.resources).toEqual(before);
    expect(st.encounter.pending).toBe(null);
    expect(st.encounter.continuity).toBe(null);
    expect(st.encounter.completedStories).toContain("well");
    const milestone = st.milestones.find((m) => m.type === "continuity");
    expect(milestone?.text).toContain("古井奇遇");
    expect(milestone?.text).toContain("探查井底");
    expect(milestone?.text).toContain("循线再探");
  });

  it("当日额度满则后续保留，不触发", () => {
    const s = fresh(T0);
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    s.encounter.continuity = { storyId: "well", originOptionId: "well_a", originDate: d(T0 - DAY), stage: "awaiting" };
    s.encounter.triggeredToday = CONFIG.encounter.dailyMax;
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    expect(r.won).toBe(true);
    expect(r.state.encounter.pending).toBe(null);
    expect(r.state.encounter.continuity?.stage).toBe("awaiting");
  });

  it("已完成的 story 再次出现同起源事件不重开", () => {
    const s = fresh(T0);
    s.encounter.completedStories = ["well"];
    s.encounter.pending = { eventId: "event_well", mapId: "map_qingyun" };
    const r = resolveEncounter(s, T0, "well_b");
    expect(r.ok).toBe(true);
    expect((r.state as SaveState).encounter.continuity).toBe(null);
    expect((r.state as SaveState).resources.cultivation).toBe(15); // well_b 奖励照发
  });

  it("配置覆盖 3 故事 × 2 原选择 × 2 结局 = 12 路径", () => {
    const stories = CONFIG.continuity.stories as unknown as Record<string, { originEventId: string; followUps: Record<string, string> }>;
    expect(stories).toEqual({
      well: { originEventId: "event_well", followUps: { well_a: "event_well_down", well_b: "event_well_around" } },
      beast: { originEventId: "event_beast", followUps: { beast_a: "event_beast_saved", beast_b: "event_beast_watch" } },
      cave: { originEventId: "event_cave", followUps: { cave_a: "event_cave_enter", cave_b: "event_cave_note" } },
    });
    const followUps = Object.values(stories).flatMap((s) => Object.values(s.followUps));
    expect(followUps.length).toBe(6);
    for (const eid of followUps) {
      const evt = (CONFIG.encounters as Record<string, { options: Record<string, unknown> }>)[eid];
      expect(evt).toBeTruthy();
      expect(Object.keys(evt.options).length).toBe(2);
    }
  });

  it("六条后续事件各两结局均可结算", () => {
    const map: Record<string, { storyId: StoryId; originOptionId: string }> = {
      event_well_down: { storyId: "well", originOptionId: "well_a" },
      event_well_around: { storyId: "well", originOptionId: "well_b" },
      event_beast_saved: { storyId: "beast", originOptionId: "beast_a" },
      event_beast_watch: { storyId: "beast", originOptionId: "beast_b" },
      event_cave_enter: { storyId: "cave", originOptionId: "cave_a" },
      event_cave_note: { storyId: "cave", originOptionId: "cave_b" },
    };
    for (const [eid, info] of Object.entries(map)) {
      for (const optId of Object.keys((CONFIG.encounters as Record<string, { options: Record<string, unknown> }>)[eid].options)) {
        const s = fresh(T0);
        s.encounter.pending = { eventId: eid, mapId: "map_qingyun" };
        s.encounter.continuity = { storyId: info.storyId, originOptionId: info.originOptionId, originDate: d(T0 - DAY), stage: "active" };
        const r = resolveEncounter(s, T0, optId);
        expect(r.ok).toBe(true);
        const st = r.state as SaveState;
        expect(st.encounter.completedStories).toContain(info.storyId);
        expect(st.encounter.continuity).toBe(null);
        expect(st.encounter.pending).toBe(null);
      }
    }
  });

  it("旧档迁移补 continuity/completedStories/lastBattle 默认值", () => {
    const s = fresh();
    s.schemaVersion = 16;
    (s as unknown as Record<string, unknown>).encounter = { pending: null, triggeredToday: 0, lastTriggerDate: d(T0), guideDone: true };
    delete (s as unknown as Record<string, unknown>).lastBattle;
    const m = migrateSave(s);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.encounter.continuity).toBe(null);
    expect(m.encounter.completedStories).toEqual([]);
    expect(m.lastBattle).toBe(null);
  });

  it("坏 continuity / lastBattle 档拒绝导入", () => {
    const good = fresh();
    const badCont = structuredClone(good) as unknown as Record<string, unknown>;
    (badCont.encounter as Record<string, unknown>).continuity = { storyId: "nope", originOptionId: "x", originDate: "bad", stage: "wrong" };
    expect(importSave(JSON.stringify(badCont)).ok).toBe(false);

    const badBattle = structuredClone(good) as unknown as Record<string, unknown>;
    badBattle.lastBattle = { won: "yes" };
    expect(importSave(JSON.stringify(badBattle)).ok).toBe(false);
  });
});

describe("v1.7 战斗反馈", () => {
  it("胜利战报：胜方、回合、奖励行正确", () => {
    const r = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    const lb = r.state.lastBattle!;
    expect(lb.won).toBe(true);
    expect(lb.kind).toBe("map");
    expect(lb.enemyName).toBe("野狼");
    expect(lb.rounds).toBeGreaterThan(0);
    expect(lb.rewardLines.length).toBeGreaterThan(0);
    expect(lb.roundLimitReached).toBe(false);
    expect(lb.player.hpAfter).toBeGreaterThan(0);
    expect(lb.enemy.hpAfter).toBe(0);
  });

  it("战败战报：未获得奖励", () => {
    const s = fresh();
    s.realm = "qi10";
    s.maps.map_nether.node_king.unlocked = true;
    const r = fightNode(s, T0, "map_nether", "node_king");
    expect(r.won).toBe(false);
    expect(r.state.lastBattle!.won).toBe(false);
    expect(r.state.lastBattle!.noRewardNote).toBe("未获得奖励");
  });

  it("守关 BOSS 挑战战报 maxRounds=12", () => {
    const s = fresh();
    s.realm = "qi3";
    for (const nid of ["node_wolf", "node_bandit", "node_demon"]) {
      s.maps.map_qingyun[nid].unlocked = true;
      s.maps.map_qingyun[nid].cleared = true;
    }
    s.encounter.guideDone = true;
    const r = fightNode(s, T0, "map_qingyun", "node_demon", "challenge");
    expect(r.ok).toBe(true);
    expect(r.state.lastBattle!.maxRounds).toBe(12);
    expect(typeof r.state.lastBattle!.roundLimitReached).toBe("boolean");
  });

  it("重复奖励用尽时标注「本次无重复奖励」", () => {
    const s = fresh();
    s.maps.map_qingyun.node_wolf.cleared = true;
    s.encounter.guideDone = true;
    s.daily.rewardedRepeats = CONFIG.rewardedRepeatBattlesPerDay;
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    expect(r.won).toBe(true);
    expect(r.state.lastBattle!.noRewardNote).toBe("本次无重复奖励");
  });

  it("秘境战报 kind=secret", () => {
    const s = fresh();
    s.realm = "zhuji1";
    const r = enterSecretRealm(s, T0, "realm_herb");
    expect(r.ok).toBe(true);
    expect(r.state!.lastBattle!.kind).toBe("secret");
    expect(r.state!.lastBattle!.difficulty).toBe("secret");
  });

  it("无词条时战报无关键事件", () => {
    const r = fightNode(fresh(), T0, "map_qingyun", "node_wolf");
    const lb = r.state.lastBattle!;
    expect(lb.keyEvents).toEqual([]);
    expect(lb.events.every((e) => !e.key)).toBe(true);
  });

  it("暴击真实触发才记入关键事件（100% 暴击率）", () => {
    const s = fresh();
    s.itemInstances["armor_test"] = { baseId: "a_cloth", affixes: [{ id: "critRate", value: 1 }] };
    s.inventory["armor_test"] = 1;
    s.equipment.armor = "armor_test";
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    const lb = r.state.lastBattle!;
    expect(lb.events.some((e) => e.kind === "crit")).toBe(true);
    expect(lb.keyEvents.some((k) => k.includes("暴击"))).toBe(true);
  });

  it("回血真实触发才记入关键事件", () => {
    const s = fresh();
    s.itemInstances["armor_test"] = { baseId: "a_cloth", affixes: [{ id: "regen", value: 5 }] };
    s.inventory["armor_test"] = 1;
    s.equipment.armor = "armor_test";
    const r = fightNode(s, T0, "map_qingyun", "node_wolf");
    const lb = r.state.lastBattle!;
    expect(lb.events.some((e) => e.kind === "regen")).toBe(true);
    expect(lb.keyEvents.some((k) => k.includes("回复"))).toBe(true);
  });
});
