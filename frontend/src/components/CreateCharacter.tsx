"use client";

import { useState } from "react";
import { useGame } from "@/lib/game-context";
import { CONFIG } from "@/engine/config";
import { randomFortune, type Fortune } from "@/engine/engine";
import { getCopyMode, setCopyMode, type CopyMode } from "@/lib/prefs";
import type { AptitudeId } from "@/engine/types";

const NAME_A = ["青", "白", "玄", "云", "霜", "剑", "道", "尘", "月", "松", "清", "流"];
const NAME_B = ["尘", "云", "风", "霜", "月", "山", "川", "雪", "竹", "鹤", "松", "泉"];
const NAME_C = ["子", "真人", "散人", "道人", "居士", "上人", "客"];
const APTITUDE_ORDER: AptitudeId[] = ["balanced", "focus", "spirit"];
const MERIDIAN_ORDER = ["blocked", "sluggish", "normal", "smooth", "innate"];
const COMPREHENSION_ORDER = ["dull", "slow", "normal", "clever", "genius"];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomName(): string {
  return pick(NAME_A) + pick(NAME_B) + (Math.random() < 0.5 ? pick(NAME_C) : "");
}

const MERIDIAN_CFG = CONFIG.meridians as unknown as Record<string, { name: string; probability: number; productionMult: number }>;
const COMPREHENSION_CFG = CONFIG.comprehensions as unknown as Record<string, { name: string; probability: number; pageMult: number }>;
const ELEMENTS = ["金", "木", "水", "火", "土"];
const VARIANTS = ["雷", "冰", "风"];

export function CreateCharacter() {
  const { createWithFortune } = useGame();
  const [name, setName] = useState("林青");
  const [copyMode, setCopyModeState] = useState<CopyMode>(getCopyMode());
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [fortune, setFortune] = useState<Fortune>(() => randomFortune());
  const [aptitude, setAptitude] = useState<AptitudeId>("balanced");
  const [meridian, setMeridian] = useState("normal");
  const [comprehension, setComprehension] = useState("normal");
  const [roots, setRoots] = useState<string[]>(["金"]);

  const toggleElement = (el: string) => {
    setRoots((prev) => {
      if (prev.some((r) => VARIANTS.includes(r))) return [el]; // 从变异切到五行
      if (prev.includes(el)) {
        const next = prev.filter((r) => r !== el);
        return next.length ? next : [el];
      }
      return [...prev, el];
    });
  };

  const toggleCopy = (m: CopyMode) => {
    setCopyModeState(m);
    setCopyMode(m);
  };

  const reroll = () => setFortune(randomFortune());

  const finalFortune: Fortune =
    mode === "random" ? fortune : { spiritRoots: roots, meridians: meridian as Fortune["meridians"], comprehension: comprehension as Fortune["comprehension"] };

  const m = MERIDIAN_CFG[finalFortune.meridians];
  const mult = m.productionMult * (CONFIG.aptitudes[aptitude] as unknown as { cultivationMult: number }).cultivationMult;

  return (
    <div className="creation-screen flex min-h-screen items-center justify-center px-4 py-5 sm:py-8">
      <div className="creation-card grid w-full max-w-[1060px] overflow-hidden border border-line bg-card lg:grid-cols-[.82fr_1fr]">
        <div className="creation-cover realm-hero relative flex min-h-[270px] flex-col justify-between overflow-hidden p-7 text-[#f9f2e4] sm:p-9 lg:min-h-[700px]">
          <div className="hero-frame pointer-events-none absolute inset-[9px]" aria-hidden="true" />
          <div className="relative">
            <div className="brand-seal mb-7 flex h-14 w-14 items-center justify-center text-2xl">青</div>
            <p className="text-[11px] tracking-[.28em] text-[#d6c18e]">壹 · 初入仙途</p>
            <h1 className="display-font mt-3 text-4xl font-semibold tracking-[.14em] sm:text-[48px]">青云修仙录</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#d9e3d9]">一念入山门，万里皆仙途。</p>
          </div>
          <div className="relative hidden border-t border-[#d7bd87]/35 pt-6 text-sm leading-8 text-[#e3ddc8] lg:block">云起青山，路入仙门。<br />命盘既定，前途由你亲手开辟。</div>
        </div>
        <div className="creation-form p-5 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[.24em] text-gold">命盘 · 第一卷</p>
        <h2 className="display-font mt-1 text-[25px] font-semibold tracking-wide">定下你的命盘</h2>
        <p className="mt-1 text-sm text-muted">选好道号与修行资质，即可踏入仙途。</p>

        <div className="mt-4 rounded-lg border border-line/60 bg-paper p-3 text-xs text-ink/70 leading-relaxed">
          游戏进度保存在当前浏览器本地，清理浏览器数据或换设备会丢失，请定期导出存档。
          AI 际遇会把事件类型、道号或称呼、灵根、境界、地图、最近两条修行摘要及选项含义发送给国内模型服务，
          完整存档不会发送；选择“仅用模板”则不发任何模型请求。
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-sm text-muted">际遇文案</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => toggleCopy("ai")} className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "ai" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>AI 文案</button>
              <button onClick={() => toggleCopy("template")} className={`flex-1 rounded-lg border py-2 text-sm ${copyMode === "template" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>仅用模板</button>
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-muted">道号</span>
            <div className="mt-1 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={8} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2" />
              <button onClick={() => setName(randomName())} className="rounded-lg border border-line bg-paper px-3 text-sm">随机</button>
            </div>
          </label>

          <div>
            <span className="text-sm text-muted">开局方式</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setMode("random")} className={`flex-1 rounded-lg border py-2 text-sm ${mode === "random" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>随机鉴灵</button>
              <button onClick={() => setMode("custom")} className={`flex-1 rounded-lg border py-2 text-sm ${mode === "custom" ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>自行设定</button>
            </div>
          </div>

          {mode === "random" ? (
            <div className="rounded-lg border border-line/60 bg-paper p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">命盘</span>
                <button onClick={reroll} className="rounded-lg border border-line bg-paper px-3 py-1 text-xs">重新鉴灵</button>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <p>灵根：{fortune.spiritRoots.join("、")}（{fortune.spiritRoots.length === 1 && ["雷", "冰", "风"].includes(fortune.spiritRoots[0]) ? "变异" : `${fortune.spiritRoots.length}灵根`}）</p>
                <p>经脉：{MERIDIAN_CFG[fortune.meridians].name}（产速 ×{MERIDIAN_CFG[fortune.meridians].productionMult}）</p>
                <p>悟性：{COMPREHENSION_CFG[fortune.comprehension].name}（功法费用 ×{COMPREHENSION_CFG[fortune.comprehension].pageMult}）</p>
                <p className="text-xs text-muted">概率：变异灵根 5%；五灵根 12%、四 18%、三 30%、二 25%、一 10%。功法精进按「基础残页 × 悟性费用倍率」实扣，通明档（×0.94）比平常档更省。</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span className="text-sm text-muted">灵根（可多选五行，或单选变异）</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ELEMENTS.map((el) => (
                    <button key={el} onClick={() => toggleElement(el)} className={`rounded-lg border px-3 py-1.5 text-sm ${roots.includes(el) ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                      {el}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {VARIANTS.map((v) => (
                    <button key={v} onClick={() => setRoots([v])} className={`rounded-lg border px-3 py-1.5 text-sm ${roots.length === 1 && roots[0] === v ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                      {v}（变异）
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">当前灵根：{roots.join("、")}（{roots.length === 1 && VARIANTS.includes(roots[0]) ? "变异" : `${roots.length}灵根`}）</p>
              </div>
              <div>
                <span className="text-sm text-muted">经脉（定修炼产速）</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {MERIDIAN_ORDER.map((id) => (
                    <button key={id} onClick={() => setMeridian(id)} className={`rounded-lg border px-3 py-1.5 text-sm ${meridian === id ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                      {MERIDIAN_CFG[id].name} ×{MERIDIAN_CFG[id].productionMult}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm text-muted">悟性（定功法费用）</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {COMPREHENSION_ORDER.map((id) => (
                    <button key={id} onClick={() => setComprehension(id)} className={`rounded-lg border px-3 py-1.5 text-sm ${comprehension === id ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                      {COMPREHENSION_CFG[id].name} ×{COMPREHENSION_CFG[id].pageMult}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <span className="text-sm text-muted">修炼侧重（创建后可在洞府切换）</span>
            <div className="mt-1 flex flex-col gap-2">
              {APTITUDE_ORDER.map((a) => {
                const cfg = CONFIG.aptitudes[a];
                return (
                  <button key={a} onClick={() => setAptitude(a)} className={`rounded-lg border px-3 py-2 text-left text-sm ${aptitude === a ? "border-cinnabar bg-cinnabar/10 text-cinnabar" : "border-line bg-paper"}`}>
                    <span className="font-medium">{cfg.name}</span>
                    <span className="ml-2 text-xs text-muted">修为 ×{cfg.cultivationMult}、灵气 ×{cfg.spiritMult}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted">当前修为产速约 {mult.toFixed(2)}×（基础 × 经脉 × 侧重）。</p>

          <button
            onClick={() => createWithFortune(name.trim() || "无名修士", finalFortune, aptitude)}
            className="w-full rounded-lg bg-cinnabar py-2.5 text-white"
          >
            踏入仙途
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
