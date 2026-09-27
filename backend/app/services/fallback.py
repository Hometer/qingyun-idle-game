"""际遇事件模板库：覆盖 8 种历练事件及 8 处秘境的固定文案。

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
    "event_star": {
        "title": "星盘余辉",
        "body": "山道旁有半埋的星盘，铜环虽旧，刻度仍清晰。盘面映着当夜星光，似在指向远处的岔路。",
        "options": {"star_a": "观星", "star_b": "收起星盘"},
    },
    "event_wanderer": {
        "title": "云游散修",
        "body": "山口遇见一位云游散修，衣袍沾尘，神色从容。他也正要穿过前方的旧道，便停步与你招呼。",
        "options": {"wanderer_a": "交换见闻", "wanderer_b": "结伴同行"},
    },
    "event_mirror": {
        "title": "玄镜旧影",
        "body": "石室深处立着一面玄镜，镜中不照眼前山色，却映出旧日行路的片段。镜光明灭，等你作出选择。",
        "options": {"mirror_a": "照见旧影", "mirror_b": "避开镜面"},
    },
    "event_inscription": {
        "title": "道纹石刻",
        "body": "断崖上有一方石刻，古老道纹被风雨磨去大半，余下几笔仍隐隐相连。四周无人，只有松声作响。",
        "options": {"inscription_a": "临摹纹路", "inscription_b": "先行封存"},
    },
    "event_origin": {
        "title": "太初回声",
        "body": "鸿蒙紫气从石阶尽头缓缓升起，耳边似有极远的回声。你停在阶前，脚下仍是来时走过的路。",
        "options": {"origin_a": "静听回声", "origin_b": "继续前行"},
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
    "event_realm_soul": {
        "title": "灵胎洞天",
        "body": "洞天石门微启，壁上残存着护养灵胎的古篆。越往里走，神识越像被无形的流水牵引。你收敛心念，向深处行去。",
        "options": {"enter": "进入秘境"},
    },
    "event_realm_cloud": {
        "title": "问道云海",
        "body": "云海之上有一条窄桥，桥端悬着前人留下的问道钟。钟声未响，桥下的云气却已翻涌，你沿着桥面缓步前行。",
        "options": {"enter": "进入秘境"},
    },
    "event_realm_lotus": {
        "title": "不朽莲池",
        "body": "莲池平静如镜，池心一朵金莲开而不谢。几道守池的古老气息在水下流转，你凝神踏上池畔石阶。",
        "options": {"enter": "进入秘境"},
    },
    "event_realm_origin": {
        "title": "太初道藏",
        "body": "残缺的道藏沉在星辉之间，书页无风自翻。字迹随目光变换，仿佛要你先回答来时所求，再许你继续探寻。",
        "options": {"enter": "进入秘境"},
    },
    "event_realm_hongmeng": {
        "title": "鸿蒙源海",
        "body": "源海不见岸，紫气在脚下缓缓分开。远处立着一道无字石门，身后的路逐渐隐没。你定住心神，向石门走去。",
        "options": {"enter": "进入秘境"},
    },
}


def template_for(event_id: str) -> dict | None:
    return TEMPLATES.get(event_id)


def valid_option_ids(event_id: str) -> set[str]:
    t = TEMPLATES.get(event_id)
    return set(t["options"].keys()) if t else set()
