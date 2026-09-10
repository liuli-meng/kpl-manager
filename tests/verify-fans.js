// 粉丝与商业闭环回归：粉丝成长 / 收入随粉丝放大 / 赞助门槛拦截 / 里程碑提示 / 旧档兜底
// 运行：node tests/verify-fans.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('粉丝队','x');fillRoster(S,'mid','star');return S;};

  // ① 开档粉丝由阵容人气决定：自建底子低、执教底子高；都不为负
  const a=mkS();a.selfBuilt=true;const fa=initFans(a);
  const b=mkS();b.selfBuilt=false;const fb=initFans(b);
  if(!(fa>0&&fb>0))fail('开档粉丝应为正数: 自建'+fa+' 执教'+fb);
  else if(!(fb>=fa))fail('执教档起步粉丝应不低于自建档: '+fb+' < '+fa);
  else log('① 开档粉丝：自建 '+fa+' 万 · 执教 '+fb+' 万（按阵容人气）');

  // ② 赛段结算涨粉：夺冠 > 进季后赛 >= 止步（止步只保留阵容人气基本盘，不倒扣）
  const s=mkS();s.fans=10;
  const g1=awardSplitFans(s,true,false)-10;
  s.fans=10;const g2=awardSplitFans(s,false,false)-10;
  s.fans=10;s.phase='eliminated';const g3=awardSplitFans(s,false,false)-10;
  const popBase=s.players.reduce((t,p)=>t+(p.popularity||0),0)/60;
  s.fans=1;addFans(s,-999,'测试负值');
  if(!(g1>g2))fail('夺冠涨粉应多于普通赛段: '+g1+' vs '+g2);
  else if(!(g2>=g3))fail('进季后赛涨粉应不少于止步: '+g2+' vs '+g3);
  else if(g3<0)fail('止步不应倒扣粉丝: '+g3);
  else if(Math.abs(g3-popBase)>0.05)fail('止步增量应恰为阵容人气基本盘 '+popBase.toFixed(2)+'，实际 '+g3);
  else if(s.fans<0)fail('粉丝被扣成负数: '+s.fans);
  else log('② 赛段涨粉：夺冠 +'+g1+' · 进季后赛 +'+g2+' · 止步 +'+g3+'（止步只留人气基本盘 +'+popBase.toFixed(2)+'）· 下限不为负');

  // ③ 里程碑提示：跨过赞助商门槛时提示可洽谈的档位
  const s3=mkS();s3.eventLog=[];s3.fans=19;addFans(s3,2,'测试');
  const hit=(s3.eventLog||[]).some(e=>/粉丝突破 20 万/.test(e.txt));
  if(!hit)fail('跨过 20 万门槛未提示（成绩→商业的引导断了）');
  else log('③ 里程碑：跨过 20 万粉丝提示可洽谈「本地电竞馆」级赞助');

  // ④ 收入随粉丝放大：赞助单价与门票流水都涨，且**两者共用同一个封顶**（防极端值顶穿日流水）
  const s4=mkS();s4.sponsorLv=1;s4.fans=0;const inc0=dailyCommercialIncome(s4);
  s4.fans=100;const inc100=dailyCommercialIncome(s4);
  s4.fans=99999;const incMax=dailyCommercialIncome(s4);
  s4.fans=FAN_CAP;const incCap=dailyCommercialIncome(s4);
  const expect100=Math.round(SPONSORS[1].income*(1+100/500))+Math.round(100*0.08);
  const expectCap=Math.round(SPONSORS[1].income*(1+FAN_CAP/500))+Math.round(FAN_CAP*0.08);
  if(inc0!==SPONSORS[1].income)fail('0 粉丝时不应有加成: '+inc0);
  else if(inc100!==expect100)fail('100 粉丝日流水应为 '+expect100+'，实际 '+inc100);
  else if(incMax!==expectCap)fail('粉丝超上限后日流水未封顶: 期望 '+expectCap+'，实际 '+incMax);
  else log('④ 日流水：0 粉 '+inc0+'万 → 100 粉 '+inc100+'万 → 封顶值 '+incCap+'万（粉丝计效上限 '+FAN_CAP+' 万）');
  const s4b=mkS();s4b.fans=0;const e0=fanMul(s4b,300);s4b.fans=300;const e1=fanMul(s4b,300);
  if(Math.abs(e0-1)>1e-9||Math.abs(e1-2)>1e-9)fail('代言粉丝系数异常: '+e0+'→'+e1);
  else log('④ 代言系数：0 粉 ×1.00 → 300 粉 ×2.00');

  // ⑤ 赞助升级门槛：粉丝不足被拦（钱够也不行），达标后成功
  const s5=mkS();s5.sponsorLv=0;s5.fund=99999;s5.fans=10;
  upgradeSponsor();
  if(s5.sponsorLv!==0)fail('粉丝不足却升级成功（门槛失效）');
  else if(s5.fund!==99999)fail('被拦时不应扣钱: '+s5.fund);
  else log('⑤ 门槛：钱够但粉丝 10 万 → 升级被拦且不扣款');
  s5.fans=25;upgradeSponsor();
  if(s5.sponsorLv!==1)fail('粉丝达标后应能升级，实际 lv='+s5.sponsorLv);
  else if(s5.fund!==99999-SPONSORS[1].cost)fail('升级扣款错误: '+s5.fund);
  else log('⑤ 门槛：粉丝 25 万 → 升级到「'+SPONSORS[1].name+'」成功，扣款 '+SPONSORS[1].cost+'万');

  // ⑥ 面板渲染：粉丝数与门槛都要显示（含"还差多少粉"）
  const s6=mkS();s6.sponsorLv=0;s6.fans=5;goPage('biz');renderBiz();
  const html=document.querySelector('#page-biz').innerHTML;
  if(!/粉丝 <b>5<\\/b> 万/.test(html))fail('赞助商面板未显示粉丝数');
  else if(!html.includes('还差 15万粉'))fail('未提示还差多少粉丝');
  else log('⑥ 面板：显示粉丝 5 万与"还差 15万粉"提示');

  // ⑦ 旧档兜底：缺 fans 字段 → 中性起始值，不为 undefined
  const legacy=JSON.parse(JSON.stringify(mkS()));delete legacy.fans;legacy.v=SAVE_VERSION;
  S=legacy;migrateSave();
  if(typeof S.fans!=='number'||isNaN(S.fans))fail('缺 fans 的旧档未兜底: '+S.fans);
  else log('⑦ 旧档兜底：缺 fans 字段 → '+S.fans+' 万');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
