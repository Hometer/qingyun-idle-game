from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.encounter import GenerateRequest
from app.services import budget, fallback, llm, moderation

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


def test_malformed_body_unified_error():
    # 缺少必填字段 → 参数校验错误也统一为 {"error":{"code","message"}}
    r = client.post("/api/v1/encounter/generate", json={})
    assert r.status_code == 422
    body = r.json()
    assert "error" in body
    assert body["error"]["code"] == "INVALID_REQUEST"


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
    for eid in ["event_well", "event_beast", "event_cave", "event_star", "event_wanderer", "event_mirror", "event_inscription", "event_origin"]:
        t = fallback.template_for(eid)
        assert t is not None
        assert len(t["options"]) == 2


def test_followup_templates_cover_all_paths():
    for eid in ["event_well_down", "event_well_around", "event_beast_saved", "event_beast_watch", "event_cave_enter", "event_cave_note"]:
        t = fallback.template_for(eid)
        assert t is not None
        assert len(t["options"]) == 2


def test_followup_context_optional(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    options = [
        {"option_id": "well_down_a", "label": "循线再探", "meaning": "依残文线索再下井印证"},
        {"option_id": "well_down_b", "label": "封存残文", "meaning": "把残文抄下收好"},
    ]
    body = _req("event_well_down", options)
    body["context"] = "此前你在古井奇遇中选择了探查井底"
    r = client.post("/api/v1/encounter/generate", json=body)
    assert r.status_code == 200
    assert r.json()["source"] == "template"
    assert {o["option_id"] for o in r.json()["options"]} == {"well_down_a", "well_down_b"}


def test_late_event_has_valid_template_response(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    options = [
        {"option_id": "origin_a", "label": "静听回声", "meaning": "停步聆听初元余音"},
        {"option_id": "origin_b", "label": "继续前行", "meaning": "沿紫气指引向前"},
    ]
    r = client.post("/api/v1/encounter/generate", json=_req("event_origin", options))
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "template"
    assert {o["option_id"] for o in data["options"]} == {"origin_a", "origin_b"}


def test_late_secret_realm_templates_cover_all_tiers(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    for realm in ["soul", "cloud", "lotus", "origin", "hongmeng"]:
        event_id = f"event_realm_{realm}"
        r = client.post("/api/v1/encounter/generate", json=_req(event_id, [{"option_id": "enter", "label": "进入秘境", "meaning": "探索秘境"}]))
        assert r.status_code == 200
        assert r.json()["source"] == "template"


# ---- v1.0.2 上线安全回归 ----

def test_access_code_fail_closed_in_production(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "")
    monkeypatch.setattr(settings, "access_code", "")
    monkeypatch.setattr(settings, "environment", "production")
    r = client.post("/api/v1/encounter/generate", json=_req())
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "FORBIDDEN"
    monkeypatch.setattr(settings, "environment", "development")


def test_overlong_name_422():
    body = _req()
    body["character"]["name"] = "长" * 100
    r = client.post("/api/v1/encounter/generate", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_budget_exceeded_returns_template(monkeypatch):
    monkeypatch.setattr(settings, "model_api_key", "dummy")
    monkeypatch.setattr(budget, "budget_exceeded", lambda cost: True)
    r = client.post("/api/v1/encounter/generate", json=_req())
    assert r.status_code == 200
    assert r.json()["source"] == "template"


def test_budget_record_and_read(tmp_path, monkeypatch):
    monkeypatch.setattr(budget, "_DATA_DIR", tmp_path)
    monkeypatch.setattr(budget, "_SPEND_FILE", tmp_path / "spend.json")
    monkeypatch.setattr(settings, "model_input_price_per_mtok", 2.0)
    monkeypatch.setattr(settings, "model_output_price_per_mtok", 8.0)
    assert budget.current_spend_rmb() == 0.0
    budget.record_usage(1_000_000, 500_000)  # 1M 入 + 0.5M 出 = 6 元
    assert budget.current_spend_rmb() == 6.0
    assert (tmp_path / "spend.json").exists()
