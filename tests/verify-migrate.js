// 存档迁移矩阵：空档 / 最小旧档 / v3 无董事会 / 仅 moneyScaled / 两段经济链 / 新档幂等
// 运行：node tests/verify-migrate.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const need=['board','managerCareer','scenario','mode','offers','transfers','yearReviews',
   'yearStages','listed','bids','academy','assistants','split','annualPts','achieved',
   'transferList','freeAgents','honors','history','fmvpHonor','cardLosers','extraDefs','retiredDefs'];

  // ① 空壳最小档（已带现役经济标记）：迁移后字段表齐全
  S={teamName:'空壳队',players:[],fund:100,moneyScaled:true,econReal:true};
  migrateSave();
  const miss=need.filter(k=>S[k]===undefined);
  if(miss.length)fail('①空壳档缺字段: '+miss.join(','));
  else if(S.v!==SAVE_VERSION)fail('①v 未推进: '+S.v);
  else if(S.wageCap!==150)fail('①工资帽未回落 150: '+S.wageCap);
  else if(S.mode!=='manager'||S.scenario!=='normal')fail('①默认 mode/scenario 异常');
  else log('①空壳档（econReal）：'+need.length+' 个关键字段齐全 · v='+S.v+' · 帽='+S.wageCap);

  // ② 已有值不被默认表覆盖
  S={teamName:'保值队',players:[],fund:777,scenario:'debt',mode:'coach',wageCap:120,
    board:{trust:88,kpi:{target:4},warn:0,fired:false,firedSeason:0,log:[]},
    moneyScaled:true,econReal:true,v:SAVE_VERSION};
  migrateSave();
  if(S.fund!==777||S.scenario!=='debt'||S.mode!=='coach'||S.wageCap!==120||S.board.trust!==88)
   fail('②已有值被覆盖: '+JSON.stringify({f:S.fund,sc:S.scenario,m:S.mode,cap:S.wageCap,t:S.board.trust}));
  else log('②已有值保留：fund/scenario/mode/wageCap/board.trust 均不被默认表覆盖');

  // ③ v3 无董事会 → MIGRATIONS[3] + 默认表
  S={teamName:'v3队',players:[],fund:500,v:3,moneyScaled:true,econReal:true};
  migrateSave();
  if(S.v!==SAVE_VERSION)fail('③v3 未升到当前: '+S.v);
  else if(!S.board||S.board.trust!==60)fail('③董事会未由 MIGRATIONS[3] 补齐: '+JSON.stringify(S.board));
  else if(S.fans!==8)fail('③fans 未按 v3 迁移给 8: '+S.fans);
  else log('③v3→v'+SAVE_VERSION+'：董事会 trust=60 · fans=8 · 剧本 normal');

  // ④ 仅 moneyScaled（无 econReal）→ 只走 ÷6
  S={teamName:'单段队',players:[{id:'p1',name:'甲',pos:'mid',wage:120,acqCost:600,attrs:{lane:70,farm:70,team:70,mind:70},heroPool:[{n:'貂蝉',lv:3}],sig:'貂蝉',injury:0,mvp:0,contract:2,retiring:false,age:20}],
    fund:1200,wageCap:180,v:SAVE_VERSION,moneyScaled:true};
  const wage0=S.players[0].wage;
  migrateSave();
  if(!S.econReal)fail('④econReal 未置位');
  else if(S.fund!==200)fail('④fund 1200÷6≠200: '+S.fund);
  else if(S.players[0].wage!==20)fail('④wage 120÷6≠20: '+S.players[0].wage);
  else if(S.wageCap!==30)fail('④cap 180÷6≠30（之后会被 <50 规则抬回 150）');
  else log('④仅 moneyScaled：fund 1200→200 · wage 120→20');

  // ⑤ 两段链：无 moneyScaled 无 econReal → ×10 再 ÷6
  S={teamName:'两段队',players:[{id:'p1',name:'乙',pos:'top',wage:10,attrs:{lane:70,farm:70,team:70,mind:70},heroPool:[],sig:null,injury:0,mvp:0,contract:2,retiring:false,age:22}],
    fund:800,wageCap:90,v:3};
  migrateSave();
  // 800×10=8000÷6≈1333；90×10=900÷6=150
  if(S.fund!==1333)fail('⑤两段链 fund 异常: '+S.fund+'（期望 1333）');
  else if(S.wageCap!==150)fail('⑤两段链 cap 异常: '+S.wageCap);
  else if(S.players[0].wage!==17)fail('⑤两段链 wage 异常: '+S.players[0].wage+'（10×10÷6）');
  else log('⑤两段链：fund 800→1333 · cap 90→150 · wage 10→17');

  // ⑥ 新档幂等：migrateSave 再跑一遍不改数值
  S=newState('幂等队','幂');fillRoster(S,'mid','mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  const snap=JSON.stringify({fund:S.fund,cap:S.wageCap,w:S.players.map(p=>p.wage),v:S.v,econ:!!S.econReal,ms:!!S.moneyScaled});
  migrateSave();
  const snap2=JSON.stringify({fund:S.fund,cap:S.wageCap,w:S.players.map(p=>p.wage),v:S.v,econ:!!S.econReal,ms:!!S.moneyScaled});
  if(snap!==snap2)fail('⑥幂等失败: '+snap+' → '+snap2);
  else log('⑥新档二次 migrateSave 幂等（fund/cap/工资/v 标记不变）');

  // ⑦ 字段表导出：SAVE_DEFAULTS 可被审计引用（键唯一）
  const keys=SAVE_DEFAULTS.map(r=>r[0]);
  const dup=keys.filter((k,i)=>keys.indexOf(k)!==i);
  if(dup.length)fail('⑦SAVE_DEFAULTS 键重复: '+dup.join(','));
  else if(keys.length<30)fail('⑦SAVE_DEFAULTS 过短: '+keys.length);
  else log('⑦SAVE_DEFAULTS：'+keys.length+' 项 · 键唯一 · 作为读档兜底唯一来源');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
