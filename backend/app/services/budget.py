"""月度费用熔断：按自然月累计估算费用并持久化，超出预算即停止模型调用、降级模板。"""

import json
import logging
import threading
import time
from pathlib import Path

from app.core.config import settings

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SPEND_FILE = _DATA_DIR / "spend.json"
_lock = threading.Lock()

logger = logging.getLogger(__name__)


def _month_key() -> str:
    t = time.localtime()
    return f"{t.tm_year}-{t.tm_mon:02d}"


def _load() -> dict:
    try:
        return json.loads(_SPEND_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception:
        # 账本损坏不能静默清空：记日志并降级为 0，避免误以为有熔断额度
        logger.warning("月度费用账本损坏，按 0 记账并继续")
        return {}


def _save(data: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SPEND_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(_SPEND_FILE)


def current_spend_rmb() -> float:
    with _lock:
        return float(_load().get(_month_key(), 0.0))


def estimate_call_cost(prompt: str, max_tokens: int) -> float:
    """按提示词长度上界 + max_tokens 估算本次调用成本（元）。"""
    prompt_tokens = max(1, len(prompt))  # 中文约 1 token/字，取长度作上界
    return (
        prompt_tokens * settings.model_input_price_per_mtok
        + max_tokens * settings.model_output_price_per_mtok
    ) / 1_000_000


def budget_exceeded(cost_rmb: float) -> bool:
    """当月累计 + 本次预估成本是否超出预算。预算 ≤0 视为不启用熔断。"""
    if settings.monthly_budget_rmb <= 0:
        return False
    return current_spend_rmb() + cost_rmb > settings.monthly_budget_rmb


def record_usage(prompt_tokens: int, completion_tokens: int) -> None:
    """调用成功后按实际 token 数记账。"""
    cost = (
        prompt_tokens * settings.model_input_price_per_mtok
        + completion_tokens * settings.model_output_price_per_mtok
    ) / 1_000_000
    if cost <= 0:
        return
    with _lock:
        data = _load()
        key = _month_key()
        data[key] = float(data.get(key, 0.0)) + cost
        _save(data)
