import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import settings

# 单进程内存限流；多实例部署时需换成共享限流（阶段 4 上线前处理）
_hits: dict[str, deque] = defaultdict(deque)


def access_allowed(request: Request) -> bool:
    if not settings.access_code:
        return True
    provided = request.headers.get("x-access-code") or request.query_params.get("code") or ""
    return provided == settings.access_code


def rate_limited(ip: str) -> bool:
    now = time.time()
    window = _hits[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= settings.rate_limit_per_minute:
        return True
    window.append(now)
    return False
