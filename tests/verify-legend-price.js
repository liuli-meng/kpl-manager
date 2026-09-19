// 名宿教练定价回归：AI 换帅回流必须带 cost/wage；缺价码的旧档读档要补回来
// 症状：转会页名宿行渲染 "undefined万"；点「聘为教练」/「聘为助教」→ s.fund-=undefined → 资金 NaN
// 运行：node tests/verify-legend-price.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const priced=o=>typeof o.cost==='number'&&isFinite(o.cost)&&o.cost>0;
  const waged=o=>typeof o.wage==='number'&&isFinite(o.wage)&&o.wage>0;
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  // ① legendPrice 两档口径（与退役转型原区间一致）
  let allStar=true,allPlain=true;
  for(let i=0;i<200;i++){
    const a=legendPrice(80,7),b=legendPrice(70,3);
    if(!(a.wage>=20&&a.wage<=30&&a.cost>=200&&a.cost<=300))allStar=false;
    if(!(b.wage>=13&&b.wage<=18&&b.cost>=117&&b.cost<=167))allPlain=false;
  }
  if(!allStar||!allPlain)fail('legendPrice 越界 star='+allStar+' plain='+allPlain);
  else ok('① legendPrice 两档区间：明星 20-30/200-300，普通 13-18/117-167');

  // ② AI 换帅：旧帅回流名宿市场必须带价码
  S=newState('定价队','x');fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=400;initGroups(S);
  S.preseason=true;S.transferWindow=7;
  // 放一位高加成名宿进市场，逼 AI 来挖（挖人后旧帅回流）
  S.retiredCoaches=[{id:'rcTest',name:'测试名宿',rating:90,type:'coach',bonus:12,styleBonus:6,style:'team',wage:25,cost:280,skill:{n:'x',d:'x'}}];
  const rnd=Math.random;this.Math=Object.create(Math);this.Math.random=()=>0.01;
  const seedIds=new Set(S.retiredCoaches.map(r=>r.id));
  let recycled=[];
  for(let i=0;i<8;i++){
    try{aiTransferWindow(S);}catch(e){fail('aiTransferWindow 抛错: '+e.message);break;}
    recycled=(S.retiredCoaches||[]).filter(r=>!seedIds.has(r.id));
  }
  this.Math.random=rnd;
  const bad=recycled.filter(r=>r.type!=='host'&&(!priced(r)||!waged(r)));
  if(!recycled.length)fail('② 没造出 AI 换帅回流场景（名宿没被挖走），本用例失去意义');
  else if(bad.length)fail('② 回流名宿缺价码: '+JSON.stringify(bad.map(b=>({id:b.id,name:b.name,cost:b.cost,wage:b.wage}))));
  else ok('② AI 换帅回流 '+recycled.length+' 人（'+recycled.map(r=>r.name).join('、')+'），全部带 cost/wage');

  // ③ 签下回流名宿：资金与周薪不能被 undefined 污染
  const rc=(S.retiredCoaches||[]).find(r=>r.type==='coach');
  S.fund=1000;
  signRetired(S,rc.id);
  if(!isFinite(S.fund))fail('③ 签约后 fund=NaN（修复前正是如此）');
  else if(S.fund>=1000)fail('③ 签约没扣钱: '+S.fund);
  else if(!waged(S.coach))fail('③ 新任主教练周薪非法: '+S.coach.wage);
  else ok('③ 签约名宿 '+rc.name+'：资金 1000→'+S.fund+' · 周薪 '+S.coach.wage+'万');
  // 助教 6 折分支
  const rc2=(S.retiredCoaches||[]).find(r=>r.type==='coach')||
    (S.retiredCoaches[0]={id:'rc2',name:'助教名宿',rating:80,type:'coach',bonus:6,styleBonus:3,style:'team',wage:22,cost:200,skill:{n:'x',d:'x'}},S.retiredCoaches[0]);
  S.assistants=[];S.fund=1000;
  hireAssistant(S,rc2.id);
  if(!isFinite(S.fund))fail('③ 聘助教后 fund=NaN');
  else if((S.assistants||[]).some(a=>!waged(a)))fail('③ 助教周薪非法: '+JSON.stringify((S.assistants||[]).map(a=>a.wage)));
  else ok('③ 名宿转助教：资金 1000→'+S.fund+' · 助教工资表 '+ (S.assistants||[]).map(a=>a.wage).join('/'));

  // ④ 旧档修复：手工造一份「回流名宿没有价码」的脏档走 migrateSave
  S=newState('脏档队','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=400;initGroups(S);
  S.v=SAVE_VERSION;
  S.retiredCoaches=[{id:'dirty1',name:'旧帅甲',type:'coach',rating:90,bonus:8,style:'team'}]; // 只有执教字段
  S.assistants=[{id:'dirty2',name:'旧助教乙',type:'assistant',rating:80,bonus:5,style:'mind'}];
  delete S.coach.cost;
  migrateSave();
  const d1=S.retiredCoaches[0],d2=S.assistants[0];
  if(!priced(d1)||!waged(d1))fail('④ 脏名宿未被修复: '+JSON.stringify(d1));
  else if(!priced(d2)||!waged(d2))fail('④ 脏助教未被修复: '+JSON.stringify(d2));
  else if(!priced(S.coach))fail('④ 现任主教练 cost 未补齐: '+S.coach.cost);
  else ok('④ migrateSave 修复脏档：旧帅甲 '+d1.cost+'万/'+d1.wage+'万 · 旧助教乙 '+d2.cost+'万/'+d2.wage+'万');

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
