"""模型调用：超时、有限重试、结构化解析、模板降级。"""

import json
import logging
import re
import time
from pathlib import Path

from openai import OpenAI

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
    # 无 Key：直接模板，不发起任何网络调用
    if not settings.model_api_key:
        logger.info("fallback event=%s reason=no_key", req.event_id)
        return _template_response(req)

    prompt = _build_prompt(req)
    estimate = budget.estimate_call_cost(prompt, 400)
    if budget.budget_exceeded(estimate):
        logger.info("fallback event=%s reason=budget", req.event_id)
        return _template_response(req)

    try:
        client = OpenAI(
            api_key=settings.model_api_key,
            base_url=settings.model_api_base,
            timeout=settings.model_timeout_seconds,
            max_retries=0,
        )
    except Exception:
        logger.info("fallback event=%s reason=sdk_init", req.event_id)
        return _template_response(req)

    reason = "unknown"
    deadline = time.perf_counter() + settings.model_total_budget_seconds
    for _ in range(_MAX_ATTEMPTS):
        # 端到端总截止：前端约 4 秒放弃，后端不超总预算发起新重试
        if time.perf_counter() >= deadline:
            reason = "deadline"
            break
        # 逐次原子预留：越界则停止（前一次失败已按实际 usage 结算）
        if not budget.reserve(estimate):
            reason = "budget"
            break
        start = time.perf_counter()
        try:
            resp = client.chat.completions.create(
                model=settings.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=400,
            )
            text = resp.choices[0].message.content or ""
            latency = time.perf_counter() - start
        except Exception as e:
            budget.settle(estimate, 0.0)  # 失败：释放预留，无 usage 记账
            reason = f"call_error:{type(e).__name__}"
            continue
        usage = getattr(resp, "usage", None)
        usage_cost = 0.0
        if usage is not None:
            usage_cost = (
                int(getattr(usage, "prompt_tokens", 0) or 0) * settings.model_input_price_per_mtok
                + int(getattr(usage, "completion_tokens", 0) or 0) * settings.model_output_price_per_mtok
            ) / 1_000_000
        else:
            usage_cost = estimate  # usage 缺失但调用已发出：保守按预留上限记账，不当免费
        # 释放预留并按实际 usage 记账（解析/审核失败同样产生费用）
        budget.settle(estimate, usage_cost)
        parsed = _parse_json(text)
        if parsed is None:
            reason = "parse_fail"
            continue
        ok, r = moderation.validate_result(parsed, req)
        if not ok:
            reason = f"validation:{r}"
            continue
        logger.info(
            "model_ok event=%s model=%s latency=%.2fs tokens=%s",
            req.event_id,
            settings.model_name,
            latency,
            getattr(getattr(resp, "usage", None), "total_tokens", None),
        )
        return GenerateResponse(
            source="model",
            event_id=req.event_id,
            title=parsed["title"],
            body=parsed["body"],
            options=[OptionOut(option_id=o["option_id"], option_text=o["option_text"]) for o in parsed["options"]],
        )

    logger.info("fallback event=%s reason=%s", req.event_id, reason)
    return _template_response(req)
