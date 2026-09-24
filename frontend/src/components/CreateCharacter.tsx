"use client";

import { useState } from "react";
import { useGame } from "@/lib/game-context";
import { CONFIG } from "@/engine/config";
import type { SpiritRoot } from "@/engine/types";

export function CreateCharacter() {
  const { create } = useGame();
  const [name, setName] = useState("林青");
  const [root, setRoot] = useState<SpiritRoot>("金");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h1 className="text-center text-2xl font-semibold">青云修仙录</h1>
        <p className="mt-1 text-center text-sm text-muted">踏入仙途，从炼气一层到筑基</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-muted">道号</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={8}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <div>
            <span className="text-sm text-muted">五行灵根</span>
            <div className="mt-1 flex gap-2">
              {(CONFIG.spiritRoots as readonly string[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoot(r as SpiritRoot)}
                  className={`flex-1 rounded-lg border py-2 ${
                    root === r ? "border-cinnabar bg-[#f6e3de] text-cinnabar" : "border-line bg-paper"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => create(name.trim() || "无名修士", root)}
            className="w-full rounded-lg bg-cinnabar py-2.5 text-white"
          >
            踏入仙途
          </button>
        </div>
      </div>
    </div>
  );
}
