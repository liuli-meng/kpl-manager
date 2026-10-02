// 决定性诊断：统计 clubOpsCost 在 N 天内被「真实调用并扣减资金」的次数
// 手法：把 clubOpsCost 包一层计数器（不改业务逻辑判断），同时逐日记录资金变化
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 42 + ')', dom);

const out = vm.runInContext(`
(function(){
  const res=[];
  S=newState('计数','豪门');S.preseason=false;S.transferWindow=0;S._quietSave=true;
  fillRoster(S,'star','star');
  S.players.forEach(p=>{p.popularity=99;p.wage=350;});
  S.sponsorLv=3;S.fans=600;S.fund=80000;

  // 包一层计数器
  const _orig=clubOpsCost;
  let calls=0, sumReturned=0;
  this.clubOpsCost=function(s){calls++;const v=_orig(s);sumReturned+=v;return v;};

  const DAYS=70;
  let dailyDeduct=0; // 只在非发薪日观察资金变化里属于编制的部分
  const logs=[];
  for(let d=0;d<DAYS;d++){
    S.trained=true;S.marketRefreshed=true;
    const before=S.fund;
    const isPay=((S.day+1)%7===0);
    const c=dailyCommercialIncome(S);
    nextDay(S);
    const delta=S.fund-before;
    if(d<10){
      logs.push('day'+String(S.day).padStart(3)+' 发薪='+(isPay?'Y':'n')+' 商业+'+c+' Δfund='+Math.round(delta)
        +' （若编制按日扣，非发薪日 Δfund 应≈商业-编制='+(c-769)+'；若按周扣，应≈商业='+c+'）');
    }
  }
  res.push('70 天内 clubOpsCost 被调用次数 = '+calls+'  → 平均每天 '+(calls/DAYS).toFixed(2)+' 次');
  res.push('70 天内被扣的编制费合计 = '+Math.round(sumReturned)+' 万  → 折算每周 '+(sumReturned/DAYS*7).toFixed(0)+' 万');
  res.push('单次函数返回值 = '+_orig.length+'? 实测 clubOpsCost(S) = '+Math.round(_orig({players:S.players,sponsorLv:3,fans:600,fund:80000,idleDays:0})));
  res.push('');
  res.push(...logs);
  this.clubOpsCost=_orig;
  return res.join('\\n');
})()
`, dom);
console.log(out);
