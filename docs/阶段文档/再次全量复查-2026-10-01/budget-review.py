"""隔离临时账本/假 SDK，不调用厂商，不修改真实预算。"""
import json, sys, tempfile, subprocess, concurrent.futures
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'backend'))
from app.core.config import settings
from app.services import budget,llm
from app.schemas.encounter import GenerateRequest
req=GenerateRequest(event_id='event_well',character={'name':'本轮审查','realm':'炼气一层','spirit_root':'金'},map_id='map_qingyun',options=[{'option_id':'well_a','label':'下井','meaning':'探查'},{'option_id':'well_b','label':'绕路','meaning':'离开'}])
payload={'event_id':'event_well','title':'古井奇遇','body':'山间古井寒气微浮，井壁苔痕依旧，似有幽微回声。','options':[{'option_id':'well_a','option_text':'下井一探'},{'option_id':'well_b','option_text':'绕路离开'}]}
out={}
with tempfile.TemporaryDirectory(prefix='qingyun-budget-again-') as tmp:
 path=Path(tmp)/'spend.json'
 with patch.object(settings,'model_api_key','local-test-placeholder'),patch.object(settings,'monthly_budget_rmb',.01),patch.object(budget,'_DATA_DIR',Path(tmp)),patch.object(budget,'_SPEND_FILE',path):
  path.write_text('{}');budget._pending=0
  fake=MagicMock();fake.chat.completions.create.side_effect=TimeoutError('local timeout')
  with patch.object(llm,'OpenAI',return_value=fake): r=llm.generate_encounter(req)
  out['sentButTimeout']={'source':r.source,'calls':fake.chat.completions.create.call_count,'spend':budget.current_spend_rmb(),'pending':budget._pending}
  path.write_text('{}');budget._pending=0
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:allowed=list(pool.map(budget.reserve,[.006,.006]))
  out['concurrentReservation']={'results':allowed,'allowedCount':sum(allowed)}
  path.write_text('{}');budget._pending=0
  child='''import sys,json,os
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from app.core.config import settings
from app.services import budget
settings.monthly_budget_rmb=.01
budget._SPEND_FILE=Path(sys.argv[2]);budget._DATA_DIR=budget._SPEND_FILE.parent
first=budget.reserve(.006);second=budget.reserve(.006)
print(json.dumps({'first':first,'second':second,'pending':budget._pending}),flush=True)
os._exit(0)
'''
  args=[sys.executable,'-c',child,str(Path(__file__).resolve().parents[3]/'backend'),str(path)]
  before=json.loads(subprocess.check_output(args));after=json.loads(subprocess.check_output(args))
  out['restartReservation']={'processBefore':before,'newProcessAfter':after,'ledger':json.loads(path.read_text())}
  path.write_text('{}');budget._pending=0
  fake=MagicMock();fake.chat.completions.create.return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload,ensure_ascii=False)))],usage=None)
  with patch.object(llm,'OpenAI',return_value=fake),patch.object(budget,'_save',side_effect=OSError('local disk error')):
   try:r=llm.generate_encounter(req);out['diskFailure']={'source':r.source}
   except Exception as ex:out['diskFailure']={'exception':type(ex).__name__,'calls':fake.chat.completions.create.call_count,'pending':budget._pending}
  out['followingDiskFailure']={'reserveAllowed':budget.reserve(.006),'spend':budget.current_spend_rmb()}
  for label,attr,value in [('nanBudget','monthly_budget_rmb',float('nan')),('negativePrice','model_input_price_per_mtok',-10)]:
   path.write_text('{}');budget._pending=0
   with patch.object(settings,attr,value):
    est=budget.estimate_call_cost('字'*1000,400)
    out[label]={'estimate':est,'reserveActualEstimateAllowed':budget.reserve(est),'pending':budget._pending,'additionalOverBudgetAllowed':budget.reserve(.02)}
print(json.dumps(out,ensure_ascii=False,indent=2))
