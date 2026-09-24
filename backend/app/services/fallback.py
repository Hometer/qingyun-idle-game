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
}


def template_for(event_id: str) -> dict | None:
    return TEMPLATES.get(event_id)


def valid_option_ids(event_id: str) -> set[str]:
    t = TEMPLATES.get(event_id)
    return set(t["options"].keys()) if t else set()
