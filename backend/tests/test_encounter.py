from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.encounter import GenerateRequest
from app.services import fallback, llm, moderation

client = TestClient(app)


def _req(event_id="event_well", options=None):
    if options is None:
        options = [
            {"option_id": "well_a", "label": "探查井底", "meaning": "冒险下井一探"},
            {"option_id": "well_b", "label": "绕行而去", "meaning": "不理会，绕路离开"},
        ]
    return {
        "event_id": event_id,
        "character": {"name": "林青", "realm": "炼气二层", "spirit_root": "金"},
        "map_id": "map_qingyun",
        "options": options,
        "recent_logs": ["首次通关青云山·野狼"],
    }


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_no_key_returns_template(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    r = client.post("/api/v1/encounter/generate", json=_req())
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "template"
    assert data["event_id"] == "event_well"
    assert {o["option_id"] for o in data["options"]} == {"well_a", "well_b"}


def test_unknown_event_422():
    r = client.post("/api/v1/encounter/generate", json=_req(event_id="nope"))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_option_mismatch_422():
    r = client.post(
        "/api/v1/encounter/generate",
        json=_req(options=[{"option_id": "well_a", "label": "探查井底", "meaning": "冒险下井一探"}]),
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_rate_limit_429(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    from app.core import security

    security._hits.clear()
    assert client.post("/api/v1/encounter/generate", json=_req()).status_code == 200
    assert client.post("/api/v1/encounter/generate", json=_req()).status_code == 200
    r = client.post("/api/v1/encounter/generate", json=_req())
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "RATE_LIMITED"
    security._hits.clear()


def test_access_code(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    monkeypatch.setattr(settings, "access_code", "abc")
    r = client.post("/api/v1/encounter/generate", json=_req())
    assert r.status_code == 403
    r2 = client.post("/api/v1/encounter/generate", json=_req(), headers={"x-access-code": "abc"})
    assert r2.status_code == 200
    monkeypatch.setattr(settings, "access_code", "")


# ---- 纯函数单测 ----

def test_parse_json_handles_fences():
    assert llm._parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert llm._parse_json('前缀 {"a": 1} 后缀') == {"a": 1}
    assert llm._parse_json("不是json") is None


def test_moderation_rejects_reward_hint():
    ok, reason = moderation.check_content("洞府", "你在洞中得到灵石，修为大增")
    assert not ok
    assert reason == "reward_hint"


def test_moderation_rejects_forbidden():
    ok, reason = moderation.check_content("斗法", "他被人开膛破肚，脑浆四溅")
    assert not ok
    assert reason == "forbidden"


def test_moderation_rejects_numeric():
    ok, reason = moderation.check_content("标题", "你已在此修行 300 年，心有所感")
    assert not ok
    assert reason == "numeric"


def test_validate_result_ok():
    req = GenerateRequest(**_req())
    result = {
        "event_id": "event_well",
        "title": "古井奇遇",
        "body": "山径尽头，古井苔痕斑驳，冷气丝丝上浮，深处似有低语。",
        "options": [
            {"option_id": "well_a", "option_text": "下井一探"},
            {"option_id": "well_b", "option_text": "绕路离开"},
        ],
    }
    ok, reason = moderation.validate_result(result, req)
    assert ok, reason


def test_validate_result_rejects_wrong_event():
    req = GenerateRequest(**_req())
    result = {
        "event_id": "event_beast",
        "title": "灵兽现踪",
        "body": "林间忽闻低鸣，一只幼小灵鹿陷于荆棘之中。",
        "options": [
            {"option_id": "well_a", "option_text": "下井一探"},
            {"option_id": "well_b", "option_text": "绕路离开"},
        ],
    }
    ok, reason = moderation.validate_result(result, req)
    assert not ok
    assert reason == "event_id_mismatch"


def test_templates_cover_all_events():
    for eid in ["event_well", "event_beast", "event_cave"]:
        t = fallback.template_for(eid)
        assert t is not None
        assert len(t["options"]) == 2
