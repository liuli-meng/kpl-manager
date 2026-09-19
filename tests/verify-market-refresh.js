// 转会市场刷新的「每日首刷免费」口径回归
// 历史 bug：① 开局建队时内部播种调用 refreshMarket 把当日免费额度吃掉了（玩家第一次手动刷就扣 5 万，
//   而按钮还写着「转会期内免费」）；② 文案（面板 tag / 按钮 / 转会期日志）无条件承诺窗内免费，
//   引擎却只在 !marketRefreshed 时免。现在判定收敛到 marketRefreshFree() 一处。
// 运行：node tests/verify-market-refresh.js
const fs = require('fs');
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  const boot=()=>{
    S=newState('刷新队','x');fillRoster(S,'mid');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=400;initGroups(S);
    S.preseason=true;S.transferWindow=7;S.day=1;S.fund=1300;
    buildTransferMarket(S);
    return S;
  };

  // ① 开局播种：只上货架，不吃玩家的当日免费额度、不扣钱
  boot();
  refreshMarket(S,{seed:true});
  if(S.market.length!==6)fail('① 播种没上货架，market='+S.market.length);
  else if(S.marketRefreshed)fail('① 播种把「今日已刷新」置成了 true（玩家首刷就没免费了）');
  else if(S.fund!==1300)fail('① 播种扣了钱: '+S.fund);
  else ok('① 开局播种：货架 6 人 · 不扣费 · 免费额度仍在');

  // ② 玩家窗内首刷免费
  const before=S.market.map(p=>p.id).join(',');
  refreshMarket(S);
  if(S.fund!==1300)fail('② 窗内首刷仍扣费: '+S.fund);
  else if(!S.marketRefreshed)fail('② 首刷后未置 marketRefreshed');
  else if(S.market.map(p=>p.id).join(',')===before)fail('② 首刷货架没变（刷新没生效）');
  else ok('② 窗内首刷：免费且货架已换（'+S.market.length+' 人）');

  // ③ 窗内第二次开始按 5 万/次收费
  refreshMarket(S);
  if(S.fund!==1300-MARKET_REFRESH_COST)fail('③ 第二次应扣 '+MARKET_REFRESH_COST+' 万，实扣 '+(1300-S.fund));
  else ok('③ 窗内第二次：扣 '+MARKET_REFRESH_COST+' 万（资金 '+S.fund+'）');

  // ④ 过一天自动重置免费额度
  nextDay(S);
  if(S.marketRefreshed)fail('④ nextDay 后 marketRefreshed 未重置');
  else{
    const f=S.fund;refreshMarket(S);
    if(S.fund!==f)fail('④ 次日首刷仍扣费: '+f+'→'+S.fund);
    else ok('④ 次日首刷再次免费');
  }

  // ⑤ 非转会期一律收费；钱不够则不刷也不置位
  boot();S.transferWindow=0;S.marketRefreshed=false;
  refreshMarket(S);
  if(S.fund!==1300-MARKET_REFRESH_COST)fail('⑤ 期外刷新应收费，实扣 '+(1300-S.fund));
  else ok('⑤ 非转会期：刷新按 '+MARKET_REFRESH_COST+' 万收费');
  S.fund=3;const ids=S.market.map(p=>p.id).join(',');
  refreshMarket(S);
  if(S.fund!==3)fail('⑤ 资金不足却仍扣费: '+S.fund);
  else if(S.market.map(p=>p.id).join(',')!==ids)fail('⑤ 资金不足却刷新了货架');
  else ok('⑤ 资金不足：拒绝刷新、不扣费、货架不动');

  // ⑥ 文案与引擎同口径：UI 里凡"免费"都必须走 marketRefreshFree()，不许再有无条件承诺
  renderAll=_ra;save=_sv;
  return res.join('\\n');
})()
`, dom);

console.log(out);

// 静态口径守卫：转会页/转会期日志里不许再出现"窗内一律免费"这类无条件承诺
const src = {
  'src/js/ui-market.js': fs.readFileSync('src/js/ui-market.js', 'utf8'),
  'src/js/main.js': fs.readFileSync('src/js/main.js', 'utf8'),
  'src/js/season.js': fs.readFileSync('src/js/season.js', 'utf8'),
  'src/js/ui.js': fs.readFileSync('src/js/ui.js', 'utf8'),
};
const bad = [];
for (const [f, s] of Object.entries(src)) {
  s.split(/\r?\n/).forEach((ln, i) => {
    if (/刷新[^]*?免费|免费[^]*?刷新/.test(ln) && !/每日首刷|今日首刷|今日免费/.test(ln)) bad.push(f + ':' + (i + 1) + ' ' + ln.trim().slice(0, 90));
  });
}
if (src['src/js/ui-market.js'].split('\n').filter(l => l.includes('refreshMarket(S)') && l.includes('btn')).length &&
    !/marketRefreshFree\(S\)\?'（今日免费）/.test(src['src/js/ui-market.js'])) bad.push('ui-market.js 按钮文案没读 marketRefreshFree()');
console.log(bad.length ? '[FAIL] 文案口径回潮:\n  ' + bad.join('\n  ') : '[PASS] ⑥ 文案全部走「每日首刷免费」口径');
if (bad.length) process.exitCode = 1;
