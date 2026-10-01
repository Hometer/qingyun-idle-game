"""临时账本和假 SDK，无外部请求、无真实费用。"""
import concurrent.futures
import json
import sys
import tempfile
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'backend'))
from app.core.config import settings
from app.services import budget,llm
from app.schemas.encounter import GenerateRequest
req=GenerateRequest(event_id='event_well',character={'name':'复查','realm':'炼气一层','spirit_root':'金'},map_id='map_qingyun',options=[{'option_id':'well_a','label':'下井','meaning':'探查'},{'option_id':'well_b','label':'绕路','meaning':'离开'}])
out={}
with tempfile.TemporaryDirectory(prefix='qingyun-safe-budget-audit-') as tmp:
 path=Path(tmp)/'spend.json'
 with patch.object(settings,'model_api_key','audit-placeholder'),patch.object(settings,'monthly_budget_rmb',0.01),patch.object(budget,'_DATA_DIR',Path(tmp)),patch.object(budget,'_SPEND_FILE',path):
  for name,content in [('broken','{bad'),('array','[]'),('badMonthlyValue',json.dumps({budget._month_key():'invalid'}))]:
   path.write_text(content)
   try:out[name]={'blocked':budget.budget_exceeded(0.001)}
   except Exception as err:out[name]={'exception':type(err).__name__}
  prompt=llm._build_prompt(req);estimate=budget.estimate_call_cost(prompt,400)
  initial=0.01-estimate
  path.write_text(json.dumps({budget._month_key():initial}))
  barrier=threading.Barrier(2)
  payload={'event_id':'event_well','title':'古井奇遇','body':'山间古井寒气微浮，井壁苔痕依旧，似有幽微回声。','options':[{'option_id':'well_a','option_text':'下井一探'},{'option_id':'well_b','option_text':'绕路离开'}]}
  def fake_call(**kwargs):
   barrier.wait(timeout=3)
   return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload,ensure_ascii=False)))],usage=SimpleNamespace(prompt_tokens=len(prompt),completion_tokens=400))
  fake=MagicMock();fake.chat.completions.create.side_effect=fake_call
  with patch.object(llm,'OpenAI',return_value=fake):
   with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda _:llm.generate_encounter(req),range(2)))
  out['concurrentBudget']={'budget':0.01,'initial':initial,'estimateEach':estimate,'calls':fake.chat.completions.create.call_count,'sources':[r.source for r in results],'spend':budget.current_spend_rmb()}
print(json.dumps(out,ensure_ascii=False,indent=2))
