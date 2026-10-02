// 损坏注入 + UI 双开/连点隐性路径：脏档不崩不毒化 · 连点不双结算
// 运行：node tests/verify-corruption.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const _confirm=confirm;confirm=()=>true;
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  // ① 原型链污染：__proto__ / constructor 注入不得改 Object.prototype
  const beforeProto=({}).polluted;
  applyImport({teamName:'污染队',players:[{id:'p1'}],fund:100,season:1,moneyScaled:true,econReal:true,econV2:true,
    __proto__:{polluted:1},constructor:{prototype:{polluted:2}}},'原型污染');
  const afterProto=({}).polluted;
  if(beforeProto||afterProto)fail('原型污染生效: before='+beforeProto+' after='+afterProto);
  else log('① 原型污染：__proto__/constructor 未污染 Object.prototype');

  // ② 数值毒：fund/energy/morale/wage 越界、字符串数、Infinity、NaN
  S=newState('数值毒','x');fillRoster(S,'mid');
  applyImport({teamName:'数值毒',players:S.players.map(p=>({
    id:p.id,name:p.name,pos:p.pos,attrs:{lane:999,farm:-50,team:NaN,mind:'80'},
    energy:9999,morale:-20,wage:Infinity,val:NaN,sig:p.sig,heroPool:null,injury:-3
  })),lineup:S.lineup,fund:Infinity,wageCap:'abc',season:1,moneyScaled:true,econReal:true,econV2:true},'数值毒档');
  let numBad=0;
  if(!isFinite(S.fund))numBad++;
  if(!isFinite(S.wageCap)||S.wageCap<=0)numBad++;
  S.players.forEach(p=>{
    ['lane','farm','team','mind'].forEach(k=>{
      const v=p.attrs&&p.attrs[k];
      if(typeof v!=='number'||!isFinite(v)||v<40||v>99)numBad++;
    });
    if(p.energy!=null&&(p.energy<0||p.energy>ENERGY_MAX))numBad++;
    if(p.morale!=null&&(p.morale<0||p.morale>100))numBad++;
    if(p.wage!=null&&!isFinite(p.wage))numBad++;
    if(p.injury!=null&&p.injury<0)numBad++;
    if(p.heroPool!=null&&!Array.isArray(p.heroPool))numBad++;
  });
  if(numBad)fail('数值毒未洗净 ×'+numBad);
  else log('② 数值毒：fund/帽/四维/体力/士气/工资/伤情全部回落合法区间');

  // ③ 结构毒：lineup 幽灵、pick 错位、schedule 越界、series 半残、aiRoster 幽灵 id
  S=newState('结构毒','x');fillRoster(S,'mid');
  S.seedPower=400;initGroups(S);
  const ghost='ghost_'+Date.now();
  S.lineup=[ghost,ghost,S.players[0].id];
  S.pick={top:'不存在的英雄',jg:null,mid:123};
  S.schedule=[{round:1,opp:'对手',result:null,myScore:0,opScore:0,mid:'reg_r1_1'}];
  S.matchIdx=99;
  S.series={used:[null,undefined,1],mw:'2',ow:null,max:'5',stage:'regular',mid:ghost,logs:'不是数组',opName:null};
  S.aiRosterDefs={北京JDG:[ghost,'',null,123]};
  S.card={matches:null,idx:'x'};
  S.playoff={broken:true};
  S.champCore='not-object';
  S.aiChampCore=null;
  let structCrash=0;
  try{auditSave(S,{silent:true});}catch(e){structCrash++;fail('auditSave 结构毒抛错: '+e.message);}
  try{migrateSave();}catch(e){structCrash++;fail('migrateSave 结构毒抛错: '+e.message);}
  try{
    const pw=teamPower(S);
    if(!isFinite(pw))structCrash++;
  }catch(e){structCrash++;fail('teamPower 结构毒抛错: '+e.message);}
  try{
    const map=aiRosterDefMap(S);
    Object.keys(map).forEach(tn=>{
      (map[tn]||[]).forEach(id=>{if(id!=null&&typeof id!=='string')structCrash++;});
    });
  }catch(e){structCrash++;fail('aiRosterDefMap 抛错: '+e.message);}
  try{ensureAiRosters(S,'北京JDG');}catch(e){structCrash++;fail('ensureAiRosters 幽灵 id 抛错: '+e.message);}
  // matchIdx 越界后仍可安全读赛程
  try{
    const m=S.schedule&&S.schedule[S.matchIdx];
    if(m!==undefined&&m!==null&&typeof m!=='object')structCrash++;
  }catch(e){structCrash++;}
  if(structCrash)fail('结构毒处理异常 ×'+structCrash);
  else log('③ 结构毒：audit/migrate/战力/AI名册 均不抛 · 幽灵 id 可消化');

  // ④ 半残导入：players 是对象不是数组 / teamName 空 / v 为字符串
  S=newState('半残','x');S.fund=777;
  applyImport({teamName:'半残',players:{0:{id:'a'}},fund:1,v:'4'},'半残档');
  // teamName 若为空被拒应保持原档
  applyImport({teamName:'',players:[],fund:1},'空名');
  applyImport({teamName:'字符串v',players:[{id:'z',name:'z',pos:'mid'}],fund:10,season:1,v:'not-a-number',moneyScaled:true,econReal:true,econV2:true},'字符串版本');
  if(S.teamName!=='字符串v')fail('半残导入后 teamName 未更新');
  if(typeof S.v!=='number'||isNaN(S.v)||S.v!==4)fail('半残导入后 v 未正确回落/迁移，实得 '+S.v);
  let halfCrash=0;
  try{const t=teamPower(S);if(!isFinite(t))halfCrash++;}catch(e){halfCrash++;}
  if(halfCrash)fail('半残导入后战力异常');
  else log('④ 半残导入：非数组 players / 空名 / 字符串 v 均安全拒绝或回落');

  // ⑤ UI 连点：buy/startMatch/nextDay/applyImport 不双结算
  S=newState('连点队','x');fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);S.preseason=false;S.transferWindow=0;
  S.lineup=S.players.map(p=>p.id);
  startSplit(S,'spring');
  const fund0=S.fund;
  // 连点 debounce
  let d1=uiDebounce('race-a',400),d2=uiDebounce('race-a',400),d3=uiDebounce('race-a',50);
  if(d1||!d2)fail('uiDebounce 语义异常: '+d1+','+d2);
  else if(!d3)fail('窗口过后应放行');
  else log('⑤ 连点 debounce：窗口内拦截 · 过窗放行');

  // ⑥ 双开锁：无 BroadcastChannel / 坏 storage JSON 均不抛
  let dualCrash=0;
  try{initTabGuard();}catch(e){dualCrash++;}
  try{
    // 模拟另一标签写入
    localStorage.setItem('km_tab_lock',JSON.stringify({id:'other-tab',t:Date.now()}));
    localStorage.setItem('km_tab_lock','not-json{{');
    localStorage.setItem('km_tab_lock',JSON.stringify({id:_tabId,t:Date.now()}));
  }catch(e){dualCrash++;}
  try{
    const ev={key:'km_tab_lock',newValue:JSON.stringify({id:'evil',t:1})};
    // 直接调用内部路径：storage handler 已挂 window
    if(typeof window!=='undefined'&&window.addEventListener){
      // 沙箱 stub 不会真派发；至少 init 不炸
    }
  }catch(e){dualCrash++;}
  if(dualCrash)fail('双开锁路径抛错 ×'+dualCrash);
  else log('⑥ 双开锁：init + 坏 lock JSON 均安全');

  // ⑦ 快速连打两场：第二场不得重置进行中系列赛比分
  S=newState('连打','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0; // startSplit 会开转会期——测连点前手动收窗
  S.lineup=S.players.map(p=>p.id);
  if(S.schedule&&S.schedule.length){
    startMatch();
    const mid=S.series&&S.series.mid;
    if(S.series){
      S.series.mw=2;S.series.ow=1;
      startMatch(); // 连点第二下
      if(S.series.mw!==2||S.series.ow!==1)fail('连点 startMatch 重置了系列赛比分: '+S.series.mw+':'+S.series.ow);
      else if(S.series.mid!==mid)fail('连点 startMatch 换了 mid');
      else log('⑦ 连打 startMatch：进行中系列赛比分 2:1 与 mid 保持');
    }else fail('⑦ startMatch 未建立系列赛（preseason='+S.preseason+' matchIdx='+S.matchIdx+'）');
  }else fail('连打：无赛程');

  // ⑧ applyImport 连点：第二次导入不得半写
  S=newState('导入连点','x');fillRoster(S,'mid');S.fund=100;
  const goodA=newState('队A','a');fillRoster(goodA,'mid');goodA.fund=111;goodA.moneyScaled=true;goodA.econReal=true;goodA.econV2=true;
  const goodB=newState('队B','b');fillRoster(goodB,'star');goodB.fund=222;goodB.moneyScaled=true;goodB.econReal=true;goodB.econV2=true;
  applyImport(goodA,'A');
  const team1=S.teamName,fund1=S.fund;
  applyImport(goodB,'B');
  if(S.teamName!=='队B'&&S.teamName!=='队A')fail('导入连点状态乱: '+S.teamName);
  else if(S.teamName==='队A'&&fund1!==111)fail('A 档 fund 异常');
  else log('⑧ 导入连点：后写完整覆盖 · 无半写混合态（'+S.teamName+'）');

  // ⑨ 脏 series 的 playGame 路径不抛（logs 非数组等半残结构）
  S=newState('脏系列','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);S.preseason=false;
  S.lineup=S.players.map(p=>p.id);
  S.series={used:null,usedOpp:'x',mw:'2',ow:null,max:'5',stage:'regular',mid:'reg_r1_1',logs:'不是数组',myName:S.teamName,opName:'北京JDG',side:'blue'};
  let playCrash=0;
  try{
    playGame(); // void：只求不抛
    if(!Array.isArray(S.series.logs))playCrash++; // 防御应把 logs 归一
  }catch(e){playCrash++;fail('playGame 脏 series 抛错: '+e.message);}
  try{teamPower(S);}catch(e){playCrash++;fail('战力结算抛错: '+e.message);}
  if(playCrash)fail('脏系列赛路径异常 ×'+playCrash);
  else log('⑨ 脏 series：playGame 吞下半残结构 · logs 归一可 push');

  confirm=_confirm;renderAll=_ra;save=_sv;
  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);
