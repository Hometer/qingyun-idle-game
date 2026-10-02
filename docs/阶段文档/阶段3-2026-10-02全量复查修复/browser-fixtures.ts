// 合成浏览器验收档；只用于 5189 隔离测试，不替换产品经理角色。
import { writeFileSync } from 'node:fs';
import * as engine from '../../../frontend/src/engine/engine';
const T=Date.now();
const rich=engine.createGame('修复验收角色','金','balanced',T);
rich.realm='zhuji1';
for(const key of Object.keys(rich.resources)) rich.resources[key as keyof typeof rich.resources]=1e6;
let strong=engine.fightNode(rich,T,'map_qingyun','node_wolf').state;
strong.encounter.pending=null;strong.encounter.guideDone=true;
strong=engine.refreshCommissionCandidates(strong,T);
strong.itemInstances={...strong.itemInstances,'w_bronze#1':{baseId:'w_bronze',affixes:[{id:'cultivationRate',value:.08},{id:'spiritRate',value:.08}]},'w_bronze#2':{baseId:'w_bronze',affixes:[]}};
strong.inventory['w_bronze#1']=1;strong.inventory['w_bronze#2']=1;strong.equipment.weapon='w_bronze#1';
const valid=engine.importSave(engine.exportSave(strong));if(!valid.ok)throw Error(valid.reason);
writeFileSync('/tmp/qingyun-fixes-20261002/strong.json',engine.exportSave(valid.state!));
console.log({valid:valid.ok,candidates:strong.commission.candidates.map(c=>({id:c.id,kind:c.kind,action:c.action,actionParam:c.actionParam}))});
