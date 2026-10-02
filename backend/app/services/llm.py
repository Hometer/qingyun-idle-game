"""模型调用：超时、有限重试、结构化解析、模板降级。"""

import asyncio
import math
import json
import logging
import re
import time
from pathlib import Path

from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.encounter import GenerateRequest, GenerateResponse, OptionOut
from app.services import budget, fallback, moderation

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "encounter.txt"
_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")

_MAX_ATTEMPTS = 2

logger = logging.getLogger(__name__)


def _parse_json(text: str) -> dict | None:
    """宽容解析：去掉代码围栏，兼容前后缀杂字。"""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except Exception:
        pass
    start = t.find("{")
    end = t.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(t[start : end + 1])
        except Exception:
            pass
    return None


def _build_prompt(req: GenerateRequest) -> str:
    options_desc = "\n".join(f"- {o.option_id}：{o.label}（{o.meaning}）" for o in req.options)
    logs = "\n".join(f"- {x}" for x in req.recent_logs) or "（无）"
    meta = fallback.template_for(req.event_id)
    context = req.context.strip() if req.context and req.context.strip() else "（无）"
    return _PROMPT.format(
        event_id=req.event_id,
        event_title=meta["title"],
        name=req.character.name,
        spirit_root=req.character.spirit_root,
        realm=req.character.realm,
        map_id=req.map_id,
        context=context,
        options=options_desc,
        recent_logs=logs,
    )


def _template_response(req: GenerateRequest) -> GenerateResponse:
    tmpl = fallback.template_for(req.event_id)
    return GenerateResponse(
        source="template",
        event_id=req.event_id,
        title=tmpl["title"],
        body=tmpl["body"],
        options=[OptionOut(option_id=o.option_id, option_text=tmpl["options"][o.option_id]) for o in req.options],
    )


def generate_encounter(req: GenerateRequest) -> GenerateResponse:
    """保留同步调用入口；FastAPI 异步端点直接 await 异步入口。"""
    return asyncio.run(generate_encounter_async(req))


async def generate_encounter_async(req: GenerateRequest) -> GenerateResponse:
    deadline = time.perf_counter() + settings.model_total_budget_seconds
    if not settings.model_api_key:
        return _template_response(req)
    if not all(math.isfinite(x) and x > 0 for x in (settings.model_total_budget_seconds, settings.model_timeout_seconds)) or not budget.config_valid():
        return _template_response(req)
    prompt = _build_prompt(req)
    estimate = budget.estimate_call_cost(prompt, 400)
    if budget.budget_exceeded(estimate):
        return _template_response(req)
    client = None
    reason = "unknown"
    try:
        client = AsyncOpenAI(api_key=settings.model_api_key, base_url=settings.model_api_base, timeout=settings.model_timeout_seconds, max_retries=0)
        for _ in range(_MAX_ATTEMPTS):
            remaining = deadline - time.perf_counter()
            if remaining <= 0:
                reason = "deadline"
                break
            token = budget.reserve_request(estimate)
            if token is None:
                reason = "budget"
                break
            start = time.perf_counter()
            try:
                # wait_for 约束完整响应（包含慢速分段），取消时关闭网络等待。
                resp = await asyncio.wait_for(client.chat.completions.create(
                    model=settings.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.8, max_tokens=400,
                    timeout=min(settings.model_timeout_seconds, remaining),
                ), timeout=max(0.001, deadline - time.perf_counter()))
            except asyncio.CancelledError:
                budget.settle_request(token, None)
                raise
            except Exception as error:
                budget.settle_request(token, None)
                reason = f"call_error:{type(error).__name__}"
                if time.perf_counter() >= deadline:
                    break
                continue
            if time.perf_counter() >= deadline:
                budget.settle_request(token, None)
                reason = "deadline"
                break
            usage = getattr(resp, "usage", None)
            cost = estimate
            if usage is not None:
                pt, ct = getattr(usage, "prompt_tokens", None), getattr(usage, "completion_tokens", None)
                if budget._valid(pt) and budget._valid(ct):
                    cost = (pt * settings.model_input_price_per_mtok + ct * settings.model_output_price_per_mtok) / 1_000_000
            if not budget.settle_request(token, cost):
                reason = "ledger_write"
                break
            text = resp.choices[0].message.content or ""
            parsed = _parse_json(text)
            if parsed is None:
                reason = "parse_fail"
                continue
            ok, why = moderation.validate_result(parsed, req)
            if not ok:
                reason = f"validation:{why}"
                continue
            logger.info("model_ok event=%s model=%s latency=%.2fs", req.event_id, settings.model_name, time.perf_counter() - start)
            return GenerateResponse(source="model", event_id=req.event_id, title=parsed["title"], body=parsed["body"], options=[OptionOut(option_id=o["option_id"], option_text=o["option_text"]) for o in parsed["options"]])
    except asyncio.CancelledError:
        raise
    except Exception:
        reason = "sdk_or_response"
    finally:
        if client is not None:
            try:
                await asyncio.wait_for(client.close(), timeout=0.1)
            except Exception:
                pass
    logger.info("fallback event=%s reason=%s", req.event_id, reason)
    return _template_response(req)
