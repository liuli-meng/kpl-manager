
/* ============ PART3 ============ */

/* ================= 卡牌渲染 ================= */
function lvTag(lv){return `<span style="color:${HERO_LV[lv].b>0?'var(--gold)':lv<0?'var(--red)':'var(--dim)'};font-size:10px">${HERO_LV[lv].n}</span>`;}
function pcard(p,extra){
 const o=overall(p),oc=ovrColor(o); // 总值实时计算，训练/年龄/表现即时反映
 const hpCls=p.injury>0?`<div class="p-hp">伤停 ${p.injury}天</div>`:(p.morale<40?'<div class="p-hp">状态差</div>':'');
 const tags=(p.tags||[]).map(t=>`<span class="p-tag">${t}</span>`).join('');
 const teamHtml=p.team?` · <span style="color:var(--dim)">${p.team}</span>`:'';
 const potHtml=p.potential?` · 潜力${''.repeat(p.potential)}`:'';
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
 const endorseHtml=(p.popularity||0)>0?`<div class="p-hero" style="color:var(--gold)">代言 ${Math.round((p.popularity||0)*0.3)}万/周 · 人气 ${p.popularity}</div>`:'';
 const disc=p.discount?`<span class="p-disc">特惠${Math.round(p.discount*10)}折</span>`:'';
 return `<div class="pcard ${ovrCls(o)}">
 ${hpCls}
 <div class="p-top"><span class="p-name">${p.name}${tags}</span><span class="p-pos" title="${POS[p.pos][0]}">${POS[p.pos][1]}</span></div>
 <div class="p-rarity" style="color:${oc};letter-spacing:0">总值 <b style="font-size:16px">${o}</b> · ${POS[p.pos][0]}${teamHtml}${potHtml}${disc}</div>
 ${stageHtml}
 ${contractHtml}
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
 <div class="logbox" style="max-height:60vh">${h.logs.map(l=>`<div class="${l.includes('胜')?'win':l.includes('负')?'lose':'info'}">${l}</div>`).join('')}</div>
 <div class="center mt16"><button class="btn primary" onclick="closeModal('app-modal')">关闭</button></div>`;
 $('#app-modal').classList.add('on');
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
 <div class="hint" style="margin-bottom:12px">年龄：${p.age!=null?p.age:'—'}岁${p.age!=null&&p.age>=(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire-1?'（<b style="color:var(--red)">'+(p.age>=(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire?'已到退役年龄':'即将退役')+'</b>）':''}　·　MVP：${p.mvp||0} 次　·　出场 ${p.caps||0} 场<br>当前身价 <b class="gold">${sellAskPrice(p)}万</b>（表现 ${perfLabel(p)} ${p.val||100}%）· 场均 ${(p.caps?Math.round((p.kTotal||0)/p.caps*10)/10:0)} / ${(p.caps?Math.round((p.dTotal||0)/p.caps*10)/10:0)} / ${(p.caps?Math.round((p.aTotal||0)/p.caps*10)/10:0)}<br>招牌英雄：${p.sig}（${HERO_LV[heroLv(p,p.sig)].n}）<br>英雄池：${lvDesc}</div>
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
 <div class="hd-name">${S.teamName}<small>${S.phase==='champion'?'冠军俱乐部':splitLabel(S)+' · KPL 联赛'}</small></div>
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
function renderClub(){
 const ls=rosterLineup(S);
 let html=`
 <div class="banner" style="border-left:4px solid ${teamColor(S.teamName)}">
 <div>${crest(S.icon,S.teamName,44)}</div>
 <div><div class="big">${S.teamName}</div>
 <div class="dim" style="font-size:12px">${splitLabel(S)} · 第${S.day}天 · ${PHASE_NAME[S.phase]||S.phase}${myGroup(S)?' · '+myGroup(S)+'组':''}${(S.phase==='playoff'||S.phase==='annual'&&S.annual&&S.annual.stage==='po')?' · 双败淘汰':''}${S.phase==='ewc'?' · 8强单败':''}</div></div>
 <button class="btn sm" style="margin-left:4px;flex:none" onclick="openCrestEdit()" title="自选外形/配色/缩写，风格同 18 支真实俱乐部">改队徽</button>
 <div style="margin-left:auto;text-align:right">
 <div class="gold" style="font-size:18px;font-weight:800">${fmt(S.fund)}</div>
 <div class="dim" style="font-size:11px">俱乐部资金</div>
 </div>
 </div>`;
 if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
 const m=S.schedule[S.matchIdx];
 const g=myGroup(S);
 if(S.preseason){
 // 赛前转会期：先组队，再开赛（比赛面板隐藏）
 const lsP=rosterLineup(S);
 html+=`<div class="panel">
 <h3>赛前转会期 <span class="tag">剩余 ${S.transferWindow} 天 · 结束后开赛</span></h3>
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
 <button class="btn" style="flex:1;min-width:140px" onclick="nextDay(S)">推进一天（剩余 ${Math.max(0,S.transferWindow-1)} 天）</button>
 <button class="btn gold" style="flex:1;min-width:140px" onclick="skipTransferWindow(S)">跳过剩余 ${Math.max(0,S.transferWindow)} 天（自动训练/培养）</button>
 </div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
 <button class="btn gold" style="flex:1;min-width:140px" onclick="endPreseason(S)"> 结束转会期 · 开始赛季</button>
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
 </div>
 <button class="btn primary" style="width:100%" onclick="startMatch()">赛前准备 · 调整阵容 / BP 开赛（BO5 全局BP）</button>
 <div class="hint mt8">KPL 官方赛制：常规赛 BO5 全局BP，胜者积 1 分；系列赛内用过的英雄锁定，每局对手 BAN 2 个；奖金按胜小局数结算（8万/小局）。赛前可换首发，BP 中也可换替补。</div>
 </div>`;
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
 ${!c.champ?`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行下一场 · 调整阵容 / BP 开赛':'快进赛程'}</button>`:''}`;
 }else{
 const p=c.po;
 const myPending=p&&!c.final&&[...p.wb1,...p.lb1,...p.wb2,...p.lb2,p.wf,p.lbs,p.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 const mrow=(m,tag)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${tag?tag+'：':''}${m.a?m.a:'待定'} vs ${m.b?m.b:'待定'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 body=`<div class="hint" style="margin-bottom:6px">8 强双败（BO7）：</div>
 ${p.wb1.map(m=>mrow(m,'胜者组R1')).join('')}${p.wb2.map(m=>mrow(m,'胜者组SF')).join('')}${p.wf.a?mrow(p.wf,'胜者组决赛'):''}
 ${p.lb1.map(m=>mrow(m,'败者组R1')).join('')}${p.lb2.map(m=>mrow(m,'败者组R2')).join('')}${p.lbs.a?mrow(p.lbs,'败者组SF'):''}${p.lbf.a?mrow(p.lbf,'败者组决赛'):''}
 ${c.final&&c.final.a?`<div class="hint" style="margin:6px 0">总决赛（BO9 · 第9局巅峰对决）：</div>${mrow(c.final,'决赛')}`:''}
 ${!c.champ&&c.final&&!c.final.r?`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行下一场':'进行总决赛（BO9）'}</button>`:!c.champ?`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行下一场':'快进赛程'}</button>`:''}
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
 ${!e.champ?`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行下一场 · 调整阵容 / BP 开赛':'快进赛程'}</button>`:`<div class="hint mt8">冠军：${e.champ}${e.champ===S.teamName?' ——世界之巅！':''} · 赛后进入夏季赛转会期</div>`}
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
 :`<button class="btn primary" style="width:100%" onclick="asiadStep(S)">推进亚运会赛程（BO7 单败）</button>`}
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
 <button class="btn primary" style="width:100%" onclick="startCup(S)">进行擂台赛 · 调整阵容 / BP 开赛</button>`:`<div class="hint">本轮赛程进行中</div>`}
 <div class="hint mt8"><b>大师组</b>（积分前6）：${rankLine(st.M,a.masters)}</div>
 <div class="hint"><b>精英组</b>（积分7-12）：${rankLine(st.E,a.elites)}</div>
 <div class="hint mt8">大师组前4 + 精英组第1 直进淘汰赛；大师5/6 与精英2-5 打突围赛；精英第6名直接出局</div>
 </div>`;
 }else if(a.stage==='breakthrough'){
 const myPending=a.brk.some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 html+=`<div class="panel"><h3>年度总决赛·突围赛 <span class="tag">6队 BO7 单败 · 3队晋级</span></h3>
 ${a.brk.map(cupRow).join('')}
 ${a.brk.every(m=>m.r)?'<div class="hint mt8">晋级淘汰赛：'+a.brk.map(m=>m.r).join('、')+'</div>':`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行突围赛':'快进赛程'}</button>`}
 </div>`;
 }else{
 const p=a.po;
 const myPending=p&&!p.final.r&&[...p.wb1,...p.lb1,...p.wb2,...p.lb2,p.wf,p.lbs,p.lbf,p.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
 const mrow=(m,tag)=>`<div class="match" style="margin-bottom:6px"><div class="vs"><span class="tname" style="font-size:13px">${tag?tag+'：':''}${m.a?m.a:'待定'} vs ${m.b?m.b:'待定'}</span></div><div class="score" style="font-size:12px">${m.r?m.r+' 晋级':'待赛'}</div></div>`;
 html+=`<div class="panel"><h3>年度总决赛·淘汰赛 <span class="tag">8强 BO7 双败 · 圣龙杯</span></h3>
 ${p?p.wb1.map(m=>mrow(m,'胜者组R1')).join('')+p.wb2.map(m=>mrow(m,'胜者组SF')).join('')+(p.wf.a?mrow(p.wf,'胜者组决赛'):'')+p.lb1.map(m=>mrow(m,'败者组R1')).join('')+p.lb2.map(m=>mrow(m,'败者组R2')).join('')+(p.lbs.a?mrow(p.lbs,'败者组SF'):'')+(p.lbf.a?mrow(p.lbf,'败者组决赛'):'')+(p.final.a?mrow(p.final,'总决赛'):'')
 :'<div class="hint">待突围赛结束</div>'}
 ${p&&p.final.a&&!p.final.r?`<button class="btn primary" style="width:100%" onclick="startCup(S)">${myPending?'进行下一场':'快进赛程'}</button>`:''}
 ${p&&p.champ?`<div class="hint mt8">年度总冠军：${p.champ} —— 圣龙杯！</div>`:''}
 </div>`;
 }
 }else if(S.phase==='champion'){
 html+=`<div class="panel center">
 <div style="font-size:40px;color:var(--gold)"></div>
 <h3 style="justify-content:center">${splitLabel(S)} 总冠军：${S.playoff?S.playoff.champ:'—'}</h3>
 ${S.champion?'<div class="green" style="font-size:16px;font-weight:800;margin:8px 0">你是冠军！王朝就此建立！</div>':'<div class="dim">冠军属于对手，继续积蓄力量！</div>'}
 <div class="hint" style="margin:6px 0">${S.split==='spring'?'接下来：挑战者杯 → EWC → 夏季赛':(isAsiadYear(S)&&!S.agDone)?'接下来：亚运会（国家队征召） → KPL 年度总决赛':'接下来：KPL 年度总决赛（年度积分前12）'}</div>
 <button class="btn gold mt12" onclick="advanceCalendar(S)">${calendarNextLabel(S)}</button>
 </div>`;
 }else if(S.phase==='eliminated'){
 html+=`<div class="panel center">
 <div style="font-size:40px;color:var(--faint)"></div>
 <h3 style="justify-content:center">${splitLabel(S)} 止步</h3>
 <div class="dim" style="margin:8px 0">未能晋级后续阶段（B组后2名 / 卡位赛失利 / 季后赛出局）</div>
 <div class="hint" style="margin:6px 0">年度积分已入账（当前 ${S.annualPts[S.teamName]||0} 分）· ${S.split==='spring'?'接下来：挑战者杯 → EWC → 夏季赛':(isAsiadYear(S)&&!S.agDone)?'接下来：亚运会（国家队征召） → 年度总决赛':'接下来：年度总决赛（前12晋级）'}</div>
 <button class="btn gold mt12" onclick="advanceCalendar(S)">${calendarNextLabel(S)}</button>
 </div>`;
 }
 // 今日行动
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
 // 主教练
 if(S.coach){
 const c=S.coach;
 html+=`<div class="panel"><h3>主教练 <span class="tag">${c.rating||80}评分 · ${COACH_STYLE[c.style]}型</span></h3>
 <div class="sponsor"><span class="s-icon">教</span>
 <div><div class="s-name">${c.name} <span class="gold">(全队战力+${c.bonus}%)</span></div>
 <div class="s-desc"> ${c.skill.n}：${c.skill.d} · 周薪 ${c.wage}万 · 转会页可换帅</div></div></div></div>`;
 }
 $('#page-club').innerHTML=html;
}
/* ================= 经营页（赞助商 / 工资帽 / 荣誉室 / 比赛复盘） ================= */
function renderBiz(){
 const sp=SPONSORS[S.sponsorLv],next=SPONSORS[S.sponsorLv+1];
 let html=`<div class="panel"><h3>赞助商 <span class="tag">每日结算收入</span></h3>`;
 html+=`<div class="sponsor"><span class="s-icon">${sp.icon}</span><div><div class="s-name">${sp.name} <span class="gold">(当前)</span></div><div class="s-desc">每日收入 ${sp.income}万</div></div></div>`;
 if(next){
 html+=`<button class="btn gold sm" onclick="upgradeSponsor()" ${S.fund<next.cost?'disabled':''}>升级到「${next.name}」需 ${next.cost}万</button>`;
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
 return pcard(p,`<div style="display:flex;gap:6px"><button class="btn sm" style="flex:1" onclick="swapPlayer('${p.id}')">→ 换下</button><button class="btn sm danger" style="flex:1" onclick="openSellNego(S,'${p.id}')"> 出售</button></div>`);
 }).join('')}</div></div>`;
 html+=`<div class="panel"><h3>替补席 <span class="tag">${bn.length}人</span></h3>
 ${bn.length?`<div class="grid g4">${bn.map(p=>pcard(p,`<button class="btn sm primary" onclick="swapPlayer('${p.id}')">↑ 放入首发</button><button class="btn sm danger mt8" onclick="openSellNego(S,'${p.id}')"> 出售（谈判）</button>`)).join('')}</div>`:'<div class="hint">暂无替补，快去转会市场谈判补充阵容！</div>'}
 </div>`;
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
 if(!inLineup&&p.injury>0){toast(p.name+' 伤停中（还剩'+p.injury+'天），不能进入首发');return;}
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
 <div class="p-rarity" style="letter-spacing:0">总值${overall(r)} · ${r.age}岁 · 潜力${''.repeat(r.potential)} · 周薪${r.wage}万</div>
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
 // 年度积分榜（春夏累计，前12进年度总决赛）
 {
 const rank=annualRank(S);
 const myIdx=rank.indexOf(S.teamName);
 html+=`<div class="panel"><h3>年度积分榜 <span class="tag">${gameYear(S)} · 前 12 进年度总决赛</span></h3>
 <table class="tbl"><tr><th>#</th><th>战队</th><th>年度积分</th></tr>
 ${rank.slice(0,12).map((t,i)=>`<tr class="${t===S.teamName?'me':''}"><td>${i+1}</td><td>${crest((AI_TEAMS.find(x=>x.name===t)||{}).icon||(t===S.teamName?S.icon:'队'),t,18)} ${t}${t===S.teamName?' ★':''}</td><td class="gold">${S.annualPts[t]||0}</td></tr>`).join('')}
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
function renderUnion(){
 const teams=unionTeams().sort((a,b)=>b.power-a.power);
 let html=`<div class="panel"><h3>战队总览 <span class="tag">18 队 · 点击查看阵容</span></h3>
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
 if(tab==='young')return (p.age||'?')+'岁'+(p.potential?' · '+''.repeat(p.potential):'');
 return fmt(sellAskPrice(p))+'万';
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
