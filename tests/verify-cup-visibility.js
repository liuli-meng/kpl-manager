// 同类问题回归：后半程对阵必须可见（挑杯/EWC/亚运/年总/卡位）
// 运行：node tests/verify-cup-visibility.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const need=(html,keys,tag)=>keys.forEach(k=>{if(html.indexOf(k)<0)fail(tag+' 缺「'+k+'」');});

  S=newState('杯赛可见性',' x');fillRoster(S,'mid');

  // ① 挑战者杯双败：空 wf/final 也必须出现，且有下一场
  S.challenger={stage:'po',champ:null,
   po:{wb1:[{a:S.teamName,b:'队A',r:S.teamName},{a:'队B',b:'队C',r:'队B'}],
       wb2:[{a:S.teamName,b:'队B',r:null}],wf:{a:null,b:null,r:null},
       lb1:[{a:'队A',b:'队C',r:'队A'}],lb2:[{a:'队C',b:null,r:null}],
       lbs:{a:null,b:null,r:null},lbf:{a:null,b:null,r:null}},
   final:{a:null,b:null,r:null}};
  S.phase='challenger';
  const h1=clubChallengerPanel();
  need(h1,['下一场','胜者组决赛','败者组SF','败者组决赛','总决赛（BO9）','对手：队B'],'挑杯');
  if(h1.indexOf('border-color:var(--cyan)')<0)fail('挑杯下一场未高亮');
  else log('① 挑杯：空轮次占位 · 下一场 vs 队B · 高亮');

  // ② EWC：半决赛/决赛标签 + 空轮次
  S.ewc={qf:[{a:S.teamName,b:'外队1',r:S.teamName},{a:'外队2',b:'外队3',r:'外队2'},
             {a:'外队4',b:'外队5',r:'外队4'},{a:'外队6',b:'外队7',r:'外队6'}],
   sf:[{a:S.teamName,b:'外队2',r:null},{a:'外队4',b:'外队6',r:null}],
   final:{a:null,b:null,r:null},champ:null};
  S.phase='ewc';
  const h2=clubEwcPanel();
  need(h2,['下一场','半决赛','决赛','对手：外队2'],'EWC');
  if(h2.indexOf('八强')<0)fail('EWC 八强标签缺失');
  else log('② EWC：八强/半决赛/决赛标签齐全 · 下一场 vs 外队2');

  // ③ 亚运：中国队下一场
  S.ag={qf:[{a:'中国队',b:'韩国',r:null},{a:'日本',b:'越南',r:'日本'},
            {a:'美国',b:'巴西',r:'美国'},{a:'法国',b:'德国',r:'法国'}],
   sf:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
   final:{a:null,b:null,r:null},champ:null,medal:null,mvp:null,
   squad:[{pos:'mid',name:'选手',mine:true}],myPow:400};
  S.phase='asiad';
  const h3=clubAsiadPanel();
  need(h3,['半决赛','决赛','对手：韩国','下一场'],'亚运');
  log('③ 亚运：空半决赛/决赛占位 · 下一场 vs 韩国');

  // ④ 年总擂台：显示我方全部轮次，不只当前
  S.annual={stage:'arena',roundIdx:1,rounds:[
   [{a:S.teamName,b:'甲队',r:S.teamName}],
   [{a:'乙队',b:'丙队',r:null}],
   [{a:S.teamName,b:'丁队',r:null}],
  ],masters:[S.teamName],elites:['乙队']};
  S.phase='annual';
  const h4=clubAnnualPanel();
  need(h4,['下一场','我方全部轮次','丁队','第3轮'],'年总擂台');
  if(h4.indexOf('本轮对阵')<0)fail('年总本轮对阵缺失');
  else log('④ 年总擂台：跨轮「我方全部轮次」可见 · 下一场 vs 丁队');

  // ⑤ 年总淘汰：空 wf/final 也占位
  S.annual={stage:'po',champ:null,
   po:{wb1:[{a:S.teamName,b:'甲',r:S.teamName},{a:'乙',b:'丙',r:'乙'}],
       wb2:[{a:S.teamName,b:'乙',r:null}],wf:{a:null,b:null,r:null},
       lb1:[{a:'甲',b:'丙',r:'甲'}],lb2:[{a:'丙',b:null,r:null}],
       lbs:{a:null,b:null,r:null},lbf:{a:null,b:null,r:null},
       final:{a:null,b:null,r:null}}};
  const h5=clubAnnualPanel();
  need(h5,['胜者组决赛','败者组SF','总决赛','对手：乙'],'年总淘汰');
  log('⑤ 年总淘汰：全树占位 · 下一场 vs 乙');

  // ⑥ 卡位：对手明确
  S.card={matches:[{a:S.teamName,b:'对手卡',r:null},{a:'X',b:'Y',r:null}],idx:0};
  S.phase='card';
  const h6=clubCardPanel();
  need(h6,['下一场','对手卡','卡位赛·1'],'卡位');
  log('⑥ 卡位：下一场对手可见');

  // ⑦ 不得再出现「有 .a 才渲染」的隐藏空轮次模式（静态抽样）
  const src=clubChallengerPanel.toString()+clubEwcPanel.toString()+clubAnnualPanel.toString();
  if(/\\.a\\?mrow|\\.a\\?cupRow|filter\\(m=>m\\.a\\)/.test(src))fail('仍存在按 .a 过滤空轮次的旧模式');
  else log('⑦ 旧「有人才显示」模式已清除');

  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);
