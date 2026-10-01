"""临时账本和本机假 API，无真实模型请求，不改实际账本。"""
import json, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'backend'))
from app.core.config import settings
from app.services import budget,llm
from app.schemas.encounter import GenerateRequest
req=GenerateRequest(event_id='event_well',character={'name':'验收','realm':'炼气一层','spirit_root':'金'},map_id='map_qingyun',options=[{'option_id':'well_a','label':'下井','meaning':'探查'},{'option_id':'well_b','label':'绕路','meaning':'离开'}])
payload={'event_id':'event_well','title':'古井奇遇','body':'山间古井寒气微浮，井壁苔痕依旧，似有幽微回声。','options':[{'option_id':'well_a','option_text':'下井一探'},{'option_id':'well_b','option_text':'绕路离开'}]}
out={}
with tempfile.TemporaryDirectory(prefix='qingyun-budget-verify-') as tmp:
 path=Path(tmp)/'spend.json'
 with patch.object(settings,'model_api_key','local-test-placeholder'),patch.object(settings,'monthly_budget_rmb',0.01),patch.object(budget,'_DATA_DIR',Path(tmp)),patch.object(budget,'_SPEND_FILE',path):
  for name,value in [('broken','{bad'),('array','[]'),('nan',json.dumps({budget._month_key():float('nan')})),('negative',json.dumps({budget._month_key():-100}))]:
   path.write_text(value);budget._pending=0
   out[name]={'blocked':budget.budget_exceeded(0.02),'reserveAllowed':budget.reserve(0.02)}
  budget._pending=0;path.write_text('{}')
  fake=MagicMock();fake.chat.completions.create.return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload,ensure_ascii=False)))],usage=None)
  with patch.object(llm,'OpenAI',return_value=fake):
   result=llm.generate_encounter(req)
  out['missingUsage']={'source':result.source,'calls':fake.chat.completions.create.call_count,'spend':budget.current_spend_rmb(),'pending':budget._pending}
  # 实际 OpenAI SDK连接本机 HTTP 服务，每段间隔小于单次 read timeout，整体超过前端4秒。
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    self.rfile.read(int(self.headers.get('Content-Length','0')))
    response=json.dumps({'id':'local','object':'chat.completion','created':1,'model':'test','choices':[{'index':0,'message':{'role':'assistant','content':json.dumps(payload,ensure_ascii=False)},'finish_reason':'stop'}],'usage':{'prompt_tokens':100,'completion_tokens':50,'total_tokens':150}}).encode()
    self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(response)));self.end_headers()
    chunks=[response[i:i+len(response)//8+1] for i in range(0,len(response),len(response)//8+1)]
    for chunk in chunks:
     self.wfile.write(chunk);self.wfile.flush();time.sleep(0.65)
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   path.write_text('{}');budget._pending=0
   with patch.object(settings,'model_api_base',f'http://127.0.0.1:{server.server_port}/v1'),patch.object(settings,'model_timeout_seconds',1.8):
    start=time.perf_counter();result=llm.generate_encounter(req);elapsed=time.perf_counter()-start
   out['slowLocalSdk']={'elapsedSeconds':round(elapsed,2),'frontendTimeoutSeconds':4,'source':result.source,'spend':budget.current_spend_rmb()}
  finally:server.shutdown();server.server_close()
print(json.dumps(out,ensure_ascii=False,indent=2))
