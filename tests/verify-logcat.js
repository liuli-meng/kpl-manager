// 事件动态分类回归：互斥分区 / 成就归荣誉 / 赛制说明不被判成败绩 / 比赛日志不串进财政
// 背景：旧版在渲染层用正则猜分类且拿 level==='gold' 当荣誉门槛，导致
//   ① 比赛日志全带"奖金 X万"→ 100% 同时落进"财政"
//   ② 「成就解锁」level 是 info → 荣誉分类永远查不到（honor 正则里的该关键词是死代码）
//   ③ 赛制说明含"双败"→ 被 logLevel 判成 lose，混进"比赛"
// 运行：node tests/verify-logcat.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // 真实文案模板（取值来自 season/match/transfer/main 各写入点）
  const CASES=[
    ['honor',' 季后赛（总决赛）：探针队 胜 成都AG超玩会 4:2——夺得总冠军！（奖金 800万）'],
    ['honor',' 成就解锁「良师入帐」——签下第一名主教练'],
    ['honor',' 征召宣布：弈秋 入选中国代表队（亚运会集训，夏季赛缺席）'],
    ['match',' 常规赛·第一轮：探针队 胜 北京WB 3:1（小局奖金 160万）'],
    ['match',' 常规赛·第一轮：探针队 负 南京Hero久竞 2:3（小局奖金 160万）'],
    ['match',' 卡位赛：探针队 遗憾落败 济南RW侠 1:3（奖金 200万）'],
    ['match',' 联赛战报（第1轮）：G1组：重庆狼队 3:0 北京JDG'],
    ['fund',' 签约新赞助商「灵梦科技」，每日收入 12万'],
    ['fund',' 转会达成！ 弈秋 加盟 探针队（转会费 2513万 · 年薪 495万）'],
    ['fund',' 选手代言收入 1017万（人气变现）'],
    ['other',' KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛'],
    ['other',' 训练完成：弈秋 的「对线」提升 3 点'],
  ];

  // ① 分类正确性 + 分区合法性
  const bad=[];
  CASES.forEach(([want,txt])=>{
    const got=logCat(txt);
    if(got!==want)bad.push(want+'≠'+got+' :: '+txt.slice(0,26));
    if(['honor','match','fund','other'].indexOf(got)<0)bad.push('越界分类 '+got);
  });
  if(bad.length)fail('分类偏差: '+bad.join(' | '));
  else log('① 12 条真实文案分类全部符合预期');

  // ② 互斥：同一条日志同时命中多个正则时，只归优先级最高的一类
  const multi=' 季后赛（总决赛）：探针队 胜 成都AG超玩会 4:2——夺得总冠军！（奖金 800万）';
  const hitCats=LOG_CATS.filter(c=>c.re.test(multi)).map(c=>c.k);
  if(hitCats.length<2)fail('互斥用例失效：该文案本应同时命中多类，实际 '+JSON.stringify(hitCats));
  if(LOG_CATS.filter(c=>c.re.test(multi)).length&&logCat(multi)!=='honor')fail('多类命中时未按优先级归 honor');
  else log('② 互斥生效：命中 '+hitCats.join('+')+' → 只归 honor（旧版会同时出现在荣誉和财政）');

  // ③ 分区完备：任意文案都有归属，四类相加=总数
  const cnt={honor:0,match:0,fund:0,other:0};
  CASES.forEach(([,txt])=>cnt[logCat(txt)]++);
  if(cnt.honor+cnt.match+cnt.fund+cnt.other!==CASES.length)fail('分区不完备：分类合计≠总数');
  const empty=Object.keys(cnt).filter(k=>!cnt[k]);
  if(empty.length)fail('以下分类无样本可渲染: '+empty.join(','));
  else log('③ 分区完备：四类均有样本，合计='+CASES.length);

  // ④ logLevel 修复：赛制说明不再被判为败绩/胜绩（"双败""卡位赛"都是误伤源）
  const lv=logLevel(' KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛');
  if(lv!=='info')fail('赛制说明 level 应为 info（"双败"/"卡位赛"误伤），实际 '+lv);
  else log('④ 赛制说明 level=info（"双败""卡位赛"不再误染成败绩/胜绩色）');
  if(logLevel(' 成就解锁「旗开得胜」——队史首胜')!=='gold')fail('成就解锁 level 应为 gold（金=金钱与荣誉）');
  else log('④ 成就解锁 level=gold（旧版是 info，导致荣誉分类永远查不到）');

  // ⑤ logEvent 写入即带分类标签（渲染层不再靠猜）
  S=newState('探针队','⚔️');
  S.eventLog=[];
  logEvent(S,' 成就解锁「良师入帐」——签下第一名主教练');
  if(S.eventLog[0].cat!=='honor')fail('logEvent 未写入 cat 字段: '+JSON.stringify(S.eventLog[0]));
  else log('⑤ logEvent 落库字段: level='+S.eventLog[0].level+' cat='+S.eventLog[0].cat);

  // ⑥ 旧存档兼容：条目无 cat 字段时按文案回推，UI 不能崩、分类不能空
  const u=new Set();
  fillRoster(S,'mid');
  S.lineup=S.players.map(p=>p.id);
  S.preseason=false;
  S.eventLog=CASES.map(([,txt])=>({txt,t:Date.now(),level:logLevel(txt)})); // 故意不带 cat
  window._logFilter='honor';
  renderClub();
  const html=document.querySelector('#page-club').innerHTML;
  if(!html.includes('荣誉成就'))fail('事件动态面板未渲染分类按钮');
  if(!html.includes('夺得总冠军'))fail('旧存档无 cat 时，荣誉分类取不到夺冠日志（回推失效）');
  if(html.includes('该分类暂无事件')&&logCat(CASES[0][1])!=='honor')fail('荣誉分类意外为空');
  log('⑥ 旧存档兼容：无 cat 字段按文案回推，荣誉分类取到夺冠日志');

  // ⑦ 未知过滤值回落"全部"，不留白屏
  window._logFilter='不存在的分类';
  renderClub();
  const h2=document.querySelector('#page-club').innerHTML;
  if(!h2.includes('转会达成'))fail('未知过滤值未回落"全部"（列表被过滤空）');
  else log('⑦ 未知过滤值回落"全部"');
  window._logFilter='all';

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
