// 联盟规则扩展：转会窗分段 / 临时席位 / 直进青训
// 运行：node tests/verify-rules.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  function mk(){
    const s=newState('规则队','⚔️');
    fillRoster(s,'mid');
    s.coach={...COACH_POOL.find(c=>c.id==='co12')};
    s.preseason=true;s.transferWindow=7;s.transferWindowStart=7;s.fund=2000;
    S=s;return s;
  }

  // ① 转会窗分段：前4自由，后3挂牌
  const s1=mk();
  if(transferPhase(s1)!=='free')fail('第1天应为自由交易，实际 '+transferPhase(s1));
  else{
    s1.transferWindow=3; // 已用 4 天
    if(transferPhase(s1)!=='list')fail('剩余3天应为挂牌期，实际 '+transferPhase(s1));
    else if(canFreeSign(s1))fail('挂牌期仍可买断直签');
    else{
      const p=genPlayer(genFreeAgentDef('mid','mid',new Set()));
      s1.market=[p];
      const ok=buyPlayer(s1,p);
      if(ok)fail('挂牌期 buyPlayer 未拦截');
      else log('① 转会窗分段：前4自由 / 后3挂牌 · 挂牌期买断被拦');
    }
  }

  // ② 临时席位初始化 + 年度收回
  const s2=mk();
  initTempSeats(s2);
  if(!s2.tempSeats||s2.tempSeats.length!==TEMP_SEAT_COUNT)fail('临时席应='+TEMP_SEAT_COUNT+'，实际 '+(s2.tempSeats||[]).length);
  else{
    const t0=s2.tempSeats[0];
    s2.annualPts={};
    AI_TEAMS.forEach(t=>{s2.annualPts[t.name]=80;});
    s2.annualPts[t0]=0; // 该临时席垫底
    initKjia(s2);
    // 让一支非玩家 AI 拿 K甲冠军
    const other=KJIA_AI_TEAMS[0];
    s2.kjia.champ=other;
    settleTempSeats(s2);
    if(s2.tempSeats.includes(t0))fail('垫底临时席未被收回');
    else if(!s2.tempSeats.length)fail('收回后临时席为空');
    else log('② 临时席：'+t0+' 收回 → 现席位 '+s2.tempSeats.join('/')+' · 只升不降');
  }

  // ③ 直进青训营
  const s3=mk();
  s3.academy=[];
  youthDirectEntry(s3);
  if((s3.academy||[]).length!==YOUTH_DIRECT_ENTRY)fail('直进应='+YOUTH_DIRECT_ENTRY+'，实际 '+(s3.academy||[]).length);
  else log('③ 直进青训营：开季自动补 '+s3.academy.length+' 名新秀');

  // ④ 面板
  const s4=mk();
  initTempSeats(s4);
  initDraft(s4,true);
  let rErr='';let html='';
  try{goPage('market');html=document.querySelector('#page-market').innerHTML;}catch(e){rErr=e.message;}
  if(rErr)fail('转会页异常: '+rErr);
  else if(!html.includes('临时席位'))fail('缺临时席位面板');
  else if(!html.includes('挂牌期')&&!html.includes('自由交易'))fail('缺转会窗分段提示');
  else log('④ 面板：临时席位 + 转会窗分段提示齐全');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
