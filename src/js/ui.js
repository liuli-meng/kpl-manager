
/* ============ PART3 ============ */

/* ================= 卡牌渲染 ================= */
function lvTag(lv){return `<span style="color:${HERO_LV[lv].b>0?'var(--gold)':lv<0?'var(--red)':'var(--dim)'};font-size:10px">${HERO_LV[lv].n}</span>`;}
function pcard(p,extra){
 const o=overall(p),oc=ovrColor(o); // 总值实时计算，训练/年龄/表现即时反映
 const hpCls=p.injury>0?`<div class="p-hp">伤停 ${p.injury}天</div>`:(p.morale<40?'<div class="p-hp">状态差</div>':'');
 const tags=(p.tags||[]).map(t=>`<span class="p-tag">${t}</span>`).join('');
 const campTag=(typeof natCamping==='function'&&natCamping(S,p))?`<span class="p-tag" style="border-color:var(--gold);color:var(--gold)">国家队·集训</span>`:'';
 const teamHtml=p.team?` · <span style="color:var(--dim)">${p.team}</span>`:'';
 const potHtml=p.potential?` · 潜力${'★'.repeat(p.potential)}`:'';
 // 英雄池压缩为计数摘要，避免长列表刷屏
 const poolCnt=(p.heroPool||[]).reduce((m,h)=>{m[h.lv]=(m[h.lv]||0)+1;return m;},{});
 const poolHtml=`<span style="color:var(--faint)"> · 池 ${['绝活','熟练','一般'].map((n,i)=>poolCnt[3-i]?`${n}${poolCnt[3-i]}`:'').filter(Boolean).join('/')}</span>`;
 const picked=pickedHero(S,p); // 当前选用英雄（缓存，避免重复计算）
 const pow=playerPower(p,picked);
 const heroHtml=`<div class="p-hero">出战 <b>${picked||'未定'}</b>${poolHtml}</div>`;
 // 年龄阶段标签（黄金期/下滑期/即将退役）
 const stageHtml=(p.age&&p.pos)?`<div class="p-hero" style="color:${p.age>(AGE_MODEL[p.pos]||AGE_MODEL.mid).gold?'var(--red)':'var(--green)'}">${ageStage(p)} · ${p.age}岁</div>`:'';
 // 合同状态（租借选手无合同）
 const contractHtml=(p.contract==null||p.loan)?'':`<div class="p-hero" style="color:${p.contract>0?'var(--dim)':'var(--red)'}">${p.contract>0?('合同'+p.contract+'年'):'合同到期 · 转会期续约'}</div>`;
 // 出场统计 + 更衣室/K甲状态（apps 由 finishSeries 累计；transferRequest 由更衣室年检标记）
 // K甲表现：下放期间的出场与场均 KDA（kjiaStats 由二队每场结算累计）
 const kjStat=(p.kjiaStats&&p.kjiaStats.apps)?` · K甲${p.kjiaStats.apps}场 场均${Math.round(p.kjiaStats.k/p.kjiaStats.apps*10)/10}/${Math.round(p.kjiaStats.d/p.kjiaStats.apps*10)/10}/${Math.round(p.kjiaStats.a/p.kjiaStats.apps*10)/10}`:'';
 const appsHtml=(p.apps||p.transferRequest||p.kjia>0)?`<div class="p-hero" style="color:var(--dim)">出场 ${p.apps||0} 次${p.transferRequest?' <span style="color:var(--red)">· 已要求离队</span>':''}${p.kjia>0?` <span style="color:var(--cyan)">· K甲锻炼剩 ${p.kjia} 天${kjStat}</span>`:''}</div>`:'';
 const capTag=S.captain===p.id?`<span class="p-tag" style="border-color:var(--gold);color:var(--gold)">队长</span>`:'';
 const endorseHtml=(p.popularity||0)>0?`<div class="p-hero" style="color:var(--gold)">代言 ${Math.round((p.popularity||0)*0.3)}万/周 · 人气 ${p.popularity}</div>`:'';
 const disc=p.discount?`<span class="p-disc">特惠${Math.round(p.discount*10)}折</span>`:'';
 return `<div class="pcard ${ovrCls(o)}">
 ${hpCls}
 <div class="p-top">${avatar(p,34)}<span class="p-name">${p.name}${capTag}${tags}${campTag}</span><span class="p-pos" title="${POS[p.pos][0]}">${POS[p.pos][1]}</span></div>
 <div class="p-rarity" style="color:${oc};letter-spacing:0">总值 <b style="font-size:16px">${o}</b> · ${POS[p.pos][0]}${teamHtml}${potHtml}${disc}</div>
 ${stageHtml}
 ${contractHtml}
 ${appsHtml}
 ${heroHtml}
 ${endorseHtml}
 <div class="p-skill"><b>${p.skill.n}</b> · ${p.skill.d}</div>
 <div class="attr">
 <span>对线<i>${p.attrs.lane}</i></span><span>运营<i>${p.attrs.farm}</i></span>
 <span>团战<i>${p.attrs.team}</i></span><span>心态<i>${p.attrs.mind}</i></span>
 </div>
 <div class="p-foot"><span>战力 <b>${pow}</b></span><span>身价 <b class="${(p.val||100)>=110?'green':(p.val||100)<90?'red':''}">${sellAskPrice(p)}万</b></span><span>周薪 <b class="p-salary">${p.wage}万</b></span></div>
 ${energyBar(p)}
 <button class="btn sm" style="margin-top:6px" onclick="showCareer(findPlayerCard('${p.id}'))">选手档案</button>
 ${extra||''}
 </div>`;
}
function findPlayerCard(id){return S.players.find(x=>x.id===id)||S.market.find(x=>x.id===id)||null;}
/* 选手档案弹窗 */
/* 比赛复盘：回放历史比赛逐局日志 */
function showReplay(h){
 if(!h||!h.logs)return;
 $('#app-modal-body').innerHTML=`
 <h2>复盘：${S.teamName} vs ${h.opp} <span class="tag">${h.stage} ${h.score}</span></h2>
 ${h.peak?'<div class="hint" style="text-align:center;color:var(--gold);margin-bottom:10px">巅峰对决名场面</div>':''}
 ${h.aiReport?`<div class="event-card" style="margin-bottom:10px"><div class="et">AI 战报</div><p>${_escTxt(h.aiReport)}</p></div>`:''}
 <div class="logbox" style="max-height:60vh">${h.logs.map(l=>`<div class="${l.includes('胜')?'win':l.includes('负')?'lose':'info'}">${l}</div>`).join('')}</div>
 <div class="center mt16"><button class="btn primary" onclick="closeModal('app-modal')">关闭</button></div>`;
 $('#app-modal').classList.add('on');
}
/* ================= 年度回顾弹窗（赛季回顾页） =================
 数据由 buildYearReview 在年度轮换前定格（career.js）；此处只读渲染。
 成绩曲线=SVG 折线走势 + 名次徽章带；转会记录/董事会评价/关键战役/成就/经营快照分区展示。 */
function yearPlaceRank(place){
 // 名次文本 → 数值（越小越好）。折线 Y 轴翻转：冠军在顶部。
 if(!place)return 12;
 if(place==='冠军'||place==='金牌')return 1;
 if(place==='亚军'||place==='银牌')return 2;
 if(place==='四强'||place==='铜牌')return 3;
 if(/^5-6/.test(place))return 5.5;
 if(/^7-8/.test(place))return 7.5;
 if(/^9-10/.test(place))return 9.5;
 if(/^11-12/.test(place))return 11.5;
 if(/13-18|未晋级|无奖牌|出局|止步/.test(place))return 15;
 return 12;
}
function yearTrendSvg(stages){
 if(!stages||stages.length<2)return '';
 const W=520,H=140,PAD_L=36,PAD_R=16,PAD_T=18,PAD_B=28;
 const ranks=stages.map(st=>yearPlaceRank(st.place));
 const yMin=1,yMax=16;
 const x=i=>stages.length===1?W/2:PAD_L+i*(W-PAD_L-PAD_R)/(stages.length-1);
 const y=r=>PAD_T+(r-yMin)/(yMax-yMin)*(H-PAD_T-PAD_B);
 const pts=ranks.map((r,i)=>x(i)+','+y(r).toFixed(1)).join(' ');
 const gridY=[1,4,8,12,16].map(g=>{
 const gy=y(g).toFixed(1);
 return `<line x1="${PAD_L}" y1="${gy}" x2="${W-PAD_R}" y2="${gy}" stroke="var(--line)" stroke-width="1"/>
 <text x="${PAD_L-6}" y="${gy}" text-anchor="end" dominant-baseline="central" fill="var(--dim)" font-size="10">${g===1?'冠军':g===16?'垫底':g+'名'}</text>`;
 }).join('');
 const dots=ranks.map((r,i)=>{
 const cx=x(i).toFixed(1),cy=y(r).toFixed(1);
 const col=r<=2?'var(--gold)':r<=4?'var(--cyan)':r<=8?'var(--green)':'var(--dim)';
 const label=stages[i].place;
 const short=stages[i].ev.replace(/KPL年度总决赛/,'年总').replace(/电竞世界杯/,'EWC').replace(/挑战者杯/,'挑杯');
 return `<circle cx="${cx}" cy="${cy}" r="4" fill="${col}"/>
 <text x="${cx}" y="${cy-10}" text-anchor="middle" fill="${col}" font-size="10" font-weight="600">${label}</text>
 <text x="${cx}" y="${H-8}" text-anchor="middle" fill="var(--dim)" font-size="10">${short}</text>`;
 }).join('');
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;max-width:${W}px;margin:0 auto" role="img" aria-label="年度成绩走势">
 ${gridY}
 <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
 ${dots}
 </svg>`;
}
function showYearReview(idx){
 const r=(S.yearReviews||[])[idx];
 if(!r){toast('暂无年度回顾');return;}
 const placeCol=p=>p==='冠军'?'var(--gold)':p==='亚军'?'var(--cyan)':/金牌|四强|胜/.test(p)?'var(--green)':/未|无|出局|13-18|止步/.test(p)?'var(--red)':'var(--dim)';
 const trend=yearTrendSvg(r.stages);
 const stageRow=r.stages.length?r.stages.map(st=>`<div class="match" style="margin-bottom:5px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:12px">${st.ev}</span></div>
 <div class="score" style="font-size:13px;color:${placeCol(st.place)};min-width:70px">${st.place}</div></div>`).join('')
 :'<div class="hint">本年度暂无赛段记录</div>';
 const honorRow=r.honors.length?r.honors.map(h=>`<div class="hint" style="color:${h.champion?'var(--gold)':'var(--dim)'}">${h.champion?'':''}${h.title}</div>`).join(''):'<div class="hint">无决赛荣誉</div>';
 const trRow=r.transfers.length?r.transfers.map(t=>`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line);font-size:12px">
 <span>${t.dir==='in'?'<span class="cyan">签入</span>':'<span style="color:var(--gold)">售出</span>'} <b>${t.name}</b> <span class="dim">${t.team||''}${t.note?' · '+t.note:''}</span></span>
 <span class="${t.dir==='in'?'red':'green'}" style="white-space:nowrap">${t.dir==='in'?'-':'+'}${t.fee||0}万</span></div>`).join('')
 :'<div class="hint">本年度无人员流动</div>';
 const b=r.board;
 const boardRow=b?`<div style="font-size:13px;margin-bottom:4px">年度积分第 <b>${b.rank||'—'}</b> 名（目标前 ${b.target||'—'}）→ 信任度 <b class="${b.delta>=0?'green':'red'}">${b.delta>=0?'+':''}${b.delta}</b>（结算后 ${b.trust}）</div>
 <div class="hint">${b.note||''}</div>`
 :'<div class="hint">本年度董事会未作评价（缺积分数据）</div>';
 const keyRow=r.keys.length?r.keys.map(h=>`<div class="match" style="margin-bottom:5px;padding:7px 10px;${h.win?'':'border-color:var(--line)'}">
 <div class="vs"><span class="tname" style="font-size:12px">${r.team} vs ${h.opp}</span><div class="power" style="font-size:10px">${h.stage}${h.peak?' · 巅峰对决':''}</div></div>
 <div class="score" style="font-size:13px;min-width:0">${h.win?'<span class="green">胜</span>':'<span class="red">负</span>'} ${h.score}</div></div>`).join('')
 :'<div class="hint">本年度无关键战役记录</div>';
 const achRow=r.achieved.length?r.achieved.map(n=>`<span class="p-tag" style="border-color:var(--gold);color:var(--gold);margin:2px">${n}</span>`).join(''):'<span class="hint">本年度无新成就</span>';
 $('#app-modal-body').innerHTML=`
 <h2>${r.year} 年度回顾 <span class="tag">${r.team} · 第 ${r.season} 赛季</span></h2>
 <div class="panel" style="margin:10px 0"><h3>成绩曲线 <span class="tag">年度积分 ${r.annualPts} · 联盟第 ${r.annualRank||'—'} 名</span></h3>
 ${trend?`<div style="padding:6px 0 10px">${trend}</div><div class="hint" style="text-align:center;margin-bottom:8px">赛段走势：越高越好（冠军在顶）</div>`:''}
 ${stageRow}</div>
 <div class="panel" style="margin:10px 0"><h3>荣誉</h3>${honorRow}</div>
 <div class="panel" style="margin:10px 0"><h3>转会记录 <span class="tag">${r.transfers.length} 笔</span></h3>${trRow}</div>
 <div class="panel" style="margin:10px 0"><h3>董事会评价</h3>${boardRow}</div>
 <div class="panel" style="margin:10px 0"><h3>关键战役 <span class="tag">巅峰对决 / 决赛轮次</span></h3>${keyRow}</div>
 <div class="panel" style="margin:10px 0"><h3>本年度成就</h3><div>${achRow}</div></div>
 <div class="panel" style="margin:10px 0"><h3>经营快照</h3>
 <div class="hint">年末资金 ${fmt(r.fund)} · 粉丝 ${r.fans} 万 · 年度积分 ${r.annualPts} 分</div></div>
 <div class="center"><button class="btn primary" onclick="closeModal('app-modal')">关闭</button></div>`;
 $('#app-modal').classList.add('on');
 $('#app-modal').classList.add('wide');
 if(S._reviewNew===r.year){S._reviewNew=null;save();} // 首次查看后清除俱乐部页提示
}
function showCareer(p){
 if(!p||!p.name){toast('档案暂不可用');return;}
 const lvDesc=(p.heroPool||[]).map(h=>`${h.n}(${HERO_LV[h.lv].n})`).join('、');
 $('#app-modal-body').innerHTML=`
 <h2>${p.name} 选手档案</h2>
 <div class="center" style="margin-bottom:12px">
 <span class="p-pos" style="background:rgba(90,167,255,.15);color:var(--sr);padding:2px 10px;border-radius:16px;font-size:12px">${POS[p.pos][0]} ${POS[p.pos][1]}</span>
 <b style="color:${ovrColor(overall(p))};margin-left:8px">总值 ${overall(p)}</b>
 ${p.team?`<span class="dim" style="margin-left:8px">${p.team}</span>`:''}${(p.tags||[]).join(' ')}
 </div>
 <div class="event-card"><div class="et">职业生涯</div><p>${p.career||'新秀档案待完善'}</p></div>
 <div style="display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:10px">${radarSvg(p,84)}<div class="hint" style="text-align:left">年龄：${p.age!=null?p.age:'—'}岁${p.age!=null&&p.age>=(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire-1?'（<b style="color:var(--red)">'+(p.age>=(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire?'已到退役年龄':'即将退役')+'</b>）':''}　·　MVP：${p.mvp||0} 次　·　出场 ${p.caps||0} 场<br>当前身价 <b class="gold">${sellAskPrice(p)}万</b>（表现 ${perfLabel(p)} ${p.val||100}%）· 场均 ${(p.caps?Math.round((p.kTotal||0)/p.caps*10)/10:0)} / ${(p.caps?Math.round((p.dTotal||0)/p.caps*10)/10:0)} / ${(p.caps?Math.round((p.aTotal||0)/p.caps*10)/10:0)}<br>招牌英雄：${heroIcon(p.sig,16)} ${p.sig}（${HERO_LV[heroLv(p,p.sig)].n}）<br>英雄池：${lvDesc}</div></div>
 <div class="center"><button class="btn primary" onclick="closeModal('app-modal')">关闭</button></div>`;
 $('#app-modal').classList.add('on');
}
function energyBar(p){
 const c=p.energy>60?'var(--green)':p.energy>30?'var(--gold)':'var(--red)';
 return `<div class="pbar"><span>体力</span><div class="progress"><i style="width:${p.energy}%;background:${c}"></i></div><span>${p.energy}</span>
 <span style="margin-left:8px">士气</span><div class="progress"><i style="width:${p.morale}%;background:${p.morale<40?'var(--red)':'var(--cyan)'}"></i></div><span>${p.morale}</span></div>`;
}

/* ================= 页面渲染 ================= */
function renderHeader(){
 const sp=SPONSORS[S.sponsorLv];
 const nextPay=WAGE_EVERY-(S.day%WAGE_EVERY===0?WAGE_EVERY:S.day%WAGE_EVERY);
 $('#header').innerHTML=`
 <div class="logo">${crest(S.icon,S.teamName,32)}</div>
 <div class="hd-name">${S.teamName}<small>${S.mode==='player'?'选手生涯 · '+(myPlayer(S)?myPlayer(S).name:'')+' · '+splitLabel(S):S.mode==='coach'?'教练生涯 · '+splitLabel(S):S.phase==='champion'?'冠军俱乐部':splitLabel(S)+' · KPL 联赛'}</small></div>
 <div class="stats">
 <div class="stat"><b data-num="fund">${fmt(S.fund)}</b><small>资金</small></div>
 <div class="stat"><b data-num="power">${fmt(teamPower(S))}</b><small>总战力</small></div>
 <div class="stat"><b>第${S.day}天</b><small>距发薪${nextPay}天</small></div>
 <div class="stat ${weeklyWage(S)>S.wageCap?'red':''}"><b>${weeklyWage(S)}/${S.wageCap}万</b><small>周薪/帽</small></div>
 ${S.streak>=3?`<div class="stat gold"><b>${S.streak}连胜</b><small>火热</small></div>`:S.streak<=-3?`<div class="stat red"><b>${-S.streak}连败</b><small>低迷</small></div>`:''}
 <div class="stat"><b>${sp.income}万/天</b><small>${sp.name}</small></div>
 ${S.coach?`<div class="stat gold"><b>${S.coach.name}</b><small>教练 +${S.coach.bonus}%</small></div>`:''}
 </div>
 <button class="hd-btn" onclick="save();toast('存档成功')">存档</button>
 <button class="hd-btn" onclick="openSaveMgmt()">管理</button>
 <button class="hd-btn" onclick="toggleSfx()" title="音效开关">${_sfxOn?'音效 开':'音效 关'}</button>
 <button class="hd-btn" onclick="resetGame()">重开</button>`;
 // 数字滚动：资金/战力平滑滚数（带 data-num 的 stat）
 try{
 document.querySelectorAll('#header [data-num]').forEach(el=>{
 const key=el.dataset.num;
 tweenNum(el,key,key==='fund'?S.fund:teamPower(S));
 });
 }catch(_){}
}
/* ================= 董事会终局的 UI 层守卫 =================
 下课是"软终局"：只在 UI 入口拦截，不改进程内部逻辑——平衡门禁（sim/sim-quick/fuzz）
 直接调用 nextDay/startMatch/startCup，若在那里硬守卫，门禁就再也测不出真实数值了。 */
function boardLocked(){return !!(S&&S.board&&S.board.fired);}
function uiGuard(msg){if(boardLocked()){try{toast(msg||'你已被董事会解约，执教生涯结束');}catch(_){}return true;}return false;}
function playerRetired(s){return !!(s&&s.mode==='player'&&s.career&&s.career.retired);}
function uiNextDay(s){if(uiGuard())return;if(playerRetired(s)){toast('职业生涯已退役——「生涯」页查看履历，或重新开始');return;}nextDay(s);}
function uiStartMatch(){if(uiGuard())return;if(playerRetired(S)){toast('职业生涯已退役');return;}startMatch();}
function uiStartCup(s){if(uiGuard())return;startCup(s);}
function uiSkipTransfer(s){if(uiGuard())return;skipTransferWindow(s);}
function uiEndPreseason(s){if(uiGuard())return;endPreseason(s);}
function uiAdvanceCalendar(s){if(uiGuard())return;advanceCalendar(s);}
function uiAsiadStep(s){if(uiGuard())return;asiadStep(s);}
function renderClub(){
 const ls=rosterLineup(S);
 let html=`
 <div class="banner" style="border-left:4px solid ${teamColor(S.teamName)}">
 <div>${crest(S.icon,S.teamName,44)}</div>
 <div><div class="big">${S.teamName}</div>
 <div class="dim" style="font-size:12px">${splitLabel(S)} · 第${S.day}天 · ${PHASE_NAME[S.phase]||S.phase}${myGroup(S)?' · '+myGroup(S)+'组':''}${(S.phase==='playoff'||S.phase==='annual'&&S.annual&&S.annual.stage==='po')?' · 双败淘汰':''}${S.phase==='ewc'?' · 8强单败':''}${scenarioById(S.scenario||'normal').hard?' · <span class="gold">剧本：'+scenarioById(S.scenario).name+'</span>':''}</div></div>
 <button class="btn sm" style="margin-left:4px;flex:none" onclick="openCrestEdit()" title="自选外形/配色/缩写，风格同 18 支真实俱乐部">改队徽</button>
 <div style="margin-left:auto;text-align:right">
 <div class="gold" style="font-size:18px;font-weight:800">${fmt(S.fund)}</div>
 <div class="dim" style="font-size:11px">俱乐部资金</div>
 </div>
 </div>`;
 // 董事会：信任度 + 本赛季 KPI（经理/教练的"输"——选手模式无董事会，只看教练评价）
 if(S.mode!=='player'){
 const b=S.board||{trust:60},t=b.trust==null?60:b.trust,career=S.managerCareer||{};
 const col=b.fired?'var(--red)':t>=BOARD_FAVOR_TRUST?'var(--green)':t>=60?'var(--cyan)':t>=BOARD_WARN_TRUST?'var(--gold)':'var(--red)';
 if(b.fired){
 html+=`<div class="panel" style="border-color:var(--red)">
 <h3>董事会 <span class="tag" style="color:var(--red)">已解约</span></h3>
 <div style="font-size:13px;margin-bottom:6px">信任度耗尽，董事会在第 ${b.firedSeason||S.season} 赛季结束后与你解约，执教生涯就此结束。</div>
 <div class="hint">执教 ${career.years||0} 个赛季 · ${career.titles||0} 座冠军 · 最佳年度积分第 ${career.lastRank||'—'} 名 · 成就 ${Object.keys(S.achieved||{}).length}/${ACHIEVEMENTS.length}</div>
 <div style="margin-top:10px"><button class="btn danger" style="width:100%" onclick="resetGame()">结束执教 · 重新开始</button></div>
 </div>`;
 }else{
 const kpi=b.kpi,last=(b.log||[])[0];
 // label 兜底：旧档/中间版本存档的 kpi 可能只有 target 没有 label，不能渲染出 undefined
 const kpiText=k=>k?('赛季末年度积分进前 '+(k.target||12)):'赛季末不评价（缺历史数据）';
 html+=`<div class="panel">
 <h3>董事会 <span class="tag" style="color:${col}">信任度 ${t} · ${boardTierText(S)}</span>${t<=BOARD_WARN_TRUST?'<span class="tag" style="color:var(--red)">最后通牒</span>':''}</h3>
 ${S.career&&S.career.legacy?`<div class="hint" style="margin-bottom:6px">名宿出身：${S.career.legacy.name} 由选手生涯转型（${S.career.legacy.seasons||0} 赛季 · ${S.career.legacy.titles||0} 冠 · 生涯总值峰值 ${S.career.legacy.ovr||'—'}）</div>`:''}
 <div style="height:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${clamp(t,0,100)}%;background:${col}"></div></div>
 <div style="font-size:13px">本赛季目标：<b>${kpiText(kpi)}</b>
 <span class="hint">（${kpi&&kpi.from?'依据上年第 '+kpi.from+' 名':(S.selfBuilt?'首年按自建阵容档位':'首年按执教班底档位')}）</span></div>
 ${last?`<div class="hint" style="margin-top:6px">上季结算：年度积分第 ${last.rank||'—'} 名 · 信任度 ${last.delta>=0?'+':''}${last.delta}${last.note?' · '+last.note:''}</div>`:''}
 <div class="hint" style="margin-top:6px">赛季末按「年度积分排名」结算：达成目标涨信任度${t<=BOARD_WARN_TRUST?'；当前已被董事会介入，工资帽压缩，再未达标即解约':'；连年不达标会逐步失去董事会的耐心'}</div>
 </div>`;
 }
 }
 if(S.mode==='coach'){ // 教练模式：执教合同 + 履历 + 豪门邀约
 const d=S.coachDeal||{years:0,honors:[],log:[]};
 html+=`<div class="panel"><h3>执教履历 <span class="tag">现合同 ${d.years||0} 年 · ${d.honors.length||0} 冠</span></h3>
 <div class="hint" style="margin-bottom:6px">只管竞技：转会与资金由俱乐部打理（自动引援/续约），你的 KPI 是带队成绩——信任度耗尽即解约</div>
 ${(d.log||[]).slice(0,4).map(l=>`<div class="hint">${l.year} · ${l.note||l.team||''}</div>`).join('')}
 ${(S.coachOffer)?`<div class="event-card" style="margin-top:8px"><div class="et">豪门邀约：${S.coachOffer.team} 邀请你执教</div>
 <div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm primary" onclick="respondCoachOffer(true)">接受（换队执教）</button><button class="btn sm" onclick="respondCoachOffer(false)">婉拒（留任）</button></div></div>`:''}
 </div>`;
 }
 if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
 const m=S.schedule[S.matchIdx];
 const g=myGroup(S);
 if(S.preseason){
 // 赛前转会期：先组队，再开赛（比赛面板隐藏）
 const lsP=rosterLineup(S);
 // 开档三步清单：签教练 → 五位置有人 → 结束转会期（完成后随转会期面板一起消失）
 const missPos=POS_ORDER.filter(pos=>!lsP.some(x=>x.pos===pos));
 const steps=[
 {ok:!!S.coach,n:'签下主教练'+(S.coach?'（'+S.coach.name+'）':'')},
 {ok:!missPos.length,n:missPos.length?'五个位置有人（缺 '+missPos.map(pos=>POS[pos][1]).join('/')+'）':'五个位置有人'},
 {ok:false,n:'结束转会期 · 开始赛季'},
 ];
 html+=`<div class="panel">
 <h3>赛前转会期 <span class="tag">剩余 ${S.transferWindow} 天 · 结束后开赛</span></h3>
 <div style="margin-bottom:8px;padding:8px 10px;border:1px solid var(--line);border-radius:4px;font-size:12px">
 <b>开档三步</b>　${steps.map(s=>s.ok?'<span style="color:var(--green)">✓ '+s.n+'</span>':'<span style="color:var(--gold)">□ '+s.n+'</span>').join('　→　')}
 <div class="hint" style="margin-top:4px">阵容就绪后点下方「结束转会期 · 开始赛季」即可开打；天数用完也会自动开赛</div>
 </div>
 <div class="hint" style="margin-bottom:8px">先把阵容组好再打比赛：转会市场可<b>买断其他俱乐部选手、直签自由球员、挂牌出售</b>；转会期内市场刷新免费、顶星供给增加。天数用完自动开始联赛，也可随时提前结束。</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${POS_ORDER.map(pos=>{
 const p=lsP.find(x=>x.pos===pos);
 return p?`<span class="tag">${POS[pos][1]} ${p.name} · 战力${playerPower(p,p.sig)}</span>`:`<span class="tag" style="color:var(--red)"> ${POS[pos][1]} 空缺！</span>`;
 }).join('')}</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn primary" style="flex:1;min-width:140px" onclick="goPage('market')"> 前往转会市场</button>
 <button class="btn" style="flex:1;min-width:140px" onclick="goPage('lineup')">阵容 / 挂牌出售</button>
 </div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
 <button class="btn" style="flex:1;min-width:140px" onclick="uiNextDay(S)">推进一天（剩余 ${Math.max(0,S.transferWindow-1)} 天）</button>
 <button class="btn gold" style="flex:1;min-width:140px" onclick="uiSkipTransfer(S)">跳过剩余 ${Math.max(0,S.transferWindow)} 天（自动训练/培养）</button>
 </div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
 <button class="btn gold" style="flex:1;min-width:140px" onclick="uiEndPreseason(S)"> 结束转会期 · 开始赛季</button>
 </div>
 </div>`;
 }else if(m){
 const oppIcon=(AI_TEAMS.find(t=>t.name===m.opp)||{}).icon||'';
 html+=`<div class="panel">
 <h3>下一场比赛 <span class="tag">${PHASE_NAME[S.phase]} · ${g}组 第${m.round}/${KPL.ROUNDS}轮</span></h3>
 <div class="match">
 <div class="vs"><div>${crest(S.icon,S.teamName,38)}</div><div><div class="tname">${S.teamName}</div><div class="power">战力 ${fmt(teamPower(S))}</div></div></div>
 <div style="color:var(--dim);font-weight:900">VS</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><div><div class="tname">${crest(oppIcon||'队',m.opp,20)} ${m.opp}</div><div class="power">战力 ${fmt(powerOf(S,m.opp))}</div></div></div>
 </div>`;
 const me=myPlayer(S);
 const meStart=me&&S.lineup.includes(me.id);
 if(S.mode==='player'){
 html+=`<button class="btn primary" style="width:100%" onclick="startPlayerMatch()">出战比赛 · 教练指挥（自动模拟 BO5）</button>
 <div class="hint mt8">${me?(meStart?'你已进入首发轮换——教练按状态评定每场首发':'你目前是替补：在「生涯」页加练，战力超过同位置队友即可夺回首发'):'选手数据缺失'}。比赛由教练组指挥 BP，赛后看你的个人数据与全场直播。</div>`;
 }else{
 html+=`<button class="btn primary" style="width:100%" onclick="uiStartMatch()">赛前准备 · 调整阵容 / BP 开赛（BO5 全局BP）</button>
 <div class="hint mt8">KPL 官方赛制：常规赛 BO5 全局BP，胜者积 1 分；系列赛内用过的英雄锁定，每局对手 BAN 2 个；奖金按胜小局数结算（8万/小局）。赛前可换首发，BP 中也可换替补。</div>`;
 }
 html+=`</div>`;
 }
 }else if(S.phase==='card'){
 const myCard=S.card&&S.card.matches.find(m=>m.a===S.teamName||m.b===S.teamName);
 html+=`<div class="panel"><h3>卡位赛 <span class="tag">BO7 · 含巅峰对决</span></h3>
 ${(S.card.matches||[]).map(m=>{
 const done=!!m.r;
 const me=m.a===S.teamName||m.b===S.teamName;
 return `<div class="match ${done?'':''}" style="margin-bottom:8px">
 <div class="vs"><span class="tname">${m.a}</span></div>
 <div class="score" style="font-size:13px">${done?`${m.r} 晋级`:'待赛'}</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span class="tname">${m.b}</span></div>
 ${me?'<div class="hint" style="margin-left:8px">本队</div>':''}</div>`;
 }).join('')}
 ${myCard&&!myCard.r?`<button class="btn primary" style="width:100%" onclick="startCard()"> 进行卡位赛</button>`:''}
 <div class="hint mt8">S5 vs A2、S6 vs A1（胜者升S）；A5 vs B2、A6 vs B1（胜者进A）· 败者进低组或淘汰</div>
 </div>`;
 }else if(S.phase==='playoff'){
 const pf=S.playoff;
 if(pf){
 // 我方是否还有待打的季后赛场次（双败制：wb/wf 失利后仍在败者组，不能只看总决赛）
 const myPending=[...pf.wb,...pf.lb,...pf.lb2,...pf.lb3,pf.wf,pf.lb4,pf.lbf,pf.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 const bracket=pf.wb.map((m,i)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">胜者组：${m.a} vs ${m.b}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`).join('')
 +pf.lb.map((m,i)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">败者组：${m.a} vs ${m.b}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`).join('');
 html+=`<div class="panel"><h3>季后赛 <span class="tag">10强 BO7 双败淘汰</span></h3>${bracket}
 ${!pf.final.r?`<button class="btn primary" style="width:100%" onclick="startPlayoff()">${myPending?'进行下一场':'快进季后赛'}</button>`:''}
 ${pf.final.r?`<div class="hint mt8">总决赛：${pf.final.a} vs ${pf.final.b} · 冠军：${pf.final.r}</div>`:`<div class="hint mt8">总决赛：${pf.final.a?pf.final.a:'胜者组冠军'} vs ${pf.final.b?pf.final.b:'败者组冠军'}</div>`}
 </div>`;
 }
 }else if(S.phase==='challenger'){
 const c=S.challenger;
 const cupRow=m=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${m.a} vs ${m.b}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 let body='';
 if(c.stage==='single'){
 const myPending=[...c.r1,...(c.r2||[])].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 body=`${c.r1.filter(m=>m.r||m.a===S.teamName||m.b===S.teamName).map(m=>cupRow(m)).join('')}
 ${c.r2?`<div class="hint" style="margin:6px 0">16强（BO7）：</div>${c.r2.map(cupRow).join('')}`:''}
 ${!c.champ?`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行下一场 · 调整阵容 / BP 开赛':'快进赛程'}</button>`:''}`;
 }else{
 const p=c.po;
 const myPending=p&&!c.final&&[...p.wb1,...p.lb1,...p.wb2,...p.lb2,p.wf,p.lbs,p.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 const mrow=(m,tag)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${tag?tag+'：':''}${m.a?m.a:'待定'} vs ${m.b?m.b:'待定'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 body=`<div class="hint" style="margin-bottom:6px">8 强双败（BO7）：</div>
 ${p.wb1.map(m=>mrow(m,'胜者组R1')).join('')}${p.wb2.map(m=>mrow(m,'胜者组SF')).join('')}${p.wf.a?mrow(p.wf,'胜者组决赛'):''}
 ${p.lb1.map(m=>mrow(m,'败者组R1')).join('')}${p.lb2.map(m=>mrow(m,'败者组R2')).join('')}${p.lbs.a?mrow(p.lbs,'败者组SF'):''}${p.lbf.a?mrow(p.lbf,'败者组决赛'):''}
 ${c.final&&c.final.a?`<div class="hint" style="margin:6px 0">总决赛（BO9 · 第9局巅峰对决）：</div>${mrow(c.final,'决赛')}`:''}
 ${!c.champ&&c.final&&!c.final.r?`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行下一场':'进行总决赛（BO9）'}</button>`:!c.champ?`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行下一场':'快进赛程'}</button>`:''}
 ${c.champ?`<div class="hint mt8">冠军：${c.champ} —— 挑战者，皆王者！</div>`:''}`;
 }
 html+=`<div class="panel"><h3>挑战者杯 <span class="tag">32队 · 八大赛道 · 单败+双败</span></h3>
 ${body}
 <div class="hint mt8">18 支 KPL 全员参赛 + K甲/全国大赛/青训/高校/职工/主播/全球赛道挑战者 · 春冠/春亚种子分半区 · 低赛道队对 KPL 有「挑战者的祝福」+5% · 冠军 300 万 + 年总积分 85 + FMVP</div>
 </div>`;
 }else if(S.phase==='ewc'){
 const e=S.ewc;
 const cupRow=m=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${m.a} vs ${m.b}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 const myPending=[...e.qf,...e.sf,e.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 html+=`<div class="panel"><h3>EWC 电竞世界杯 <span class="tag">利雅得 · 8强 BO7 单败</span></h3>
 ${e.qf.map(cupRow).join('')}${e.sf.filter(m=>m.a).map(cupRow).join('')}${e.final.a?cupRow(e.final):''}
 ${!e.champ?`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行下一场 · 调整阵容 / BP 开赛':'快进赛程'}</button>`:`<div class="hint mt8">冠军：${e.champ}${e.champ===S.teamName?' ——世界之巅！':''} · 赛后进入夏季赛转会期</div>`}
 <div class="hint mt8">KPL 春季赛冠亚军（直邀，冠军=KPL名额/亚军=英雄亚冠ACL名额）+ 6 支海外劲旅 · 冠军奖金 540 万并评 FMVP</div>
 </div>`;
 }else if(S.phase==='asiad'){
 const a=S.ag;
 const row=m=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${m.a||'待定'} vs ${m.b||'待定'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 const mine=a.squad.filter(x=>x.mine).length;
 html+=`<div class="panel"><h3>亚运会 · 王者荣耀项目 <span class="tag">${gameYear(S)} 名古屋 · 8强 BO7 单败</span></h3>
 <div class="hint" style="margin-bottom:8px"><b>中国代表队</b>（KPL 各位置当季最强，战力 ${a.myPow}）：${a.squad.map(x=>`<span class="tag" style="margin-right:4px${x.mine?';border-color:var(--gold);color:var(--gold)':''}">${POS[x.pos][1]} ${x.name}${x.mine?' ★':''}</span>`).join('')}</div>
 ${a.qf.map(row).join('')}${a.sf.filter(m=>m.a).map(row).join('')}${a.final.a?row(a.final):''}
 ${a.champ?`<div class="hint mt8">冠军：<b class="gold">${a.champ}</b> —— 中国队成绩：${a.medal}${a.mvp?' · MVP '+a.mvp:''} · 随后进入年度总决赛</div>`
 :`<button class="btn primary" style="width:100%" onclick="uiAsiadStep(S)">推进亚运会赛程（BO7 单败）</button>`}
 <div class="hint mt8">教练席在国家队手里，你只负责放人：麾下入选选手按奖牌档位回流人气/身价/士气（金牌 +8/+6、银牌 +5/+4、铜牌 +3/+2），协会另发奖金；代价是年总开局体力不满。最强对手：韩国。</div>
 </div>`;
 }else if(S.phase==='annual'){
 const a=S.annual;
 const cupRow=m=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${m.a} vs ${m.b}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 if(a.stage==='arena'){
 const st=arenaStandings(S);
 const rd=a.rounds[a.roundIdx];
 const myNext=rd?rd.find(m=>m.a===S.teamName||m.b===S.teamName):null;
 const rankLine=(tbl,teams)=>teams.slice().sort((x,y)=>tbl[y].pts-tbl[x].pts||tbl[y].pw-tbl[x].pw).map(t=>t+' '+tbl[t].pts+'分').join(' · ');
 html+=`<div class="panel"><h3>年度总决赛·擂台赛 <span class="tag">第${Math.min(a.roundIdx+1,6)}/6轮 · BO5 组外单循环</span></h3>
 ${myNext?`<div class="match"><div class="vs"><span class="tname">${myNext.a} vs ${myNext.b}</span><span class="score" style="font-size:12px">${myNext.a===S.teamName||myNext.b===S.teamName?'本队':'—'}</span></div></div>
 <button class="btn primary" style="width:100%" onclick="uiStartCup(S)">进行擂台赛 · 调整阵容 / BP 开赛</button>`:`<div class="hint">本轮赛程进行中</div>`}
 <div class="hint mt8"><b>大师组</b>（积分前6）：${rankLine(st.M,a.masters)}</div>
 <div class="hint"><b>精英组</b>（积分7-12）：${rankLine(st.E,a.elites)}</div>
 <div class="hint mt8">大师组前4 + 精英组第1 直进淘汰赛；大师5/6 与精英2-5 打突围赛；精英第6名直接出局</div>
 </div>`;
 }else if(a.stage==='breakthrough'){
 const myPending=a.brk.some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 html+=`<div class="panel"><h3>年度总决赛·突围赛 <span class="tag">6队 BO7 单败 · 3队晋级</span></h3>
 ${a.brk.map(cupRow).join('')}
 ${a.brk.every(m=>m.r)?'<div class="hint mt8">晋级淘汰赛：'+a.brk.map(m=>m.r).join('、')+'</div>':`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行突围赛':'快进赛程'}</button>`}
 </div>`;
 }else{
 const p=a.po;
 const myPending=p&&!p.final.r&&[...p.wb1,...p.lb1,...p.wb2,...p.lb2,p.wf,p.lbs,p.lbf,p.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 const mrow=(m,tag)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${tag?tag+'：':''}${m.a?m.a:'待定'} vs ${m.b?m.b:'待定'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 html+=`<div class="panel"><h3>年度总决赛·淘汰赛 <span class="tag">8强 BO7 双败 · 圣龙杯</span></h3>
 ${p?p.wb1.map(m=>mrow(m,'胜者组R1')).join('')+p.wb2.map(m=>mrow(m,'胜者组SF')).join('')+(p.wf.a?mrow(p.wf,'胜者组决赛'):'')+p.lb1.map(m=>mrow(m,'败者组R1')).join('')+p.lb2.map(m=>mrow(m,'败者组R2')).join('')+(p.lbs.a?mrow(p.lbs,'败者组SF'):'')+(p.lbf.a?mrow(p.lbf,'败者组决赛'):'')+(p.final.a?mrow(p.final,'总决赛'):'')
 :'<div class="hint">待突围赛结束</div>'}
 ${p&&p.final.a&&!p.final.r?`<button class="btn primary" style="width:100%" onclick="uiStartCup(S)">${myPending?'进行下一场':'快进赛程'}</button>`:''}
 ${p&&p.champ?`<div class="hint mt8">年度总冠军：${p.champ} —— 圣龙杯！</div>`:''}
 </div>`;
 }
 }else if(S.phase==='champion'){
 html+=`<div class="panel center">
 <div style="font-size:40px;color:var(--gold)"></div>
 <h3 style="justify-content:center">${splitLabel(S)} 总冠军：${S.playoff?S.playoff.champ:'—'}</h3>
 ${S.champion?'<div class="green" style="font-size:16px;font-weight:800;margin:8px 0">你是冠军！王朝就此建立！</div>':'<div class="dim">冠军属于对手，继续积蓄力量！</div>'}
 <div class="hint" style="margin:6px 0">${S.split==='spring'?'接下来：挑战者杯 → EWC → 夏季赛':(isAsiadYear(S)&&!S.agDone)?'接下来：亚运会（国家队征召） → KPL 年度总决赛':'接下来：KPL 年度总决赛（年度积分前12）'}</div>
 <button class="btn gold mt12" onclick="uiAdvanceCalendar(S)">${calendarNextLabel(S)}</button>
 </div>`;
 }else if(S.phase==='eliminated'){
 html+=`<div class="panel center">
 <div style="font-size:40px;color:var(--faint)"></div>
 <h3 style="justify-content:center">${splitLabel(S)} 止步</h3>
 <div class="dim" style="margin:8px 0">未能晋级后续阶段（B组后2名 / 卡位赛失利 / 季后赛出局）</div>
 <div class="hint" style="margin:6px 0">年度积分已入账（当前 ${S.annualPts[S.teamName]||0} 分）· ${S.split==='spring'?'接下来：挑战者杯 → EWC → 夏季赛':(isAsiadYear(S)&&!S.agDone)?'接下来：亚运会（国家队征召） → 年度总决赛':'接下来：年度总决赛（前12晋级）'}</div>
 <button class="btn gold mt12" onclick="uiAdvanceCalendar(S)">${calendarNextLabel(S)}</button>
 </div>`;
 }
 // 年度回顾提示条：年度轮换后自动生成（查看后消失，历史回顾在经营页）
 if(S._reviewNew!=null&&(S.yearReviews||[]).length){
 html+=`<div class="panel" style="border-color:var(--gold)"><h3>年度回顾 <span class="tag" style="color:var(--gold)">${S._reviewNew} 赛季总结已生成</span></h3>
 <div class="hint" style="margin-bottom:8px">上一年的成绩曲线、转会记录、董事会评价与关键战役已归档。</div>
 <button class="btn gold" onclick="showYearReview(0)"> 查看 ${S._reviewNew} 年度回顾</button></div>`;
 }
 // 赛中转会报价：留人/放人/抬价三选（引擎在 transfer.js；报价 3 天过期）——选手模式在生涯页处理自己的报价
 if(S.mode==='manager'&&(S.offers||[]).length){
 html+=`<div class="panel"><h3>赛中转会报价 <span class="tag">${S.offers.length} 份待答复 · ${OFFER_TTL} 天内有效 · 过期作废</span></h3>
 ${S.offers.map((o,i)=>{
 const p=S.players.find(x=>x.id===o.pid);
 const meta=p?`${POS[p.pos][1]} · 总值 ${overall(p)} · 表现 ${p.val||100}% · 周薪 ${p.wage}万`:'';
 const final=o.status==='final';
 return `<div class="match" style="margin-bottom:6px;padding:8px 10px;${final?'border-color:var(--gold)':''}">
 <div class="vs"><span class="tname" style="font-size:13px">${o.team} ⇒ ${o.name}</span>
 <div class="power" style="font-size:10px">${meta} · 报价 <b class="gold">${o.fee}万</b> · 第 ${o.expire} 天到期${final?' · <span class="gold">最终报价（不再抬价）</span>':''}</div></div>
 <div style="display:flex;gap:4px;flex-wrap:wrap">
 <button class="btn sm" onclick="respondOffer(S,${i},'keep')">留人（涨薪 8%）</button>
 <button class="btn sm primary" onclick="respondOffer(S,${i},'sell')">放人（收 ${o.fee}万）</button>
 ${final?'':`<button class="btn sm gold" onclick="respondOffer(S,${i},'counter')">抬价（+20~35%）</button>`}
 </div></div>`;
 }).join('')}
 <div class="hint">留人：涨薪约 8% 表达诚意（士气+5 · 忠诚+5），工资帽/奢侈税压力自负；放人：收下转会费，但粉丝失望、队友寒心，阵容也削弱；抬价：约半数买家接受加价、部分给最终报价、也可能直接离场。表现火热（身价系数 ≥112%）的选手才会被盯上。</div>
 </div>`;
 }
 // 今日行动（选手模式的训练/休息在「生涯」页）
 if(S.mode!=='player'){
 html+=`<div class="panel">
 <h3>今日行动 <span class="tag">每天可选择一项</span></h3>
 <div class="g2">
 <div class="pcard" style="border-color:var(--line)">
 <div style="font-weight:800;margin-bottom:6px">训练</div>
 <div class="hint" style="margin-bottom:10px">选择一名选手专项训练（8万/次，体力-10，属性+1~2）</div>
 <button class="btn sm primary" onclick="goPage('train')" ${S.trained?'disabled':''}>前往训练</button>
 </div>
 <div class="pcard" style="border-color:var(--line)">
 <div style="font-weight:800;margin-bottom:6px">休息</div>
 <div class="hint" style="margin-bottom:10px">全队体力+55、士气+4，应对密集赛程</div>
 <button class="btn sm" onclick="doRest(S)" ${S.trained?'disabled':''}>全队休息</button>
 </div>
 </div>
 ${S.trained?'<div class="hint mt8">今日行动已完成，比赛后可推进到下一天</div>':''}
 </div>`;
 }
 // 主教练
 if(S.coach){
 const c=S.coach;
 html+=`<div class="panel"><h3>主教练 <span class="tag">${c.rating||80}评分 · ${COACH_STYLE[c.style]}型</span></h3>
 <div class="sponsor"><span class="s-icon">教</span>
 <div><div class="s-name">${c.name} <span class="gold">(全队战力+${c.bonus}%)</span></div>
 <div class="s-desc"> ${c.skill.n}：${c.skill.d} · 周薪 ${c.wage}万 · 转会页可换帅</div></div></div></div>`;
 }
 // 事件动态（互斥分类：每条日志只归一类，各分类条数相加=全部，无遗漏）
 {
 const cats=[{k:'all',n:'全部'}].concat(LOG_CATS.map(c=>({k:c.k,n:c.n}))).concat([{k:'other',n:'其他动态'}]);
 const kept=window._logFilter;
 const fl=cats.some(c=>c.k===kept)?kept:'all';
 const catOf=e=>e.cat||logCat(e.txt); // 旧存档无 cat 字段时按文案回推，避免读旧档分类全空
 const cnt={};
 (S.eventLog||[]).forEach(e=>{const k=catOf(e);cnt[k]=(cnt[k]||0)+1;});
 const logs=(S.eventLog||[]).filter(e=>fl==='all'||catOf(e)===fl).slice(0,30);
 const clr={win:'var(--green)',lose:'var(--red)',gold:'var(--gold)',info:'var(--dim)'};
 html+=`<div class="panel"><h3>事件动态 <span class="tag">共 ${(S.eventLog||[]).length} 条 · 按分类查看</span></h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${cats.map(c=>`<button class="btn sm ${fl===c.k?'primary':''}" onclick="window._logFilter='${c.k}';renderClub()">${c.n}${c.k==='all'?'':' '+(cnt[c.k]||0)}</button>`).join('')}</div>
 ${logs.length?logs.map(e=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--line);color:${clr[e.level]||'var(--dim)'}">${_escTxt(e.txt)}</div>`).join(''):'<div class="hint">该分类暂无事件</div>'}
 </div>`;
 }
 $('#page-club').innerHTML=html;
}
/* ================= 经营页（赞助商 / 工资帽 / 荣誉室 / 比赛复盘） ================= */
function renderBiz(){
 const sp=SPONSORS[S.sponsorLv],next=SPONSORS[S.sponsorLv+1];
 let html=`<div class="panel"><h3>赞助商 <span class="tag">每日结算收入</span></h3>`;
 const fansNow=Math.round(S.fans||0);
 const effIncome=Math.round(sp.income*fanMul(S,500));
 html+=`<div class="sponsor"><span class="s-icon">${sp.icon}</span><div><div class="s-name">${sp.name} <span class="gold">(当前)</span></div><div class="s-desc">每日收入 ${sp.income}万${effIncome>sp.income?' <span class="green">→ 实收 '+effIncome+'万（粉丝加成 +'+(effIncome-sp.income)+'）</span>':''}</div></div></div>`;
 html+=`<div class="hint" style="margin:6px 0">粉丝 <b>${fansNow}</b> 万 · 门票/周边日流水 ${Math.round(fansNow*0.08)}万 · 代言收入 ${Math.round(100*fanMul(S,300)-100)}% 加成<span class="dim">（粉丝由战绩与选手人气成长）</span></div>`;
 if(next){
 const lackFans=(next.fans||0)>fansNow;
 html+=`<button class="btn gold sm" onclick="upgradeSponsor()" ${(S.fund<next.cost||lackFans)?'disabled':''}>升级到「${next.name}」需 ${next.cost}万 · ${next.fans||0}万粉${lackFans?'（还差 '+(next.fans-fansNow)+'万粉）':''}</button>`;
 }else{html+=`<div class="hint">已是最顶级的赞助商！</div>`;}
 html+=`</div>`;
 // 工资帽
 {
 const ww=weeklyWage(S),cap=S.wageCap;
 const over=ww>cap;
 const pct=Math.min(100,Math.round(ww/cap*100));
 html+=`<div class="panel"><h3>工资帽 <span class="tag">KPL 联盟制度</span></h3>
 <div class="pbar" style="margin-bottom:6px"><span>周薪 ${ww}万</span><div class="progress"><i style="width:${pct}%;background:${over?'var(--red)':'var(--green)'}"></i></div><span>帽 ${cap}万</span></div>
 ${over?`<div class="hint" style="color:var(--red)">超工资帽 ${ww-cap}万！发薪日将缴纳 60% 奢侈税（${Math.round((ww-cap)*0.6)}万）——KPL 限制薪酬无限扩张</div>`
 :`<div class="hint">KPL 工资帽制度：周薪总额上限 ${cap}万，超帽部分发薪日缴纳 60% 奢侈税；联盟每赛季调整帽额</div>`}
 </div>`;
 }
 // 荣誉室（多赛季历史）
 const hon=S.honors||[];
 const champCount=hon.filter(h=>h.champion).length;
 html+=`<div class="panel"><h3>荣誉室 <span class="tag">累计 ${champCount} 冠</span></h3>`;
 if(hon.length){
 html+=hon.slice().reverse().map(h=>{
 const badge=h.champion?'冠军':'亚军';
 const txt=h.champion?'夺冠':'亚军';
 return `<div class="sponsor" style="margin-bottom:6px"><span class="s-icon">${badge}</span>
 <div><div class="s-name">${h.title||('赛季'+h.season)}</div><div class="s-desc">${txt}${h.roster?` · 夺冠阵容：<span class="cyan">${h.roster}</span>`:''}</div></div></div>`;
 }).join('');
 }else{
 html+=`<div class="hint">还没有冠军记录，努力冲击总冠军吧！</div>`;
 }
 html+=`</div>`;
 // FMVP 荣誉（春/夏/EWC/年总 决赛最有价值选手）
 const fm=S.fmvpHonor||[];
 html+=`<div class="panel"><h3>FMVP 名人堂 <span class="tag">总决赛最有价值选手</span></h3>`;
 if(fm.length){
 html+=fm.map(f=>`<div class="sponsor" style="margin-bottom:6px"><span class="s-icon">M</span>
 <div><div class="s-name">${f.name} <span class="gold">${f.team===S.teamName?'(本队)':''}</span></div><div class="s-desc">${f.year} ${f.event} FMVP · ${f.team}</div></div></div>`).join('');
 }else{
 html+=`<div class="hint">还没有 FMVP——率队杀进决赛并打出统治表现（各局 MVP 累计最多）即可当选，获专属皮肤与人气温涨</div>`;
 }
 html+=`</div>`;
 // AI 赛后战报（可选实验功能，默认关闭）：设置存本机 localStorage，不进存档导出
 {
 const st=aiSettings();
 html+=`<div class="panel ${foldCls('airep')}" data-fold="airep"><h3>AI 赛后战报 <span class="tag ${st.on?'':'dim'}">${st.on?'已开启 · 每场赛后联网一次':'默认关闭'}</span></h3>
 <div class="hint" style="margin-bottom:8px">可选实验功能：开启后每场系列赛结束，向你填写的 OpenAI 兼容端点发一次请求，生成一段 AI 赛后总结（存入比赛复盘，重放可见）。断网/失败/超时自动回退本地文案，比赛流程永不阻塞。设置只存本机——不进存档、不随导出文件走。</div>
 <button class="btn sm ${st.on?'danger':'primary'}" onclick="toggleAiReport()">${st.on?' 关闭 AI 战报（恢复纯单机）':' 开启 AI 战报（需联网）'}</button>
 ${st.on?`<div style="display:grid;gap:6px;margin-top:10px">
 <label class="hint">解说人设<select id="ai-persona" class="hd-in" style="width:100%" onchange="aiSaveForm()">${AI_PERSONAS.map(p=>`<option value="${p.id}"${(st.persona||'pro')===p.id?' selected':''}>${p.n} · ${p.d}</option>`).join('')}</select></label>
 <label class="hint">端点 URL（OpenAI 兼容 chat/completions，需支持浏览器直连 CORS）<input id="ai-base" class="hd-in" style="width:100%" value="${_escTxt(st.base||'')}" placeholder="https://text.pollinations.ai/openai （社区公益·免key·可能不稳定）" onchange="aiSaveForm()"></label>
 <label class="hint">模型名<input id="ai-model" class="hd-in" style="width:100%" value="${_escTxt(st.model||'')}" placeholder="openai / gpt-4o-mini / 供应商模型 id" onchange="aiSaveForm()"></label>
 <label class="hint">API Key（免 key 端点留空）<input id="ai-key" type="password" class="hd-in" style="width:100%" value="${_escTxt(st.key||'')}" placeholder="sk-..." onchange="aiSaveForm()"></label>
 </div>`:''}
 </div>`;
 }
 // 年度回顾归档（每年一份快照，点开回看）
 {
 const revs=S.yearReviews||[];
 html+=`<div class="panel"><h3>年度回顾 <span class="tag">${revs.length} 份归档 · 每年赛季末自动生成</span></h3>
 <div class="hint" style="margin-bottom:8px">每年度轮换时定格一份总结：成绩曲线（各赛段名次）、转会记录、董事会评价、关键战役与经营快照。</div>
 ${revs.length?revs.map((r,i)=>`<div class="match" style="margin-bottom:6px;padding:8px 10px;cursor:pointer" onclick="showYearReview(${i})">
 <div class="vs"><span class="tname" style="font-size:13px">${r.year} 年度回顾${r.stages.some(st=>st.place==='冠军')?' <span class="gold">冠军赛季</span>':''}</span>
 <div class="power" style="font-size:10px">年度积分 ${r.annualPts} · 联盟第 ${r.annualRank||'—'} 名 · ${r.transfers.length} 笔转会 · 信任度 ${r.board?r.board.trust:'—'}</div></div>
 <div class="score" style="font-size:12px;min-width:0">看回顾</div>
 </div>`).join(''):'<div class="hint">还没有年度回顾——完成一个完整年度（年总收官）后自动生成</div>'}
 </div>`;
 }
 // 成就（生涯里程碑：解锁一次永久入册，条件在 save 巡检中评估）
 {
 const ach=S.achieved||{};
 const got=ACHIEVEMENTS.filter(a=>ach[a.id]).length;
 html+=`<div class="panel"><h3>成就 <span class="tag">${got}/${ACHIEVEMENTS.length} 已解锁</span></h3>
 <div class="hint" style="margin-bottom:10px">经营生涯的里程碑：冠军、青训、转会、亚运……解锁时全队广播，集齐是对一段存档最好的总结</div>
 <div class="grid g4" style="gap:8px">${ACHIEVEMENTS.map(a=>{
 const yr=ach[a.id];
 return `<div class="pcard" style="min-height:0;padding:10px 12px;${yr?'border-color:var(--gold)':'opacity:.55'}" ${yr?'title="'+yr+' 年解锁"':'title="'+a.desc+'"'}>
 <div style="display:flex;align-items:center;gap:8px">
 <span class="s-icon" style="${yr?'':'background:var(--surface2);color:var(--faint)'}">${a.icon}</span>
 <div style="min-width:0"><div class="s-name" style="font-size:13px">${a.name}</div>
 <div class="s-desc" style="font-size:11px">${yr?'<span class="gold">'+yr+' 年解锁</span>':a.desc}</div></div>
 </div></div>`;
 }).join('')}</div>
 </div>`;
 }
 // 比赛复盘
 if(S.history&&S.history.length){
 html+=`<div class="panel"><h3>比赛复盘 <span class="tag">最近 ${S.history.length} 场</span></h3>
 ${S.history.slice(0,8).map((h,i)=>`<div class="match" style="margin-bottom:6px;padding:8px 10px;cursor:pointer" onclick="showReplay(S.history[${i}])">
 <div class="vs"><span class="tname" style="font-size:12px">${S.teamName} vs ${h.opp}</span><div class="power" style="font-size:10px">${h.stage}</div></div>
 <div class="score" style="font-size:13px;min-width:0">${h.win?'<span class="green">胜</span>':'<span class="red">负</span>'} ${h.score}</div>
 </div>`).join('')}
 <div class="hint">点击任意比赛回放逐局日志${S.history.some(h=>h.peak)?'（含巅峰对决）':''}</div>
 </div>`;
 }
 $('#page-biz').innerHTML=html;
}
function renderLineup(){
 const ls=rosterLineup(S),bn=rosterBench(S);
 const bonds=activeBonds(S);
 let html=`<div class="panel"><h3>首发阵容 <span class="tag">${POS_ORDER.length}人</span></h3>
 <div class="dim" style="font-size:12px;margin-bottom:10px">总战力 <b class="cyan">${fmt(teamPower(S))}</b> · 总身价 <b class="gold">${fmt(ls.reduce((t,p)=>t+sellAskPrice(p),0))}</b> · 士气均值 ${Math.round(ls.reduce((t,p)=>t+p.morale,0)/Math.max(1,ls.length))}% · 周薪合计 <b class="gold">${weeklyWage(S)}万</b></div>
 <div class="grid g5">${POS_ORDER.map(pos=>{
 const p=ls.find(x=>x.pos===pos);
 if(!p)return `<div class="pcard" style="border-style:dashed;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:12px;min-height:120px">${POS[pos][1]} ${POS[pos][0]}<br>空缺</div>`;
 return pcard(p,`<div style="display:flex;gap:6px"><button class="btn sm" style="flex:1" onclick="swapPlayer('${p.id}')">→ 换下</button><button class="btn sm ${S.captain===p.id?'gold':''}" style="flex:1" onclick="setCaptain('${p.id}')" title="队长在阵时全队战力+2%，任命时全队士气提升">${S.captain===p.id?'摘袖标':'任队长'}</button></div><button class="btn sm danger" style="width:100%;margin-top:6px" onclick="openSellNego(S,'${p.id}')"> 出售</button>`);
 }).join('')}</div></div>`;
 html+=`<div class="panel"><h3>替补席 <span class="tag">${bn.length}人</span></h3>
 ${bn.length?`<div class="grid g4">${bn.map(p=>pcard(p,`${p.kjia>0?`<div class="hint" style="margin-bottom:6px">K甲锻炼中 · 剩 ${p.kjia} 天</div>`:''}<button class="btn sm primary" onclick="swapPlayer('${p.id}')" ${p.kjia>0?'disabled':''}>↑ 放入首发</button><button class="btn sm danger mt8" onclick="openSellNego(S,'${p.id}')"> 出售（谈判）</button><button class="btn sm mt8" onclick="sendKjia('${p.id}')" title="下放 K甲 30 天：不占首发、不计出场，归队时属性成长" ${p.kjia>0?'disabled':''}> 下放 K甲</button>`)).join('')}</div>`:'<div class="hint">暂无替补，快去转会市场谈判补充阵容！</div>'}
 </div>`;
 // 战术板：选倾向 = 改四维权重（没有最优解，只有最适合阵容的解）；克制 ±3% 在比赛模拟处结算
 {
 const cur=tacticById(S.tactic||'balanced');
 html+=`<div class="panel"><h3>战术板 <span class="tag">当前：${cur.name}</span></h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${TACTICS.map(t=>`<button class="btn sm ${t.id===(S.tactic||'balanced')?'primary':''}" onclick="setTactic('${t.id}')" title="${t.desc}${t.beats?' · 克制「'+tacticById(t.beats).name+'」':''}">${t.name}</button>`).join('')}</div>
 <div class="hint">${cur.desc}${cur.beats?' · 克制「'+tacticById(cur.beats).name+'」、被「'+TACTICS.filter(t=>t.beats===cur.id).map(t=>t.name).join('/')+'」克制':''}。权重只作用在我方战力上（对手战术每场随机，赛前页可见克制结果）。</div>
 </div>`;
 }
 // 战队羁绊（上场选手触发，属于阵容维度）
 html+=`<div class="panel"><h3>战队羁绊 <span class="tag">同队上场生效</span></h3>`;
 if(bonds.length){
 html+=bonds.map(c=>`<div class="event-card"><div class="et">${c.desc}</div></div>`).join('');
 }else{
 html+=`<div class="hint">暂无生效羁绊。凑齐同队选手上场可触发战力加成（如 AG超玩会 / eStarPro / 重庆狼队 全阵容+12%，主播天团、XYG青训、三冠传奇等）</div>`;
 }
 html+=`</div>`;
 $('#page-lineup').innerHTML=html;
}
function swapPlayer(pid){
 const p=S.players.find(x=>x.id===pid);
 const inLineup=S.lineup.includes(pid);
 if(!inLineup&&p.kjia>0){toast(p.name+' 正在 K甲锻炼（剩余 '+p.kjia+' 天），暂不能进入首发');return;}
 if(!inLineup&&p.injury>0){toast(p.name+' 伤停中（还剩'+p.injury+'天），不能进入首发');return;}
 if(!inLineup&&typeof natCamping==='function'&&natCamping(S,p)){toast(p.name+' 正在国家队集训（缺席整个夏季赛），不能进入首发');return;}
 if(inLineup){
 // 有同位置替补则对位换人；没有也允许直接下场（位置空缺）——否则满员时卖不掉、工资帽腾不出，买不了新人的死锁
 const bn=rosterBench(S).filter(x=>x.pos===p.pos&&x.injury<=0); // 伤员不可顶替上场
 if(bn.length){
 S.lineup[S.lineup.indexOf(pid)]=bn[0].id;
 toast(`${p.name} 换下，${bn[0].name} 上场`);
 }else{
 S.lineup.splice(S.lineup.indexOf(pid),1);
 toast(`${p.name} 已下场（${POS[p.pos][0]}空缺）——可出售/挂牌后补人，开赛前该位置必须有人`);
 }
 }else{
 const cur=rosterLineup(S).find(x=>x.pos===p.pos);
 if(cur){S.lineup[S.lineup.indexOf(cur.id)]=pid;toast(`${cur.name} 换下，${p.name} 上场`);}
 else{S.lineup.push(pid);toast(`${p.name} 加入首发`);}
 }
 if(S.pick)delete S.pick[p.pos]; // 换人后该位置英雄需重新 BP
 save();renderAll();
}
function renderMarket(){
 const costOf=p=>Math.round(valueOf(overall(p))*(p.discount||1));
 // 教练区
 let coachHtml=`<div class="panel ${foldCls('mcoach')}" data-fold="mcoach"><h3>教练市场 <span class="tag">主教练决定全队战力</span></h3>`;
 if(S.coach){
 const c=S.coach;
 coachHtml+=`<div class="sponsor" style="border-color:var(--gold)">
 <span class="s-icon">教</span>
 <div><div class="s-name">${c.name} <span class="gold">(现任主教练)</span></div>
 <div class="s-desc">${c.rating||80}评分 · ${COACH_STYLE[c.style]}型 · ${c.skill.n}：${c.skill.d} · 周薪 ${c.wage}万</div></div>
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
 <div><div class="s-name">${a.name}</div><div class="s-desc">${a.rating||75}评分 · ${COACH_STYLE[a.style]}型 · ${a.skill.d} · 周薪 ${a.wage}万</div></div>
 <button class="btn sm danger" onclick="fireAssistant(S,'${a.id}')">解约</button>
 </div>`).join('')}</div>`
 :`<div class="hint" style="margin-bottom:8px">未聘助教——每名助教提供小额全队加成，与主教练叠加（买替补工资帽之外的第二处长期开销）</div>`;
 coachHtml+=`<div class="g3">${ASSISTANT_POOL.filter(a=>!(S.assistants||[]).some(x=>x.id===a.id)).map(a=>{
 const oc=ovrColor(a.rating||75);
 return `<div class="pcard ${ovrCls(a.rating||75)}" style="text-align:center">
 <div style="margin:6px 0;color:var(--faint)"></div>
 <div class="p-name" style="font-weight:800">${a.name}</div>
 <div class="p-rarity" style="color:${oc};letter-spacing:0">${a.rating}评分 · ${COACH_STYLE[a.style]}型</div>
 <div class="p-skill"> ${a.skill.d}</div>
 <div class="p-foot"><span>签约费 <b>${a.cost}万</b></span><span>周薪 <b>${a.wage}万</b></span></div>
 <button class="btn sm primary" onclick="hireAssistant(S,'${a.id}')" ${asCnt>=2?'disabled':''}>${asCnt>=2?'助教席已满':'聘为助教'}</button>
 </div>`;
 }).join('')}</div>`;
 if(S.coachMarket.length){
 coachHtml+=`<div class="g3">${S.coachMarket.map(c=>{
 const oc=ovrColor(c.rating||80);
 return `<div class="pcard ${ovrCls(c.rating||80)}" style="text-align:center">
 <div style="margin:6px 0;color:var(--faint)"></div>
 <div class="p-name" style="font-weight:800">${c.name}</div>
 <div class="p-rarity" style="color:${oc};letter-spacing:0">${c.rating||80}评分 · ${COACH_STYLE[c.style]}型</div>
 <div class="p-skill"> ${c.skill.n}<br><b style="font-size:10px">${c.skill.d}</b></div>
 <div class="attr" style="grid-template-columns:1fr;text-align:center;font-size:11px">
 <span>全队战力 <i style="color:var(--gold)">+${c.bonus}%</i></span>
 <span>${COACH_STYLE[c.style]}属性 <i style="color:var(--gold)">+${c.styleBonus}%</i></span>
 </div>
 <div class="p-foot"><span>签约费 <b>${c.cost}万</b></span><span>周薪 <b>${c.wage}万</b></span></div>
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
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(${POS[p.pos][0]} · 总值${overall(p)} · ${p.age}岁)</span></span>
 <div class="power" style="font-size:10px">${tag} · 周薪 ${p.wage}万 · 心理价位 ≈${renewAskWage(p,2)}万</div></div>
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
 const renewPanel=(expRows||earlyRows)?`<div class="panel ${foldCls('mrenew')}" data-fold="mrenew"><h3>合同续约 <span class="tag">年限 1-4 年可谈 · 报价定周薪</span></h3>
 <div class="hint" style="margin-bottom:8px">续约 = 谈判：选年限 + 出周薪报价，经纪人按心理价位博弈（长约溢价 / 老将抬价 / 三轮谈崩伤士气），签字费按年限递增。到期不处理将自动续约 1 年；「最后一年」可提前谈，拖到合同年有自由身离队风险。</div>
 ${expRows}${earlyRows}</div>`:'';
 const rows=(S.transferList||[]).map(p=>{
 const price=buyoutPrice(p);
 const unt=p.untouchable?(p.willingness>=75?`<span style="color:var(--red);font-weight:800">非卖 · 忠诚${p.willingness}</span>`:`<span style="color:var(--gold);font-weight:800">松动 · 意愿${p.willingness}</span>`):'';
 const wil=p.willingness>=60?'<span class="green">愿转会</span>':p.willingness>=30?'<span class="gold">犹豫中</span>':'<span class="red">拒绝加盟</span>';
 const btnHtml=p.untouchable
 ?`<button class="btn sm ${p.willingness<75?'gold':'primary'}" style="margin:0;min-width:64px" onclick="openNegotiation(S,'${p.id}')">强挖 ${Math.round(raidChance(p)*100)}%</button>`
 :`<button class="btn sm primary" style="margin:0;min-width:64px" onclick="openNegotiation(S,'${p.id}')" ${p.willingness<30?'disabled':''}>${p.willingness<30?'尝试谈判':'谈判'}</button>`;
 return `<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(${p.ownerTeam} · 总值${overall(p)}${p.age?' · '+p.age+'岁':''})</span></span>
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
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(总值${overall(p)} · 挂牌${item.price}万)</span></span></div>
 ${bid?`<div class="score" style="font-size:12px;min-width:0"> ${bid.team}<br>${bid.bid}万</div>
 <div style="display:flex;gap:4px"><button class="btn sm primary" style="margin:0" onclick="acceptBid(S,'${item.id}')">接受</button><button class="btn sm" style="margin:0" onclick="rejectBid(S,'${item.id}')">拒绝</button><button class="btn sm danger" style="margin:0" onclick="delistPlayer(S,'${item.id}')">撤牌</button></div>`
 :`<button class="btn sm danger" style="margin:0" onclick="delistPlayer(S,'${item.id}')">撤牌</button>`}
 </div>`;
 }).join('');
 transferHtml=renewPanel+`<div class="panel ${foldCls('mtransfer')}" data-fold="mtransfer"><h3>转会市场 <span class="tag">转会窗剩余 ${S.transferWindow} 天 · 31岁+退役</span></h3>
 <div class="hint" style="margin-bottom:8px">多轮谈判：报价需同时打动俱乐部（转会费）和选手（年薪）；非卖品溢价强挖有失败风险；生涯暮年选手（29岁+）买来即巅峰末期</div>
 <div style="max-height:340px;overflow-y:auto">${rows||'<div class="hint">转会市场暂无选手</div>'}</div>
 <div class="hint" style="margin:10px 0 6px">我的挂牌（AI 队会来报价，转会窗关闭未成交自动撤牌）：</div>
 <div>${listed||'<div class="hint">暂无挂牌选手——在下方"我的队员"中点"挂牌"</div>'}</div>
 </div>`;
 }else{
 transferHtml=`<div class="panel ${foldCls('mtransfer')}" data-fold="mtransfer"><h3>转会市场 <span class="tag">转会窗已关闭</span></h3>
 <div class="hint">KPL 转会窗在新赛季开启时开放 7 天：可买断其他俱乐部选手（非卖品除外）、挂牌交易、AI 竞价报价。非转会期可在下方租借市场临时租人。</div></div>`;
 }
 // 租借市场（非转会期唯一的人员流动）：向 AI 队租替补，21 天自动归队
 if(S.transferWindow<=0){
 const myLoans=(S.players||[]).filter(p=>p.loan);
 const cands=loanCandidates(S).slice(0,12);
 transferHtml+=`<div class="panel ${foldCls('mloan')}" data-fold="mloan"><h3>租借市场 <span class="tag">租期 ${LOAN_DAYS} 天 · 名额 ${myLoans.length}/2 · 到期自动归队</span></h3>
 <div class="hint" style="margin-bottom:8px">非转会期不能买卖，但可以租借：支付租金（身价 15%）即可租来应急/补位置，工资由原队承担；非卖品不外借，租借选手不能出售/挂牌。</div>
 ${myLoans.length?`<div style="margin-bottom:8px">${myLoans.map(p=>`<div class="match" style="margin-bottom:5px;padding:7px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${p.name} <span style="color:var(--dim);font-size:10px">(${POS[p.pos][0]} · 总值${overall(p)} · 来自${p.loan.from})</span></span></div>
 <div class="score" style="font-size:12px;min-width:0">剩余 <b class="gold">${p.loan.days}</b> 天</div>
 </div>`).join('')}</div>`:''}
 <div style="max-height:300px;overflow-y:auto">${cands.map(c=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${c.p.name} <span style="color:var(--dim);font-size:10px">(${c.from} · ${POS[c.p.pos][0]} · 总值${overall(c.p)} · ${c.p.age}岁)</span></span></div>
 <div class="score" style="font-size:13px;min-width:0">租金 ${c.rent}万</div>
 <button class="btn sm primary" style="margin:0;min-width:64px" onclick="loanPlayer(S,'${c.from}','${c.p.id}')">租借 21天</button>
 </div>`).join('')||'<div class="hint">联盟暂无可租借的选手</div>'}</div>
 </div>`;
 }
 // 自由球员与退役名宿：始终可见（不依赖转会窗）→ 侧栏
 sideHtml+=`<div class="panel ${foldCls('mfa')}" data-fold="mfa"><h3>自由球员 <span class="tag">各队无球可打的替补 · 低价直签</span></h3>
 <div class="hint" style="margin-bottom:8px">26 年自由市场：合同到期的 KPL 选手轮换上架（签一人少一人），谈薪资直签；不足时由无球可打的替补补位</div>
 ${(S.freeAgents||[]).map(p=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
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
 const marketPanel=`<div class="panel ${foldCls('mmarket')}" data-fold="mmarket"><h3>自由市场 <span class="tag">${S.transferWindow>0?'转会窗开启·刷新免费·顶星增加':'刷新需5万/次'} · 每日特惠</span></h3>
 <div class="hint" style="margin-bottom:10px">签约费按总值实时定价：总值 90+ ≈ 260万 / 80 ≈ 140万 / 70 ≈ 70万，特惠选手 8 折。${S.marketRefreshed?'本日已刷新过（次日自动重置）':'今日尚未刷新'}</div>
 <div class="g2">${S.market.map(p=>{
 const c=costOf(p);
 return pcard(p,`<button class="btn sm primary" onclick="buyPlayer(S,S.market.find(x=>x.id==='${p.id}'))">签约 ${p.discount?`<s style="color:var(--dim)">${valueOf(overall(p))}万</s> ${c}万`:c+'万'}</button>`);
 }).join('')||'<div class="hint">市场空空如也，刷新一下吧</div>'}</div>
 <button class="btn mt12" onclick="refreshMarket(S)"> 刷新市场${S.transferWindow>0?'（转会期内免费）':'（5万）'}</button>
 </div>`;
 const minePanel=`<div class="panel ${foldCls('mine')}" data-fold="mine"><h3>我的队员</h3>
 ${S.players.length?`<div class="grid g4">${S.players.filter(p=>!S.lineup.includes(p.id)).map(p=>{const listed=(S.listed||[]).some(x=>x.id===p.id);
 return pcard(p,`<button class="btn sm primary" onclick="swapPlayer('${p.id}')">↑ 放入首发</button><div style="display:flex;gap:6px;margin-top:8px">${listed
 ?`<button class="btn sm danger" style="flex:1" onclick="delistPlayer(S,'${p.id}')">撤牌</button>`
 :`<button class="btn sm danger" style="flex:1" onclick="openSellNego(S,'${p.id}')"> 出售</button><button class="btn sm" style="flex:1" onclick="listPlayer(S,'${p.id}')"> 挂牌</button>`}</div>`);}).join('')||'<div class="hint">全部队员都在首发阵容中</div>'}</div>`:'<div class="hint">还没有队员</div>'}
 </div>`;
 $('#page-market').innerHTML='<div class="page-cols"><div class="col">'+coachHtml+transferHtml+minePanel+'</div><div class="col">'+sideHtml+marketPanel+'</div></div>';
}
function renderTrain(){
 let html=`<div class="panel"><h3>选手训练 <span class="tag">每天限1次 · 属性8万 / 英雄特训15万</span></h3>
 <div class="hint" style="margin-bottom:12px">${S.trained?'今日已完成训练，明日再来':'选择选手：练属性提升战力，或英雄特训扩充英雄池（全局BP下英雄池越深越稳）'}</div>
 ${S.players.length?`<div class="grid g4">${S.players.map(p=>pcard(p,`<div class="g2" style="gap:6px">
 ${TRAIN_ITEMS.map(t=>`<button class="btn sm" onclick="doTrain(S,'${p.id}','${t.k}')" ${S.trained||p.energy<10?'disabled':''}>${t.n}+1~2</button>`).join('')}
 <button class="btn sm gold" onclick="doHeroTrain(S,'${p.id}')" ${S.trained||p.energy<15||(p.heroPool||[]).length>=80?'disabled':''}>英雄特训 ${(p.heroPool||[]).length}/80</button>
 </div>`)).join('')}</div>`:'<div class="hint">没有选手可训练</div>'}
 </div>`;
 // 青训营
 const aca=S.academy||[];
 const acaHtml=aca.map(r=>{
 const total=['lane','farm','team','mind'].reduce((t,k)=>t+r.attrs[k],0);
 const ready=total>=300,adult=r.age>=18;
 return `<div class="pcard" style="border-color:${ready&&adult?'var(--green)':'var(--line)'}">
 <div class="p-top"><span class="p-name">${r.name}<span class="p-tag">青训</span></span><span class="p-pos">${POS[r.pos][0]} ${POS[r.pos][1]}</span></div>
 <div class="p-rarity" style="letter-spacing:0">总值${overall(r)} · ${r.age}岁 · 潜力${'★'.repeat(r.potential)} · 周薪${r.wage}万</div>
 <div class="attr" style="margin-top:6px">
 <span>对线<i>${r.attrs.lane}</i></span><span>运营<i>${r.attrs.farm}</i></span>
 <span>团战<i>${r.attrs.team}</i></span><span>心态<i>${r.attrs.mind}</i></span>
 </div>
 <div class="p-foot"><span>四维 <b class="${ready?'green':'gold'}">${total}/300</b></span><span> ${r.sig}</span></div>
 <div style="display:flex;gap:6px;margin-top:8px">
 <button class="btn sm" style="flex:1" onclick="trainRookie(S,'${r.id}')" ${S.academyTrained?'disabled':''}>培养 10万</button>
 <button class="btn sm primary" style="flex:1" onclick="promoteRookie(S,'${r.id}')" ${ready&&adult?'':'disabled'}>${ready&&adult?' 晋升一线':(ready?'未满18岁':'未达标')}</button>
 </div>
 <div class="hint" style="margin-top:6px">${S.academyTrained?'今日已培养过青训':'培养：潜力越高成长越快'}</div>
 </div>`;
 }).join('');
 html+=`<div class="panel"><h3>青训营 <span class="tag">低薪高潜 · 工资帽友好</span></h3>
 <div class="hint" style="margin-bottom:10px">招募新秀（30万）→ 每日培养（10万，潜力越高成长越快）→ 四维总和 ≥300 晋升一线队。青训选手周薪仅 2-4万，是工资帽下的经济型补强。</div>
 <button class="btn gold sm" onclick="recruitRookie(S)"> 招募新秀（30万）</button>
 <div class="grid g4" style="margin-top:12px">${acaHtml||'<div class="hint">青训营空无一人，先招募一名新秀吧</div>'}</div>
 </div>`;
 // 位置改造
 const convOpts=S.players.map(p=>`<option value="${p.id}">${p.name}（${POS[p.pos][0]} · ${p.age}岁）</option>`).join('');
 const posOpts=POS_ORDER.map(pos=>`<option value="${pos}">${POS[pos][0]}</option>`).join('');
 html+=`<div class="panel"><h3>位置改造 <span class="tag">30万 · 重构英雄池</span></h3>
 <div class="hint" style="margin-bottom:10px">职业选手可以转型换位：属性保留，新位置英雄池重构（两位置通用英雄保留熟练度，招牌不通用则重立）。用于解决退役/转会造成的位置断档。</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
 <select id="conv-player" class="hd-in" style="padding:8px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--line);color:var(--txt)">${convOpts}</select>
 <span style="color:var(--faint)">→</span>
 <select id="conv-pos" class="hd-in" style="padding:8px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--line);color:var(--txt)">${posOpts}</select>
 <button class="btn sm primary" onclick="doConvertPos()">确认改造（30万）</button>
 </div>
 </div>`;
 $('#page-train').innerHTML=html;
}
function renderLeague(){
 const groups=phaseGroups(S);
 const myG=myGroup(S);
 let html=`<div class="panel"><h3>${splitLabel(S)} · ${PHASE_NAME[S.phase]||S.phase} <span class="tag">KPL 官方赛制 · 18队 S/A/B</span></h3>
 <div class="hint" style="margin-bottom:8px">常规赛 BO5 全局BP · 胜者积1分 · 第一轮各组前2进S组 / 3-4进A组 / 5-6进B组 · 卡位赛 BO7 含巅峰对决 · 季后赛 10队双败 · 年度赛历：春季赛 → EWC → 夏季赛 → 年度总决赛</div></div>`;
 // 年度积分榜（春夏累计，前12进年度总决赛）——带条形刻度
 {
 const rank=annualRank(S);
 const myIdx=rank.indexOf(S.teamName);
 const maxPts=Math.max(1,...rank.slice(0,12).map(t=>S.annualPts[t]||0));
 html+=`<div class="panel"><h3>年度积分榜 <span class="tag">${gameYear(S)} · 前 12 进年度总决赛</span></h3>
 <table class="tbl"><tr><th>#</th><th>战队</th><th style="width:46%">年度积分</th></tr>
 ${rank.slice(0,12).map((t,i)=>`<tr class="${t===S.teamName?'me':''}"><td>${i+1}</td><td>${crest((AI_TEAMS.find(x=>x.name===t)||{}).icon||(t===S.teamName?S.icon:'队'),t,18)} ${t}${t===S.teamName?' ★':''}</td><td class="gold">${S.annualPts[t]||0}<div class="pts-bar"><i style="width:${Math.round((S.annualPts[t]||0)/maxPts*100)}%"></i></div></td></tr>`).join('')}
 </table>
 <div class="hint mt8">${myIdx>=0&&myIdx<12?'你队第 '+(myIdx+1)+' 名，'+(myIdx<6?'大师组':'精英组')+'席位在握':(myIdx>=12?'你队第 '+(myIdx+1)+' 名，无缘年度总决赛——春夏赛季继续攒分':'春季赛打完后积分入账')} · 春季冠+100 夏季冠+120</div>
 </div>`;
 }
 // 各组积分榜
 groups.forEach(g=>{
 const rank=sortGroup(S,g);
 const isMy=g===myG;
 html+=`<div class="panel"><h3>${g} 组 ${isMy?'<span class="tag" style="background:rgba(0,212,255,.15)">本队所在组</span>':''}</h3>
 <table class="tbl"><tr><th>#</th><th>战队</th><th>胜</th><th>负</th><th>积分</th><th>净胜局</th><th>战力</th></tr>
 ${rank.map((n,i)=>{
 const t=(S.tables[g]||{})[n]||{w:0,l:0,pts:0,pw:0};
 return `<tr class="${n===S.teamName?'me':''}"><td>${i+1}</td><td>${crest((AI_TEAMS.find(x=>x.name===n)||{}).icon||(n===S.teamName?S.icon:'队'),n,18)} ${n}${n===S.teamName?' ★':''}</td><td>${t.w}</td><td>${t.l}</td><td>${t.pts}</td><td>${t.pw}</td><td>${fmt(powerOf(S,n))}</td></tr>`;
 }).join('')}
 </table>
 ${(S.aiSchedule&&S.aiSchedule[g]||[]).filter(m=>m.r).slice(-6).reverse().map(m=>
 `<div class="match" style="margin-bottom:5px;padding:7px 10px">
 <div class="vs"><span class="tname" style="font-size:12px">${m.a}</span></div>
 <div class="score" style="font-size:13px;min-width:40px">${m.r.mw}:${m.r.ow}</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span class="tname" style="font-size:12px">${m.b}</span></div>
 </div>`).join('')||'<div class="hint" style="margin-top:8px">暂无赛果——你每打完一轮，同轮其他场次就会开打</div>'}
 </div>`;
 });
 // 淘汰名单
 if(S.eliminated&&S.eliminated.length){
 html+=`<div class="panel"><h3>已淘汰</h3><div class="hint">${S.eliminated.join('、')}</div></div>`;
 }
 // 赛程
 if(S.schedule&&S.schedule.length){
 html+=`<div class="panel"><h3>本队赛程（${PHASE_NAME[S.phase]}）</h3>${S.schedule.map(m=>{
 const cls=m.result==='W'?'win':m.result==='L'?'lose':'';
 const isNext=m===S.schedule[S.matchIdx];
 const oppIcon=(AI_TEAMS.find(t=>t.name===m.opp)||{}).icon||'剑';
 return `<div class="match ${cls}" ${isNext?'style="border-color:var(--cyan)"':''}>
 <div class="vs"><div class="tname">${S.teamName}</div><div class="power">战力 ${fmt(teamPower(S))}</div></div>
 <div class="score" style="font-size:14px">${m.result?`${m.myScore}:${m.opScore}`:(isNext?' 下一场':'待赛')}</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><div class="tname">${crest(oppIcon,m.opp,18)} ${m.opp}</div><div class="power">战力 ${fmt(powerOf(S,m.opp))}</div></div>
 </div>`;
 }).join('')}</div>`;
 }
 // 卡位赛对阵（联赛页）
 if(S.phase==='card'&&S.card){
 html+=`<div class="panel"><h3>卡位赛对阵 <span class="tag">BO7 · 含巅峰对决</span></h3>
 ${S.card.matches.map(m=>{
 const me=m.a===S.teamName||m.b===S.teamName;
 return `<div class="match" style="margin-bottom:6px">
 <div class="vs"><span class="tname" style="font-size:12px">${m.a} ${me&&m.a===S.teamName?'★':''}</span></div>
 <div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span class="tname" style="font-size:12px">${m.b} ${me&&m.b===S.teamName?'★':''}</span></div></div>`;
 }).join('')}
 <div class="hint">S5 vs A2、S6 vs A1 胜者升S组；A5 vs B2、A6 vs B1 胜者进A组（B组全淘汰）</div>
 </div>`;
 }
 // 季后赛 bracket
 if(S.phase==='playoff'&&S.playoff){
 const pf=S.playoff;
 const pMatch=(m,label)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:12px">${label}：${m.a||'?'} vs ${m.b||'?'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 html+=`<div class="panel"><h3>季后赛对阵（BO7 双败 · 第7局巅峰对决）</h3>
 ${pf.wb.map((m,i)=>pMatch(m,'胜者组R'+(i+1))).join('')}
 ${pMatch(pf.wf,'胜者组决赛')}
 ${pf.lb.map((m,i)=>pMatch(m,'败者组R'+(i+1))).join('')}
 ${pf.lb2.map((m,i)=>pMatch(m,'败者组R2'+(i?'·2':'·1'))).join('')}
 ${pf.lb3.map((m,i)=>pMatch(m,'败者组R3'+(i?'·2':'·1'))).join('')}
 ${pMatch(pf.lb4,'败者组半决赛')}
 ${pMatch(pf.lbf,'败者组决赛')}
 ${pMatch(pf.final,' 总决赛')}
 </div>`;
 }
 $('#page-league').innerHTML=html;
}
/* ================= 二队页（K甲联赛完整版：独立赛程 + 积分榜 + 下放选手表现数据） =================
 K甲与 KPL 赛段并行推进：每 2 天一轮（nextDay 结算），下放选手真实出战。
 引擎在 season.js「K甲联赛」区段；本页只读 s.kjia 与 p.kjiaStats/kjiaLog 渲染。 */
function renderKjia(){
 if(!S.kjia)initKjia(S); // 旧档/新档懒初始化（首次点进二队页就能看到整届联赛）
 const k=S.kjia,my=k.my||kjiaMyName(S);
 const rank=kjiaRank(S);
 const myRank=rank.indexOf(my)+1;
 const done=k.rd>=k.rounds.length;
 const next=done?null:k.rounds[k.rd].find(m=>m.a===my||m.b===my);
 let html=`<div class="panel"><h3>K甲联赛 · 二队 <span class="tag">${gameYear(S)} ${SPLIT_NAME[S.split]||'春季赛'} · ${done?'已收官':'第'+(k.rd+1)+'/'+k.rounds.length+'轮'} · 每${KJIA_EVERY}天一轮</span></h3>
 <div class="hint">次级联赛与 KPL 赛段并行推进：阵容页「下放 K甲」把替补/青训送进二队真实出战（不占首发、不计 KPL 出场），表现数据在本页累计；下放中不可交易，归队时带属性成长。每赛段重开一届。</div></div>`;
 // 二队概况 + 下一场
 const demoted=(S.players||[]).filter(p=>p.kjia>0);
 html+=`<div class="panel"><h3>二队概况 <span class="tag">${crest(S.icon,my,18)} ${my} · 战力 ${fmt(kjiaTeamPower(S))} · 联赛第${myRank||'—'}名 · 下放选手 ${demoted.length} 人</span></h3>`;
 if(next){
 const opp=next.a===my?next.b:next.a;
 html+=`<div class="match" style="border-color:var(--cyan)">
 <div class="vs"><div class="tname">${my}</div><div class="power">战力 ${fmt(kjiaTeamPower(S))}</div></div>
 <div class="score" style="font-size:13px"> 下一场 · 第${k.rd+1}轮</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><div class="tname">${opp}</div><div class="power">战力 ${fmt(k.powers[opp]||0)}</div></div>
 </div>`;
 }else{
 html+=`<div class="hint">本赛段 K甲已收官：冠军 <b class="gold">${k.champ||'—'}</b>——推进赛段后重开新一届</div>`;
 }
 html+=`</div>`;
 // 积分榜
 html+=`<div class="panel"><h3>K甲积分榜 <span class="tag">8队单循环 · 胜者积1分</span></h3>
 <table class="tbl"><tr><th>#</th><th>战队</th><th>胜</th><th>负</th><th>积分</th><th>净胜局</th><th>战力</th></tr>
 ${rank.map((n,i)=>{
 const t=k.tables[n]||{w:0,l:0,pts:0,pw:0};
 const isMy=n===my;
 const pw=n===my?kjiaTeamPower(S):(k.powers[n]||0);
 return `<tr class="${isMy?'me':''}"><td>${i+1}</td><td>${isMy?'<b>'+n+' ★</b>':n}</td><td>${t.w}</td><td>${t.l}</td><td>${t.pts}</td><td>${t.pw}</td><td>${fmt(pw)}</td></tr>`;
 }).join('')}</table></div>`;
 // 赛程与赛果（全 7 轮）
 html+=`<div class="panel"><h3>赛程与赛果 <span class="tag">单循环 7 轮</span></h3>
 ${k.rounds.map((rd,ri)=>{
 const isCur=ri===k.rd&&!done;
 return `<div class="hint" style="margin:8px 0 4px;font-weight:700;color:${isCur?'var(--cyan)':'var(--dim)'}">第${ri+1}轮${ri<k.rd?'（已赛）':isCur?'（进行中）':''}</div>`
 +rd.map(m=>{
 const played=!!m.r;
 const me=m.a===my||m.b===my;
 const myWon=played&&m.r===my;
 return `<div class="match ${played?(me?(myWon?'win':'lose'):''):''}" style="padding:7px 10px;margin-bottom:4px;${isCur&&!played?'border-color:var(--cyan)':''}">
 <div class="vs"><span class="tname" style="font-size:12px">${m.a}${m.a===my?' ★':''}</span></div>
 <div class="score" style="font-size:13px">${played?m.ms+':'+m.es:(isCur?'待赛':'—')}</div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span class="tname" style="font-size:12px">${m.b}${m.b===my?' ★':''}</span></div>
 </div>`;
 }).join('');
 }).join('')}</div>`;
 // 下放选手表现数据（本系统核心：练级看得见）
 html+=`<div class="panel"><h3>下放选手表现 <span class="tag">K甲累计数据 · 场上好表现有即时成长</span></h3>`;
 if(demoted.length){
 html+=`<table class="tbl"><tr><th>选手</th><th>位置</th><th>出场</th><th>场均KDA</th><th>MVP</th><th>胜率</th><th>累计成长</th></tr>
 ${demoted.map(p=>{
 const st=p.kjiaStats||{apps:0,k:0,d:0,a:0,mvp:0,wins:0};
 const avg=st.apps?[st.k,st.d,st.a].map(x=>Math.round(x/st.apps*10)/10).join('/'):'—';
 const wr=st.apps?Math.round(st.wins/st.apps*100)+'%':'—';
 return `<tr><td><b>${p.name}</b></td><td>${POS[p.pos][1]}</td><td>${st.apps}</td><td>${avg}</td><td>${st.mvp||0}</td><td>${wr}</td><td class="gold">+${p.kjiaGain||0}</td></tr>`;
 }).join('')}</table>
 <div class="grid g4" style="margin-top:10px">${demoted.map(p=>pcard(p,`<div class="hint" style="margin-top:6px">${(p.kjiaLog||[]).slice(0,3).map(l=>_escTxt(l)).join('<br>')||'尚未出战'}</div>`)).join('')}</div>`;
 }else{
 html+=`<div class="hint">暂无下放选手——「阵容」页替补卡上有「下放 K甲」按钮。下放 30 天：二队每场为选手结算 KDA/MVP，赢球有小概率即时 +1 属性，归队时再结算一笔成长。</div>`;
 }
 html+=`</div>`;
 // 二队班底（K甲注册选手）
 html+=`<div class="panel"><h3>二队班底 <span class="tag">K甲注册选手 · 每赛段调整 · 下放的一队选手顶替出场</span></h3>
 <div class="grid g4">${k.squad.map(p=>pcard(p,'')).join('')}</div></div>`;
 $('#page-kjia').innerHTML=html;
}
/* ================= 联盟页（战队总览 / 阵容浏览 / 选手榜单） ================= */
function unionTeams(){
 const names=(S.leagueTeams&&S.leagueTeams.length)?S.leagueTeams.slice():AI_TEAMS.map(t=>t.name);
 const teams=[];
 names.forEach(n=>{
 if(n===S.teamName){
 teams.push({name:n,mine:true,icon:S.icon,roster:S.players.slice(),power:teamPower(S)});
 }else{
 const t=AI_TEAMS.find(x=>x.name===n);
 const r=ensureAiRosters(S,n)||[];
 teams.push({name:n,mine:false,icon:t?t.icon:'剑',roster:r,power:aiRosterPower(r,S,n)});
 }
 });
 return teams;
}
function setUnionMode(m){window._unionMode=m;renderUnion();}
/* ================= 历代联盟：真实 KPL 史册（据公开赛事报道整理） + 本存档征战史 ================= */
function renderUnionHistory(){
 const H=KPL_HISTORY;
 // FMVP 累计榜：由历届表实时汇总，不需要单独维护
 const fmvpCnt={};
 H.seasons.concat(H.finals,H.cups).forEach(r=>{if(r.fmvp)fmvpCnt[r.fmvp]=(fmvpCnt[r.fmvp]||0)+1;});
 const fmvpTop=Object.keys(fmvpCnt).map(n=>({n,c:fmvpCnt[n]})).sort((a,b)=>b.c-a.c||a.n.localeCompare(b.n)).slice(0,8);
 const champCell=n=>n?crest('队',n,18)+' <b>'+n+'</b>':'—';
 let html=`<div class="panel"><h3>历代联盟 <span class="tag">KPL 2016-2026 · 据公开赛事报道整理</span></h3>
 <div class="hint">十年联盟史：${H.seasons.length} 届联赛、${H.finals.length} 届年度总决赛、${H.cups.length} 座杯赛，数据更新至 2026 年挑战者杯。</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" onclick="setUnionMode('now')">← 返回联盟现况</button>
 <button class="btn gold sm" onclick="gotoEraStart()">▶ 选一个时代重新开档体验（2017 QG王朝 / 2019 双冠与信仰）</button></div></div>`;
 const champRow=(r,evCol)=>`<tr><td>${r.y}</td>${evCol?`<td>${r.ev}</td>`:''}<td>${champCell(r.champ)}</td><td>${r.ru?crest('队',r.ru,18)+' '+r.ru:'—'}</td><td class="gold">${r.score||'—'}</td><td>${r.fmvp||'—'}</td><td style="font-size:11px;color:var(--dim)">${r.note||''}</td></tr>`;
 html+=`<div class="panel"><h3>历届联赛冠军 <span class="tag">银龙杯</span></h3>
 <table class="tbl"><tr><th>赛季</th><th>冠军</th><th>亚军</th><th>决赛比分</th><th>FMVP</th><th>注</th></tr>
 ${H.seasons.map(r=>champRow(r,false)).join('')}</table></div>`;
 html+=`<div class="panel"><h3>年度总决赛 <span class="tag">圣龙杯 · 2024 年起</span></h3>
 <table class="tbl"><tr><th>年份</th><th>冠军</th><th>亚军</th><th>决赛比分</th><th>FMVP</th><th>注</th></tr>
 ${H.finals.map(r=>champRow(r,false)).join('')}</table></div>`;
 html+=`<div class="panel"><h3>历届杯赛 <span class="tag">冠军杯 · 世界冠军杯 · 冬冠 · 挑战者杯</span></h3>
 <table class="tbl"><tr><th>年份</th><th>赛事</th><th>冠军</th><th>亚军</th><th>决赛比分</th><th>FMVP</th><th>注</th></tr>
 ${H.cups.map(r=>champRow(r,true)).join('')}</table></div>`;
 html+=`<div class="panel"><h3>FMVP 榜 <span class="tag">历届总决赛 MVP · 按次数</span></h3>
 <div style="display:flex;gap:8px;flex-wrap:wrap">${fmvpTop.map((f,i)=>`<span class="tag" style="padding:6px 10px"><b class="${i===0?'gold':''}">${f.n}</b> × ${f.c}</span>`).join('')}</div>
 <div class="hint mt8">由上方历届表实时汇总——Fly 六夺 FMVP 位列历史第一。</div></div>`;
 html+=`<div class="panel"><h3>王朝时代</h3>
 <div class="grid g2">${H.dynasties.map(d=>`<div style="border:1px solid var(--line);border-radius:4px;padding:10px">
 <div style="display:flex;align-items:center;gap:8px">${crest('队',d.t,20)} <b>${d.n}</b><span class="tag" style="margin-left:auto">${d.y}</span></div>
 <div class="hint" style="margin-top:6px">${d.d}</div></div>`).join('')}</div></div>`;
 html+=`<div class="panel"><h3>联盟版图变迁</h3>
 ${H.eras.map(e=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
 <div><b class="cyan">${e.t}</b> <span class="tag">${e.y}</span></div>
 <div class="hint" style="margin-top:4px">${e.d}</div></div>`).join('')}</div>`;
 html+=`<div class="panel"><h3>名队沿革 <span class="tag">含已离开联盟的队伍</span></h3>
 <table class="tbl"><tr><th>战队</th><th>征战时期</th><th>沿革</th></tr>
 ${H.clubs.map(c=>`<tr><td>${crest('队',c.n,18)} <b>${c.n}</b></td><td style="white-space:nowrap;color:var(--dim)">${c.era}</td><td style="font-size:11px">${c.d}</td></tr>`).join('')}</table></div>`;
 // 本存档征战史：你治下的联盟正在书写的「历代」
 const th=(S.titleHistory||[]).slice(),fh=S.fmvpHonor||[];
 let myHtml='';
 if(th.length){
  myHtml=`<table class="tbl"><tr><th>年份</th><th>赛事</th><th>冠军</th></tr>
  ${th.map(t=>`<tr class="${t.champ===S.teamName?'me':''}"><td>第${t.season||S.season||1}年</td><td>${t.event||'—'}</td><td>${t.champ===S.teamName?'<b class="gold">'+_escTxt(t.champ)+'（你）</b>':crest('队',t.champ,18)+' '+t.champ}</td></tr>`).join('')}</table>`;
 }else{
  myHtml='<div class="hint">尚无征战记录——开启新赛季后，你经历的每一届赛事冠军都会收录于此。</div>';
 }
 if(fh.length){
  myHtml+=`<div class="hint" style="margin-top:8px">历届 FMVP：${fh.slice(0,6).map(f=>_escTxt(f.year+' '+f.event+' '+f.name+'（'+f.team+'）')).join('　｜　')}</div>`;
 }
 html+=`<div class="panel"><h3>本存档征战史 <span class="tag">你的联盟 · 历届冠军</span></h3>${myHtml}
 <div class="hint mt8">上方史册记录的是现实 KPL 2016-2026；这里记录的是你治下联盟正在书写的历代。</div></div>`;
 return html;
}
function renderUnion(){
 if((window._unionMode||'now')==='hist'){$('#page-union').innerHTML=renderUnionHistory();return;}
 const teams=unionTeams().sort((a,b)=>b.power-a.power);
 let html=`<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn sm" onclick="setUnionMode('hist')">历代联盟 →</button></div>`+
 `<div class="panel"><h3>战队总览 <span class="tag">18 队 · 点击查看阵容</span></h3>
 <table class="tbl"><tr><th>#</th><th>战队</th><th>总战力</th><th>平均总值</th><th>核心选手</th><th>战绩</th></tr>
 ${teams.map((t,i)=>{
 const avg=t.roster.length?Math.round(t.roster.reduce((a,p)=>a+overall(p),0)/t.roster.length):0;
 const core=t.roster.slice().sort((a,b)=>overall(b)-overall(a))[0];
 const dst=dynastyStreak(S,t.name); // 连冠王朝标记
 let rec='—'; // 当前阶段积分表（r1/r2/r3 各自重置）
 Object.keys(S.tables||{}).forEach(g=>{
 if(rec!=='—')return;
 const row=(S.tables[g]||{})[t.name];
 if(row)rec=row.w+'胜'+row.l+'负 · '+row.pts+'分';
 });
 return `<tr class="${t.mine?'me':''}" style="cursor:pointer" onclick="showSquad('${t.name}')">
 <td>${i+1}</td><td>${crest(t.icon,t.name,18)} ${t.name}${t.mine?' ★':''}${dst?` <span class="tag" style="color:var(--gold)">${dst}连冠</span>`:''}</td>
 <td><b class="cyan">${fmt(t.power)}</b></td><td>${avg}</td>
 <td>${core?core.name+' <b style="color:'+ovrColor(overall(core))+'">'+overall(core)+'</b>':'—'}</td>
 <td style="font-size:11px">${rec}</td></tr>`;
 }).join('')}</table>
 <div class="hint mt8">总战力=五位置最强结算（与比赛同刻度）· 核心选手=全队总值最高者 · 战绩为当前阶段积分表</div></div>`;
 // 个人榜（tab 切换，TOP15）
 const tab=window._unionTab||'ovr';
 const TABS=[{k:'ovr',n:'总值榜'},{k:'value',n:'身价榜'},{k:'pop',n:'人气榜'},{k:'young',n:'新星榜 U21'}];
 const all=teams.flatMap(t=>t.roster.map(p=>Object.assign({},p,{_team:t.name,_mine:t.mine})));
 let list=all.slice();
 if(tab==='ovr')list.sort((a,b)=>overall(b)-overall(a));
 else if(tab==='value')list.sort((a,b)=>sellAskPrice(b)-sellAskPrice(a)); // 身价含状态浮动（火热/低迷）
 else if(tab==='pop')list.sort((a,b)=>(b.popularity||0)-(a.popularity||0)||overall(b)-overall(a));
 else if(tab==='young')list=list.filter(p=>(p.age||99)<=20).sort((a,b)=>overall(b)-overall(a));
 list=list.slice(0,15);
 const lastTh=tab==='pop'?'人气':tab==='young'?'年龄 / 潜力':'身价';
 const metric=p=>{
 if(tab==='pop')return p.popularity||0;
 if(tab==='young')return (p.age||'?')+'岁'+(p.potential?' · '+'★'.repeat(p.potential):'');
 return fmtWan(sellAskPrice(p));
 };
 html+=`<div class="panel"><h3>选手榜单 <span class="tag">全联盟注册选手 TOP15</span></h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${TABS.map(t=>`<button class="btn sm ${tab===t.k?'primary':''}" onclick="window._unionTab='${t.k}';renderUnion()">${t.n}</button>`).join('')}</div>
 <table class="tbl"><tr><th>#</th><th>选手</th><th>战队</th><th>总值</th><th>战力</th><th>${lastTh}</th></tr>
 ${list.map((p,i)=>`<tr class="${p._mine?'me':''}"><td>${i+1}</td>
 <td><b>${p.name}</b> <span class="tag">${POS[p.pos][1]}</span></td>
 <td style="font-size:11px;color:var(--dim)">${p._team}</td>
 <td><b style="color:${ovrColor(overall(p))}">${overall(p)}</b></td>
 <td>${fmt(playerPower(p,p.sig))}</td>
 <td>${metric(p)}</td></tr>`).join('')}</table></div>`;
 // 赛季最佳阵容（实时评选 + 历届入册）
 const as=allStarTeams(S);
 const asRow=(x,gold)=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
 <span class="tag" style="min-width:38px;text-align:center">${POS[x.p.pos][1]}</span>
 <b style="font-size:12px;min-width:58px">${x.p.name}</b>
 <span style="font-size:11px;color:var(--dim)">${x.team}</span>
 <b style="margin-left:auto;color:${gold?'var(--gold)':'var(--dim)'};font-size:11px">评分 ${overall(x.p)} <span style="font-weight:600;color:${(x.p.val||100)>=110?'var(--green)':(x.p.val||100)<90?'var(--red)':'var(--faint)'}">${perfLabel(x.p)}</span></b></div>`;
 html+=`<div class="panel"><h3>赛季最佳阵容 <span class="tag">按位置评选 · 实时</span></h3>
 <div style="display:flex;gap:16px;flex-wrap:wrap">
 <div style="flex:1;min-width:220px"><div class="gold" style="font-weight:800;margin-bottom:4px"> 一阵</div>${as.t1.map(x=>asRow(x,true)).join('')}</div>
 <div style="flex:1;min-width:220px"><div style="font-weight:800;margin-bottom:4px;color:var(--dim)"> 二阵</div>${as.t2.map(x=>asRow(x,false)).join('')}</div>
 </div>
 ${(S.awards||[]).length?`<div class="hint" style="margin-top:8px">历届一阵：${S.awards.map(a=>'S'+a.season+' '+a.first.map(f=>f.name).join('/')).join('　｜　')}</div>`:''}
 <div class="hint mt8">评分=选手总值 OVR（1-99，与卡面/教练同刻度）；评选排序按 招牌战力×状态（表现火热可越级入选）· 开启新赛季时评出并公告入册</div></div>`;
 $('#page-union').innerHTML=html;
}
/* 战队阵容弹窗：本队=注册名单（含替补），AI 队=当前真实阵容 */
function showSquad(teamName){
 const mine=teamName===S.teamName;
 let icon='剑',roster=[];
 if(mine){icon=S.icon;roster=S.players.slice();}
 else{
 const t=AI_TEAMS.find(x=>x.name===teamName);
 icon=t?t.icon:'剑';
 roster=ensureAiRosters(S,teamName)||[];
 }
 const ls=mine?rosterLineup(S):[];
 const rows=roster.slice().sort((a,b)=>overall(b)-overall(a)).map(p=>{
 const starter=ls.some(x=>x.id===p.id);
 return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--line)">
 <span class="tag" style="min-width:40px;text-align:center">${POS[p.pos]?POS[p.pos][1]:'?'}</span>
 <b style="font-size:13px;min-width:60px">${p.name}</b>
 <b style="color:${ovrColor(overall(p))};font-size:15px;min-width:28px">${overall(p)}</b>
 <span style="font-size:11px;color:var(--dim)">战力 ${playerPower(p,p.sig)} · ${p.age||'?'}岁 · 招牌 ${p.sig||'—'} · ${p.skill?p.skill.n:''}${starter?' · <span style="color:var(--cyan)">首发</span>':''}</span>
 </div>`;
 }).join('');
 $('#app-modal-body').innerHTML=`
 <h2>${crest(icon,teamName,22)} ${teamName} · 全队阵容 <span class="tag">${roster.length} 人</span></h2>
 <div class="hint" style="margin-bottom:8px">总值=按位置加权四维实时计算 · 战力=招牌英雄结算${mine?'（本队选手可在转会页挂牌/出售）':''}</div>
 ${rows||'<div class="hint">该队暂无注册选手</div>'}
 <div class="center mt16"><button class="btn primary" onclick="closeModal('app-modal')">关闭</button></div>`;
 $('#app-modal').classList.add('wide');
 $('#app-modal').classList.add('on');
}
/* ===== 队徽生成器：开局自建 + 俱乐部页改队徽 共用（风格同真实 KPL 俱乐部） ===== */
let _crShape='shield',_crSw=0,_crTxt='';
function _crReset(){_crShape='shield';_crSw=0;_crTxt='';}
function _crBrandFor(name){
 const c=CREST_SWATCHES[_crSw]||CREST_SWATCHES[0];
 const n=String(name||'').trim();
 const txt=(_crTxt.trim()||shortMark(n)||'新队').slice(0,4);
 return {sh:_crShape,c1:c[0],c2:c[1],c3:c[2],txt};
}
function crestBuilderHTML(previewName){
 const c=CREST_SWATCHES[_crSw]||CREST_SWATCHES[0];
 const shapeBtns=CREST_SHAPE_LIST.map(sh=>{
  const b=crestOf({sh,c1:c[0],c2:c[1],c3:c[2],txt:'KK'},34);
  return `<button type="button" class="btn sm cr-shape ${sh===_crShape?'primary':''}" data-sh="${sh}" onclick="crShape('${sh}')" title="外形：${sh}">${b}</button>`;
 }).join('');
 const swBtns=CREST_SWATCHES.map((x,i)=>`<button type="button" class="cr-sw ${i===_crSw?'on':''}" data-i="${i}" onclick="crSw(${i})" title="配色${i+1}（主色 ${x[0]}）" style="background:${x[0]}"></button>`).join('');
 return `<div class="cr-top">
 <div id="cr-preview">${crestOf(_crBrandFor(previewName),64)}</div>
 <div class="cr-tip dim">你的战队与 18 支真实 KPL 俱乐部同用一套队徽引擎<br>执教原版俱乐部保留官方主色（AG 红金 / 狼队黑金 / eStar 星空蓝…）</div>
 </div>
 <div class="dim" style="font-size:11px;margin:2px 0 6px">徽章外形</div>
 <div class="cr-row">${shapeBtns}</div>
 <div class="dim" style="font-size:11px;margin:4px 0 6px">主队配色</div>
 <div class="cr-row">${swBtns}</div>
 <div class="center dim" style="font-size:11px;margin:8px 0 6px">队徽缩写（≤4 字符，留空自动取队名）</div>
 <div class="center"><input id="cr-txt" maxlength="4" value="${_escTxt(_crTxt)}" placeholder="如 AG / WOLF / 无名" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 12px;font-size:15px;width:170px;text-align:center" oninput="crTxt(this.value)"></div>`;
}
function refreshCrUI(){
 const b=document.getElementById('cr-builder');
 if(!b)return;
 const name=function(){
  const i=document.getElementById('new-team-name');
  if(i&&String(i.value||'').trim())return i.value.trim();
  return (typeof S!=='undefined'&&S&&S.teamName)?S.teamName:'';
 }();
 const p=document.getElementById('cr-preview');
 if(p)p.innerHTML=crestOf(_crBrandFor(name),64);
 b.querySelectorAll('.cr-shape').forEach(x=>x.classList.toggle('primary',x.dataset.sh===_crShape));
 b.querySelectorAll('.cr-sw').forEach(x=>x.classList.toggle('on',parseInt(x.dataset.i,10)===_crSw));
}
function crShape(sh){_crShape=sh;refreshCrUI();}
function crSw(i){_crSw=i;refreshCrUI();}
function crTxt(v){_crTxt=String(v||'').trim().slice(0,4);refreshCrUI();}
/* 俱乐部页「改队徽」弹窗：真实俱乐部可一键恢复官方原版 */
function openCrestEdit(){
 if(!S)return;
 const cur=S.crest||crestBrand(S.teamName,S.icon)||autoBrand(S.teamName,S.icon);
 _crShape=cur.sh||'shield';
 const hit=CREST_SWATCHES.findIndex(x=>x[0]===cur.c1);
 _crSw=hit<0?0:hit;
 _crTxt=(cur.txt&&cur.txt!==shortMark(S.teamName))?String(cur.txt).slice(0,4):'';
 $('#app-modal-body').innerHTML=`
 <h2>${crest(S.icon,S.teamName,24)} ${S.teamName} · 自定义队徽</h2>
 <div id="cr-builder">${crestBuilderHTML(S.teamName)}</div>
 <div class="center mt16" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 <button class="btn sm" onclick="closeModal('app-modal')">取消</button>
 ${TEAM_BRAND[S.teamName]?`<button class="btn sm" onclick="resetCrest()">恢复官方原版队徽</button>`:''}
 <button class="btn gold" onclick="saveCrest()">保存队徽</button>
 </div>`;
 $('#app-modal').classList.add('on');
}
function saveCrest(){
 if(!S)return;
 const b=_crBrandFor(S.teamName);
 S.crest={sh:b.sh,c1:b.c1,c2:b.c2,c3:b.c3,txt:b.txt};
 save();closeModal('app-modal');renderAll();toast('队徽已更新，各处同步生效');
}
function resetCrest(){
 if(!S)return;
 S.crest=null;
 save();closeModal('app-modal');renderAll();
 toast(TEAM_BRAND[S.teamName]?'已恢复官方原版队徽':'已恢复默认队徽');
}

/* ================= 可排序数据表（点表头排序，再点反向） =================
 纯 DOM 排序：页面重渲染后排序状态自然重置，无额外状态要维护。
 单元格取 textContent 参与比较：纯数字/带万/亿单位/百分比自动按数值，其余按字符串。 */
function thSortVal(txt){
 const t=String(txt).replace(/[^0-9.万亿千%-]/g,'');
 let n=parseFloat(t);
 if(isNaN(n))return String(txt).trim();
 if(/万亿|千万/.test(t))n*=10000;else if(/亿/.test(t))n*=100000000;else if(/万/.test(t))n*=10000;
 else if(/千/.test(t))n*=1000;
 return n;
}
document.addEventListener('click',e=>{
 const th=e.target&&e.target.closest&&e.target.closest('table.tbl th');
 if(th&&th.parentNode.rowIndex===0)thSort(th); // 只响应首行表头
});
function thSort(th){
 const table=th.closest('table');
 if(!table)return;
 const dir=th.dataset.dir==='asc'?'desc':'asc';
 table.querySelectorAll('th[data-dir]').forEach(x=>{if(x!==th)x.dataset.dir='';});
 th.dataset.dir=dir;
 const headRow=th.parentNode;
 const rows=[].slice.call(table.rows).filter(r=>r!==headRow);
 const idx=[].slice.call(headRow.cells).indexOf(th);
 rows.sort((a,b)=>{
 const va=thSortVal(a.cells[idx]?a.cells[idx].textContent:'');
 const vb=thSortVal(b.cells[idx]?b.cells[idx].textContent:'');
 const cmp=(typeof va==='number'&&typeof vb==='number')?va-vb:String(va).localeCompare(String(vb),'zh');
 return dir==='asc'?cmp:-cmp;
 });
 const body=rows[0]&&rows[0].parentNode;
 if(body)rows.forEach(r=>body.appendChild(r)); // appendChild 移动已有节点即完成重排
 toast('已按「'+th.textContent.trim()+'」'+(dir==='asc'?'升序':'降序'));
}
/* ================= 生涯页（选手模式主页：成长 / 竞争 / 报价 / 履历） ================= */
function renderCareer(){
 const el=$('#page-career');
 if(S.mode!=='player'){el.innerHTML='<div class="hint">生涯页仅选手生涯模式可用</div>';return;}
 const c=S.career||{};
 const me=myPlayer(S);
 // 退役后本人已从名单移除：用 legacy 快照渲染结算屏（否则会误报「选手数据缺失」）
 if(c.retired){
 const L=c.legacy||{};
 const name=L.name||(me&&me.name)||'选手';
 const age=L.age||(me&&me.age)||'—';
 const mvp=L.mvp!=null?L.mvp:(me&&me.mvp)||0;
 const ovrPeak=(c.seasons||[]).reduce((m,r)=>Math.max(m,r.ovr||0),0)||L.ovr||0;
 const rows=(c.seasons||[]).map(r=>`<tr><td>${r.year}</td><td>${r.team}</td><td>${r.apps}</td><td>${r.kda||'—'}</td><td>${r.mvp}</td><td class="gold">${r.titles?r.titles+' 冠':''}</td></tr>`).join('');
 const coachBtn=c.coachPath
 ?`<button class="btn gold" onclick="playerToCoach()" style="margin:0 6px">退役转教练（执教 ${S.teamName}）</button>`
 :'';
 el.innerHTML=`<div class="panel center" style="border-color:var(--gold)">
 <div style="font-size:34px;font-weight:800;color:var(--gold);margin:8px 0">${name} 退役</div>
 <div class="dim" style="margin-bottom:10px">${age} 岁 · ${(c.seasons||[]).length||0} 个赛季 · ${c.titles||0} 冠 · ${mvp} 次单场MVP · 生涯最高总值 ${ovrPeak||'—'}</div>
 <table class="tbl" style="max-width:640px;margin:0 auto 12px"><tr><th>赛季</th><th>球队</th><th>出场</th><th>场均KDA</th><th>MVP</th><th>荣誉</th></tr>${rows||'<tr><td colspan="6" class="hint">无赛季履历</td></tr>'}</table>
 ${c.coachPath?'<div class="hint" style="margin-bottom:10px">教练组发出邀请：你可以留在赛场开启执教生涯（一条龙）——履历与荣誉会写进教练合同。</div>':''}
 <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 ${coachBtn}
 <button class="btn" onclick="resetGame()">开启下一段旅程（重新开始）</button>
 </div>
 </div>`;
 return;
 }
 if(!me){el.innerHTML='<div class="hint">选手数据缺失（存档异常）——请重新开局</div>';return;}
 const starter=S.lineup.includes(me.id);
 const rival=S.players.filter(p=>p.pos===me.pos&&p.id!==me.id&&p.injury<=0).sort((a,b)=>playerPower(b)-playerPower(a))[0];
 const myPow=playerPower(me,(S.pick&&S.pick[me.pos])||me.sig),rivPow=rival?playerPower(rival,rival.sig):0;
 const myOffers=(S.offers||[]).filter(o=>o.pid===me.id);
 const avg=me.caps?[me.kTotal,me.dTotal,me.aTotal].map(x=>Math.round(x/me.caps*10)/10).join('/'):'—';
 let html=`<div class="panel" style="border-left:4px solid ${POS_HUE[me.pos]||'var(--accent)'}">
 <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
 ${avatar(me,64)}
 <div><div style="font-size:20px;font-weight:800">${me.name} <span class="tag">${POS[me.pos][0]} · ${me.age}岁 · ${ageStage(me)}</span>${starter?' <span class="tag" style="border-color:var(--green);color:var(--green)">首发</span>':' <span class="tag" style="border-color:var(--gold);color:var(--gold)">替补</span>'}</div>
 <div class="dim" style="font-size:12px">${crest(S.icon,S.teamName,18)} ${S.teamName} · 合同 ${me.contract>0?me.contract+' 年':'到期'} · 周薪 ${me.wage}万 · 总值 <b style="color:${ovrColor(overall(me))}">${overall(me)}</b> · 身价系数 ${me.val||100}%${me.injury>0?' · <span class="red">伤停 '+me.injury+' 天</span>':''}</div></div>
 <div style="margin-left:auto;text-align:right"><div class="gold" style="font-size:16px;font-weight:800">${c.titles||0} 冠 · ${c.fmvp||0} FMVP · ${c.allstar||0} 一阵</div><div class="dim" style="font-size:11px">生涯荣誉</div></div>
 </div></div>`;
 // 成长 + 每日行动
 html+=`<div class="panel"><h3>成长训练 <span class="tag">${S.trained?'今日已完成':'每天一项'}</span></h3>
 <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:10px">${radarSvg(me,84)}
 <div class="hint">对线 ${me.attrs.lane} · 运营 ${me.attrs.farm} · 团战 ${me.attrs.team} · 心态 ${me.attrs.mind}<br>本赛季：出场 ${me.apps||0} 次 · 场均 ${avg} · 单场MVP ${me.mvp||0} 次<br>招牌：${heroIcon(me.sig,16)} ${me.sig}（${HERO_LV[heroLv(me,me.sig)].n}）· 体力 ${me.energy} · 士气 ${me.morale}${c.mentorName?'<br>老将带新：'+c.mentorName+' 点拨过你（年度结算时属性成长更快）':''}${c.mentoredCount?' · 你已带训新人 '+c.mentoredCount+' 人次':''}</div></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
 <button class="btn sm" onclick="playerTrain('lane')" ${S.trained||me.energy<10?'disabled':''}>练对线 +1~2</button>
 <button class="btn sm" onclick="playerTrain('farm')" ${S.trained||me.energy<10?'disabled':''}>练运营 +1~2</button>
 <button class="btn sm" onclick="playerTrain('team')" ${S.trained||me.energy<10?'disabled':''}>练团战 +1~2</button>
 <button class="btn sm" onclick="playerTrain('mind')" ${S.trained||me.energy<10?'disabled':''}>练心态 +1~2</button>
 <button class="btn sm gold" onclick="playerHeroTrain()" ${S.trained||me.energy<15?'disabled':''}>英雄特训（练绝活）</button>
 <button class="btn sm" onclick="playerRest()" ${S.trained?'disabled':''}>休息（体力+55）</button>
 </div>
 <div class="hint mt8">战力↑ = 首发竞争力↑；英雄特训把一个熟练英雄练成绝活（战力 +8%）。体力不足时教练不会让你进首发。</div>
 </div>`;
 // 首发竞争
 if(rival)html+=`<div class="panel"><h3>首发竞争 <span class="tag">${POS[me.pos][0]}</span></h3>
 <div class="match"><div class="vs"><span style="display:inline-flex;align-items:center;gap:6px">${avatar(me,28)} <b>${me.name}</b>${starter?' <span class="green">首发中</span>':''}</span></div>
 <div class="score" style="font-size:13px">战力 <b style="color:var(--cyan)">${myPow}</b> vs <b style="color:${rivPow>myPow?'var(--red)':'var(--dim)'}">${rivPow}</b></div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span style="display:inline-flex;align-items:center;gap:6px"><b>${rival.name}</b>${starter?'':' <span class="gold">目前压你</span>'}</span></div></div>
 <div class="hint mt8">每场比赛前教练按双方当前战力（体力/士气/伤停实时计入）决定首发——反超即夺回位置。</div>
 </div>`;
 // 转会报价（只有自己的）
 if(myOffers.length){
 html+=`<div class="panel"><h3>转会报价 <span class="tag">${myOffers.length} 份 · ${OFFER_TTL} 天内有效</span></h3>
 ${myOffers.map(o=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${o.team} 邀请你加盟</span>
 <div class="power" style="font-size:10px">报价 <b class="gold">${o.fee}万</b>（转会费越高，新俱乐部给你的薪资越好）· 第 ${o.expire} 天到期</div></div>
 <div style="display:flex;gap:4px">
 <button class="btn sm" onclick="respondOffer(S,${S.offers.indexOf(o)},'keep')">留队（涨薪 8%）</button>
 <button class="btn sm primary" onclick="respondOffer(S,${S.offers.indexOf(o)},'sell')">接受（赛段结束后加盟）</button>
 </div></div>`).join('')}
 <div class="hint">表现火热（身价系数 ≥112%）才会被豪门盯上；接受后当前赛段继续为现队出战，赛季间正式转会。</div>
 </div>`;
 }
 if(c.pendingMove)html+=`<div class="panel" style="border-color:var(--gold)"><h3>转会意向 <span class="tag" style="color:var(--gold)">将加盟 ${c.pendingMove.team}</span></h3>
 <div class="hint">当前赛段继续为 ${S.teamName} 出战；打完挑战者杯/年总等收官战后，新赛季开始时正式加盟新东家。</div></div>`;
 // 履历
 html+=`<div class="panel"><h3>生涯履历 <span class="tag">${c.seasons.length} 个赛季</span></h3>
 ${c.seasons.length?`<table class="tbl"><tr><th>赛季</th><th>球队</th><th>出场</th><th>场均KDA</th><th>MVP</th><th>总值</th><th>身价</th><th>荣誉</th></tr>
 ${c.seasons.map(r=>`<tr><td>${r.year}</td><td>${r.team}</td><td>${r.apps}</td><td>${r.kda||'—'}</td><td>${r.mvp}</td><td>${r.ovr}</td><td>${r.val}%</td><td class="gold">${r.titles?r.titles+' 冠':''}</td></tr>`).join('')}</table>`:'<div class="hint">首个赛季进行中——每个赛季结束后这里记录你的一年</div>'}
 </div>`;
 el.innerHTML=html;
}
function playerTrain(k){
 if(S.mode!=='player')return;
 if(S.trained){toast('今天已经练过了，明天再来');return;}
 const me=myPlayer(S);if(!me)return;
 if(S.career&&S.career.retired){toast('职业生涯已结束');return;}
 if(me.injury>0){toast('伤停中（'+me.injury+'天），先养伤');return;}
 me.attrs[k]=clamp(me.attrs[k]+rnd(1,2),40,99);
 me.energy=clamp(me.energy-10,0,ENERGY_MAX);
 S.trained=true;
 logEvent(S,' 加练'+{lane:'对线',farm:'运营',team:'团战',mind:'心态'}[k]+'：'+me.name+' 属性提升（体力-10）');
 save();renderAll();
}
function playerHeroTrain(){
 if(S.mode!=='player')return;
 if(S.trained){toast('今天已经练过了');return;}
 const me=myPlayer(S);if(!me)return;
 if(S.career&&S.career.retired){toast('职业生涯已结束');return;}
 if(me.injury>0){toast('伤停中，先养伤');return;}
 const cand=(me.heroPool||[]).filter(h=>h.lv===2&&h.n!==me.sig);
 if(!cand.length){toast('没有可升绝活的熟练英雄（池内都已是绝活/招牌）');return;}
 const h=pick(cand);h.lv=3;
 me.energy=clamp(me.energy-15,0,ENERGY_MAX);
 S.trained=true;
 logEvent(S,' 英雄特训：'+me.name+' 把 '+h.n+' 练成了绝活（战力 +8%）');
 save();renderAll();toast(h.n+' 已练成绝活！');
}
function playerRest(){
 if(S.mode!=='player')return;
 if(S.trained){toast('今天已经休息过了');return;}
 const me=myPlayer(S);if(!me)return;
 me.energy=clamp(me.energy+55,0,ENERGY_MAX);
 me.morale=clamp(me.morale+4,20,100);
 S.trained=true;
 logEvent(S,' 休息一天：'+me.name+' 体力恢复，心态平稳');
 save();renderAll();
}
