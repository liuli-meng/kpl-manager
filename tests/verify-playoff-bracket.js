// 季后赛对阵可见性：推进到后半程仍须看到「打谁」与下一场
// 运行：node tests/verify-playoff-bracket.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  S=newState('季后赛显示',' PO');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  // 手工搭一棵进行中的双败树：我方已打完 wb1，即将打胜者组决赛
  const A=S.teamName,B='北京JDG',C='成都AG超玩会',D='重庆狼队',E='武汉eStarPro',F='上海RNG.M';
  S.groups={S:[A,B,C,D,'广州TTG','深圳DYG'],A:[E,F,'苏州KSG','杭州LGD.NBW','南京Hero久竞','佛山DRG'],B:['常山UUG','北京WB','长沙TES.A','上海EDG.M','东莞Wz','烟台VG']};
  S.tables={S:{},A:{},B:{}};
  ['S','A','B'].forEach(g=>S.groups[g].forEach(n=>S.tables[g][n]={w:0,l:0,pts:0,pw:0}));
  S.playoff={
   wb:[{a:A,b:D,r:A},{a:B,b:C,r:B}], // 我方赢了 wb1
   lb:[{a:E,b:F,r:E},{a:'苏州KSG',b:'杭州LGD.NBW',r:'苏州KSG'}],
   lb2:[{a:'广州TTG',b:D,r:null},{a:'深圳DYG',b:C,r:null}],
   lb3:[{a:D,b:null,r:null},{a:C,b:null,r:null}],
   wf:{a:A,b:B,r:null}, // 我方下一场：胜者组决赛 vs B
   lb4:{a:null,b:null,r:null},
   lbf:{a:null,b:null,r:null},
   final:{a:null,b:null,r:null},
   champ:null
  };
  S.phase='playoff';

  // ① helper：全量对阵与下一场
  const all=poAllMatches(S.playoff);
  if(all.length<10)fail('poAllMatches 轮次不全: '+all.length);
  else log('① 全量对阵 '+all.length+' 场（含 wf/lb2/lb3/lb4/lbf/final）');

  const nx=poMyNext(S.playoff,S.teamName);
  if(!nx||nx.status!=='ready')fail('poMyNext 未识别胜者组决赛');
  else if(nx.op!==B)fail('下一场对手错: '+nx.op);
  else log('② 下一场：'+nx.tag+' vs '+nx.op);

  // ③ 俱乐部页必须画出后半程（不只首轮）
  const html=clubPlayoffPanel();
  const must=['胜者组决赛','败者组R2','败者组R3','败者组半决赛','败者组决赛',' 总决赛','下一场'];
  must.forEach(k=>{
    if(html.indexOf(k)<0)fail('俱乐部页缺「'+k+'」');
  });
  if(html.indexOf(B)<0)fail('俱乐部页未显示对手 '+B);
  if(html.indexOf('下一场')<0||html.indexOf(nx.op)<0)fail('下一场对手未突出');
  else log('③ 俱乐部页：后续轮次齐全 · 下一场对手 '+nx.op+' 高亮');

  // ④ 我方场次高亮（border 标记）
  if(html.indexOf('border-color:var(--cyan)')<0&&html.indexOf('border-color:var(--accent)')<0)fail('我方/下一场无高亮样式');
  else log('④ 对阵高亮样式已写入');

  // ⑤ 对手未定：显示「等待」而不是空白
  S.playoff.wf={a:A,b:null,r:null};
  S.playoff.wb=[{a:A,b:D,r:A},{a:B,b:C,r:null}]; // B 还没赢，对手未定
  const nx2=poMyNext(S.playoff,S.teamName);
  const html2=clubPlayoffPanel();
  if(!nx2||nx2.status!=='wait')fail('对手未定未识别');
  else if(html2.indexOf('对手待定')<0&&html2.indexOf('等待')<0)fail('对手未定文案缺失');
  else log('⑤ 对手未定时文案「对手待定/等待」');

  // ⑥ 赛后：显示冠军而不是空白
  S.playoff.final={a:A,b:B,r:A};S.playoff.champ=A;
  const html3=clubPlayoffPanel();
  if(html3.indexOf(A)<0)fail('冠军未显示');
  else log('⑥ 收官后显示冠军');

  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);
