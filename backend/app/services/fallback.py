"""际遇事件模板库：覆盖 3 种事件 × 2 个选项的固定文案。

事件 ID 与选项 ID 必须与前端引擎配置（frontend/src/engine/config.ts）完全一致。
"""

TEMPLATES: dict = {
    "event_well": {
        "title": "古井奇遇",
        "body": "山径尽头，荒草丛中现一口古井，井口苔痕斑驳，隐有冷气丝丝上浮。你驻足良久，见井壁青藤垂落，深处幽黑，似有极轻的嗡鸣自井底传来。",
        "options": {
            "well_a": "下井一探",
            "well_b": "绕路离开",
        },
    },
    "event_beast": {
        "title": "灵兽现踪",
        "body": "林间忽闻低鸣，一只幼小灵鹿陷于荆棘之中，挣扎不得，见你行来，目中似有哀求。四周草木微动，隐有窥伺之意，天色亦渐渐沉了下来。",
        "options": {
            "beast_a": "出手相救",
            "beast_b": "静观其变",
        },
    },
    "event_cave": {
        "title": "残破洞府",
        "body": "行至崖下，忽见一座残破洞府，石门半掩，内里晦暗难辨。门楣上的字迹早已漫漶，只余几道刻痕。阶前积尘甚厚，似已久无人至。",
        "options": {
            "cave_a": "推门而入",
            "cave_b": "记下位置",
        },
    },
    "event_realm_herb": {
        "title": "灵药谷",
        "body": "谷口云雾缭绕，药香扑面。谷中灵草遍地，却有异兽盘踞其间，时而低吼，搅得满谷腥风。你提剑凝神，缓步而入。",
        "options": {
            "enter": "进入秘境",
        },
    },
    "event_realm_relic": {
        "title": "古修遗迹",
        "body": "断壁残垣间，古修洞府半埋于荒草。石阶崩裂，暗处似有机关响动。你探入其中，只觉灵气紊乱，隐有杀机。",
        "options": {
            "enter": "进入秘境",
        },
    },
    "event_realm_deep": {
        "title": "幽窟险境",
        "body": "幽窟深不见底，寒气森森。岩壁上青苔如血，深处传来沉重的呼吸声，似有巨物盘踞。此行凶险，却也可能有重宝。",
        "options": {
            "enter": "进入秘境",
        },
    },
}


def template_for(event_id: str) -> dict | None:
    return TEMPLATES.get(event_id)


def valid_option_ids(event_id: str) -> set[str]:
    t = TEMPLATES.get(event_id)
    return set(t["options"].keys()) if t else set()
