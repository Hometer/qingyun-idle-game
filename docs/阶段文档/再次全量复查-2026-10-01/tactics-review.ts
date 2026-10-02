// 合成边界测战术取舍，不把高资源样档当自然通关。
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
const T=new Date(2026,9,1,10).getTime();const out:any={cases:0,breakOnly:[],guardOnly:[],differences:{}};
for(const [mid,map] of Object.entries(CONFIG.maps))for(const [nid,node] of Object.entries(map.nodes)) {
 const gate=CONFIG.realms.findIndex(r=>r.id===node.gate);const stage=CONFIG.realms[gate].stage;
 for(let offset=0;offset<10;offset++)for(const tech of [null,'qingYun','xuanGui'] as const){
  const s=e.createGame('战术边界','金','balanced',T);s.realm=CONFIG.realms[Math.min(gate+offset,CONFIG.realms.length-1)].id as any;
  s.maps[mid as keyof typeof s.maps][nid].unlocked=true;s.maps[mid as keyof typeof s.maps][nid].cleared=true;s.daily.astrology={id:'none',used:false};s.technique=tech;if(tech)s.techniqueLevel[tech]=1;
  const preds=['normal','break','guard'].map(t=>e.predictFight(s,mid as any,nid,'challenge',t as any));out.cases++;
  const sample={stage,map:mid,node:nid,realm:s.realm,tech,won:preds.map(p=>p.won),rounds:preds.map(p=>p.log.filter(l=>/你出手|你暴击/.test(l)).length)};
  const range=stage<=3?'early':stage<=12?'middle':'late';
  if(preds[1].won&&!preds[0].won&&!preds[2].won&&out.breakOnly.filter((x:any)=>x.range===range).length<2)out.breakOnly.push({...sample,range});
  if(preds[2].won&&!preds[0].won&&!preds[1].won&&out.guardOnly.filter((x:any)=>x.range===range).length<2)out.guardOnly.push({...sample,range});
  const k=sample.won.join('/');out.differences[k]=(out.differences[k]||0)+1;
 }
}
console.log(JSON.stringify(out,null,2));
