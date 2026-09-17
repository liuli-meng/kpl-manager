// 选手日决策回归：媒体采访 / 更衣室社交 / 合同角色 / 国家队专注 / 长局任务条
// 运行：node tests/verify-playerops.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  initStart();
  pickPlayerArch(1);
  createPlayerCareer();
  const me=myPlayer(S);
  if(!me)fail('开局失败');
  else{
    // ① 开局默认角色按出身档
    if(S.career.role!=='rot')fail('semi 档默认角色应为 rot，实际 '+S.career.role);
    else if(!S.career.stats||S.career.stats.trained!==0)fail('stats 未初始化');
    else log('① 开局：role='+S.career.role+' · stats 就绪');

    // ② 切换合同角色
    if(!setPlayerRole(S,'star'))fail('切换 star 失败');
    else if(S.career.role!=='star')fail('角色未落盘');
    else if(benchMoraleDelta('star',1)!==2)fail('star 板凳士气应翻倍');
    else log('② 合同角色：可切换 star · 板凳士气惩罚 ×2');

    // ③ 更衣室社交（与训练独立）
    me.injury=0;me.energy=100;S.trained=false;S.socialUsed=false;
    const morale0=me.morale;
    if(!playerSocial(S,'bond'))fail('聚餐失败');
    else if(!S.socialUsed)fail('socialUsed 未置位');
    else if(me.morale<=morale0)fail('聚餐后自身士气未升');
    else if(S.career.stats.social<1)fail('stats.social 未计');
    else{
      if(playerSocial(S,'stream'))fail('同日二次社交应被拦截');
      else{
        S.socialUsed=false;
        const pop0=me.popularity||0;
        playerSocial(S,'stream');
        if((me.popularity||0)<pop0&&!((me.val||100)<92))fail('直播人气未涨（非反噬）');
        else log('③ 更衣室：聚餐+直播 · 同日限一次 · 与 trained 并行');
      }
    }

    // ④ 媒体采访：强制打开 → 答复后关闭
    S.career.media=null;
    if(!maybeOpenMedia(S,'title'))fail('title 场合应必开采访');
    else if(!S.career.media||!S.career.media.opts.length)fail('采访未写入 career.media');
    else{
      const m0=me.attrs.mind,pop0=me.popularity||0;
      if(!playerRespondMedia(S,0))fail('答复失败');
      else if(S.career.media)fail('答复后 media 未清空');
      else if(S.career.stats.media<1)fail('stats.media 未计');
      else if(me.attrs.mind<=m0&& (me.popularity||0)<=pop0)fail('采访选项无任何效果');
      else log('④ 媒体：title 必开 · 三选一结算 · 答复后清空');
    }

    // ⑤ proj 角色 + 火热状态：加练保底 +2；贴天花板后 gain=0
    setPlayerRole(S,'proj');
    me.injury=0;me.energy=100;S.trained=false;
    me.val=140;me.morale=90;me.age=20; // 拉高 form≥80（val=120 时 form≈78 不进火热档）
    me.attrs.lane=50;
    delete me.peak; // 强制重算天花板
    const pk=ensurePlayerPeak(me);
    // 把天花板钳到刚好留 2 点空间，验证保底 +2
    pk.lane=Math.max(52,me.attrs.lane+2);
    const lane0=me.attrs.lane;
    playerTrain('lane');
    if(me.attrs.lane<=lane0)fail('proj 火热加练未涨');
    else if(me.attrs.lane-lane0<2)fail('proj 火热保底应 +2，实际 +'+(me.attrs.lane-lane0));
    else{
      // 顶到天花板后再练 → 0（form 压到 <90：避开「突破个人天花板」8% 分支，保证确定性）
      me.attrs.lane=pk.lane;
      me.val=115; // form≈86：仍属火热档，但不触发突破
      S.trained=false;me.energy=100;
      const at=pk.lane;
      const r0=trainOutcome('proj',me,'lane');
      if(r0.gain!==0)fail('贴天花板仍应 +0，实际 +'+r0.gain);
      else log('⑤ 状态成长：火热 proj 保底 +'+(lane0===me.attrs.lane?0:me.attrs.lane-lane0)+' · 贴天花板 +0（'+r0.note+'）');
    }

    // ⑤b 状态低迷时大概率白练（用固定随机探测，不要求必中）
    me.attrs.farm=50;delete me.peak;ensurePlayerPeak(me).farm=Math.max(80,me.attrs.farm);
    me.val=75;me.morale=30;me.energy=40; // 压低状态
    const coldForm=playerForm(me);
    if(coldForm>=55)fail('压低 val/士气/体力后 form 应 <55，实际 '+coldForm);
    else log('⑤b 状态公式：低迷 form='+coldForm+'（<55）');

    // ⑥ nextDay 重置 socialUsed 并可能触发日媒体
    S.socialUsed=true;S.career.media=null;
    nextDay(S);
    if(S.socialUsed)fail('nextDay 未重置 socialUsed');
    else log('⑥ 日结：socialUsed 随 nextDay 重置');

    // ⑦ 国家队专注（仅状态字段，不依赖真实集训）
    S.career.natFocus='form';
    if(setNatFocus(S,'rest'))fail('未集训时 setNatFocus 不应成功');
    else{
      me.natCamp=true;S.split='summer';S.agDone=false;S.natAnnounced=true;
      if(!setNatFocus(S,'rest'))fail('集训中 setNatFocus 失败');
      else if(S.career.natFocus!=='rest')fail('natFocus 未写入');
      else{
        me.energy=50;
        applyNatFocus(S,me);
        if((me.energy||0)<=50)fail('rest 专注未回体力');
        else log('⑦ 国家队：集训可选专注 rest · applyNatFocus 生效');
      }
      me.natCamp=false;S.split='spring';
    }

    // ⑧ 任务条：选手模式 day=1 未完成时出现（此前用例已做过训练/社交，需重置进度再验）
    try{localStorage.removeItem('km_missions');}catch(_){}
    S.day=1;
    if(S.career&&S.career.stats){S.career.stats.trained=0;S.career.stats.social=0;S.career.stats.matches=0;}
    const strip=missionStrip(S);
    if(!strip.includes('新手任务'))fail('选手任务条未出现');
    else log('⑧ 任务条：选手模式前 3 日可渲染');

    // ⑨ 集训/外租不可加练（与 doTrain 同一套 trainBlockedReason）
    me.natCamp=true;S.split='summer';S.agDone=false;S.trained=false;me.injury=0;me.energy=100;
    if(playerTrain('lane'))fail('集训中 playerTrain 应返回 false');
    else if(S.trained)fail('集训拦截后不应置 trained');
    else if(!trainBlockedReason(S,me))fail('集训应有 trainBlockedReason');
    else log('⑨ 集训加练被拦截：'+trainBlockedReason(S,me));
    me.natCamp=false;S.split='spring';
    me.loanOut={team:'测试队',days:10,gain:0};S.trained=false;
    if(playerTrain('mind'))fail('外租中 playerTrain 应失败');
    else if(S.trained)fail('外租拦截后不应置 trained');
    else log('⑨b 外租加练被拦截');
    me.loanOut=null;

    // ⑩ mediaBuff：采访「用训练说话」→ 下次加练有空间时至少 +1
    S.career.media=null;
    S.career.media={id:'bench',q:'q',opts:[{id:'fight',l:'用训练说话',tip:''},{id:'loan',l:'x',tip:''},{id:'loyal',l:'y',tip:''}],day:S.day,ctx:'day'};
    playerRespondMedia(S,0);
    if(S.career.mediaBuff!=='train')fail('选 fight 后 mediaBuff 应为 train，实际 '+S.career.mediaBuff);
    else{
     me.injury=0;me.energy=100;S.trained=false;me.val=120;me.morale=90;
     me.attrs.team=40;delete me.peak;
     const pk2=ensurePlayerPeak(me);
     pk2.team=Math.max(70,me.attrs.team);
     const t0=me.attrs.team;
     playerTrain('team');
     const d=me.attrs.team-t0;
     if(d<1)fail('mediaBuff 未让加练至少 +1，实际 +'+d);
     else if(S.career.mediaBuff)fail('mediaBuff 用后未清空');
     else log('⑩ mediaBuff：采访加成生效（+'+d+'）且已消费');
    }

    // ⑪ 规则下沉到 playerops 后可测：playerTrainDay 的资格门槛
    me.injury=0;me.energy=100;S.trained=false;me.attrs.lane=50;
    if(playerTrainDay({mode:'coach'},'lane').ok)fail('⑪非选手模式应拒绝加练');
    else if(!playerTrainDay(S,'lane').ok)fail('⑪正常态应允许加练');
    else if(playerTrainDay(S,'lane').ok)fail('⑪同日第二次加练应被拒');
    else{
      S.trained=false;me.energy=9;
      const rE=playerTrainDay(S,'lane');
      if(rE.ok||rE.reason.indexOf('体力不足')<0)fail('⑪体力不足未拦: '+JSON.stringify(rE));
      else log('⑪ playerTrainDay：非选手模式 / 同日重复 / 体力不足 三种拒绝均生效');
    }

    // ⑫ playerRestDay：体力+55 · 士气+4 · 伤情-2 · 同日限一次
    me.energy=30;me.morale=50;me.injury=5;S.trained=false;
    const rRest=playerRestDay(S);
    if(!rRest.ok)fail('⑫休息应成功');
    else if(me.energy!==85||me.morale!==54||me.injury!==3)fail('⑫休息结算错: 体力'+me.energy+' 士气'+me.morale+' 伤情'+me.injury);
    else if(!S.trained)fail('⑫休息未占用每日行动');
    else if(playerRestDay(S).ok)fail('⑫同日第二次休息应被拒');
    else log('⑫ playerRestDay：体力 30→85 · 士气 50→54 · 伤情 5→3，同日限一次');

    // ⑬ playerHeroTrainDay：熟练(lv2)升绝活(lv3) · 体力-15 · 招牌不入候选
    me.energy=60;S.trained=false;me.sig='貂蝉';me.injury=0; // ⑫ 留下的 3 天伤情会被 trainBlockedReason 拦截，先清零
    me.heroPool=[{n:'貂蝉',lv:2},{n:'不知火舞',lv:2},{n:'小乔',lv:1}];
    const rHero=playerHeroTrainDay(S);
    if(!rHero.ok)fail('⑬英雄特训应成功: '+(rHero.reason||''));
    else if(me.energy!==45)fail('⑬体力应 -15，实际 '+me.energy);
    else if((me.heroPool||[]).filter(h=>h.lv===3).length!==1)fail('⑬应恰好练成 1 个绝活');
    else if(rHero.hero==='貂蝉')fail('⑬不该把招牌英雄当特训对象');
    else log('⑬ playerHeroTrainDay：'+rHero.hero+' 升为绝活 · 体力 60→45 · 招牌已排除');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
