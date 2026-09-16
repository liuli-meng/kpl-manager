// playerStatus 单一出口回归：多旗标组合 / 出战资格 / 文案
// 运行：node tests/verify-playerstatus.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  S=newState('状态机队','x');fillRoster(S,'mid','mid');
  const p=S.players[0];

  // ① 干净状态
  let st=playerStatus(p,S);
  if(st.busy||st.injury||st.kjia||st.loanOut||st.natCamp)fail('干净选手 busy 误判');
  else if(!matchEligible(S,p))fail('干净选手不可出战');
  else log('① 干净：busy=false · 可出战');

  // ② 多旗标叠加：伤停 + K甲
  p.injury=3;p.kjia=10;
  st=playerStatus(p,S);
  if(!(st.injury&&st.kjia&&st.busy))fail('伤停+K甲 旗标丢失: '+JSON.stringify(st));
  else if(matchEligible(S,p))fail('多旗标仍可出战');
  else if(!/伤停/.test(matchIneligibleReason(S,p)))fail('出战拒绝文案缺伤停: '+matchIneligibleReason(S,p));
  else log('② 叠加：伤停3+K甲10 → busy · 文案「'+matchIneligibleReason(S,p)+'」');

  // ③ 租出 + 未成年
  p.injury=0;p.kjia=0;p.loanOut={team:'测试队',days:12};p.age=17;
  st=playerStatus(p,S);
  if(!(st.loanOut&&st.minor&&st.busy))fail('租出+未成年 旗标: '+JSON.stringify({lo:st.loanOut,mi:st.minor}));
  else if(trainBlockedReason(S,p).indexOf('租借')<0)fail('训练拦截文案: '+trainBlockedReason(S,p));
  else log('③ 租出12天+17岁：训练拦截「'+trainBlockedReason(S,p)+'」· labels='+playerStatusLabels(st).join('/'));

  // ④ labels 非空且可渲染
  p.loanOut=null;p.age=20;p.retiring=true;p.transferRequest=true;
  st=playerStatus(p,S);
  const labels=playerStatusLabels(st);
  if(labels.length<2)fail('labels 过少: '+JSON.stringify(labels));
  else if(!st.retiring||!st.transferRequest)fail('退役/离队旗标丢失');
  else log('④ 标签：'+labels.join(' · '));

  // ⑤ 阵容可出场过滤（buildBestLineup 走同一资格）
  p.retiring=false;p.transferRequest=false;p.injury=9;
  const line=buildBestLineup(S);
  if(line.includes(p.id))fail('伤停选手仍进首发');
  else log('⑤ buildBestLineup 已排除伤停（首发 '+line.length+' 人）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
