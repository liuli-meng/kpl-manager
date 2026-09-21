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

  // ⑤ canSign：玩家名单满 / AI 同位置 / 已在册
  const s5=mk();
  s5.players=s5.players.slice(0,10);
  if((s5.players||[]).length<10){
    while(s5.players.length<10)s5.players.push(genPlayer(genFreeAgentDef('mid','low',new Set(s5.players.map(p=>p.name)))));
  }
  const free=genPlayer(genFreeAgentDef('top','mid',new Set()));
  const chkFull=canSign(s5,free,{actor:'player'});
  if(chkFull.ok)fail('名单满时 canSign 仍放行');
  else if(!/名单/.test(chkFull.reason))fail('名单满原因文案异常: '+chkFull.reason);
  else{
    const s5b=mk();
    const fa=genPlayer(genFreeAgentDef('top','mid',new Set()));
    const okSign=canSign(s5b,fa,{actor:'player'});
    if(!okSign.ok)fail('空位时 canSign 应放行，实际 '+okSign.reason);
    else{
      const map=aiRosterDefMap(s5b);
      const aiTn=Object.keys(map).filter(t=>t!==s5b.teamName)[0];
      const midDef=defOf(s5b,map[aiTn][0])||{pos:'mid',id:'x',name:'测试'};
      // 已有同位置 → canSign(ai) 应拒绝（allowReplace=false）
      const samePos={id:'ghost_ai',name:'幽灵',pos:(midDef.pos||'mid')};
      const chkAi=canSign(s5b,samePos,{actor:'ai',team:aiTn});
      if(chkAi.ok)fail('AI 同位置 canSign 仍放行');
      else log('⑤ canSign：玩家名单满拦截 · 空位放行 · AI 同位置拦截');
    }
  }

  // ⑥ auditSave：双挂/队长幽灵/状态旗 → 自动修复
  const s6=mk();
  const me=s6.players[0];
  const map6=aiRosterDefMap(s6);
  const tn6=Object.keys(map6).filter(t=>t!==s6.teamName)[0];
  if(!tn6)fail('找不到 AI 队做双挂测试');
  else{
    map6[tn6]=map6[tn6].concat([me.id]); // 人为制造玩家选手挂进 AI 名册
    s6.captain='ghost_captain';
    s6.lineup=s6.lineup.concat(['ghost_lineup']);
    s6.players[1].loanOut={team:'外队',days:5};
    s6.players[1].kjia=10; // 冲突旗
    s6.listed=[{id:s6.players[1].id,name:s6.players[1].name,price:100}];
    const rep=auditSave(s6,{silent:true});
    if(!rep.issues||!rep.issues.length)fail('auditSave 未发现注入的问题');
    else if((map6[tn6]||[]).includes(me.id))fail('双挂未从 AI 名册清除');
    else if(s6.captain)fail('队长幽灵未清空');
    else if((s6.lineup||[]).includes('ghost_lineup'))fail('首发幽灵未清除');
    else if(s6.players[1].kjia)fail('loanOut/kjia 冲突未修：kjia 应清 0');
    else if((s6.listed||[]).some(x=>x.id===s6.players[1].id))fail('挂牌冲突未撤牌');
    else log('⑥ auditSave：双挂/队长幽灵/首发幽灵/状态旗/挂牌冲突全部检出并修复');
  }

  // ⑦ canRelease：集训/外租/K甲
  const s7=mk();
  const p7=s7.players[0];
  p7.kjia=5;
  if(canRelease(s7,p7,{asSale:true}).ok)fail('K甲选手 canRelease 仍放行');
  else{
    p7.kjia=0;p7.loanOut={team:'X',days:3};
    if(canRelease(s7,p7,{asSale:true}).ok)fail('外租选手 canRelease 仍放行');
    else{
      p7.loanOut=null;
      if(!canRelease(s7,p7,{asSale:true}).ok)fail('正常选手 canRelease 应放行');
      else log('⑦ canRelease：K甲/外租拦截 · 正常选手放行');
    }
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
