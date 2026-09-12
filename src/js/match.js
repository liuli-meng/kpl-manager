
/* ===== 比赛文字直播（事件模板池 × 数据驱动语境，2026-09 文案升级） =====
 旧版全池约 30 条固定模板，打多了必然复读。升级三件事：
 ① 池子扩容：一血/击杀/资源/推塔/团战/抢龙/战术解说/被动侧 8 类合计 90+ 条；
 ② 语境编织：选用/绝活英雄、战术克制、比分背景（赛点局）、红蓝方、本局 MVP 的真实 KDA
    全部织进句子——同模板在不同对局长出不同文本；
 ③ 系列赛去重：sr._usedTxt 记录用过的句式（随存档持久化），同一场系列赛同一句式不重复。
 纯本地生成零网络依赖；AI 赛后战报是独立的可选增强（maybeAiReport，默认关闭）。 */
function storyPick(id,pool,used){
 const key=id+':';
 for(let i=0;i<10;i++){const idx=Math.floor(Math.random()*pool.length);if(!used.includes(key+idx)){used.push(key+idx);return pool[idx];}}
 return pool[Math.floor(Math.random()*pool.length)];
}
function genMatchStory(sr,g,mvp){
 const used=sr._usedTxt=(sr._usedTxt||[]);
 const myLs=rosterLineup(S);
 const opR=ensureAiRosters(S,sr.opName)||[];
 const R=arr=>arr[Math.floor(Math.random()*arr.length)];
 const any=arr=>arr.length?R(arr):null;
 const a=any(myLs),b=any(myLs),o=any(opR),o2=any(opR);
 const myHero=p=>p?((S.pick&&S.pick[p.pos])||p.sig||''):'';
 const heroTxt=p=>{const h=myHero(p);return h?` 的 ${h}`:'';};
 const opHeroTxt=p=>{const h=p?(p.sig||''):'';return h?` 的 ${h}`:'';};
 const laneN=()=>R(['对抗路','发育路','中路','河道']);
 const win=g.w,diff=Math.abs(g.myK-g.opK),close=diff<=2,blowout=diff>=5;
 const mins=[3,6,9,13,17,21];
 const P=(id,pool)=>storyPick(id,pool,used)();
 const lines=[];
 // —— 一血（每侧 8 条，带选用/招牌英雄语境）——
 const fbMy=Math.random()<(win?0.62:0.38);
 lines.push(fbMy?P('fb_my',[
 ()=>`第${mins[0]}分钟，一血爆发！${a?a.name:'我方选手'}${heroTxt(a)} 单杀 ${o?o.name:'对方选手'}，拿下开门红！`,
 ()=>`第${mins[0]}分钟，${a?a.name:'我方选手'} 蹲到 ${o?o.name:'对方选手'} 落单，一套连招带走一血！`,
 ()=>`第${mins[0]}分钟，一级团设计成功，${a?a.name:'我方选手'} 收下一血，开局占先手！`,
 ()=>`第${mins[0]}分钟，${a?a.name:'我方选手'}${heroTxt(a)} 极限换血反打，一血到手，解说席都站起来了！`,
 ()=>`第${mins[0]}分钟，${o?o.name:'对方选手'} 压线过深，${a?a.name:'我方选手'} 配合队友包夹拿下一血！`,
 ()=>`第${mins[0]}分钟，${a?a.name:'我方选手'} 抢二突袭，${o?o.name:'对方选手'} 反应慢了半拍，一血入账！`,
 ()=>`第${mins[0]}分钟，视野战立功！${a?a.name:'我方选手'} 绕后收下一血。`,
 ()=>`第${mins[0]}分钟，${sr.side==='red'?'红方':'蓝方'}开局强开，${a?a.name:'我方选手'} 拿下一血！`,
 ]):P('fb_op',[
 ()=>`第${mins[0]}分钟，${o?o.name:'对方选手'}${opHeroTxt(o)} 拿到一血，我方 ${a?a.name:'选手'} 被击杀。`,
 ()=>`第${mins[0]}分钟，对方 ${o?o.name:'选手'} 一级团设计更胜一筹，一血落入敌手。`,
 ()=>`第${mins[0]}分钟，${o?o.name:'对方选手'} 抓住 ${a?a.name:'我方选手'} 的走位失误拿下一血。`,
 ()=>`第${mins[0]}分钟，我方野区被反，${o?o.name:'对方选手'} 顺势收下一血。`,
 ()=>`第${mins[0]}分钟，${a?a.name:'我方选手'} 想拼操作但差了一点，${o?o.name:'对方选手'} 拿下一血。`,
 ()=>`第${mins[0]}分钟，对方双人越塔强抓，${a?a.name:'我方选手'} 交出一血，节奏被动。`,
 ()=>`第${mins[0]}分钟，${o?o.name:'对方选手'} 抢到关键视野，顺手带走 ${a?a.name:'我方选手'} 拿一血。`,
 ()=>`第${mins[0]}分钟，开局被抓，${a?a.name:'我方选手'} 的一血送得有点冤。`,
 ]));
 // —— 中盘事件：我方优势侧 6 类 / 被动侧 4 类，全部带人名·英雄·兵线槽位 ——
 for(let i=1;i<mins.length;i++){
 const m=mins[i];
 const myEvent=Math.random()<(win?0.7:0.36);
 const kind=R(myEvent?['kill','kill','obj','tower','fight','fight','steal','skill']:['opkill','opkill','opobj','optower','opfight']);
 const t=(myEvent?{
 kill:[
 ()=>`${a?a.name:'我方选手'} 配合 ${b?b.name:'队友'} 抓死 ${o?o.name:'对方选手'}，节奏来了！`,
 ()=>`${a?a.name:'我方选手'} 草丛蹲伏，一套连招带走 ${o?o.name:'对方选手'}！`,
 ()=>`${a?a.name:'我方选手'} 极限反杀 ${o?o.name:'对方选手'}，丝血逃生！`,
 ()=>`${a?a.name:'我方选手'} 绕后切入，${o?o.name:'对方选手'} 来不及反应直接蒸发！`,
 ()=>`${a?a.name:'我方选手'} 越塔强杀 ${o?o.name:'对方选手'}，打得真凶！`,
 ()=>`${a?a.name:'我方选手'}${heroTxt(a)} 伤害拉满，${o?o.name:'对方选手'} 血条瞬间消失！`,
 ()=>`${b?b.name:'我方选手'} 先手控住，${a?a.name:'我方选手'} 跟上补伤害，${o?o.name:'对方选手'} 当场倒地！`,
 ()=>`${a?a.name:'我方选手'} 在${laneN()}完成单杀，${o?o.name:'对方选手'} 心态有点崩。`,
 ()=>`${a?a.name:'我方选手'} 闪现追击收下 ${o?o.name:'对方选手'}，这波不亏反赚！`,
 ()=>`${o?o.name:'对方选手'} 想试探草丛，被 ${a?a.name:'我方选手'} 一套秒掉，白给。`,
 ()=>`${a?a.name:'我方选手'} 借${laneN()}兵线卡视野，突袭带走 ${o?o.name:'对方选手'}！`,
 ()=>`${a?a.name:'我方选手'} 反蹲到位，${o?o.name:'对方选手'} 的进攻变成送人头。`,
 ],
 obj:[
 ()=>`我方稳稳控下暴君，经济小优！`,
 ()=>`${a?a.name:'我方选手'} 抢下暗影主宰，召唤主宰先锋推进！`,
 ()=>`风暴龙王刷新，我方抱团控下，局面大好！`,
 ()=>`我方拿下主宰，兵线压力直接给满，对面只能守家。`,
 ()=>`${a?a.name:'我方选手'} 惩戒掐点收下暴君，对面打野看傻了。`,
 ()=>`我方控下暗影暴君，全队加成上身，团战底气更足。`,
 ()=>`我方四人抱团压视野白拿暴君，${o?o.name:'对方选手'} 只能望龙兴叹。`,
 ()=>`双龙汇打法成型，我方连收暴君与主宰！`,
 ],
 tower:[
 ()=>`我方推掉对方${laneN()}一塔，打开局面！`,
 ()=>`${a?a.name:'我方选手'} 带线推进，对方${laneN()}二塔告破！`,
 ()=>`我方强上高地，${laneN()}高地塔被磨掉大半！`,
 ()=>`${a?a.name:'我方选手'} 带着主宰先锋直拆高地，对面拦都拦不住。`,
 ()=>`我方${laneN()}一塔速推成功，经济差开始拉开！`,
 ()=>`对方中路二塔在 ${a?a.name:'我方选手'} 的强拆下轰然倒塌！`,
 ],
 fight:[
 ()=>`河道团战，我方 1 换 3，血赚！`,
 ()=>`${a?a.name:'我方选手'} 大招开团，我方打出 0 换 4！`,
 ()=>`ACE！我方团灭对手，天平彻底倾斜！`,
 ()=>`${a?a.name:'我方选手'} 关键绕后开团，直接打崩对方阵型！`,
 ()=>`高地团战我方全员站位完美，团灭对面还不掉点！`,
 ()=>`${a?a.name:'我方选手'} 闪现开到双人，${b?b.name:'队友'} 收割战场，团战大胜！`,
 ()=>`风暴龙王团我方打出完美阵型，一波团灭对面！`,
 ()=>`${a?a.name:'我方选手'} 切死对方后排，${o2?o2.name:'对方选手'} 想跑已经来不及，团战我方碾压！`,
 ()=>`我方逆风抱团打出漂亮反手团，1 换 4 翻盘在望！`,
 ()=>`${a?a.name:'我方选手'} 抢到关键视野，团战先手秒掉 ${o?o.name:'对方选手'}！`,
 ],
 steal:[
 ()=>`${a?a.name:'我方选手'} 惩戒抢下暴君，${o?o.name:'对方选手'} 当场愣住！`,
 ()=>`${a?a.name:'我方选手'} 残血极限抢龙，对面打野这波亏麻了。`,
 ()=>`${a?a.name:'我方选手'} 一脚踩进龙坑抢下主宰，风向瞬间逆转！`,
 ()=>`${o?o.name:'对方选手'} 打了半天龙，被 ${a?a.name:'我方选手'} 一惩戒抢走！`,
 ()=>`${a?a.name:'我方选手'} 预判惩戒时机，风暴龙王收入囊中！`,
 ()=>`龙坑博弈我方更胜一筹，${a?a.name:'我方选手'} 抢下关键资源！`,
 ],
 skill:[
 ()=>`我方「${(S.tactic&&S.tactic!=='balanced')?tacticById(S.tactic).name:'均衡运营'}」体系奏效，${laneN()}优势全面展开。`,
 ()=>`战术板显灵——「${(S.tactic&&S.tactic!=='balanced')?tacticById(S.tactic).name:'均衡运营'}」的节奏完全按我方剧本走。`,
 ()=>`${a?a.name:'我方选手'} 按战术布置让出线权，${b?b.name:'队友'} 起飞了。`,
 ()=>`对「${sr._opTactic?tacticById(sr._opTactic).name:'均衡运营'}」的克制布置生效，对面打法被完全预测。`,
 ()=>`我方阵容在这个版本里打得游刃有余，${a?a.name:'我方选手'} 如鱼得水。`,
 ],
 }:{
 opkill:[
 ()=>`${o?o.name:'对方选手'} 越塔强杀我方 ${a?a.name:'选手'}，这波有点亏。`,
 ()=>`对方 ${o?o.name:'选手'} 开团，我方 ${a?a.name:'选手'} 被集火击杀。`,
 ()=>`${o?o.name:'对方选手'} 蹲到我方 ${a?a.name:'选手'}，视野缺失导致掉点。`,
 ()=>`${o?o.name:'对方选手'}${opHeroTxt(o)} 操作拉满，我方 ${a?a.name:'选手'} 招架不住。`,
 ()=>`我方 ${a?a.name:'选手'} 想反打但伤害差一截，被 ${o?o.name:'对方选手'} 反杀。`,
 ()=>`${o2?o2.name:'对方选手'} 绕后包抄，${a?a.name:'我方选手'} 进退两难被留下。`,
 ()=>`我方支援慢了一步，${o?o.name:'对方选手'} 白拿一个人头。`,
 ()=>`${a?a.name:'我方选手'} 深追被包了饺子，这波冲得太深了。`,
 ],
 opobj:[
 ()=>`对方收下暴君，经济被拉开一点。`,
 ()=>`对方拿到暗影主宰，兵线压力陡增。`,
 ()=>`${o?o.name:'对方选手'} 惩戒掐点抢下龙王，我方龙坑博弈输了。`,
 ()=>`我方想争暴君但站位太散，对面白捡一条龙。`,
 ()=>`对方控下双龙会合，我方防守压力剧增。`,
 ],
 optower:[
 ()=>`对方推掉我方${laneN()}一塔，需要稳住。`,
 ()=>`我方${laneN()}二塔被破，对方视野压进来了。`,
 ()=>`${o?o.name:'对方选手'} 带线太深，我方${laneN()}高地塔岌岌可危。`,
 ()=>`我方回防不及，${laneN()}被对方一波拆穿。`,
 ()=>`对方主宰先锋顶在前面，我方${laneN()}防线告破。`,
 ],
 opfight:[
 ()=>`团战失利，我方 2 换 1，有点难受。`,
 ()=>`对方打出 ACE，我方被打了一波团灭。`,
 ()=>`${o?o.name:'对方选手'} 一波完美开团，我方阵型被冲散。`,
 ()=>`我方团战技能交了一半就被秒，${o?o.name:'对方选手'} 收割干净利落。`,
 ()=>`我方想抢龙引发团战，结果 1 换 4 大亏，节奏全丢。`,
 ()=>`${o?o.name:'对方选手'} 后排输出拉满，我方前排顶不住，团战溃败。`,
 ],
 })[kind];
 lines.push(`第${m}分钟，${P('ev_'+kind,t)}`);
 }
 // —— 收官（胜方含 MVP 数据钩织 / 败方各 8 条，赛点局语境）——
 const endM=22+Math.floor(Math.random()*10);
 const need=Math.ceil(sr.max/2);
 const decider=sr.mw+sr.ow===sr.max-1&&(sr.mw===need-1||sr.ow===need-1); // 本局即决胜局
 if(g.w&&mvp){
 lines.push(P('end_wm',[
 ()=>`第${endM}分钟，${mvp.name} 以 ${mvp.k}/${mvp.d}/${mvp.a} 的战绩收下本局MVP${close?'，逆风翻盘实至名归！':blowout?'，碾压局里也打出了统治力！':'，关键先生就是他！'}`,
 ()=>`第${endM}分钟，兵线进塔，${mvp.name} 点掉水晶！${mvp.k}/${mvp.d}/${mvp.a}，本局MVP没有悬念。`,
 ()=>`第${endM}分钟，水晶炸裂！${mvp.name} 的 ${mvp.k}/${mvp.d}/${mvp.a} 就是本局的答案。`,
 ()=>`第${endM}分钟，${mvp.name} 一锤定音，${mvp.k}/${mvp.d}/${mvp.a} 的数据单漂亮得能裱起来。`,
 ()=>`第${endM}分钟，拿下本局！${mvp.name} 用 ${mvp.k}/${mvp.d}/${mvp.a} 证明谁是这局的主人。`,
 ()=>`第${endM}分钟，${mvp.name}${heroTxt(myLs.find(p=>p.id===mvp.id))} 收下决胜一击，${mvp.k}/${mvp.d}/${mvp.a} 当选MVP！`,
 ]));
 }else if(g.w){
 lines.push(P('end_w',[
 ()=>`第${endM}分钟，${close?'逆风翻盘！我方关键抢龙，一波推平水晶拿下本局！':blowout?'碾压局！我方带队直取水晶，对手毫无还手之力！':'兵线进塔，我方点掉水晶，拿下本局！'}`,
 ()=>`第${endM}分钟，${blowout?'对面完全没有还手之力，水晶告破，漂亮！':'最后一波团战我方全员拉满，水晶爆炸，本局到手！'}`,
 ()=>`第${endM}分钟，${decider?'决胜局顶住了！我方推掉水晶，全场沸腾！':'稳稳拿下本局，比分变成 '+sr.mw+':'+sr.ow+'。'}`,
 ()=>`第${endM}分钟，${a?a.name:'我方选手'} 带队一波结束战斗，本局拿下！`,
 ()=>`第${endM}分钟，对面投降式防守没撑住，我方推平水晶${decider?'——赛点在手！':'！'}`,
 ()=>`第${endM}分钟，龙兵进高地，${blowout?'对面的防线形同虚设，水晶应声而碎！':'我方干净利落终结本局！'}`,
 ()=>`第${endM}分钟，${sr.side==='red'?'红':'蓝'}方拿下本局——就是我们！`,
 ()=>`第${endM}分钟，从${laneN()}优势滚成全局胜势，本局拿下！`,
 ]));
 }else{
 lines.push(P('end_l',[
 ()=>`第${endM}分钟，基地前最后一波团战失利，水晶告破……可惜了。`,
 ()=>`第${endM}分钟，对方推掉水晶……${o?o.name:'对方选手'} 这局发挥确实好。`,
 ()=>`第${endM}分钟，${blowout?'对方带着主宰先锋推上高地，水晶告破，惨败一局。':'经济差没能扳回来，本局遗憾丢掉。'}`,
 ()=>`第${endM}分钟，最后一波我方阵容脱节，被 ${o?o.name:'对方选手'} 抓住机会一波带走。`,
 ()=>`第${endM}分钟，${close?'就差一点点——水晶先碎了，本局输得太可惜。':'对面节奏完全压制，本局输得不冤。'}`,
 ()=>`第${endM}分钟，${decider?'决胜局没顶住，对方先下一城，压力来到下一局。':'本局失利，比分被改写为 '+sr.mw+':'+sr.ow+'。'}`,
 ()=>`第${endM}分钟，${o?o.name:'对方选手'} 越战越勇，我方防守层层被破，水晶失守。`,
 ()=>`第${endM}分钟，一波决策失误葬送好局，${close?'本来真的有机会翻。':'这局确实打不过。'}`,
 ]));
 }
 // 解说口播（约一成对局出现一条口癖）
 if(Math.random()<0.1)lines.push(` 解说席：${pick(CASTER)}${close?'这场真是太刺激了。':''}`);
 return lines.map(l=>' '+l);
}
/* ================= 比赛流程（KPL 赛制：常规赛 BO5 / 季后赛 BO7 全局BP） ================= */
function singleGame(my,op){
 const w=Math.random()<winChance(my,op);
 return {w,myK:rnd(6,13),opK:rnd(6,13)};
}
/* 每局表现结算：为全体首发生成 KDA，滚动更新身价（均衡值=100×平均表现），并选出 MVP
 perf≈1 为平：EMA 每局向 100×近期表现收敛，区间 70~150；MVP 额外 +3 */
function gamePerform(winner){
 const ls=rosterLineup(S);
 if(!ls.length)return null;
 let best=null,bs=-1;
 ls.forEach(p=>{
 const pw=playerPower(p,pickedHero(S,p));
 const k=rnd(1,12),d=rnd(0,6),a=rnd(0,12);
 p._lk=k;p._ld=d;p._la=a; // 本局个人数据（选手生涯·「我的表现」汇总用）
 const score=k*3+a*2-d*1.5+(winner?6:2)+pw*0.5+rnd(0,3);
 const perf=(k*3+a*2-d*1.5)/25+(winner?0.35:-0.15);
 p.val=clamp(Math.round((p.val||100)*0.92+perf*8),70,150);
 p.kTotal=(p.kTotal||0)+k;p.dTotal=(p.dTotal||0)+d;p.aTotal=(p.aTotal||0)+a; // 赛季累计（场均展示用）
 if(score>bs){bs=score;best={id:p.id,name:p.name,k,d,a};}
 });
 return best;
}
/* ================= 选手生涯：比赛引擎（教练指挥，你专注表现） =================
 首发由「教练」按同位置战力每场评定；系列赛自动打完（复用文字直播/个人 KDA/MVP 结算），
 你在结算弹窗看直播和「本场你的数据」。季后赛/杯赛同理自动推进。 */
function coachPickLineup(s){ // 教练排首发：同位置健康者中取战力更强者（体力/士气实时影响评定）
 if(s.mode!=='player')return;
 const me=myPlayer(s);
 if(!me)return;
 if(me.injury>0){if(!s._meOutNoted){logEvent(s,' 伤停报告：'+me.name+'（'+me.injury+' 天恢复）本场缺席');s._meOutNoted=true;}return;}
 s._meOutNoted=false;
 const rival=s.players.filter(p=>p.pos===me.pos&&p.id!==me.id&&p.injury<=0)
 .sort((a,b)=>playerPower(b)-playerPower(a))[0];
 const li=s.lineup.indexOf(me.id);
 if(!rival){if(li<0)s.lineup.push(me.id);return;}
 const myPow=playerPower(me,(s.pick&&s.pick[me.pos])||me.sig);
 const rivPow=playerPower(rival,rival.sig);
 if(myPow>=rivPow){
 if(li<0){const ri=s.lineup.indexOf(rival.id);if(ri>=0)s.lineup[ri]=me.id;else s.lineup.push(me.id);}
 }else if(li>=0)s.lineup[li]=rival.id;
}
function playerAutoSeries(s,opName,bo){ // 自动打完整场系列赛，返回 series 形状对象（finishSeries 可直接消费）
 coachPickLineup(s);
 resetOppEnergy(s,opName);
 const sr={used:[],usedOpp:[],mw:0,ow:0,max:bo,logs:[],myName:s.teamName,opName,side:firstSide(s,'regular',opName)};
 const need=Math.ceil(bo/2);
 let guard=0,myApps=0,myK=0,myD=0,myA=0,myMvp=0;
 while(sr.mw<need&&sr.ow<need&&guard++<bo+2){
 const my=teamPower(s),op=powerOf(s,opName);
 const g=singleGame(my,op);
 rosterLineup(s).forEach(p=>{p.energy=clamp(p.energy-8,0,ENERGY_MAX);p.caps=(p.caps||0)+1;});
 if(g.w)sr.mw++;else sr.ow++;
 const mvp=gamePerform(g.w);
 if(mvp){const mp=s.players.find(x=>x.id===mvp.id);if(mp){mp.mvp=(mp.mvp||0)+1;mp.popularity=Math.min(99,(mp.popularity||0)+2);mp.val=clamp((mp.val||100)+3,70,150);}}
 if(mvp){sr.mvpIds=(sr.mvpIds||[]).concat(mvp.id);sr.mvpKda=(sr.mvpKda||[]).concat(mvp.k+'/'+mvp.d+'/'+mvp.a);}
 const me=myPlayer(s);
 const meIn=me&&rosterLineup(s).some(p=>p.id===me.id);
 if(meIn){myApps++;myK+=me._lk||0;myD+=me._ld||0;myA+=me._la||0;if(mvp&&mvp.id===me.id)myMvp++;}
 sr.logs.push('第'+(sr.mw+sr.ow)+'局  我方 '+g.myK+'-'+g.opK+' '+(g.w?'击败':'憾负')+' '+opName+' ｜ 总比分 '+sr.mw+':'+sr.ow+(mvp?' ｜ MVP：'+mvp.name+'（'+mvp.k+'/'+mvp.d+'/'+mvp.a+'）':''));
 sr.logs.push(...genMatchStory(sr,g,mvp));
 }
 if(myApps)sr.logs.push(' 本场你的数据：出战 '+myApps+' 局 · 合计 '+myK+'/'+myD+'/'+myA+(myMvp?' · 拿下 '+myMvp+' 次单局MVP':'（尚无单局MVP）'));
 return sr;
}
function startPlayerMatch(){ // 常规赛入口（选手模式：代替 startMatch 的赛前准备+BP）
 if(S.preseason){toast(' 转会期中，联赛尚未开始');return;}
 if(S.career&&S.career.retired){toast('职业生涯已退役');return;}
 const m=S.schedule[S.matchIdx];
 if(!m){toast('赛程已结束');return;}
 const sr=playerAutoSeries(S,m.opp,KPL.BO5);
 sr.stage='regular';
 S.series=sr;
 finishSeries(sr.mw>sr.ow);
}

function startMatch(){
 if(S.preseason){toast(' 赛前转会期进行中：先去转会市场完成组队，结束转会期后联赛才开始');return;}
 const m=S.schedule[S.matchIdx];
 if(!m){toast('赛程已结束');return;}
 // 系列赛中断恢复：不重置比分，直接回到赛前准备
 if(S.series&&S.series.stage==='regular'){
 showPreMatch(PHASE_NAME[S.phase]+' 第'+m.round+'/'+KPL.ROUNDS+'轮 vs '+m.opp+' · 第'+(S.series.mw+S.series.ow+1)+'局（'+S.series.mw+':'+S.series.ow+'）');
 return;
 }
 S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:firstSide(S,'regular')};S.seriesAuto=false;
 resetOppEnergy(S,m.opp); // 对手体力回满：衰减只在系列赛内累积
 showPreMatch(PHASE_NAME[S.phase]+' 第'+m.round+'/'+KPL.ROUNDS+'轮 vs '+m.opp+' · 第1局（BO5 全局BP）');
}

/* ================= 赛前准备（调整首发 → 对手情报 → 进入 BP） ================= */
function showPreMatch(title){
 autoFillLineup(S);
 window._prepTitle=title||'';
 window._prepPos=null;
 renderPreMatch();
}
/* 选手在本位置的最佳英雄与战力（情报/换人参考） */
function playerBest(p){
 let best=null,bp=-1;
 (p.heroPool||[]).forEach(x=>{
 const h=heroOf(x.n);
 if(h&&h.pos.includes(p.pos)){const v=playerPower(p,x.n);if(v>bp){bp=v;best=x.n;}}
 });
 return {hero:best,pow:bp<0?playerPower(p,null):Math.round(bp)};
}
function renderPreMatch(){
 const sr=S.series;if(!sr)return;
 const ls=rosterLineup(S),bn=rosterBench(S);
 const opR=ensureAiRosters(S,sr.opName)||[];
 const my=teamPower(S)*(1+seriesTacticEdge(S,sr)),op=powerOf(S,sr.opName); // 战术克制 ±3% 在此生效
 const wr=Math.round(winChance(my,op)*100);
 // 战术板：显示双方战术与克制结果（edge 已计入上面的战力）
 const tactHtml=(S.tactic&&S.tactic!=='balanced')?`<div class="hint" style="margin-bottom:8px">战术板：我方「${tacticById(S.tactic).name}」 vs 对方「${tacticById(sr._opTactic||'balanced').name}」${seriesTacticEdge(S,sr)>0?' <span class="green">· 战术克制 +3%</span>':(seriesTacticEdge(S,sr)<0?' <span style="color:var(--red)">· 被克制 −3%</span>':' · 互不克制')}</div>`:'';
 const midSeries=sr.mw+sr.ow>0;
 // VS 海报：双队徽对撞 + 战力对比条（比赛时刻的大屏感）
 const opIcon=(AI_TEAMS.find(t=>t.name===sr.opName)||{}).icon||'队';
 const myShare=Math.round(my/(my+op)*100);
 const poster=`<div class="vs-poster">
 <div class="vs-team"><div>${crest(S.icon,S.teamName,46)}</div><div class="vs-tname">${S.teamName}</div><div class="vs-pow">${fmt(my)}</div></div>
 <div class="vs-mid"><div class="vs-tag">VS</div><div class="vs-bar"><i style="width:${myShare}%;background:var(--accent)"></i><i style="width:${100-myShare}%;background:var(--red)"></i></div><div class="vs-wr">赛前预估 ${wr}% · 战力差 ${fmt(Math.abs(my-op))}</div></div>
 <div class="vs-team right"><div>${crest(opIcon,sr.opName,46)}</div><div class="vs-tname">${sr.opName}</div><div class="vs-pow op">${fmt(op)}</div></div>
 </div>`;
 // 我方首发行
 const myRows=POS_ORDER.map(pos=>{
 const p=ls.find(x=>x.pos===pos);
 if(!p)return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)"><span class="tag">${POS[pos][1]}</span><span class="red" style="font-size:12px">该位置无人，请签约或改位置</span></div>`;
 const b=playerBest(p);
 const engTxt=`<span style="color:${p.energy>=60?'var(--dim)':p.energy>=40?'var(--gold)':'var(--red)'}">体力${p.energy}</span>`;
 const morTxt=`<span style="color:${p.morale>=70?'var(--dim)':p.morale>=50?'var(--gold)':'var(--red)'}">士气${p.morale}</span>`;
 const st=(p.injury>0?`<span class="red">伤停${p.injury}天</span> `:'')+engTxt+' '+morTxt;
 return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)">
 <span class="tag" style="min-width:44px;text-align:center">${POS[pos][1]}</span>
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">战力 <b style="color:var(--cyan)">${b.pow}</b> · ${b.hero||'—'}</span>
 <span style="font-size:11px;margin-left:auto">${st}</span>
 <button class="btn sm" onclick="prepChoosePos('${pos}')">换人</button>
 </div>`;
 }).join('');
 // 换人面板（同位置替补）
 let swapPanel='';
 if(window._prepPos){
 const pos=window._prepPos,cur=ls.find(x=>x.pos===pos);
 const cands=bn.filter(x=>x.pos===pos&&x.injury<=0); // 伤员不可登场
 swapPanel=`<div style="background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0">
 <div style="font-size:12px;font-weight:800;margin-bottom:6px">替补 ${POS[pos][0]}（换下 ${cur?cur.name:'空缺'}）</div>
 ${cands.length?cands.map(p=>{const b=playerBest(p);return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed var(--line)">
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">战力 <b style="color:var(--cyan)">${b.pow}</b> · ${b.hero||'—'} · 总值${overall(p)}</span>
 <button class="btn sm primary" style="margin-left:auto" onclick="prepSwapIn('${p.id}')">上场</button>
 </div>`;}).join(''):'<div class="hint">该位置没有替补，可去转会市场签人</div>'}
 <button class="btn sm mt8" onclick="window._prepPos=null;renderPreMatch()">收起</button>
 </div>`;
 }
 // 对手情报：按威胁排序，最强点标 （BAN 优先目标）
 const intel=opR.map(p=>({p,b:playerBest(p)})).sort((a,b)=>b.b.pow-a.b.pow);
 const maxThreat=intel.length?intel[0].b.pow:0;
 const opRows=intel.map(({p,b})=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)">
 <span class="tag" style="min-width:44px;text-align:center">${POS[p.pos][1]}</span>
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">招牌 ${p.sig||'—'}</span>
 <span style="font-size:11px;margin-left:auto">${b.pow>=maxThreat&&maxThreat>0?' ':''}威胁 <b style="color:var(--red)">${b.pow}</b></span>
 </div>`).join('');
 $('#app-modal-body').innerHTML=`
 <h2>赛前准备 <span class="tag">${sr.max===7?'BO7 · 含巅峰对决':'BO5 · 全局BP'}</span></h2>
 <div class="hint" style="text-align:center;margin-bottom:8px">${window._prepTitle}${midSeries?` · 当前比分 <b>${sr.mw}:${sr.ow}</b>（<span style="cursor:help" title="我方已用：${(sr.used||[]).join('、')||'无'}
对方已用：${(sr.usedOpp||[]).join('、')||'无'}">全局BP已用 · 我方 ${(sr.used||[]).length} / 对方 ${(sr.usedOpp||[]).length}</span>）`:''}</div>
 ${poster}
 ${tactHtml||''}
 <div style="display:flex;gap:8px;margin-bottom:10px">
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">${S.teamName}</div>
 <div style="font-size:18px;font-weight:800;color:var(--cyan)">${my}</div></div>
 <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:92px">
 <div style="font-size:11px;color:var(--dim)">赛前预估</div>
 <div style="font-size:17px;font-weight:800;color:${wr>=55?'var(--green)':wr>=45?'var(--gold)':'var(--red)'}">${wr}%</div></div>
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">${sr.opName}</div>
 <div style="font-size:18px;font-weight:800;color:var(--red)">${op}</div></div>
 </div>
 <div style="font-size:12px;font-weight:800;margin:6px 0 2px">我方首发（可调整）</div>
 ${myRows}
 ${swapPanel}
 <div style="font-size:12px;font-weight:800;margin:10px 0 2px">对手情报 <span class="tag"> 为最强点 · BP 优先 BAN</span></div>
 ${opRows||'<div class="hint">对方情报未知（盲选局）</div>'}
 <div class="center mt12" style="display:flex;gap:8px;justify-content:center">
 <button class="btn" onclick="closeModal('app-modal')">返回</button>
 <button class="btn primary" onclick="closeModal('app-modal');openBP(window._prepTitle,playGame)">进入 BP 选英雄 →</button>
 </div>`;
 $('#app-modal').classList.add('wide');
 $('#app-modal').classList.add('on');
}
function prepChoosePos(pos){window._prepPos=pos;renderPreMatch();}
function prepSwapIn(pid){
 const p=S.players.find(x=>x.id===pid);
 if(p.injury>0){toast(p.name+' 伤停中（还剩'+p.injury+'天），无法登场');return;}
 const cur=rosterLineup(S).find(x=>x.pos===p.pos);
 if(!cur)return;
 S.lineup[S.lineup.indexOf(cur.id)]=p.id;
 if(S.pick)delete S.pick[p.pos]; // 换人后该位置英雄需重新 BP
 save();
 window._prepPos=null;
 toast(cur.name+' 换下，'+p.name+' 首发');
 renderPreMatch();
}
function playGame(){
 const sr=S.series;
 // 有效战力结算：BAN/选人质量/红蓝 counter 全部折算进胜负（详见 bpEffective）
 const isLastPeak=sr.max>=7&&sr.mw+sr.ow===sr.max-1; // 巅峰对决：无 BP，不吃任何修正（BO7 第7局 / BO9 第9局）
 const v=bpEffective({myBans:sr.myBans,oppBans:sr.oppBans,oppPicks:sr.oppPicks,side:sr.side,isPeak:isLastPeak,opName:sr.opName,opRoster:ensureAiRosters(S,sr.opName)||[],used:sr.used,usedOpp:sr.usedOpp});
 const g=singleGame(v.my,v.op);
 // 每小局双方消耗体力（8/局）：系列赛越深越考验轮换——替补体力满员是翻盘资本
 const opR=ensureAiRosters(S,sr.opName)||[];
 rosterLineup(S).forEach(p=>{p.energy=clamp(p.energy-8,0,ENERGY_MAX);p.caps=(p.caps||0)+1;}); // caps：出场记录（转售保护期解锁用）
 opR.forEach(p=>p.energy=clamp(p.energy-8,0,ENERGY_MAX));
 if(g.w)sr.mw++;else sr.ow++;
 const isPeak=sr.max>=7&&sr.mw+sr.ow===sr.max-1;
 const tag=isPeak?' 巅峰对决（盲选）':'';
 const mvp=gamePerform(g.w);
 if(mvp){const mp=S.players.find(x=>x.id===mvp.id);if(mp){mp.mvp=(mp.mvp||0)+1;mp.popularity=Math.min(99,(mp.popularity||0)+2);mp.val=clamp((mp.val||100)+3,70,150);}} // MVP：人气+2、身价+3
 if(mvp)sr.mvpIds=(sr.mvpIds||[]).concat(mvp.id); // 系列赛各局 MVP 记录（FMVP 评选用）
 if(mvp)sr.mvpKda=(sr.mvpKda||[]).concat(mvp.k+'/'+mvp.d+'/'+mvp.a); // 各局 MVP 的 KDA（AI 战报语境用）
 sr.logs.push('第'+(sr.mw+sr.ow)+'局 '+(g.w?'':'')+' 我方 '+g.myK+'-'+g.opK+' '+(g.w?'击败':'憾负')+' '+sr.opName+' ｜ 总比分 '+sr.mw+':'+sr.ow+tag+' '+(sr.side==='red'?'红方':'蓝方')+' '+pick(CASTER)+(mvp?' ｜ MVP：'+mvp.name+'（'+mvp.k+'/'+mvp.d+'/'+mvp.a+'）':''));
 // 文字直播（事件模板池 × 数据驱动语境：MVP KDA/英雄/战术/比分背景全部织进句子）
 sr.logs.push(...genMatchStory(sr,g,mvp));
 const need=Math.ceil(sr.max/2);
 if(sr.mw>=need||sr.ow>=need){
 finishSeries(sr.mw>=need);
 }else{
 // 进入下一局：败方选边（KPL 规则：第2-6局败方选边；第7局巅峰对决由第6局败方选边）
 const nextTitle=(sr.stage==='card'?'卡位赛':sr.stage==='po'?(sr.poSlot==='总决赛'?'总决赛':'季后赛'):PHASE_NAME[S.phase])+' · 第'+(sr.mw+sr.ow+1)+'局（当前 '+sr.mw+':'+sr.ow+'）';
 if(S.seriesAuto){
 autoPlayNext(); // 本系列赛自动BP模式
 }else if(!g.w){
 // 玩家本局落败 → 玩家拥有选边权
 showSideChoice(nextTitle);
 }else{
 // AI 落败 → AI 自动选边
 sr.side=aiPickSide(S);
 openBP(nextTitle,playGame);
 }
 }
}
function recordSeason(s){
 try{
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:(s.champion?(splitLabel(s)+' 总冠军'):(splitLabel(s)+' 亚军')),champion:!!s.champion,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }catch(e){}
}
function finishSeries(finalWin){
 const sr=S.series;
 S._lastMvps=(sr.mvpIds||[]).slice(); // 本系列赛各局 MVP（决赛后评 FMVP 用）
 // 出场统计（更衣室系统用）：本系列赛首发的选手各记一次出场——替补的不满按"出场差距"累积
 rosterLineup(S).forEach(p=>{p.apps=(p.apps||0)+1;});
 S.series=null; // 先清系列赛状态，再走收尾链（playoffStep/playCardNext 可能立即开启下一场）
 // 体力按小局在 playGame 中逐局扣除，此处不再重复扣
 // 赛后小概率有人受伤：伤停必须休息，受伤瞬间立即换替补（阵容页即时反映）
 if(Math.random()<0.08){
 const ls=rosterLineup(S);
 if(ls.length){const p=pick(ls);p.injury=rnd(2,4);logEvent(S,' '+p.name+' 在比赛中受伤，将伤停'+p.injury+'天（必须休息）');autoFillLineup(S);}
 }
 const winGames=sr.mw; // 2026 KPL 奖金按胜小局数结算
 // 连胜/连败手感（常规赛与季后赛系列赛均计入）
 if(sr.stage==='regular'||sr.stage==='po'){
 S.streak=(S.streak||0)+(finalWin?1:-1);
 if(S.streak>=3)logEvent(S,' '+S.streak+'连胜！队伍手感火热（全队战力+'+clamp(S.streak,-5,5)*2+'%）');
 else if(S.streak<=-3)logEvent(S,' '+(-S.streak)+'连败，士气低迷（全队战力'+clamp(S.streak,-5,5)*2+'%）');
 }
 let title='';
 if(sr.stage==='regular'){
 const g=myGroup(S);
 const t=(g&&S.tables[g])?S.tables[g][S.teamName]:null;
 const m=S.schedule[S.matchIdx];
 const ot=(g&&S.tables[g])?S.tables[g][m.opp]:null;
 m.result=finalWin?'W':'L';m.myScore=sr.mw;m.opScore=sr.ow;
 if(t){
 if(finalWin){t.w++;t.pts++;}else{t.l++;}
 t.pw+=sr.mw;
 }
 // 对手积分行同步记账：AI 赛程按轮转法生成（我的场次被排除，对手实际在另一轮与我交手），
 // 不补记对手行其战绩将永远缺这场球（我赢它没记输、我输它没记赢），积分/排名/S-A-B 晋级全部失真
 if(ot){
 if(finalWin){ot.l++;}else{ot.w++;ot.pts++;}
 ot.pw+=sr.ow;
 }
 const bonus=winGames*80;
 S.fund+=bonus;
 if(finalWin&&Math.random()<0.5)S.fund+=200;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' '+PHASE_NAME[S.phase]+'：'+S.teamName+' '+(finalWin?'胜':'负')+' '+sr.opName+' '+sr.mw+':'+sr.ow+'（小局奖金 '+bonus+'万）');
 S.matchIdx++;
 simulateAiRound(S,m.round); // 本轮打完，联盟其他场次同步开打并更新积分
 if(S.matchIdx>=KPL.ROUNDS)advancePhase(S);
 title=S.teamName+' vs '+sr.opName;
 }else if(sr.stage==='card'){
 const m=sr.cardMatch;
 m.r=finalWin?sr.myName:sr.opName;
 const bonus=winGames*120;
 S.fund+=bonus;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,'卡位赛：'+S.teamName+' '+(finalWin?'晋级':'遗憾落败')+' '+sr.mw+':'+sr.ow+'（奖金 '+bonus+'万）');
 title='卡位赛'+(finalWin?'晋级':'出局');
 S.card.idx++;
 if(S.card.idx>=S.card.matches.length)finishCard(S);
 else playCardNext(S);
 }else if(sr.stage==='po'){
 const m=sr.poMatch;
 m.r=finalWin?sr.myName:sr.opName;
 const bonus=winGames*150;
 S.fund+=bonus;
 if(finalWin&&sr.poSlot==='总决赛')S.fund+=600;
 if(!finalWin&&sr.poSlot!=='总决赛'){
 // 联盟分润：按出局名次（总决赛败者的亚军分润由 playoffStep 冠军分支统一发放，此处不再发，避免双倍）
 const place=poPlace(sr.poSlot,false);
 leaguePayout(S,place);
 }
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' 季后赛（'+sr.poSlot+'）：'+S.teamName+' '+(finalWin?'晋级':'出局')+' '+sr.mw+':'+sr.ow+(sr.poSlot==='总决赛'&&finalWin?'——夺得总冠军！':'')+'（奖金 '+bonus+'万）');
 title=sr.poSlot==='总决赛'?(finalWin?'我们是冠军！':'总决赛落幕'):'季后赛'+(finalWin?'晋级':'出局');
 playoffStep(S);
 }else if(sr.stage==='cup'){
 // 杯赛系列赛（EWC / 年度总决赛：擂台赛·突围赛·淘汰赛）
 const m=sr.cupMatch;
 m.r=finalWin?sr.myName:sr.opName;
 if(m.a===sr.myName){m.ms=sr.mw;m.es=sr.ow;}else{m.ms=sr.ow;m.es=sr.mw;} // 擂台赛积分按 a/b 记小局
 const bonus=winGames*120;
 S.fund+=bonus;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' '+sr.cupLabel+'：'+S.teamName+' '+(finalWin?'胜':'负')+' '+sr.opName+' '+sr.mw+':'+sr.ow+'（奖金 '+bonus+'万）');
 title=sr.cupLabel+(finalWin?' · 晋级':' · 落败');
 if(S.phase==='ewc')ewcStep(S);
 else if(S.phase==='challenger')challengerStep(S);
 else annualStep(S);
 }
 const r={win:finalWin,logs:sr.logs,opName:sr.opName,
 stageTxt:sr.stage==='card'?'卡位赛':sr.stage==='po'?(sr.poSlot||'季后赛'):sr.stage==='cup'?sr.cupLabel:PHASE_NAME[S.phase],
 score:sr.mw+':'+sr.ow,
 mvps:(sr.mvpIds||[]).map((id,i)=>{const p=S.players.find(x=>x.id===id);return (p?p.name:'选手')+(sr.mvpKda&&sr.mvpKda[i]?'（'+sr.mvpKda[i]+'）':'');})
 };
 // 夺冠仪式感：总决赛/各杯赛决赛赢下时全屏庆典（一次性覆盖层，点按或 6 秒自动消失）
 if(finalWin&&(sr.stage==='po'&&sr.poSlot==='总决赛'||['ch_final','ewc_final','apo_final'].includes(sr.cupSlot))){
 playChampionCeremony(sr.stage==='po'?splitLabel(S)+' 总冠军':
 sr.cupSlot==='ch_final'?gameYear(S)+' 挑战者杯冠军':
 sr.cupSlot==='ewc_final'?gameYear(S)+' EWC 电竞世界杯冠军':gameYear(S)+' KPL 年度总冠军');
 }
 // 比赛复盘记录（含巅峰对决名场面标记）
 S.history=S.history||[];
 S.history.unshift({
 yr:gameYear(S), // 年度归属（赛季回顾·关键战役按年筛选用）
 opp:sr.opName,stage:sr.stage==='card'?'卡位赛':sr.stage==='po'?(sr.poSlot||'季后赛'):sr.stage==='cup'?sr.cupLabel:PHASE_NAME[S.phase],
 score:sr.mw+':'+sr.ow,win:finalWin,logs:sr.logs,
 peak:sr.max>=7&&sr.mw+sr.ow===sr.max // 打满最后一局（BO7 4:3 / BO9 5:4）= 巅峰对决名场面
 });
 S.history=S.history.slice(0,20);
 save();renderAll();
 showMatchModal(r,title||S.teamName+' vs '+sr.opName);
}
function startPlayoff(){if(S.preseason){toast(' 转会期进行中，联赛尚未开始');return;}playoffStep(S);}
function startCard(){if(S.preseason){toast(' 转会期进行中，联赛尚未开始');return;}playCardNext(S);}
function showMatchModal(r,title){
 try{(r.win?SFX.win():SFX.lose());}catch(_){}
 // 系列赛 MVP 高光：按局数计票 + 各局 KDA 合计（字符串 r.mvps：「名字（k/d/a）」）
 let mvpCard='';
 if(r.mvps&&r.mvps.length){
 const cnt={},kda={};
 r.mvps.forEach(m=>{
 const n=String(m).split('（')[0];cnt[n]=(cnt[n]||0)+1;
 const k=String(m).match(/（(\d+)\/(\d+)\/(\d+)）/);
 if(k){kda[n]=kda[n]||[0,0,0];kda[n][0]+=+k[1];kda[n][1]+=+k[2];kda[n][2]+=+k[3];}
 });
 const best=Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x]||((kda[y]||[0,0,0]).reduce((t,v)=>t+v,0)-(kda[x]||[0,0,0]).reduce((t,v)=>t+v,0)))[0];
 const p=S.players.find(x=>x.name===best);
 mvpCard=`<div class="mvp-card">${avatar(p||{name:best},46)}<div><div class="mvp-tag">SERIES MVP</div><div class="mvp-name">${best}${p?' · '+((S.pick&&S.pick[p.pos])||p.sig||''):''}</div><div class="mvp-kda">${cnt[best]} 局 MVP · 合计 ${kda[best]?kda[best].join(' / '):'—'}</div></div></div>`;
 }
 const mb=$('#app-modal');$('#app-modal-body').innerHTML=`
 <h2>${title||(r.win?'比赛胜利':'比赛失利')}</h2>
 <div class="result-band ${r.win?'win':'lose'}"><span>${S.teamName}</span><b>${r.score||''}</b><span>${r.opName||''}</span></div>
 ${mvpCard}
 <div class="logbox" style="max-height:60vh">${r.logs.map(l=>`<div class="${l.includes('胜')?'win':l.includes('负')?'lose':'info'}">${l}</div>`).join('')}</div>
 ${(aiEnabled())?`<div id="ai-report-box" class="event-card" style="margin-top:10px"><div class="et">AI 战报</div><p>生成中……（联网调用；失败自动回退本地文案，不影响比赛流程）</p></div>`:''}
 <div class="center mt16">
 ${(S.phase==='champion'||S.phase==='eliminated')?`<button class="btn gold" onclick="closeModal('app-modal');advanceCalendar(S)">${calendarNextLabel(S)}</button>`
 :(S.preseason?`<button class="btn gold" onclick="closeModal('app-modal');goPage('market')"> 进入转会期（组队备战）</button>`
 :`<button class="btn primary" onclick="closeModal('app-modal');nextDay(S);goPage('club')">继续（推进一天）</button>`)}
 </div>`;
 mb.classList.add('on');
 if(aiEnabled())aiFillReport(r); // 异步填充，成败都不阻塞赛后流程
}
/* ================= AI 赛后战报（可选增强 · 默认关闭 · 失败静默回退） =================
 与「纯单机」承诺的边界：默认关闭、零请求；开启后每场系列赛结束向用户自填的
 OpenAI 兼容端点发一次请求。设置存 localStorage（AI_SET_KEY），不进存档对象——
 导出存档/代码分享不会带走 key。任何失败（断网/超时/HTTP错误/CORS/无fetch环境）
 都静默回退本地文案；比赛引擎与门禁测试完全不依赖本模块。 */
const AI_SET_KEY='km_ai_set';
/* 解说人设：写进 system 提示，user 仍是同一套比赛数据。id 进 localStorage，不进存档。 */
const AI_PERSONAS=[
 {id:'pro',n:'专业解说',d:'冷静专业，数据说话',sys:'你是KPL王者荣耀职业联赛的官方专业解说。语气沉稳克制，重数据与战术脉络，少用感叹号，不玩网络梗。'},
 {id:'hype',n:'激情解说',d:'热血上头，金句连发',sys:'你是电竞现场激情解说。语气高亢热血，短句连发，情绪拉满，可适度夸张但不人身攻击、不低俗。'},
 {id:'story',n:'故事叙事',d:'纪录片旁白',sys:'你是电竞纪录片旁白。用叙事口吻讲这场比赛的起承转合，突出选手命运感与关键转折，像在讲一段传奇。'},
 {id:'meme',n:'玩梗弹幕',d:'轻松幽默，梗密度高',sys:'你是赛事弹幕风格的赛后总结。轻松幽默，可适当使用电竞相关梗与网络语，禁止低俗与人身攻击。'},
 {id:'coach',n:'教练复盘',d:'战术视角，找问题',sys:'你是退役教练做赛后复盘。冷静指出BP、节奏与关键决策的得失，给出可执行的改进方向，口吻专业直接。'}
];
function aiPersona(){
 const id=(aiSettings().persona)||'pro';
 return AI_PERSONAS.find(p=>p.id===id)||AI_PERSONAS[0];
}
function aiSettings(){
 try{return JSON.parse(localStorage.getItem(AI_SET_KEY))||{};}catch(e){return {};}
}
function aiEnabled(){const s=aiSettings();return !!(s.on&&s.base);}
function toggleAiReport(){
 const st=aiSettings();st.on=!st.on;
 try{localStorage.setItem(AI_SET_KEY,JSON.stringify(st));}catch(e){}
 save();renderAll();
 toast(st.on?' AI 战报已开启：每场赛后联网生成一次（经营页可配置端点与人设）':' AI 战报已关闭：恢复纯单机模式');
}
function aiSaveForm(){
 const st=aiSettings();
 st.base=(document.getElementById('ai-base')||{value:''}).value.trim();
 st.model=(document.getElementById('ai-model')||{value:''}).value.trim();
 st.key=(document.getElementById('ai-key')||{value:''}).value.trim();
 const psel=document.getElementById('ai-persona');
 if(psel&&psel.value)st.persona=psel.value;
 try{localStorage.setItem(AI_SET_KEY,JSON.stringify(st));}catch(e){}
 toast('AI 战报设置已保存（仅存本机，不随存档导出）');
}
/* 组 prompt（纯函数便于测试）：system=人设，user=比赛数据 */
function buildAiPrompt(r,persona){
 const p=persona||aiPersona();
 const data='比赛：'+(r.stageTxt||'')+'，'+S.teamName+' vs '+r.opName+'，比分 '+r.score+'（我方'+(r.win?'胜':'负')+'）\n'
 +'我方首发：'+rosterLineup(S).map(x=>x.name+'（'+((S.pick&&S.pick[x.pos])||x.sig||'')+'）').join('、')+'\n'
 +((r.mvps||[]).length?'各局MVP：'+r.mvps.join('、')+'\n':'')
 +'直播要点：'+(r.logs||[]).slice(0,10).join(' / ');
 return {
  system:p.sys,
  user:'请根据以下比赛数据写一段120字以内的中文赛后战报，直接输出正文，不要标题、不要列表、不要复述数据清单：\n'+data
 };
}
async function aiFillReport(r){
 let timer=null;
 try{
 if(typeof fetch!=='function')throw new Error('环境不支持 fetch');
 const st=aiSettings();
 const h=(S.history||[])[0];
 const {system,user}=buildAiPrompt(r);
 const ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
 if(ctrl)timer=setTimeout(()=>ctrl.abort(),25000);
 const res=await fetch(st.base,{method:'POST',signal:ctrl?ctrl.signal:undefined,
 headers:Object.assign({'Content-Type':'application/json'},st.key?{Authorization:'Bearer '+st.key}:{}),
 body:JSON.stringify({model:st.model||'gpt-4o-mini',messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.9})});
 if(timer){clearTimeout(timer);timer=null;}
 if(!res.ok)throw new Error('HTTP '+res.status);
 const j=await res.json();
 const txt=String((j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'').trim();
 if(!txt)throw new Error('空响应');
 if(h){h.aiReport=txt;save();} // 存入复盘记录：重放可见，之后离线也能看
 const box=document.getElementById('ai-report-box'); // 弹窗可能已被下一场替换，找不到就丢弃
 if(box)box.innerHTML='<div class="et">AI 战报 · '+_escTxt(aiPersona().n)+'</div><p>'+_escTxt(txt)+'</p>';
 }catch(e){
 if(timer)clearTimeout(timer);
 const box=document.getElementById('ai-report-box');
 if(box)box.innerHTML='<div class="hint">AI 战报生成失败（'+_escTxt(String(e&&e.message||e)).slice(0,80)+'）——本场沿用本地文案</div>';
 }
}

/* ================= 比赛模拟（Elo 胜率） ================= */
/* ================= 常量 ================= */
