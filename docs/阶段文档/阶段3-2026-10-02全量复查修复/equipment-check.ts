import { readFileSync,writeFileSync } from 'node:fs';
import * as e from '../../../frontend/src/engine/engine';
const before=JSON.parse(readFileSync('/tmp/qingyun-fixes-20261002/actual-strong.json','utf8'));
const after=JSON.parse(readFileSync('/tmp/qingyun-fixes-20261002/actual-after-equip.json','utf8'));
const ui=JSON.parse(readFileSync('/tmp/qingyun-fixes-20261002/browser-equipment.json','utf8'));
const b=e.productionBreakdown(before),a=e.productionBreakdown(after);
const result={before:{cultivation:b.cultivationPerSec,spirit:b.spiritPerSec},after:{cultivation:a.cultivationPerSec,spirit:a.spiritPerSec},actualDelta:{cultivation:a.cultivationPerSec-b.cultivationPerSec,spirit:a.spiritPerSec-b.spiritPerSec},preview:ui.preview,equipped:after.equipment.weapon,importsValid:e.importSave(e.exportSave(before)).ok&&e.importSave(e.exportSave(after)).ok};
// actual-strong 在修炼室升级后导出；UI预览必须同阶段比较，不能把升级造成的增益算作换装。
if(!result.importsValid||after.equipment.weapon!=='w_bronze#2'||!ui.preview.some((x:string)=>x.includes('修为 -0.096/秒')&&x.includes('灵气 -0.02/秒')))throw Error('换装预览与实际下降不一致');
writeFileSync('docs/阶段文档/阶段3-2026-10-02全量复查修复/换装实测.json',JSON.stringify(result,null,2));console.log(result);
