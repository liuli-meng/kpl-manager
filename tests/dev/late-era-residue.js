// 时代档残留探针：在现役档运行中 installEra 后再还原，看 AI 名册缓存是否被污染
const vm = require('vm');
const { makeDom, injectHelpers } = require('../harness');
const { dom } = makeDom();
injectHelpers(dom);

const PROBE = `
const issues=[];
S=newState('时代残留','⚔️');
fillRoster(S,'mid','star');
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};
initGroups(S);
// 预热：先在现役时代建 AI 名册
const r0=ensureAiRosters(S,'AG超玩会');
const names0=(r0||[]).map(p=>p.name).join(',');
const eraId=Object.keys(KPL_ERAS)[0];
// 模拟：游戏内点「历代联盟」→ 选时代（installEra），此时现役 S 仍在
installEra(eraId);
// 若此时任何渲染/战力计算触发 ensureAiRosters（例如 dual-tab / 热更 / 其它页）
let polluted=false;
try{
  // 清空缓存再建，模拟“从未缓存过”或被 clear 后重建
  S.aiRosters={};
  S.aiRosterDefs=null; // 强制从当前 AI_ROSTERS 拷贝（此刻=时代档！）
  const r1=ensureAiRosters(S,'AG超玩会');
  const names1=(r1||[]).map(p=>p.name).join(',');
  if(names1!==names0){polluted=true;issues.push('时代安装期重建名册：AG 阵容由「'+names0+'」变为「'+names1+'」');}
  // 检查 aiRosterDefs 是否被写成时代 id
  const defs=S.aiRosterDefs&&S.aiRosterDefs['AG超玩会'];
  const eraPool=new Set((KPL_ERAS[eraId].defs||[]).map(d=>d.id));
  const modernHit=(defs||[]).filter(id=>!eraPool.has(id)).length;
  const eraHit=(defs||[]).filter(id=>eraPool.has(id)).length;
  if(eraHit>0)issues.push('aiRosterDefs 被写入时代 def：eraHit='+eraHit+' modernHit='+modernHit+' era='+eraId);
}catch(e){issues.push('时代期重建 THROW: '+(e&&e.message||e));}
// cancelStartBack 等价：还原现役
installEra(null);
// 注意：cancelStartBack 不会清 S.aiRosters / S.aiRosterDefs
if(S.aiRosterDefs&&S.aiRosterDefs['AG超玩会']){
  const defs=S.aiRosterDefs['AG超玩会'];
  const eraPool=new Set((KPL_ERAS[eraId].defs||[]).map(d=>d.id));
  const eraHit=(defs||[]).filter(id=>eraPool.has(id)).length;
  if(eraHit>0)issues.push('还原后 aiRosterDefs 仍含时代 def（残留未清）：eraHit='+eraHit);
}
const rAfter=S.aiRosters['AG超玩会'];
if(rAfter){
  const namesAfter=rAfter.map(p=>p.name).join(',');
  if(namesAfter!==names0)issues.push('还原后 S.aiRosters 缓存仍是污染阵容：'+namesAfter);
}
// 进一步：不重置 aiRosterDefs，直接 ensure（应命中缓存）
const r2=ensureAiRosters(S,'AG超玩会');
issues.push('info: 预热='+names0+' | 污染后缓存='+(S.aiRosters['AG超玩会']||[]).map(p=>p.name).join(','));
// 再清缓存但保留被污染的 aiRosterDefs，看重建是否全是 null/青训
S.aiRosters={};
const r3=ensureAiRosters(S,'AG超玩会')||[];
const nullish=r3.filter(p=>!p||!p.name).length;
const tags=r3.map(p=>(p.tags||[]).join('/')).join('|');
if(r3.length && r3.every(p=>(p.tags||[]).includes('青训'))){
  issues.push('污染后重建：全为青训递补（原始 def 查不到）阵容='+r3.map(p=>p.name).join(','));
}
JSON.stringify({issues,eraId,names0});
`;
const raw = vm.runInContext(PROBE, dom);
const result = JSON.parse(raw);
console.log('时代:', result.eraId);
console.log('预热阵容:', result.names0);
result.issues.forEach(x => console.log(' - ' + x));
if (result.issues.filter(x => !x.startsWith('info:')).length) process.exitCode = 1;
