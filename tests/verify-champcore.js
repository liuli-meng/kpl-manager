// 冠军班底羁绊：夺冠记首发 → 同场≥3触发 → 连冠升档 → 迁移兜底
// 运行：node tests/verify-champcore.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('班底队','x');fillRoster(S,'mid','star');return S;};

  // ① 开局无班底
  const s0=mkS();
  if(s0.champCore)fail('新档不应自带 champCore');
  else if(activeBonds(s0).some(b=>/冠军班底/.test(b.desc)))fail('未夺冠不应有班底羁绊');
  else log('① 开局：无 champCore、无班底羁绊');

  // ② 夺冠登记：ids=首发，titles=1
  const s1=mkS();
  const beforePow=teamPower(s1);
  registerChampCore(s1,'2026 春季赛 总冠军');
  const cc=s1.champCore;
  if(!cc||!cc.ids||cc.ids.length!==5)fail('champCore.ids 应为 5 人首发，实际 '+JSON.stringify(cc&&cc.ids&&cc.ids.length));
  else if(cc.titles!==1)fail('首次夺冠 titles 应为 1，实际 '+cc.titles);
  else if((cc.names||[]).length!==5)fail('champCore.names 缺失');
  else log('② 夺冠登记：5 人首发入册 titles=1');

  // ③ 满编同场 → +10%
  const bonds1=activeBonds(s1);
  const cb=bonds1.find(b=>/冠军班底/.test(b.desc));
  if(!cb)fail('班底同场未触发羁绊');
  else if(cb.bonus!==10)fail('首冠满编 bonus 应为 10，实际 '+cb.bonus);
  else{
    const pow=teamPower(s1);
    if(pow<=beforePow)fail('班底满编后战力应上升 '+beforePow+'→'+pow);
    else log('③ 满编 5 人：+10%，战力 '+beforePow+'→'+pow);
  }

  // ④ 补替补换下 1 人 → 4 人在场，降为 min（+4）
  {
    const u=new Set(s1.players.map(p=>p.name));
    const bench=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));
    s1.players.push(bench);
    swapPlayer(bench.id);
    const nIn=s1.lineup.filter(id=>s1.champCore.ids.includes(id)).length;
    const still=activeBonds(s1).find(b=>/冠军班底/.test(b.desc));
    if(nIn!==4)fail('换下 1 人后班底同场应为 4，实际 '+nIn);
    else if(!still||still.bonus!==4)fail('4 人同场应 +4，实际 '+(still&&still.bonus));
    else log('④ 换下 1 人：4 人在场，羁绊降为 +4');
  }

  // ⑤ 只剩 2 名班底 → 羁绊消失
  const s3=mkS();
  registerChampCore(s3,'B');
  // 换下 3 名班底（若替补不够则用青训生成）
  let swapped=0;
  while(swapped<3){
    const benchP=s3.players.find(p=>!s3.lineup.includes(p.id)&&!s3.champCore.ids.includes(p.id));
    if(!benchP){
      const u=new Set(s3.players.map(p=>p.name));
      const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));
      s3.players.push(b);continue;
    }
    const starterOut=s3.lineup.find(id=>s3.champCore.ids.includes(id));
    if(!starterOut)break;
    // 直接改 lineup（沙箱无 swap 守卫依赖）
    s3.lineup=s3.lineup.map(id=>id===starterOut?benchP.id:id);
    swapped++;
  }
  const left=s3.lineup.filter(id=>s3.champCore.ids.includes(id)).length;
  if(activeBonds(s3).some(b=>/冠军班底/.test(b.desc)))fail('仅剩 '+left+' 名班底仍触发羁绊');
  else log('⑤ 班底同场降至 '+left+' 人：羁绊正确消失');

  // ⑥ 连冠升档：titles=2 满编 → +12%
  const s4=mkS();
  registerChampCore(s4,'C1');
  registerChampCore(s4,'C2');
  const cb2=activeBonds(s4).find(b=>/冠军班底/.test(b.desc));
  if(s4.champCore.titles!==2)fail('连冠 titles 应为 2');
  else if(!cb2||cb2.bonus!==12)fail('连冠满编 bonus 应为 12，实际 '+(cb2&&cb2.bonus));
  else log('⑥ 连冠升档：titles=2 满编 +12%');

  // ⑦ 旧档迁移：缺 champCore 补 null，不炸
  const s5=mkS();
  delete s5.champCore;
  try{migrateSave();}catch(e){fail('migrateSave 异常: '+e.message);}
  if(S.champCore!==null&&S.champCore!==undefined)fail('迁移后 champCore 应为 null，实际 '+S.champCore);
  else log('⑦ 旧档迁移：champCore 兜底 null');

  // ⑧ 与原队羁绊可叠加（自定义：把 3 人改成同 team 再夺冠）
  const s6=mkS();
  const t='AG';
  s6.lineup.forEach(id=>{
    const p=s6.players.find(x=>x.id===id);
    if(p)p.team=t;
  });
  registerChampCore(s6,'叠');
  const ds=activeBonds(s6);
  const hasAg=ds.some(b=>/AG/.test(b.desc));
  const hasCh=ds.some(b=>/冠军班底/.test(b.desc));
  if(!hasAg||!hasCh)fail('原队羁绊与冠军班底应共存: '+ds.map(b=>b.desc).join(' | '));
  else log('⑧ 叠加：AG 原队羁绊 + 冠军班底同时生效（战力可叠加）');

  // ⑨ AI 冠军班底：玩家夺冠不写入 AI 表；AI 夺冠累计 titles
  const s7=mkS();
  registerAiChampCore(s7,s7.teamName); // 玩家队名应被忽略
  if(s7.aiChampCore&&s7.aiChampCore[s7.teamName])fail('玩家夺冠不应写入 aiChampCore');
  else{
    registerAiChampCore(s7,'成都AG超玩会');
    registerAiChampCore(s7,'成都AG超玩会');
    if(!s7.aiChampCore['成都AG超玩会']||s7.aiChampCore['成都AG超玩会'].titles!==2)fail('AG AI 班底 titles 应为 2');
    else log('⑨ AI 班底登记：AG titles=2，玩家队名被忽略');
  }

  // ⑩ 难度档缩放：elite > mid > weak；连冠 > 首冠
  {
    const s=mkS();
    const mk=(t,titles)=>{s.aiChampCore={[t]:{titles}};};
    mk('成都AG超玩会',1); // elite seed 640
    const e1=aiChampBondPct(s,'成都AG超玩会');
    mk('苏州KSG',1); // mid ~500
    const m1=aiChampBondPct(s,'苏州KSG');
    mk('常山UUG',1); // weak ~300
    const w1=aiChampBondPct(s,'常山UUG');
    mk('成都AG超玩会',2);
    const e2=aiChampBondPct(s,'成都AG超玩会');
    if(!(e1>m1&&m1>w1))fail('难度缩放应 elite>mid>weak: '+e1+'/'+m1+'/'+w1);
    else if(!(e2>e1))fail('连冠加成应高于首冠: '+e2+' vs '+e1);
    else if(w1>0&&w1<2)log('⑩ 难度缩放：elite '+e1+'% · mid '+m1+'% · weak '+w1+'% · elite连冠 '+e2+'%');
    else fail('weak 加成异常: '+w1);
  }

  // ⑪ aiRosterPower 吃到班底加成
  {
    const s=mkS();
    // 用 AI 队名+其阵容：ensureAiRosters 或直接塞 aiRosterDefs
    const tn='成都AG超玩会';
    const roster=[];
    POS_ORDER.forEach(pos=>roster.push(genPlayer({id:'ai_'+pos,name:'AI'+pos,pos,team:'AG',tags:[],base:[80,80,80,80],skill:{n:'x',t:'lane',d:''},sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n})));
    const p0=aiRosterPower(roster,s,tn);
    registerAiChampCore(s,tn);
    const p1=aiRosterPower(roster,s,tn);
    if(!(p1>p0))fail('AI 班底应抬高战力 '+p0+'→'+p1);
    else log('⑪ aiRosterPower：AG 夺冠后战力 '+p0+'→'+p1+'（+'+aiChampBondPct(s,tn)+'%）');
  }

  // ⑫ 迁移兜底
  {
    const s=mkS();
    delete s.aiChampCore;
    try{migrateSave();}catch(e){fail('migrate aiChampCore 异常: '+e.message);}
    if(!S.aiChampCore||typeof S.aiChampCore!=='object')fail('迁移后 aiChampCore 应为空对象');
    else log('⑫ 旧档迁移：aiChampCore 兜底 {}');
  }

  return {ok:!hadFail,lines:res};
})()
`,dom);

(out.lines||[]).forEach(l=>console.log(l));
if(!out.ok){console.error('冠军班底羁绊验证失败');process.exit(1);}
console.log('冠军班底羁绊验证通过');
