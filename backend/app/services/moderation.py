"""模型输出的结构校验与内容审核。

规则边界以固定事件配置和本文件为准：AI 响应中的奖励、概率、属性、数值一律不接收，
若文案暗示了与分支不符的收益或因果，判为不合格并降级模板。
"""

import re

# 血腥猎奇词（PRD 5.3 内容尺度）
FORBIDDEN_WORDS = ["残肢", "断臂", "脑浆", "开膛", "剖腹", "血泊", "碎尸", "腐尸", "肢解", "内脏", "眼球", "肠"]

# 收益暗示词：出现即视为"AI 在承诺/暗示奖励"，降级模板（PRD 5.2）
REWARD_HINT_WORDS = ["灵石", "灵草", "残页", "丹药", "法宝", "秘籍", "奖励", "获得", "得到", "捡到", "拾得", "修为大增", "灵气大涨"]

TITLE_MAX = 30
BODY_MIN = 10
BODY_MAX = 300
OPTION_TEXT_MAX = 15


def check_content(title: str, body: str) -> tuple[bool, str]:
    for w in FORBIDDEN_WORDS:
        if w in title or w in body:
            return False, "forbidden"
    for w in REWARD_HINT_WORDS:
        if w in title or w in body:
            return False, "reward_hint"
    if re.search(r"\d", body):
        return False, "numeric"
    return True, ""


def validate_result(result: dict, request) -> tuple[bool, str]:
    """request 需具备 event_id 与 options（GenerateRequest）。"""
    if not isinstance(result, dict):
        return False, "not_object"
    if result.get("event_id") != request.event_id:
        return False, "event_id_mismatch"
    title = result.get("title")
    body = result.get("body")
    options = result.get("options")
    if not isinstance(title, str) or not isinstance(body, str) or not isinstance(options, list):
        return False, "bad_types"
    if not (1 <= len(title) <= TITLE_MAX):
        return False, "title_length"
    if not (BODY_MIN <= len(body) <= BODY_MAX):
        return False, "body_length"
    if len(options) != len(request.options):
        return False, "option_count"
    req_ids = {o.option_id for o in request.options}
    got_ids: set[str] = set()
    for o in options:
        if not isinstance(o, dict):
            return False, "bad_option"
        oid = o.get("option_id")
        otext = o.get("option_text")
        if not isinstance(oid, str) or not isinstance(otext, str):
            return False, "bad_option"
        if not (1 <= len(otext) <= OPTION_TEXT_MAX):
            return False, "option_text_length"
        ok, reason = check_content("", otext)  # 选项文字同样受内容审核约束
        if not ok:
            return False, reason
        got_ids.add(oid)
    if got_ids != req_ids:
        return False, "option_id_mismatch"
    ok, reason = check_content(title, body)
    if not ok:
        return False, reason
    return True, ""
