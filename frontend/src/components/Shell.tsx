"use client";

import { useGame } from "@/lib/game-context";
import { BottomNav } from "./BottomNav";
import { ResourceBar } from "./ResourceBar";
import { EncounterModal } from "./EncounterModal";
import { CreateCharacter } from "./CreateCharacter";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, state, notice, clearNotice } = useGame();

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted">载入中…</div>;
  }
  if (!state) {
    return <CreateCharacter />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col pb-16">
      <ResourceBar />
      {notice && (
        <div className="relative mx-3 mt-2 rounded-lg border border-gold/40 bg-[#fdeeca] px-4 py-2 text-sm">
          {notice}
          <button onClick={clearNotice} className="absolute right-2 top-1 text-muted">
            ×
          </button>
        </div>
      )}
      <main className="flex-1 px-3 pb-4">{children}</main>
      <EncounterModal />
      <BottomNav />
    </div>
  );
}
