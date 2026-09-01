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

/* ================= 导航 ================= */
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
  else if(name==='union')renderUnion();
  else if(name==='biz')renderBiz();
}
function renderAll(){renderHeader();const cur=document.querySelector('nav button.on');if(cur)renderPage(cur.dataset.page);}

/* ================= 存档管理（多槽位 + 导出/导入） ================= */
function openSaveMgmt(){
  const occ=i=>!!localStorage.getItem(SAVE_KEY+(i>1?'_'+i:''));
  $('#app-modal-body').innerHTML=`
    <h2><span class="h-ic">${ic('doc')}</span>存档管理</h2>
    <div class="center" style="margin-bottom:12px">
      ${[1,2,3].map(i=>`<div class="pack-btn" ${i===curSlot?'style="border-color:var(--gold)"':''} onclick="setSlot(${i})">
        <b style="font-size:14px">槽${i}</b><span style="font-size:10px">${i===curSlot?'(当前)':occ(i)?'有档':'空槽'}</span></div>`).join('')}
    </div>
    <div class="hint" style="margin-bottom:8px">导出：点击"复制导出"得到存档代码并收藏；导入：粘贴代码后点"导入"（覆盖当前槽）。</div>
    <textarea id="save-io" style="width:100%;min-height:90px;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px;font-size:11px;resize:vertical"></textarea>
    <div class="center mt8" style="display:flex;gap:8px;justify-content:center">
      <button class="btn sm" onclick="save();exportSave()">📤 复制导出</button>
      <button class="btn sm primary" onclick="importSave()">📥 导入</button>
      <button class="btn sm" onclick="closeModal('app-modal')">关闭</button>
    </div>`;
  $('#app-modal').classList.add('on');
}
function setSlot(i){
  curSlot=i;localStorage.setItem('esport_manager_curslot',String(i));
  if(load()){save();renderAll();closeModal('app-modal');toast('已切换到 槽'+i);}
  else{S=null;closeModal('app-modal');initStart();toast('槽'+i+' 暂无存档，请创建新战队开局');}
}
function exportSave(){
  const t=$('#save-io');
  t.value=b64e(JSON.stringify(S));
  t.select();
  try{document.execCommand('copy');}catch(e){}
  toast('存档已复制，请妥善保存');
}
function importSave(){
  const v=$('#save-io').value.trim();
  if(!v){toast('请先粘贴存档代码');return;}
  try{
    const d=JSON.parse(b64d(v));
    if(!d||!d.teamName)throw new Error('bad');
    S=d;migrateSave();save();renderAll();closeModal('app-modal');toast('导入成功！');
  }catch(e){toast('导入失败：存档代码无效');}
}
function resetGame(){
  if(confirm('确定重新开始？将清空当前槽存档')){
    localStorage.removeItem(slotKey());
    location.reload();
  }
}

/* ================= 赞助商 ================= */
function upgradeSponsor(){
  const next=SPONSORS[S.sponsorLv+1];
  if(!next)return;
  if(S.fund<next.cost){toast('资金不足');return;}
  S.fund-=next.cost;S.sponsorLv++;
  logEvent(S,`🤝 签约新赞助商「${next.name}」，每日收入 ${next.income}万`);
  save();renderAll();toast(`赞助商升级成功！`);
}

/* ================= 开局 ================= */
function initStart(){
  const icons=['⚔️','🐉','🦁','🚀','🌊','🔥','⚡','👑'];
  const clubs=CLUB_TEMPLATES.map((c,i)=>`<div class="club-card" data-ci="${i}" onclick="pickClub(${i})" style="cursor:pointer;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center;transition:.15s">
    <div style="font-size:26px">${c.icon}</div>
    <div style="font-weight:800;font-size:13px;margin:4px 0">${c.name}</div>
    <div class="hint" style="font-size:10px;line-height:1.5">💰${c.budget}万 · 🧢${c.cap}帽<br>${c.desc}</div>
  </div>`).join('');
  $('#start-modal-body').innerHTML=`
    <h2><span class="h-ic">${ic('bolt')}</span>王者电竞经理 · KPL 篇</h2>
    <div class="center dim" style="font-size:12px;margin-bottom:14px">化身战队经理：签约选手、经营俱乐部、征战联赛、冲击总冠军</div>
    <div class="center" style="margin-bottom:12px;display:flex;gap:8px;justify-content:center">
      <button class="btn sm primary" id="tab-self" onclick="switchStartTab('self')">创建我的俱乐部</button>
      <button class="btn sm" id="tab-club" onclick="switchStartTab('club')">执教原版俱乐部</button>
    </div>
    <div id="tab-self-body">
      <div class="center" style="margin-bottom:12px">
        <span class="dim">战队名称：</span><input id="new-team-name" maxlength="8" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 12px;font-size:15px;width:180px" placeholder="输入队名">
      </div>
      <div class="center dim" style="margin-bottom:8px">选择队标：</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">
        ${icons.map((ic,i)=>`<div class="pack-btn ic-pick" data-i="${i}" ${i===0?'style="border-color:var(--cyan)"':''} onclick="pickIcon(${i})">
          <b style="font-size:22px">${ic}</b></div>`).join('')}
      </div>
      <div class="hint" style="margin-bottom:14px;text-align:center">初始资金 8000万 · 工资帽 900万 · 开局组建你的 KPL 战队（含一名 90+ 王牌）</div>
      <div class="center"><button class="btn primary" style="padding:12px 44px;font-size:16px" onclick="createTeam()">创建战队</button></div>
    </div>
    <div id="tab-club-body" style="display:none">
      <div class="hint" style="margin-bottom:10px;text-align:center">直接执教一支真实 KPL 俱乐部——豪门预算拉满，草根从零挑战，继承该队首发阵容与主教练</div>
      <div class="grid g4" style="gap:8px">${clubs}</div>
      <div class="hint" style="margin:10px 0;text-align:center;color:var(--cyan)" id="club-pick-tip">👆 点击选择俱乐部</div>
      <div class="center"><button class="btn gold" style="padding:12px 44px;font-size:16px" onclick="applyClub()" id="club-apply-btn" disabled>执教所选俱乐部</button></div>
    </div>`;
  $('#start-modal').classList.add('on');
}
let _clubPick=-1;
function switchStartTab(tab){
  $('#tab-self').className=tab==='self'?'btn sm primary':'btn sm';
  $('#tab-club').className=tab==='club'?'btn sm primary':'btn sm';
  $('#tab-self-body').style.display=tab==='self'?'':'none';
  $('#tab-club-body').style.display=tab==='club'?'':'none';
}
function pickClub(i){
  _clubPick=i;
  $$('.club-card').forEach(c=>{c.style.borderColor=parseInt(c.dataset.ci)===i?'var(--cyan)':'var(--line)';});
  $('#club-pick-tip').textContent='已选择：'+CLUB_TEMPLATES[i].name;
  $('#club-apply-btn').disabled=false;
}
function pickIcon(i){
  $$('.ic-pick').forEach(b=>b.style.borderColor='');
  document.querySelector('.ic-pick[data-i="'+i+'"]').style.borderColor='var(--cyan)';
}
function createTeam(){
  const name=$('#new-team-name').value.trim()||'无名战队';
  const idx=Array.from($$('.ic-pick')).findIndex(b=>b.style.borderColor==='var(--cyan)');
  const icon=['⚔️','🐉','🦁','🚀','🌊','🔥','⚡','👑'][idx<0?0:idx];
  S=newState(name,icon);
  // 直签开局：使用独立的自由球员池（与 18 队注册名单不重叠，保证全联盟一人一队）
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
  // 新手教练：青训助教
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S)||280; // 种子=开局真实战力（决定分组落位）
  initGroups(S); // KPL 2025 官方赛制：18队 S/A/B 分组
  // 赛前转会期：先组队再开赛
  S.preseason=true;S.transferWindow=7;
  buildTransferMarket(S);refreshMarket(S);
  logEvent(S,`战队 ${name} 成立！初始资金8000万，目标：KPL 总冠军！`);
  logEvent(S,'🎁 开局直签 5 名选手 + 青训助教，赛前转会期 7 天可自由调整阵容');
  logEvent(S,'📋 赛前转会期开启（7天）：买断/直签/挂牌自由组队，市场刷新免费；结束转会期后联赛开打');
  logEvent(S,'📋 KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛');
  $('#start-modal').classList.remove('on');
  goPage('market');
  toast('📋 赛前转会期开启（7天）：先组队，再开赛');
  save();
}
/* 执教原版俱乐部：继承豪门/草根的预算、工资帽、教练与首发阵容 */
function applyClub(){
  if(_clubPick<0){toast('请先选择俱乐部');return;}
  const tmpl=CLUB_TEMPLATES[_clubPick];
  S=newState(tmpl.name,tmpl.icon);
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
  S.seedPower=teamPower(S)||tmpl.seed; // 种子=执教班底真实战力（决定分组落位）
  initGroups(S);
  // 赛前转会期：先组队再开赛
  S.preseason=true;S.transferWindow=7;
  buildTransferMarket(S);refreshMarket(S);
  logEvent(S,`你正式执教 ${tmpl.name}！预算 ${tmpl.budget}万，工资帽 ${tmpl.cap}万/周`);
  logEvent(S,`主教练 ${S.coach.name} 已就位，首发：${lineup.map(id=>S.players.find(p=>p.id===id).name).join(' / ')}`);
  logEvent(S,'📋 赛前转会期开启（7天）：买断/直签/挂牌自由组队，市场刷新免费；结束转会期后联赛开打');
  logEvent(S,'📋 KPL 2025 赛制：第一轮3组单循环 → S/A/B → 卡位赛 → 第三轮 → 10强双败季后赛');
  $('#start-modal').classList.remove('on');
  goPage('market');
  toast('📋 赛前转会期开启（7天）：先组队，再开赛');
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
  toast(_sfxOn?'🔊 音效已开启':'🔇 音效已关闭');
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
/* ================= 进场动画（首访一次：logo 聚拢 → 展开 → 淡出） ================= */
function playIntro(){
  try{if(localStorage.getItem('km_intro'))return;localStorage.setItem('km_intro','1');}catch(_){}
  try{
    const ov=document.createElement('div');
    ov.id='intro-overlay';
    const name=(S&&S.teamName)?S.teamName:'王者电竞经理';
    const icon=(S&&S.icon)?S.icon:'⚔️';
    ov.innerHTML='<div class="intro-inner"><div class="intro-ico">'+icon+'</div><div class="intro-name">'+name+'</div><div class="intro-sub">KPL MANAGER · SEASON '+((S&&S.season)||1)+'</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('animationend',()=>{if(ov.parentNode)ov.parentNode.removeChild(ov);});
  }catch(_){}
}
/* ================= 启动 ================= */
/* 全局异常兜底：控制台可观测 + 用户侧提示（不白屏、不静默） */
window.__errLog=[]; // 最近 20 条异常（调试用，导出存档时随档带走也无妨）
function _reportErr(tag,msg){
  try{
    window.__errLog.push({t:Date.now(),tag,m:String(msg||'').slice(0,200)});
    window.__errLog=window.__errLog.slice(-20);
    console.error('['+tag+']',msg);
    if(S)try{logEvent(S,'⚠️ 程序异常：'+String(msg||'').slice(0,80));}catch(_){}
    toast('⚠️ 出现异常：'+(String(msg||'未知错误').slice(0,60))+'（建议先导出存档）');
  }catch(_){}
}
window.addEventListener('error', e => _reportErr('全局异常', e.message||'未知错误'));
window.addEventListener('unhandledrejection', e => _reportErr('Promise拒绝', e.reason));
$$('nav button').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));
if(load()&&S&&S.teamName){
  ensureSeason(S); // 旧档自动迁移到 KPL 2025 赛制
  goPage('club');
}else{
  initStart();
}
playIntro(); // 进场动画（仅首访播放）

