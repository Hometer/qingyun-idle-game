import asyncio
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.schemas.encounter import GenerateRequest
from app.services import budget, llm
from test_encounter import _req


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(budget, "_DATA_DIR", tmp_path)
    monkeypatch.setattr(budget, "_SPEND_FILE", tmp_path / "spend.json")
    monkeypatch.setattr(settings, "monthly_budget_rmb", .01)
    monkeypatch.setattr(settings, "model_api_key", "test-only")
    monkeypatch.setattr(settings, "model_input_price_per_mtok", 2.)
    monkeypatch.setattr(settings, "model_output_price_per_mtok", 8.)
    monkeypatch.setattr(settings, "model_total_budget_seconds", .3)
    monkeypatch.setattr(settings, "model_timeout_seconds", 1.)
    return tmp_path


def result():
    return {"event_id": "event_well", "title": "古井奇遇", "body": "山径尽头，古井苔痕斑驳，冷气丝丝上浮，深处似有低语。", "options": [{"option_id": "well_a", "option_text": "下井一探"}, {"option_id": "well_b", "option_text": "绕路离开"}]}


def fake_client(monkeypatch, create):
    class Client:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))
        async def close(self):
            pass
    monkeypatch.setattr(llm, "AsyncOpenAI", Client)


def test_concurrent_reservation_is_atomic_and_persistent():
    with ThreadPoolExecutor(max_workers=2) as workers:
        allowed = list(workers.map(budget.reserve, [.006, .006]))
    assert sum(allowed) == 1
    assert len(budget._reservations()) == 1
    assert budget.budget_exceeded(.006)


def test_process_crash_restart_preserves_reservation(isolated):
    script = """
import os,sys
from pathlib import Path
from app.services import budget
from app.core.config import settings
budget._SPEND_FILE=Path(sys.argv[1])/"spend.json"
settings.monthly_budget_rmb=.01
assert budget.reserve(.006)
os._exit(0)
"""
    subprocess.run([sys.executable, "-c", script, str(isolated)], check=True, timeout=10)
    # 真正独立进程读取，不借用父进程的 _pending。
    check = script[:script.index("assert budget.reserve")]+"assert not budget.reserve(.006)\n"
    subprocess.run([sys.executable, "-c", check, str(isolated)], check=True, timeout=10)
    assert len(budget._reservations()) == 1


def test_unknown_result_keeps_cost_and_no_free_retry(monkeypatch):
    calls = []
    async def create(**kwargs):
        calls.append(1)
        raise TimeoutError("unknown")
    fake_client(monkeypatch, create)
    monkeypatch.setattr(budget, "estimate_call_cost", lambda *_: .006)
    response = llm.generate_encounter(GenerateRequest(**_req()))
    assert response.source == "template"
    assert len(calls) == 1
    assert budget.current_spend_rmb() == 0
    assert budget.budget_exceeded(.006)
    assert next(iter(budget._reservations().values()))["status"] == "unknown"


def test_ledger_write_failure_keeps_reservation_and_blocks(monkeypatch):
    token = budget.reserve_request(.003)
    monkeypatch.setattr(budget, "_save", lambda _: (_ for _ in ()).throw(OSError("disk full")))
    assert not budget.settle_request(token, .002)
    assert token in budget._reservations()
    assert not budget.reserve(.00001)
    budget._blocked.discard(str(budget._SPEND_FILE))  # 模拟进程内标志丢失，磁盘封锁仍有效
    assert not budget.reserve(.00001)


def test_reservation_write_failure_never_sends(monkeypatch):
    monkeypatch.setattr(budget, "_atomic", lambda *_: (_ for _ in ()).throw(OSError("disk full")))
    calls = []
    async def create(**kwargs): calls.append(1)
    fake_client(monkeypatch, create)
    assert llm.generate_encounter(GenerateRequest(**_req())).source == "template"
    assert calls == []


def test_normal_settlement_idempotent_and_missing_usage_conservative(monkeypatch):
    token = budget.reserve_request(.003)
    assert budget.settle_request(token, .002)
    assert budget.settle_request(token, .002)
    assert budget.current_spend_rmb() == .002
    async def create(**kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(result())))], usage=None)
    fake_client(monkeypatch, create)
    monkeypatch.setattr(budget, "estimate_call_cost", lambda *_: .003)
    assert llm.generate_encounter(GenerateRequest(**_req())).source == "model"
    assert budget.current_spend_rmb() == .005
    assert budget._reservations() == {}


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -1])
@pytest.mark.parametrize("field", ["monthly_budget_rmb", "model_input_price_per_mtok", "model_output_price_per_mtok"])
def test_invalid_config_blocks_before_sdk(monkeypatch, field, value):
    monkeypatch.setattr(settings, field, value)
    monkeypatch.setattr(llm, "AsyncOpenAI", lambda **_: pytest.fail("must not initialize SDK"))
    assert llm.generate_encounter(GenerateRequest(**_req())).source == "template"
    assert not budget.reserve(.001)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -1, "bad", {}])
def test_invalid_cost_cannot_reserve(value):
    assert not budget.reserve(value)
    assert budget._reservations() == {}


def test_invalid_usage_stays_unknown():
    token = budget.reserve_request(.006)
    assert budget.settle_request(token, float("nan"))
    assert budget.budget_exceeded(.006)
    assert budget.current_spend_rmb() == 0


@pytest.mark.parametrize("text", ["[]", "broken", '{"2026-10":NaN}', '{"2026-10":-1}'])
def test_bad_ledger_fail_closed(isolated, text):
    (isolated / "spend.json").write_text(text)
    assert not budget.reserve(.001)


def test_sdk_init_failure_safe(monkeypatch):
    monkeypatch.setattr(llm, "AsyncOpenAI", lambda **_: (_ for _ in ()).throw(RuntimeError("init")))
    assert llm.generate_encounter(GenerateRequest(**_req())).source == "template"
    assert budget._reservations() == {}


def test_total_deadline_cancels_wait_and_has_no_late_result(monkeypatch):
    calls, cancelled = [], []
    async def create(**kwargs):
        calls.append(1)
        try:
            await asyncio.sleep(1)
        except asyncio.CancelledError:
            cancelled.append(1)
            raise
        pytest.fail("late response adopted")
    fake_client(monkeypatch, create)
    monkeypatch.setattr(settings, "model_total_budget_seconds", .08)
    start = time.perf_counter()
    assert llm.generate_encounter(GenerateRequest(**_req())).source == "template"
    assert time.perf_counter() - start < .2
    assert calls == cancelled == [1]
    assert len(budget._reservations()) == 1


def test_real_async_sdk_slow_chunks_obey_overall_deadline(monkeypatch):
    calls = []
    body = json.dumps({"id": "test", "object": "chat.completion", "created": 1, "model": "test", "choices": [{"index": 0, "message": {"role": "assistant", "content": json.dumps(result())}, "finish_reason": "stop"}]}).encode()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_POST(self):
            calls.append(1)
            self.rfile.read(int(self.headers.get("content-length", "0")))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            for start in range(0, len(body), max(1, len(body)//10)):
                try:
                    self.wfile.write(body[start:start+max(1, len(body)//10)])
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError): break
                time.sleep(.15)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    monkeypatch.setattr(settings, "model_api_base", f"http://127.0.0.1:{server.server_port}/v1")
    monkeypatch.setattr(settings, "model_total_budget_seconds", 1.0)
    start = time.perf_counter()
    try:
        assert llm.generate_encounter(GenerateRequest(**_req())).source == "template"
        assert time.perf_counter() - start < 1.2
        assert calls == [1]
        assert len(budget._reservations()) == 1
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=1)


def test_request_disconnect_cancels_vendor_and_keeps_cost(monkeypatch):
    from app.api.routes import generate_encounter
    from app.core import security
    security._hits.clear()
    monkeypatch.setattr(settings, "access_code", "")
    monkeypatch.setattr(settings, "environment", "development")
    cancelled = []
    async def create(**kwargs):
        try: await asyncio.sleep(5)
        except asyncio.CancelledError: cancelled.append(1); raise
    fake_client(monkeypatch, create)
    class Request:
        client = SimpleNamespace(host="disconnect-test")
        async def is_disconnected(self):
            await asyncio.sleep(.04)
            return True
    start = time.perf_counter()
    response = asyncio.run(generate_encounter(GenerateRequest(**_req()), Request()))
    assert response.source == "template"
    assert time.perf_counter() - start < .2
    assert cancelled == [1]
    assert len(budget._reservations()) == 1


def test_invalid_environment_numeric_config_keeps_service_loadable(monkeypatch):
    import math
    from app.core.config import Settings
    for field in ["MONTHLY_BUDGET_RMB", "MODEL_INPUT_PRICE_PER_MTOK", "MODEL_OUTPUT_PRICE_PER_MTOK", "MODEL_TIMEOUT_SECONDS", "MODEL_TOTAL_BUDGET_SECONDS"]:
        monkeypatch.setenv(field, "invalid")
    parsed = Settings()
    assert math.isnan(parsed.monthly_budget_rmb)
    assert math.isnan(parsed.model_timeout_seconds)


def test_live_http_disconnect_cancels_sdk_before_total_deadline(isolated):
    """实际 Uvicorn、HTTP socket、AsyncOpenAI，客户端断开不靠 Request mock。"""
    import socket
    import urllib.request
    vendor_started = threading.Event()
    vendor_closed = threading.Event()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_POST(self):
            self.rfile.read(int(self.headers.get("content-length", "0")))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "1000")
            self.end_headers()
            vendor_started.set()
            for _ in range(40):
                try:
                    self.wfile.write(b" "); self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    vendor_closed.set(); return
                time.sleep(.1)
    vendor = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=vendor.serve_forever, daemon=True).start()
    with socket.socket() as free:
        free.bind(("127.0.0.1", 0)); port = free.getsockname()[1]
    script = """
import sys,uvicorn
from pathlib import Path
from app.services import budget
from app.main import app
budget._SPEND_FILE=Path(sys.argv[1])/"spend.json"
uvicorn.run(app,host="127.0.0.1",port=int(sys.argv[2]),log_level="warning")
"""
    env = {**os.environ, "MODEL_API_KEY": "test-only", "MODEL_API_BASE": f"http://127.0.0.1:{vendor.server_port}/v1", "MODEL_TIMEOUT_SECONDS": "2", "MODEL_TOTAL_BUDGET_SECONDS": "2", "MONTHLY_BUDGET_RMB": "1", "ACCESS_CODE": "", "ENVIRONMENT": "development"}
    proc = subprocess.Popen([sys.executable, "-c", script, str(isolated), str(port)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    connection = None
    try:
        for _ in range(80):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=.2): break
            except OSError:
                assert proc.poll() is None
                time.sleep(.05)
        else: pytest.fail("test server not ready")
        connection = socket.create_connection(("127.0.0.1", port), timeout=2)
        body = json.dumps(_req()).encode()
        connection.sendall(f"POST /api/v1/encounter/generate HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n".encode()+body)
        assert vendor_started.wait(3)
        start = time.perf_counter(); connection.close(); connection = None
        assert vendor_closed.wait(1)
        assert time.perf_counter() - start < 1
        items = json.loads((isolated / "reservations.json").read_text())
        assert len(items) == 1
        assert next(iter(items.values()))["status"] == "unknown"
    finally:
        if connection: connection.close()
        proc.terminate()
        try: proc.communicate(timeout=5)
        except subprocess.TimeoutExpired: proc.kill(); proc.communicate(timeout=5)
        vendor.shutdown(); vendor.server_close()
