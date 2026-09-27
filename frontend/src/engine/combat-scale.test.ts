import { describe, expect, it } from "vitest";
import { CONFIG, combatScaleForStage, scaleCombatStats } from "./config";
import { createGame, enterSecretRealm, exportSave, importSave, playerStats, predictSecretRealm } from "./engine";
import type { RealmId, SecretRealmId } from "./types";

const NOW = 1_700_000_000_000;

type HighRealmId = Extract<SecretRealmId, "realm_cloud" | "realm_lotus" | "realm_origin" | "realm_hongmeng">;
const highRealms: Array<{ id: HighRealmId; gate: RealmId; tier: string; accessory: string }> = [
  { id: "realm_cloud", gate: "dacheng4", tier: "dacheng", accessory: "c_wendao" },
  { id: "realm_lotus", gate: "jinxian4", tier: "jinxian", accessory: "c_buxiu" },
  { id: "realm_origin", gate: "hunyuan_daluo4", tier: "hunyuan", accessory: "c_guiyuan" },
  { id: "realm_hongmeng", gate: "hongmeng4", tier: "dadao", accessory: "c_taichu" },
];

describe("后期战斗数值", () => {
  it("新手数值不变，敌我同境使用相同倍率，最高境进入万级气血", () => {
    expect(combatScaleForStage(1)).toBe(1);
    expect(combatScaleForStage(3)).toBe(1);
    expect(playerStats(createGame("新手", "金", "balanced", NOW))).toEqual({ attack: 15, defense: 5, hp: 100 });
    for (const { id, gate } of highRealms) {
      const stage = CONFIG.realms.find((realm) => realm.id === gate)!.stage;
      const unscaled = {
        realm_cloud: { attack: 90, defense: 45, hp: 720 },
        realm_lotus: { attack: 116, defense: 58, hp: 980 },
        realm_origin: { attack: 145, defense: 73, hp: 1250 },
        realm_hongmeng: { attack: 175, defense: 90, hp: 1500 },
      }[id];
      expect(CONFIG.secretRealms[id].enemy).toEqual(scaleCombatStats(unscaled, stage));
    }
    expect(CONFIG.secretRealms.realm_hongmeng.enemy.hp).toBeGreaterThan(60_000);
    expect(CONFIG.maps.map_hongmeng.nodes.node_5.enemy.hp).toBeGreaterThan(30_000);
  });

  it("四处高阶秘境在同档装备下可胜，裸装难胜，预览和结算一致", () => {
    for (const { id, gate, tier, accessory } of highRealms) {
      const s = createGame("校准", "金", "balanced", NOW);
      s.realm = gate;
      expect(predictSecretRealm(s, id).won, `${id} 裸装`).toBe(false);
      s.equipment = { weapon: `w_${tier}`, armor: `a_${tier}`, accessory };
      s.inventory[`w_${tier}`] = 1;
      s.inventory[`a_${tier}`] = 1;
      s.inventory[accessory] = 1;
      const prediction = predictSecretRealm(s, id);
      expect(prediction.ok).toBe(true);
      expect(prediction.won, `${id} 同档装备`).toBe(true);
      const actual = enterSecretRealm(s, NOW, id);
      expect(actual.ok).toBe(true);
      expect(actual.state!.secretRealmLog.at(-1)?.won).toBe(prediction.won);
      const restored = importSave(exportSave(actual.state!));
      expect(restored.ok).toBe(true);
      expect(restored.state!.secretRealmLog.at(-1)?.won).toBe(true);
    }
  });
});
