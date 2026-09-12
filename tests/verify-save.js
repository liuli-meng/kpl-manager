// 存档版本迁移回归：v 字段 / 旧档补 v / 迁移链推进 / 文件包装格式导入 / 新版本拒绝
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 新档自带版本号
  S=newState('版本队','验');
  if(S.v!==SAVE_VERSION)fail('①新档 v='+S.v+' 应为 '+SAVE_VERSION);
  else log('①新档自带 v='+S.v);

  // ② 旧档无 v 字段：迁移后补到当前版本，状态保留
  S.teamName='旧档队';delete S.v;
  S.fund=4321;
  migrateSave();
  if(S.v!==SAVE_VERSION||S.teamName!=='旧档队'||S.fund!==4321)fail('②旧档迁移异常: v='+S.v+' team='+S.teamName);
  else log('②无 v 旧档读入自动补 v='+S.v+'，字段保留');

  // ③ 迁移链：v 低于当前版本时逐级推进（当前 MIGRATIONS 为空框架，验证推进机制本身）
  S.v=1;
  migrateSave();
  if(S.v!==SAVE_VERSION)fail('③迁移链未推进到当前版本: v='+S.v);
  else log('③迁移链: v=1 逐级推进到 v='+S.v);

  // ④ 文件包装格式导入（exportSaveFile 的 {kplSave,data} 结构）
  // 桩掉渲染/落盘：被测对象是 applyImport 的校验与迁移，不是渲染管线（夹具字段刻意最小化）
  const _ra=renderAll,_sv=save;
  renderAll=function(){};save=function(){};
  const wrap={kplSave:true,v:SAVE_VERSION,exported:'2026-09-05',team:'文件队',season:3,data:{teamName:'文件队',players:[{id:'x'}],fund:999,season:3,moneyScaled:true,econReal:true}};
  applyImport(wrap,'测试文件');
  if(S.teamName!=='文件队'||S.fund!==999||S.v!==SAVE_VERSION)fail('④包装格式导入异常: '+S.teamName+'/'+S.fund);
  else log('④包装格式导入 OK（自动解包 data）');

  // ⑤ 比当前游戏新的存档：拒绝导入且不污染当前状态
  S=newState('现役队','现');S.fund=555;
  applyImport({teamName:'未来队',players:[],v:SAVE_VERSION+5},'未来存档');
  if(S.teamName!=='现役队'||S.fund!==555)fail('⑤新版本存档未被拒绝: '+S.teamName);
  else log('⑤比游戏更新的存档被拒绝，当前状态不受污染');

  // ⑥ 裸对象缺字段：拒绝
  applyImport({foo:1},'乱码');
  if(S.teamName!=='现役队')fail('⑥无效对象污染状态');
  else log('⑥无效对象被拒（缺 teamName/players）');
  renderAll=_ra;save=_sv;

  // ⑦ serializeForSave：aiRosters 不落盘，运行期缓存保留
  S=newState('瘦身队','瘦');fillRoster(S,'mid');
  S.aiRosters={'测试AI':[{id:'z'}]};
  const raw=serializeForSave(S);
  if(raw.includes('测试AI')||raw.includes('"aiRosters":{"'))fail('⑦aiRosters 不应写入序列化结果');
  else if(!S.aiRosters['测试AI'])fail('⑦序列化后运行期 aiRosters 缓存被清空（应保留）');
  else log('⑦serializeForSave：aiRosters 剔除 · 运行期缓存保留（读档由 migrateSave 重建）');

  // ⑧ nextDay 静默存档：_quietSave 时不写 localStorage
  S=newState('静默队','静');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.transferWindow=0;S.preseason=false;S.day=1;
  const key=slotKey();
  localStorage.removeItem(key);
  S._quietSave=true;
  nextDay(S);
  if(localStorage.getItem(key))fail('⑧_quietSave 下 nextDay 仍写盘');
  else{
   S._quietSave=false;
   save();
   if(!localStorage.getItem(key))fail('⑧解除静默后 save 未落盘');
   else log('⑧nextDay 静默：'+ (S._quietSave?'批量跳过期不写盘':'正常 save 落盘'));
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join(String.fromCharCode(10));
})()
`,dom);
console.log(out);
