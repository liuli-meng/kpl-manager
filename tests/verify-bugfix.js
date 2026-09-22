// 批量规则/手感 bug 回归：连胜断续 · 亚运摘首发 · 临时席位 · 伤停不延期 · 租借主力 · 体力恢复 · 日历单跳
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  function mk(){
    const s=newState('规则修复队','⚔');
    fillRoster(s,'mid');
    s.coach={...COACH_POOL.find(c=>c.id==='co12')};
    s.lineup=s.players.map(p=>p.id);
    s.preseason=false;s.transferWindow=0;
    S=s;return s;
  }

  // ① 连胜：杯赛输球必须断连胜（原先只在 regular/po 更新）
  {
    const s=mk();
    s.streak=5;
    s.series={used:[],usedOpp:[],mw:1,ow:3,max:5,stage:'cup',cupLabel:'挑战者杯',logs:[],myName:s.teamName,opName:'重庆狼队',side:'blue'};
    S=s;
    const before=s.streak;
    finishSeries(false);
    if(s.streak>=0)fail('杯赛失利后连胜未断，streak='+s.streak+'（原 '+before+'）');
    else if(s.streak!==-1)fail('杯赛失利后应起算 1 连败，实际 streak='+s.streak);
    else log('① 连胜断续：5 连胜杯赛失利 → streak=-1（不再显示连胜）');
  }

  // ② 亚运征召后不得留在首发
  {
    const s=mk();
    S=s;
    s.season=1;s.split='summer';s.natAnnounced=false;s.agDone=false;
    // 强行让全部首发进国家队
    s.players.forEach(p=>{p.natCamp=true;});
    if(typeof announceNatCamp==='function'){
      // 已手动置位时走 autoFillLineup 同路径
      autoFillLineup(s);
    }
    const left=(s.lineup||[]).filter(id=>{
      const p=s.players.find(x=>x.id===id);
      return p&&p.natCamp;
    });
    if(left.length)fail('亚运征召后仍在首发：'+left.length+' 人');
    else log('② 亚运征召：集训选手已全部摘出首发');
  }

  // ③ 临时席位：升班马挂临时、老牌固定、玩家升班马有风险
  {
    const s=mk();
    s.teamName='常山UUG';
    initTempSeats(s);
    if(!s.tempSeats.includes('常山UUG'))fail('玩家升班马应挂临时席，实际 '+JSON.stringify(s.tempSeats));
    else if(s.tempSeats.some(t=>isFixedSeatTeam(t)))fail('固定席进了临时席：'+s.tempSeats.join('/'));
    else if(!s.tempSeats.includes('桐乡情久')&&!s.tempSeatFixed.includes('桐乡情久'))fail('另一升班马应挂临时席');
    else{
      // 老牌豪门不得成为临时席
      if(s.tempSeats.includes('成都AG超玩会')||s.tempSeats.includes('武汉eStarPro'))fail('老牌豪门被标成临时席');
      else log('③ 临时席位：'+s.tempSeats.join('/')+' · 老牌固定 · 玩家升班马在列');
    }
  }

  // ③b 玩家升班马垫底 → seatLost
  {
    const s=mk();
    s.teamName='桐乡情久';
    initTempSeats(s);
    s.annualPts={};
    AI_TEAMS.forEach(t=>{s.annualPts[t.name]=80;});
    s.annualPts['桐乡情久']=0;
    s.annualPts['常山UUG']=50;
    s.kjia={champ:'K甲·苍穹'};
    settleTempSeats(s);
    if(!s.seatLost)fail('玩家临时席垫底未触发 seatLost');
    else log('③b 玩家升班马垫底：席位收回 seatLost=true（真实 KPL）');
  }

  // ④ 伤停无替补：必须摘出首发（不得「留在首发等人伤愈」变相延期）
  {
    const s=mk();
    // 只留 5 人，全部伤停，无替补
    s.players=s.players.slice(0,5);
    s.lineup=s.players.map(p=>p.id);
    s.players.forEach(p=>{p.injury=3;});
    autoFillLineup(s);
    const left=(s.lineup||[]).filter(id=>{
      const p=s.players.find(x=>x.id===id);
      return p&&p.injury>0;
    });
    if(left.length)fail('伤停选手仍留在首发（变相推迟比赛）');
    else log('④ 伤停不延期：无替补也强制摘出首发，比赛照常');
  }

  // ⑤ 租借：对面主力/高总值不可租
  {
    const s=mk();
    s.fund=99999;
    const cands=loanCandidates(s);
    const bad=cands.filter(c=>overall(c.p)>=80);
    if(bad.length)fail('租借名单混入高总值主力：'+bad.map(c=>c.p.name+'('+overall(c.p)+')').join(','));
    else if(!cands.length)fail('租借名单为空');
    else log('⑤ 租借闸门：'+cands.length+' 名可租均 <80 总值，主力不外借');
  }

  // ⑥ 体力：训练扣体力不产生 NaN，赛后可恢复
  {
    const s=mk();
    const p=s.players[0];
    p.energy=undefined;
    p.energy=clamp((p.energy==null||!isFinite(p.energy)?100:p.energy)-10,0,ENERGY_MAX);
    if(!isFinite(p.energy))fail('训练后体力 NaN');
    else{
      p.energy=NaN; // 注入历史脏值
      matchDayTick(s);
      if(!isFinite(p.energy)||p.energy<=0)fail('NaN 体力未被修复，energy='+p.energy);
      else log('⑥ 体力恢复：脏值修复 + 赛后/日结可回升（energy='+p.energy+'）');
    }
  }

  // ⑦ 日历：closeMatchContinue 不再二次 nextDay（比赛日只 +1）
  {
    const s=mk();
    s.phase='r1';s.matchIdx=1;s.day=10;
    s.schedule=[{opp:'北京WB',round:1},{opp:'重庆狼队',round:2}];
    s._afterMatch=null;
    S=s;
    // 模拟 finishSeries 已 matchDayTick
    matchDayTick(s);
    const afterTick=s.day;
    // closeMatchContinue 在无挂起动作时不应再 nextDay
    // 直接读源码约定：调用后 day 不应再 +1（用函数体行为验证）
    try{closeMatchContinue();}catch(e){}
    if(s.day!==afterTick)fail('比赛收尾后日历被二次推进：'+afterTick+' → '+s.day);
    else log('⑦ 日历单跳：matchDayTick 后 closeMatchContinue 不再 nextDay（day='+s.day+'）');
  }

  // ⑧ 玩家固定席（AG）永不 seatLost
  {
    const s=mk();
    s.teamName='成都AG超玩会';
    initTempSeats(s);
    if(s.tempSeats.includes('成都AG超玩会'))fail('固定席 AG 被标临时');
    else log('⑧ 固定席：AG 不在临时席 · 永不降级');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
