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

  // ① 空壳最小档（已带现役经济标记，但无 econV2）：迁移后字段表齐全 + v2 年薪帽
  S={teamName:'空壳队',players:[],fund:100,moneyScaled:true,econReal:true};
  migrateSave();
  const miss=need.filter(k=>S[k]===undefined);
  if(miss.length)fail('①空壳档缺字段: '+miss.join(','));
  else if(S.v!==SAVE_VERSION)fail('①v 未推进: '+S.v);
  else if(S.wageCap!==ECON.wageCapDefault)fail('①工资帽未落到 v2 默认: '+S.wageCap);
  else if(!S.econV2)fail('①econV2 未置位');
  else if(S.mode!=='manager'||S.scenario!=='normal')fail('①默认 mode/scenario 异常');
  else log('①空壳档：'+need.length+' 个关键字段齐全 · v='+S.v+' · 年薪帽='+S.wageCap+' · econV2');

  // ② 已有值：结构字段不被默认表覆盖；经济字段走 v2 换算（无 econV2 时）
  S={teamName:'保值队',players:[],fund:777,scenario:'debt',mode:'coach',wageCap:120,
    board:{trust:88,kpi:{target:4},warn:0,fired:false,firedSeason:0,log:[]},
    moneyScaled:true,econReal:true,v:SAVE_VERSION};
  migrateSave();
  if(S.scenario!=='debt'||S.mode!=='coach'||S.board.trust!==88)
   fail('②结构字段被覆盖: '+JSON.stringify({sc:S.scenario,m:S.mode,t:S.board.trust}));
  else if(S.fund!==4662)fail('②fund 777×6≠4662: '+S.fund);
  else if(S.wageCap!==ECON.wageCapMin)fail('②周薪帽 120 未换算为年薪帽下限: '+S.wageCap);
  else log('②结构保留 · 经济 v2 换算：fund 777→'+S.fund+' · cap 120→'+S.wageCap);

  // ②b 已 econV2：经济值原样保留
  S={teamName:'v2队',players:[],fund:5000,scenario:'normal',mode:'manager',wageCap:2000,
    board:{trust:70,kpi:{target:4},warn:0,fired:false,firedSeason:0,log:[]},
    moneyScaled:true,econReal:true,econV2:true,v:SAVE_VERSION};
  migrateSave();
  if(S.fund!==5000||S.wageCap!==2000)fail('②b econV2 档被再次换算: '+S.fund+'/'+S.wageCap);
  else log('②b econV2 幂等：fund/cap 不再二次缩放');

  // ③ v3 无董事会 → MIGRATIONS[3] + 默认表
  S={teamName:'v3队',players:[],fund:500,v:3,moneyScaled:true,econReal:true,econV2:true};
  migrateSave();
  if(S.v!==SAVE_VERSION)fail('③v3 未升到当前: '+S.v);
  else if(!S.board||S.board.trust!==60)fail('③董事会未由 MIGRATIONS[3] 补齐: '+JSON.stringify(S.board));
  else if(S.fans!==8)fail('③fans 未按 v3 迁移给 8: '+S.fans);
  else log('③v3→v'+SAVE_VERSION+'：董事会 trust=60 · fans=8 · 剧本 normal');

  // ④ 仅 moneyScaled（无 econReal/econV2）→ ÷6 再 v2 年薪化
  S={teamName:'单段队',players:[{id:'p1',name:'甲',pos:'mid',wage:120,acqCost:600,attrs:{lane:70,farm:70,team:70,mind:70},heroPool:[{n:'貂蝉',lv:3}],sig:'貂蝉',injury:0,mvp:0,contract:2,retiring:false,age:20}],
    fund:1200,wageCap:180,v:SAVE_VERSION,moneyScaled:true};
  migrateSave();
  if(!S.econReal||!S.econV2)fail('④econReal/econV2 未置位');
  else if(S.fund!==1200)fail('④fund 1200÷6×6≠1200: '+S.fund);
  else if(S.wageCap!==ECON.wageCapMin)fail('④cap 180÷6=30 → v2 下限异常: '+S.wageCap);
  else log('④仅 moneyScaled：fund 1200→'+S.fund+' · cap→'+S.wageCap+' · wage 重估为年薪');

  // ⑤ 两段+v2 链：×10 → ÷6 → v2×6
  S={teamName:'两段队',players:[{id:'p1',name:'乙',pos:'top',wage:10,attrs:{lane:70,farm:70,team:70,mind:70},heroPool:[],sig:null,injury:0,mvp:0,contract:2,retiring:false,age:22}],
    fund:800,wageCap:90,v:3};
  migrateSave();
  // 800×10÷6×6=8000；cap 90×10÷6=150（周）→ ×8=1200（年）
  if(S.fund!==7998)fail('⑤全链 fund 异常: '+S.fund+'（期望 7998=800×10÷6×6）');
  else if(S.wageCap!==ECON.wageCapMin)fail('⑤全链 cap 异常: '+S.wageCap);
  else log('⑤全链：fund 800→'+S.fund+' · cap 90→'+S.wageCap+' · wage 重估年薪');

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

  // ⑧ 迁移链失败语义：某一步抛错时**不得推进版本号**
  //   旧行为是 catch 后照样 S.v++ → 该步永久跳过，半迁移的档被写回伪装成完整档，玩家数据拿不回来。
  (function(){
    const keep=MIGRATIONS[SAVE_VERSION-1];
    S=newState('迁移失败队','迁');
    S.v=SAVE_VERSION-1;S._migErr=null;
    MIGRATIONS[SAVE_VERSION-1]=()=>{throw new Error('__probe_mig__');};
    let threw=false;
    try{migrateSave();}catch(e){threw=true;}
    if(threw){MIGRATIONS[SAVE_VERSION-1]=keep;fail('⑧迁移抛错逃出了 migrateSave（应被兜住）');return;}
    if(S.v!==SAVE_VERSION-1){MIGRATIONS[SAVE_VERSION-1]=keep;fail('⑧迁移失败后版本号被推进了（应停在 '+(SAVE_VERSION-1)+'，实际 '+S.v+'）');return;}
    if(!S._migErr||S._migErr.indexOf('__probe_mig__')<0){MIGRATIONS[SAVE_VERSION-1]=keep;fail('⑧迁移失败未留痕 _migErr: '+S._migErr);return;}
    // 修好后重试：换成不抛错的实现，应能推进到当前版本（用空实现隔离，不依赖真实迁移对合成档的预期）
    MIGRATIONS[SAVE_VERSION-1]=()=>{};
    S.v=SAVE_VERSION-1;S._migErr=null;
    migrateSave();
    MIGRATIONS[SAVE_VERSION-1]=keep;
    if(S.v!==SAVE_VERSION)fail('⑧迁移修复后重试未推进到 v'+SAVE_VERSION+'（实际 '+S.v+'）');
    else log('⑧迁移链失败语义：失败即中止不推进版本号 · 留痕 _migErr · 修复后重试可推进');
  })();

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
