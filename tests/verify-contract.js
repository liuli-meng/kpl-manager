// 2026-09 合同谈判回归：年限/报价可谈 → 心理价位被拒抬价 → 三轮谈崩 → 高价接受 → 提前续约
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const elCache = {};
const cachedEl = sel => elCache[sel] || (elCache[sel] = el());
const dom = {getElementById:id=>cachedEl('#'+id),querySelector:sel=>cachedEl(sel),querySelectorAll:()=>[],localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:sel=>cachedEl(sel),querySelectorAll:()=>[],createElement:()=>el(),execCommand:()=>{},body:el(),addEventListener(){},removeEventListener(){}},window:null,confirm:()=>true,alert(){},toast(){},location:{reload(){}},setTimeout:()=>0,clearTimeout(){},addEventListener(){},removeEventListener(){}};
dom.window = dom; vm.createContext(dom); vm.runInContext(code, dom);

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  S=newState('测试队','剑');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.fund=100000;S.transferWindow=7;

  // ① 年限溢价：1年 < 2年 < 4年 心理价位递增
  const p=S.players[0];
  const ask1=renewAskWage(p,1),ask2=renewAskWage(p,2),ask4=renewAskWage(p,4);
  if(!(ask1<ask2&&ask2<ask4))fail('年限溢价失效: '+ask1+'/'+ask2+'/'+ask4);
  else log('①年限溢价: 1年'+ask1+'万 < 2年'+ask2+'万 < 4年'+ask4+'万');

  // ② 签字费按年限递增
  const c1=renewCostN(p,1),c2=renewCostN(p,2),c4=renewCostN(p,4);
  if(!(c1<c2&&c2<c4))fail('签字费未随年限递增: '+c1+'/'+c2+'/'+c4);
  else log('②签字费随年限: 1年'+c1+'万 → 2年'+c2+'万 → 4年'+c4+'万');

  // ③ 谈判入口：合同 >1 年不允许谈；最后一年/到期允许
  p.contract=3;
  openRenewNego(S,p.id);
  if(_nego)fail('剩余 2 年以上不应进入谈判');
  else log('③合同剩余多年不可谈（防提前锁死）OK');
  p.contract=1;
  openRenewNego(S,p.id);
  if(!_nego)fail('最后一年应可提前谈判');
  else log('④最后一年可提前谈: 心理价位 '+_nego.ask+'万/周');

  // ⑤ 低价大概率被拒并抬价；三轮后谈崩（士气受损）——概率事件，重试到触发为止
  const mor0=p.morale;
  let struck=false,tries=0,lastMor=p.morale;
  while(tries++<40&&!struck){
    if(!_nego){p.contract=1;openRenewNego(S,p.id);}
    if(!_nego)continue;
    _nego.offer=Math.max(5,Math.round(_nego.ask*0.5)); // 半价：几乎必拒
    lastMor=p.morale; // 谈崩前后对比基准=本次谈判前士气（多次重试可能抬过士气，不能拿最初值比）
    submitRenewNego();
    if(p.contract>1){p.contract=1;_nego=null;continue;} // 运气好被接受：重置再试
    if(!_nego&&p.morale<lastMor){struck=true;break;} // 三轮谈崩：_nego 清空 + 士气受损
  }
  if(struck&&p.contract===1)log('⑤低价三轮谈崩: 士气 '+lastMor+' → '+p.morale+'，合同保持最后一年');
  else fail('低价谈判未触发谈崩: struck='+struck+' attempt='+(_nego&&_nego.attempt)+' contract='+p.contract);

  // ⑥ 高价报价：按谈定周薪与年限签订（接受是概率事件——高价只是"大概率"，小概率仍会被拒/谈崩，有界重试到触发为止）
  let ok6=false,wage6=0,cost6=0,ask6=0,offer6=0;
  for(let t=0;t<30&&!ok6;t++){
   p.contract=1;_nego=null;S.fund=100000;
   openRenewNego(S,p.id);
   if(!_nego)continue;
   renewNegoYears(3);
   ask6=_nego.ask;
   _nego.offer=Math.round(ask6*1.5);offer6=_nego.offer;
   const f0=S.fund;
   submitRenewNego();
   if(p.contract===3&&p.wage===offer6&&S.fund<f0){ok6=true;wage6=p.wage;cost6=f0-S.fund;}
  }
  if(ok6)log('⑥高价接受: 3年 · 周薪 '+wage6+'万（要价 '+ask6+'万）· 签字费 '+cost6+'万');
  else fail('高价报价应被接受: contract='+p.contract+' wage='+p.wage);

  // ⑦ 到期选手谈判后移出 expiring（不处理会被自动续 1 年，处理则按谈判结果；接受是概率事件，有界重试）
  const p2=S.players[1];
  let ok7=false,yr7=0;
  for(let t=0;t<30&&!ok7;t++){
   p2.contract=0;S.expiring=[p2.id];_nego=null;
   openRenewNego(S,p2.id);
   if(!_nego)continue;
   _nego.offer=Math.round(_nego.ask*1.6);
   submitRenewNego();
   if(p2.contract>=1&&!S.expiring.includes(p2.id)){ok7=true;yr7=p2.contract;}
  }
  if(ok7)log('⑦到期续约后移出到期名单: '+yr7+'年');
  else fail('到期续约未清理 expiring: expiring='+S.expiring.length);

  // ⑧ 资金不足时拒绝报价（不扣钱、不签合同）
  const p3=S.players[2];
  p3.contract=1;S.fund=1;
  openRenewNego(S,p3.id);
  submitRenewNego();
  if(p3.contract===1&&S.fund===1)log('⑧资金不足：报价被拒且不改动合同');
  else fail('资金不足未拦截: contract='+p3.contract+' fund='+S.fund);

  // ⑨ 渲染冒烟：续约面板 + 谈判弹窗模板
  try{renderMarket();log('⑨转会页续约面板渲染 OK');}catch(e){fail('续约面板渲染异常: '+e.message);}
  S.fund=100000;
  openRenewNego(S,S.players[3].id);
  try{renderRenewNego();log('⑩续约谈判弹窗渲染 OK');}catch(e){fail('谈判弹窗渲染异常: '+e.message);}
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,dom);
console.log(out);
