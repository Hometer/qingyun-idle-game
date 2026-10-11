import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="灵境修行 AI 际遇代理", version="0.1.0")
app.include_router(router, prefix="/api/v1")

logger = logging.getLogger(__name__)


def _err(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # 统一错误结构；404 等未注册路由也走这里，不泄露默认 detail
    if exc.status_code == 404:
        return _err(404, "NOT_FOUND", "接口不存在")
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        return JSONResponse(status_code=exc.status_code, content={"error": detail})
    return _err(exc.status_code, "HTTP_ERROR", str(detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return _err(422, "INVALID_REQUEST", "请求参数不合法")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("未捕获异常")
    return _err(500, "INTERNAL", "服务器内部错误")


@app.get("/health")
def health():
    return {"status": "ok"}
