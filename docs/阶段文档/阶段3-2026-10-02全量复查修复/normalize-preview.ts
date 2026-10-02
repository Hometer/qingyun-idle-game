// 只整理人工合成预览档；不改真实下载、玩家存档或引擎规则。
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import * as engine from '../../../frontend/src/engine/engine';
const dir = 'docs/阶段文档/阶段3-2026-10-02全量复查修复';
const path = 'docs/evidence/阶段3-2026-10-02全量复查修复/合成预览角色-未接委托.json';
const raw = readFileSync(path, 'utf8');
const result = engine.importSave(raw);
if (!result.ok) throw Error(result.reason);
copyFileSync(path, `${dir}/合成预览整理前.json`);
copyFileSync(`${dir}/交付存档验证.json`, `${dir}/交付存档验证-预览整理前.json`);
writeFileSync(path, engine.exportSave(result.state!));
