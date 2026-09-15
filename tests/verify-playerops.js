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

    // ⑤ proj 角色加练保底 +2
    setPlayerRole(S,'proj');
    me.injury=0;me.energy=100;S.trained=false;
    me.attrs.lane=50;
    const lane0=me.attrs.lane;
    playerTrain('lane');
    if(me.attrs.lane<=lane0)fail('proj 加练未涨');
    else if(me.attrs.lane<52)fail('proj 加练保底应 +2，实际 +'+(me.attrs.lane-lane0));
    else log('⑤ proj 角色：加练保底 +2（实际 +'+(me.attrs.lane-lane0)+'）');

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

    // ⑧ 任务条：选手模式 day=1 未完成时出现
    try{localStorage.removeItem('km_missions');}catch(_){}
    S.day=1;
    const strip=missionStrip(S);
    if(!strip.includes('新手任务'))fail('选手任务条未出现');
    else log('⑧ 任务条：选手模式前 3 日可渲染');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
