"""持久化费用预留；未知费用不因失败或进程重启自动释放。单实例部署。"""
import json
import logging
import math
import os
import threading
import time
import uuid
from pathlib import Path

from app.core.config import settings

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SPEND_FILE = _DATA_DIR / "spend.json"
_lock = threading.Lock()
_pending = 0.0  # 兼容诊断；以持久化预留账本为准
_blocked: set[str] = set()
logger = logging.getLogger(__name__)


def _month_key() -> str:
    t = time.localtime()
    return f"{t.tm_year}-{t.tm_mon:02d}"


def _valid(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def config_valid() -> bool:
    return all(_valid(x) for x in (settings.monthly_budget_rmb, settings.model_input_price_per_mtok, settings.model_output_price_per_mtok))


def _read(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as error:
        raise RuntimeError("费用记录无法读取") from error
    if not isinstance(data, dict):
        raise RuntimeError("费用记录结构异常")
    return data


def _load() -> dict:
    data = _read(_SPEND_FILE)
    if any(not _valid(value) for value in data.values()):
        raise RuntimeError("费用账本数值异常")
    return data


def _atomic(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, allow_nan=False)
        handle.flush()
        os.fsync(handle.fileno())
    tmp.replace(path)
    # rename 持久化，避免异常退出丢失发送前预留。
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _save(data: dict) -> None:
    _atomic(_SPEND_FILE, data)


def _journal_path() -> Path:
    return _SPEND_FILE.with_name("reservations.json")


def _reservations() -> dict:
    data = _read(_journal_path())
    for key, item in data.items():
        if not isinstance(key, str) or not isinstance(item, dict) or not _valid(item.get("estimate")) or not isinstance(item.get("month"), str) or item.get("status") not in {"reserved", "unknown", "blocked"}:
            raise RuntimeError("费用预留记录异常")
    return data


def _read_spend() -> float:
    try:
        return float(_load().get(_month_key(), 0.0))
    except (RuntimeError, OSError, TypeError, ValueError):
        return float("inf")


def current_spend_rmb() -> float:
    with _lock:
        return _read_spend()


def estimate_call_cost(prompt: str, max_tokens: int) -> float:
    if not config_valid() or not _valid(max_tokens):
        return float("inf")
    return (max(1, len(prompt)) * settings.model_input_price_per_mtok + max_tokens * settings.model_output_price_per_mtok) / 1_000_000


def _exceeded(cost: float, reservations: dict) -> bool:
    global _pending
    _pending = sum(item["estimate"] for item in reservations.values() if item["month"] == _month_key())
    spend = _read_spend()
    if any(item["status"] == "blocked" for item in reservations.values()) or not config_valid() or not _valid(cost) or not math.isfinite(spend) or str(_SPEND_FILE) in _blocked:
        return True
    return settings.monthly_budget_rmb > 0 and spend + _pending + cost > settings.monthly_budget_rmb


def budget_exceeded(cost_rmb: float) -> bool:
    with _lock:
        try:
            return _exceeded(cost_rmb, _reservations())
        except (RuntimeError, OSError):
            return True


def reserve_request(cost_rmb: float) -> str | None:
    """发送前预留落盘成功才返回身份；损坏或写失败均关闭模型调用。"""
    with _lock:
        try:
            items = _reservations()
            if _exceeded(cost_rmb, items):
                return None
            token = uuid.uuid4().hex
            items[token] = {"estimate": cost_rmb, "month": _month_key(), "status": "reserved"}
            _atomic(_journal_path(), items)
            return token
        except (RuntimeError, OSError, ValueError):
            _blocked.add(str(_SPEND_FILE))
            return None


def reserve(cost_rmb: float) -> bool:
    """兼容旧的布尔接口，同样持久化；新请求使用独立身份结算。"""
    return reserve_request(cost_rmb) is not None


def settle_request(token: str, usage_rmb: float | None) -> bool:
    """未知费用保留预留；已知费用先记账再释放，重复结算不会重复计费。"""
    with _lock:
        try:
            items = _reservations()
            item = items.get(token)
            if item is None:
                return True
            if usage_rmb is None or not _valid(usage_rmb):
                item["status"] = "unknown"
                _atomic(_journal_path(), items)
                return True
            data = _load()
            month = item["month"]
            data[month] = data.get(month, 0.0) + usage_rmb
            _save(data)
            del items[token]
            _atomic(_journal_path(), items)
            return True
        except (RuntimeError, OSError, ValueError):
            # 发送前预留仍在磁盘上；重启也继续占用，不将失败当作免费。
            _blocked.add(str(_SPEND_FILE))
            # 累计账本写失败而预留文件仍可写时，将封锁也持久化。
            try:
                retained = _reservations()
                if token in retained:
                    retained[token]["status"] = "blocked"
                    _atomic(_journal_path(), retained)
            except (RuntimeError, OSError, ValueError):
                pass
            logger.warning("费用结算失败，保留预留并停止后续模型调用")
            return False


def settle(reserved_rmb: float, usage_rmb: float) -> None:
    with _lock:
        try:
            token = next((key for key, item in _reservations().items() if item["estimate"] == reserved_rmb and item["status"] == "reserved"), None)
        except (RuntimeError, OSError):
            _blocked.add(str(_SPEND_FILE))
            return
    if token:
        settle_request(token, usage_rmb if usage_rmb > 0 else None)


def record_usage(prompt_tokens: int, completion_tokens: int) -> None:
    if not config_valid() or not _valid(prompt_tokens) or not _valid(completion_tokens):
        _blocked.add(str(_SPEND_FILE))
        return
    cost = (prompt_tokens * settings.model_input_price_per_mtok + completion_tokens * settings.model_output_price_per_mtok) / 1_000_000
    with _lock:
        try:
            data = _load()
            key = _month_key()
            data[key] = data.get(key, 0.0) + cost
            _save(data)
        except (RuntimeError, OSError, ValueError):
            _blocked.add(str(_SPEND_FILE))
            logger.warning("费用记账失败，停止后续模型调用")
