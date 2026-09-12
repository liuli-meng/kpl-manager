// 开局剧本（难度档）回归：效果正确应用 / 不污染常规档 / 对应成就解锁 / 存档往返
// 运行：node tests/verify-scenario.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 剧本表完整性：id 唯一、都有 desc、apply 是函数
  const ids=SCENARIOS.map(s=>s.id);
  const bad=SCENARIOS.filter(s=>!s.id||!s.name||!s.desc||typeof s.apply!=='function');
  if(bad.length)fail('剧本字段残缺: '+JSON.stringify(bad.map(s=>s.id)));
  else if(new Set(ids).size!==ids.length)fail('剧本 id 重复');
  else if(scenarioById('不存在').id!=='normal')fail('未知剧本未回落常规档');
  else log('① 剧本表：'+SCENARIOS.length+' 个（'+ids.join('/')+'），未知 id 回落 normal');

  // ② 各剧本效果（用固定的假队精确断言，避免随机性干扰）
  const mk=()=>{S=newState('剧本队','x');fillRoster(S,'mid','star');return S;};
  const pick=id=>scenarioById(id);

  let s=mk();const f0=s.fund,c0=s.wageCap,p0=s.players.map(p=>overall(p));pick('normal').apply(s);
  if(s.fund!==f0||s.wageCap!==c0)fail('常规档被改动: fund '+f0+'→'+s.fund+' cap '+c0+'→'+s.wageCap);
  else log('② 常规开档：资金 '+s.fund+' / 工资帽 '+s.wageCap+'（与默认一致）');

  s=mk();pick('debt').apply(s);
  if(s.fund!==330||s.wageCap!==120)fail('财政危机效果错误: fund='+s.fund+' cap='+s.wageCap);
  else log('② 财政危机：资金 1300→'+s.fund+' · 工资帽 150→'+s.wageCap);

  s=mk();pick('cap').apply(s);
  if(s.wageCap!==90)fail('工资帽紧缩效果错误: '+s.wageCap);
  else log('② 工资帽紧缩：工资帽 150→'+s.wageCap);

  s=mk();const before=s.players.length;pick('exodus').apply(s);
  const hole=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
  if(s.players.length!==before-1)fail('核心出走未减员: '+before+'→'+s.players.length);
  else if(hole.length!==1)fail('核心出走应恰好空一个位置，实际 '+JSON.stringify(hole));
  else if(s.lineup.some(id=>!s.players.some(p=>p.id===id)))fail('核心出走后首发仍指向离队选手');
  else log('② 核心出走：'+before+'→'+s.players.length+' 人，空出 '+POS[hole[0]][0]+'，首发同步清理');

  s=mk();const pw0=s.players.map(p=>playerPower(p));
  pick('cursed').apply(s);
  const dropped=pw0.map((v,i)=>v-playerPower(s.players[i]));
  const low=s.players.some(p=>['lane','farm','team','mind'].some(k=>p.attrs[k]<40));
  if(dropped.some(d=>d<3))fail('无冠魔咒属性削减不足: '+JSON.stringify(dropped));
  else if(low)fail('属性削减越界（低于下限 40）');
  else log('② 无冠魔咒：全队战力各降 '+dropped.join('/')+'，属性不越界');

  // ③ createTeam 真开局链路：剧本经 _scenario 生效，且开局三步能识别空缺
  document.querySelector('#new-team-name').value='剧本队';
  _scenario='debt';createTeam();
  if(S.scenario!=='debt'||S.fund!==330||S.wageCap!==120)fail('createTeam 未应用剧本: '+S.scenario+'/'+S.fund+'/'+S.wageCap);
  else log('③ 自建开局（财政危机）：scenario='+S.scenario+' 资金 '+S.fund+' 工资帽 '+S.wageCap);
  _scenario='exodus';createTeam();
  const h2=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos));
  if(S.players.length!==4||h2.length!==1)fail('自建开局缺位逻辑未生效: 人数='+S.players.length+' 空缺='+JSON.stringify(h2));
  else if(S.players.some(p=>/^新人[0-9]+$/.test(p.name)))fail('开局出现占位名');
  else log('③ 自建开局（核心出走）：4 人 · 空出 '+POS[h2[0]][0]+' · 名字正常');
  _scenario='normal';

  // ④ 成就：对应剧本夺冠才解锁（跨剧本不得串）
  S=mk();S.scenario='debt';S.honors=[{season:1,title:'x',champion:true}];checkAchievements(S);
  if(!S.achieved.sc_debt)fail('财政危机夺冠未解锁 sc_debt');
  else if(S.achieved.sc_cap)fail('非对应剧本却解锁了 sc_cap（成就串档）');
  else log('④ 成就：debt 剧本夺冠 → 解锁「负债逆袭」，未误解锁其他剧本成就');
  S=mk();S.scenario='normal';S.honors=[{season:1,title:'x',champion:true}];checkAchievements(S);
  if(S.achieved.sc_debt||S.achieved.sc_exodus)fail('常规档夺冠误解锁剧本成就');
  else log('④ 成就：常规档夺冠不触发任何剧本成就');

  // ⑤ 存档往返：scenario 随存档保留，旧档缺字段回落 normal
  S=mk();S.scenario='cursed';
  const round=JSON.parse(JSON.stringify(S));S=round;migrateSave();
  if(S.scenario!=='cursed')fail('存档往返丢失 scenario: '+S.scenario);
  else log('⑤ 存档往返：scenario 保留为 '+S.scenario);
  const legacy=JSON.parse(JSON.stringify(mk()));delete legacy.scenario;legacy.v=SAVE_VERSION;
  S=legacy;migrateSave();
  if(S.scenario!=='normal')fail('缺 scenario 的旧档未经 normal 兜底: '+S.scenario);
  else log('⑤ 旧档兜底：缺 scenario 字段 → normal');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
