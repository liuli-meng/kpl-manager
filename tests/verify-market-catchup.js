// 三年报告回归：满编先签后卖 / 弱旅追赶 / 租借落地 / freeSign 文案
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkP=(id,pos,ovr)=>{
    const attrs={lane:ovr,farm:ovr,team:ovr,mind:ovr};
    return {id,name:'测'+id,pos,attrs,skill:{n:'x',t:'team',d:'x'},sig:(HEROES.find(h=>h.pos[0]===pos)||{n:''}).n,
      heroPool:[],career:'',wage:Math.round(wageOf(ovr)),energy:100,morale:80,injury:0,val:100,retiring:false,age:22,
      popularity:10,willingness:80,potential:3,contract:2,signCost:Math.round(valueOf(ovr)*0.58)};
  };

  // ① 满编先签后卖宽限
  S=newState('满编队','满');fillRoster(S,'mid');S.preseason=true;S.transferWindow=7;
  while(rosterCount(S)<ROSTER_MAX){
    const p=mkP('x'+rosterCount(S),'sup',70);
    S.freeAgents=[p];
    signFreeAgent(S,p.id);
    if(rosterCount(S)>=ROSTER_MAX)break;
  }
  if(!rosterFull(S))fail('未到满编: '+rosterCount(S));
  const n0=rosterCount(S);
  const fa2=mkP('over1','mid',72);
  S.freeAgents=[fa2];
  if(!rosterGuard(S))fail('满编宽限失效，无法先签');
  else{
    signFreeAgent(S,fa2.id);
    if(rosterCount(S)<=n0)fail('满编宽限签约未入队');
    else log('① 满编先签后卖：'+n0+'→'+rosterCount(S)+'（硬顶 '+rosterHardMax()+'）');
  }

  // ② 超编时 sellGuard 放行
  if(!sellGuard(S))fail('超编仍被 sellGuard 拦');
  else log('② 超编不限卖：可裁减回 '+ROSTER_MAX);

  // ③ 正常名单 sellGuard 至少 2 个卖出名额
  S=newState('卖队','卖');fillRoster(S,'mid');S.preseason=true;S.transferWindow=7;
  // 8 人
  while(rosterCount(S)<8){
    const p=mkP('b'+rosterCount(S),'sup',68);
    S.freeAgents=[p];signFreeAgent(S,p.id);
    if(rosterCount(S)>=8)break;
  }
  S.windowSold=2;
  if(!sellGuard(S))fail('卖一买一名额不足: sold=2 n='+rosterCount(S));
  else log('③ 卖出名额：名单 '+rosterCount(S)+' 人可卖至 '+Math.max(2,Math.floor(rosterCount(S)/2)));

  // ④ 转会期租借窗
  S=newState('租队','租');fillRoster(S,'low');S.mode='coach';
  S.preseason=true;S.transferWindow=7;S.fund=5000;
  if(!loanWindowOpen(S))fail('转会期租借窗未开');
  else if(loanCap(S)<1)fail('转会期 loanCap=0');
  else log('④ 转会期租借开放：cap='+loanCap(S)+' · 弱旅='+(typeof isWeakClub==='function'&&isWeakClub(S)));

  // ⑤ freeSign 非窗期不新增拦截（空串=放行），挂牌期才有拦截文案
  S=newState('文案队','文');fillRoster(S,'mid');S.preseason=false;S.transferWindow=0;
  const r0=freeSignBlockedReason(S);
  S.preseason=true;S.transferWindow=2;S.transferWindowStart=7; // 进入挂牌期
  const r1=freeSignBlockedReason(S);
  if(r0)fail('非窗期不应新增拦截: '+r0);
  else if(!/挂牌期/.test(r1||''))fail('挂牌期应拦截买断: '+r1);
  else log('⑤ freeSign：非窗放行 · 挂牌期拦截（'+r1.slice(0,24)+'…）');

  // ⑥ 弱旅青训 5 折
  S=newState('青训队','青');fillRoster(S,'low');S.fund=5000;S.preseason=false;
  const weak=isWeakClub(S);
  const c=rookieTrainCost(S);
  if(weak && c>=ROOKIE_TRAIN_COST)fail('弱旅青训未打折: '+c);
  else log('⑥ 青训成本 '+c+' 万（基准 '+ROOKIE_TRAIN_COST+' · weak='+weak+'）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
