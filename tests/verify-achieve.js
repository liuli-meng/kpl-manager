// 2026-09 成就系统回归：save 巡检解锁 / 条件判定 / 唯一性 / 旧档迁移 / 面板渲染
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
  S=newState('成就测试队','证');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.players[0].attrs={lane:95,farm:95,team:95,mind:95}; // 保证 star90 条件稳定（随机 star 档可能摇到 89）
  S.fund=100000;

  // ① 巡检挂载：save() 即评估。开局自带 90+ 王牌 → star90 解锁；selfBuilt 未标记 → found 不解锁
  save();
  if(!S.achieved.star90)fail('star90 未随 save 解锁（开局王牌 overall=' + overall(S.players[0]) + '）');
  else log('①save 巡检: star90 自动解锁（王牌总值' + overall(S.players[0]) + '）');
  if(S.achieved.found)fail('selfBuilt=false 不应解锁 found');
  else log('②自建标记缺失时 found 不解锁 OK');

  // ② 自建开局标记 → 白手起家
  S.selfBuilt=true;save();
  if(!S.achieved.found)fail('selfBuilt=true 未解锁 found');
  else log('③自建俱乐部: 白手起家 ' + S.achieved.found + ' 年解锁');

  // ③ 签教练 → 良师入帐
  S.coach={id:'c1',name:'测试教练',rating:82,style:'team',bonus:4,styleBonus:6,wage:60,skill:{n:'稳',d:'d'}};
  save();
  if(!S.achieved.coach)fail('签约教练未解锁 coach');
  else log('④签下教练: 良师入帐 OK');

  // ④ 首胜 + 首冠链：history win → first_win；honors champion → first_title
  S.history=[{opp:'重庆狼队',win:false,score:'2:3',stage:'常规赛'}];
  save();
  if(S.achieved.first_win)fail('history 无胜场不应解锁 first_win');
  S.history.push({opp:'苏州KSG',win:true,score:'3:1',stage:'常规赛'});
  save();
  if(!S.achieved.first_win)fail('首胜未解锁 first_win');
  else log('⑤队史首胜: 旗开得胜 OK');

  // ⑤ 冠军链：春季赛冠军 → t_spring + first_title；再夏冠 → 卫冕 defend
  S.titleHistory=[{season:S.season,split:'spring',event:'春季赛',champ:'其他队'}];
  save();
  if(S.achieved.t_spring)fail('春季赛冠军是别人，不应解锁 t_spring');
  S.titleHistory=[{season:S.season,split:'spring',event:'春季赛',champ:S.teamName}];
  S.honors=[{season:S.season,title:'2026 春季赛 总冠军',champion:true,roster:'甲、乙'}];
  save();
  if(!S.achieved.t_spring||!S.achieved.first_title)fail('夺冠未解锁 t_spring/first_title: ' + JSON.stringify(S.achieved));
  else log('⑥首冠 + 春季赛冠军: 首冠时刻/银龙加冕 OK');
  S.titleHistory.push({season:S.season,split:'summer',event:'夏季赛',champ:S.teamName});
  save();
  if(!S.achieved.t_summer||!S.achieved.defend)fail('夏冠未解锁 t_summer/defend');
  else log('⑦夏季赛卫冕: 夏季赛登顶/卫冕成功 OK');

  // ⑥ 一年三冠（同 season 三条）+ 亚运金牌
  S.titleHistory.push({season:S.season,split:null,event:'挑战者杯',champ:S.teamName});
  save();
  if(!S.achieved.triple_year)fail('同年三冠未解锁 triple_year');
  else log('⑧一年三冠: OK');
  S.titleHistory.push({season:S.season,split:null,event:'亚运会',champ:'中国代表队'});
  save();
  if(!S.achieved.asiad_gold)fail('亚运金牌未解锁 asiad_gold');
  else log('⑨亚运会中国夺金: 亚洲之巅 OK');

  // ⑦ 青训三连：academyGrad 标记 → 出道/随队夺冠
  S.players[2].academyGrad=true;S.players[2].name='青训之星';
  save();
  if(!S.achieved.youth_first)fail('academyGrad 未解锁 youth_first');
  S.honors=[{season:S.season,title:'2026 春季赛 总冠军',champion:true,roster:'青训之星、甲'}];
  save();
  if(!S.achieved.youth_champ)fail('青训生随队夺冠未解锁 youth_champ');
  else log('⑩青训出道+随队夺冠: OK');

  // ⑧ 经营线：天价出售（走真实成交路径）→ big_sale；资金 2 亿 → rich
  const sellP=S.players[3];
  const fund0=S.fund;
  completeSale(S,sellP,3000,'接盘俱乐部');
  save();
  if(!((S.maxSale||0)>=3000))fail('completeSale 未记录 maxSale: ' + S.maxSale);
  else if(!S.achieved.big_sale)fail('卖出 3000万 未解锁 big_sale');
  else log('⑪天价交易: maxSale=' + S.maxSale + '万，成交入账 ' + (S.fund - fund0) + '万 OK');
  S.fund=25000;save();
  if(!S.achieved.rich)fail('资金 2.5 亿未解锁 rich');
  else log('⑫亿万豪门: OK');

  // ⑨ 国家征召 + 火热状态 + 生涯 MVP
  S.natSquad=[{name:'别人',pos:'top',mine:false,ovr:88},{name:S.players[0].name,pos:S.players[0].pos,mine:true,ovr:92}];
  S.players[0].val=145;S.players[1].mvp=12;
  save();
  if(!S.achieved.nat_call||!S.achieved.hot_form||!S.achieved.mvp10)fail('征召/火热/MVP10 未解锁: ' + JSON.stringify({n:S.achieved.nat_call,h:S.achieved.hot_form,m:S.achieved.mvp10}));
  else log('⑬国家征召/状态火热/MVP收割机: OK');

  // ⑩ 唯一性：重复 save 不改写解锁年份、不重复计费
  const y0=S.achieved.rich;S.fund=30000;save();
  if(S.achieved.rich!==y0)fail('重复 save 改写了已解锁年份');
  else log('⑭成就唯一性: 解锁年份不被改写 OK');

  // ⑪ 长情经营（第五赛季）
  S.season=5;save();
  if(!S.achieved.five_year)fail('第 5 赛季未解锁 five_year');
  else log('⑮长情经营: ' + gameYear(S) + ' 赛季 OK');

  // ⑫ FMVP 名人堂线：本队 FMVP
  S.fmvpHonor=[{year:2026,event:'春季赛',name:S.players[0].name,team:S.teamName}];
  save();
  if(!S.achieved.own_fmvp)fail('本队 FMVP 未解锁 own_fmvp');
  else log('⑯本队 FMVP: OK');

  // ⑬ 经营页成就面板渲染：含计数与已解锁标记
  renderBiz();
  const bizHtml=$('#page-biz').innerHTML;
  if(!bizHtml.includes('成就')||!bizHtml.includes('已解锁'))fail('renderBiz 缺成就面板');
  else if(!bizHtml.includes('首冠时刻'))fail('成就面板缺已解锁项');
  else log('⑰经营页成就面板渲染 OK（' + (bizHtml.match(/年解锁/g)||[]).length + ' 项带年份）');

  // ⑭ 旧档迁移：无 achieved/selfBuilt/maxSale 字段不报错且补默认值
  S.achieved=null;S.selfBuilt=null;S.maxSale=null;
  try{migrateSave();}catch(e){fail('旧档迁移抛错: ' + e.message);}
  if(!S.achieved||S.selfBuilt!==false||S.maxSale!==0)fail('迁移未补默认值: ' + JSON.stringify({a:typeof S.achieved,s:S.selfBuilt,m:S.maxSale}));
  else log('⑱旧档迁移: achieved/selfBuilt/maxSale 补默认值 OK');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join(String.fromCharCode(10));
})()
`, dom);
console.log(out);
