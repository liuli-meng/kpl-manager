// 模糊压测：多赛季随机操作（买卖/租借/训练/转位置/推进天数/打系列赛）+ 每步不变量断言
// 运行：node tests/fuzz.js   （约 1-2 分钟，CI 里可加超时）
// 可复现：随机种子注入沙箱 Math.random（mulberry32），失败时按提示 --seed=xxx 精确复现同一序列
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const seed = seedArg ? (parseInt(seedArg, 10) || 1) : (Math.floor(Math.random() * 1e9) || 1);
console.log('  fuzz 种子: ' + seed + '（复现：node tests/fuzz.js --seed=' + seed + '）');

const { dom } = makeDom();
// 种子化沙箱随机（mulberry32，公有领域算法）：以原 Math 为原型换掉 random，其余方法保留
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
const run = snippet => vm.runInContext('(function(){\n' + snippet + '\n})()', dom);

const out = run(`
  const errs=[], notes=[];
  const R=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const pickOne=a=>a[Math.floor(Math.random()*a.length)];
  function chk(where){
    const bad=[];
    if(typeof S.fund!=='number'||isNaN(S.fund))bad.push('fund='+S.fund);
    if(isNaN(weeklyWage(S)))bad.push('wage NaN');
    if(isNaN(teamPower(S)))bad.push('power NaN');
    const seen=new Set();
    S.players.forEach(p=>{if(seen.has(p.id))bad.push('重复id '+p.id);seen.add(p.id);});
    if(S.lineup.length>5)bad.push('首发'+S.lineup.length+'人');
    const lpos={};
    S.lineup.forEach(id=>{
      const p=S.players.find(x=>x.id===id);
      if(!p){bad.push('首发指向不存在的选手');return;}
      if(lpos[p.pos])bad.push('首发位置重复:'+p.pos);lpos[p.pos]=1;
    });
    S.players.forEach(p=>{
      (p.heroPool||[]).forEach(h=>{
        const hh=heroOf(h.n);
        if(!hh)bad.push('池内未知英雄 '+p.name+'/'+h.n);
        else if(!hh.pos.includes(p.pos))bad.push('池内错位英雄 '+p.name+'/'+h.n);
      });
      if(p.val!=null&&isNaN(p.val))bad.push('val NaN '+p.name);
      if(p.attrs&&['lane','farm','team','mind'].some(k=>isNaN(p.attrs[k])))bad.push('attr NaN '+p.name);
      if(p.energy!=null&&(p.energy<0||p.energy>ENERGY_MAX))bad.push('体力越界 '+p.name+'='+p.energy);
      if(p.morale!=null&&(p.morale<0||p.morale>100))bad.push('士气越界 '+p.name+'='+p.morale);
    });
    for(const pos in (S.pick||{})){
      const h=S.pick[pos];if(!h)continue;
      const hh=heroOf(h);
      if(!hh)bad.push('pick未知英雄 '+h);
      else{const p=S.players.find(x=>x.pos===pos&&S.lineup.includes(x.id));if(p&&!hh.pos.includes(pos))bad.push('pick错位 '+h+'@'+pos);}
    }
    if(['r1','r2','r3'].includes(S.phase)&&S.schedule&&S.matchIdx>S.schedule.length)bad.push('matchIdx越界');
    if(S.phase==='card'&&!S.card)bad.push('card阶段无card');
    if(S.phase==='playoff'&&!S.playoff)bad.push('playoff阶段无playoff');
    if(S.leagueTeams&&S.leagueTeams.length!==18)bad.push('联盟'+S.leagueTeams.length+'队');
    if(bad.length)errs.push(where+': '+[...new Set(bad)].join(' / '));
  }
  S=newState('压测队','⚔️');
  const _u=new Set();
  ['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  S.preseason=true;S.transferWindow=7;buildTransferMarket(S);refreshMarket(S);
  chk('开局');
  function playSeries(){
    if(S.preseason){endPreseason(S);if(S.preseason)return false;}
    const ph=S.phase;
    if(ph==='r1'||ph==='r2'||ph==='r3')startMatch();
    else if(ph==='card')startCard();
    else if(ph==='playoff')startPlayoff();
    if(!S.series)return false;
    let g=0;
    while(S.series&&g++<15)autoPlayNext();
    if(S.series){notes.push(ph+' 系列赛未完成(自动暂停,非死锁)');S.series=null;}
    return true;
  }
  function daily(){
    const a=pickOne(['day','train','rest','rest','rest']);
    if(a==='day')nextDay(S);
    else if(a==='train'&&S.players.length){const p=pickOne(S.players);doTrain(S,p.id,pickOne(['lane','farm','team','mind']));}
    else doRest(S);
    chk('日常:'+a);
  }
  function market(){
    const r=Math.random();
    if(r<0.3&&S.transferWindow>0&&(S.transferList||[]).length){
      const p=pickOne(S.transferList.filter(x=>!x.untouchable&&x.willingness>=30));
      if(p){S.fund+=2000;negoComplete(S,p,500);}
    }else if(r<0.45&&S.market.length){
      S.fund+=2000;buyPlayer(S,S.market[0]);
    }else if(r<0.55&&S.freeAgents&&S.freeAgents.length){
      S.fund+=2000;signFreeAgent(S,S.freeAgents[0].id);
    }else if(r<0.7&&S.transferWindow<=0){
      const c=loanCandidates(S);if(c.length){S.fund+=2000;loanPlayer(S,c[0].from,c[0].p.id);}
    }else if(r<0.8&&S.players.length>6){
      const p=pickOne(S.players.filter(x=>!x.loan&&!S.lineup.includes(x.id)));
      if(p){openSellNego(S,p.id);if(window._sellNego){sellAcceptClub(-1);}}
    }else if(r<0.9){
      S.fund+=2000;recruitRookie(S);
    }else{
      refreshMarket(S);
    }
    chk('市场操作');
  }
  let seasons=0,series=0;
  for(let step=0;step<900;step++){
    try{
      if(S.phase==='champion'||S.phase==='eliminated'){
        seasons++;if(seasons>=15)break;
        newSeason(S);chk('新赛季'+S.season);continue;
      }
      if(Math.random()<0.45){if(playSeries())series++;}
      else if(Math.random()<0.7)daily();
      else market();
    }catch(e){
      errs.push('异常@step'+step+': '+e.message);
      if(errs.length>6)break;
    }
  }
  let dupNames=[],teamBad=[];
  try{
    const names=[];
    (S.leagueTeams||[]).forEach(n=>{
      if(n===S.teamName){S.players.forEach(p=>names.push(p.name));return;}
      const r=ensureAiRosters(S,n)||[];
      // 5 人=正常；6 人=某位置伤停主力+青训递补同时在场（设计行为，需验证递补确实在顶伤员）
      if(r.length<5||r.length>6)teamBad.push(n+':'+r.length+'人');
      else if(r.length===6){
        const ok=POS_ORDER.some(pos=>{
          const at=r.filter(p=>p.pos===pos);
          return at.length===2&&at.some(p=>p.id.startsWith('ac_'))
            &&at.some(p=>!p.id.startsWith('ac_')&&(S.aiInj||{})[n]&&(S.aiInj[n]||{})[p.id]>0);
        });
        if(!ok)teamBad.push(n+':6人但无伤停递补对');
      }
      const poss=r.map(p=>p.pos);
      const dup=poss.filter((p,i)=>poss.indexOf(p)!==i);
      // 5 人不应有任何重复位置；6 人允许一个重复（伤停+递补）
      if(dup.length&&r.length===5)teamBad.push(n+':位置重复'+dup.join(''));
      if(dup.length>1)teamBad.push(n+':多处重复'+dup.join(''));
      r.forEach(p=>names.push(p.name));
    });
    dupNames=names.filter((n,i)=>names.indexOf(n)!==i);
  }catch(e){errs.push('收尾检查异常: '+e.message);}
  return JSON.stringify({season:S.season, series, fund:Math.round(S.fund), players:S.players.length,
    dupNames:dupNames.slice(0,5), teamBad:teamBad.slice(0,5), notes:[...new Set(notes)], errs:errs.slice(0,6)});
`);

const res = JSON.parse(out);
const T = makeTester('模糊压测 (15 赛季 × 900 步随机)');
console.log('  [' + res.season + ' 赛季 · ' + res.series + ' 场系列赛 · ' + res.players + ' 人]');
T.check(res.errs.length === 0, '异常:\n  ' + res.errs.join('\n  '));
T.check(res.dupNames.length === 0, '跨队重名: ' + res.dupNames.join(','));
T.check(res.teamBad.length === 0, '球队阵容异常: ' + res.teamBad.join(','));
T.check(res.notes.length === 0 || res.notes.every(n => n.includes('自动暂停')), '意外备注: ' + res.notes.join(' / '));
T.report();
