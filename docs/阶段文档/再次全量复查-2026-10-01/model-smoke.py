"""真实模型冒烟：沿用本地配置与现有预算，只发送合成角色最小上下文；额外总估算上限0.25元。"""
import json, sys, time, os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'backend'))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3]/'backend/.env')
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.schemas.encounter import GenerateRequest
from app.services import budget,fallback,llm,moderation
out={'keyConfigured':bool(settings.model_api_key),'events':[]};estimated=0.0
if settings.model_api_key:
 client=TestClient(app,raise_server_exceptions=False)
 for eid,t in fallback.TEMPLATES.items():
  if os.getenv('AUDIT_REMAINING_ONLY')=='1' and list(fallback.TEMPLATES).index(eid)<16:continue
  req=GenerateRequest(event_id=eid,character={'name':'山间旅人','realm':'鸿蒙道祖四层','spirit_root':'金'},map_id='map_qingyun',options=[{'option_id':oid,'label':label,'meaning':'按照固定事件选项行事'} for oid,label in t['options'].items()],recent_logs=[])
  estimate=2*budget.estimate_call_cost(llm._build_prompt(req),400)
  if estimated+estimate>0.25:out['stop']='本轮估算上限';break
  estimated+=estimate
  start=time.perf_counter()
  r=client.post('/api/v1/encounter/generate',json=req.model_dump(),headers={'x-access-code':settings.access_code})
  data=r.json();valid=moderation.validate_result(data,req)[0] if r.status_code==200 and data.get('source')=='model' else None
  out['events'].append({'event':eid,'http':r.status_code,'source':data.get('source'),'modelValidated':valid,'elapsedSeconds':round(time.perf_counter()-start,2)})
out['estimatedCeilingRmb']=round(estimated,6)
print(json.dumps(out,ensure_ascii=False,indent=2))
