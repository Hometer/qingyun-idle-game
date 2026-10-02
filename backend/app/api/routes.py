import asyncio

from fastapi import APIRouter, HTTPException, Request

from app.core import security
from app.schemas.encounter import GenerateRequest, GenerateResponse
from app.services import fallback, llm

router = APIRouter()


def _raise(status_code: int, code: str, message: str):
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/encounter/generate", response_model=GenerateResponse)
async def generate_encounter(req: GenerateRequest, request: Request):
    if not security.access_allowed(request):
        _raise(403, "FORBIDDEN", "访问码无效")
    if security.rate_limited(request.client.host or "unknown"):
        _raise(429, "RATE_LIMITED", "请求过于频繁，请稍后再试")

    if fallback.template_for(req.event_id) is None:
        _raise(422, "INVALID_REQUEST", "未知事件")
    if {o.option_id for o in req.options} != fallback.valid_option_ids(req.event_id):
        _raise(422, "INVALID_REQUEST", "选项与事件不匹配")

    model = asyncio.create_task(llm.generate_encounter_async(req))
    async def disconnected():
        while not model.done():
            if await request.is_disconnected():
                return
            await asyncio.sleep(0.05)
    watcher = asyncio.create_task(disconnected())
    try:
        done, _ = await asyncio.wait({model, watcher}, return_when=asyncio.FIRST_COMPLETED)
        if model in done:
            return await model
        model.cancel()
        await asyncio.gather(model, return_exceptions=True)
        return llm._template_response(req)
    finally:
        watcher.cancel()
        if not model.done():
            model.cancel()
        await asyncio.gather(model, watcher, return_exceptions=True)
