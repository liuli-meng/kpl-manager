// 杯赛时间/年度赛历：真实 2026 顺序 春→挑杯→夏→EWC→（亚运）→年总；赛历条含春季赛
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  function mk(){
    const s=newState('杯赛时序队','⚔');
    fillRoster(s,'mid');
    s.coach={...COACH_POOL.find(c=>c.id==='co12')};
    s.lineup=s.players.map(p=>p.id);
    s.preseason=false;s.transferWindow=0;
    S=s;return s;
  }
  function runLeagueQuick(){
    let g=0;
    while(!['champion','eliminated'].includes(S.phase)&&g++<220){
      if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
        if(S.series&&S.series.stage==='regular'){S.series.mw=3;S.series.ow=1;finishSeries(true);continue;}
        const m=S.schedule[S.matchIdx];
        S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
        S.series.mw=3;S.series.ow=1;finishSeries(true);
      }else if(S.phase==='card'){
        if(S.series){S.series.mw=4;S.series.ow=1;finishSeries(true);continue;}
        startCard();
        if(!S.series)break;
      }else if(S.phase==='playoff'){
        if(S.series){S.series.mw=4;S.series.ow=1;finishSeries(true);continue;}
        startPlayoff();
        if(!S.series)break;
      }else break;
    }
  }

  // ① 赛历条必须含春季赛，且当前高亮春季赛
  {
    const s=mk();
    s.split='spring';s.phase='r1';s.day=1;
    startSplit(s,'spring');s.preseason=false;s.transferWindow=0;s.phase='r1';
    S=s;
    renderLeague();
    const html=document.getElementById('page-league').innerHTML||'';
    if(html.indexOf('春季赛')<0)fail('赛历条缺少「春季赛」');
    else if(html.indexOf('年度赛历')<0)fail('联赛页无年度赛历条');
    else if(html.indexOf('挑战者杯')<0||html.indexOf('EWC')<0)fail('赛历条缺少挑杯/EWC');
    else log('① 赛历条含春季赛/挑杯/夏/EWC/年总，春季可见');
  }

  // ② 顺序：春结束→挑杯→夏（不是 EWC）；夏结束→EWC（不是直接年总）
  {
    const s=mk();
    startSplit(s,'spring');s.preseason=false;s.transferWindow=0;
    runLeagueQuick();
    const dayAfterSpring=s.day;
    advanceCalendar(s);
    if(s.phase!=='challenger')fail('春季后应进挑杯，实际 '+s.phase);
    else{
      // 快进挑杯到结束
      let g=0;
      while(s.phase==='challenger'&&g++<100){
        if(s.series){s.series.mw=3;s.series.ow=1;finishSeries(true);continue;}
        startCup(s);
        if(!s.series&&s.challenger&&s.challenger.champ)break;
        if(!s.series&&!s.challenger)break;
      }
      if(s.split!=='summer')fail('挑杯后应进夏季赛，实际 split='+s.split+' phase='+s.phase);
      else if(s.phase==='ewc')fail('挑杯后不应直接进 EWC（EWC 在夏休）');
      else log('② 挑杯后进入夏季赛（EWC 不在夏前）');
    }
  }

  // ③ 夏结束 → EWC
  {
    const s=mk();
    startSplit(s,'summer');s.preseason=false;s.transferWindow=0;s.natAnnounced=true;s.agDone=true; // 跳过亚运征召干扰
    runLeagueQuick();
    advanceCalendar(s);
    if(s.phase!=='ewc')fail('夏季后应进 EWC，实际 '+s.phase);
    else log('③ 夏季赛后进入 EWC（夏休国际杯）');
  }

  // ④ currentCalendarKey：春季赛阶段高亮 spring
  {
    const s=mk();
    s.split='spring';s.phase='r1';
    const k=currentCalendarKey(s);
    if(k!=='spring')fail('r1 春季应高亮 spring，实际 '+k);
    else{
      s.phase='champion';
      const k2=currentCalendarKey(s);
      if(k2!=='challenger')fail('春结束后下一步应高亮 challenger，实际 '+k2);
      else log('④ 赛历高亮：春季赛 → 挑战者杯 步进正确');
    }
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);
console.log(out);
