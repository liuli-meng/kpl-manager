/* 新手引导 + 每页提示（纯 UI 层：进度存 localStorage，不进存档、不进迁移链）。
 每页首行「这是什么」由各渲染函数拼 pageHint()；分步引导走 app-modal（移动端天然底栏化），
 首进自动弹一次，之后从「存档管理 → 重玩新手引导」随时重放。 */
const TOUR_KEY='km_tour',HINT_KEY='km_hints';
const PAGE_HINTS={
 club:'推进日期打比赛：赛程/赛况/复盘都在这。转会期结束前先凑齐首发',
 lineup:'选手卡管一切：训练、身价、续约、挂牌出售、替补轮换',
 market:'买人卖人：赛前转会期自由组队，赛季中留意报价与自由市场',
 train:'变强在本页：专项训练/青训营/位置改造，花钱要精打细算',
 league:'联盟战局：积分榜、赛程比分、数据榜——看看对手有多强',
 kjia:'K甲二队：替补和青训生的练级场，表现好可提拔上一队',
 union:'联盟总览：18 队战力榜与历代联盟史册',
 hall:'荣誉馆：冠军墙/王朝纪录/FMVP/最佳阵容，夺冠后可生成战绩分享图',
 biz:'钱袋子：粉丝/赞助/代言/门票——收入全靠经营，别只顾战绩',
 career:'你的故事：训练/比赛数据/生涯目标，选手模式每天来这打卡'
};
const TOUR_TITLES={
 club:'俱乐部 · 比赛主场',lineup:'阵容 · 管理选手',market:'转会 · 买卖选手',
 train:'训练 · 变强',league:'联赛 · 联盟战局',kjia:'二队 · K甲练级',
 union:'联盟 · 战力榜',hall:'荣誉馆 · 收藏馆',biz:'经营 · 钱袋子',career:'生涯 · 你的故事'
};
var _tour={on:false,i:0};
/* 每页一行提示；× 单页关闭（km_hints 按页记忆） */
function pageHint(name){
 let hide=null;
 try{hide=JSON.parse(localStorage.getItem(HINT_KEY)||'{}');}catch(_){}
 if(hide&&hide[name])return '';
 const txt=PAGE_HINTS[name];if(!txt)return '';
 return `<div class="page-hint"><span>${txt}</span><button class="ph-x" onclick="dismissHint('${name}')" title="不再显示这条">×</button></div>`;
}
function dismissHint(name){
 try{
 const hide=JSON.parse(localStorage.getItem(HINT_KEY)||'{}');
 hide[name]=1;localStorage.setItem(HINT_KEY,JSON.stringify(hide));
 }catch(_){}
 const cur=document.querySelector('nav button.on');
 renderPage(cur&&cur.dataset&&cur.dataset.page?cur.dataset.page:'club');
}
/* 分步引导：按当前身份遍历可见页（MODE_PAGES），首尾各一页说明 */
function tourSteps(){
 const mode=(S&&S.mode)||'manager';
 const pages=MODE_PAGES[mode]||MODE_PAGES.manager;
 const modeName=mode==='player'?'选手生涯':mode==='coach'?'教练生涯':'经理模式';
 const steps=[{page:null,title:'欢迎来到 王者电竞经理·KPL 篇',text:'你是'+modeName+'。下面带你把各页面走一遍，看懂就能上手；想随时重看：存档管理 → 重玩新手引导。'}];
 pages.forEach(p=>steps.push({page:p,title:TOUR_TITLES[p]||p,text:PAGE_HINTS[p]||''}));
 steps.push({page:null,title:'存档与目标',text:'进度自动保存在本机浏览器，「管理」里可 3 槽切换、导出备份、导入换机。目标只有一个：捧起银龙杯。上阵！'});
 return steps;
}
function maybeStartTour(){
 if(_tour.on||!S)return;
 try{if(localStorage.getItem(TOUR_KEY))return;}catch(_){}
 startTour();
}
function startTour(){
 _tour={on:true,i:0};
 renderTour();
}
function renderTour(){
 const steps=tourSteps();
 const st=steps[_tour.i]||steps[0];
 if(st.page)goPage(st.page); // goPage 会再进 maybeStartTour：_tour.on 守卫挡住，不递归
 const n=steps.length;
 $('#app-modal-body').innerHTML=`<h2>${_escTxt(st.title)}</h2>
 <div class="hint" style="margin-bottom:10px">${st.text}</div>
 <div style="display:flex;gap:4px;margin-bottom:14px">${steps.map((_,i)=>`<span style="flex:1;height:3px;border-radius:2px;background:${i<=_tour.i?'var(--gold)':'var(--line)'}"></span>`).join('')}</div>
 <div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 ${_tour.i>0?'<button class="btn sm" onclick="tourPrev()">上一步</button>':''}
 <button class="btn sm" onclick="tourSkip()">跳过</button>
 ${_tour.i<n-1?'<button class="btn sm primary" onclick="tourNext()">下一步</button>':'<button class="btn sm gold" onclick="tourFinish()">开始征程</button>'}
 </div>`;
 $('#app-modal').classList.add('on');
}
function tourNext(){const n=tourSteps().length;if(_tour.i<n-1){_tour.i++;renderTour();}else tourFinish();}
function tourPrev(){if(_tour.i>0){_tour.i--;renderTour();}}
function _tourEnd(msg){
 _tour={on:false,i:0};
 try{localStorage.setItem(TOUR_KEY,'1');}catch(_){}
 closeModal('app-modal');
 toast(msg);
}
function tourSkip(){_tourEnd('已跳过引导——「管理 → 重玩新手引导」随时再看');}
function tourFinish(){_tourEnd('上阵！目标：总冠军');}
