// 合法暴击词条+普通可胜的边界角色；只改变随机序列，不改战斗配置。
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
const T=new Date(2026,9,1,10).getTime();const original=Math.random;let found:any=null;
try {
 for(const [mid,map] of Object.entries(CONFIG.maps))for(const [nid,node] of Object.entries(map.nodes)){
  if(found)continue;const gate=CONFIG.realms.findIndex(r=>r.id===node.gate);
  for(let offset=0;offset<8&&!found;offset++){
   const s=e.createGame('暴击候选边界','金','balanced',T);s.realm=CONFIG.realms[Math.min(gate+offset,199)].id as any;
   s.itemInstances={'w_bronze#1':{baseId:'w_bronze',affixes:[{id:'critRate',value:.1}]}};s.inventory={'w_bronze#1':1};s.equipment.weapon='w_bronze#1';s.maps[mid as keyof typeof s.maps][nid]={unlocked:true,cleared:true};s.daily.astrology={id:'none',used:false};
   Math.random=()=>.999;const normal=e.predictFight(s,mid as any,nid,'normal');const low=e.predictFight(s,mid as any,nid,'challenge');Math.random=()=>0;const high=e.predictFight(s,mid as any,nid,'challenge');
   if(!normal.won||low.won||!high.won)continue;
   const candidates=e.settle(s,T+86400000);const c=candidates.commission.candidates.find(c=>c.mapId===mid&&c.nodeId===nid);if(!c)continue;
   Math.random=()=>.999;const accepted=e.acceptCommission(candidates,T+86400000,c.id);
   found={realm:s.realm,map:mid,node:nid,normalWon:normal.won,challengeNoCritWon:low.won,challengeCritWon:high.won,generatedTitle:c.title,acceptOk:accepted.ok,reason:accepted.reason,saveValid:e.importSave(e.exportSave(candidates)).ok};
  }
 }
}finally{Math.random=original;}
console.log(JSON.stringify(found,null,2));
