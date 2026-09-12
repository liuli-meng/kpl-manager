function closeModal(id){$('#'+id).classList.remove('on');$('#'+id).classList.remove('wide');}

/* ================= 面板折叠（次要面板默认收起，点标题切换，偏好记忆） ================= */
function foldCls(key,def){
 let v=null;try{v=localStorage.getItem('pfold_'+key);}catch(e){}
 const collapsed=v==null?def==='collapsed':v==='1';
 return 'collapsible'+(collapsed?' collapsed':'');
}
document.addEventListener('click',e=>{
 const h3=e.target.closest('.panel.collapsible>h3');
 if(!h3)return;
 const panel=h3.parentElement;
 const folded=!panel.classList.contains('collapsed');
 panel.classList.toggle('collapsed',folded);
 try{localStorage.setItem('pfold_'+(panel.dataset.fold||h3.textContent.trim().slice(0,10)),folded?'1':'0');}catch(err){}
});

/* ================= 导航（按身份模式适配可见页签） ================= */
const MODE_PAGES={
 manager:['club','lineup','market','train','league','kjia','union','hall','biz'],
 player:['career','club','league','kjia','union','hall'], // 选手：生涯/球队日程/联赛/二队/联盟/荣誉馆
 coach:['club','lineup','train','league','kjia','union','hall'], // 教练：竞技全权，转会/经营由俱乐部打理
};
function applyModeNav(){
 const pages=MODE_PAGES[(S&&S.mode)||'manager']||MODE_PAGES.manager;
 let changed=false;
 $$('#nav button').forEach(b=>{
 const show=pages.includes(b.dataset.page);
 if(show&&b.style.display==='none')changed=true;
 b.style.display=show?'':'none';
 });
 const cur=document.querySelector('nav button.on');
 if(cur&&cur.style.display==='none'){cur.classList.remove('on');goPage(pages[0]);}
}
function goPage(name){
 $$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.page===name));
 $$('section.page').forEach(p=>p.classList.toggle('on',p.id==='page-'+name));
 renderHeader();
 renderPage(name);
}
function renderPage(name){
 if(name==='club')renderClub();
 else if(name==='lineup')renderLineup();
 else if(name==='market')renderMarket();
 else if(name==='train')renderTrain();
 else if(name==='league')renderLeague();
 else if(name==='kjia')renderKjia();
 else if(name==='career')renderCareer();
 else if(name==='union')renderUnion();
 else if(name==='hall')renderHall();
 else if(name==='biz')renderBiz();
}
function renderAll(){renderHeader();applyModeNav();const cur=document.querySelector('nav button.on');if(cur)renderPage(cur.dataset.page);}

/* ================= 存档管理（多槽位 + 导出/导入） ================= */
function openSaveMgmt(){
 const occ=i=>!!localStorage.getItem(SAVE_KEY+(i>1?'_'+i:''));
 $('#app-modal-body').innerHTML=`
 <h2>存档管理</h2>
 <div class="center" style="margin-bottom:12px">
 ${[1,2,3].map(i=>`<div class="pack-btn" ${i===curSlot?'style="border-color:var(--gold)"':''} onclick="setSlot(${i})">
 <b style="font-size:14px">槽${i}</b><span style="font-size:10px">${i===curSlot?'(当前)':occ(i)?'有档':'空槽'}</span></div>`).join('')}
 </div>
 <div class="hint" style="margin-bottom:8px">导出：点「下载存档文件」存成 .json（推荐，不易丢）或「复制导出」得到存档代码；导入：选本地存档文件，或粘贴代码后点「导入」（覆盖当前槽）。</div>
 <textarea id="save-io" style="width:100%;min-height:90px;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:11px;resize:vertical" placeholder="也可把存档代码粘贴到这里"></textarea>
 <input type="file" id="save-file" accept=".json,application/json" style="display:none" onchange="importSaveFile(this)">
 <div class="center mt8" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 <button class="btn sm" onclick="save();exportSave()"> 复制导出</button>
 <button class="btn sm" onclick="save();exportSaveFile()"> 下载存档文件</button>
 <button class="btn sm primary" onclick="pickSaveFile()"> 从文件导入</button>
 <button class="btn sm primary" onclick="importSave()"> 导入</button>
 <button class="btn sm" onclick="restoreAutoBackup()" ${localStorage.getItem(slotKey()+'_auto')?'':'disabled'}> 恢复赛季备份</button>
 <button class="btn sm" onclick="closeModal('app-modal')">关闭</button>
 </div>`;
 $('#app-modal').classList.add('on');
}
/* 赛季轮转自动备份的恢复：把 _auto 快照写回当前槽（覆盖前先把它再挪一份，防二次误操作） */
function restoreAutoBackup(){
 const raw=localStorage.getItem(slotKey()+'_auto');
 if(!raw){toast('当前槽没有赛季备份（每完成一个赛季自动生成）');return;}
 if(!confirm('用上一年赛季末的备份覆盖当前存档？当前进度将先被挪到「恢复前备份」'))return;
 try{
 const cur=localStorage.getItem(slotKey());
 if(cur)localStorage.setItem(slotKey()+'_pre_restored',cur);
 S=JSON.parse(raw);
 if(typeof installEra==='function')installEra((S.era&&KPL_ERAS[S.era])?S.era:null);
 migrateSave();save();renderAll();closeModal('app-modal');
 toast('已恢复到上赛季末（覆盖前进度存在「恢复前备份」，可再次恢复找回）');
 }catch(e){toast('恢复失败：备份不可用');}
}
function setSlot(i){
 curSlot=i;localStorage.setItem('esport_manager_curslot',String(i));
 if(load()){save();renderAll();closeModal('app-modal');toast('已切换到 槽'+i);}
 else{S=null;closeModal('app-modal');initStart();toast('槽'+i+' 暂无存档，请创建新战队开局');}
}
function exportSave(){
 const t=$('#save-io');
 t.value=b64e(serializeForSave(S));
 t.select();
 try{document.execCommand('copy');}catch(e){}
 toast('存档已复制，请妥善保存');
}
function importSave(){
 const v=$('#save-io').value.trim();
 if(!v){toast('请先粘贴存档代码');return;}
 try{
 const d=JSON.parse(b64d(v));
 applyImport(d,'粘贴代码');
 }catch(e){toast('导入失败：存档代码无效');}
}
/* 存档文件导出：下载 .json（含版本号与导出时间，跨设备备份推荐方式） */
function pickSaveFile(){$('#save-file').click();}
function exportSaveFile(){
 try{
 save();
 const wrap={kplSave:true,v:SAVE_VERSION,exported:new Date().toISOString().slice(0,10),team:S.teamName,season:S.season,data:JSON.parse(serializeForSave(S))};
 const blob=new Blob([JSON.stringify(wrap)],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download='KPL存档_'+(S.teamName||'无名')+'_'+gameYear(S)+'年_槽'+curSlot+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),5000);
 toast('存档文件已下载（'+a.download+'）');
 }catch(e){toast('导出失败：'+(e.message||e));}
}
/* 存档文件导入：兼容两种格式——本游戏的包装格式{kplSave,data}与裸存档对象（含旧版剪贴板代码解出的对象） */
function importSaveFile(inp){
 const f=inp.files&&inp.files[0];
 if(!f)return;
 const rd=new FileReader();
 rd.onload=()=>{
 try{
 const d=JSON.parse(rd.result);
 applyImport(d,'文件「'+f.name+'」');
 }catch(e){toast('导入失败：不是有效的存档文件');}
 };
 rd.readAsText(f);
 inp.value='';
}
/* 导入共用：解包→版本校验→注入→迁移→落盘（剪贴板代码与文件导入共用） */
function applyImport(d,from){
 if(d&&d.kplSave&&d.data)d=d.data; // 文件包装格式→裸存档
 if(!d||!d.teamName||!d.players){toast('导入失败：'+from+' 不是有效存档');return;}
 if(d.v&&d.v>SAVE_VERSION){toast('导入失败：存档版本（v'+d.v+'）比当前游戏更新，请先更新游戏');return;}
 S=d;
 // 时代联盟按档重装：era 档装该时代；导入现代档时必须还原默认联盟（否则浏览器里装过的时代残留错装）
 if(typeof installEra==='function')installEra((S.era&&KPL_ERAS[S.era])?S.era:null);
 migrateSave();save();renderAll();closeModal('app-modal');
 toast('已从'+from+'导入：'+S.teamName+'（'+gameYear(S)+'年 · v'+S.v+'）');
}
function resetGame(){
 if(confirm('确定重新开始？将清空当前槽存档')){
 localStorage.removeItem(slotKey());
 location.reload();
 }
}

/* ================= 赞助商 ================= */
/* 战术板：切换系列赛倾向（改四维权重，强弱项随阵容取舍），克制关系在比赛模拟处结算 */
function setTactic(id){
 const t=tacticById(id);
 S.tactic=t.id;
 S.tacticW=t.w;
 logEvent(S,' 战术板：切换为「'+t.name+'」——'+t.desc+(t.beats?'（克制「'+tacticById(t.beats).name+'」）':''));
 save();renderAll();
}
/* 队长任命：队长在首发阵中生效（全队战力 +2%），任命时全队士气提升；离队自动摘除（更衣室年检） */
function setCaptain(id){
 const p=(S.players||[]).find(x=>x.id===id);
 if(!p){toast('选手不在阵中');return;}
 if(S.captain===id){S.captain=null;logEvent(S,' 摘除队长袖标：'+p.name);}
 else{
 S.captain=id;
 (S.players||[]).forEach(x=>x.morale=clamp(x.morale+(x.id===id?5:3),20,100));
 logEvent(S,' 任命 '+p.name+' 为队长：全队士气提升，队长在阵时全队战力 +2%');
 }
 save();renderAll();
}
function upgradeSponsor(){
 const next=SPONSORS[S.sponsorLv+1];
 if(!next)return;
 if(S.fund<next.cost){toast('资金不足（需 '+next.cost+'万）');return;}
 const fans=Math.round(S.fans||0);
 if((next.fans||0)>fans){toast('粉丝不足：「'+next.name+'」要求 '+(next.fans||0)+' 万粉丝（当前 '+fans+' 万）——成绩与人气才能换来关注');return;}
 S.fund-=next.cost;S.sponsorLv++;
 logEvent(S,` 签约新赞助商「${next.name}」，每日收入 ${next.income}万（粉丝 ${fans} 万）`);
 save();renderAll();toast(`赞助商升级成功！`);
}
/* 教练生涯：回应豪门邀约（接受=换队执教重建班底，婉拒=留任加信任） */
function respondCoachOffer(accept){
 if(!S||!S.coachOffer)return;
 const o=S.coachOffer;
 const d=S.coachDeal=S.coachDeal||{years:0,honors:[],log:[]};
 if(accept){
 const tmpl=CLUB_TEMPLATES.find(c=>c.name===o.team);
 if(!tmpl){S.coachOffer=null;return;}
 d.log.unshift({year:gameYear(S),note:'离任 '+S.teamName+'，转投 '+tmpl.name});
 d.log=d.log.slice(0,8);
 S.teamName=tmpl.name;S.icon=tmpl.icon;
 S.fund=tmpl.budget;S.wageCap=tmpl.cap;
 S.players=[];
 tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(x=>x.id===pid);if(def)S.players.push(genPlayer(def));});
 const byPos={};
 S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{const cand=byPos[pos];if(cand&&cand.length){cand.sort((a,b)=>playerPower(b)-playerPower(a));lineup.push(cand[0].id);}});
 S.lineup=lineup;
 S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 S.seedPower=teamPower(S)||tmpl.seed;
 S.board.trust=clamp((S.board?S.board.trust:60)+10,0,100); // 新东家信任重置偏高
 S.board.warn=0;
 logEvent(S,' 你接受 '+tmpl.name+' 的邀约：新班底战力 '+fmt(teamPower(S))+'——用成绩证明他们的选择');
 }else{
 d.log.unshift({year:gameYear(S),note:'婉拒 '+o.team+' 邀约，留任 '+S.teamName});
 d.log=d.log.slice(0,8);
 S.board.trust=clamp((S.board?S.board.trust:60)+3,0,100);
 logEvent(S,' 你婉拒了 '+o.team+' 的邀约，留任 '+S.teamName+'（管理层信任 +3）');
 }
 S.coachOffer=null;
 save();renderAll();
}

/* ================= 开局 ================= */
function clubCardHTML(c,i){
 return `<div class="club-card" data-ci="${i}" onclick="pickClub(${i})" style="cursor:pointer;background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:10px;text-align:center;transition:.15s">
 <div>${crest(c.icon,c.name,32)}</div>
 <div style="font-weight:800;font-size:13px;margin:4px 0">${c.name}</div>
 <div class="hint" style="font-size:10px;line-height:1.5">预算 ${c.budget}万 · 工资帽 ${c.cap}万<br>${c.desc}</div>
 </div>`;
}
/* 教练生涯卡片：与 clubCardHTML 同观感，但回调走 pickCoachClub（旧版错绑 pickClub 会导致「开始执教」永远点不亮） */
function coachCardHTML(c,i){
 return `<div class="club-card" data-ci="${i}" onclick="pickCoachClub(${i})" style="cursor:pointer;background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:10px;text-align:center;transition:.15s">
 <div>${crest(c.icon,c.name,32)}</div>
 <div style="font-weight:800;font-size:13px;margin:4px 0">${c.name}</div>
 <div class="hint" style="font-size:10px;line-height:1.5">班底战力约 ${c.seed||'—'} · 工资帽 ${c.cap}万<br>${c.desc}</div>
 </div>`;
}
/* 从游戏内「历代联盟·史册」页进入时代选择：打开开局面板并切到历代标签（当前存档保留，真正开新档才覆盖） */
function gotoEraStart(){
 if(S&&S.teamName&&!confirm('体验历史时代将开一个新档（当前存档不会被立即清除；只有你完成选档开新局才会覆盖，建议先导出存档备份）——继续？'))return;
 initStart();pickScenario('normal');
 switchStartTab('era');
 const firstEra=Object.keys(KPL_ERAS)[0];
 if(firstEra)pickEra(firstEra); // 预选第一个时代：进来就能直接选俱乐部
 const m=document.getElementById('start-modal-body');
 if(m&&!document.getElementById('era-cancel'))m.insertAdjacentHTML('beforeend',
 '<div class="center mt8"><button class="btn sm" id="era-cancel" onclick="cancelStartBack()">← 返回当前存档</button></div>');
 try{window.scrollTo(0,0);}catch(_){}
}
/* 取消时代选择：关面板并按当前存档重装联盟（时代档恢复该时代，普通档还原现役），游戏原样继续 */
function cancelStartBack(){
 closeModal('start-modal');
 if(typeof installEra==='function')installEra((S&&S.era&&KPL_ERAS[S.era])?S.era:null);
 if(S)renderAll();
}
function initStart(){
 _crReset(); // 新档：队徽生成器回默认（盾形·红金配色）
 installEra(null);_eraSel=null;_eraSelCoach=null;_pcTeam=null; // 开局界面从默认（现役）联盟起步
 const clubs=CLUB_TEMPLATES.map((c,i)=>clubCardHTML(c,i)).join('');
 const eraBtns=Object.keys(KPL_ERAS).map(id=>`<button class="btn sm" id="era-btn-${id}" onclick="pickEra('${id}')">${KPL_ERAS[id].name}</button>`).join('');
 $('#start-modal-body').innerHTML=`
 <h2>王者电竞经理 · KPL 篇</h2> <div class="center dim" style="font-size:12px;margin-bottom:14px">化身战队经理：签约选手、经营俱乐部、征战联赛、冲击总冠军</div>
 <div class="center" style="margin-bottom:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 <button class="btn sm" id="tab-player" onclick="switchStartTab('player')">选手生涯</button>
 <button class="btn sm" id="tab-coach" onclick="switchStartTab('coach')">教练生涯</button>
 <button class="btn sm primary" id="tab-self" onclick="switchStartTab('self')">经理模式</button>
 <button class="btn sm" id="tab-club" onclick="switchStartTab('club')">执教现役俱乐部</button>
 <button class="btn sm" id="tab-era" onclick="switchStartTab('era')">历代联盟</button>
 </div>
 <div id="tab-scenario" style="margin-bottom:12px">
 <div class="center dim" style="font-size:12px;margin-bottom:6px">开局剧本（难度档 · 可选）</div>
 <div class="center" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
 ${SCENARIOS.map(s=>`<button class="btn sm" id="sc-btn-${s.id}" onclick="pickScenario('${s.id}')">${s.hard?'':'○ '}${s.name}</button>`).join('')}
 </div>
 <div class="center hint" id="sc-desc" style="margin-top:6px">${SCENARIOS[0].desc}</div>
 </div>
 <div id="tab-player-body" style="display:none">
 <div class="hint" style="text-align:center;margin-bottom:10px">扮演一名职业选手：签约球队 → 竞争首发 → 打出数据 → 收报价转会 → 冲击总冠军与 FMVP（比赛由教练组指挥，你专注成长与表现）</div>
 <div class="center" style="margin-bottom:10px"><span class="dim">选手 ID：</span><input id="pc-name" maxlength="8" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 12px;font-size:15px;width:150px" placeholder="你的ID"></div>
 <div class="center" style="margin-bottom:10px"><span class="dim" style="margin-right:6px">位置：</span>${POS_ORDER.map(p=>`<button class="btn sm" id="pc-pos-${p}" onclick="pickPlayerPos('${p}')">${POS[p][0]}</button>`).join('')}</div>
 <div class="center" style="margin-bottom:10px"><span class="dim" style="margin-right:6px">出身：</span>${PLAYER_ARCHETYPES.map((a,i)=>`<button class="btn sm" id="pc-arch-${i}" onclick="pickPlayerArch(${i})" title="${a.desc}">${a.n}</button>`).join('')}</div>
 <div class="center dim" style="font-size:12px;margin:6px 0">选择加盟球队（签 2 年合同，队内同位置需要竞争首发）</div>
 <div class="grid g3" id="pc-teams" style="gap:8px"></div>
 <div class="center mt8"><button class="btn sm" onclick="rollPlayerTeams()">换一批球队</button></div>
 <div class="center" style="margin:12px 0"><button class="btn primary" style="padding:12px 40px;font-size:15px" onclick="createPlayerCareer()">开启选手生涯</button></div>
 </div>
 <div id="tab-coach-body" style="display:none">
 <div class="hint" style="margin-bottom:10px;text-align:center">只管竞技的执教生涯：BP/战术/训练/首发全权负责，转会与资金由俱乐部打理——成绩好被豪门挖角，连年失利会被解约（从任意一队起步）</div>
 <div class="grid g4" id="coach-clubs" style="gap:8px">${CLUB_TEMPLATES.map((c,i)=>coachCardHTML(c,i)).join('')}</div>
 <div class="hint" style="margin:10px 0;text-align:center;color:var(--cyan)" id="coach-pick-tip"> 点击选择执教的俱乐部</div>
 <div class="center"><button class="btn gold" style="padding:12px 44px;font-size:16px" onclick="applyCoachClub()" id="coach-apply-btn" disabled>开始执教生涯</button></div>
 </div>
 <div id="tab-self-body">
 <div class="center" style="margin-bottom:12px">
 <span class="dim">战队名称：</span><input id="new-team-name" maxlength="8" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 12px;font-size:15px;width:180px" placeholder="输入队名" oninput="refreshCrUI()">
 </div>
 <div id="cr-builder">${crestBuilderHTML('')}</div>
 <div class="hint" style="margin:6px 0 14px;text-align:center">初始资金 8000万 · 工资帽 900万 · 开局组建你的 KPL 战队（含一名 90+ 王牌）</div>
 <div class="center"><button class="btn primary" style="padding:12px 44px;font-size:16px" onclick="createTeam()">创建战队</button></div>
 </div>
 <div id="tab-club-body" style="display:none">
 <div class="hint" style="margin-bottom:10px;text-align:center">直接执教一支现役 KPL 俱乐部——豪门预算拉满，草根从零挑战，继承该队首发阵容与主教练</div>
 <div class="grid g4" style="gap:8px">${clubs}</div>
 <div class="hint" style="margin:10px 0;text-align:center;color:var(--cyan)" id="club-pick-tip"> 点击选择俱乐部</div>
 <div class="center"><button class="btn gold" style="padding:12px 44px;font-size:16px" onclick="applyClub()" id="club-apply-btn" disabled>执教所选俱乐部</button></div>
 </div>
 <div id="tab-era-body" style="display:none">
 <div class="hint" style="margin-bottom:10px;text-align:center">2K 经典球队式开档：选择一个 KPL 时代，扮演那个时代的真实俱乐部——联盟对手、阵容、教练全部回到当年（明星阵容按史实收录，年代久远的席位由游戏演绎；赛制沿用现行年度赛历）</div>
 <div class="center" style="margin-bottom:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${eraBtns}</div>
 <div class="hint" id="era-desc" style="margin:0 0 10px;text-align:center;color:var(--cyan)">点击上方选择时代</div>
 <div class="grid g4" id="era-clubs" style="gap:8px"></div>
 <div class="hint" style="margin:10px 0;text-align:center;color:var(--cyan)" id="era-pick-tip"> 先选时代，再选俱乐部</div>
 <div class="center"><button class="btn gold" style="padding:12px 44px;font-size:16px" onclick="applyEraClub()" id="era-apply-btn" disabled>执教所选时代俱乐部</button></div>
 </div>`;
 $('#start-modal').classList.add('on');
 pickScenario('normal'); // 剧本按钮回到默认高亮（弹窗重建后 class 会丢）
 rollPlayerTeams();pickPlayerPos('mid');pickPlayerArch(0); // 选手页默认值
}
let _clubPick=-1,_eraSel=null,_scenario='normal';
let _pcPos='mid',_pcArch=0,_pcTeam=null,_coachPick=-1,_eraSelCoach=null;
/* 选手出身档（决定初始属性/年龄/知名度） */
const PLAYER_ARCHETYPES=[
 {id:'youth',n:'青训新秀',age:17,base:[64,64,64,64],wageMul:0.4,pop:5,career:'青训营出道，天赋肉眼可见',desc:'17岁 · 属性低但成长空间全在面前'},
 {id:'semi',n:'次级联赛',age:19,base:[72,71,72,70],wageMul:0.8,pop:12,career:'K甲辗转三年，等待一个机会',desc:'19岁 · 即战力适中，马上能打'},
 {id:'returnee',n:'海归选手',age:21,base:[77,76,78,75],wageMul:1.6,pop:26,career:'海外赛区归来，身价不菲',desc:'21岁 · 高起点高薪资，即插即用'},
];
function pickPlayerPos(p){
 _pcPos=p;
 POS_ORDER.forEach(x=>{const b=document.getElementById('pc-pos-'+x);if(b)b.className='btn sm'+(x===_pcPos?' primary':'');});
}
function pickPlayerArch(i){
 _pcArch=i;
 PLAYER_ARCHETYPES.forEach((a,x)=>{const b=document.getElementById('pc-arch-'+x);if(b)b.className='btn sm'+(x===_pcArch?' primary':'');});
 const d=$('#sc-desc');
 if(d)d.textContent=PLAYER_ARCHETYPES[_pcArch].desc+' · '+PLAYER_ARCHETYPES[_pcArch].career;
}
function rollPlayerTeams(){
 const pool=CLUB_TEMPLATES.slice();
 window._pcTeams=[];
 for(let i=0;i<3&&pool.length;i++)window._pcTeams.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
 if(!_pcTeam||!window._pcTeams.some(c=>c.name===_pcTeam))_pcTeam=window._pcTeams[0].name;
 const box=$('#pc-teams');
 if(box)box.innerHTML=window._pcTeams.map(c=>`<div class="club-card" style="cursor:pointer;border-color:${c.name===_pcTeam?'var(--cyan)':'var(--line)'}" onclick="pickPlayerTeam('${c.name}')">
 ${crest(c.icon,c.name,30)}<div style="font-weight:800;font-size:13px;margin:4px 0">${c.name}</div>
 <div class="hint" style="font-size:10px">战力约 ${c.seed||'—'} · ${c.desc}</div></div>`).join('');
}
function pickPlayerTeam(n){_pcTeam=n;rollPlayerTeams();}
/* 开局身份切换（选手/教练/经理/执教/历代） */
function switchStartTab(tab){
 const tabs=['player','coach','self','club','era'];
 tabs.forEach(t=>{const b=document.getElementById('tab-'+t);if(b)b.className='btn sm'+(t===tab?' primary':'');});
 ['player','coach','self','club','era'].forEach(t=>{
 const body=document.getElementById('tab-'+t+'-body');if(body)body.style.display=t===tab?'':'none';
 });
 if(tab==='player'){const d=$('#sc-desc');if(d)d.textContent=PLAYER_ARCHETYPES[_pcArch].desc;}
 if(tab!=='club'&&_eraActive){installEra(null);_eraSel=null;_clubPick=-1;}
 if(tab==='coach'){
 // 教练页从默认（现役）联盟起步：若浏览过时代先还原
 installEra(null);_eraSelCoach=null;_coachPick=-1;
 const grid=document.getElementById('coach-clubs');
 if(grid)grid.innerHTML=CLUB_TEMPLATES.map((c,i)=>coachCardHTML(c,i)).join('');
 const tip=$('#coach-pick-tip');if(tip)tip.textContent=' 点击选择执教的俱乐部';
 const btn=$('#coach-apply-btn');if(btn)btn.disabled=true;
 }
 if(tab==='era'){
 Object.keys(KPL_ERAS).forEach(k=>{
 const b=document.getElementById('era-btn-'+k);if(b)b.className='btn sm'+(k===_eraSel?' primary':'');
 });
 const eb=$('#era-apply-btn');if(eb)eb.disabled=!(_eraSel&&_clubPick>=0);
 }
}
/* 教练生涯：选俱乐部（与执教现役俱乐部同一套卡片） */
function pickCoachClub(i){
 _coachPick=i;
 const grid=document.getElementById('coach-clubs');
 if(grid&&grid.children&&typeof grid.children[Symbol.iterator]==='function'){
 [...grid.children].forEach((c,idx)=>{c.style.borderColor=idx===i?'var(--cyan)':'var(--line)';});
 }
 const tip=$('#coach-pick-tip');if(tip)tip.textContent='已选择：'+(CLUB_TEMPLATES[i]?CLUB_TEMPLATES[i].name:'');
 const btn=$('#coach-apply-btn');if(btn)btn.disabled=false;
}
/* 教练生涯开局：只管竞技——转会与资金由俱乐部打理，董事会=俱乐部管理层 */
function applyCoachClub(){
 if(_coachPick<0){toast('请先选择俱乐部');return;}
 const tmpl=CLUB_TEMPLATES[_coachPick];
 S=newState(tmpl.name,tmpl.icon);
 S.mode='coach';
 S.era=_eraSelCoach||null;
 S.fund=tmpl.budget;S.wageCap=tmpl.cap;
 S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 tmpl.players.forEach(pid=>{
 const def=PLAYER_POOL.find(d=>d.id===pid);
 if(def)S.players.push(genPlayer(def));
 });
 const byPos={};
 S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=byPos[pos];
 if(cand&&cand.length){cand.sort((a,b)=>playerPower(b)-playerPower(a));lineup.push(cand[0].id);}
 });
 S.lineup=lineup;
 S.coachDeal={years:2,honors:[],log:[]}; // 教练合同：2 年起步，成绩决定去留
 S.seedPower=teamPower(S)||tmpl.seed;
 initGroups(S);
 S.preseason=false;S.transferWindow=0; // 俱乐部引援自动处理，无需转会期
 setBoardKpi(S);initFans(S);
 initKjia(S);
 logEvent(S,' 教练生涯开启：你出任 '+tmpl.name+' 主教练（合同 2 年）——竞技全权负责，转会资金由俱乐部打理');
 logEvent(S,' 目标：带队出成绩。连续未达标会被解约；打出名气会有豪门来挖你');
 $('#start-modal').classList.remove('on');
 applyModeNav();
 goPage('club');
 toast(' 教练生涯开启：带队打出成绩！');
 save();
}
/* 选手生涯开局：创建选手 → 加盟球队 → 竞争首发 */
function createPlayerCareer(){
 installEra(null);_eraSel=null;
 const name=$('#pc-name').value.trim()||'无名小将';
 const tmpl=CLUB_TEMPLATES.find(c=>c.name===_pcTeam)||window._pcTeams[0];
 S=newState(tmpl.name,tmpl.icon);
 S.mode='player';
 S.fund=tmpl.budget;S.wageCap=tmpl.cap;
 S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 tmpl.players.forEach(pid=>{
 const def=PLAYER_POOL.find(d=>d.id===pid);
 if(def)S.players.push(genPlayer(def));
 });
 const arch=PLAYER_ARCHETYPES[_pcArch];
 const base=arch.base.map(v=>clamp(v+rnd(-1,2),40,90));
 const def={id:'me_'+Date.now().toString(36),name,pos:_pcPos,team:tmpl.name,tags:[],
 base,skill:{n:pick(['新星','大心脏','多面手','永动机'])+'体质',t:pick(['lane','farm','team','mind']),d:'职业生涯由你书写'},
 sig:pick(HEROES.filter(h=>h.pos[0]===_pcPos)).n,
 career:arch.career+'，'+arch.age+' 岁，渴望在 KPL 证明自己。'};
 const me=genPlayer(def);
 me.age=arch.age;
 me.wage=Math.max(3,Math.round(me.wage*arch.wageMul));
 me.contract=2;
 me.popularity=Math.max(me.popularity,arch.pop);
 S.players.push(me);
 S.career={me:me.id,seasons:[],titles:0,fmvp:0,allstar:0,nat:0,retired:false,pendingMove:null};
 // 首发按俱乐部最强阵容（同位置有我时取更强者——首发要靠竞争）
 const byPos={};
 S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=byPos[pos];
 if(cand&&cand.length){cand.sort((a,b)=>playerPower(b)-playerPower(a));lineup.push(cand[0].id);}
 });
 S.lineup=lineup;
 S.seedPower=teamPower(S)||300;
 initGroups(S);
 S.preseason=false;S.transferWindow=0;
 initKjia(S);
 initFans(S);
 const starter=S.lineup.includes(me.id);
 logEvent(S,' 选手生涯开启：'+me.name+'（'+POS[_pcPos][0]+' · '+arch.n+'）签约 '+tmpl.name+'（2 年合同）');
 logEvent(S,starter?' 你已进入首发轮换——用表现锁住它':' 首发竞争激烈：先在「生涯」页加练，教练会在每场比赛前按状态排首发');
 $('#start-modal').classList.remove('on');
 applyModeNav();
 goPage('career');
 toast(' 选手生涯开启：'+(starter?'你已在首发阵容':'先争取首发位置！'));
 save();
}
/* 开局剧本（难度档）：选中态只影响开局初始值，见 data.js SCENARIOS */
function pickScenario(id){
 _scenario=scenarioById(id).id;
 SCENARIOS.forEach(s=>{
  const b=document.getElementById('sc-btn-'+s.id);
  if(b)b.className='btn sm'+(s.id===_scenario?' primary':'');
 });
 const d=$('#sc-desc');
 if(d)d.textContent=scenarioById(_scenario).desc;
}
/* 把当前选中的剧本应用到刚建好的档（资金/工资帽/阵容/属性），并写入日志与成就判定依据 */
function applyScenario(s){
 s.scenario=_scenario||'normal';
 const sc=scenarioById(s.scenario);
 const dropped=sc.apply(s)||null;
 logEvent(s,'开局剧本「'+sc.name+'」：'+sc.desc+(dropped?'（离开的是 '+dropped.name+'）':''));
 return sc;
}
/* 旧 switchStartTab 已并入上方五标签统一版（含选手/教练页）；此处不再重复定义，
   否则按加载顺序后者覆盖前者，选手/教练标签会切不动 */
/* 历代联盟：选时代（安装该时代联盟）→ 选俱乐部 → 复用 applyClub 开档流程 */
function pickEra(id){
 installEra(id);_eraSel=null;_clubPick=-1;
 // 安装成功才记录选择（未知的 era id 保持未选状态）
 if(_eraActive===id)_eraSel=id;
 Object.keys(KPL_ERAS).forEach(k=>{
  const b=document.getElementById('era-btn-'+k);
  if(b)b.className=k===_eraSel?'btn sm primary':'btn sm';
 });
 $('#era-desc').textContent=_eraSel?KPL_ERAS[id].desc:'该时代不可用';
 $('#era-clubs').innerHTML=_eraSel?CLUB_TEMPLATES.map((c,i)=>clubCardHTML(c,i)).join(''):'';
 $('#era-pick-tip').textContent=_eraSel?' 点击选择俱乐部':' 该时代不可用';
 const ebtn=$('#era-apply-btn');if(ebtn)ebtn.disabled=true;
}
function pickClub(i){
 _clubPick=i;
 $$('.club-card').forEach(c=>{c.style.borderColor=parseInt(c.dataset.ci)===i?'var(--cyan)':'var(--line)';});
 const tip=$('#club-pick-tip'),etip=$('#era-pick-tip');
 const name=CLUB_TEMPLATES[i]?CLUB_TEMPLATES[i].name:'';
 if(tip)tip.textContent='已选择：'+name;
 if(etip)etip.textContent='已选择：'+name;
 const btn=$('#club-apply-btn'),ebtn=$('#era-apply-btn');
 if(btn)btn.disabled=false;
 if(ebtn)ebtn.disabled=false;
}
function applyEraClub(){
 if(!_eraSel){toast('请先选择时代');return;}
 if(_clubPick<0){toast('请先选择俱乐部');return;}
 applyClub();
}
function createTeam(){
 // 自建队只开现役联盟：用户可能浏览过「历代联盟」标签（联盟被装成时代数据），必须先还原
 installEra(null);_eraSel=null;
 const name=$('#new-team-name').value.trim()||'无名战队';
 const b=_crBrandFor(name);
 if(!b.txt)b.txt=shortMark(name)||'队';
 S=newState(name,(b.txt||'队').slice(0,1));
 S.crest={sh:b.sh,c1:b.c1,c2:b.c2,c3:b.c3,txt:b.txt};
 S.selfBuilt=true; // 自建俱乐部开局（成就「白手起家」条件；执教原版不触发）
 // 直签开局：使用独立的自由球员池（与 18 队注册名单不重叠，保证全联盟一人一队）
 shuffle(ACADEMY_NAMES); // 打乱池序：开档阵容名字每次不同（池序决定 find 命中，否则恒为 弈秋/观澜/听松/照夜/惊蛰）
 const usedNames=new Set();
 POS_ORDER.forEach((pos,i)=>{
 const band=i===0?'star':'mid'; // 保底一名 90+ 王牌，其余主力级（档位决定四维基准）
 S.players.push(genPlayer(genFreeAgentDef(pos,band,usedNames)));
 });
 // 仍不足5人则按空缺位置强制补签
 while(POS_ORDER.some(pos=>!S.players.some(p=>p.pos===pos))){
 const miss=POS_ORDER.find(pos=>!S.players.some(p=>p.pos===pos));
 const cand=PLAYER_POOL.filter(p=>p.pos===miss&&!S.players.some(x=>x.id===p.id));
 if(cand.length)S.players.push(genPlayer(pick(cand)));
 else break;
 }
 // 按位置安排首发（每位置1人，多出的进替补，缺的留空）
 const byPos={};
 S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=byPos[pos];
 if(cand&&cand.length){
 cand.sort((a,b)=>playerPower(b)-playerPower(a));
 lineup.push(cand[0].id);
 }
 });
 S.lineup=lineup;
 applyScenario(S); // 开局剧本：可能削属性/砍工资帽/挖走主力——必须在 seedPower 与 initGroups 之前
 // 新手教练：青训助教
 S.coach={...COACH_POOL.find(c=>c.id==='co12')};
 S.seedPower=teamPower(S)||280; // 种子=开局真实战力（决定分组落位）
 initGroups(S); // KPL 2025 官方赛制：18队 S/A/B 分组
 // 赛前转会期：先组队再开赛
 S.preseason=true;S.transferWindow=7;
 setBoardKpi(S); // 首年董事会目标：按分组档位定（S组→前4 / A组→前8 / B组→前12）
 initFans(S); // 开档粉丝：由阵容人气决定起步规模（影响赞助单价/门票/代言与升级门槛）
 buildTransferMarket(S);refreshMarket(S);
 logEvent(S,`战队 ${name} 成立！初始资金8000万，目标：KPL 总冠军！`);
 logEvent(S,' 开局直签 5 名选手 + 青训助教，赛前转会期 7 天可自由调整阵容');
 logEvent(S,' 赛前转会期开启（7天）：买断/直签/挂牌自由组队，市场刷新免费；结束转会期后联赛开打');
 logEvent(S,' KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛');
 $('#start-modal').classList.remove('on');
 goPage('market');
 toast(' 赛前转会期开启（7天）：先组队，再开赛');
 save();
}
/* 执教原版俱乐部：继承豪门/草根的预算、工资帽、教练与首发阵容（含历代联盟时代俱乐部） */
function applyClub(){
 if(_clubPick<0){toast('请先选择俱乐部');return;}
 const tmpl=CLUB_TEMPLATES[_clubPick];
 S=newState(tmpl.name,tmpl.icon);
 S.era=_eraSel||null; // 历代联盟时代标记（读档时重装该时代联盟）
 S.fund=tmpl.budget;
 S.wageCap=tmpl.cap;
 S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 tmpl.players.forEach(pid=>{
 const def=PLAYER_POOL.find(d=>d.id===pid);
 if(def)S.players.push(genPlayer(def));
 });
 // 首发直接安排模板阵容（同位置多取战力最高）
 const byPos={};
 S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=byPos[pos];
 if(cand&&cand.length){
 cand.sort((a,b)=>playerPower(b)-playerPower(a));
 lineup.push(cand[0].id);
 }
 });
 S.lineup=lineup;
 applyScenario(S); // 开局剧本：同上，须在 seedPower 与 initGroups 之前
 S.seedPower=teamPower(S)||tmpl.seed; // 种子=执教班底真实战力（决定分组落位）
 initGroups(S);
 // 赛前转会期：先组队再开赛
 S.preseason=true;S.transferWindow=7;
 setBoardKpi(S); // 首年董事会目标：按分组档位定（S组→前4 / A组→前8 / B组→前12）
 initFans(S); // 开档粉丝：由阵容人气决定起步规模（影响赞助单价/门票/代言与升级门槛）
 buildTransferMarket(S);refreshMarket(S);
 logEvent(S,`你正式执教 ${tmpl.name}！预算 ${tmpl.budget}万，工资帽 ${tmpl.cap}万/周`);
 logEvent(S,`主教练 ${S.coach.name} 已就位，首发：${lineup.map(id=>S.players.find(p=>p.id===id).name).join(' / ')}`);
 logEvent(S,' 赛前转会期开启（7天）：买断/直签/挂牌自由组队，市场刷新免费；结束转会期后联赛开打');
 if(S.era)logEvent(S,' 历代联盟 '+KPL_ERAS[S.era].name+'：联盟成员与阵容回到当年（明星按史实，部分席位演绎）；赛制沿用现行年度赛历');
 else logEvent(S,' KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛');
 $('#start-modal').classList.remove('on');
 goPage('market');
 toast(' 赛前转会期开启（7天）：先组队，再开赛');
 save();
}

/* ================= 音效系统（WebAudio 合成短音，无资源文件；音量极小不打扰） ================= */
let _ac=null,_sfxOn=true;
try{_sfxOn=localStorage.getItem('km_sfx')!=='0';}catch(_){}
function sfx(freq,dur,type,vol){
 if(!_sfxOn)return;
 try{
 _ac=_ac||new (window.AudioContext||window.webkitAudioContext)();
 if(_ac.state==='suspended')_ac.resume();
 const o=_ac.createOscillator(),g=_ac.createGain();
 o.type=type||'sine';o.frequency.value=freq;
 const t=_ac.currentTime;
 g.gain.setValueAtTime(vol||0.04,t);
 g.gain.exponentialRampToValueAtTime(0.0001,t+(dur||0.12));
 o.connect(g);g.connect(_ac.destination);
 o.start(t);o.stop(t+(dur||0.12)+0.02);
 }catch(_){}
}
const SFX={
 click:()=>sfx(660,.05,'square',.022),
 win:()=>{sfx(523,.11);setTimeout(()=>sfx(784,.15),95);},
 lose:()=>sfx(311,.16,'triangle',.045),
 gold:()=>{sfx(880,.07);setTimeout(()=>sfx(1174,.09),70);},
};
function toggleSfx(){
 _sfxOn=!_sfxOn;
 try{localStorage.setItem('km_sfx',_sfxOn?'1':'0');}catch(_){}
 toast(_sfxOn?' 音效已开启':' 音效已关闭');
 renderHeader();
}
/* 点击轻反馈（按钮/卡/BAN 位） */
document.addEventListener('click',e=>{
 try{if(e.target&&e.target.closest&&e.target.closest('button,.bp-hero,.pack-btn'))SFX.click();}catch(_){}
});
/* ================= 选手卡 3D 倾斜（仅指针设备；触屏与减弱动效自动跳过） ================= */
let _tilt=null;
document.addEventListener('mousemove',e=>{
 try{
 if(window.matchMedia&&(!window.matchMedia('(pointer:fine)').matches||window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
 const c=e.target&&e.target.closest?e.target.closest('.pcard'):null;
 if(c!==_tilt){if(_tilt){_tilt.style.transform='';_tilt.style.transition='';}_tilt=c;}
 if(!c)return;
 const r=c.getBoundingClientRect();
 if(!r.width)return;
 const px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
 c.style.transition='transform 80ms linear';
 c.style.transform='perspective(680px) rotateX('+(-py*7).toFixed(2)+'deg) rotateY('+(px*7).toFixed(2)+'deg) translateY(-2px)';
 }catch(_){}
});
/* ================= 数字滚动动效（header 资金/战力平滑滚数，首次直接显示） ================= */
window.__numPrev={};
function tweenNum(el,key,to){
 const from=(key in window.__numPrev)?window.__numPrev[key]:to;
 window.__numPrev[key]=to;
 if(from===to||el.dataset.anim==='1'){el.textContent=fmt(to);return;}
 el.dataset.anim='1';
 const t0=performance.now(),dur=380;
 const step=now=>{
 const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3); // easeOutCubic
 el.textContent=fmt(Math.round(from+(to-from)*e));
 if(k<1)requestAnimationFrame(step);else{el.textContent=fmt(to);delete el.dataset.anim;}
 };
 requestAnimationFrame(step);
}
/* ================= 夺冠全屏庆典（总决赛/杯赛决赛赢下时一次性播放） =================
 深色覆盖层 + 队徽弹入 + 金色标题 + CSS 彩带；点按或 6 秒自动消失；减弱动效时直接跳过。 */
function playChampionCeremony(title){
 try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;}catch(_){}
 try{
 const ov=document.createElement('div');
 ov.id='champion-overlay';
 let confetti='';
 for(let i=0;i<26;i++){
 confetti+='<i style="left:'+rnd(2,98)+'%;animation-delay:'+(Math.random()*1.8).toFixed(2)+'s;background:'+(i%3===0?'#F2C41B':i%3===1?'#5c8af5':'#E8ECF4')+'"></i>';
 }
 ov.innerHTML='<div class="cc-inner"><div class="cc-cup">'+crest(S.icon,S.teamName,88)+'</div>'
 +'<div class="cc-title">'+_escTxt(title||'总冠军')+'</div>'
 +'<div class="cc-team">'+_escTxt(S.teamName)+' · 捧杯时刻</div>'
 +'<div class="cc-confetti">'+confetti+'</div></div>';
 document.body.appendChild(ov);
 ov.addEventListener('click',()=>{if(ov.parentNode)ov.parentNode.removeChild(ov);});
 setTimeout(()=>{if(ov.parentNode)ov.parentNode.removeChild(ov);},6000);
 }catch(_){}
}
/* ================= 进场动画（首访一次：logo 聚拢 → 展开 → 淡出） ================= */
function playIntro(){
 try{if(localStorage.getItem('km_intro'))return;localStorage.setItem('km_intro','1');}catch(_){}
 try{
 const ov=document.createElement('div');
 ov.id='intro-overlay';
 const name=(S&&S.teamName)?S.teamName:'王者电竞经理';
 const icon=(S&&S.icon)?S.icon:'剑';
 ov.innerHTML='<div class="intro-inner"><div class="intro-ico">'+crest(icon,name,72)+'</div><div class="intro-name">'+name+'</div><div class="intro-sub">KPL MANAGER · SEASON '+((S&&S.season)||1)+'</div></div>';
 document.body.appendChild(ov);
 ov.addEventListener('animationend',()=>{if(ov.parentNode)ov.parentNode.removeChild(ov);});
 }catch(_){}
}
/* ================= 启动 ================= */
/* 全局异常兜底：控制台可观测 + 用户侧提示（不白屏、不静默） */
window.__errLog=[]; // 最近 20 条异常（调试用，导出存档时随档带走也无妨）
/* PWA 离线可玩（借鉴开源浏览器游戏 Goooool.net 模式）：仅 https/localhost 注册 service worker；
 file:// 双击场景自动跳过，不影响单文件玩法 */
(function(){
 try{
 if(!('serviceWorker' in navigator))return;
 if(location.protocol!=='https:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return;
 window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
 }catch(e){}
})();
function _reportErr(tag,msg){
 try{
 window.__errLog.push({t:Date.now(),tag,m:String(msg||'').slice(0,200)});
 window.__errLog=window.__errLog.slice(-20);
 console.error('['+tag+']',msg);
 if(S)try{logEvent(S,' 程序异常：'+String(msg||'').slice(0,80));}catch(_){}
 toast(' 出现异常：'+(String(msg||'未知错误').slice(0,60))+'（建议先导出存档）');
 }catch(_){}
}
window.addEventListener('error', e => _reportErr('全局异常', e.message||'未知错误'));
window.addEventListener('unhandledrejection', e => _reportErr('Promise拒绝', e.reason));
$$('nav button').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));
if(load()&&S&&S.teamName){
 ensureSeason(S); // 旧档自动迁移到 KPL 2025 赛制
 applyModeNav();
 goPage(S.mode==='player'?'career':'club');
}else{
 initStart();
}
playIntro(); // 进场动画（仅首访播放）

