"""审查复现：本地假响应模拟已计费但解析失败，不发送模型请求、不改真实费用账本。
在项目根目录运行：backend/.venv/bin/python docs/阶段文档/全局审查-2026-10-01/reproduce_backend.py
"""
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))
from app.core.config import settings
from app.schemas.encounter import GenerateRequest
from app.services import budget, llm
from app.main import app
from fastapi.testclient import TestClient

req = GenerateRequest(
    event_id="event_well",
    character={"name": "审查角色", "realm": "炼气一层", "spirit_root": "金"},
    map_id="map_qingyun",
    options=[
        {"option_id": "well_a", "label": "探查井底", "meaning": "冒险下井"},
        {"option_id": "well_b", "label": "绕行而去", "meaning": "绕路离开"},
    ],
    recent_logs=[],
)
fake_client = MagicMock()
fake_client.chat.completions.create.return_value = SimpleNamespace(
    choices=[SimpleNamespace(message=SimpleNamespace(content="不是 JSON"))],
    usage=SimpleNamespace(prompt_tokens=1000, completion_tokens=200, total_tokens=1200),
)
with tempfile.TemporaryDirectory(prefix="qingyun-budget-audit-") as tmp:
    with patch.object(settings, "model_api_key", "audit-placeholder"), \
         patch.object(budget, "_DATA_DIR", Path(tmp)), \
         patch.object(budget, "_SPEND_FILE", Path(tmp) / "spend.json"), \
         patch.object(llm, "OpenAI", return_value=fake_client):
        result = llm.generate_encounter(req)
        print({"scenario": "两次返回 usage 但 JSON 无效", "source": result.source,
               "calls": fake_client.chat.completions.create.call_count,
               "recorded_spend_rmb": budget.current_spend_rmb()})
response = TestClient(app).get("/api/v1/missing")
print({"scenario": "未知接口", "status": response.status_code, "body": response.json()})
