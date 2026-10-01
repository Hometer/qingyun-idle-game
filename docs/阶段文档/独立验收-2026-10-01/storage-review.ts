// 独立 fake IndexedDB，复现启动校验漏掉 revision 后的永久写入冲突。
import { indexedDB } from '../../../frontend/node_modules/fake-indexeddb';
import * as e from '../../../frontend/src/engine/engine';
import * as storage from '../../../frontend/src/engine/storage';
(globalThis as any).indexedDB=indexedDB;
const T=Date.now();const bad=e.createGame('修订号复查','金','balanced',T) as any;
delete bad.revision;
const accepted=e.validateSaveObject(structuredClone(bad));
await storage.persistSave(bad,0,0);
const load=await storage.loadSave();
const settled=e.settle(e.migrateSave(load.state!),T+1000);
const first=await storage.persistSave(settled,(load.state as any).revision,0);
const second=await storage.persistSave(e.settle(settled,T+2000),settled.revision,0);
const third=await storage.persistSave(e.settle(settled,T+3000),settled.revision,0);
console.log(JSON.stringify({startupValidationError:accepted,persistedRevision:String((await storage.loadSave()).state!.revision),startupWrite:first,firstAction:second,nextAction:third},null,2));
