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
    // 炼气（第 1 境）
    { id: "qi1", stage: 1, layer: 1, name: "炼气一层", cultivationCost: 0, spiritCost: 0, attack: 0, defense: 0, hp: 0 },
    { id: "qi2", stage: 1, layer: 2, name: "炼气二层", cultivationCost: 120, spiritCost: 20, attack: 0, defense: 0, hp: 0 },
    { id: "qi3", stage: 1, layer: 3, name: "炼气三层", cultivationCost: 300, spiritCost: 50, attack: 0, defense: 0, hp: 0 },
    { id: "qi4", stage: 1, layer: 4, name: "炼气四层", cultivationCost: 360, spiritCost: 57, attack: 0, defense: 0, hp: 0 },
    { id: "qi5", stage: 1, layer: 5, name: "炼气五层", cultivationCost: 420, spiritCost: 64, attack: 0, defense: 0, hp: 0 },
    { id: "qi6", stage: 1, layer: 6, name: "炼气六层", cultivationCost: 470, spiritCost: 71, attack: 0, defense: 0, hp: 0 },
    { id: "qi7", stage: 1, layer: 7, name: "炼气七层", cultivationCost: 530, spiritCost: 79, attack: 0, defense: 0, hp: 0 },
    { id: "qi8", stage: 1, layer: 8, name: "炼气八层", cultivationCost: 590, spiritCost: 86, attack: 0, defense: 0, hp: 0 },
    { id: "qi9", stage: 1, layer: 9, name: "炼气九层", cultivationCost: 640, spiritCost: 93, attack: 0, defense: 0, hp: 0 },
    { id: "qi10", stage: 1, layer: 10, name: "炼气十层（圆满）", cultivationCost: 700, spiritCost: 100, attack: 0, defense: 0, hp: 0 },
    // 筑基（第 2 境）
    { id: "zhuji1", stage: 2, layer: 1, name: "筑基一层", cultivationCost: 1500, spiritCost: 200, attack: 0, defense: 0, hp: 0 },
    { id: "zhuji2", stage: 2, layer: 2, name: "筑基二层", cultivationCost: 3000, spiritCost: 400, attack: 3, defense: 2, hp: 20 },
    { id: "zhuji3", stage: 2, layer: 3, name: "筑基三层", cultivationCost: 3400, spiritCost: 450, attack: 3, defense: 2, hp: 22 },
    { id: "zhuji4", stage: 2, layer: 4, name: "筑基四层", cultivationCost: 3800, spiritCost: 500, attack: 4, defense: 2, hp: 24 },
    { id: "zhuji5", stage: 2, layer: 5, name: "筑基五层", cultivationCost: 4200, spiritCost: 550, attack: 4, defense: 3, hp: 28 },
    { id: "zhuji6", stage: 2, layer: 6, name: "筑基六层", cultivationCost: 4600, spiritCost: 600, attack: 5, defense: 3, hp: 32 },
    { id: "zhuji7", stage: 2, layer: 7, name: "筑基七层", cultivationCost: 5000, spiritCost: 650, attack: 5, defense: 3, hp: 34 },
    { id: "zhuji8", stage: 2, layer: 8, name: "筑基八层", cultivationCost: 5400, spiritCost: 700, attack: 6, defense: 4, hp: 38 },
    { id: "zhuji9", stage: 2, layer: 9, name: "筑基九层", cultivationCost: 5700, spiritCost: 750, attack: 6, defense: 4, hp: 40 },
    { id: "zhuji10", stage: 2, layer: 10, name: "筑基十层（圆满）", cultivationCost: 6000, spiritCost: 800, attack: 6, defense: 4, hp: 40 },
    // 金丹（第 3 境）
    { id: "jindan1", stage: 3, layer: 1, name: "金丹一层", cultivationCost: 12000, spiritCost: 1600, attack: 10, defense: 7, hp: 60 },
    { id: "jindan2", stage: 3, layer: 2, name: "金丹二层", cultivationCost: 13300, spiritCost: 1780, attack: 11, defense: 7, hp: 64 },
    { id: "jindan3", stage: 3, layer: 3, name: "金丹三层", cultivationCost: 14700, spiritCost: 1960, attack: 11, defense: 8, hp: 69 },
    { id: "jindan4", stage: 3, layer: 4, name: "金丹四层", cultivationCost: 16000, spiritCost: 2130, attack: 12, defense: 8, hp: 73 },
    { id: "jindan5", stage: 3, layer: 5, name: "金丹五层", cultivationCost: 17300, spiritCost: 2310, attack: 13, defense: 9, hp: 78 },
    { id: "jindan6", stage: 3, layer: 6, name: "金丹六层", cultivationCost: 18700, spiritCost: 2490, attack: 13, defense: 9, hp: 82 },
    { id: "jindan7", stage: 3, layer: 7, name: "金丹七层", cultivationCost: 20000, spiritCost: 2670, attack: 14, defense: 10, hp: 87 },
    { id: "jindan8", stage: 3, layer: 8, name: "金丹八层", cultivationCost: 21300, spiritCost: 2840, attack: 15, defense: 10, hp: 91 },
    { id: "jindan9", stage: 3, layer: 9, name: "金丹九层", cultivationCost: 22700, spiritCost: 3020, attack: 15, defense: 11, hp: 96 },
    { id: "jindan10", stage: 3, layer: 10, name: "金丹十层（圆满）", cultivationCost: 24000, spiritCost: 3200, attack: 16, defense: 11, hp: 100 },
    // 元婴（第 4 境，当前仅一层开放）
    { id: "yuanying1", stage: 4, layer: 1, name: "元婴一层", cultivationCost: 30000, spiritCost: 4000, attack: 18, defense: 13, hp: 120 },
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
      name: "灵药谷", gate: "zhuji1",
      enemy: { attack: 25, defense: 16, hp: 200 },
      reward: { herb: 30, spiritStone: 100 },
    },
    realm_relic: {
      name: "古修遗迹", gate: "zhuji2",
      enemy: { attack: 28, defense: 18, hp: 240 },
      reward: { page: 8, spiritStone: 200 },
    },
    realm_deep: {
      name: "幽窟险境", gate: "zhuji10",
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
    a_iron: { name: "玄铁软甲", slot: "armor", defense: 10, tribulationReduction: 0.05 },
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
        node_wraith: {
          name: "幽狼", gate: "qi5",
          enemy: { attack: 17, defense: 11, hp: 110 },
          firstClear: { cultivation: 200, spiritStone: 360, page: 18, equipment: null },
          repeat: { cultivation: 40, page: 6 },
          suppressRate: 0.45,
        },
        node_zombie: {
          name: "尸傀", gate: "qi7",
          enemy: { attack: 18, defense: 12, hp: 125 },
          firstClear: { cultivation: 260, spiritStone: 420, page: 20, equipment: null },
          repeat: { cultivation: 52, page: 7 },
          suppressRate: 0.5,
        },
        node_specter: {
          name: "幽魂", gate: "qi9",
          enemy: { attack: 20, defense: 12, hp: 140 },
          firstClear: { cultivation: 320, spiritStone: 480, page: 22, equipment: null },
          repeat: { cultivation: 64, page: 8 },
          suppressRate: 0.55,
        },
        node_ghost: {
          name: "厉鬼", gate: "qi10",
          enemy: { attack: 21, defense: 13, hp: 150 },
          firstClear: { cultivation: 300, spiritStone: 500, page: 0, equipment: "c_jade" },
          repeat: { cultivation: 60, page: 8 },
          suppressRate: 0.6,
        },
        node_king: {
          name: "鬼王", gate: "qi10",
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
          name: "断崖山魈", gate: "zhuji1",
          enemy: { attack: 23, defense: 15, hp: 160 },
          firstClear: { cultivation: 300, spiritStone: 150, page: 0, equipment: null },
          repeat: { cultivation: 80, page: 0 },
          suppressRate: 0.8,
        },
        node_golem: {
          name: "古道石傀", gate: "zhuji2",
          enemy: { attack: 25, defense: 17, hp: 200 },
          firstClear: { cultivation: 600, spiritStone: 250, page: 0, equipment: null },
          repeat: { cultivation: 120, page: 0 },
          suppressRate: 1.0,
        },
        node_stoneking: {
          name: "石傀王", gate: "zhuji4",
          enemy: { attack: 25, defense: 17, hp: 210 },
          firstClear: { cultivation: 700, spiritStone: 300, page: 0, equipment: null },
          repeat: { cultivation: 140, page: 0 },
          suppressRate: 1.05,
        },
        node_lingyuan: {
          name: "灵猿", gate: "zhuji6",
          enemy: { attack: 26, defense: 18, hp: 220 },
          firstClear: { cultivation: 780, spiritStone: 340, page: 0, equipment: null },
          repeat: { cultivation: 156, page: 0 },
          suppressRate: 1.1,
        },
        node_shanxiaowang: {
          name: "山魈王", gate: "zhuji8",
          enemy: { attack: 27, defense: 18, hp: 230 },
          firstClear: { cultivation: 850, spiritStone: 370, page: 0, equipment: null },
          repeat: { cultivation: 170, page: 0 },
          suppressRate: 1.15,
        },
        node_guardian: {
          name: "护丹灵", gate: "zhuji10",
          enemy: { attack: 27, defense: 19, hp: 240 },
          firstClear: { cultivation: 900, spiritStone: 400, page: 0, equipment: null },
          repeat: { cultivation: 180, page: 0 },
          suppressRate: 1.2,
        },
      },
    },
    map_jindan: {
      name: "金丹秘境",
      nodes: {
        node_danfang: {
          name: "丹房遗影", gate: "jindan2",
          enemy: { attack: 28, defense: 20, hp: 260 },
          firstClear: { cultivation: 1500, spiritStone: 600, page: 20, equipment: null },
          repeat: { cultivation: 300, page: 4 },
          suppressRate: 1.3,
        },
        node_danlu: {
          name: "丹炉火灵", gate: "jindan4",
          enemy: { attack: 30, defense: 21, hp: 290 },
          firstClear: { cultivation: 2000, spiritStone: 750, page: 22, equipment: null },
          repeat: { cultivation: 400, page: 5 },
          suppressRate: 1.4,
        },
        node_danjie: {
          name: "丹劫幻象", gate: "jindan6",
          enemy: { attack: 32, defense: 22, hp: 320 },
          firstClear: { cultivation: 2600, spiritStone: 900, page: 24, equipment: null },
          repeat: { cultivation: 520, page: 6 },
          suppressRate: 1.5,
        },
        node_dansha: {
          name: "丹煞", gate: "jindan8",
          enemy: { attack: 34, defense: 23, hp: 350 },
          firstClear: { cultivation: 3300, spiritStone: 1050, page: 26, equipment: null },
          repeat: { cultivation: 660, page: 7 },
          suppressRate: 1.6,
        },
        node_yuanying: {
          name: "元婴裂隙", gate: "jindan10",
          enemy: { attack: 36, defense: 24, hp: 380 },
          firstClear: { cultivation: 4000, spiritStone: 1200, page: 30, equipment: null },
          repeat: { cultivation: 800, page: 8 },
          suppressRate: 1.7,
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
  yuanyingTrial: {
    wavesPct: [0.24, 0.29, 0.34, 0.39, 0.44],
    spiritStoneCost: 5000,
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
