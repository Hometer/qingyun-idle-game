/**
 * 首轮试玩基线配置（可调）。所有数值展示与计算共用本表，改这里即改规则。
 * 体验目标：首次筑基 45～75 分钟（PRD 7.1 调参基线，非硬指标）。
 */

export const CONFIG = {
  baseCultivationPerSecond: 1,
  baseSpiritPerSecond: 0.25,
  offlineCapHours: 12,

  baseAttack: 10,
  baseDefense: 5,
  baseHp: 100,

  realms: [
    { id: "qi1", name: "炼气一层", cultivationCost: 0, spiritCost: 0, attack: 0, defense: 0, hp: 0 },
    { id: "qi2", name: "炼气二层", cultivationCost: 120, spiritCost: 20, attack: 0, defense: 0, hp: 0 },
    { id: "qi3", name: "炼气三层", cultivationCost: 300, spiritCost: 50, attack: 0, defense: 0, hp: 0 },
    { id: "qi4", name: "炼气圆满", cultivationCost: 700, spiritCost: 100, attack: 0, defense: 0, hp: 0 },
    { id: "foundation1", name: "筑基一层", cultivationCost: 1500, spiritCost: 200, attack: 0, defense: 0, hp: 0 },
    { id: "foundation2", name: "筑基二层", cultivationCost: 3000, spiritCost: 400, attack: 3, defense: 2, hp: 20 },
    { id: "foundation3", name: "筑基圆满", cultivationCost: 6000, spiritCost: 800, attack: 6, defense: 4, hp: 40 },
    { id: "jindan1", name: "金丹一层", cultivationCost: 12000, spiritCost: 1600, attack: 10, defense: 7, hp: 60 },
  ] as const,

  spiritRoots: ["金", "木", "水", "火", "土"] as const,

  buildings: {
    cultivationRoom: {
      name: "修炼室",
      levels: [
        { cost: 100, cultivationMult: 1.2 },
        { cost: 300, cultivationMult: 1.5 },
        { cost: 600, cultivationMult: 2.0 },
      ],
    },
    spiritArray: {
      name: "聚灵阵",
      levels: [
        { cost: 100, spiritMult: 1.2 },
        { cost: 300, spiritMult: 1.5 },
        { cost: 600, spiritMult: 2.0 },
      ],
    },
    spiritField: {
      name: "灵田",
      levels: [
        { cost: 150, herbPerSec: 0.05 },
        { cost: 400, herbPerSec: 0.1 },
        { cost: 800, herbPerSec: 0.2 },
      ],
    },
    alchemyFurnace: {
      name: "炼丹炉",
      levels: [
        { cost: 200, pillHerbCost: 50, pillStoneCost: 100 },
        { cost: 500, pillHerbCost: 40, pillStoneCost: 80 },
        { cost: 1000, pillHerbCost: 30, pillStoneCost: 60 },
      ],
    },
  } as const,

  techniques: {
    qingYun: {
      name: "青云诀",
      levels: [
        { pageCost: 0, cultivationMult: 1.3, auxCultivationMult: 1.15 },
        { pageCost: 5, cultivationMult: 1.6, auxCultivationMult: 1.3 },
        { pageCost: 15, cultivationMult: 2.0, auxCultivationMult: 1.5 },
      ],
    },
    xuanGui: {
      name: "玄龟诀",
      levels: [
        { pageCost: 0, tribulationReduction: 0.05, auxTribulationReduction: 0.025 },
        { pageCost: 5, tribulationReduction: 0.1, auxTribulationReduction: 0.05 },
        { pageCost: 15, tribulationReduction: 0.15, auxTribulationReduction: 0.075 },
      ],
    },
    poYue: {
      name: "破岳诀",
      levels: [
        { pageCost: 0, attack: 4, auxAttack: 2 },
        { pageCost: 5, attack: 8, auxAttack: 4 },
        { pageCost: 15, attack: 12, auxAttack: 6 },
      ],
    },
    juYuan: {
      name: "聚元诀",
      levels: [
        { pageCost: 0, spiritMult: 1.15, auxSpiritMult: 1.075 },
        { pageCost: 5, spiritMult: 1.3, auxSpiritMult: 1.15 },
        { pageCost: 15, spiritMult: 1.5, auxSpiritMult: 1.25 },
      ],
    },
  } as const,

  library: {
    levels: [
      { cost: { spiritStone: 800, page: 10 } },
      { cost: { spiritStone: 1600, page: 20 } },
    ],
  } as const,

  secretRealms: {
    realm_herb: {
      name: "灵药谷", gate: "foundation1",
      enemy: { attack: 25, defense: 16, hp: 200 },
      reward: { herb: 30, spiritStone: 100 },
    },
    realm_relic: {
      name: "古修遗迹", gate: "foundation2",
      enemy: { attack: 28, defense: 18, hp: 240 },
      reward: { page: 8, spiritStone: 200 },
    },
    realm_deep: {
      name: "幽窟险境", gate: "foundation3",
      enemy: { attack: 32, defense: 21, hp: 300 },
      reward: { spiritStone: 500, herb: 50 },
    },
  } as const,

  forge: {
    cost: { spiritStone: 1000, page: 15 },
  } as const,

  iron: {
    suppressionPerSec: 0.02,
    realmDrop: { realm_herb: 2, realm_relic: 3, realm_deep: 5 },
  } as const,

  crafts: {
    w_steel: { cost: { iron: 8, spiritStone: 800, herb: 0 } },
    a_steel: { cost: { iron: 12, spiritStone: 1200, herb: 30 } },
  } as const,

  equipment: {
    w_bronze: { name: "青铜剑", slot: "weapon", attack: 5 },
    w_azure: { name: "青锋剑", slot: "weapon", attack: 15 },
    a_cloth: { name: "粗布衣", slot: "armor", defense: 3 },
    a_iron: { name: "玄铁甲", slot: "armor", defense: 10, tribulationReduction: 0.05 },
    c_wood: { name: "木牌", slot: "accessory", hp: 20 },
    c_jade: { name: "玉佩", slot: "accessory", hp: 60, tribulationReduction: 0.05 },
    w_steel: { name: "精钢剑", slot: "weapon", attack: 20 },
    a_steel: { name: "玄铁甲", slot: "armor", defense: 15, tribulationReduction: 0.05 },
  } as const,

  initialEquipment: "w_bronze" as const,

  maps: {
    map_qingyun: {
      name: "青云山",
      nodes: {
        node_wolf: {
          name: "野狼", gate: "qi1",
          enemy: { attack: 8, defense: 2, hp: 30 },
          firstClear: { cultivation: 20, spiritStone: 50, page: 5, equipment: "a_cloth" },
          repeat: { cultivation: 4, page: 1 },
          suppressRate: 0.1,
        },
        node_bandit: {
          name: "山匪", gate: "qi2",
          enemy: { attack: 12, defense: 5, hp: 50 },
          firstClear: { cultivation: 40, spiritStone: 100, page: 0, equipment: "w_azure" },
          repeat: { cultivation: 8, page: 2 },
          suppressRate: 0.2,
        },
        node_demon: {
          name: "妖兽", gate: "qi3",
          enemy: { attack: 18, defense: 8, hp: 80 },
          firstClear: { cultivation: 80, spiritStone: 200, page: 0, equipment: "c_wood" },
          repeat: { cultivation: 16, page: 3 },
          suppressRate: 0.3,
        },
      },
    },
    map_nether: {
      name: "幽冥谷",
      nodes: {
        node_shade: {
          name: "阴魂", gate: "qi3",
          enemy: { attack: 16, defense: 10, hp: 90 },
          firstClear: { cultivation: 150, spiritStone: 300, page: 15, equipment: "a_iron" },
          repeat: { cultivation: 30, page: 5 },
          suppressRate: 0.4,
        },
        node_ghost: {
          name: "厉鬼", gate: "qi4",
          enemy: { attack: 21, defense: 13, hp: 150 },
          firstClear: { cultivation: 300, spiritStone: 500, page: 0, equipment: "c_jade" },
          repeat: { cultivation: 60, page: 8 },
          suppressRate: 0.6,
        },
        node_king: {
          name: "鬼王", gate: "qi4",
          enemy: { attack: 22, defense: 14, hp: 190 },
          firstClear: { cultivation: 500, spiritStone: 800, page: 30, equipment: null },
          repeat: { cultivation: 100, page: 12 },
          suppressRate: 1.0,
        },
      },
    },
    map_yunling: {
      name: "云岭古道",
      nodes: {
        node_ape: {
          name: "断崖山魈", gate: "foundation1",
          enemy: { attack: 23, defense: 15, hp: 160 },
          firstClear: { cultivation: 300, spiritStone: 150, page: 0, equipment: null },
          repeat: { cultivation: 80, page: 0 },
          suppressRate: 0.8,
        },
        node_golem: {
          name: "古道石傀", gate: "foundation2",
          enemy: { attack: 25, defense: 17, hp: 200 },
          firstClear: { cultivation: 600, spiritStone: 250, page: 0, equipment: null },
          repeat: { cultivation: 120, page: 0 },
          suppressRate: 1.0,
        },
        node_guardian: {
          name: "护丹灵", gate: "foundation3",
          enemy: { attack: 27, defense: 19, hp: 240 },
          firstClear: { cultivation: 900, spiritStone: 400, page: 0, equipment: null },
          repeat: { cultivation: 180, page: 0 },
          suppressRate: 1.2,
        },
      },
    },
  } as const,

  encounters: {
    event_well: {
      title: "古井奇遇",
      options: {
        well_a: { label: "探查井底", meaning: "冒险下井一探", result: "你缘索下井，于井底见旧刻残文，若有所悟。", reward: { spiritStone: 30, herb: 5 } },
        well_b: { label: "绕行而去", meaning: "不理会，绕路离开", result: "你绕井而行，心境渐澄，修行略有精进。", reward: { cultivation: 15 } },
      },
    },
    event_beast: {
      title: "灵兽现踪",
      options: {
        beast_a: { label: "出手相救", meaning: "救下被困的幼鹿", result: "你救下幼鹿，灵鹿衔来几页残卷相谢。", reward: { page: 3 } },
        beast_b: { label: "静观其变", meaning: "不插手，远远观察", result: "你静观其变，待灵兽自去，拾得几块遗落灵石。", reward: { spiritStone: 20 } },
      },
    },
    event_cave: {
      title: "残破洞府",
      options: {
        cave_a: { label: "推门而入", meaning: "进入洞府查探", result: "你推门而入，于洞中得见前人札记，略有所得。", reward: { cultivation: 30, page: 2 } },
        cave_b: { label: "记下位置", meaning: "记下位置，日后再来", result: "你记下方位，先在洞外采得几株灵草。", reward: { herb: 8 } },
      },
    },
  } as const,

  encounter: {
    probability: 0.2,
    dailyMax: 3,
    guideEventId: "event_well",
    guideMapId: "map_qingyun",
    guideNodeId: "node_wolf",
  },

  tribulation: {
    wavesPct: [0.2, 0.25, 0.3, 0.35, 0.4],
    reductionCap: 0.4,
    pillHealPct: 0.3,
    pillWave: 3, // 第三波结束后恢复
  },

  jindanTrial: {
    wavesPct: [0.22, 0.27, 0.32, 0.37, 0.42],
    spiritStoneCost: 3000,
  },

  suppressionDurationHours: 24,

  dailyGoals: {
    battle: { title: "完成 3 次战斗", target: 3, reward: { page: 3 } },
    suppress: { title: "镇压 1 个节点", target: 1, reward: { spiritStone: 40 } },
  },

  weathers: {
    rain: { name: "灵雨", desc: "今日首次领取收益额外 +30 灵草", reward: { herb: 30 } },
    clear: { name: "晴明", desc: "今日首次领取收益额外 +100 修为", reward: { cultivation: 100 } },
    vein: { name: "灵脉涌", desc: "今日首次领取收益额外 +80 灵石", reward: { spiritStone: 80 } },
    none: { name: "平常", desc: "无" },
  },

  astrologies: {
    lucky: { name: "吉星", desc: "今日首次战斗胜利额外 +50 修为", reward: { cultivation: 50 } },
    war: { name: "破军", desc: "今日首次战斗伤害 +20%", battleDamageMult: 1.2 },
    none: { name: "平常", desc: "无" },
  },

  longTask: {
    durations: [30, 60, 120],
    multipliers: { 30: 2, 60: 3, 120: 5 },
    riskyMultiplier: 1.5,
    protectionCost: 30,
    protectionDefense: 5,
    riskyEnemyMultiplier: 1.25,
    seclusionRateFactor: 0.1,
    ruleVersion: 1,
  },

  aptitudes: {
    balanced: { name: "均衡", cultivationMult: 1.0, spiritMult: 1.0 },
    focus: { name: "凝神", cultivationMult: 1.05, spiritMult: 0.95 },
    spirit: { name: "聚灵", cultivationMult: 0.95, spiritMult: 1.05 },
  },

  breakthrough: {
    riskyBaseRate: 0.8, // 冲关初次成功率
    riskyFailBoost: 0.1, // 每次失败 +10%
    steadyCostMult: 1.15, // 稳妥成本倍率
    riskyFailCostMult: 0.2, // 冲关失败成本倍率
  },
} as const;
