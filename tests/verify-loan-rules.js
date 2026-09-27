// 租借赛制 + 开局青训
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 开局自带 2 名可出场青训
  const s=newState('青训测试','⚔️');
  fillRoster(s,'mid');
  s.coach={...COACH_POOL.find(c=>c.id==='co12')};
  s.preseason=true;s.transferWindow=7;
  const before=s.players.length;
  const added=seedStarterAcademy(s);
  if(added.length!==2)fail('① seedStarterAcademy 应加 2 人，得到 '+added.length);
  else if(s.players.length!==before+2)fail('① 名单人数未 +2');
  else if(!added.every(p=>matchEligible(s,p)))fail('① 开局青训不可出战: '+added.map(p=>p.name+'/'+p.age).join(','));
  else if(added.some(p=>(p.age||0)<MATCH_MIN_AGE))fail('① 青训未满 '+MATCH_MIN_AGE+' 岁');
  else log('① 开局青训×2 可出场（'+added.map(p=>p.name+'·'+POS[p.pos][0]).join('、')+'）');

  // ② 常规赛禁止租借
  s.phase='r1';s.preseason=false;
  if(loanWindowOpen(s))fail('② 常规赛 loanWindowOpen 不应为 true');
  else if(loanCap(s)!==0)fail('② 常规赛 loanCap 应为 0，得到 '+loanCap(s));
  else{
    const cands=loanCandidates(s);
    let toastMsg='';
    const o=toast; toast=m=>{toastMsg=String(m);};
    let ok=true;
    try{ if(cands[0])loanPlayer(s,cands[0].from,cands[0].p.id); else loanPlayer(s,'重庆狼队','none'); }catch(e){ok=false;}
    toast=o;
    const borrowed=(s.players||[]).filter(p=>p.loan).length;
    if(borrowed>0)fail('② 常规赛后仍租入 '+borrowed+' 人');
    else if(ok&&!/常规赛|租借/.test(toastMsg))fail('② 常规赛租借无提示: '+toastMsg);
    else log('② 常规赛禁止租借（cap=0 · toast 拦截）');
  }

  // ③ 租入选手常规赛不可出战
  const fake={id:'loan_x',name:'测试租将',pos:'mid',attrs:{lane:80,farm:80,team:80,mind:80},skill:{n:'x',d:'x',t:'team'},loan:{from:'AG',days:10},age:19,contract:1,wage:3,val:100};
  s.players.push(fake);
  if(matchEligible(s,fake))fail('③ 租入选手常规赛仍可出战');
  else log('③ 租入选手常规赛不可出战');

  // ④ 挑战者杯：cap=2，可租
  s.phase='challenger';
  if(!loanWindowOpen(s))fail('④ 挑杯 loanWindowOpen=false');
  else if(loanCap(s)!==2)fail('④ 挑杯 loanCap 应为 2，得到 '+loanCap(s));
  else if(!matchEligible(s,fake))fail('④ 挑杯租入选手仍不可出战');
  else log('④ 挑战者杯：窗口开 · cap=2 · 租入可出战');

  // ⑤ 年总：cap=1，出征 7 人含租借
  s.phase='annual';
  if(loanCap(s)!==1)fail('⑤ 年总 loanCap 应为 1，得到 '+loanCap(s));
  else{
    const pool=cupTravelRoster(s,7,1);
    const loanCnt=pool.filter(p=>p.loan).length;
    if(pool.length>7)fail('⑤ 出征名单 '+pool.length+' >7');
    else if(loanCnt>1)fail('⑤ 年总租借 '+loanCnt+' >1');
    else log('⑤ 年总出征 '+pool.length+' 人 · 含租借 '+loanCnt+'（≤1）· cap=1');
  }

  // ⑥ 挑杯出征 7 人、租借 ≤2
  s.phase='challenger';
  {
    const pool=cupTravelRoster(s,7,2);
    const loanCnt=pool.filter(p=>p.loan).length;
    if(pool.length>7)fail('⑥ 挑杯出征 '+pool.length+' >7');
    else if(loanCnt>2)fail('⑥ 挑杯租借 '+loanCnt+' >2');
    else log('⑥ 挑杯出征 '+pool.length+' 人 · 含租借 '+loanCnt+'（≤2）');
  }

  // ⑦ 外租（loanOut）常规赛也关
  s.phase='r2';
  const bench=s.players.find(p=>!s.lineup.includes(p.id)&&!p.loan&&matchEligible(s,p));
  if(bench){
    const o=toast; let t=''; toast=m=>{t=String(m);};
    clubLoanOutPlayer(s,bench.id);
    toast=o;
    if(bench.loanOut)fail('⑦ 常规赛外租成功');
    else if(!/常规赛|租借/.test(t))fail('⑦ 外租无常规赛提示: '+t);
    else log('⑦ 常规赛禁止外租');
  }else log('⑦ 无可外租替补，跳过');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
