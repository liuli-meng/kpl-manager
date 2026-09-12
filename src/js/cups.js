/* 年度杯赛：挑战者杯/EWC/亚运会/年总 + 杯赛通用流程（season.js 机械拆出） */
/* ================= 挑战者杯（2026 KPL 春季赛后最高关注度杯赛） =================
 真实赛制简化建模：32 队（18 KPL 全员 + 14 挑战者：K甲/全国大赛/青训/高校/职工/主播/全球七大赛道）
 → 单败淘汰 32→16（BO5）→16→8（BO7），春季赛冠军/亚军为一二号种子分半区
 → 8 强双败淘汰（BO7）→ 决赛 BO9（第9局巅峰对决）
 「挑战者的祝福」：低赛道队伍 vs KPL 时战力 +5%（ensureAiRosters 统一结算，玩家对局同样生效）
 年总积分：冠军85 / 亚军60 / 第3名40 / 第4名20 / 5-6名10；冠军 300 万奖金 + FMVP。 */
const CHALLENGER_TEAMS=[['K甲·苍穹','K甲'],['K甲·星火','K甲'],['K甲·沧澜','K甲'],
 ['全国大赛·破晓','全国大赛'],['青训·晨曦','青训'],['高校·逐梦','高校'],['职工·匠心','职工'],
 ['主播·不夜城','主播'],['主播·山海','主播'],['主播·云隐','主播'],['主播·听风','主播'],
 ['全球·NOVA Esports','全球'],['全球·Gen.G Esports','全球'],['全球·Twisted Minds','全球']];
const CHALLENGER_NAMES=['梓墨','暖阳','清融','一诺','无畏','飞牛','百兽','小胖','九尾','梦岚','小义','今屿','星痕','向鱼','妖刀','帆帆','阿豆','坦然','花海','易峥','子阳','柠栀','江城','星宇','小落','奕星','凌云','破军','惊鸿','破晓','远航','守望','砺锋','青锋','北辰','南屿','苍穹','逐梦','晨曦','听风','云起'];
function genChallengerDef(s,i,teamName,band){
 const used=new Set();
 (s.extraDefs||[]).forEach(d=>used.add(d.name));
 Object.values(s.aiRosterDefs||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 Object.values(s.challDefMap||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 (s.players||[]).forEach(p=>used.add(p.name));
 // 挑战者池只有 41 个名字，却要给 14 队 ×5=70 人命名——从前两名开始就撞名。
 // 旧写法 `CHALLENGER_NAMES[i%length]` + 序号兜底，导致每届固定出现「挑战者42…70」；
  // 现改为 poolName：优先用赛道人名池，池尽走 combName 组合名（不出现占位名）
 const name=poolName(CHALLENGER_NAMES,used);
 used.add(name);
 const pos=POS_ORDER[i%5];
 // 赛道强度：K甲≈75 / 全球≈78 / 主播≈68 / 次级（全国/青训/高校/职工）≈65
 const baseLv=band==='K甲'?75:band==='全球'?78:band==='主播'?68:65;
 const b=v=>clamp(v+rnd(-5,5),55,86);
 return {id:'ch'+gameYear(s)+'_'+i,name,pos,team:teamName,tags:['特权'],
 base:[b(baseLv),b(baseLv-1),b(baseLv),b(baseLv-1)],
 skill:{n:'挑战者祝福',t:pick(['lane','farm','team','mind']),d:'低赛道挑战 KPL 时的体系优势'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:'挑战者杯'+band+'赛道选手，'+(band==='K甲'?'K甲职业队':'来自'+band+'赛道')+'。'};
}
function setupChallenger(s){
 const p=s.playoff;
 const champ=p.final.r,runner=p.final.r===p.final.a?p.final.b:p.final.a;
 // 挑战者队选手 def（挂 s.challDefMap；ensureAiRosters 兜底，BP/体力/战力全流程可用）
 s.challDefMap={};
 let ni=0;
 CHALLENGER_TEAMS.forEach(([tn,band])=>{
 const ids=[];
 for(let k=0;k<5;k++){const def=genChallengerDef(s,ni++,tn,band);(s.extraDefs=s.extraDefs||[]).push(def);ids.push(def.id);}
 s.challDefMap[tn]=ids;
 });
 // 32 队：18 KPL（当前联盟 18 队名录，含玩家）+ 14 挑战者；春冠/春亚为一二号种子，分列左右半区（32→16 不提前相遇）
 const league18=(s.leagueTeams&&s.leagueTeams.length)?s.leagueTeams.slice():AI_TEAMS.map(t=>t.name);
 const chPool=CHALLENGER_TEAMS.map(x=>x[0]);
 const rest=shuffle([...league18,...chPool].filter(t=>t!==champ&&t!==runner)); // 30 队（玩家=春冠时不重复计入）
 const teams=[champ,...rest.slice(0,15),runner,...rest.slice(15)]; // 32 队，种子分列 idx0/idx16 两个半区
 s.challenger={stage:'single',r1:[],r2:null,po:null,final:null,champ:null,teams};
 for(let i=0;i<16;i++)s.challenger.r1.push({a:teams[i],b:teams[31-i],r:null}); // 单败首轮 BO5
 s.phase='challenger';
 logEvent(s,' '+gameYear(s)+' 挑战者杯开幕（32队·八大赛道）！'+champ+'（1号种子）与 '+runner+'（2号种子）分列两半区');
 const myIn=teams.includes(s.teamName);
 if(!myIn){simCup('challenger',s);finishChallenger(s);return;}
 save();renderAll();
}
function challengerStep(s){
 const c=s.challenger;if(!c)return;
 const P=(m,slot,label,bo)=>playCupMatch(s,m,slot,label,bo);
 if(c.stage==='single'){
 for(let i=0;i<16;i++){const m=c.r1[i];if(!m.r){P(m,'ch_r1_'+(i+1),'挑战者杯·32强',KPL.BO5);return;}}
 if(!c.r2){c.r2=[];for(let i=0;i<8;i++)c.r2.push({a:c.r1[i*2].r,b:c.r1[i*2+1].r,r:null});}
 for(let i=0;i<8;i++){const m=c.r2[i];if(!m.r){P(m,'ch_r2_'+(i+1),'挑战者杯·16强',KPL.BO7);return;}}
 c.stage='po';
 c.po=buildCup8(shuffle(c.r2.map(m=>m.r)));
 logEvent(s,' 挑战者杯 8 强双败开启（BO7）：'+c.r2.map(m=>m.r).join('、'));
 save();renderAll();
 return;
 }
 challengerPoStep(s);
}
function challengerPoStep(s){
 const c=s.challenger;const p=c.po;if(!p)return;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const P=(m,slot,label,bo)=>playCupMatch(s,m,slot,label,bo);
 for(let i=0;i<4;i++)if(!p.wb1[i].r){P(p.wb1[i],'chpo_wb1_'+(i+1),'挑杯·胜者组首轮',KPL.BO7);return;}
 for(let i=0;i<2;i++){const m=p.lb1[i];if(m.a===null)m.a=loserOf(p.wb1[i*2]);if(m.b===null)m.b=loserOf(p.wb1[i*2+1]);if(!m.r){P(m,'chpo_lb1_'+(i+1),'挑杯·败者组首轮',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=p.wb2[i];if(m.a===null)m.a=p.wb1[i*2].r;if(m.b===null)m.b=p.wb1[i*2+1].r;if(!m.r){P(m,'chpo_wb2_'+(i+1),'挑杯·胜者组半决赛',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=p.lb2[i];if(m.a===null)m.a=p.lb1[i].r;if(m.b===null)m.b=loserOf(p.wb2[i]);if(!m.r){P(m,'chpo_lb2_'+(i+1),'挑杯·败者组第二轮',KPL.BO7);return;}}
 if(p.wf.a===null){p.wf.a=p.wb2[0].r;p.wf.b=p.wb2[1].r;}
 if(!p.wf.r){P(p.wf,'chpo_wf','挑杯·胜者组决赛',KPL.BO7);return;}
 if(p.lbs.a===null){p.lbs.a=p.lb2[0].r;p.lbs.b=p.lb2[1].r;}
 if(!p.lbs.r){P(p.lbs,'chpo_lbs','挑杯·败者组半决赛',KPL.BO7);return;}
 if(p.lbf.a===null){p.lbf.a=loserOf(p.wf);p.lbf.b=p.lbs.r;}
 if(!p.lbf.r){P(p.lbf,'chpo_lbf','挑杯·败者组决赛',KPL.BO7);return;}
 // 决赛 BO9（第9局巅峰对决）
 if(!c.final)c.final={a:null,b:null,r:null};
 if(c.final.a===null)c.final.a=p.wf.r;
 if(c.final.b===null)c.final.b=p.lbf.r;
 if(!c.final.r){P(c.final,'ch_final','挑战者杯·总决赛',9);return;}
 finishChallenger(s);
}
function finishChallenger(s){
 const c=s.challenger;if(!c||!c.final||!c.final.r||c.champ)return; // c.champ 防双入口重复结算
 c.champ=c.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(c.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'挑战者杯',champ:c.champ}]).slice(-16);
 logEvent(s,' 挑战者杯落幕：'+c.champ+' 问鼎！（BO9 巅峰对决）'+(c.champ===s.teamName?'挑战者，皆王者！':''));
 // 年总积分：冠军85 / 亚军60 / 第3名40 / 第4名20 / 5-6名10
 const pts={};pts[c.champ]=85;pts[runner]=60;
 if(c.po.lbf.r)pts[loserOf(c.po.lbf)]=40;
 if(c.po.lbs.r)pts[loserOf(c.po.lbs)]=20;
 Object.keys(pts).forEach(t=>{s.annualPts[t]=(s.annualPts[t]||0)+(pts[t]||0);});
 logEvent(s,' 挑战者杯积分入账：'+s.teamName+' 年总积分累计 '+(s.annualPts[s.teamName]||0)+' 分');
 // 奖金（真实对齐 ÷6：总池 170 万）：冠军500 / 亚军250 / 四强133 / 8强67——按 KPL 规则选手分成 70%
 let prize=0;
 if(c.champ===s.teamName)prize=500;
 else if(runner===s.teamName)prize=250;
 else if(c.po.lbf.r&&loserOf(c.po.lbf)===s.teamName)prize=133;
 else if(c.po.lbs.r&&loserOf(c.po.lbs)===s.teamName)prize=67;
 else if((c.po.lb2||[]).some(m=>m.r&&loserOf(m)===s.teamName)||(c.po.lb1||[]).some(m=>m.r&&loserOf(m)===s.teamName))prize=67;
 if(prize)grantPrize(s,prize,'挑战者杯奖金');
 if(c.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' 挑战者杯 '+(c.champ===s.teamName?'冠军':'亚军'),champion:c.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,c.champ,gameYear(s)+' 挑战者杯');
 // 成绩曲线：挑杯名次入档（冠军/亚军/四强/八强/16强/32强）
 s.yearStages=s.yearStages||[];
 const chPlace=c.champ===s.teamName?'冠军':runner===s.teamName?'亚军'
 :(c.po.lbf.r&&loserOf(c.po.lbf)===s.teamName)?'四强'
 :((c.po.lbs.r&&loserOf(c.po.lbs)===s.teamName)||c.po.lb2.concat(c.po.lb1).some(m=>m.r&&loserOf(m)===s.teamName))?'八强'
 :(c.r2||[]).some(m=>m.r&&loserOf(m)===s.teamName)?'16强'
 :c.r1.some(m=>m.r&&loserOf(m)===s.teamName)?'32强':'参赛';
 s.yearStages.push({ev:'挑战者杯',place:chPlace});
 setupEWC(s); // 挑杯收官 → EWC 电竞世界杯（夏季休赛）
}
/* ================= EWC 电竞世界杯（年中国际杯赛） =================
 真实赛制简化建模：春季赛冠军（KPL直邀）+ 亚军（英雄亚冠ACL直邀）+ 6 支海外强队
 → 8 强 BO7 单败淘汰（小组赛/突围赛合并简化）。冠军奖金 540 万（75万美元），另评 FMVP。 */
const EWC_OVERSEAS=['NOVA Esports','Blacklist International','Twisted Minds','Alpha7 Esports','Team Vitality','Gen.G Esports','Nongshim RedForce','PAWS Gaming','BOOM Esports','KAGENDRA'];
const EWC_NAMES=['Niap','Dani','Fury','Cr7','Vilao1','Freaks','ABH','0ne','Vento','Xuan','Cy','Wendy','Muci','Weipit','Switch','Flukeyo','Shy','Miggie','Karlll','Tatsurii','Chammy1','Juschie','Dragon','Ihanss','Wiraww','Senkoo','Tufzzz','Zhanq','Wawa','Ray','Inua','Nighty','Clean','Snow','Myosotis','Keke','Daodao','Ran','Zoe','Sheng','Haku','Illusion','Musangking','Zhihong','Dian','Niel','Zaan','Guilv','Tianx','Fenrir'];
function genEwcDef(s,i,teamName){
 const used=new Set();
 (s.extraDefs||[]).forEach(d=>used.add(d.name));
 Object.values(s.aiRosterDefs||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 (s.players||[]).forEach(p=>used.add(p.name));
 let name=EWC_NAMES[i];
 if(!name||used.has(name))name='外援'+(i+1);
 const pos=POS_ORDER[i%5];
 const b=v=>clamp(v+rnd(-4,4),68,88);
 return {id:'ewc'+gameYear(s)+'_'+i,name,pos,team:teamName,tags:['国际'],
 base:[b(80),b(78),b(80),b(79)],skill:{n:'海外劲旅',t:pick(['lane','farm','team','mind']),d:'国际赛场淬炼的体系战力'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:gameYear(s)+' EWC 电竞世界杯海外参赛队选手。'};
}
function setupEWC(s){
 const p=s.playoff;
 const champ=p.final.r,runner=p.final.r===p.final.a?p.final.b:p.final.a;
 const overs=shuffle(EWC_OVERSEAS.slice()).slice(0,6);
 // 海外队选手 def（挂 s.ewcDefMap，供 ensureAiRosters 构建真实阵容：BP 情报/体力/战力全流程可用）
 s.ewcDefMap={};
 let ni=0;
 overs.forEach(tn=>{
 const ids=[];
 for(let k=0;k<5;k++){const def=genEwcDef(s,ni++,tn);(s.extraDefs=s.extraDefs||[]).push(def);ids.push(def.id);}
 s.ewcDefMap[tn]=ids;
 });
 const teams=shuffle([champ,runner,...overs]);
 s.ewc={teams,qf:[0,1,2,3].map(i=>({a:teams[i*2],b:teams[i*2+1],r:null})),
 sf:[{a:null,b:null,r:null},{a:null,b:null,r:null}],final:{a:null,b:null,r:null},champ:null};
 s.phase='ewc';
 const myIn=teams.includes(s.teamName);
 logEvent(s,' '+gameYear(s)+' EWC 电竞世界杯（利雅得）开幕！'+champ+'（KPL直邀）与 '+runner+'（英雄亚冠ACL）代表 KPL 出战');
 if(myIn)logEvent(s,' 你队以「'+(champ===s.teamName?'KPL 春季赛冠军':'英雄亚冠 ACL')+'」身份直邀 8 强淘汰赛！');
 if(!myIn){simCup('ewc',s);return;} // 玩家未晋级：AI 自动补完（内部收尾进夏季赛）
 save();renderAll();
}
function ewcStep(s){
 const e=s.ewc;if(!e)return;
 for(let i=0;i<4;i++){const m=e.qf[i];if(!m.r){playCupMatch(s,m,'ewc_qf'+(i+1),'EWC·四分之一决赛',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=e.sf[i];if(m.a===null)m.a=e.qf[i*2].r;if(m.b===null)m.b=e.qf[i*2+1].r;if(!m.r){playCupMatch(s,m,'ewc_sf'+(i+1),'EWC·半决赛',KPL.BO7);return;}}
 if(e.final.a===null)e.final.a=e.sf[0].r;
 if(e.final.b===null)e.final.b=e.sf[1].r;
 if(!e.final.r){playCupMatch(s,e.final,'ewc_final','EWC·总决赛',KPL.BO7);return;}
 finishEWC(s);
}
function finishEWC(s){
 const e=s.ewc;if(!e||!e.final.r||e.champ)return; // e.champ：防重复收尾（AI 补完与正常路径可能双入口）
 e.champ=e.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(e.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'EWC',champ:e.champ}]).slice(-16);
 logEvent(s,' EWC 总决赛落幕：'+e.champ+' 捧杯！'+(e.champ===s.teamName?'中国赛区的世界之巅！':''));
 let prize=0; // 奖金（美元折算，真实对齐 ÷6）：冠军90万$≈900 / 亚军55万$≈550 / 四强24万$≈242 / 八强15.5万$≈155
 if(e.champ===s.teamName)prize=900;
 else if(runner===s.teamName)prize=550;
 else if(e.sf.some(m=>m.r&&loserOf(m)===s.teamName))prize=242;
 else if(e.qf.some(m=>m.r&&loserOf(m)===s.teamName))prize=155;
 if(prize)grantPrize(s,prize,'EWC 赛事奖金');
 if(e.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' EWC 电竞世界杯 '+(e.champ===s.teamName?'冠军':'亚军'),champion:e.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,e.champ,gameYear(s)+' EWC 电竞世界杯');
 // 成绩曲线：EWC 名次入档
 s.yearStages=s.yearStages||[];
 s.yearStages.push({ev:'EWC电竞世界杯',place:e.champ===s.teamName?'冠军':runner===s.teamName?'亚军'
 :e.sf.some(m=>m.r&&loserOf(m)===s.teamName)?'四强'
 :e.qf.some(m=>m.r&&loserOf(m)===s.teamName)?'八强':'未晋级'});
 s.ewcDone=true;
 startSplit(s,'summer'); // EWC 收官 → 夏季赛转会期（年中不老化）
}
/* ================= 亚运会（四年一届 · 国家队征召） =================
 真实建模简化：中国代表队由 KPL 联盟各位置当赛季总值最高者组成（含玩家队选手），
 韩国为最强对手，8 队 BO7 单败淘汰。玩家不直接操控国家队（教练席不在你手里），
 但麾下入选选手会带回来奖牌加成：人气/身价/士气 + 协会奖金，代价是年总体力下滑。 */
const AG_NATIONS=[['韩国',470],['中国台北',432],['越南',427],['泰国',416],['日本',400],['沙特阿拉伯',385],['印度',365]];
const AG_CITY='名古屋';
function agSelectSquad(s){
 const pool=[];
 (s.players||[]).forEach(p=>{if(!p.loan&&!p.retiring)pool.push(p);});
 AI_TEAMS.forEach(t=>ensureAiRosters(s,t.name).forEach(p=>pool.push(p)));
 return POS_ORDER.map(pos=>pool.filter(p=>p.pos===pos).sort((a,b)=>overall(b)-overall(a))[0]).filter(Boolean);
}
function setupAsianGames(s){
 // 名单以夏初宣布的 natSquad 为准（征召后中途转会不换人）；残缺时按当前最强兜底补位
 const ownedIds=new Set((s.players||[]).map(p=>p.id));
 let squad=[];
 const nat=(s.natSquad||[]).map(x=>x.name);
 if(nat.length){
 squad=nat.map(n=>{
 const own=(s.players||[]).find(p=>p.name===n);
 if(own&&!own.retiring)return own;
 for(const t of AI_TEAMS){const q=ensureAiRosters(s,t.name).find(p=>p.name===n);if(q)return q;}
 return null;
 }).filter(Boolean);
 }
 if(squad.length<5)squad=agSelectSquad(s); // 兜底：名单残缺（退役/异常）按当前最强补
 const myPow=Math.round(squad.reduce((m,p)=>m+playerPower(p),0));
 s.aiPower=s.aiPower||{};
 s.aiPower['中国代表队']=myPow;
 AG_NATIONS.forEach(([n,pw])=>{s.aiPower[n]=pw+(gameYear(s)-2026)*3;}); // 海外对手逐年小幅变强
 // 韩国固定在下半区 QF4（与中国的 QF1 隔开：两队最强，只能在决赛相遇）；抽签池排除韩国防重复参赛
 const others=shuffle(AG_NATIONS.filter(([n])=>n!=='韩国').map(([n])=>n).slice());
 s.ag={squad:squad.map(p=>({name:p.name,pos:p.pos,mine:ownedIds.has(p.id),ovr:overall(p)})),
 myPow,qf:[{a:'中国代表队',b:others[0],r:null},{a:others[2],b:others[3],r:null},{a:others[4],b:others[5],r:null},{a:'韩国',b:others[1],r:null}],
 sf:[{a:null,b:null,r:null},{a:null,b:null,r:null}],final:{a:null,b:null,r:null},champ:null,mvp:null,medal:null};
 s.phase='asiad';
 const mineCnt=s.ag.squad.filter(x=>x.mine).length;
 logEvent(s,' '+gameYear(s)+' '+AG_CITY+'亚运会开幕！中国代表队由 KPL 各位置当季最强组成（战力 '+myPow+'）');
 logEvent(s,' 中国代表队名单：'+s.ag.squad.map(x=>POS[x.pos][1]+' '+x.name+(x.mine?'（本队）':'')).join('、')+' —— 最强对手：韩国');
 if(mineCnt)logEvent(s,' 你队有 '+mineCnt+' 名选手被征召！赛程由国家队教练组指挥，成绩将以奖牌加成形式回流俱乐部');
 save();renderAll();
}
function asiadStep(s){
 const a=s.ag;if(!a||a.champ)return;
 const done=[];
 const play=m=>{const r=simSeriesResult(s,m.a,m.b,7);m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;done.push(m);};
 if(a.qf.some(m=>!m.r)){a.qf.forEach(m=>{if(!m.r)play(m);});}
 else if(a.sf.some(m=>!m.r)){a.sf.forEach((m,i)=>{if(m.a===null)m.a=a.qf[i*2].r;if(m.b===null)m.b=a.qf[i*2+1].r;if(!m.r)play(m);});}
 else if(!a.final.r){
 if(a.final.a===null)a.final.a=a.sf[0].r;
 if(a.final.b===null)a.final.b=a.sf[1].r;
 play(a.final);
 }else{finishAsianGames(s);return;}
 done.forEach(m=>logEvent(s,' 亚运会淘汰赛（BO7）：'+m.a+' '+(m.ms||0)+':'+(m.es||0)+' '+m.b+'，'+m.r+' 晋级'));
 if(a.final.r)finishAsianGames(s);
 else{save();renderAll();}
}
function finishAsianGames(s){
 const a=s.ag;if(!a||a.champ)return;
 a.champ=a.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(a.final);
 const bronzes=a.sf.map(loserOf).filter(Boolean);
 a.medal=a.champ==='中国代表队'?'金牌':runner==='中国代表队'?'银牌':bronzes.includes('中国代表队')?'铜牌':'无';
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:null,event:'亚运会',champ:a.champ}]).slice(-16);
 logEvent(s,' '+gameYear(s)+' 亚运会王者荣耀项目落幕：'+a.champ+' 金牌 · '+(runner==='中国代表队'?'中国队':'韩国等队')+' 银牌');
 if(a.champ==='中国代表队')logEvent(s,' 中国代表队登顶亚洲之巅——国旗升起时刻，整个 KPL 都在看！');
 else if(a.medal==='无')logEvent(s,' 中国队无缘领奖台，舆论哗然');
 // MVP：冠军队内战力最高者；中国队夺冠时从「实际出征名单」（锁定快照）里评——不能用当下重选，
 // 否则夏窗后的联盟变化可能评出一个没入选国家队的选手
 if(a.champ==='中国代表队'){
 const best=a.squad.slice().sort((x,y)=>y.ovr-x.ovr)[0];
 if(best){a.mvp=best.name;logEvent(s,' 亚运会 MVP：'+best.name+'（'+POS[best.pos][0]+'）当选');}
 }
 // 奖牌回流俱乐部：本队入选选手按奖牌档位获得人气/身价/士气，协会发奖金；代价是年总体力下滑
 const mine=a.squad.filter(x=>x.mine);
 const add={'金牌':[8,6],'银牌':[5,4],'铜牌':[3,2],'无':[1,0]}[a.medal];
 const prizeBase={'金牌':67,'银牌':33,'铜牌':17,'无':8}[a.medal];
 mine.forEach(x=>{
 const p=(s.players||[]).find(y=>y.name===x.name);
 if(!p)return;
 p.popularity=Math.min(99,(p.popularity||0)+add[0]);
 p.val=clamp((p.val||100)+add[1],70,150);
 p.morale=clamp(p.morale+5,20,100);
 p.energy=clamp((p.energy==null?100:p.energy)-15,30,100); // 国家队征召消耗：年总开局体力不满
 });
 if(mine.length){
 const prize=Math.round(prizeBase*mine.length/5);
 if(prize)grantPrize(s,prize,'亚运会奖金（'+a.medal+'档 · '+mine.length+' 名选手入选）');
 if(s.mode==='player'&&s.career&&mine.some(x=>x.name===(myPlayer(s)||{}).name))s.career.nat=(s.career.nat||0)+1; // 生涯履历：国家队履历
 logEvent(s,' 亚运会加成：'+mine.map(x=>x.name).join('、')+' 人气+'+add[0]+' · 身价+'+add[1]+'（征召消耗体力，年总开局体力不满）');
 if(a.mvp&&mine.some(x=>x.name===a.mvp)){
 const p=(s.players||[]).find(y=>y.name===a.mvp);
 if(p){p.popularity=Math.min(99,(p.popularity||0)+10);p.val=clamp((p.val||100)+5,70,150);
 logEvent(s,' 亚运会 MVP 是你的 '+a.mvp+'！专属冠军皮肤安排（人气+10 · 身价+5）');}
 }
 }
 if(a.squad.some(x=>x.mine)){ // 成绩曲线：本队有选手出征才记亚运
 s.yearStages=s.yearStages||[];
 s.yearStages.push({ev:'亚运会',place:a.medal==='金牌'?'金牌':a.medal==='银牌'?'银牌':a.medal==='铜牌'?'铜牌':'无奖牌'});
 }
 s.agDone=true;
 // 集训归队：清除征召标记 + 撤掉青训临时借调（亚运后恢复完整阵容打年总）
 s.players.forEach(p=>{p.natCamp=false;});
 s.natCampIds=[];
 const fills=s.players.filter(p=>p.natFill);
 if(fills.length){
 fills.forEach(p=>{const li=s.lineup.indexOf(p.id);if(li>=0)s.lineup.splice(li,1);});
 s.players=s.players.filter(p=>!p.natFill);
 logEvent(s,' 集训借调青训归位：'+fills.map(p=>p.name).join('、')+' 返回青训营，征召选手全员归队备战年总');
 }
 setupAnnual(s);
}
/* ================= KPL 年度总决赛（年末最高规格） =================
 年度积分前 12 入围：擂台赛（大师组=积分前6 × 精英组=后6，组外单循环 BO5，每队6场）
 → 突围赛（大师5/6+精英2-5，6队 BO7 单败，3队晋级；精英第6名直接出局）
 → 淘汰赛（8队 BO7 双败），冠军捧圣龙杯 + 2000万级奖金池（游戏内取 800 万冠军奖）。 */
function annualRank(s){
 return Object.keys(s.annualPts||{}).sort((a,b)=>(s.annualPts[b]||0)-(s.annualPts[a]||0)||powerOf(s,b)-powerOf(s,a));
}
function setupAnnual(s){
 const all=annualRank(s);
 const q=all.slice(0,12);
 s.annual={stage:'arena',roundIdx:0,masters:q.slice(0,6),elites:q.slice(6,12),q};
 // 擂台赛：6×6 组外单循环（大师组×精英组轮转配对，每队 6 场 BO5）
 s.annual.rounds=[];
 for(let r=0;r<6;r++){
 const ms=[];
 for(let i=0;i<6;i++)ms.push({a:s.annual.masters[i],b:s.annual.elites[(i+r)%6],r:null});
 s.annual.rounds.push(ms);
 }
 s.phase='annual';
 const myRank=all.indexOf(s.teamName);
 if(myRank<0||myRank>=12){
 logEvent(s,' 年度积分 '+(s.annualPts[s.teamName]||0)+' 分（第'+(myRank+1)+'），无缘年度总决赛（前12）——春夏赛季继续攒分');
 simCup('annual',s); // AI 自动补完全部年总赛程（内部收尾走年度轮换）
 return;
 }
 logEvent(s,' '+gameYear(s)+' KPL 年度总决赛开幕！你队以年度积分 '+s.annualPts[s.teamName]+' 分（第'+(myRank+1)+'名）进入'+(myRank<6?'大师组':'精英组'));
 save();renderAll();
}
function arenaStandings(s){
 const M={},E={};
 s.annual.masters.forEach(t=>M[t]={pts:0,pw:0});
 s.annual.elites.forEach(t=>E[t]={pts:0,pw:0});
 s.annual.rounds.flat().forEach(m=>{
 if(!m.r)return;
 const aWin=m.r===m.a,ms=m.ms==null?4:m.ms,es=m.es==null?0:m.es;
 const wT=aWin?M:E,lT=aWin?E:M;
 wT[m.r].pts++;wT[m.r].pw+=aWin?ms:es;
 lT[aWin?m.b:m.a].pw+=aWin?es:ms;
 });
 return {M,E};
}
function annualStep(s){ // 年总推进分派（finishSeries cup 分支 / AI 场次递归入口）
 const a=s.annual;if(!a)return;
 if(a.stage==='arena')annualArenaNext(s);
 else if(a.stage==='breakthrough')annualBrkNext(s);
 else if(a.stage==='po')annualPoStep(s);
}
function startAnnualArena(s){
 const a=s.annual;
 const rd=a.rounds[a.roundIdx];
 if(!rd){finishArena(s);return;}
 const my=rd.find(m=>m.a===s.teamName||m.b===s.teamName);
 if(!my){finishArena(s);return;}
 playCupMatch(s,my,'arena_r'+(a.roundIdx+1),'年总·擂台赛 第'+(a.roundIdx+1)+'轮',KPL.BO5);
}
function annualArenaNext(s){
 const a=s.annual;
 const rd=a.rounds[a.roundIdx];
 if(!rd){finishArena(s);return;}
 // 本轮 AI 场次补完（玩家场次已由 finishSeries 写入 m.r/ms/es）
 rd.forEach(m=>{
 if(m.r)return;
 const r=simSeriesResult(s,m.a,m.b,KPL.BO5);
 m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;
 });
 const rep=rd.filter(m=>!(m.a===s.teamName||m.b===s.teamName)).slice(0,3).map(m=>m.a+' '+m.ms+':'+m.es+' '+m.b).join('；');
 if(rep)logEvent(s,' 擂台赛第'+(a.roundIdx+1)+'轮：'+rep);
 a.roundIdx++;
 if(a.roundIdx>=6)finishArena(s);
}
function finishArena(s){
 const st=arenaStandings(s);
 const rankOf=(tbl,teams)=>teams.slice().sort((x,y)=>tbl[y].pts-tbl[x].pts||tbl[y].pw-tbl[x].pw);
 const mRank=rankOf(st.M,s.annual.masters),eRank=rankOf(st.E,s.annual.elites);
 s.annual.mRank=mRank;s.annual.eRank=eRank;
 logEvent(s,' 擂台赛收官！大师组前四直进淘汰赛：'+mRank.slice(0,4).join('、')+'；精英组第1名 '+eRank[0]+' 直进淘汰赛');
 s.annual.stage='breakthrough';
 // 突围赛：大师5/6 与 精英2-5 六队 BO7 单败（高顺位种子错开：M5vE5、M6vE4、E2vE3）
 s.annual.brk=[{a:mRank[4],b:eRank[4],r:null},{a:mRank[5],b:eRank[3],r:null},{a:eRank[1],b:eRank[2],r:null}];
 logEvent(s,' 突围赛对阵：'+s.annual.brk.map(m=>m.a+' vs '+m.b).join('；')+'（胜者进淘汰赛 · 精英组第6名 '+eRank[5]+' 遗憾出局）');
 const myBrk=s.annual.brk.some(m=>m.a===s.teamName||m.b===s.teamName);
 if(!myBrk){let g=0;while(s.annual.stage==='breakthrough'&&g++<10)annualBrkNext(s);}
 save();renderAll();
}
function annualBrkNext(s){
 const a=s.annual;if(!a.brk)return;
 for(let i=0;i<3;i++){const m=a.brk[i];if(!m.r){playCupMatch(s,m,'brk'+(i+1),'年总·突围赛',KPL.BO7);return;}}
 finishBreakthrough(s);
}
function finishBreakthrough(s){
 const winners=s.annual.brk.map(m=>m.r);
 const eight=shuffle([s.annual.mRank[0],s.annual.mRank[1],s.annual.mRank[2],s.annual.mRank[3],s.annual.eRank[0],...winners]);
 s.annual.stage='po';
 s.annual.po=buildCup8(eight); // 8 队 BO7 双败
 logEvent(s,' 年度总决赛·淘汰赛开启！8 强 BO7 双败：'+eight.join('、'));
 if(!eight.includes(s.teamName)){
 let g=0;while(s.annual.po&&!s.annual.po.champ&&g++<30)annualPoStep(s); // 内部终局时自动 finishAnnual→年度轮换
 return;
 }
 save();renderAll();
}
/* 8 队双败淘汰 bracket（BO7，种子 1v8/4v5/2v7/3v6 落位）——年总淘汰赛 / 挑战者杯 8 强共用 */
function buildCup8(teams){
 return {
 wb1:[{a:teams[0],b:teams[7],r:null},{a:teams[3],b:teams[4],r:null},{a:teams[1],b:teams[6],r:null},{a:teams[2],b:teams[5],r:null}],
 wb2:[{a:null,b:null,r:null},{a:null,b:null,r:null}],wf:{a:null,b:null,r:null},
 lb1:[{a:null,b:null,r:null},{a:null,b:null,r:null}],lb2:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
 lbs:{a:null,b:null,r:null},lbf:{a:null,b:null,r:null},final:{a:null,b:null,r:null},champ:null};
}
function annualPoStep(s){
 const p=s.annual.po;if(!p)return;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const P=(m,slot,label)=>playCupMatch(s,m,slot,label,KPL.BO7);
 for(let i=0;i<4;i++)if(!p.wb1[i].r){P(p.wb1[i],'apo_wb1_'+(i+1),'年总·胜者组首轮');return;}
 for(let i=0;i<2;i++){const m=p.lb1[i];if(m.a===null)m.a=loserOf(p.wb1[i*2]);if(m.b===null)m.b=loserOf(p.wb1[i*2+1]);if(!m.r){P(m,'apo_lb1_'+(i+1),'年总·败者组首轮');return;}}
 for(let i=0;i<2;i++){const m=p.wb2[i];if(m.a===null)m.a=p.wb1[i*2].r;if(m.b===null)m.b=p.wb1[i*2+1].r;if(!m.r){P(m,'apo_wb2_'+(i+1),'年总·胜者组半决赛');return;}}
 for(let i=0;i<2;i++){const m=p.lb2[i];if(m.a===null)m.a=p.lb1[i].r;if(m.b===null)m.b=loserOf(p.wb2[i]);if(!m.r){P(m,'apo_lb2_'+(i+1),'年总·败者组第二轮');return;}}
 if(p.wf.a===null){p.wf.a=p.wb2[0].r;p.wf.b=p.wb2[1].r;}
 if(!p.wf.r){P(p.wf,'apo_wf','年总·胜者组决赛');return;}
 if(p.lbs.a===null){p.lbs.a=p.lb2[0].r;p.lbs.b=p.lb2[1].r;}
 if(!p.lbs.r){P(p.lbs,'apo_lbs','年总·败者组半决赛');return;}
 if(p.lbf.a===null){p.lbf.a=loserOf(p.wf);p.lbf.b=p.lbs.r;}
 if(!p.lbf.r){P(p.lbf,'apo_lbf','年总·败者组决赛');return;}
 if(p.final.a===null){p.final.a=p.wf.r;p.final.b=p.lbf.r;}
 if(!p.final.r){P(p.final,'apo_final','年总·总决赛');return;}
 finishAnnual(s,true);
}
function finishAnnual(s,silent){
 const p=s.annual&&s.annual.po;
 if(p&&p.final.r&&!p.champ){
 p.champ=p.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(p.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'年总',champ:p.champ}]).slice(-16);
 logEvent(s,' '+gameYear(s)+' KPL 年度总决赛落幕：'+p.champ+' 捧起圣龙杯！'+(p.champ===s.teamName?'年度至尊荣耀！':''));
 let prize=0; // 年总奖金（真实 2000 万级冠军奖，游戏内取 800 万）
 if(p.champ===s.teamName)prize=1333;
 else if(runner===s.teamName)prize=667;
 else if([p.lbf,p.lbs].some(m=>m.r&&loserOf(m)===s.teamName))prize=417;
 else if(p.lb2.concat(p.lb1).some(m=>m.r&&loserOf(m)===s.teamName))prize=200;
 if(prize)grantPrize(s,prize,'年度总决赛奖金');
 if(p.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' KPL年度总决赛 '+(p.champ===s.teamName?'冠军':'亚军'),champion:p.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,p.champ,gameYear(s)+' KPL 年度总决赛');
 s.champion=p.champ===s.teamName;
 addFans(s,p.champ===s.teamName?25:(runner===s.teamName?12:6),'KPL 年度总决赛'); // 年总是全年最大的曝光
 }
 // 成绩曲线：年总名次入档
 s.yearStages=s.yearStages||[];
 if(p&&p.final.r){
 const loserOf=m=>m.r===m.a?m.b:m.a; // 块内局部（冠军结算分支的同名工具）
 const myPlace=p.champ===s.teamName?'冠军':loserOf(p.final)===s.teamName?'亚军'
 :[p.lbf,p.lbs].some(m=>m.r&&loserOf(m)===s.teamName)?'四强'
 :p.lb2.concat(p.lb1).some(m=>m.r&&loserOf(m)===s.teamName)?'八强':'参赛';
 s.yearStages.push({ev:'KPL年度总决赛',place:myPlace});
 }else s.yearStages.push({ev:'KPL年度总决赛',place:'未晋级'});
 /* 赛季末结算：经理/教练走董事会评价；选手走个人赛季结算（冠军/FMVP 由荣誉室自然累计） */
 if(s.mode==='player')playerYearSettle(s);
 else boardSettle(s);
 if(s.mode==='coach')coachPoach(s); // 教练带队出色 → 豪门挖角邀约
 buildYearReview(s); // 年度回顾快照：成绩曲线/转会记录/董事会评价/关键战役（必须在 newSeason 前）
 newSeason(s); // 年度轮换：年龄/合同/退役结算 → 下一年春季赛
}

/* ================= 杯赛通用流程（EWC / 挑战者杯 / 年总共用） ================= */
const BO_TXT=bo=>bo===5?'BO5 全局BP':bo===9?'BO9·第9局巅峰对决':'BO7·含巅峰对决';
function playCupMatch(s,m,slot,label,bo){
 if(m.a===s.teamName||m.b===s.teamName){
 const opName=m.a===s.teamName?m.b:m.a;
 if(s.mode==='player'){ // 选手生涯：教练指挥，自动打完整场杯赛系列赛
 const sr=playerAutoSeries(s,opName,bo);
 const myWin=sr.mw>sr.ow;
 m.r=myWin?s.teamName:opName;
 if(m.a===s.teamName){m.ms=sr.mw;m.es=sr.ow;}else{m.ms=sr.ow;m.es=sr.mw;}
 s._lastMvps=(sr.mvpIds||[]).slice(); // 决赛 FMVP 评选用
 rosterLineup(s).forEach(p=>{p.apps=(p.apps||0)+1;});
 logEvent(s,' '+label+'：'+s.teamName+' '+(myWin?'胜':'负')+' '+opName+' '+sr.mw+':'+sr.ow+(myWin?'，晋级':'，止步'));
 (s.history=s.history||[]).unshift({yr:gameYear(s),opp:opName,stage:label,score:sr.mw+':'+sr.ow,win:myWin,logs:sr.logs,peak:sr.max>=7&&sr.mw+sr.ow===sr.max});
 s.history=s.history.slice(0,20);
 save();renderAll();
 if(s.phase==='ewc')ewcStep(s);
 else if(s.phase==='challenger')challengerStep(s);
 else annualStep(s);
 return;
 }
 if(s.series&&s.series.stage==='cup'&&s.series.cupSlot===slot){
 showPreMatch(label+'（'+BO_TXT(bo)+'）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:bo,stage:'cup',cupSlot:slot,cupMatch:m,cupLabel:label,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'playoff',opName)};s.seriesAuto=false;
 resetOppEnergy(s,opName);
 showPreMatch(label+'（'+BO_TXT(bo)+'）vs '+opName+' · 第1局');
 return;
 }
 const r=simSeriesResult(s,m.a,m.b,bo);
 m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;
 logEvent(s,' '+label+'：'+m.a+' '+(r.win?'胜':'负')+' '+m.b+'，'+m.r+' 晋级');
 save();renderAll();
 if(s.phase==='ewc')ewcStep(s);
 else if(s.phase==='challenger')challengerStep(s);
 else annualStep(s); // 年总各阶段推进（擂台 AI 场次不走此路径，突围/淘汰赛走此分派）
}
function simCup(kind,s){ // 玩家未晋级：AI 自动补完杯赛
 let guard=0;
 if(kind==='ewc'){while(s.ewc&&!s.ewc.champ&&guard++<20)ewcStep(s);}
 else if(kind==='challenger'){while(s.challenger&&!s.challenger.champ&&guard++<60)challengerStep(s);}
 else{while(s.annual&&(s.annual.stage!=='po'||!s.annual.po.champ)&&guard++<80)annualStep(s);}
}
function startCup(s){ // 杯赛 UI 入口（进行下一场 / 快进）
 if(s.phase==='ewc'){ewcStep(s);return;}
 if(s.phase==='challenger'){challengerStep(s);return;}
 if(s.phase==='annual'){
 const a=s.annual;
 if(a.stage==='arena')startAnnualArena(s);
 else if(a.stage==='breakthrough')annualBrkNext(s);
 else annualPoStep(s);
 }
}
