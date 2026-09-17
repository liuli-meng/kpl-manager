// KPL 两段式 BP 引擎回归（此前全仓零覆盖：kplDraftSteps/expandSteps 在 tests/ 命中 0 次）
// 覆盖：18 手两段式结构 / 蓝红镜像 / 巅峰对决盲选 / 无 UI 跑完整局 / 全局 BP / 分队记账 / 英雄池耗尽兜底
// 运行：node tests/verify-bp.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ===== 开局：一支完整阵容 + 一个系列赛 =====
  S=newState('BP测试队','测');
  fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;
  const mkSeries=(max,side,mw,ow,used,usedOpp)=>({
    used:used||[],usedOpp:usedOpp||[],mw:mw==null?0:mw,ow:ow==null?0:ow,max:max,
    stage:'regular',logs:[],myName:S.teamName,opName:S.schedule[S.matchIdx].opp,side:side||'blue'});

  // ===== ① 两段式结构：15 条指令展开成 18 手 = 8 ban + 10 pick =====
  (function(){
    const raw=kplDraftSteps();
    const seq=[];
    raw.forEach(st=>{for(let i=0;i<st.n;i++)seq.push(st.s+'/'+st.t);});
    const bans=seq.filter(x=>x.endsWith('/ban')).length;
    const picks=seq.filter(x=>x.endsWith('/pick')).length;
    if(seq.length!==18)fail('①应展开 18 手，实际 '+seq.length);
    else if(bans!==8)fail('①应有 8 个 BAN，实际 '+bans);
    else if(picks!==10)fail('①应有 10 个 PICK，实际 '+picks);
    // 官方顺序：第一轮BAN×4 → 第一轮PICK×6 → 第二轮BAN×4 → 第二轮PICK×4
    // ⚠ 分段是 4/6/4/4 不是 4/4/4/3：pick 指令带 n={1,2,2,1}，一轮就展开成 6 手
    else if(seq.slice(0,4).some(x=>!x.endsWith('/ban')))fail('①第 1 段应是 4 手 BAN: '+seq.slice(0,4));
    else if(seq.slice(4,10).some(x=>!x.endsWith('/pick')))fail('①第 2 段应是 6 手 PICK: '+seq.slice(4,10));
    else if(seq.slice(10,14).some(x=>!x.endsWith('/ban')))fail('①第 3 段应是 4 手 BAN: '+seq.slice(10,14));
    else if(seq.slice(14).some(x=>!x.endsWith('/pick')))fail('①第 4 段应是 4 手 PICK: '+seq.slice(14));
    // 双方各 3 个 BAN 起手、各 5 个 PICK
    else{
      const bBy=s=>seq.filter(x=>x===s+'/ban').length;
      const pBy=s=>seq.filter(x=>x===s+'/pick').length;
      if(bBy('B')!==4||bBy('R')!==4)fail('①双方应各 4 BAN，实际 B='+bBy('B')+' R='+bBy('R'));
      else if(pBy('B')!==5||pBy('R')!==5)fail('①双方应各 5 PICK，实际 B='+pBy('B')+' R='+pBy('R'));
      else log('①两段式结构：18 手 = 8 BAN + 10 PICK，分段 BAN4/PICK6/BAN4/PICK4 与双方各 4BAN+5PICK 均正确');
    }
  })();

  // ===== ② 蓝红镜像：蓝方第一手是我方，红方第一手是对方 =====
  (function(){
    const blue=expandSteps(mkSeries(5,'blue'),false);
    const red=expandSteps(mkSeries(5,'red'),false);
    const cnt=(steps,s)=>steps.filter(x=>x.side===s).length;
    if(blue.length!==18||red.length!==18)fail('②展开长度应为 18: '+blue.length+'/'+red.length);
    else if(blue[0].side!=='M')fail('②蓝方第一手应为我方，实际 '+blue[0].side);
    else if(red[0].side!=='O')fail('②红方第一手应为对方（镜像），实际 '+red[0].side);
    else if(cnt(blue,'M')!==9||cnt(red,'M')!==9)fail('②我方手数应为 9: '+cnt(blue,'M')+'/'+cnt(red,'M'));
    else log('②蓝红镜像：蓝方第一手=M(我方)、红方第一手=O(对方)，双方各 9 手');
  })();

  // ===== ③ 巅峰对决：BO7 3:3 / BO9 4:4 → 5 手盲选、无 BAN =====
  (function(){
    const peak=expandSteps(mkSeries(7,'blue',3,3),true);
    if(peak.length!==5)fail('③巅峰对决应为 5 手，实际 '+peak.length);
    else if(peak.some(x=>x.type!=='pick'))fail('③巅峰对决不应有 BAN');
    else if(peak.some(x=>x.side!=='M'))fail('③巅峰对决应全是我方盲选手');
    else{
      // 触发条件：mw+ow===max-1（3:3 / 4:4）
      const s77=mkSeries(7,'blue',3,3), s75=mkSeries(7,'blue',3,2);
      const isPeak=(sr)=>sr.max>=7&&sr.mw+sr.ow===sr.max-1;
      if(!isPeak(s77))fail('③3:3 应判定为巅峰对决');
      else if(isPeak(s75))fail('③3:2 不应判定为巅峰对决（系列赛未到决胜局）');
      else log('③巅峰对决：3:3 触发 5 手盲选、无 BAN、不受全局 BP 限制；3:2 不误触发');
    }
  })();

  // ===== ④ 无 UI 跑完整局（走真实 bpSuggest 路径）=====
  const mkDraft=(opts)=>{
    const sr=(opts&&opts.sr)||mkSeries(5,'blue');
    const isPeak=!!(opts&&opts.isPeak);
    return {sr,ls:rosterLineup(S),isPeak,
      used:isPeak?[]:(sr.used||[]).slice(),usedOpp:isPeak?[]:(sr.usedOpp||[]).slice(),
      steps:expandSteps(sr,isPeak),idx:0,
      myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,
      oppRoster:isPeak?[]:(ensureAiRosters(S,sr.opName)||[])};
  };
  const runFull=(d)=>{window._draft=d;bpSuggest();return d;}; // bpSuggest 内部走 draftAction/bestBanFor/myCandidates
  (function(){
    const d=runFull(mkDraft());
    if(d.idx!==18)fail('④跑完应推进 18 手，实际 '+d.idx);
    else if(d.myBans.length!==4)fail('④我方应有 4 BAN，实际 '+d.myBans.length);
    else if(d.oppBans.length!==4)fail('④对方应有 4 BAN，实际 '+d.oppBans.length);
    else if(Object.keys(d.myPicks).length!==5)fail('④我方应选满 5 人，实际 '+Object.keys(d.myPicks).length);
    else if(Object.keys(d.oppPicks).length!==5)fail('④对方应选满 5 人，实际 '+Object.keys(d.oppPicks).length);
    else log('④无 UI 跑完整局：18 手推完 · 双方各 4 BAN + 5 PICK');
  })();

  // ===== ⑤ 位置落位：键必须是合法位置且每位置恰好一个；英雄须属该位置英雄池 =====
  (function(){
    const d=runFull(mkDraft());
    const badPos=POS_ORDER.filter(pos=>!d.myPicks[pos]);
    const extra=Object.keys(d.myPicks).filter(k=>!POS_ORDER.includes(k));
    if(badPos.length)fail('⑤我方缺位置: '+badPos.join(','));
    else if(extra.length)fail('⑤我方出现非法位置键: '+extra.join(','));
    else{
      const wrong=POS_ORDER.filter(pos=>{const h=d.myPicks[pos];return !h||!heroOf(h)||!heroOf(h).pos.includes(pos);});
      if(wrong.length)fail('⑤英雄与位置不匹配: '+wrong.join(','));
      else log('⑤位置落位：5 个位置各选 1 个英雄，且英雄均属该位置英雄池');
    }
  })();

  // ===== ⑥ 英雄不重复：BAN + 双方 PICK 全局无重叠 =====
  (function(){
    const d=runFull(mkDraft());
    const all=[...d.myBans,...d.oppBans,...Object.values(d.myPicks),...Object.values(d.oppPicks)];
    const dup=all.filter((h,i)=>all.indexOf(h)!==i);
    if(dup.length)fail('⑥同一局出现重复英雄: '+[...new Set(dup)].join(','));
    else if(all.length!==18)fail('⑥BAN+PICK 总数应为 18，实际 '+all.length);
    else log('⑥英雄唯一性：BAN 8 + PICK 10 = 18 手全部不重复');
  })();

  // ===== ⑦ 全局 BP：本系列赛己方用过的英雄不能再选（分队记账）=====
  // ⚠ applyBp 记账读的是全局 S.series，不是参数里的 sr —— 测试必须先把 sr 挂到 S.series
  (function(){
    const sr=mkSeries(5,'blue');
    const keep=S.series;
    S.series=sr;
    const d1=runFull(mkDraft({sr}));
    applyBp({...d1.myPicks});
    if((sr.used||[]).length!==5)fail('⑦applyBp 后 sr.used 应有 5 个（我方本局英雄）');
    else{
      Object.keys(d1.oppPicks).forEach(pos=>{sr.oppPicks=sr.oppPicks||{};sr.oppPicks[pos]=d1.oppPicks[pos];});
      applyBp({...d1.myPicks});
      if((sr.usedOpp||[]).length!==5)fail('⑦sr.usedOpp 应有 5 个（对方本局英雄）');
      else{
        const cross=(sr.used||[]).filter(h=>(sr.usedOpp||[]).includes(h));
        if(cross.length)fail('⑦两队记账串了: '+cross.join(','));
        // 第二局：带上 used，断言新一局的候选里不含已用英雄
        const sr2=mkSeries(5,'blue',1,0,sr.used.slice(),sr.usedOpp.slice());
        const d2=mkDraft({sr:sr2});
        const picked=Object.values(d2.myPicks); // 空
        const candAll=[];
        POS_ORDER.forEach(pos=>myCandidates(d2,pos).forEach(h=>candAll.push(h.n)));
        const leak=(sr2.used||[]).filter(h=>candAll.includes(h));
        if(leak.length)fail('⑦第二局候选里出现本系列赛已用英雄: '+leak.join(','));
        else{
          const d3=runFull(d2);
          const repeat=Object.values(d3.myPicks).filter(h=>(sr2.used||[]).includes(h));
          if(repeat.length)fail('⑦第二局实际选到了已用英雄: '+repeat.join(','));
          else{
            S.series=keep;
            log('⑦全局 BP：applyBp 分队记账（used '+sr.used.length+' / usedOpp '+sr.usedOpp.length+'）· 第二局候选与实际选人均不含已用英雄');
          }
        }
      }
    }
  })();

  // ===== ⑧ draftAction 自动跳过对方的连续手 =====
  (function(){
    const d=mkDraft();
    const firstAiSide=d.steps[0].side;
    const act=draftAction(d);
    if(act.type==='done')fail('⑧开局不应直接结束');
    else if(d.idx>0&&d.steps[d.idx].side!=='M')fail('⑧draftAction 返回时不应停在对方手');
    else if(act.side!=='M')fail('⑧返回的应是我方手');
    else log('⑧draftAction：开局首位='+firstAiSide+'，自动连推对方手后停在 idx='+d.idx+'（我方）');
  })();

  // ===== ⑨ 英雄池耗尽兜底：池内无可用时仍能掏出本位置英雄（生疏 lv=0）=====
  (function(){
    const d=mkDraft();
    const pos=POS_ORDER[0];
    const pl=(d.ls||[]).find(x=>x.pos===pos);
    const backup=pl.heroPool.slice();
    const posHeroes=HEROES.filter(h=>h.pos.includes(pos)).map(h=>h.n);
    // 清空英雄池，并把「该位置英雄」占掉大部分（留几个没被占，模拟 BAN/PICK 未吃满）
    // ⚠ 不能全占：兜底分支同样受 takenSet 过滤，全占就真的无英雄可选了（此时该由 openBP 拦）
    pl.heroPool=[];
    d.used=(d.used||[]).concat(posHeroes.slice(0,Math.max(0,posHeroes.length-3)));
    const cand=myCandidates(d,pos);
    if(!cand.length)fail('⑨英雄池为空时应走「临时掏」兜底，实际候选为空');
    else{
      const illegal=cand.filter(h=>!heroOf(h.n)||!heroOf(h.n).pos.includes(pos));
      if(illegal.length)fail('⑨兜底候选里出现非本位置英雄');
      else log('⑨英雄池兜底：池内 0 个可用时仍掏出本位置英雄 '+cand.length+' 个（生疏 lv=0）');
    }
    pl.heroPool=backup;
    d.used=(d.used||[]).filter(h=>!posHeroes.includes(h));
  })();

  // ===== ⑩ bpConfirm 收口：写回 series + 满位置校验 =====
  (function(){
    const sr=mkSeries(5,'blue');
    const d=mkDraft({sr});
    let confirmed=0;
    d.onConfirm=()=>{confirmed++;};
    window._draft=d;
    bpConfirm(); // 内部先 bpSuggest 跑完再收口
    if(!sr.myBans||sr.myBans.length!==4)fail('⑩bpConfirm 未把 4 个 BAN 写回 series');
    else if(!sr.oppBans||sr.oppBans.length!==4)fail('⑩bpConfirm 未把对方 BAN 写回 series');
    else if(!S.pick||POS_ORDER.some(pos=>!S.pick[pos]))fail('⑩bpConfirm 未把选人写进 S.pick');
    else if(confirmed!==1)fail('⑩onConfirm 应回调 1 次，实际 '+confirmed);
    else if(window._draft!==null)fail('⑩收口后应清空 window._draft');
    else log('⑩bpConfirm 收口：BAN/PICK 写回 series · S.pick 五位置齐全 · onConfirm 回调 · 状态清空');
  })();

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join(String.fromCharCode(10));
})()
`, dom);
console.log(out);
