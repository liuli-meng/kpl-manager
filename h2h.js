// 弱队 vs 强队正面对抗：UUG(垫底) vs AG(豪门) BO5，双方标准自动 BP，500 次
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, 'src', 'js');
let code = '';
['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'].forEach(f => { code += fs.readFileSync(path.join(SRC, f), 'utf8') + '\n'; });
const el = () => ({classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){},select(){},querySelector(){return null},querySelectorAll(){return[]}});
const dom = {getElementById:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),execCommand:()=>{},body:el()},window:null,confirm:()=>true,alert(){},toast(){},location:{reload(){}},setTimeout:()=>0,clearTimeout(){}};
dom.window = dom; vm.createContext(dom); vm.runInContext(code, dom);
const out = vm.runInContext(`
(function(){
  const res=[];
  // 垫底弱旅开局（applyClub 同款）
  const tmpl=CLUB_TEMPLATES.find(c=>c.name==='常山UUG');
  S=newState('常山UUG','🐃');
  tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)S.players.push(genPlayer(def));});
  S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  const myPow=teamPower(S);
  const agR=ensureAiRosters(S,'成都AG超玩会');
  const agPow=aiRosterPower(agR);
  res.push('纸面: UUG='+myPow+' vs AG='+agPow+'（差'+(agPow-myPow)+'）');
  res.push('单局胜率·无BP修正='+(winChance(myPow,agPow)*100).toFixed(1)+'%');
  const myBest=Math.round(myPow*1.02), opWorst=Math.round(agPow*0.92);
  res.push('单局胜率·BP打满(4有效BAN+红方counter)='+(winChance(myBest,opWorst)*100).toFixed(1)+'%');
  res.push('对照·改版前(Elo150+旧BP) BO5系列赛≈5%');
  // 拦截 finishSeries 抓每场比分
  const origFinish=finishSeries;
  finishSeries=function(win){S._res={win,mw:S.series.mw,ow:S.series.ow};origFinish(win);};
  let uugWin=0;const dist={};
  for(let i=0;i<500;i++){
    // 每场重置双方状态（体力/士气/手感），只测 BP 与战力本身
    S.players.forEach(p=>{p.energy=100;p.morale=85;});
    agR.forEach(p=>{p.energy=100;p.morale=85;});
    S.streak=0;S._res=null;
    S.series={used:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:'成都AG超玩会',side:Math.random()<0.5?'blue':'red'};
    S.seriesAuto=true;
    autoPlayNext(); // 自动模式一口气打完整场系列赛
    if(S._res){
      if(S._res.win)uugWin++;
      const k=S._res.mw+':'+S._res.ow;
      dist[k]=(dist[k]||0)+1;
    }
    S.series=null;S.seriesAuto=false;
    if(S.matchIdx>=S.schedule.length)S.matchIdx=0; // 正面对抗不走赛季流程，防越界
  }
  finishSeries=origFinish;
  res.push('实测 500 次 BO5（双方标准BP）: UUG 胜 '+uugWin+' 次 = '+(uugWin/5).toFixed(1)+'%');
  res.push('比分分布: '+Object.keys(dist).sort().map(k=>k+'×'+dist[k]).join('  '));
  return res.join(' || ');
})()
`,dom);
console.log(out.replace(/ \|\| /g,'\n'));
