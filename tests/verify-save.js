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
  if(S.teamName!=='文件队'||S.fund!==5994||S.v!==SAVE_VERSION)fail('④包装格式导入异常: '+S.teamName+'/'+S.fund+'（旧档 fund 999 经 v2×6=5994）');
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

  // ⑥b 导入清洗（安全）：分享码是别人给的，队名/选手名/id 会直插 innerHTML 与内联 onclick。
  //     要求：标签注入与 onclick 引号逃逸必须被清掉，但长文本（比赛文案/履历）不得被误截断。
  const evil={kplSave:true,v:SAVE_VERSION,team:'x',data:{
    teamName:'<img src=x onerror=alert(1)>恶意队',
    players:[{id:"');alert(1);//",name:'<b>选手</b>',pos:'mid',career:'正常履历文本'}],
    fund:100,season:1,moneyScaled:true,econReal:true,
    series:{logs:['第1局 我方 9-13 憾负 对手 ｜ 总比分 0:1 红方 教科书级团战！ ｜ MVP：某某（9/3/9）'.repeat(3)]},
  }};
  applyImport(evil,'恶意存档');
  const evilTeam=S.teamName||'';
  const evilId=(S.players&&S.players[0]&&S.players[0].id)||'';
  const evilName=(S.players&&S.players[0]&&S.players[0].name)||'';
  const evilLog=(S.series&&S.series.logs&&S.series.logs[0])||'';
  if(evilTeam.indexOf('<')>=0||evilTeam.indexOf('>')>=0)fail('⑥b 队名未清洗标签注入: '+evilTeam);
  else if(evilName.indexOf('<')>=0)fail('⑥b 选手名未清洗:\u0020'+evilName);
  else if(/[^A-Za-z0-9_-]/.test(evilId))fail('⑥b 选手 id 仍含非法字符（可在 onclick 里引号逃逸）: '+evilId);
  else if(evilLog.length<150)fail('⑥b 长文本被误截断（比赛文案应保原样），实际 '+evilLog.length+' 字');
  else log('⑥b 导入清洗：标签注入与 id 引号逃逸已清掉 · 长文案完整保留（'+evilLog.length+' 字）');
  renderAll=_ra;save=_sv;

  // ⑦ serializeForSave：aiRosters 不落盘，运行期缓存保留
  S=newState('瘦身队','瘦');fillRoster(S,'mid');
  S.aiRosters={'测试AI':[{id:'z'}]};
  const raw=serializeForSave(S);
  if(raw.includes('测试AI')||raw.includes('"aiRosters":{"'))fail('⑦aiRosters 不应写入序列化结果');
  else if(!S.aiRosters['测试AI'])fail('⑦序列化后运行期 aiRosters 缓存被清空（应保留）');
  else log('⑦serializeForSave：aiRosters 剔除 · 运行期缓存保留（读档由 migrateSave 重建）');

  // ⑨ matches 同为派生索引（bracket 树 + series.mid 的投影），不落盘；运行期必须原样还原。
  // 注意：这里只断言「不落盘 + 内存不坏」。可重建性由 probe-matchstore 覆盖。
  S.matches={'m1':{a:'甲队',b:'乙队',r:null}};
  const raw2=serializeForSave(S);
  if(raw2.includes('"m1"'))fail('⑨matches 内容不应写入序列化结果');
  else if(!S.matches||!S.matches.m1)fail('⑨序列化后运行期 matches 被清空（应保留）');
  else log('⑨serializeForSave：matches 剔除 · 运行期索引保留（读档由 rebuildMatchStore 重灌）');

  // ⑨b transferList 不落盘（可重建缓存，占存档体积大头）
  S.transferList=[{id:'tl_x',name:'缓存选手',pos:'mid',base:[70,70,70,70]}];
  const raw3=serializeForSave(S);
  if(raw3.includes('tl_x'))fail('⑨btransferList 不应写入序列化结果');
  else if(!S.transferList.length)fail('⑨b序列化后运行期 transferList 被清空（应保留）');
  else log('⑨bserializeForSave：transferList 剔除 · 运行期缓存保留');

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

  // ⑩ 自由球员身份字段兜底：老档 freeAgents 缺 freeAgent/signCost/willingness → 读档补齐（且在当前刻度档上不被货币迁移再缩放）
  S=newState('兜底队','兜');fillRoster(S,'mid');
  S.moneyScaled=true;S.econReal=true;
  const faDef=PLAYER_POOL.find(d=>d.pos==='mid')||PLAYER_POOL[0];
  const faP=genSeasonPlayer(S,faDef);
  delete faP.freeAgent;delete faP.signCost;delete faP.willingness;
  S.freeAgents=[faP];
  migrateSave();
  const g=S.freeAgents[0];
  const wantCost=Math.round(valueOf(overall(faP))*0.58);
  if(g.freeAgent!==true)fail('⑩freeAgent 未补齐');
  else if(g.signCost!==wantCost)fail('⑩signCost 应为 '+wantCost+'（当前刻度 58 折），实际 '+g.signCost);
  else if(typeof g.willingness!=='number'||g.willingness<70||g.willingness>100)fail('⑩willingness 未补进口径区间[70,100]: '+g.willingness);
  else log('⑩自由球员兜底：freeAgent 补齐 · signCost='+g.signCost+' · willingness='+g.willingness);
  // ⑩b 已有有效字段不得被兜底覆盖
  const keepCost=Math.round(valueOf(overall(g))*0.7);
  S.freeAgents=[{...g,signCost:keepCost,freeAgent:true,willingness:88}];
  migrateSave();
  if(S.freeAgents[0].signCost!==keepCost||S.freeAgents[0].willingness!==88)fail('⑩b已有有效字段被覆盖: '+S.freeAgents[0].signCost+'/'+S.freeAgents[0].willingness);
  else log('⑩b已有有效字段保持（signCost='+keepCost+' · willingness=88 均不被改写）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join(String.fromCharCode(10));
})()
`,dom);
console.log(out);
