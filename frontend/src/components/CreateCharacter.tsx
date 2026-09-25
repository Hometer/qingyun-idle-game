"use client";

import { useState } from "react";
import { useGame } from "@/lib/game-context";
import { CONFIG } from "@/engine/config";
import { getCopyMode, setCopyMode, type CopyMode } from "@/lib/prefs";
import type { SpiritRoot, AptitudeId } from "@/engine/types";

const NAME_A = ["青", "白", "玄", "云", "霜", "剑", "道", "尘", "月", "松", "清", "流"];
const NAME_B = ["尘", "云", "风", "霜", "月", "山", "川", "雪", "竹", "鹤", "松", "泉"];
const NAME_C = ["子", "真人", "散人", "道人", "居士", "上人", "客"];
const APTITUDE_ORDER: AptitudeId[] = ["balanced", "focus", "spirit"];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName(): string {
  return pick(NAME_A) + pick(NAME_B) + (Math.random() < 0.5 ? pick(NAME_C) : "");
}

export function CreateCharacter() {
  const { create } = useGame();
  const [name, setName] = useState("林青");
  const [root, setRoot] = useState<SpiritRoot>("金");
  const [copyMode, setCopyModeState] = useState<CopyMode>(getCopyMode());
  const [recommended] = useState<AptitudeId>(() => APTITUDE_ORDER[Math.floor(Math.random() * APTITUDE_ORDER.length)]);
  const [aptitude, setAptitude] = useState<AptitudeId>(recommended);

  const toggleCopy = (m: CopyMode) => {
    setCopyModeState(m);
    setCopyMode(m);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h1 className="text-center text-2xl font-semibold">青云修仙录</h1>
        <p className="mt-1 text-center text-sm text-muted">踏入仙途，从炼气一层到筑基</p>

        <div className="mt-4 rounded-lg border border-line/60 bg-paper p-3 text-xs text-ink/70 leading-relaxed">
          游戏进度保存在当前浏览器本地，清理浏览器数据或换设备会丢失，请定期导出存档。
          AI 际遇会把事件类型、道号或称呼、灵根、境界、地图、最近两条修行摘要及选项含义发送给国内模型服务，
          完整存档不会发送；选择“仅用模板”则不发任何模型请求。
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-sm text-muted">际遇文案</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => toggleCopy("ai")}
                className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "ai" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
              >
                AI 文案
              </button>
              <button
                onClick={() => toggleCopy("template")}
                className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "template" ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
              >
                仅用模板
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-muted">道号</span>
            <div className="mt-1 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={8}
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-2"
              />
              <button onClick={() => setName(randomName())} className="rounded-lg border border-line bg-paper px-3 text-sm">
                随机
              </button>
            </div>
          </label>

          <div>
            <span className="text-sm text-muted">五行灵根</span>
            <div className="mt-1 flex gap-2">
              {(CONFIG.spiritRoots as readonly string[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoot(r as SpiritRoot)}
                  className={`flex-1 rounded-lg border py-2 ${root === r ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm text-muted">修行资质（可自行选择，创建后固定）</span>
            <div className="mt-1 flex flex-col gap-2">
              {APTITUDE_ORDER.map((a) => {
                const cfg = CONFIG.aptitudes[a];
                return (
                  <button
                    key={a}
                    onClick={() => setAptitude(a)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${aptitude === a ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"}`}
                  >
                    <span className="font-medium">{cfg.name}</span>
                    <span className="ml-2 text-xs text-muted">修为 ×{cfg.cultivationMult}、灵气 ×{cfg.spiritMult}</span>
                    {recommended === a && <span className="ml-2 text-xs text-cinnabar">推荐</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">凝神修炼更快但灵气稍慢，聚灵反之，均衡二者持平；五行灵根不影响资质。</p>
          </div>

          <button
            onClick={() => create(name.trim() || "无名修士", root, aptitude)}
            className="w-full rounded-lg bg-cinnabar py-2.5 text-white"
          >
            踏入仙途
          </button>
        </div>
      </div>
    </div>
  );
}
