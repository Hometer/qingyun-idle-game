import { CONFIG } from "./config";
import type { SaveState, SecretRealmId } from "./types";

export interface ChapterGoal {
  id: "jindan" | "realm" | "craft";
  title: string;
  done: boolean;
  detail: string;
  link: "xiulian" | "lilian" | "beibao";
}

export interface ChapterReviewItem {
  group: "境界" | "历练" | "秘境" | "制作";
  text: string;
  time?: number;
}

export interface ChapterView {
  atJindan: boolean;
  name: string;
  realmName: string;
  spiritRoot: string;
  aptitudeName: string;
  goals: ChapterGoal[];
  review: ChapterReviewItem[];
}

const SECRET_REALM_CFG = CONFIG.secretRealms as unknown as Record<SecretRealmId, { name: string }>;
const APTITUDE_CFG = CONFIG.aptitudes as unknown as Record<string, { name: string }>;
const REALM_CFG = CONFIG.realms as unknown as Array<{ id: string; name: string }>;

const SECRET_REALM_IDS = Object.keys(SECRET_REALM_CFG) as SecretRealmId[];

function realmName(id: string): string {
  return REALM_CFG.find((r) => r.id === id)?.name ?? id;
}

/**
 * 金丹篇章计算：纯函数，从现有存档事实动态生成三组成果与阶段回顾。
 * 不写 state、不发奖励、不重置次数、不改里程碑。
 */
export function computeChapter(state: SaveState): ChapterView {
  const atJindan = REALM_CFG.findIndex((r) => r.id === state.realm) >=
    REALM_CFG.findIndex((r) => r.id === "jindan1");

  const realmSuccessCount = SECRET_REALM_IDS.filter((rid) =>
    state.secretRealmLog.some((l) => l.realm === rid && l.won),
  ).length;
  const realmTotal = SECRET_REALM_IDS.length;
  const hasCraft = state.milestones.some((m) => m.type === "craft");

  const goals: ChapterGoal[] = [
    {
      id: "jindan",
      title: "结丹",
      done: atJindan,
      detail: atJindan ? "已晋入金丹一层" : "尚未结丹（主线）",
      link: "xiulian",
    },
    {
      id: "realm",
      title: "三处秘境探索",
      done: realmSuccessCount === realmTotal,
      detail: `已成功 ${realmSuccessCount}/${realmTotal}`,
      link: "lilian",
    },
    {
      id: "craft",
      title: "炼制装备",
      done: hasCraft,
      detail: hasCraft ? "已炼制至少一件装备（支线）" : "尚未炼制（支线，可选）",
      link: "beibao",
    },
  ];

  const review: ChapterReviewItem[] = [];
  const push = (group: ChapterReviewItem["group"], text: string, time?: number) => {
    review.push(time !== undefined ? { group, text, time } : { group, text });
  };

  for (const m of state.milestones) {
    if (m.type === "breakthrough" || m.type === "tribulation" || m.type === "jindan") {
      push("境界", m.text, m.time);
    } else if (m.type === "firstClear") {
      push("历练", m.text, m.time);
    } else if (m.type === "forge" || m.type === "craft") {
      push("制作", m.text, m.time);
    }
  }
  for (const l of state.secretRealmLog) {
    if (l.won) push("秘境", `秘境「${SECRET_REALM_CFG[l.realm].name}」探索成功`, l.at);
  }

  return {
    atJindan,
    name: state.name,
    realmName: realmName(state.realm),
    spiritRoot: state.spiritRoot,
    aptitudeName: APTITUDE_CFG[state.aptitude]?.name ?? state.aptitude,
    goals,
    review,
  };
}
