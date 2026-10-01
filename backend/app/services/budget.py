"""月度费用熔断：按自然月累计估算费用并持久化，超出预算即停止模型调用、降级模板。"""

import json
import logging
import math
import threading
import time
from pathlib import Path

from app.core.config import settings

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SPEND_FILE = _DATA_DIR / "spend.json"
_lock = threading.Lock()
_pending = 0.0  # 已预留但尚未结算的估算费用（进程内并发保护）

logger = logging.getLogger(__name__)


def _month_key() -> str:
    t = time.localtime()
    return f"{t.tm_year}-{t.tm_mon:02d}"


def _load() -> dict:
    try:
        data = json.loads(_SPEND_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as e:
        # 账本损坏：失败关闭（不放行模型调用），而不是静默按 0 记账
        raise RuntimeError("月度费用账本损坏") from e
    if not isinstance(data, dict):
        raise RuntimeError("月度费用账本结构异常")
    return data


def _save(data: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SPEND_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(_SPEND_FILE)


def _read_spend() -> float:
    """读取当月累计；账本损坏/NaN/负数/非法值时返回 inf（使预算检查失败关闭）。"""
    try:
        data = _load()
        value = float(data.get(_month_key(), 0.0))
    except (RuntimeError, TypeError, ValueError):
        return float("inf")
    if not math.isfinite(value) or value < 0:
        return float("inf")
    return value


def current_spend_rmb() -> float:
    with _lock:
        return _read_spend()


def estimate_call_cost(prompt: str, max_tokens: int) -> float:
    """按提示词长度上界 + max_tokens 估算本次调用成本（元）。"""
    prompt_tokens = max(1, len(prompt))  # 中文约 1 token/字，取长度作上界
    return (
        prompt_tokens * settings.model_input_price_per_mtok
        + max_tokens * settings.model_output_price_per_mtok
    ) / 1_000_000


def budget_exceeded(cost_rmb: float) -> bool:
    """当月累计 + 已预留 + 本次预估是否超出预算。预算 ≤0 视为不启用熔断。"""
    if settings.monthly_budget_rmb <= 0:
        return False
    with _lock:
        return _read_spend() + _pending + cost_rmb > settings.monthly_budget_rmb


def reserve(cost_rmb: float) -> bool:
    """原子地检查并预留本次估算费用；返回是否允许发起模型调用。"""
    global _pending
    if settings.monthly_budget_rmb <= 0:
        return True
    with _lock:
        if _read_spend() + _pending + cost_rmb > settings.monthly_budget_rmb:
            return False
        _pending += cost_rmb
        return True


def _safe_month_value(data: dict) -> float:
    """读取当月累计值；非法/NaN/负数时按 0 处理（避免写坏账本）。"""
    try:
        v = float(data.get(_month_key(), 0.0))
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(v) or v < 0:
        return 0.0
    return v


def settle(reserved_rmb: float, usage_rmb: float) -> None:
    """调用结束后释放预留，并按实际 usage 记账。"""
    global _pending
    if usage_rmb <= 0:
        usage_rmb = 0.0
    with _lock:
        _pending = max(0.0, _pending - reserved_rmb)
        if usage_rmb <= 0:
            return
        try:
            data = _load()
        except (RuntimeError, TypeError, ValueError):
            logger.warning("月度费用账本损坏，本次费用未记账")
            return
        key = _month_key()
        data[key] = _safe_month_value(data) + usage_rmb
        _save(data)


def record_usage(prompt_tokens: int, completion_tokens: int) -> None:
    """兼容旧接口：按实际 token 数直接记账。"""
    cost = (
        prompt_tokens * settings.model_input_price_per_mtok
        + completion_tokens * settings.model_output_price_per_mtok
    ) / 1_000_000
    if cost <= 0:
        return
    with _lock:
        try:
            data = _load()
        except (RuntimeError, TypeError, ValueError):
            logger.warning("月度费用账本损坏，本次费用未记账")
            return
        key = _month_key()
        data[key] = _safe_month_value(data) + cost
        _save(data)
