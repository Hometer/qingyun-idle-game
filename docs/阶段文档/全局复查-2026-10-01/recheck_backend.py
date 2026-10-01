"""使用临时账本与假 SDK；无网络、无真实费用。"""
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'backend'))
from app.core.config import settings
from app.schemas.encounter import GenerateRequest
from app.services import budget, llm, moderation, fallback
from app.main import app
from fastapi.testclient import TestClient

req = GenerateRequest(event_id='event_well', character={'name':'复查角色','realm':'炼气一层','spirit_root':'金'},map_id='map_qingyun',options=[{'option_id':'well_a','label':'探查井底','meaning':'冒险下井'},{'option_id':'well_b','label':'绕行而去','meaning':'绕路离开'}],recent_logs=[])
out = {}
with tempfile.TemporaryDirectory(prefix='qingyun-recheck-budget-') as tmp:
    path = Path(tmp) / 'spend.json'
    with patch.object(settings,'model_api_key','audit-placeholder'), patch.object(settings,'monthly_budget_rmb',0.01), patch.object(budget,'_DATA_DIR',Path(tmp)), patch.object(budget,'_SPEND_FILE',path):
        fake = MagicMock()
        fake.chat.completions.create.return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='invalid-json'))],usage=SimpleNamespace(prompt_tokens=1000,completion_tokens=400))
        estimate=budget.estimate_call_cost(llm._build_prompt(req),400)
        path.write_text(json.dumps({budget._month_key():0.01-estimate}),encoding='utf-8')
        with patch.object(llm,'OpenAI',return_value=fake):
            result=llm.generate_encounter(req)
        out['retryAfterBudgetCrossed']={'source':result.source,'calls':fake.chat.completions.create.call_count,'spend':budget.current_spend_rmb(),'budget':0.01}
        path.write_text('{bad-json',encoding='utf-8')
        out['corruptLedger']={'currentSpend':budget.current_spend_rmb(),'blocked':budget.budget_exceeded(0.001)}
        path.write_text('[]',encoding='utf-8')
        try:
            budget.current_spend_rmb()
        except Exception as err:
            out['wrongShapeLedger']={'exception':type(err).__name__}
        path.write_text('{}',encoding='utf-8')
        payload={'event_id':'event_well','title':'古井奇遇','body':'你沿着山间小径缓缓前行，井边清风吹过，似有旧日回声。','options':[{'option_id':'well_a','option_text':'获得灵石奖励'},{'option_id':'well_b','option_text':'剖腹肢解'}]}
        out['unsafeOptionText']={'validation':moderation.validate_result(payload,req)}
        fake.chat.completions.create.return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload,ensure_ascii=False)))],usage=SimpleNamespace(prompt_tokens=100,completion_tokens=100))
        with patch.object(llm,'OpenAI',return_value=fake):
            result=llm.generate_encounter(req)
        out['unsafeOptionResult']={'source':result.source}

client=TestClient(app,raise_server_exceptions=False)
out['unknownApi']={'status':client.get('/api/v1/missing').status_code,'body':client.get('/api/v1/missing').json()}
out['templateMatrix']=[]
with patch.object(settings,'model_api_key',''):
    for event_id, template in fallback.TEMPLATES.items():
        sample=req.model_copy(update={'event_id':event_id,'options':[
            type(req.options[0])(option_id=oid,label=label,meaning='固定分支')
            for oid,label in template['options'].items()]})
        result=llm.generate_encounter(sample)
        out['templateMatrix'].append({'eventId':event_id,'source':result.source,'optionIdsMatch':{o.option_id for o in result.options}==set(template['options'])})
print(json.dumps(out,ensure_ascii=False,indent=2))
Path('/tmp/qingyun-recheck-backend-results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
