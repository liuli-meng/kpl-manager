/* 荣誉馆 + 战绩分享图（canvas 纯前端导出，零网络依赖） */
/* ================= 荣誉馆数据聚合 ================= */
function hallDynastyRuns(s){
 // 从 titleHistory 抽连冠段：同一队连续夺冠次数 ≥2 记为王朝段
 const hist=(s.titleHistory||[]).slice();
 const runs=[];
 let cur=null;
 hist.forEach(t=>{
 if(cur&&cur.team===t.champ){cur.n++;cur.events.push(t.event);}
 else{if(cur&&cur.n>=2)runs.push(cur);cur={team:t.champ,n:1,seasons:[t.season],events:[t.event]};}
 });
 if(cur&&cur.n>=2)runs.push(cur);
 return runs;
}
function hallChampByEvent(s){
 const m={};
 (s.titleHistory||[]).forEach(t=>{
 if(!m[t.event])m[t.event]=[];
 m[t.event].push(t);
 });
 return m;
}
function renderHall(){
 const el=$('#page-hall');
 if(!el)return;
 const myHon=(S.honors||[]).slice().reverse();
 const champN=myHon.filter(h=>h.champion).length;
 const th=(S.titleHistory||[]).slice().reverse();
 const runs=hallDynastyRuns(S);
 const fm=(S.fmvpHonor||[]).slice();
 const awards=(S.awards||[]).slice();
 const career=S.mode==='player'?(S.career||null):null;
 const deal=S.mode==='coach'?(S.coachDeal||null):null;
 const byEv=hallChampByEvent(S);
 let html=pageHint('hall')+`<div class="panel" style="border-color:rgba(217,164,65,.45)">
 <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
 ${crest(S.icon,S.teamName,44)}
 <div><div style="font-size:18px;font-weight:800">${S.teamName} 荣誉馆</div>
 <div class="hint">${gameYear(S)} 赛季 · 累计 <b class="gold">${champN}</b> 冠 · 历届冠军记录 ${th.filter(t=>t.champ===S.teamName).length} 次 · 联盟王朝段 ${runs.length}</div></div>
 <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
 <button class="btn gold sm" onclick="shareHonorCard()"> 生成战绩分享图</button>
 ${career?`<button class="btn sm" onclick="shareCareerCard()"> 选手生涯卡</button>`:''}
 </div>
 </div></div>`;
 // 本队荣誉
 html+=`<div class="panel"><h3>本队荣誉墙 <span class="tag">${myHon.length} 条记录</span></h3>`;
 html+=myHon.length?myHon.map(h=>`<div class="sponsor" style="margin-bottom:6px">
 <span class="s-icon" style="${h.champion?'border-color:var(--gold);color:var(--gold)':''}">${h.champion?'冠':'亚'}</span>
 <div><div class="s-name">${_escTxt(h.title||('赛季'+h.season))}</div>
 <div class="s-desc">${h.roster?'夺冠阵容：<span class="cyan">'+_escTxt(h.roster)+'</span>':'暂无阵容快照'}</div></div></div>`).join('')
 :'<div class="hint">还没有冠军/亚军记录——打进季后赛与杯赛决赛会自动入册</div>';
 html+=`</div>`;
 // 王朝纪录
 html+=`<div class="panel"><h3>王朝纪录 <span class="tag">连冠 ≥2 触发反制</span></h3>`;
 html+=runs.length?runs.map(r=>`<div class="match" style="margin-bottom:6px;border-color:rgba(217,164,65,.4)">
 <div class="vs"><span class="tname">${_escTxt(r.team)} · ${r.n} 连冠</span>
 <div class="power">赛季 ${r.seasons.join('/')} · ${r.events.join('→')}</div></div>
 <div class="score gold" style="min-width:0;font-size:13px">王朝</div></div>`).join('')
 :`<div class="hint">暂无王朝——同一队连续夺得两次及以上冠军即入册（联盟会开始研究你）</div>`;
 // 当前连冠
 const mySt=dynastyStreak(S,S.teamName);
 if(mySt>=2)html+=`<div class="hint gold" style="margin-top:6px">本队当前 ${mySt} 连冠：对手研究加成生效 · 工资帽成长减半 · 版本可能针对核心</div>`;
 html+=`</div>`;
 // 历届冠军（联盟时间线）
 html+=`<div class="panel"><h3>历届冠军 <span class="tag">联盟时间线 · 最近 ${th.length} 冠</span></h3>`;
 html+=th.length?th.map(t=>`<div class="match" style="margin-bottom:5px;padding:8px 10px;${t.champ===S.teamName?'border-color:rgba(217,164,65,.45)':''}">
 <div class="vs"><span class="tname" style="font-size:13px">${_escTxt(t.event)} · S${t.season}</span></div>
 <div class="score" style="min-width:0;font-size:13px;color:${t.champ===S.teamName?'var(--gold)':'var(--txt)'}">${_escTxt(t.champ)}</div></div>`).join('')
 :'<div class="hint">本赛季尚未产生冠军</div>';
 if(Object.keys(byEv).length){
 html+=`<div class="hint mt8">按赛事：${Object.keys(byEv).map(ev=>ev+'×'+byEv[ev].length).join(' · ')}</div>`;
 }
 html+=`</div>`;
 // FMVP
 html+=`<div class="panel"><h3>FMVP 名人堂 <span class="tag">${fm.length} 席</span></h3>`;
 html+=fm.length?fm.map(f=>`<div class="sponsor" style="margin-bottom:6px"><span class="s-icon">M</span>
 <div><div class="s-name">${_escTxt(f.name)} <span class="${f.team===S.teamName?'gold':'dim'}">${f.team===S.teamName?'(本队)':''}</span></div>
 <div class="s-desc">${f.year} ${_escTxt(f.event)} · ${_escTxt(f.team)}</div></div></div>`).join('')
 :'<div class="hint">总决赛最有价值选手尚未产生——夺冠系列赛各局 MVP 累计最多者当选</div>';
 html+=`</div>`;
 // 最佳阵容
 html+=`<div class="panel"><h3>赛季最佳阵容 <span class="tag">历届一阵/二阵</span></h3>`;
 html+=awards.length?awards.map(a=>`<div style="margin-bottom:10px">
 <div class="hint" style="margin-bottom:4px">S${a.season} 赛季</div>
 <div style="font-size:12px;margin-bottom:2px"><span class="gold">一阵</span> ${(a.first||[]).map(x=>POS[x.pos][1]+' '+_escTxt(x.name)+'（'+_escTxt(x.team)+'）').join('、')}</div>
 <div style="font-size:12px"><span class="dim">二阵</span> ${(a.second||[]).map(x=>POS[x.pos][1]+' '+_escTxt(x.name)+'（'+_escTxt(x.team)+'）').join('、')}</div>
 </div>`).join('')
 :'<div class="hint">赛季结束后自动评选一阵/二阵</div>';
 html+=`</div>`;
 // 选手 / 教练生涯荣誉
 if(career){
 html+=`<div class="panel"><h3>我的选手生涯 <span class="tag">${career.retired?'已退役':'在役'}</span></h3>
 <div class="hint" style="margin-bottom:6px">${career.titles||0} 冠 · ${career.fmvp||0} FMVP · ${career.allstar||0} 一阵 · ${career.nat||0} 次国家队 · ${career.mentoredCount||0} 次带新</div>
 ${(career.seasons||[]).length?`<table class="tbl"><tr><th>赛季</th><th>球队</th><th>出场</th><th>KDA</th><th>荣誉</th></tr>
 ${(career.seasons||[]).map(r=>`<tr><td>${r.year}</td><td>${_escTxt(r.team)}</td><td>${r.apps}</td><td>${r.kda||'—'}</td><td class="gold">${r.titles?r.titles+' 冠':''}</td></tr>`).join('')}</table>`
 :'<div class="hint">首个赛季进行中</div>'}</div>`;
 }
 if(deal){
 html+=`<div class="panel"><h3>我的执教履历 <span class="tag">${deal.honors&&deal.honors.length?deal.honors.length+' 冠':'合同中'}</span></h3>
 <div class="hint">${deal.years||0} 年合同 · ${(deal.log||[]).map(x=>_escTxt(x.note)).join('；')||'尚无转会/换队记录'}</div></div>`;
 }
 el.innerHTML=html;
}
/* ================= 战绩分享图（canvas） =================
 竖版 750×1200，深色 TOUCHLINE 配色，纯前端 toDataURL 导出。 */
function _shareWrap(fn){
 try{
 const cv=document.createElement('canvas');
 cv.width=750;cv.height=1200;
 const ctx=cv.getContext('2d');
 if(!ctx)throw new Error('canvas 不可用');
 fn(ctx,cv);
 const fname='kpl-honor-'+Date.now()+'.png';
 const doDownload=url=>{
 const a=document.createElement('a');
 a.href=url;a.download=fname;
 document.body.appendChild(a);a.click();document.body.removeChild(a);
 };
 // 优先 toBlob：部分移动浏览器对超长 dataURL 下载不友好；失败回退 dataURL
 if(cv.toBlob){
 cv.toBlob(b=>{
 if(!b){doDownload(cv.toDataURL('image/png'));return;}
 const url=URL.createObjectURL(b);
 doDownload(url);
 setTimeout(()=>URL.revokeObjectURL(url),4000);
 toast(' 分享图已生成，已开始下载');
 },'image/png');
 }else{
 doDownload(cv.toDataURL('image/png'));
 toast(' 分享图已生成，已开始下载');
 }
 }catch(e){toast(' 生成失败：'+(e.message||e));}
}
function _shareBg(ctx){
 ctx.fillStyle='#141416';ctx.fillRect(0,0,750,1200);
 // 顶部金线
 ctx.fillStyle='#d9a441';ctx.fillRect(0,0,750,6);
 ctx.fillStyle='#1d1d20';ctx.fillRect(24,28,702,1144);
 ctx.strokeStyle='#2a2a2e';ctx.lineWidth=2;ctx.strokeRect(24,28,702,1144);
 ctx.fillStyle='#d9a441';ctx.fillRect(24,28,702,4);
}
function _shareLine(ctx,y,label,value,gold){
 ctx.font='500 22px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#9a9aa2';ctx.textAlign='left';ctx.fillText(label,56,y);
 ctx.font='700 28px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle=gold?'#d9a441':'#e6e6e9';ctx.textAlign='right';
 ctx.fillText(String(value),694,y);
 ctx.strokeStyle='#2a2a2e';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(56,y+16);ctx.lineTo(694,y+16);ctx.stroke();
}
function shareHonorCard(){
 _shareWrap((ctx)=>{
 _shareBg(ctx);
 const myHon=(S.honors||[]).filter(h=>h.champion);
 const th=(S.titleHistory||[]).filter(t=>t.champ===S.teamName);
 const runs=hallDynastyRuns(S);
 const fm=(S.fmvpHonor||[]).filter(f=>f.team===S.teamName);
 ctx.textAlign='center';
 ctx.font='700 42px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#e6e6e9';
 ctx.fillText(S.teamName,375,110);
 ctx.font='500 20px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#d9a441';
 ctx.fillText('荣 誉 战 报',375,150);
 ctx.font='400 18px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#9a9aa2';
 ctx.fillText(gameYear(S)+' 赛季 · 王者电竞经理',375,182);
 let y=250;
 _shareLine(ctx,y,'总冠军',myHon.length,true);y+=72;
 _shareLine(ctx,y,'联盟夺冠次数',th.length,true);y+=72;
 _shareLine(ctx,y,'王朝段',runs.length,runs.length>0);y+=72;
 _shareLine(ctx,y,'本队 FMVP',fm.length,fm.length>0);y+=72;
 _shareLine(ctx,y,'当前连冠',dynastyStreak(S,S.teamName)+' 连',dynastyStreak(S,S.teamName)>=2);y+=90;
 // 最近三冠
 ctx.textAlign='left';
 ctx.font='700 24px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#e6e6e9';
 ctx.fillText('最近荣誉',56,y);y+=40;
 const recent=myHon.slice(-3).reverse(); // honors 按时间序 push：取末 3 条倒序=最近三冠
 if(!recent.length){
 ctx.font='400 20px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#6f6f77';
 ctx.fillText('奖杯柜还在等第一座冠军',56,y);y+=40;
 }else{
 recent.forEach(h=>{
 ctx.font='600 22px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#d9a441';
 ctx.fillText('★ '+(h.title||'冠军'),56,y);y+=34;
 if(h.roster){
 ctx.font='400 18px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#9a9aa2';
 const t=String(h.roster);
 ctx.fillText(t.length>28?t.slice(0,28)+'…':t,56,y);y+=30;
 }
 y+=8;
 });
 }
 // 页脚
 ctx.textAlign='center';
 ctx.font='400 16px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#6f6f77';
 ctx.fillText('单机存档 · 数据来自本地赛季记录',375,1120);
 });
}
function shareCareerCard(){
 if(S.mode!=='player'||!S.career){toast('仅选手生涯可生成生涯卡');return;}
 _shareWrap((ctx)=>{
 _shareBg(ctx);
 const c=S.career;
 const me=(c.legacy&&c.legacy.name)||((myPlayer(S)||{}).name)||'选手';
 const age=(c.legacy&&c.legacy.age)||((myPlayer(S)||{}).age)||'—';
 ctx.textAlign='center';
 ctx.font='700 40px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#e6e6e9';
 ctx.fillText(me,375,110);
 ctx.font='500 20px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle=c.retired?'#9a9aa2':'#5c8af5';
 ctx.fillText(c.retired?'职业生涯已退役':'选手生涯进行中',375,148);
 ctx.font='400 18px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#9a9aa2';
 ctx.fillText(S.teamName+' · '+age+' 岁',375,180);
 let y=250;
 _shareLine(ctx,y,'赛季数',(c.seasons||[]).length);y+=72;
 _shareLine(ctx,y,'总冠军',c.titles||0,true);y+=72;
 _shareLine(ctx,y,'FMVP',c.fmvp||0,(c.fmvp||0)>0);y+=72;
 _shareLine(ctx,y,'赛季一阵',c.allstar||0,(c.allstar||0)>0);y+=72;
 _shareLine(ctx,y,'国家队',c.nat||0,(c.nat||0)>0);y+=90;
 ctx.textAlign='left';
 ctx.font='700 24px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#e6e6e9';
 ctx.fillText('赛季履历',56,y);y+=38;
 (c.seasons||[]).slice(0,5).forEach(r=>{
 ctx.font='600 20px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#e6e6e9';
 ctx.fillText(r.year+' · '+(r.team||'')+(r.titles?' · '+r.titles+'冠':''),56,y);y+=30;
 ctx.font='400 17px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#9a9aa2';
 ctx.fillText('出场 '+(r.apps||0)+' · '+(r.kda||'—')+' · 总值 '+(r.ovr||'—'),56,y);y+=36;
 });
 ctx.textAlign='center';
 ctx.font='400 16px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.fillStyle='#6f6f77';
 ctx.fillText('王者电竞经理 · KPL 篇',375,1120);
 });
}
