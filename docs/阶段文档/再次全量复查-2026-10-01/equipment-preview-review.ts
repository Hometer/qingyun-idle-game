import * as e from '../../../frontend/src/engine/engine';
const T=new Date(2026,9,1,10).getTime();const s=e.createGame('换装比较','金','balanced',T);
s.itemInstances={'w_bronze#1':{baseId:'w_bronze',affixes:[{id:'cultivationRate',value:.08}]},'w_bronze#2':{baseId:'w_bronze',affixes:[]}};
s.inventory={'w_bronze#1':1,'w_bronze#2':1};s.equipment.weapon='w_bronze#1';
const next={...s,equipment:{...s.equipment,weapon:'w_bronze#2'}};
console.log(JSON.stringify({saveValid:e.importSave(e.exportSave(s)).ok,oldRate:e.productionBreakdown(s).cultivationPerSec,newRate:e.productionBreakdown(next).cultivationPerSec,actualDelta:e.productionBreakdown(next).cultivationPerSec-e.productionBreakdown(s).cultivationPerSec,uiDelta:s.itemInstances['w_bronze#2'].affixes.length?e.productionBreakdown(next).cultivationPerSec-e.productionBreakdown(s).cultivationPerSec:0},null,2));
