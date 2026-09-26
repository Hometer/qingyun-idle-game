import { describe, expect, it } from "vitest";
import { createGame, enterSecretRealm, exportSave, importSave } from "./engine";
import { computeChapter } from "./chapter";
import type { SaveState } from "./types";

const T0 = 1_700_000_000_000;

function fresh(): SaveState {
  const s = createGame("林青", "金", "balanced", T0);
  s.daily.weather = { id: "none", used: false };
  s.daily.astrology = { id: "none", used: false };
  s.daily.goals = { battle: { progress: 0, claimed: false }, suppress: { progress: 0, claimed: false } };
  return s;
}

describe("v1.1 金丹篇章计算", () => {
  it("未结丹：三组成果均未完成，回顾为空", () => {
    const v = computeChapter(fresh());
    expect(v.atJindan).toBe(false);
    expect(v.name).toBe("林青");
    expect(v.goals.find((g) => g.id === "jindan")!.done).toBe(false);
    expect(v.goals.find((g) => g.id === "realm")!.done).toBe(false);
    expect(v.goals.find((g) => g.id === "craft")!.done).toBe(false);
    expect(v.review).toHaveLength(0);
  });

  it("金丹一层：结丹成果完成", () => {
    const s = fresh();
    s.realm = "jindan1";
    const v = computeChapter(s);
    expect(v.atJindan).toBe(true);
    expect(v.goals.find((g) => g.id === "jindan")!.done).toBe(true);
  });

  it("秘境成功计入成果与回顾，未成功不计", () => {
    const s = fresh();
    s.realm = "foundation1";
    s.equipment = { weapon: "w_azure", armor: "a_iron", accessory: "c_jade" };
    s.technique = "poYue";
    s.techniqueLevel.poYue = 3;
    const r = enterSecretRealm(s, T0, "realm_herb");
    const v = computeChapter(r.state as SaveState);
    expect(v.goals.find((g) => g.id === "realm")!.detail).toContain("1/3");
    expect(v.review.filter((x) => x.group === "秘境")).toHaveLength(1);
  });

  it("炼制里程碑计入成果与回顾", () => {
    const s = fresh();
    s.milestones.push({ type: "craft", time: T0, text: "炼得精钢剑" });
    const v = computeChapter(s);
    expect(v.goals.find((g) => g.id === "craft")!.done).toBe(true);
    expect(v.review.filter((x) => x.group === "制作")).toHaveLength(1);
  });

  it("回顾按分组归纳既有记录", () => {
    const s = fresh();
    s.milestones.push({ type: "breakthrough", time: T0, text: "稳妥进阶，晋入炼气二层" });
    s.milestones.push({ type: "firstClear", time: T0 + 1, text: "首通青云山·野狼" });
    const v = computeChapter(s);
    expect(v.review.find((x) => x.group === "境界")!.text).toContain("炼气二层");
    expect(v.review.find((x) => x.group === "历练")!.text).toContain("野狼");
  });

  it("纯函数：不改写 state，导出导入后结果一致", () => {
    const s = fresh();
    s.milestones.push({ type: "firstClear", time: T0, text: "首通青云山·野狼" });
    const before = JSON.stringify(s);
    const v1 = computeChapter(s);
    expect(JSON.stringify(s)).toBe(before);
    const imported = importSave(exportSave(s));
    expect(imported.ok).toBe(true);
    expect(computeChapter(imported.state as SaveState).review).toEqual(v1.review);
  });
});
