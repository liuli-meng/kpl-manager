// 青训一键培养回归：一次点完（每人各一次）/ 已达标跳过 / 每日名额共享 / 资金不足按潜力优先
// 起因：academyTrained 是全局单标志，青训一多只能跨天一个个点；一键培养要保证语义不漂、钱不白花。
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // 确定性构造青训（不走 genRookie 的随机属性，断言才能精确）
  const mk=(id,pot,v)=>({id,name:id,pos:'mid',team:null,tags:['青训'],
   attrs:{lane:v[0],farm:v[1],team:v[2],mind:v[3]},sig:'貂蝉',heroPool:[{n:'貂蝉',lv:2}],
   wage:3,energy:ENERGY_MAX,morale:80,injury:0,mvp:0,retiring:false,age:18,popularity:5,
   willingness:70,potential:pot,isRookie:true,contract:2});
  const total=r=>['lane','farm','team','mind'].reduce((t,k)=>t+r.attrs[k],0);
  const setup=(fund,academy)=>{
   S=newState('青训测试队','测');
   fillRoster(S,'mid');
   S.coach={...COACH_POOL.find(c=>c.id==='co12')};
   S.lineup=S.players.map(p=>p.id);
   S.seedPower=teamPower(S);
   S.fund=fund;S.academy=academy;S.academyTrained=false;
   return S;
  };

  // ① 一键培养：3 个未达标各培养一次，扣 3×17
  const a=mk('a',5,[60,60,60,60]),b=mk('b',4,[60,60,60,60]),c=mk('c',3,[60,60,60,60]);
  setup(1000,[a,b,c]);
  const before=[total(a),total(b),total(c)];
  trainAllRookies(S);
  if(S.fund!==1000-3*ROOKIE_TRAIN_COST)fail('①资金应为 '+(1000-51)+'，实际 '+S.fund);
  else if(![a,b,c].every((r,i)=>total(r)>before[i]))fail('①有人没被培养：'+JSON.stringify(before)+' → '+JSON.stringify([total(a),total(b),total(c)]));
  else if(!S.academyTrained)fail('①一键培养未消耗每日名额');
  else log('①一键培养 3 人各一次 · 扣 '+(3*ROOKIE_TRAIN_COST)+'万 · 名额已消耗');

  // ② 已达标（四维≥300）的不进池、不花钱
  const d=mk('d',5,[80,80,80,80]); // 320 已达标
  setup(1000,[mk('e',3,[60,60,60,60]),d]);
  const dBefore=total(d);
  trainAllRookies(S);
  if(S.fund!==1000-ROOKIE_TRAIN_COST)fail('②应为只扣 1 人（'+ROOKIE_TRAIN_COST+'万），实际 '+S.fund);
  else if(total(d)!==dBefore)fail('②已达标的青训被培养了（浪费钱）');
  else log('②已达标青训跳过 · 只培养未达标的（扣 '+ROOKIE_TRAIN_COST+'万）');

  // ③ 每日名额共享：一键用掉后，单个培养必须被拒且不动钱
  const f=mk('f',3,[60,60,60,60]);
  setup(1000,[f]);
  trainAllRookies(S);
  const fundAfter=S.fund, fTotal=total(f);
  trainRookie(S,f.id);
  if(S.fund!==fundAfter||total(f)!==fTotal)fail('③一键用掉名额后单个培养仍然生效（每日名额未共享）');
  else log('③每日名额共享：一键后单个培养被拒，资金与属性不变');

  // ④ 资金不足：按潜力从高到低优先，低潜跳过并提示
  const p5=mk('p5',5,[60,60,60,60]),p4=mk('p4',4,[60,60,60,60]),p2=mk('p2',2,[60,60,60,60]);
  setup(2*ROOKIE_TRAIN_COST,[p5,p4,p2]); // 只够 2 人
  trainAllRookies(S);
  if(total(p5)===60*4)fail('④高潜力 p5 未被优先培养');
  else if(total(p4)===60*4)fail('④次高潜力 p4 未被优先培养');
  else if(total(p2)!==60*4)fail('④资金不足时仍培养了低潜力 p2');
  else if(S.fund!==0)fail('④资金应为 0，实际 '+S.fund);
  else log('④资金只够 2 人：按潜力 5→4 优先，潜力 2 跳过 · 资金归零');

  // ⑤ 一个都练不起：不消耗名额（否则玩家白白丢掉当天机会）
  setup(ROOKIE_TRAIN_COST-1,[mk('g',5,[60,60,60,60])]);
  trainAllRookies(S);
  if(S.academyTrained)fail('⑤资金不足却消耗了每日名额');
  else if(S.fund!==ROOKIE_TRAIN_COST-1)fail('⑤资金不足却扣钱了');
  else log('⑤资金不足时名额与资金均未变动');

  // ⑥ 空营 / 全达标：同样不消耗名额
  setup(1000,[]);
  trainAllRookies(S);
  const emptyOk=!S.academyTrained&&S.fund===1000;
  setup(1000,[mk('h',5,[80,80,80,80])]);
  trainAllRookies(S);
  const allReadyOk=!S.academyTrained&&S.fund===1000;
  if(!emptyOk||!allReadyOk)fail('⑥空营/全达标误消耗名额: 空='+emptyOk+' 全达标='+allReadyOk);
  else log('⑥空营与全达标均不消耗名额、不扣钱');

  // ⑦ 成长公式一致：单独培养与一键培养都走 applyRookieTrain（增量落在 2+pot/2 ~ 4+pot/2）
  setup(1000,[mk('i',5,[50,50,50,50]),mk('j',5,[50,50,50,50])]);
  const r1=S.academy[0],r2=S.academy[1];
  trainRookie(S,r1.id);
  const soloGain=total(r1)-200;
  S.academyTrained=false;
  trainAllRookies(S);
  const bulkGain=total(r2)-200;
  const lo=2+Math.floor(5/2),hi=4+Math.floor(5/2);
  if(soloGain<lo||soloGain>hi)fail('⑦单独培养增量越界: '+soloGain+' 应在 ['+lo+','+hi+']');
  else if(bulkGain<lo||bulkGain>hi)fail('⑦一键培养增量越界: '+bulkGain+' 应在 ['+lo+','+hi+']');
  else log('⑦单独/一键共用同一成长公式（潜力5 增量 '+soloGain+' / '+bulkGain+'，界内 ['+lo+','+hi+']）');

  // ⑧ 渲染入口断言：训练页必须出现 trainAllRookies（防「面板渲染了、入口没渲染」）
  setup(1000,[mk('k',3,[60,60,60,60])]);
  renderPage('train');
  const html=document.getElementById('page-train').innerHTML;
  if(html.indexOf('trainAllRookies')<0)fail('⑧训练页缺一键培养入口');
  else if(html.indexOf('一键培养')<0)fail('⑧入口按钮文案缺失');
  else log('⑧训练页已渲染一键培养入口');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join(String.fromCharCode(10));
})()
`, dom);
console.log(out);
