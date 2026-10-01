// 审查复现脚本；只操作合成存档，不调用模型、不修改真实玩家数据。
// 从 frontend 运行：node node_modules/vite-node/vite-node.mjs ../docs/阶段文档/全局审查-2026-10-01/reproduce.ts
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
import { writeFileSync } from 'node:fs';
const T = new Date(2026, 9, 1, 10).getTime(), DAY = 86400000;
const out: Record<string, unknown> = {};
const fresh = () => e.createGame('审查角色', '金', 'balanced', T);
const rich = () => {
  const s = fresh();
  for (const k of Object.keys(s.resources)) (s.resources as any)[k] = 1e8;
  s.encounter.guideDone = true;
  return s;
};
const cleared = () => {
  const s = rich(); s.maps.map_qingyun.node_wolf.cleared = true;
  return s;
};
const claimBattle = (s: any, time: number) => {
  s = e.settle(s, time);
  const c = s.commission.candidates.find((c: any) => c.kind === 'battle');
  if (!c) throw new Error('缺战斗候选');
  const acc = e.acceptCommission(s, time, c.id);
  if (!acc.ok) throw new Error(acc.reason);
  const f = e.fightNode(acc.state, time, c.mapId!, c.nodeId!, 'challenge');
  const claim = e.claimCommission(f.state, time, 'b');
  if (!claim.ok) throw new Error(claim.reason);
  return claim.state;
};
// 正常玩家操作形成的存档无法导回。
{
  const s = rich(); s.realm = 'zhuji1'; s.buildings.alchemyFurnace = 1;
  const r = e.craftGainPill(s, T, 'yangYuan', 1);
  if (!r.ok) throw new Error(r.reason);
  out.gainPillRoundtrip = {inventory: r.state.inventory, imported: e.importSave(e.exportSave(r.state))};
}
{
  const s = rich(); s.spiritRoots = ['风']; s.resonance = '风'; s.firsts.suppressedFirstNodeOnce = true;
  const r = e.startLongTask(s, T, {type:'seclusion', durationMinutes:30, protection:false});
  if (!r.ok) throw new Error(r.reason);
  out.windRoundtrip = {minutes: (r.state.longTask!.endAt-T)/60000, imported:e.importSave(e.exportSave(r.state))};
}
// 跨日与回拨的真实确定性接口，不编辑委托进度。
{
  let s = cleared();
  s = claimBattle(s, T + DAY);
  s = claimBattle(s, T + 2*DAY);
  s = claimBattle(s, T + DAY);
  out.rollbackCommission = {claims:s.commission.history.map(c=>new Date(c.claimedAt!).toISOString()), date:s.commission.date};
}
{
  let s = e.settle(cleared(), T + DAY);
  const c = s.commission.candidates.find(c=>c.kind==='battle')!;
  const acc = e.acceptCommission(s,T+DAY,c.id); if (!acc.ok) throw new Error(acc.reason);
  s = acc.state;
  const f = e.fightNode(s,T+2*DAY,c.mapId!,c.nodeId!,'challenge');
  const claim = e.claimCommission(f.state,T+2*DAY,'a'); if(!claim.ok)throw new Error(claim.reason);
  out.crossDayAllowsAnother = {candidates:claim.state.commission.candidates.length, anotherAccepted:e.acceptCommission(claim.state,T+2*DAY,claim.state.commission.candidates[0].id).ok};
}
{
  const s = e.fightNode(fresh(), T, 'map_qingyun', 'node_wolf').state;
  out.firstClearCandidates = s.commission.candidates.map(c=>c.kind);
  const side = e.fightNode(fresh(),T,'map_qingyun','node_side_1').state;
  out.sideOnlyNextDayCandidates = e.settle(side,T+DAY).commission.candidates.map(c=>c.kind);
}
// 炼器数目与封存后的词条上限。
{
  const s = rich(); s.realm='zhuji1'; s.forge=1;
  const r = e.craftEquipment(s,T,'w_steel'); if(!r.ok)throw new Error(r.reason);
  out.craftDuplicate = Object.entries(r.state.inventory).filter(([id,n])=>id.startsWith('w_steel')&&n>0);
}
{
  let s = rich(); s.realm='hunyuan_daluo2'; s.forge=1;
  const r=e.craftEquipment(s,T,'w_hunyuan');if(!r.ok)throw new Error(r.reason);s=r.state;
  const id=Object.keys(s.itemInstances).find(k=>s.itemInstances[k].baseId==='w_hunyuan')!;
  const locked=e.lockAffix(s,T,id,s.itemInstances[id].affixes[0].id);if(!locked.ok)throw new Error(locked.reason);s=locked.state;
  for(let i=0;i<100;i++){
    const rr=e.reforgeEquipment(s,T,id);if(!rr.ok)throw new Error(rr.reason);s=rr.state;
    if(s.itemInstances[id].affixes.length>4){out.lockedAffixOverflow={iteration:i+1,count:s.itemInstances[id].affixes.length,imported:e.importSave(e.exportSave(s))};break;}
  }
}
// PRD 境界门槛与新字段校验。
{
  let s=rich();for(let i=0;i<8;i++){const r=e.upgradeBuilding(s,T,'cultivationRoom');if(!r.ok)throw new Error(r.reason);s=r.state;}
  out.earlyBuildingMax={realm:s.realm,level:s.buildings.cultivationRoom};
  s=rich();s.realm='zhuji1';for(let i=0;i<7;i++){const r=e.buildLibrary(s,T);if(!r.ok)throw new Error(r.reason);s=r.state;}
  out.earlyLibraryMax={realm:s.realm,level:s.library};
  s=rich();s.realm='lianxu2';s.forge=1;const r=e.craftEquipment(s,T,'w_xuwu');
  out.earlyForgeRecipe={forge:s.forge,crafted:r.ok};
}
{
  const s=rich();s.spiritRoots=['金','水'];s.resonance='金';s.realm='zhuji1';
  const r=e.marrow(s,T,'removeRoot','金');if(!r.ok)throw new Error(r.reason);
  out.removedRootResonance={roots:r.state.spiritRoots,resonance:r.state.resonance};
}
{
  const s=rich();(s.marrowHistory as any)=[null];const r=e.importSave(e.exportSave(s));
  out.nullMarrowAccepted=r.ok;
  writeFileSync('/tmp/qingyun-audit-null-marrow.json',e.exportSave(s));
  const s2=fresh();s2.spiritRoots=['金','金'];s2.resonance='雷';out.illegalRootsAccepted=e.importSave(e.exportSave(s2)).ok;
  const s3=fresh();delete (s3 as any).commission;out.currentMissingCommissionAccepted=e.importSave(e.exportSave(s3)).ok;
}
{
  const s=e.settle(cleared(),T+DAY);
  const c=s.commission.candidates.find(c=>c.kind==='battle')!;
  const a=e.acceptCommission(s,T+DAY,c.id);if(!a.ok)throw new Error(a.reason);
  const f=e.fightNode(a.state,T+DAY,c.mapId!,c.nodeId!,'challenge');
  const claimed=e.claimCommission(f.state,T+DAY,'b');if(!claimed.ok)throw new Error(claimed.reason);
  const edited=structuredClone(claimed.state);
  edited.commission.active=structuredClone(edited.commission.history[0]);
  edited.commission.active.status='ready';
  const imported=e.importSave(e.exportSave(edited));
  out.claimedCommissionReplayAccepted=imported.ok && e.claimCommission(imported.state,T+DAY,'b').ok;
}
{
  const s=fresh();s.schemaVersion=13;delete(s as any).spiritRoots;delete(s as any).resonance;
  const m=e.migrateSave(s);out.legacyRootDirectResonance=e.setResonance(m,T,'金').ok;
}
console.log(JSON.stringify(out,null,2));
// 浏览器导入所用的合成档，依次验证炼器入口和已确认的坏档崩溃。
{
  const s=rich();s.realm='zhuji1';s.forge=1;s.maps.map_qingyun.node_wolf.cleared=true;
  s.buildings.alchemyFurnace=1;
  s.lastSettledAt=Date.now();
  writeFileSync('/tmp/qingyun-audit-forge1.json',e.exportSave(s));
}
{
  let s=rich();s.realm='qi1';s.technique='qingYun';s.techniqueLevel.qingYun=3;
  const r=e.upgradeTechnique(s,T);if(!r.ok)throw new Error(r.reason);
  console.log(JSON.stringify({earlyTechniqueUpgrade:{realm:r.state.realm,level:r.state.techniqueLevel.qingYun}}));
}
