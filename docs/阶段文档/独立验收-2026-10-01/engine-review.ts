// 隔离合成档，使用真实引擎；不写玩家存档，不调用模型。
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
const T = new Date(2026,9,1,10).getTime(), DAY=86400000;
const out: Record<string, unknown> = {};
const brief=(r: any)=>({ok:r.ok,reason:r.reason});
let early=e.createGame('候选复查','金','balanced',T);
early=e.fightNode(early,T,'map_qingyun','node_wolf').state;
out.earlyCandidates={realm:early.realm,candidates:early.commission.candidates.map(c=>({title:c.title,accept:brief(e.acceptCommission(early,T,c.id)),pred:c.mapId&&e.predictFight(early,c.mapId,c.nodeId!,'challenge').won}))};
let s=e.createGame('时间复查','金','balanced',T);
s.realm='zhuji1';for(const k of Object.keys(s.resources))(s.resources as any)[k]=1e7;
s=e.fightNode(s,T,'map_qingyun','node_wolf').state;
s=e.settle(s,T+DAY);
const c=s.commission.candidates.find(c=>c.kind==='battle')!;
s=e.acceptCommission(s,T+DAY,c.id).state!;
s=e.fightNode(s,T+DAY,c.mapId!,c.nodeId!,'challenge').state;
s=e.claimCommission(s,T+DAY,'b').state!;
const futureHistory=s.commission.history.length;
// 回拨后首通另一个节点，游戏正常首通路径会再次生成候选。
s=e.fightNode(s,T,'map_qingyun','node_side_1').state;
const backCandidate=s.commission.candidates.find(c=>c.kind==='battle')!;
const back=e.acceptCommission(s,T,backCandidate.id);
if(back.ok){s=e.fightNode(back.state!,T,backCandidate.mapId!,backCandidate.nodeId!,'challenge').state;s=e.claimCommission(s,T,'b').state!;}
out.clockRollback={futureHistory,backAccept:brief(back),historyAfter:s.commission.history.length,dates:s.commission.history.map(c=>new Date(c.claimedAt!).toISOString()),acceptedDate:s.commission.acceptedDate,validation:e.importSave(e.exportSave(s)).ok};
const corrupted=e.createGame('坏档结构','金','balanced',T) as any;
corrupted.commission.active={...c,status:'ready',progress:0,target:1};
const imported=e.importSave(JSON.stringify(corrupted));
out.inconsistentProgress={import:brief(imported),claim:imported.ok?brief(e.claimCommission(imported.state!,T,'b')):null};
out.roundtrip={fresh:brief(e.importSave(e.exportSave(e.createGame('新档','金','balanced',T)))),migrated:brief(e.importSave(e.exportSave(e.migrateSave(e.createGame('刷新','金','balanced',T)))))};
out.unwinnableCandidates=[];
for(const [mid,map] of Object.entries(CONFIG.maps)) {
 const nid=e.mainNodeIds(mid as any)[0];if(!nid)continue;
 const gate=(map.nodes as any)[nid].gate;
 const gi=CONFIG.realms.findIndex(r=>r.id===gate);
 for(let offset=0;offset<4;offset++) {
  let fixture=e.createGame('战斗候选','金','balanced',T);fixture.realm=CONFIG.realms[Math.min(gi+offset,CONFIG.realms.length-1)].id as any;
  fixture.maps[mid as keyof typeof fixture.maps][nid].unlocked=true;
  const f=e.fightNode(fixture,T,mid as any,nid);if(!f.won)continue;
  const b=f.state.commission.candidates.find(c=>c.kind==='battle');if(b&&!e.predictFight(f.state,b.mapId!,b.nodeId!,'challenge').won)(out.unwinnableCandidates as any[]).push({realm:f.state.realm,title:b.title,accept:brief(e.acceptCommission(f.state,T,b.id))});
 }
}
const noRev=e.createGame('缺修订号','金','balanced',T) as any;delete noRev.revision;
out.missingRevision={validation:e.validateSaveObject(structuredClone(noRev)),settledRevision:String(e.settle(e.migrateSave(noRev),T).revision)};
console.log(JSON.stringify(out,null,2));
