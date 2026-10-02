import type { Commission } from "@/engine/types";

export function commissionTarget(c: Commission): { href: string; label: string } {
  if (c.kind === "battle") return {
    href: `/lilian?map=${encodeURIComponent(c.mapId ?? "")}&node=${encodeURIComponent(c.nodeId ?? "")}&difficulty=${c.difficulty ?? "challenge"}`,
    label: `前往目标备战 · ${c.difficulty === "normal" ? "普通" : "挑战"}`,
  };
  const hash = (route: string, id: string) => `${route}#${encodeURIComponent(`commission-${id}`)}`;
  switch (c.action) {
    case "upgradeBuilding": return { href: hash("/dongfu", c.actionParam ?? ""), label: "前往目标建筑升级" };
    case "buildLibrary": return { href: hash("/dongfu", "library"), label: "前往藏经阁" };
    case "buildForge": return { href: hash("/dongfu", "forge"), label: "前往炼器台" };
    case "upgradeTechnique": return { href: hash("/xiulian", "technique"), label: "前往主修功法升级" };
    case "craftEquipment": return { href: hash("/beibao", `craft-${c.actionParam}`), label: "前往目标装备配方" };
    case "craftPill": return { href: hash("/beibao", `pill-${c.actionParam}`), label: "前往目标护劫丹配方" };
    case "useGainPill": return { href: hash("/beibao", `gain-${c.actionParam}`), label: "前往目标收益丹服用" };
    default: return { href: hash("/xiulian", "settle"), label: "前往领取收益" };
  }
}
