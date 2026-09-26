"use client";

import Link from "next/link";
import { useGame } from "@/lib/game-context";
import { Section } from "@/components/Section";
import { computeChapter } from "@/engine/chapter";
import { fmtTime } from "@/lib/labels";

const GOAL_LINK: Record<string, string> = {
  jindan: "/xiulian",
  realm: "/lilian",
  craft: "/beibao",
};

const REVIEW_GROUPS = ["境界", "历练", "秘境", "制作"] as const;

export default function PianzhangPage() {
  const { state } = useGame();
  if (!state) return null;
  const chapter = computeChapter(state);

  return (
    <>
      <Section
        title="金丹篇章"
        action={
          <Link href="/renwu" className="text-sm text-cinnabar">
            返回
          </Link>
        }
      >
        <p className="text-sm">
          {chapter.name}（灵根：{chapter.spiritRoot} · 资质：{chapter.aptitudeName}）· {chapter.realmName}
        </p>
        <p className="mt-0.5 text-xs text-muted">本节为当前版本的篇章，非一生结局；回看后仍可继续修行、探索与炼器。</p>
      </Section>

      <Section title="篇章目标">
        {chapter.goals.map((g) => (
          <div key={g.id} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
            <div className="text-sm">
              {g.done ? <span className="text-gold">✓</span> : <span className="text-muted">○</span>} {g.title}
              <span className="ml-1 text-xs text-muted">{g.detail}</span>
            </div>
            {!g.done && (
              <Link href={GOAL_LINK[g.id]} className="shrink-0 text-xs text-cinnabar">
                去完成 →
              </Link>
            )}
          </div>
        ))}
      </Section>

      <Section title="阶段回顾">
        {REVIEW_GROUPS.map((grp) => {
          const items = chapter.review.filter((r) => r.group === grp);
          return (
            <div key={grp} className="mb-2 last:mb-0">
              <div className="text-xs text-muted">{grp}</div>
              {items.length === 0 ? (
                <p className="py-0.5 text-sm text-muted">此前记录未收录。</p>
              ) : (
                items.map((r, i) => (
                  <div key={i} className="flex items-baseline justify-between border-b border-line/50 py-1 last:border-0">
                    <span className="text-sm text-ink/85">{r.text}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted">
                      {r.time !== undefined ? fmtTime(r.time) : "此前记录未收录"}
                    </span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </Section>
    </>
  );
}
