// 仅使用合成存档；不修改实现、不调用模型、不写真实玩家数据库。
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
import { writeFileSync } from 'node:fs';
const T = new Date(2026, 9, 1, 10).getTime(), DAY = 86400000;
const out: Record<string, unknown> = {};
const fresh = () => e.createGame('复查角色', '金', 'balanced', T);
const rich = () => {
  const s = fresh();
  for (const k of Object.keys(s.resources)) (s.resources as unknown as Record<string, number>)[k] = 1e8;
  s.encounter.guideDone = true;
  return s;
};
const brief = (r: any) => ({ok:r.ok, reason:r.reason});
const check = (id: string, fn: () => unknown) => {
  try {out[id] = fn();} catch (err) {out[id] = {scriptError: String(err)};}
};
check('gainPillRoundtrip', () => {
  let s=rich();s.realm='zhuji1';s.buildings.alchemyFurnace=1;
  const c=e.craftGainPill(s,T,'yangYuan',1);if(!c.ok)throw Error(c.reason);
  s=e.useGainPill(c.state,T,'yangYuan',1).state!;
  return {zeroInventory:s.inventory.yangYuanDan_1,imported:brief(e.importSave(e.exportSave(s)))};
});
check('windAndLegacyTask', () => {
  const s=rich();s.spiritRoots=['风'];s.resonance='风';s.firsts.suppressedFirstNodeOnce=true;
  const r=e.startLongTask(s,T,{type:'seclusion',durationMinutes:30,protection:false});if(!r.ok)throw Error(r.reason);
  const old=structuredClone(r.state);old.schemaVersion=17;delete (old.longTask as any).effectiveMinutes;
  return {newImport:brief(e.importSave(e.exportSave(r.state))),legacyImport:brief(e.importSave(e.exportSave(old))),automaticMigrationMinutes:e.migrateSave(old).longTask?.effectiveMinutes};
});
check('dailyCommissionRoundtrip', () => {
  let s=rich();s.realm='zhuji1';s.maps.map_qingyun.node_wolf.cleared=true;
  s=e.settle(s,T+DAY);
  const c=s.commission.candidates.find(c=>c.kind==='battle')!;
  const a=e.acceptCommission(s,T+DAY,c.id);if(!a.ok)throw Error(a.reason);
  const f=e.fightNode(a.state,T+DAY,c.mapId!,c.nodeId!,'challenge');
  const claim=e.claimCommission(f.state,T+DAY,'b');if(!claim.ok)throw Error(claim.reason);
  s=e.settle(claim.state,T+2*DAY);
  const c2=s.commission.candidates.find(c=>c.kind==='battle')!;
  const a2=e.acceptCommission(s,T+2*DAY,c2.id);if(!a2.ok)throw Error(a2.reason);
  return {firstId:c.id,secondId:c2.id,secondDayImport:brief(e.importSave(e.exportSave(a2.state))),rollbackCandidates:e.settle(claim.state,T).commission.candidates.length};
});
check('uncompletableCommission', () => {
  const s=rich();s.buildings.cultivationRoom=3;s.maps.map_qingyun.node_wolf.cleared=true;
  const day=e.settle(s,T+DAY), c=day.commission.candidates.find(c=>c.kind==='craft')!;
  const accepted=e.acceptCommission(day,T+DAY,c.id);
  return {realm:day.realm,title:c.title,accepted:brief(accepted),action:brief(e.upgradeBuilding(accepted.state,T+DAY,'cultivationRoom'))};
});
check('candidateRefreshNotReturned', () => {
  const s=rich();s.maps.map_qingyun.node_wolf.cleared=true;
  const day=e.settle(s,T+DAY), c=day.commission.candidates.find(c=>c.kind==='craft')!;
  day.buildings.cultivationRoom=8;
  const a=e.acceptCommission(day,T+DAY,c.id);
  return {response:brief(a),returnedState:!!(a as any).state,originalCandidate:day.commission.candidates.find(x=>x.id===c.id)?.title};
});
check('multipleCommissionsSameDay', () => {
  let s=rich();s.realm='zhuji1';s.maps.map_qingyun.node_wolf.cleared=true;
  s=e.settle(s,T+DAY);
  const c=s.commission.candidates.find(c=>c.kind==='battle')!;
  s=e.acceptCommission(s,T+DAY,c.id).state!;
  s=e.fightNode(s,T+DAY,c.mapId!,c.nodeId!,'challenge').state;
  s=e.claimCommission(s,T+DAY,'b').state!;
  const first=e.fightNode(s,T+DAY,'map_qingyun','node_side_1');
  const c2=first.state.commission.candidates.find(c=>c.kind==='battle')!;
  const a=e.acceptCommission(first.state,T+DAY,c2.id);
  const battle=e.fightNode(a.state,T+DAY,c2.mapId!,c2.nodeId!,'challenge');
  const second=e.claimCommission(battle.state,T+DAY,'b');
  return {newFirstWin:first.won,secondAccepted:a.ok,secondClaimed:second.ok,sameDayClaims:second.state?.commission.history.map(c=>new Date(c.claimedAt!).toISOString())};
});
check('encounterRollback', () => {
  let s=rich();s.realm='zhuji1';s.encounter.lastTriggerDate='2026-10-03';s.encounter.triggeredToday=3;
  s.maps.map_qingyun.node_wolf.cleared=true;
  const original=Math.random;Math.random=()=>0;
  try { const f=e.fightNode(s,T+DAY,'map_qingyun','node_wolf');return {triggered:f.encounterTriggered,count:f.state.encounter.triggeredToday,date:f.state.encounter.lastTriggerDate}; }
  finally {Math.random=original;}
});
check('craftAndLockedAffixes', () => {
  let s=rich();s.realm='zhuji1';s.forge=1;
  s=e.craftEquipment(s,T,'w_steel').state!;
  const id=Object.keys(s.itemInstances).find(k=>s.itemInstances[k].baseId==='w_steel')!;
  s=e.lockAffix(s,T,id,s.itemInstances[id].affixes[0].id).state!;
  let max=0;
  for(let i=0;i<100;i++){const r=e.reforgeEquipment(s,T,id);if(!r.ok)throw Error(r.reason);s=r.state;max=Math.max(max,s.itemInstances[id].affixes.length);}
  return {steelInventory:Object.entries(s.inventory).filter(([k])=>k.startsWith('w_steel')),maxAffixes:max,imported:brief(e.importSave(e.exportSave(s)))};
});
check('earlyQuenching', () => {
  const s=rich();s.realm='yuanying2';s.forge=2;
  const c=e.craftEquipment(s,T,'w_yuanying');if(!c.ok)throw Error(c.reason);
  const id=Object.keys(c.state.itemInstances).find(k=>c.state.itemInstances[k].baseId==='w_yuanying')!;
  return {realm:c.state.realm,result:brief(e.quenchEquipment(c.state,T,id))};
});
check('growthGates', () => {
  const s=rich();s.buildings.cultivationRoom=3;
  const t=rich();t.technique='qingYun';t.techniqueLevel.qingYun=3;
  const f=rich();f.realm='lianxu2';f.forge=1;
  return {room:brief(e.upgradeBuilding(s,T,'cultivationRoom')),tech:brief(e.upgradeTechnique(t,T)),forge:brief(e.craftEquipment(f,T,'w_xuwu'))};
});
check('legacyRoots', () => {
  const s=fresh();s.schemaVersion=13;delete (s as any).spiritRoots;delete (s as any).resonance;
  const migrated=e.migrateSave(s);
  return {roots:migrated.spiritRoots,directResonance:brief(e.setResonance(migrated,T,'金'))};
});
check('badSaves', () => {
  const cases: Record<string,(s:any)=>void> = {
    nullMarrow:s=>s.marrowHistory=[null],duplicateRoots:s=>s.spiritRoots=['金','金'],
    missingRoots:s=>delete s.spiritRoots,missingMeridians:s=>delete s.meridians,
    invalidMeridians:s=>s.meridians='invalid',invalidComprehension:s=>s.comprehension='invalid',
    missingCommission:s=>delete s.commission,
    missingDailyGoals:s=>delete s.daily.goals,
    invalidDanCount:s=>s.daily.rewardedDan=-1,
    invalidQuench:s=>s.quenched=[null,123,'unknown'],
    fakeLearnedTechnique:s=>s.learnedNewTechs=['ningYing'],
    negativeMarrow:s=>s.marrowHistory=[{type:'unknown',from:'x',to:'y',spiritStone:-1,herb:-1,at:-1}],
    brokenTrialLog:s=>s.tribulationLog={waves:[null],log:[],success:true},
    missingDailyWeather:s=>s.daily.weather=null,
  };
  return Object.fromEntries(Object.entries(cases).map(([k,mutate])=>{const s=fresh();mutate(s);try{return [k,brief(e.importSave(e.exportSave(s)))];}catch(err){return [k,{threw:String(err)}];}}));
});
check('invalidCommissionReward', () => {
  const s=rich();s.maps.map_qingyun.node_wolf.cleared=true;
  const day=e.settle(s,T+DAY),c=day.commission.candidates[0];
  c.rewardA.cultivation=1e30;(c.rewardA as any).lingTaiJing=-100;c.action='nonexistent';
  return brief(e.importSave(e.exportSave(day)));
});
check('originRootAfterMarrow', () => {
  const s=rich();s.realm='zhuji1';s.spiritRoots=['金','水'];s.resonance='金';
  const r=e.marrow(s,T,'removeRoot','金');if(!r.ok)throw Error(r.reason);
  return {roots:r.state.spiritRoots,legacyFieldSentToAI:r.state.spiritRoot,resonance:r.state.resonance};
});
check('oldEquipmentMigration', () => {
  const s=fresh();s.schemaVersion=13;delete (s as any).itemInstances;
  const m=e.migrateSave(s);
  return {oldBase:s.equipment.weapon,newId:m.equipment.weapon,addedAffixes:Object.values(m.itemInstances).map(i=>i.affixes)};
});
check('oldMaterialMigration', () => {
  const s=rich();s.schemaVersion=13;s.realm='yuanying4';
  const mats=['lingTaiJing','yunHaiSui','buXiuJin','hunYuanYu','taiChuZiJing'];
  for(const k of mats) delete (s.resources as any)[k];
  const map=(CONFIG.maps as any).map_yuanying;
  const main=Object.entries(map.nodes).filter(([,v]:any)=>!v.side);
  const first=main[0][0],second=main[1][0];
  s.maps.map_yuanying[first].cleared=true;s.maps.map_yuanying[second].unlocked=true;
  s.equipment.weapon='w_dadao';s.inventory.w_dadao=1;
  s.equipment.armor='a_dadao';s.inventory.a_dadao=1;
  const m=e.migrateSave(s);
  const before=mats.map(k=>({key:k,value:(m.resources as any)[k]??'missing'}));
  const f=e.fightNode(m,T,'map_yuanying',second);
  return {before,won:f.won,afterMaterial:String(f.state.resources.lingTaiJing),imported:brief(e.importSave(e.exportSave(f.state)))};
});
// 合成浏览器样档，只写临时文件。
{
  const s=rich();s.realm='zhuji1';s.forge=1;s.library=2;
  s.buildings={cultivationRoom:3,spiritArray:3,spiritField:3,alchemyFurnace:3};
  s.comprehension='genius';s.technique='qingYun';s.techniqueLevel.qingYun=3;
  s.maps.map_qingyun.node_wolf.cleared=true;s.firsts.suppressedFirstNodeOnce=true;
  s.lastSettledAt=Date.now();
  writeFileSync('/tmp/qingyun-recheck-rich.json',e.exportSave(s));
  const broken=structuredClone(s);broken.daily.goals=undefined as any;
  writeFileSync('/tmp/qingyun-recheck-broken.json',e.exportSave(broken));
  const old=structuredClone(s);old.schemaVersion=17;
  const task=e.startLongTask(old,old.lastSettledAt,{type:'seclusion',durationMinutes:30,protection:false});
  delete (task.state!.longTask as any).effectiveMinutes;task.state!.schemaVersion=17;
  writeFileSync('/tmp/qingyun-recheck-v17-task.json',e.exportSave(task.state));
}
console.log(JSON.stringify(out,null,2));
writeFileSync('/tmp/qingyun-recheck-results.json',JSON.stringify(out,null,2));
