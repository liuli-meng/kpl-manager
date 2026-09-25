/* 转会市场页 UI（从 ui.js 拆出：只搬渲染，买卖引擎在 transfer/players） */
function renderMarket(){
 // 教练模式：不做买断/挂牌生意，但必须能应急租借 + 向俱乐部提引援建议
 if(S.mode==='coach'){renderCoachMarket();return;}
 const costOf=p=>Math.round(valueOf(overall(p))*(p.discount||1));
 // 转会期提示条：开局落在市场页，结束转会期按钮在俱乐部页——这里补回跳，避免找不到怎么开赛
 let windowBanner='';
 if(S.preseason&&(S.transferWindow||0)>0){
  const ph=(typeof transferPhaseLabel==='function')?transferPhaseLabel(S):'';
  const free=(typeof canFreeSign==='function')?canFreeSign(S):true;
  windowBanner=`<div class="panel" style="margin:0 0 10px;border-color:rgba(217,164,65,.45)">
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
  <div><b class="gold">赛前转会期${ph?' · '+ph:''}</b>　<span class="hint">剩余 ${S.transferWindow} 天${free?' · 可买断/直签':' · 挂牌期：只挂牌/竞价/续约/租借'} · 天数用完自动开赛</span></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
  <button class="btn sm" onclick="goPage('club')">去俱乐部页组队/开赛</button>
  <button class="btn sm gold" onclick="uiSkipTransfer(S)">跳过剩余 ${S.transferWindow} 天</button>
  <button class="btn sm gold" onclick="uiEndPreseason(S)">结束转会期 · 开始赛季</button>
  </div></div></div>`;
 }
 // 临时席位
 let tempHtml='';
 try{if(typeof tempSeatsPanelHtml==='function')tempHtml=tempSeatsPanelHtml();}catch(e){}
 // 选秀大会：转会期最上方（轮到你时优先点名）
 let draftHtml='';
 try{if(typeof draftPanelHtml==='function')draftHtml=draftPanelHtml();}catch(e){}
 // 教练区
 let coachHtml=`<div class="panel ${foldCls('mcoach')}" data-fold="mcoach"><h3>教练市场 <span class="tag">主教练决定全队战力</span></h3>`;
 if(S.coach){
 const c=S.coach;
 coachHtml+=`<div class="sponsor" style="border-color:var(--gold)">
 <span class="s-icon">教</span>
 <div><div class="s-name">${c.name} <span class="gold">(现任主教练)</span></div>
 <div class="s-desc">${c.rating||80}评分 · ${COACH_STYLE[c.style]||'—'}型 · ${(c.skill&&c.skill.n)||'—'}：${(c.skill&&c.skill.d)||'—'} · 年薪 ${c.wage||0}万</div></div>
 <button class="btn sm danger" onclick="fireCoach(S)">解雇</button>
 </div>`;
 }else{
 coachHtml+=`<div class="hint" style="margin-bottom:10px">暂无主教练！签约一名教练提升全队战力（无教练全队战力打折扣）</div>`;
 }
 // 助教席（上限2人，加成与主教练叠加；退役名宿可 6 折转任）
 const asCnt=(S.assistants||[]).length;
 coachHtml+=`<div style="margin:12px 0 6px;font-weight:800;font-size:12px">助教席 <span class="tag">${asCnt}/2 · 与主教练叠加</span></div>`;
 coachHtml+=asCnt?`<div class="g2">${S.assistants.map(a=>`
 <div class="sponsor"><span class="s-icon">助</span>
 <div><div class="s-name">${a.name}</div><div class="s-desc">${a.rating||75}评分 · ${COACH_STYLE[a.style]||'—'}型 · ${(a.skill&&a.skill.d)||'—'} · 年薪 ${a.wage||0}万</div></div>
 <button class="btn sm danger" onclick="fireAssistant(S,'${a.id}')">解约</button>
 </div>`).join('')}</div>`
 :`<div class="hint" style="margin-bottom:8px">未聘助教——每名助教提供小额全队加成，与主教练叠加（买替补工资帽之外的第二处长期开销）</div>`;
 coachHtml+=`<div class="g3">${ASSISTANT_POOL.filter(a=>!(S.assistants||[]).some(x=>x.id===a.id)).map(a=>{
 const oc=ovrColor(a.rating||75);
 return `<div class="pcard ${ovrCls(a.rating||75)}" style="text-align:center">
 <div style="margin:6px 0;color:var(--faint)"></div>
 <div class="p-name" style="font-weight:800">${a.name}</div>
 <div class="p-rarity" style="color:${oc}"><span class="pr-label">评分</span><b class="pr-num">${a.rating}</b><span class="pr-meta">${COACH_STYLE[a.style]||'—'}型</span></div>
 <div class="p-skill"> ${(a.skill&&a.skill.d)||'—'}</div>
 <div class="p-foot"><span class="pf"><i>签约费</i><b>${a.cost}万</b></span><span class="pf"><i>年薪</i><b>${a.wage}万</b></span></div>
 <button class="btn sm primary" onclick="hireAssistant(S,'${a.id}')" ${asCnt>=2?'disabled':''}>${asCnt>=2?'助教席已满':'聘为助教'}</button>
 </div>`;
 }).join('')}</div>`;
 if((S.coachMarket||[]).length){
 coachHtml+=`<div class="g3">${(S.coachMarket||[]).map(c=>{
 const oc=ovrColor(c.rating||80);
 return `<div class="pcard ${ovrCls(c.rating||80)}" style="text-align:center">
 <div style="margin:6px 0;color:var(--faint)"></div>
 <div class="p-name" style="font-weight:800">${c.name}</div>
 <div class="p-rarity" style="color:${oc}"><span class="pr-label">评分</span><b class="pr-num">${c.rating||80}</b><span class="pr-meta">${COACH_STYLE[c.style]||'—'}型</span></div>
 <div class="p-skill"> ${(c.skill&&c.skill.n)||'—'}<br><b style="font-size:10px">${(c.skill&&c.skill.d)||'—'}</b></div>
 <div class="attr" style="grid-template-columns:1fr;text-align:center;font-size:11px">
 <span>全队战力 <i style="color:var(--gold)">+${c.bonus||0}%</i></span>
 <span>${COACH_STYLE[c.style]||'—'}属性 <i style="color:var(--gold)">+${c.styleBonus||0}%</i></span>
 </div>
 <div class="p-foot"><span class="pf"><i>签约费</i><b>${c.cost}万</b></span><span class="pf"><i>年薪</i><b>${c.wage}万</b></span></div>
 <button class="btn sm primary" onclick="signCoach(S,S.coachMarket.find(x=>x.id==='${c.id}'))">${S.coach&&S.coach.id===c.id?'现任':'签约执教'}</button>
 </div>`;
 }).join('')}</div>`;
 }
 coachHtml+=`</div>`;
 // 转会期正式版：买断其他队选手 + 挂牌
 let transferHtml='';
 let sideHtml='';
 if(S.transferWindow>0){
 // 合同续约面板：到期选手必须处理（谈判/放走），最后一年可提前谈（防合同年自由身）
 const renewRow=(p,tag)=>`<div class="match" style="margin-bottom:6px;padding:8px 10px;${p.contract<=0?'border-color:rgba(217,164,65,.45)':''}">
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(${(POS[p.pos]||['?','?'])[0]} · 总值${overall(p)} · ${p.age||'?'}岁)</span></span>
 <div class="power" style="font-size:10px">${tag} · 年薪 ${p.wage}万 · 心理价位 ≈${renewAskWage(p,2)}万</div></div>
 <div style="display:flex;gap:4px">
 <button class="btn sm gold" style="margin:0" onclick="openRenewNego(S,'${p.id}')">续约谈判</button>
 ${p.contract<=0?`<button class="btn sm danger" style="margin:0" onclick="releasePlayer(S,'${p.id}')">不续约</button>`:''}
 </div></div>`;
 const expRows=(S.expiring||[]).map(pid=>{
 const p=S.players.find(x=>x.id===pid);
 if(!p||p.loan)return '';
 return renewRow(p,'合同到期');
 }).join('');
 const earlyRows=(S.players||[]).filter(p=>!p.loan&&(p.contract===1)&&!(S.expiring||[]).includes(p.id)).map(p=>renewRow(p,'最后一年')).join('');
 const renewPanel=(expRows||earlyRows)?`<div class="panel ${foldCls('mrenew')}" data-fold="mrenew"><h3>合同续约 <span class="tag">年限 1-4 年可谈 · 报价定年薪</span></h3>
 <div class="hint" style="margin-bottom:8px">续约 = 谈判：选年限 + 出年薪报价，经纪人按心理价位博弈（长约溢价 / 老将抬价 / 三轮谈崩伤士气），签字费按年限递增。到期不处理将自动续约 1 年；「最后一年」可提前谈，拖到合同年有自由身离队风险。</div>
 ${expRows}${earlyRows}</div>`:'';
 const allBuy=applySortPref('buy',S.transferList);
 const rows=truncSlice('mtransfer',allBuy).map(p=>{
 const price=buyoutPrice(p);
 const unt=p.untouchable?(p.willingness>=75?`<span style="color:var(--red);font-weight:800">非卖 · 忠诚${p.willingness}</span>`:`<span style="color:var(--gold);font-weight:800">松动 · 意愿${p.willingness}</span>`):'';
 const wil=p.willingness>=60?'<span class="green">愿转会</span>':p.willingness>=30?'<span class="gold">犹豫中</span>':'<span class="red">拒绝加盟</span>';
 const btnHtml=p.untouchable
 ?`<button class="btn sm ${p.willingness<75?'gold':'primary'}" style="margin:0;min-width:64px" onclick="openNegotiation(S,'${p.id}')">强挖 ${Math.round(raidChance(p)*100)}%</button>`
 :`<button class="btn sm primary" style="margin:0;min-width:64px" onclick="openNegotiation(S,'${p.id}')" ${p.willingness<30?'disabled':''}>${p.willingness<30?'尝试谈判':'谈判'}</button>`;
 return `<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><div class="tname" style="font-size:13px"><b>${p.name}</b>
 <div style="color:var(--dim);font-size:11px;font-weight:500;line-height:1.35">${POS[p.pos][0]} · ${p.ownerTeam} · 总值${overall(p)}${p.age?' · '+p.age+'岁':''}</div></div>
 <div class="power" style="font-size:10px">${wil}${unt}</div></div>
 <div class="score" style="font-size:13px;min-width:0">${p.untouchable?untouchablePrice(p)+'万':price+'万'}</div>
 ${btnHtml}
 </div>`;
 }).join('');
 const listed=(S.listed||[]).map(item=>{
 const p=S.players.find(x=>x.id===item.id);
 if(!p)return '';
 const bid=(S.bids||[]).find(b=>b.id===item.id);
 return `<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><div class="tname" style="font-size:13px;white-space:normal;word-break:break-word"><b>${p.name}</b>
 <div style="color:var(--dim);font-size:11px;font-weight:500">总值${overall(p)} · 挂牌${item.price}万</div></div></div>
 ${bid?`<div class="score" style="font-size:12px;min-width:0"> ${bid.team}<br>${bid.bid}万</div>
 <div style="display:flex;gap:4px"><button class="btn sm primary" style="margin:0" onclick="acceptBid(S,'${item.id}')">接受</button><button class="btn sm" style="margin:0" onclick="rejectBid(S,'${item.id}')">拒绝</button><button class="btn sm danger" style="margin:0" onclick="delistPlayer(S,'${item.id}')">撤牌</button></div>`
 :`<button class="btn sm danger" style="margin:0" onclick="delistPlayer(S,'${item.id}')">撤牌</button>`}
 </div>`;
 }).join('');
 transferHtml=renewPanel+`<div class="panel ${foldCls('mtransfer')}" data-fold="mtransfer"><h3>转会市场 <span class="tag">转会窗剩余 ${S.transferWindow} 天 · 31岁+退役</span></h3>
 <div class="hint" style="margin-bottom:8px">多轮谈判：报价需同时打动俱乐部（转会费）和选手（年薪）；非卖品溢价强挖有失败风险；生涯暮年选手（29岁+）买来即巅峰末期</div>
 ${sortChips('buy')}
 <div style="max-height:340px;overflow-y:auto">${rows||'<div class="hint">转会市场暂无选手</div>'}${truncMoreHtml('mtransfer',allBuy.length)}</div>
 <div class="hint" style="margin:10px 0 6px">我的挂牌（AI 队会来报价，转会窗关闭未成交自动撤牌）：</div>
 <div>${listed||'<div class="hint">暂无挂牌选手——在下方"我的队员"中点"挂牌"</div>'}</div>
 </div>`;
 }else{
 transferHtml=`<div class="panel ${foldCls('mtransfer')}" data-fold="mtransfer"><h3>转会市场 <span class="tag">转会窗已关闭</span></h3>
 <div class="hint">KPL 转会窗在新赛季开启时开放 7 天：可买断其他俱乐部选手（非卖品除外）、挂牌交易、AI 竞价报价。全年可在下方租借市场临时租人（含转会期应急补位）。</div></div>`;
 }
 // 租借市场（全年可开）：向 AI 队租替补，21 天自动归队；伤停缺人时名额+1并优先推缺位
 {
  const myLoans=(S.players||[]).filter(p=>p.loan);
  const cap=loanCap(S);
  const gaps=injuryGapPositions(S);
  const cands=loanCandidates(S).slice(0,12);
  transferHtml+=`<div class="panel ${foldCls('mloan')}" data-fold="mloan"><h3>租借市场 <span class="tag">租期 ${LOAN_DAYS} 天 · 名额 ${myLoans.length}/${cap}${cap>LOAN_CAP_BASE?' · 伤停应急':''} · 到期自动归队</span></h3>
  <div class="hint" style="margin-bottom:8px">全年可租（含转会期）：支付租金（身价 15%）即可租来应急/补位置，工资由原队承担；非卖品不外借，租借选手不能出售/挂牌。${gaps.length?'<b class="red">当前 '+gaps.map(p=>POS[p][0]).join('、')+' 无人可打——已开放应急名额，下列缺位选手优先。</b>':'某位置因伤停/K甲无人时，名额上限 +1 并优先推荐该位置。'}</div>
  ${myLoans.length?`<div style="margin-bottom:8px">${myLoans.map(p=>`<div class="match" style="margin-bottom:5px;padding:7px 10px">
  <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(${POS[p.pos][0]} · 总值${overall(p)} · 来自${p.loan.from})</span></span></div>
  <div class="score" style="font-size:12px;min-width:0">剩余 <b class="gold">${p.loan.days}</b> 天</div>
  </div>`).join('')}</div>`:''}
  <div style="max-height:300px;overflow-y:auto">${cands.map(c=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
  <div class="vs"><span class="tname" style="font-size:13px">${c.p.name} <span style="color:var(--dim);font-size:10px">(${c.from} · ${POS[c.p.pos][0]} · 总值${overall(c.p)} · ${c.p.age}岁)${gaps.includes(c.p.pos)?' <b class="red">缺位优先</b>':''}</span></span></div>
  <div class="score" style="font-size:13px;min-width:0">租金 ${c.rent}万</div>
  <button class="btn sm primary" style="margin:0;min-width:64px" onclick="loanPlayer(S,'${c.from}','${c.p.id}')">租借 ${LOAN_DAYS}天</button>
  </div>`).join('')||'<div class="hint">联盟暂无可租借的选手</div>'}</div>
  </div>`;
 }
 // 自由球员与退役名宿：始终可见（不依赖转会窗）→ 侧栏
 sideHtml+=`<div class="panel ${foldCls('mfa')}" data-fold="mfa"><h3>自由球员 <span class="tag">各队无球可打的替补 · 低价直签</span></h3>
 <div class="hint" style="margin-bottom:8px">26 年自由市场：合同到期的 KPL 选手轮换上架（签一人少一人），谈薪资直签；不足时由无球可打的替补补位</div>
 ${sortChips('fa')}
 ${applySortPref('fa',S.freeAgents).map(p=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(总值${overall(p)} · ${POS[p.pos][1]}${p.age?' · '+p.age+'岁':''})</span></span></div>
 <div class="score" style="font-size:13px;min-width:0">${p.signCost}万</div>
 <button class="btn sm primary" style="margin:0" onclick="openNegotiation(S,'${p.id}')">谈薪资直签</button>
 </div>`).join('')||'<div class="hint">暂无自由球员</div>'}
 </div>
 <div class="panel ${foldCls('mretired')}" data-fold="mretired"><h3>退役名宿 <span class="tag">老将退役后 · 教练 / 主播</span></h3>
 <div class="hint" style="margin-bottom:8px">30+ 选手退役后转型：教练（战力加成）或主播（每日人气收入）</div>
 ${(S.retiredCoaches||[]).map(r=>r.type==='coach'
 ?`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${r.name} <span style="color:var(--dim);font-size:10px">(主教练 · +${r.bonus}%)</span></span></div>
 <div class="score" style="font-size:12px;min-width:0">${r.cost}万</div>
 <div style="display:flex;gap:4px;flex-wrap:wrap">
 <button class="btn sm gold" style="margin:0" onclick="signRetired(S,'${r.id}')">聘为教练</button>
 <button class="btn sm primary" style="margin:0" onclick="hireAssistant(S,'${r.id}')" ${(S.assistants||[]).length>=2?'disabled':''}>聘为助教（6折）</button>
 </div></div>`
 :`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${r.name} <span style="color:var(--dim);font-size:10px">(主播 · 日收入${r.income}万)</span></span></div>
 <div class="score" style="font-size:12px;min-width:0">${r.cost}万</div>
 <button class="btn sm gold" style="margin:0" onclick="signRetired(S,'${r.id}')">签约主播</button></div>`).join('')||'<div class="hint">暂无退役名宿</div>'}
 ${(S.hosts||[]).length?`<div class="hint" style="margin-top:8px">已签约主播：${S.hosts.map(h=>h.name+'（日'+h.income+'万）').join('、')}</div>`:''}
 </div>`;
 const marketPanel=`<div class="panel ${foldCls('mmarket')}" data-fold="mmarket"><h3>自由市场 <span class="tag">${marketRefreshFree(S)?'转会窗开启·今日首刷免费·顶星增加':(S.transferWindow>0?'转会窗开启·今日已刷·再刷 '+MARKET_REFRESH_COST+'万':'刷新需 '+MARKET_REFRESH_COST+'万/次')} · 每日特惠</span></h3>
 <div class="hint" style="margin-bottom:10px">签约费按总值实时定价：总值 90+ ≈ 260万 / 80 ≈ 140万 / 70 ≈ 70万，特惠选手 8 折。${S.transferWindow>0?(S.marketRefreshed?'转会窗内<b>每日首刷</b>免费，今日额度已用过——再刷 '+MARKET_REFRESH_COST+' 万/次（次日自动重置）':'转会窗内今日首刷免费，之后 '+MARKET_REFRESH_COST+' 万/次'):'非转会期刷新 '+MARKET_REFRESH_COST+' 万/次'}</div>
 ${sortChips('sign')}
 <div class="g2">${applySortPref('sign',S.market).map(p=>{
 const c=costOf(p);
 return pcard(p,`<button class="btn sm primary" onclick="buyPlayer(S,(function(){var m=S.market.find(x=>x.id==='${p.id}');if(!m){renderAll();toast('选手已被签走');return null;}return m;})())">签约 ${p.discount?`<s>${valueOf(overall(p))}万</s> ${c}万`:c+'万'}</button>`);
 }).join('')||'<div class="hint">市场空空如也，刷新一下吧</div>'}</div>
 <button class="btn mt12" onclick="refreshMarket(S)"> 刷新市场${marketRefreshFree(S)?'（今日免费）':'（'+MARKET_REFRESH_COST+'万）'}</button>
 </div>`;
 const minePanel=`<div class="panel ${foldCls('mine')}" data-fold="mine"><h3>我的队员</h3>
 ${S.players.length?`${sortChips('mine')}<div class="grid g4">${applySortPref('mine',S.players.filter(p=>!S.lineup.includes(p.id))).map(p=>{const listed=(S.listed||[]).some(x=>x.id===p.id);
 return pcard(p,`<button class="btn sm primary" onclick="swapPlayer('${p.id}')">↑ 放入首发</button><div style="display:flex;gap:6px;margin-top:8px">${listed
 ?`<button class="btn sm danger" style="flex:1" onclick="delistPlayer(S,'${p.id}')">撤牌</button>`
 :`<button class="btn sm danger" style="flex:1" onclick="openSellNego(S,'${p.id}')"> 出售</button><button class="btn sm" style="flex:1" onclick="listPlayer(S,'${p.id}')"> 挂牌</button>`}</div>`);}).join('')||'<div class="hint">全部队员都在首发阵容中</div>'}</div>`:'<div class="hint">还没有队员</div>'}
 </div>`;
 $('#page-market').innerHTML=windowBanner+pageHint('market')+tempHtml+draftHtml+'<div class="page-cols"><div class="col">'+coachHtml+transferHtml+minePanel+'</div><div class="col">'+sideHtml+marketPanel+'</div></div>';
}
/* 教练模式转会页：应急租借 + 引援建议（申请由俱乐部执行，教练不能挂牌/卖人） */
function renderCoachMarket(){
 const adv=coachAdvice(S);
 const gaps=adv.gaps||[];
 const recs=S.coachRecs||[];
 const myLoans=(S.players||[]).filter(p=>p.loan);
 const cap=typeof loanCap==='function'?loanCap(S):2;
 const injured=(S.players||[]).filter(p=>{
  const st=playerStatus(p,S);
  return st.injury||st.kjia||st.loanOut||st.natCamp;
 });
 let html=pageHint('market');
 html+=`<div class="panel" style="border-color:rgba(92,138,245,.45)">
 <h3>教练工作台 · 应急与引援 <span class="tag">买断挂牌由俱乐部打理</span></h3>
 <div class="hint" style="margin-bottom:8px">伤停/集训缺人时可<b>紧急租借</b>；也可向俱乐部提交<b>引援申请</b>（资金与名单允许时自动办理）。不能挂牌出售选手——那是管理层的事。</div>
 ${gaps.length?`<div class="hint" style="color:var(--red);margin-bottom:8px">⚠ ${gaps.map(p=>POS[p][0]).join('、')} 位置当前无人可打——建议立刻租借补位</div>`:''}
 ${injured.length?`<div class="hint" style="margin-bottom:8px">非健康名单：${injured.map(p=>{const st=playerStatus(p,S);return p.name+'（'+(st.injury?st.injuryDays+'天伤停':st.kjia?'K甲':st.loanOut?'外租':'集训')+'）';}).join(' · ')}</div>`:''}
 ${recs.length?`<div class="hint" style="margin-bottom:8px"><b>待处理申请：</b>${recs.map(r=>(r.type==='loan'?'租借 ':(r.type==='sign'?'直签 ':'补位 '))+(r.name||(r.pos?POS[r.pos][0]:'—'))).join(' · ')}</div>`:''}
 </div>`;
 // 应急租借
 html+=`<div class="panel"><h3>应急租借市场 <span class="tag">${LOAN_DAYS} 天 · 名额 ${myLoans.length}/${cap}${cap>LOAN_CAP_BASE?' · 伤停应急':''}</span></h3>
 <div class="hint" style="margin-bottom:8px">租金约身价 15%，工资由原队承担；非卖品不外借。缺位位置优先推荐。</div>
 ${myLoans.length?`<div style="margin-bottom:8px">${myLoans.map(p=>`<div class="match" style="margin-bottom:5px;padding:7px 10px"><div class="vs"><span class="tname">${p.name} <span class="dim" style="font-size:10px">(${POS[p.pos][0]} · ${p.loan.from} · 剩 ${p.loan.days} 天)</span></span></div></div>`).join('')}</div>`:''}
 <div style="max-height:280px;overflow-y:auto">${(adv.loans||[]).map(c=>`
  <div class="match" style="margin-bottom:6px;padding:8px 10px">
  <div class="vs"><span class="tname" style="font-size:13px">${c.name} <span class="dim" style="font-size:10px">(${c.from} · ${POS[c.pos][0]} · 总值${c.ovr}${c.gap?' · <b class="red">缺位优先</b>':''})</span></span></div>
  <div class="score" style="font-size:13px">租金 ${c.rent}万</div>
  <div style="display:flex;gap:4px">
   <button class="btn sm primary" onclick="loanPlayer(S,'${c.from}','${c.id}')">立即租借</button>
   <button class="btn sm" onclick="coachRequest(S,'loan','${c.id}')">申请租借</button>
  </div>
  </div>`).join('')||'<div class="hint">联盟暂无可租借选手</div>'}</div>
 </div>`;
 // 引援建议
 html+=`<div class="panel"><h3>教练引援建议 <span class="tag">向俱乐部提交 · 自动办理</span></h3>
 <div class="hint" style="margin-bottom:8px">按缺位与最弱位置推荐。申请后俱乐部会尽快签约；资金不足会排队。</div>
 ${adv.weak&&adv.weak.length?`<div class="hint" style="margin-bottom:8px"><b>阵容短板：</b>${adv.weak.map(w=>POS[w.pos][0]+'（'+(w.cnt?w.cnt+'人·顶值'+w.best:'无人')+'）').join(' · ')}
 ${adv.weak.filter(w=>w.cnt===0).map(w=>`<button class="btn sm" style="margin-left:6px" onclick="coachRequest(S,'gap',null,'${w.pos}')">申请补 ${POS[w.pos][0]}</button>`).join('')}</div>`:''}
 <div class="g2">${(adv.signs||[]).map(p=>`
  <div class="match" style="margin-bottom:6px;padding:8px 10px">
  <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span class="dim" style="font-size:10px">(自由市场 · ${POS[p.pos][0]} · 总值${p.ovr}${p.gap?' · <b class="red">缺位</b>':''})</span></span></div>
  <div class="score" style="font-size:13px">${p.cost}万</div>
  <button class="btn sm gold" onclick="coachRequest(S,'sign','${p.id}')">申请直签</button>
  </div>`).join('')||'<div class="hint">自由市场暂无推荐</div>'}</div>
 </div>`;
 html+=`<div class="panel"><h3>我的队员（伤病/名单）</h3>
 <div class="grid g4">${(S.players||[]).map(p=>pcard(p,'')).join('')||'<div class="hint">暂无队员</div>'}</div>
 </div>`;
 $('#page-market').innerHTML=html;
}
