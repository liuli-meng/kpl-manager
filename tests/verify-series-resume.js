// P2-7：续赛判定必须校验系列赛身份（mid/poSlot）——stage 相同但身份不符的「僵尸系列赛」
// 必须废弃重开，否则旧比分会把结果写进错误的对阵（常规/卡位/季后三条路径同构）。
// 配套 L2b：常规赛 schedule 进扁平表 mid（genRoundSchedule 发证 / rebuildMatchStore 旧档补写 /
// rebindSeriesMatch 旧档进行中 series 按 matchIdx 对齐接上）。
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');
const { dom } = makeDom();
injectHelpers(dom);

const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);
  const fail=m=>errs.push(m);
  const ok=(c,m)=>{if(c)log(m);else fail(m);};

  // ---------- ① 常规赛赛程发 mid 且进扁平表 ----------
  S=newState('续赛测试','x');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;
  ok((S.schedule||[]).length===5,'① 赛程 5 场（实际 '+(S.schedule||[]).length+'）');
  ok(S.schedule.every((m,i)=>m.mid==='reg_r1_'+(i+1)),'① 每场对阵有 reg_r1_i 形态 mid：'+JSON.stringify((S.schedule||[]).map(m=>m.mid)));
  ok(S.schedule.every(m=>getMatch(S,m.mid)===m),'① 每场都能以 mid 从扁平表取回同一对象');

  // ---------- ② startMatch 建 series 带 mid；赛中存档往返后续打 ----------
  startMatch();
  ok(S.series&&S.series.mid==='reg_r1_1','② startMatch 后 series.mid=reg_r1_1（实际 '+(S.series&&S.series.mid)+'）');
  S.series.mw=1;S.series.ow=0; // 模拟已打一局
  S=JSON.parse(serializeForSave(S));
  migrateSave(); // 真实读档路径
  ok(S.series&&S.series.mid==='reg_r1_1','② 读档后 series.mid 保留（实际 '+(S.series&&S.series.mid)+'）');
  ok((S.schedule[0]||{}).mid==='reg_r1_1','② 读档后 schedule mid 保留');
  ok(resolveSeriesMatch(S,S.series)===S.schedule[0],'② 读档后 mid 解析落回首场对阵对象');
  startMatch();
  ok(S.series&&S.series.mw===1&&S.series.mid==='reg_r1_1','② 续赛保持比分 1:0 与 mid');
  ok((window._prepTitle||'').indexOf('第2局')>=0,'② 续赛标题应为第2局（实际：'+window._prepTitle+'）');

  // ---------- ③ 僵尸常规赛系列赛（mid 对不上）→ 废弃重开 ----------
  S.series={used:[],usedOpp:[],mw:2,ow:0,max:5,stage:'regular',mid:'reg_r1_99',logs:[],myName:S.teamName,opName:'幽灵队',side:'blue'};
  const logN=S.eventLog.length;
  startMatch();
  ok(S.series&&S.series.mid==='reg_r1_1','③ 僵尸系列赛废弃、落在当前对阵（实际 mid='+(S.series&&S.series.mid)+'）');
  ok(S.series&&S.series.mw===0&&S.series.ow===0,'③ 僵尸比分不得带入新系列赛');
  ok(S.eventLog.length>logN&&S.eventLog.slice(0,6).some(l=>/赛程修复/.test(l.txt||l)),'③ 废弃必须 logEvent 留痕');

  // ---------- ④ 完赛写回：经 mid 解析落到正确 schedule 条目 ----------
  S.series.mw=3;S.series.ow=1;
  finishSeries(true);
  ok(S.schedule[0].result==='W'&&S.schedule[0].myScore===3&&S.schedule[0].opScore===1,'④ 结果写回 reg_r1_1（实际 '+JSON.stringify({r:S.schedule[0].result,my:S.schedule[0].myScore,op:S.schedule[0].opScore})+'）');
  ok(S.matchIdx===1,'④ matchIdx 推进到 1（实际 '+S.matchIdx+'）');

  // ---------- ⑤ 旧档迁移：无 mid 的 schedule + 无 mid 的进行中 series ----------
  (S.schedule||[]).forEach(m=>{delete m.mid;});
  S.series={used:[],usedOpp:[],mw:1,ow:1,max:5,stage:'regular',logs:[],myName:S.teamName,opName:S.schedule[1].opp,side:'blue'};
  S=JSON.parse(serializeForSave(S));
  migrateSave();
  ok((S.schedule[1]||{}).mid==='reg_r1_2','⑤ 旧档 schedule 读档补 mid（实际 '+(S.schedule[1]||{}).mid+'）');
  ok(S.series&&S.series.mid==='reg_r1_2','⑤ 旧档进行中 series 按 matchIdx 对齐补 mid（实际 '+(S.series&&S.series.mid)+'）');
  startMatch();
  ok(S.series&&S.series.mw===1&&S.series.ow===1,'⑤ 旧档续赛保持比分 1:1（实际 '+(S.series?S.series.mw+':'+S.series.ow:'null')+'）');

  // ---------- ⑥ 推进到卡位赛：僵尸 card 残影废弃 ----------
  let g=0;
  while(!['playoff','card','champion','eliminated'].includes(S.phase)&&g++<80){
    if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
    const mm=S.schedule[S.matchIdx];
    S.series={used:[],usedOpp:[],mw:3,ow:1,max:5,stage:'regular',mid:mm.mid,logs:[],myName:S.teamName,opName:mm.opp,side:'blue'};
    finishSeries(true);
  }
  log('⑥ 常规赛推进完 phase='+S.phase);
  if(S.phase==='card'){
    const my=(S.card.matches||[]).find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
    if(my){
      S.series={used:[],usedOpp:[],mw:2,ow:0,max:7,stage:'card',mid:'card_999',cardIdx:999,logs:[],myName:S.teamName,opName:my.a===S.teamName?my.b:my.a,side:'blue'};
      startCard();
      ok(S.series&&S.series.mid==='card_'+S.card.idx,'⑥ 卡位僵尸废弃、落在当前场次（实际 '+(S.series&&S.series.mid)+'）');
      ok(S.series&&S.series.mw===0,'⑥ 卡位僵尸比分不得带入');
      S.series.mw=4;S.series.ow=1;finishSeries(true); // 打完这场，避免带着进行中 series 进季后赛段
      let c=0;while(S.phase==='card'&&c++<10){startCard();if(S.series){S.series.mw=4;S.series.ow=1;finishSeries(true);}}
    }else log('⑥ 卡位赛无我方场次（排名直入），跳过僵尸用例');
  }else log('⑥ 未进入卡位赛（phase='+S.phase+'），跳过僵尸用例');

  // ---------- ⑥b 卡位赛僵尸用例（确定性构造，不依赖排名运气） ----------
  S.phase='card';
  S.card={idx:1,matches:[{a:'广州TTG',b:'佛山DRG',r:'广州TTG'},{a:S.teamName,b:'重庆狼队',r:null}]};
  S.series={used:[],usedOpp:[],mw:2,ow:0,max:7,stage:'card',mid:'card_0',cardIdx:0,logs:[],myName:S.teamName,opName:'重庆狼队',side:'blue'};
  startCard();
  ok(S.series&&S.series.mid==='card_1','⑥b 卡位僵尸废弃、落在当前场次 card_1（实际 '+(S.series&&S.series.mid)+'）');
  ok(S.series&&S.series.mw===0,'⑥b 卡位僵尸比分不得带入');
  S.series=null;S.card=null;S.phase='playoff'; // 清场，进⑦

  // ---------- ⑦ 季后赛：僵尸 po 残影（poSlot 不符）废弃 ----------
  startPlayoff();
  if(S.series){
    const realSlot=S.series.poSlot;
    S.series={used:[],usedOpp:[],mw:1,ow:0,max:7,stage:'po',mid:'po_幽灵',poSlot:'幽灵',logs:[],myName:S.teamName,opName:S.series.opName,side:'blue'};
    startPlayoff();
    ok(S.series&&S.series.poSlot===realSlot,'⑦ 季后赛僵尸废弃、落回当前 slot（实际 '+(S.series&&S.series.poSlot)+'）');
    ok(S.series&&S.series.mw===0,'⑦ 季后赛僵尸比分不得带入');
  }else log('⑦ 我方不在季后赛首场（phase='+S.phase+'），跳过僵尸用例');

  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);
console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
