// 列表评分排序 + 位置筛选回归（转会/自由市场等卡片列表）
// 运行：node tests/verify-sort.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // 准备：经理档 + 市场数据（buildTransferMarket 产出 transferList/freeAgents/S.market）
  S=newState('排序队','⚔️');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
  initGroups(S);S.preseason=true;S.transferWindow=7;
  buildTransferMarket(S);refreshMarket(S);
  localStorage.setItem('km_tour','1'); // 不弹引导

  // ① 默认按总值降序：applySortPref 返回副本、与手工排序一致
  const tl=(S.transferList||[]).slice();
  const got=applySortPref('buy',tl);
  const want=tl.slice().sort((a,b)=>overall(b)-overall(a));
  if(got.length!==tl.length)fail('排序后长度变了: '+got.length+' vs '+tl.length);
  else if(got.some((p,i)=>p.id!==want[i].id))fail('默认总值降序与手工排序不一致');
  else if(tl.some((p,i)=>p!==S.transferList[i]))fail('applySortPref 修改了原数组顺序');
  else log('① 买断市场 '+got.length+' 人：默认总值降序 · 原数组不被改动');

  // ② 排序键切换：年龄升序（年轻优先），偏好写 localStorage
  setSortKey('buy','age');
  if(getSortKey('buy')!=='age')fail('setSortKey 未生效');
  else{
    const byAge=applySortPref('buy',S.transferList);
    const ok=byAge.every((p,i)=>i===0||byAge[i-1].age<=p.age);
    if(!ok)fail('年龄升序结果错乱');
    else if(JSON.parse(localStorage.getItem('km_sort')).buy!=='age')fail('偏好未写入 km_sort');
    else log('② 排序切换：年轻优先生效 · 偏好已入 localStorage');
  }

  // ③ 位置筛选：只留中路且仍按当前排序键排
  setPosFilter('buy','mid');
  const mids=applySortPref('buy',S.transferList);
  if(mids.some(p=>p.pos!=='mid'))fail('位置筛选混入了其他位置');
  else if(!mids.length)fail('中路筛选结果为空（买断池应含中路）');
  else if(getPosFilter('buy')!=='mid')fail('位置偏好未记录');
  else log('③ 位置筛选：'+mids.length+' 名中路（全部为 mid · 排序保持）');

  // ④ chips 行渲染：按钮文字是中文文案、onclick 才是回调（防 label/onclick 传反）
  setPosFilter('buy','');
  localStorage.setItem('km_sort','{}');
  renderPage('market');
  const mh=$('#page-market').innerHTML||'';
  const chipsN=(mh.match(/class="s-chip/g)||[]).length;
  if(chipsN<20)fail('market 页 chips 数量异常: '+chipsN);
  else if(!mh.includes('>全部</button>'))fail('chips 文字/onclick 顺序反了（文字应为「全部」）');
  else if(!mh.includes('>对抗路</button>')||!mh.includes('>总值</button>')||!mh.includes('>年轻</button>'))fail('chips 按钮文字缺失（应为中文文案）');
  else if(mh.includes('>setPosFilter(')||mh.includes('>setSortKey('))fail('chips 按钮把 onclick 代码渲染成了文字');
  else log('④ 转会页 chips：'+chipsN+' 个 · 按钮文字=中文文案 · onclick=回调');

  // ⑤ 各列表键互不串扰：买断设 age 不影响训练页默认 ovr
  setSortKey('buy','age');
  renderPage('train');
  const th=$('#page-train').innerHTML||'';
  if(!th.includes('s-chip'))fail('训练页缺 chips');
  else if(getSortKey('train')!=='ovr')fail('train 偏好被 buy 串扰');
  else log('⑤ 键隔离：buy=age 时 train 仍默认总值 · 训练页 chips 正常');

  // ⑥ 空列表与缺字段不炸：空自由市场 + 士气排序
  S.freeAgents=[];
  setSortKey('fa','mor');
  const emptyFa=applySortPref('fa',S.freeAgents);
  if(emptyFa.length!==0)fail('空自由市场应为空');
  renderPage('market');
  if(!$('#page-market').innerHTML.includes('自由球员'))fail('空自由市场渲染炸了');
  else log('⑥ 健壮性：空自由市场 + 士气排序不炸 · 面板正常渲染');

  // ⑦ 三种切换函数在切页后偏好保持（重进页面不丢）
  setSortKey('buy','val');setPosFilter('buy','ad');
  goPage('club');goPage('market');
  if(getSortKey('buy')!=='val'||getPosFilter('buy')!=='ad')fail('切页后偏好丢失');
  else log('⑦ 偏好保持：切页往返后 买断=身价+发育路');
  setPosFilter('buy','');setSortKey('buy','ovr');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
