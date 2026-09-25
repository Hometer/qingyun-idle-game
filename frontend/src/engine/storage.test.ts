import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";
import { loadSave, persistSave, replaceSave, backupSave, loadBackup, clearSave } from "./storage";
import { createGame, settle } from "./engine";
import type { SaveState } from "./types";

const T0 = 1_700_000_000_000;

function fresh(nowMs = T0): SaveState {
  return createGame("林青", "金", nowMs);
}

// 每个用例使用全新的 IndexedDB 实例，避免跨用例状态污染。
beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe("存档存储并发", () => {
  it("新建后读取代次与修订号一致", async () => {
    const s0 = fresh();
    const w = await persistSave(s0, 0, 0);
    expect(w.conflict).toBe(false);
    const loaded = await loadSave();
    expect(loaded.state?.revision).toBe(0);
    expect(loaded.generation).toBe(0);
  });

  it("双标签修改：冲突后以库中真实修订号重建基准，可再次成功写入", async () => {
    const s0 = fresh();
    await persistSave(s0, 0, 0);

    // 标签 A 与 B 都读到修订 0
    const a = await loadSave();
    const b = await loadSave();
    expect(a.state?.revision).toBe(0);
    expect(b.state?.revision).toBe(0);

    // 标签 B 先写入修订 1
    const s1 = settle(b.state!, T0 + 1000);
    const rB = await persistSave(s1, 0, 0);
    expect(rB.conflict).toBe(false);

    // 标签 A 仍持旧基准 0，写入失败
    const s2 = settle(a.state!, T0 + 2000);
    const rA = await persistSave(s2, 0, 0);
    expect(rA.conflict).toBe(true);

    // 标签 A 冲突后重读库中真实修订号（1）作为基准，再次写入成功
    const latest = await loadSave();
    expect(latest.state?.revision).toBe(1);
    const s3 = settle(latest.state!, T0 + 3000);
    const rA2 = await persistSave(s3, latest.state!.revision, 0);
    expect(rA2.conflict).toBe(false);

    const after = await loadSave();
    expect(after.state?.revision).toBe(2);
  });

  it("重置后旧标签页不能复活旧档", async () => {
    const s0 = fresh();
    await persistSave(s0, 0, 0);

    const a = await loadSave();
    expect(a.generation).toBe(0);

    // 标签 B 重置，代次递增到 1
    const gen = await clearSave();
    expect(gen).toBe(1);
    const afterReset = await loadSave();
    expect(afterReset.state).toBe(null);
    expect(afterReset.generation).toBe(1);

    // 标签 A（仍持代次 0）尝试写回旧档，因代次不匹配被拒
    const r = await persistSave(settle(a.state!, T0 + 1000), a.state!.revision, 0);
    expect(r.conflict).toBe(true);

    const cur = await loadSave();
    expect(cur.state).toBe(null);
  });

  it("整体替换递增代次，旧标签页写入被拒", async () => {
    const s0 = fresh();
    await persistSave(s0, 0, 0);
    const a = await loadSave(); // 代次 0

    const sNew = fresh(T0 + 5000);
    const rep = await replaceSave(sNew, 0);
    expect(rep.ok).toBe(true);
    expect(rep.generation).toBe(1);

    // 旧标签（代次 0）写入被拒
    const r = await persistSave(settle(a.state!, T0 + 1000), a.state!.revision, 0);
    expect(r.conflict).toBe(true);
  });

  it("代次不匹配时整体替换被拒", async () => {
    const s0 = fresh();
    await persistSave(s0, 0, 0);
    // 另一页已重置，代次变为 1；本页仍以代次 0 整体替换
    await clearSave();
    const rep = await replaceSave(fresh(), 0);
    expect(rep.ok).toBe(false);
    expect(rep.conflict).toBe(true);
  });

  it("备份可写可读，不影响当前档", async () => {
    const s0 = fresh();
    await persistSave(s0, 0, 0);
    await backupSave(settle(s0, T0 + 1000));
    const backup = await loadBackup();
    expect(backup?.revision).toBe(1);
    const cur = await loadSave();
    expect(cur.state?.revision).toBe(0);
  });
});
