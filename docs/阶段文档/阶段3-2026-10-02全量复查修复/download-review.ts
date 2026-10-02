import { readFileSync } from 'node:fs';
import * as e from '../../../frontend/src/engine/engine';
const out=[];
for(const path of process.argv.slice(2)){
 const json=readFileSync(path,'utf8');const original=JSON.parse(json);const first=e.importSave(json);const second=first.ok?e.importSave(e.exportSave(first.state!)):null;
 const rawCount=Object.entries(original.inventory).reduce((sum,[k,v])=>sum+(k==='tribulationPill'?0:Number(v)),0);
 const newCount=first.ok?Object.entries(first.state!.inventory).reduce((sum,[k,v])=>sum+(k==='tribulationPill'?0:Number(v)),0):null;
 out.push({file:path.split('/').at(-1),bytes:Buffer.byteLength(json),firstImport:first.ok,secondImport:second?.ok,resourcesPreserved:first.ok&&JSON.stringify(first.state!.resources)===JSON.stringify(original.resources),identityPreserved:first.state?.id===original.id,realmPreserved:first.state?.realm===original.realm,inventoryCountPreserved:rawCount===newCount,commissionHistoryPreserved:first.ok&&JSON.stringify(first.state!.commission.history)===JSON.stringify(original.commission.history)});
}
console.log(JSON.stringify(out,null,2));
