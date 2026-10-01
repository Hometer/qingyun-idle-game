// 配置与动作的合成边界矩阵，不代表真实经济通关。
import * as e from '../../../frontend/src/engine/engine';
import { CONFIG } from '../../../frontend/src/engine/config';
import { writeFileSync } from 'node:fs';
const T=new Date(2026,9,1,10).getTime();
const out:any={};
function rich(){const s=e.createGame('矩阵角色','金','balanced',T);for(const k of Object.keys(s.resources))(s.resources as any)[k]=1e12;s.realm='hongmeng10';s.forge=6;s.library=7;s.encounter.guideDone=true;return s;}
out.content={realms:CONFIG.realms.length,maps:Object.keys(CONFIG.maps).length,sideNodes:Object.values(CONFIG.maps).flatMap(m=>Object.values(m.nodes)).filter((n:any)=>n.side).length,bosses:Object.keys(CONFIG.maps).filter(m=>e.mainNodeIds(m as any).length>0).length};
out.crafts=Object.entries(CONFIG.crafts).map(([id])=>{const s=rich();const r=e.craftEquipment(s,T,id);return {id,crafted:r.ok,roundtrip:r.ok&&e.importSave(e.exportSave(r.state)).ok};});
out.buildings=Object.keys(CONFIG.buildings).map(id=>{let s=rich();const max=(CONFIG.buildings as any)[id].levels.length;for(let i=0;i<max;i++){const r=e.upgradeBuilding(s,T,id as any);if(!r.ok)return {id,level:i,error:r.reason};s=r.state;}return{id,level:(s.buildings as any)[id],roundtrip:e.importSave(e.exportSave(s)).ok};});
for(const id of ['library','forge']){let s=rich();(s as any)[id]=0;const max=(CONFIG as any)[id].levels.length;for(let i=0;i<max;i++){const r=id==='library'?e.buildLibrary(s,T):e.buildForge(s,T);if(!r.ok)throw Error(r.reason);s=r.state;}out.buildings.push({id,level:(s as any)[id],roundtrip:e.importSave(e.exportSave(s)).ok});}
out.battles=[];
for(const [mid,map] of Object.entries(CONFIG.maps))for(const nid of Object.keys(map.nodes))for(const tactic of ['first','normal','break','guard']){
  const s=rich();s.equipment={weapon:'w_dadao',armor:'a_dadao',accessory:'c_hongmeng'};s.inventory.w_dadao=1;s.inventory.a_dadao=1;s.inventory.c_hongmeng=1;
  for(const nodes of Object.values(s.maps))for(const n of Object.values(nodes)){n.unlocked=true;n.cleared=true;}
  if(tactic==='first')s.maps[mid as keyof typeof s.maps][nid].cleared=false;
  const r=e.fightNode(s,T,mid as any,nid,tactic==='first'?'normal':'challenge',tactic==='first'?'normal':tactic as any);
  out.battles.push({mid,nid,tactic,ran:r.ok,won:r.won,roundtrip:r.ok&&e.importSave(e.exportSave(r.state)).ok});
}
out.pills=[];
for(let tier=1;tier<=4;tier++)for(const type of ['yangYuan','juLing','tribulation']){let s=rich();s.buildings.alchemyFurnace=6;const r=type==='tribulation'?e.craftPill(s,T,tier):e.craftGainPill(s,T,type as any,tier);if(!r.ok){out.pills.push({type,tier,error:r.reason});continue;}s=r.state;const use=type==='tribulation'?e.togglePreparePill(s,T,tier):e.useGainPill(s,T,type as any,tier);out.pills.push({type,tier,crafted:r.ok,used:use.ok,roundtrip:use.ok&&e.importSave(e.exportSave(use.state)).ok});}
out.techniques=Object.keys(CONFIG.techniques).map(id=>{let s=rich();for(const nodes of Object.values(s.maps))for(const node of Object.values(nodes)){node.unlocked=true;node.cleared=true;}s.learnedNewTechs=Object.keys(CONFIG.techniques).filter(k=>!['qingYun','xuanGui','poYue','juYuan'].includes(k));const select=e.setTechnique(s,T,id as any);if(!select.ok)return{id,error:select.reason};s=select.state;while((s.techniqueLevel as any)[id]<(CONFIG.techniques as any)[id].levels.length){const r=e.upgradeTechnique(s,T);if(!r.ok)return{id,error:r.reason};s=r.state;}return{id,level:(s.techniqueLevel as any)[id],roundtrip:e.importSave(e.exportSave(s)).ok};});
out.secretRealms=Object.keys(CONFIG.secretRealms).map(id=>{let s=rich();s.equipment={weapon:'w_dadao',armor:'a_dadao',accessory:'c_hongmeng'};s.inventory.w_dadao=1;s.inventory.a_dadao=1;s.inventory.c_hongmeng=1;const r=e.enterSecretRealm(s,T,id as any);return{id,ran:r.ok,won:r.state?.lastBattle?.won,secondBlocked:r.ok&&!e.enterSecretRealm(r.state,T,id as any).ok,roundtrip:r.ok&&e.importSave(e.exportSave(r.state)).ok};});
out.trials=CONFIG.realms.filter(r=>r.layer===10&&r.stage<20).map(realm=>{let s=rich();s.realm=realm.id as any;s.technique='xuanGui';s.techniqueLevel.xuanGui=12;s.equipment={weapon:'w_dadao',armor:'a_dadao',accessory:'c_jade'};s.inventory.w_dadao=1;s.inventory.a_dadao=1;s.inventory.c_jade=1;s.preparedPill=true;s.inventory.tribulationPill=1;for(const m of Object.values(s.maps))for(const n of Object.values(m)){n.unlocked=true;n.cleared=true;}const r=e.startCrossStageTrial(s,T);return{from:realm.id,ran:r.ok,to:r.state?.realm,success:r.ok&&r.state.realm!==realm.id,roundtrip:r.ok&&e.importSave(e.exportSave(r.state)).ok};});
const storyCfg=CONFIG.continuity.stories;
out.storyPaths=[];
for(const [storyId,story] of Object.entries(storyCfg))for(const [origin,eventId] of Object.entries(story.followUps))for(const option of Object.keys((CONFIG.encounters as any)[eventId].options)){const s=rich();s.encounter.pending={eventId,mapId:'map_qingyun'};s.encounter.continuity={storyId:storyId as any,originOptionId:origin,originDate:'2026-09-30',stage:'active'};const before=JSON.stringify(s.resources);const r=e.resolveEncounter(s,T,option);out.storyPaths.push({storyId,origin,eventId,option,ran:r.ok,noResourceReward:r.ok&&JSON.stringify(r.state.resources)===before,roundtrip:r.ok&&e.importSave(e.exportSave(r.state)).ok});}
writeFileSync('/tmp/qingyun-reviewed-matrix.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,Array.isArray(v)?{count:v.length,failures:v.filter((x:any)=>x.error||x.roundtrip===false||x.ran===false||x.crafted===false||x.used===false||x.success===false||x.noResourceReward===false)}:v])),null,2));
