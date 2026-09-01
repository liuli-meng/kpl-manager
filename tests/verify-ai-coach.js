// AI 教练体系回归测试：懒初始化（按俱乐部模板落位）/ 转会期挖角名宿教练 / 旧帅回流 / 战力按教练加成差异化结算
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const dom = {getElementById:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),execCommand:()=>{},body:el()},window:null,confirm:()=>true,alert(){},toast(){},location:{reload(){}},setTimeout:()=>0,clearTimeout(){}};
dom.window = dom; vm.createContext(dom); vm.runInContext(code, dom);
const out = vm.runInContext(`
(function(){
  const res=[];
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  let hadFail=false;
  // 1) 懒初始化：按原版俱乐部模板落位（AG=Zwy +9%，UUG=co4 +8%）
  S=newState('测试队','⚔️');
  const map=aiCoachState(S);
  const initCoaches=JSON.parse(JSON.stringify(map)); // 深拷贝初始教练表（map 与 S.aiCoaches 同引用，换帅会被覆盖）
  const ag=map['成都AG超玩会'],uug=map['常山UUG'];
  if(!ag||ag.name!=='Zwy'||ag.bonus!==9)fail('AG 教练初始化错误: '+JSON.stringify(ag));
  if(!uug)fail('UUG 教练初始化错误: '+JSON.stringify(uug));
  res.push('[PASS] 懒初始化: AG='+ag.name+'(+'+ag.bonus+'%) UUG='+uug.name+'(+'+uug.bonus+'%)');
  // 2) 战力按教练加成差异化（无记录队=默认 +6%，即旧 AI_STAFF 等价值）
  const agR=ensureAiRosters(S,'成都AG超玩会');
  const powAG=aiRosterPower(agR,S,'成都AG超玩会');
  const powNoRec=aiRosterPower(agR,S,'不存在的队');
  if(powAG<=powNoRec)fail('教练加成未生效: 有记录='+powAG+' 无记录='+powNoRec);
  res.push('[PASS] 战力差异化: AG(+'+ag.bonus+'%)='+powAG+' vs 无记录(+6%)='+powNoRec);
  // 3) 转会期挖角：名宿市场放高分教练，反复跑转会期必被某 AI 队签走
  S.retiredCoaches=[{id:'rcTest',name:'测试名帅',rating:85,style:'team',bonus:9,styleBonus:4,wage:15,cost:160,skill:{n:'名宿执教',d:'test'},type:'coach',origin:'测试'}];
  S.preseason=false;S.transferWindow=10;S.transferList=[];
  let signed=null;
  for(let i=0;i<200&&!signed;i++){
    aiTransferWindow(S);
    const owner=Object.keys(S.aiCoaches||{}).find(t=>S.aiCoaches[t].id==='rcTest');
    if(owner)signed=owner;
    else S.retiredCoaches=[{id:'rcTest',name:'测试名帅',rating:85,style:'team',bonus:9,styleBonus:4,wage:15,cost:160,skill:{n:'名宿执教',d:'test'},type:'coach',origin:'测试'}]; // 未成交则补回池子继续诱导
  }
  if(!signed)fail('200 次转会期均未挖角名宿教练');
  else{
    // 旧帅去向二选一：仍在名宿市场待签，或已被另一个 AI 队再签走（同一转会窗内市场活跃）
    const old=initCoaches[signed]||{};
    const inMarket=S.retiredCoaches.some(r=>r.type==='coach'&&r.id===old.id);
    const reSigned=Object.keys(S.aiCoaches).some(t=>t!==signed&&S.aiCoaches[t].id===old.id);
    if(old.id&&!inMarket&&!reSigned)fail('换帅后旧帅失踪: '+old.name);
    else res.push('[PASS] 挖角+回流: 测试名帅被 '+signed+' 签走，旧帅 '+old.name+(inMarket?' 回流名宿市场':' 已被 '+Object.keys(S.aiCoaches).find(t=>t!==signed&&S.aiCoaches[t].id===old.id)+' 再签走'));
  }
  // 4) 换帅后战力缓存失效重算（新教练加成体现到 aiPower）
  S.aiRosters={};
  ensureAiRosters(S,signed);
  const newPow=S.aiPower[signed];
  if(!newPow)fail('换帅后 '+signed+' 战力未重算');
  else res.push('[PASS] 缓存失效重算: '+signed+' 换帅后战力='+newPow);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,dom);
console.log(out);
