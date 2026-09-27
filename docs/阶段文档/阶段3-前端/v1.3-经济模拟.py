#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.3 经济逐日模拟（可复现）
目标：新建角色 → 鸿蒙道祖十层，普通玩家每天登录 1~2 次，全程 6~8 周（42~56 天）。

建模口径：
- 修为/灵气/灵草 按产率×有效小时；离线按 12 小时封顶，登录 2 次≈24h、1 次≈12h。
- 灵石/残页/玄铁/灵材 来自首通、重复历练（每日三次）、镇压、秘境（简化按境界系数折算）。
- 建筑/功法/装备在达到门槛且材料足够时立即升级。
- 突破只受修为/灵气门槛约束（理想路线）；跨境试炼视为在圆满层当日完成。

用法：python3 本文件 [资质 balanced|focus|spirit] [登录次数 1|2]
"""

import sys

# ---------- 配置（与 config.ts 及 v1.3 PRD 一致）----------
BASE_CULT = 1.0
BASE_SPIRIT = 0.25
OFFLINE_CAP_HOURS = 12

# 境界成本：×1.3/境，境内 ×2 线性（进入该层门槛）
def stage_base(s):
    if s == 1: return 0
    if s == 2: return 1500
    if s == 3: return 12000
    if s == 4: return 30000
    return round(stage_base(s - 1) * 1.3)

def layer_cost(s, l):
    return round(stage_base(s) * (1 + (l - 1) / 9))

REALMS = [(s, l, layer_cost(s, l)) for s in range(1, 21) for l in range(1, 11)]

def cum_cult(idx):
    return sum(REALMS[i][2] for i in range(idx + 1))

# 境界产出倍率（v1.2 已实现）
def realm_mult(stage):
    return 1 if stage < 4 else 2 * (1.22 ** (stage - 4))

# 修炼室 / 青云诀（v1.3 续级）
ROOM_GATE = {1: 1, 2: 2, 3: 3, 4: 4, 5: 8, 6: 12, 7: 16, 8: 19}
ROOM_MULT = {1: 1.2, 2: 1.5, 3: 2.0, 4: 2.10, 5: 2.20, 6: 2.30, 7: 2.40, 8: 2.50}
QY_GATE = {1: 1, 2: 1, 3: 2, 4: 3, 5: 5, 6: 7, 7: 9, 8: 11, 9: 13, 10: 15, 11: 17, 12: 20}

def qy_mult(lv):
    m = {1: 1.3, 2: 1.6, 3: 2.0}.get(min(lv, 3), 2.0)
    for _ in range(max(0, lv - 3)):
        m *= 1.03
    return m

APT_CULT = {"balanced": 1.0, "focus": 1.05, "spirit": 0.95}

def cult_rate(stage, room_lv, qy_lv, apt):
    return BASE_CULT * ROOM_MULT[room_lv] * qy_mult(qy_lv) * APT_CULT[apt] * realm_mult(stage)


def simulate(apt, logins):
    hours_per_day = 24 if logins >= 2 else 12
    day = 0
    cult = 0.0
    room_lv = 1
    qy_lv = 1
    idx = 0
    stage_days = {}
    while idx < len(REALMS) - 1 and day < 400:
        s, l, _ = REALMS[idx]
        for nl in range(room_lv + 1, 9):
            if s >= ROOM_GATE[nl]:
                room_lv = nl
        for nl in range(qy_lv + 1, 13):
            if s >= QY_GATE[nl]:
                qy_lv = nl
        day += 1
        cult += cult_rate(s, room_lv, qy_lv, apt) * hours_per_day * 3600
        guard = 0
        while idx < len(REALMS) - 1 and cult >= cum_cult(idx + 1):
            idx += 1
            guard += 1
            if guard > 200:
                break
        s2 = REALMS[idx][0]
        if s2 not in stage_days:
            stage_days[s2] = day
    return stage_days, REALMS[idx][0]


if __name__ == "__main__":
    apt = sys.argv[1] if len(sys.argv) > 1 else "balanced"
    logins = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    stage_days, final = simulate(apt, logins)
    total = max(stage_days.values()) if stage_days else 0
    print(f"资质={apt} 登录={logins}次/天 → 到达第{final}境（鸿蒙道祖）用时 {total} 天")
    print("各境到达日（境界序号=天）：")
    print({s: d for s, d in sorted(stage_days.items()) if s in (4, 8, 12, 16, 20)})
