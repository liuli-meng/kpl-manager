/* 生涯页 UI（从 ui.js 拆出：只搬渲染与转发，日决策引擎在 playerops） */
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
 let html=(typeof missionStrip==='function'?missionStrip(S):'')+pageHint('career')+`<div class="panel" style="border-left:4px solid ${POS_HUE[me.pos]||'var(--accent)'}">
 <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
 ${avatar(me,64)}
 <div><div style="font-size:20px;font-weight:800">${me.name} <span class="tag">${POS[me.pos][0]} · ${me.age}岁 · ${ageStage(me)}</span>${starter?' <span class="tag" style="border-color:var(--green);color:var(--green)">首发</span>':' <span class="tag" style="border-color:var(--gold);color:var(--gold)">替补</span>'}</div>
 <div class="dim" style="font-size:12px">${crest(S.icon,S.teamName,18)} ${S.teamName} · 合同 ${me.contract>0?me.contract+' 年':'到期'} · 年薪 ${me.wage}万 · 总值 <b style="color:${ovrColor(overall(me))}">${overall(me)}</b> · 身价系数 ${me.val||100}%${me.injury>0?' · <span class="red">伤停 '+me.injury+' 天</span>':''}</div></div>
 <div style="margin-left:auto;text-align:right"><div class="gold" style="font-size:16px;font-weight:800">${c.titles||0} 冠 · ${c.fmvp||0} FMVP · ${c.allstar||0} 一阵</div><div class="dim" style="font-size:11px">生涯荣誉</div></div>
 </div></div>`;
 // 成长 + 每日行动（伤停/集训/外租/K甲不可加练；休息仍可回体力并加速养伤）
 const trainBlock=trainBlockedReason(S,me);
 const trainLock=S.trained||!!trainBlock;
 const canTrain=!trainLock&&me.energy>=10;
 const canHero=!trainLock&&me.energy>=15;
 const underAge=(me.age||0)<MATCH_MIN_AGE;
 const roleKey=playerRole(S),role=PLAYER_ROLES[roleKey]||PLAYER_ROLES.rot;
 const form=(typeof playerForm==='function')?playerForm(me):50;
 const peak=(typeof ensurePlayerPeak==='function')?ensurePlayerPeak(me):null;
 const fl=(typeof formLabel==='function')?formLabel(form):(form>=80?'火热':form>=55?'平稳':'低迷');
 html+=`<div class="panel"><h3>成长训练 <span class="tag">${S.trained?'今日已完成':trainBlock||'每天一项'} · 合同角色：${role.n} · 状态：<span style="color:${form>=80?'var(--green)':form>=55?'var(--gold)':'var(--red)'}">${fl} ${form}</span></span></h3>
 <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:10px">${radarSvg(me,84)}
 <div class="hint">对线 ${me.attrs.lane}${peak?'/'+peak.lane:''} · 运营 ${me.attrs.farm}${peak?'/'+peak.farm:''} · 团战 ${me.attrs.team}${peak?'/'+peak.team:''} · 心态 ${me.attrs.mind}${peak?'/'+peak.mind:''} <span class="dim">（当前/天花板）</span><br>本赛季：出场 ${me.apps||0} 次 · 场均 ${avg} · 单场MVP ${me.mvp||0} 次 · 比赛 ${((S.career.stats||{}).matches)||0} 场<br>招牌：${heroIcon(me.sig,16)} ${me.sig}（${HERO_LV[heroLv(me,me.sig)].n}）· 体力 ${me.energy} · 士气 ${me.morale}${underAge?'<br><span class="gold">未满 '+MATCH_MIN_AGE+' 岁：可加练成长，满 '+MATCH_MIN_AGE+' 岁才能代表俱乐部出场</span>':''}${me.injury>0?'<br><span class="red">伤停 '+me.injury+' 天：休息可加速恢复</span>':''}${c.mentorName?'<br>老将带新：'+c.mentorName+' 在年度结算时点拨过你（属性 +1~2）':''}${c.mentoredCount?' · 你已带训新人 '+c.mentoredCount+' 人次':''}<br><span class="dim">${role.d}</span></div></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
 <button class="btn sm" onclick="playerTrain('lane')" ${canTrain?'':'disabled'}>练对线</button>
 <button class="btn sm" onclick="playerTrain('farm')" ${canTrain?'':'disabled'}>练运营</button>
 <button class="btn sm" onclick="playerTrain('team')" ${canTrain?'':'disabled'}>练团战</button>
 <button class="btn sm" onclick="playerTrain('mind')" ${canTrain?'':'disabled'}>练心态</button>
 <button class="btn sm gold" onclick="playerHeroTrain()" ${canHero?'':'disabled'}>英雄特训（练绝活）</button>
 <button class="btn sm" onclick="playerRest()" ${S.trained?'disabled':''}>休息（体力+55 · 养伤）</button>
 </div>
 <div class="hint mt8">加练看状态：火热更易涨、低迷常白练；到个人天花板后只能维持，过巅峰会衰减。英雄特训不受天花板限制。</div>
 <div class="hint mt8">合同角色：${Object.keys(PLAYER_ROLES).map(rk=>`<button class="btn sm ${rk===roleKey?'primary':''}" onclick="setPlayerRole(S,'${rk}')" title="${PLAYER_ROLES[rk].d}">${PLAYER_ROLES[rk].n}</button>`).join(' ')}</div>
 </div>`;
 // 更衣室/社交（与训练并行）
 html+=`<div class="panel"><h3>更衣室 · 社交 <span class="tag">${S.socialUsed?'今日已参与':'今天还可参与一次'}</span></h3>
 <div class="hint" style="margin-bottom:8px">训练管成长，社交管人缘：人气影响转会接盘与代言，士气影响首发竞争力。与「加练」互相独立。</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
 ${Object.keys(SOCIAL_ACTIONS||{}).map(sk=>`<button class="btn sm" onclick="playerSocial(S,'${sk}')" ${S.socialUsed||c.retired||(sk!=='bond'&&me.injury>0)||(me.energy<(SOCIAL_ACTIONS[sk].energy||0))?'disabled':''}>${SOCIAL_ACTIONS[sk].n}</button>`).join('')}
 </div>
 <div class="hint mt8">${Object.keys(SOCIAL_ACTIONS||{}).map(sk=>SOCIAL_ACTIONS[sk].n+'：'+SOCIAL_ACTIONS[sk].d).join(' · ')}</div>
 </div>`;
 // 媒体采访
 if(c.media){
 const mediaAge=(S.day-(c.media.day||S.day));
 html+=`<div class="panel" style="border-color:var(--gold)"><h3>媒体采访 <span class="tag" style="color:var(--gold)">待答复${mediaAge>0?' · 已等 '+mediaAge+' 天':''}</span></h3>
 <div class="hint" style="margin-bottom:8px">${c.media.q}${c.mediaBuff==='train'?'<br><span class="dim">上次采访加成仍有效：下次加练 +1</span>':''}</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
 ${(c.media.opts||[]).map((o,i)=>`<button class="btn sm ${i===0?'primary':''}" onclick="playerRespondMedia(S,${i})" title="${o.tip}">${o.l}</button>`).join('')}
 </div>
 </div>`;
 }
 // 首发竞争
 if(rival)html+=`<div class="panel"><h3>首发竞争 <span class="tag">${POS[me.pos][0]}</span></h3>
 <div class="match"><div class="vs"><span style="display:inline-flex;align-items:center;gap:6px">${avatar(me,28)} <b>${me.name}</b>${starter?' <span class="green">首发中</span>':''}</span></div>
 <div class="score" style="font-size:13px">战力 <b style="color:var(--cyan)">${myPow}</b> vs <b style="color:${rivPow>myPow?'var(--red)':'var(--dim)'}">${rivPow}</b></div>
 <div class="vs" style="justify-content:flex-end;text-align:right"><span style="display:inline-flex;align-items:center;gap:6px"><b>${rival.name}</b>${starter?'':' <span class="gold">目前压你</span>'}</span></div></div>
 <div class="hint mt8">每场比赛前教练按双方当前战力（体力/士气/伤停实时计入）决定首发——反超即夺回位置。</div>
 </div>`;
 // 板凳出路：连续替补可自请租借/K甲（有球可打 + 归队成长）
 const benchDays=c.benchDays||0;
 if(natCamping(S,me)){
 const nf=(c.natFocus||'form');
 html+=`<div class="panel" style="border-color:var(--gold)"><h3>国家队集训中 <span class="tag" style="color:var(--gold)">状态 ${me.natCampForm||0}/5 · 专注：${(typeof NAT_FOCUS!=='undefined'&&NAT_FOCUS[nf]?NAT_FOCUS[nf].n:'状态')}</span></h3>
 <div class="hint">你入选中国代表队，整个夏季赛随国家队合练——俱乐部比赛由队友顶上。集训每 5 天汇报一次成长，开赛前还有热身赛；出征战力随集训状态上浮。亚运收官后归队备战年总。</div>
 <div class="hint mt8">集训策略：${(typeof NAT_FOCUS!=='undefined'?Object.keys(NAT_FOCUS):[]).map(fk=>`<button class="btn sm ${fk===nf?'primary':''}" onclick="setNatFocus(S,'${fk}')" title="${NAT_FOCUS[fk].d}">${NAT_FOCUS[fk].n}</button>`).join(' ')}</div>
 <div class="hint mt8">国家队名单：${(S.natSquad||[]).filter(x=>x.mine).map(x=>x.name+'（'+POS[x.pos][0]+'）').join('、')||'—'}</div>
 </div>`;
 }else if(me.loanOut){
 html+=`<div class="panel" style="border-color:var(--cyan)"><h3>租借中 <span class="tag">剩 ${me.loanOut.days} 天</span></h3>
 <div class="hint">你正租借效力 <b>${me.loanOut.team}</b>——争取出场时间，归队时按表现带回成长。母队由教练组打理。</div></div>`;
 }else if((me.kjia||0)>0){
 html+=`<div class="panel" style="border-color:var(--cyan)"><h3>K甲锻炼中 <span class="tag">剩 ${me.kjia} 天</span></h3>
 <div class="hint">你在二队征战次级联赛（「二队」页可查表现）。归队时结算属性成长，然后重新竞争首发。</div></div>`;
 }else if(!starter&&!c.retired&&(me.age||0)>=MATCH_MIN_AGE&&me.injury<=0&&!natCamping(S,me)){
 const canOut=benchDays>=3;
 html+=`<div class="panel"><h3>板凳出路 <span class="tag">${benchDays?('连续替补 '+benchDays+' 天'):'暂未首发'}</span></h3>
 <div class="hint" style="margin-bottom:8px">长期没球打会伤士气。连续替补满 3 天后，可向经纪人申请<b>租借离队</b>（去缺人的俱乐部打 ${LOAN_DAYS} 天主力）或<b>下放 K甲</b>（二队练级 ${KJIA_DAYS} 天）——两条路都带成长，归队再争首发。</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn sm gold" onclick="playerRequestLoanOut(S)" ${canOut?'':'disabled'}> 租借离队（${LOAN_DAYS}天）</button>
 <button class="btn sm" onclick="playerRequestKjia(S)"> 下放 K甲（${KJIA_DAYS}天练级）</button>
 </div>
 ${canOut?'':'<div class="hint mt8">租借需连续替补满 3 天（K甲可随时申请）</div>'}
 </div>`;
 }
 // 转会报价（只有自己的）+ 主动申请转会
 const mst=playerStatus(me,S); // 集训/外租/K甲统一走状态出口（st.natCamp 内含 natCamping(S,me) 的计算）
 const canReq=!c.pendingMove&&!myOffers.length&&!mst.loanOut&&!mst.kjia&&!mst.natCamp&&!c.retired;
 html+=`<div class="panel"><h3>转会 <span class="tag">${c.pendingMove?'已锁定下家':myOffers.length?myOffers.length+' 份报价':'可主动申请'}</span></h3>
 ${myOffers.length?myOffers.map(o=>`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${o.team} 邀请你加盟</span>
 <div class="power" style="font-size:10px">报价 <b class="gold">${o.fee}万</b>（转会费越高，新俱乐部给你的薪资越好）· 第 ${o.expire} 天到期</div></div>
 <div style="display:flex;gap:4px">
 <button class="btn sm" onclick="respondOffer(S,${S.offers.indexOf(o)},'keep')">留队（涨薪 8%）</button>
 <button class="btn sm primary" onclick="respondOffer(S,${S.offers.indexOf(o)},'sell')">接受（赛段结束后加盟）</button>
 </div></div>`).join(''):`<div class="hint" style="margin-bottom:8px">表现火热（身价系数 ≥112%）会被动收到报价；也可主动向经纪人申请转会——总值/身价/人气决定有没有人接盘，合同最后一年更容易谈。</div>
 <button class="btn gold" onclick="playerRequestTransfer(S)" ${canReq?'':'disabled'}>📣 申请转会（经纪人寻找下家）</button>`}
 </div>`;
 if(c.pendingMove)html+=`<div class="panel" style="border-color:var(--gold)"><h3>转会意向 <span class="tag" style="color:var(--gold)">将加盟 ${c.pendingMove.team}</span></h3>
 <div class="hint">当前赛段继续为 ${S.teamName} 出战；打完挑战者杯/年总等收官战后，新赛季开始时正式加盟新东家。</div></div>`;
 // 履历
 html+=`<div class="panel"><h3>生涯履历 <span class="tag">${c.seasons.length} 个赛季</span></h3>
 ${c.seasons.length?`<table class="tbl"><tr><th>赛季</th><th>球队</th><th>出场</th><th>场均KDA</th><th>MVP</th><th>总值</th><th>身价</th><th>荣誉</th></tr>
 ${c.seasons.map(r=>`<tr><td>${r.year}</td><td>${r.team}</td><td>${r.apps}</td><td>${r.kda||'—'}</td><td>${r.mvp}</td><td>${r.ovr}</td><td>${r.val}%</td><td class="gold">${r.titles?r.titles+' 冠':''}</td></tr>`).join('')}</table>`:'<div class="hint">首个赛季进行中——每个赛季结束后这里记录你的一年</div>'}
 </div>`;
 el.innerHTML=html;
}
/* 每日成长行动：规则与结算已下沉 playerops（playerTrainDay / playerHeroTrainDay / playerRestDay）。
   这里只做 toast + 落盘 + 重渲染，符合 README「引擎与 UI 分离」约定。 */
function playerTrain(k){
 const r=playerTrainDay(S,k);
 if(!r.ok){if(r.reason)toast(r.reason);return;}
 save();renderAll();
 if(r.gain<=0)toast(r.note);
}
function playerHeroTrain(){
 const r=playerHeroTrainDay(S);
 if(!r.ok){if(r.reason)toast(r.reason);return;}
 save();renderAll();toast(r.hero+' 已练成绝活！');
}
function playerRest(){
 const r=playerRestDay(S);
 if(!r.ok){if(r.reason)toast(r.reason);return;}
 save();renderAll();
}
