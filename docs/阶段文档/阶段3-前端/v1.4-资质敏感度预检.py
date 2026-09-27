#!/usr/bin/env python3
"""Use the existing v1.3 cultivation-only model to bound v1.4 aptitude effects.

This is a sensitivity check, not a full economy or playable-route simulation.
It deliberately counts completion of the final layer, rather than first entry
into stage 20.
"""

import importlib.util
from pathlib import Path

SOURCE = Path(__file__).with_name("v1.3-经济模拟.py")
spec = importlib.util.spec_from_file_location("v13_economy", SOURCE)
assert spec and spec.loader
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


def days_to_final_layer(rate_mult: float, logins_per_day: int, growth: float) -> int:
    cultivation = 0.0
    room_level = 1
    technique_level = 1
    realm_index = 0
    day = 0
    final_index = len(model.REALMS) - 1
    hours_per_day = 12 if logins_per_day == 1 else 24

    while realm_index < final_index and day < 400:
        stage = model.REALMS[realm_index][0]
        room_level = max(room_level, *(lv for lv, gate in model.ROOM_GATE.items() if stage >= gate))
        technique_level = max(technique_level, *(lv for lv, gate in model.QY_GATE.items() if stage >= gate))
        realm_multiplier = 1 if stage < 4 else 2 * growth ** (stage - 4)
        rate = (
            model.BASE_CULT
            * model.ROOM_MULT[room_level]
            * model.qy_mult(technique_level)
            * rate_mult
            * realm_multiplier
        )
        cultivation += rate * hours_per_day * 3600
        day += 1
        while realm_index < final_index and cultivation >= model.cum_cult(realm_index + 1):
            realm_index += 1
    return day


if __name__ == "__main__":
    cases = {
        "闭塞经脉": 0.94,
        "平通经脉": 1.00,
        "天成经脉": 1.06,
        "闭塞＋火单共鸣": 0.94 * 1.05,
        "天成＋火单共鸣": 1.06 * 1.05,
    }
    for growth in (1.22, 1.17):
        for logins in (1, 2):
            for name, multiplier in cases.items():
                print(f"growth={growth:.2f}\tlogin={logins}\t{name}\t{days_to_final_layer(multiplier, logins, growth)}天")
