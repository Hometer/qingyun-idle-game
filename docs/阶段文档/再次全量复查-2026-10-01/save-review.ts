// 独立合成档与 fake IndexedDB；不访问浏览器玩家存档。
import * as e from '../../../frontend/src/engine/engine';
import * as storage from '../../../frontend/src/engine/storage';
import { indexedDB } from '../../../frontend/node_modules/fake-indexeddb';
const T=new Date(2026,9,1,10).getTime();
const fresh=()=>e.createGame('本轮合成档','金','balanced',T);
const out:any={validationExceptions:[],acceptedStartupFailures:[],acceptedRoundtripFailures:[],mutations:0};
const paths:string[][]=Object.keys(fresh()).map(k=>[k]);
for(const [k,v] of Object.entries(fresh())) if(v&&typeof v==='object'&&!Array.isArray(v)) for(const sub of Object.keys(v)) paths.push([k,sub]);
for(const path of paths) for(const value of [undefined,null,{},[],"invalid",-1]) {
 const s:any=fresh();let obj=s; for(const k of path.slice(0,-1))obj=obj[k];
 if(value===undefined)delete obj[path.at(-1)!];else obj[path.at(-1)!]=value;
 out.mutations++;
 try {
  const err=e.validateSaveObject(structuredClone(s)); if(err)continue;
  try {const migrated=e.migrateSave(s);const settled=e.settle(migrated,T+1000); e.playerStats(settled);const round=e.importSave(e.exportSave(settled));if(!round.ok)out.acceptedRoundtripFailures.push({path:path.join('.'),value:value===undefined?'missing':value,error:round.reason});}
  catch(ex){out.acceptedStartupFailures.push({path:path.join('.'),value:value===undefined?'missing':value,error:String(ex)});}
 }catch(ex){out.validationExceptions.push({path:path.join('.'),value:value===undefined?'missing':value,error:String(ex)});}
}
// 委托日期高水位：未来仅生成候选但未接取，回拨后仍不得接取。
let c=fresh();c.realm='zhuji1';c=e.fightNode(c,T,'map_qingyun','node_wolf').state;c=e.settle(c,T+86400000);
const rollback=e.acceptCommission(c,T,c.commission.candidates[0].id);
out.futureCandidateRollback={date:c.commission.date,acceptedDate:c.commission.acceptedDate,ok:rollback.ok,reason:rollback.reason};
if(rollback.ok){
 let back=rollback.state!;const ac=back.commission.active!;
 back=ac.kind==='battle'?e.fightNode(back,T,ac.mapId!,ac.nodeId!,'challenge').state:e.recordDailySettle(back,T);
 const claim=e.claimCommission(back,T,'b');
 if(claim.ok){back=e.fightNode(claim.state!,T+86400000,'map_qingyun','node_side_1').state;const cand2=back.commission.candidates[0];const acc2=cand2?e.acceptCommission(back,T+86400000,cand2.id):{ok:false};
  let second=acc2.ok?acc2.state!:back;if(acc2.ok){const ac2=second.commission.active!;second=ac2.kind==='battle'?e.fightNode(second,T+86400000,ac2.mapId!,ac2.nodeId!,'challenge').state:e.recordDailySettle(second,T+86400000);const claim2=e.claimCommission(second,T+86400000,'b');if(claim2.ok)second=claim2.state!;}
  out.futureCandidateRollback={...out.futureCandidateRollback,firstClaim:claim.ok,acceptAfterClockRestore:acc2.ok,historyCount:second.commission.history.length};
 }
}
const probe=(name:string,change:(s:any)=>void)=>{const s:any=fresh();change(s);try{const r=e.importSave(JSON.stringify(s));return {name,ok:r.ok,reason:r.reason};}catch(ex){return {name,exception:String(ex)};}};
out.commissionValidation=[
 probe('acceptedDate无效',s=>s.commission.acceptedDate='invalid'),
 probe('acceptedDate缺失',s=>delete s.commission.acceptedDate),
 probe('候选ready',s=>{s.commission.candidates[0].status='ready';s.commission.candidates[0].progress=1;}),
 probe('history未领奖',s=>s.commission.history=[s.commission.candidates[0]]),
 probe('无效制作参数',s=>{s.commission.candidates[0].action='upgradeBuilding';s.commission.candidates[0].actionParam='invalid';}),
];
const badWeather:any=fresh();badWeather.daily.weather={id:'unknown-weather',used:false};const wi=e.importSave(JSON.stringify(badWeather));
out.unknownWeather={importOk:wi.ok};if(wi.ok){try{e.recordDailySettle(wi.state!,T);out.unknownWeather.action='ok';}catch(ex){out.unknownWeather.actionError=String(ex);}}
(globalThis as any).indexedDB=indexedDB;
const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('qingyun_save',1);r.onupgradeneeded=()=>r.result.createObjectStore('save');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const put=async(key:string,value:any)=>new Promise<void>((resolve,reject)=>{const t=db.transaction('save','readwrite');t.objectStore('save').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});
out.meta=[];
for(const value of [{generation:'bad'},{generation:-1},{generation:NaN},{generation:1.5},{}]){
 await put('meta',value);await put('current',fresh());const load=await storage.loadSave();
 const write=await storage.persistSave(e.settle(load.state!,T+1000),load.state!.revision,load.generation);
 const replacement=await storage.replaceSave(fresh(),load.generation);
 const load2=await storage.loadSave();
 out.meta.push({input:String(value.generation),loaded:String(load.generation),write,replacement:{...replacement,generation:String(replacement.generation)},persistedGeneration:String(load2.generation)});
}
console.log(JSON.stringify(out,null,2));db.close();
