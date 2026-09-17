/* 引擎动作层：回答「玩家下一步该点什么」。无 DOM、无 toast。
   UI 按钮一律从 nextAction 派生；测试可直接断言 type/fn。 */
function playerRetired(s){return !!(s&&s.mode==='player'&&s.career&&s.career.retired);}
function nextAction(s){
 if(!s||!s.players||!s.players.length)return null;
 if(playerRetired(s))return null;
 if(s.board&&s.board.fired)return null;
 if(s.preseason)return {type:'endPreseason',label:' 结束转会期 · 开始赛季',fn:'uiEndPreseason'};
 const p=s.phase;
 if(p==='r1'||p==='r2'||p==='r3'){
 if(!(s.schedule||[])[s.matchIdx])return null;
 return s.mode==='player'
 ?{type:'startPlayerMatch',label:' 出战比赛 · 教练指挥',fn:'startPlayerMatch'}
 :{type:'startMatch',label:' 赛前准备 · 调整阵容 / BP 开赛',fn:'uiStartMatch'};
 }
 if(p==='card'){
 const matches=(s.card&&s.card.matches)||[];
 const myPending=matches.some(m=>m&&!m.r&&(m.a===s.teamName||m.b===s.teamName));
 if(myPending||(s.card&&s.card.idx<matches.length))return {type:'startCard',label:' 进行卡位赛',fn:'startCard'};
 return null;
 }
 if(p==='playoff'){
 const pf=s.playoff;
 if(!pf||!pf.final||pf.final.r)return null;
 return {type:'startPlayoff',label:' 进行季后赛 / 快进',fn:'startPlayoff'};
 }
 if(p==='challenger'){
 const c=s.challenger;
 if(!c||c.champ)return null;
 return {type:'startCup',label:' 进行挑战者杯',fn:'uiStartCup'};
 }
 if(p==='ewc'){
 const e=s.ewc;
 if(!e||e.champ)return null;
 return {type:'startCup',label:' 进行 EWC',fn:'uiStartCup'};
 }
 if(p==='asiad'){
 const a=s.ag;
 if(!a||a.champ)return null;
 return {type:'asiadStep',label:' 推进亚运会',fn:'uiAsiadStep'};
 }
 if(p==='annual'){
 const a=s.annual;
 if(!a)return null;
 if(yearRollPending(s))return {type:'finishAnnual',label:' 进入新赛季 · 年度轮换',fn:'uiFinishAnnual'};
 if(a.po&&a.po.champ)return null;
 return {type:'startCup',label:' 进行年度总决赛',fn:'uiStartCup'};
 }
 if(p==='champion'||p==='eliminated'){
 return {type:'advanceCalendar',label:calendarNextLabel(s)||' 推进赛历',fn:'uiAdvanceCalendar'};
 }
 return null;
}
/* 引擎可执行动作（无 UI 确认）：供测试/门禁直接驱动 */
function runEngineAction(s,act){
 if(!act)return false;
 if(act.type==='endPreseason'){endPreseason(s);return true;}
 if(act.type==='startMatch'){startMatch();return true;}
 if(act.type==='startPlayerMatch'){startPlayerMatch();return true;}
 if(act.type==='startCard'){startCard();return true;}
 if(act.type==='startPlayoff'){startPlayoff();return true;}
 if(act.type==='startCup'){startCup(s);return true;}
 if(act.type==='asiadStep'){asiadStep(s);return true;}
 if(act.type==='finishAnnual'){try{finishAnnual(s);}catch(e){}return true;}
 if(act.type==='advanceCalendar'){advanceCalendar(s);return true;}
 return false;
}
