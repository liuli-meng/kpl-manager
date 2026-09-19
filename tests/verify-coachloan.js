// 教练模式：应急租借 + 引援建议回归
// 运行：node tests/verify-coachloan.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  const mkCoach=(fund)=>{
   S=newState('教练租借队','x');fillRoster(S,'mid','mid');
   S.coach={...COACH_POOL.find(c=>c.id==='co12')};
   S.lineup=S.players.map(p=>p.id);
   S.mode='coach';
   S.coachDeal={years:2,honors:[],log:[]};
   S.fund=fund==null?2000:fund;
   S.preseason=false;S.transferWindow=0;
   S.freeAgents=S.freeAgents||[];
   return S;
  };

  // ① 教练导航包含市场页
  S=mkCoach();
  const pages=MODE_PAGES.coach||[];
  if(!pages.includes('market'))fail('①教练导航无 market 页: '+pages.join(','));
  else log('①教练导航：'+pages.join('/'));

  // ② 伤停导致缺位 → 可立即租借补位
  S=mkCoach(3000);
  const inj=S.lineup.map(id=>S.players.find(p=>p.id===id)).filter(Boolean)[0];
  inj.injury=8;
  // 临时抽掉替补，保证该位置只剩伤号
  S.players=S.players.filter(p=>p.id===inj.id||p.pos!==inj.pos||p===inj);
  // 若同位置还有健康人，再伤掉
  S.players.forEach(p=>{if(p.pos===inj.pos&&p.id!==inj.id)p.injury=5;});
  const gaps0=injuryGapPositions(S);
  if(!gaps0.length)fail('②前置：未能制造伤停缺位');
  else{
   const adv=coachAdvice(S);
   const loan0=(adv.loans||[]).find(c=>c.pos===gaps0[0])||(adv.loans||[])[0];
   if(!loan0)fail('②租借建议为空');
   else{
    const before=S.players.length;
    coachRequest(S,'loan',loan0.id);
    const after=S.players.filter(p=>p.loan);
    if(!after.some(p=>p.id===loan0.id))fail('②教练租借未成功: '+loan0.name);
    else log('②应急租借：'+loan0.name+'（'+POS[loan0.pos][0]+'）加盟 · 名单 '+before+'→'+S.players.length+' · 缺位 '+gaps0.join(','));
   }
  }

  // ③ 引援建议 + 申请直签
  S=mkCoach(500);
  const fa=genPlayer(genFreeAgentDef('mid','mid',new Set()));
  fa.freeAgent=true;fa.signCost=50;
  S.freeAgents=[fa];
  const adv=coachAdvice(S);
  const hit=(adv.signs||[]).find(x=>x.id===fa.id);
  if(!hit)fail('③建议未含自由人 '+fa.name);
  else{
   coachRequest(S,'sign',fa.id);
   if(!S.players.some(p=>p.id===fa.id))fail('③资金充足却未签入建议球员');
   else if(!S.eventLog.some(e=>/采纳教练申请|签下自由球员/.test(e.txt)))fail('③签约日志缺失');
   else log('③引援建议→申请直签：'+fa.name+' 入队（总值 '+overall(fa)+'）');
  }

  // ④ 资金不足：申请登记但不签
  S=mkCoach(10);
  const fa2=genPlayer(genFreeAgentDef('jg','mid',new Set()));
  fa2.freeAgent=true;fa2.signCost=9999;
  S.freeAgents=[fa2];
  coachRequest(S,'sign',fa2.id);
  if(S.players.some(p=>p.id===fa2.id))fail('④资金不足仍签约');
  else if(!(S.coachRecs||[]).some(r=>r.pid===fa2.id))fail('④申请未登记');
  else log('④资金不足：申请已排队（coachRecs），未误签');

  // ⑤ 教练市场页渲染不抛错
  S=mkCoach(2000);
  S.players[0].injury=4;
  let rErr='';
  try{goPage('market');}catch(e){rErr=e.message;}
  const body=document.querySelector('#page-market').innerHTML;
  if(rErr)fail('⑤教练市场页渲染异常: '+rErr);
  else if(body.indexOf('应急租借')<0)fail('⑤缺应急租借面板');
  else if(body.indexOf('引援建议')<0)fail('⑤缺引援建议面板');
  else if(body.indexOf('挂牌')>=0&&body.indexOf('出售')>=0&&body.indexOf('我的队员（伤病')<0)fail('⑤教练页不应混入挂牌出售生意面板');
  else log('⑤教练市场页：应急租借 + 引援建议渲染 OK');

  // ⑥ 阵容页伤病横幅
  S=mkCoach(2000);
  S.players[1].injury=6;
  try{goPage('lineup');}catch(e){rErr=e.message;}
  const lb=document.querySelector('#page-lineup').innerHTML;
  if(lb.indexOf('阵容告急')<0&&lb.indexOf('应急租借')<0)fail('⑥阵容页无伤病应急入口');
  else log('⑥阵容页：伤病告急横幅 → 跳转应急租借');

  // ⑦ coachAutoSquad 缺位时自动应急租借
  S=mkCoach(2000);
  const t=S.players.find(p=>S.lineup.includes(p.id));
  t.injury=10;
  S.players.filter(p=>p.pos===t.pos&&p.id!==t.id).forEach(p=>{p.injury=6;});
  const gapPos=injuryGapPositions(S)[0];
  if(!gapPos)fail('⑦前置缺位失败');
  else{
   coachAutoSquad(S);
   const filled=S.players.some(p=>p.pos===gapPos&&matchEligible(S,p));
   if(!filled)fail('⑦coachAutoSquad 未补上缺位 '+POS[gapPos][0]);
   else log('⑦自动应急：缺位 '+POS[gapPos][0]+' 已由俱乐部补上（租借或自由签）');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
