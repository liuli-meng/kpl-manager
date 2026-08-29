const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>n>=10000?(n/10000).toFixed(1)+"万":String(Math.round(n));
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2200);}
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

/* ================= 图标系统（统一细线 SVG，跟随 currentColor） ================= */
const IC_PATHS={
  club:'M4 21V8l8-5 8 5v13M9 21v-6h6v6M9 12h.01M15 12h.01',
  users:'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75',
  swap:'M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13',
  train:'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',
  trophy:'M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4ZM7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 3.5M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 3.5',
  coin:'M12 8c-2.5 0-4.5-.9-4.5-2S9.5 4 12 4s4.5.9 4.5 2-2 2-4.5 2ZM7.5 6v4c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V6M7.5 10v4c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-4M7.5 14v4c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-4',
  cal:'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  bolt:'M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2Z',
  shield:'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z',
  flame:'M12 22c4.4 0 7-2.8 7-6.5 0-3-1.8-5-3.2-6.6C14.5 7.4 14 5.5 14 3c-3.5 1.5-5 4-5 6.5 0 1.5-1 2-1.7 1.2C6.5 9.8 6 8.5 6 8.5c-.7 1.3-1 3-1 4.5C5 18.5 7.6 22 12 22Z',
  star:'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8L12 3Z',
  ban:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM5.5 5.5l13 13',
  check:'M20 6 9 17l-5-5',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  play:'M6 4l14 8-14 8V4Z',
  chart:'M4 20V10M10 20V4M16 20v-8M22 20H2',
  doc:'M6 2h9l5 5v15H6V2ZM14 2v6h6M9 13h6M9 17h6',
  coach:'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  case:'M4 8h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M2 13h20',
  link:'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  medal:'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM8 13 5 22l7-3 7 3-3-9',
  film:'M4 4h16v16H4V4ZM4 9h16M4 15h16M9 4v16M15 4v16',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-5M12 8h.01',
  vs:'M5 4l7 16L19 4M8.5 9.5h7',
};
function ic(name,size){
  const s=size||14;
  return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(IC_PATHS[name]||IC_PATHS.info)+'"/></svg>';
}
const POS={top:['对抗路','对'],jg:['打野','野'],mid:['中路','中'],ad:['发育路','发'],sup:['游走','游']};
const POS_ORDER=['top','jg','mid','ad','sup'];
/* ================= 总值体系（FC26 式 OVR） =================
   选手唯一评价=总值（0-99）：按位置加权四维实时计算，训练/年龄/表现即时反映在数字上。
   身价、周薪、签约费、市场档位全部由总值曲线出；卡面色阶：90+ 金 / 80+ 蓝 / 其余灰蓝。 */
const POS_W={top:{lane:.35,farm:.2,team:.25,mind:.2},jg:{lane:.15,farm:.4,team:.3,mind:.15},
             mid:{lane:.3,farm:.2,team:.3,mind:.2},ad:{lane:.3,farm:.35,team:.2,mind:.15},
             sup:{lane:.15,farm:.2,team:.3,mind:.35}};
function overall(p){
  const w=POS_W[p.pos]||{lane:.25,farm:.25,team:.3,mind:.2},a=p.attrs;
  return clamp(Math.round(a.lane*w.lane+a.farm*w.farm+a.team*w.team+a.mind*w.mind),1,99);
}
function ovrColor(o){return o>=90?'#ffb84d':o>=80?'#5aa7ff':'#7d93b8';}
function ovrCls(o){return o>=90?'ssr':o>=80?'sr':'r';} // 复用旧卡面色阶样式
const _curve=(pts,o)=>{
  if(o<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++)if(o<=pts[i][0]){
    const A=pts[i-1],B=pts[i];return Math.round(A[1]+(B[1]-A[1])*(o-A[0])/(B[0]-A[0]));
  }
  return pts[pts.length-1][1];
};
/* 总值→签约身价（万）：锚定旧经济（顶星≈260 / 主力≈130 / 轮换≈55） */
const VALUE_PTS=[[40,6],[50,14],[60,30],[66,45],[72,65],[76,100],[80,140],[84,185],[88,240],[92,285],[96,335],[99,400]];
const valueOf=o=>_curve(VALUE_PTS,o);
/* 总值→周薪曲线（万） */
const WAGE_PTS=[[40,1.2],[50,2],[60,3.5],[66,5],[72,7.5],[76,10],[80,14],[85,21],[90,28],[96,35],[99,40]];
const wageOf=o=>_curve(WAGE_PTS,o);
const TRAIN_ITEMS=[{k:'lane',n:'对线',desc:'操作细节与线上压制'},{k:'farm',n:'运营',desc:'资源控制与节奏'},
                   {k:'team',n:'团战',desc:'团战走位与配合'},{k:'mind',n:'心态',desc:'大赛心理素质'}];
const SPONSORS=[{lv:0,name:'社区网吧',icon:'Ⅰ',income:10,cost:0},
                {lv:1,name:'本地电竞馆',icon:'Ⅱ',income:25,cost:150},
                {lv:2,name:'全国连锁外设',icon:'Ⅲ',income:55,cost:400},
                {lv:3,name:'国际大厂冠名',icon:'Ⅳ',income:110,cost:1000}];
const ENERGY_MAX=100, WAGE_EVERY=7, SEASON_MATCHES=7;

/* ================= 英雄池（KPL 常用英雄 · 含摇摆位） =================
   n:英雄名  pos:可打位置[主位,...摇摆位]  t:倾向(对线lane/运营farm/团战team/心态mind)  hot:版本热门 */
const HEROES=[
 // ===== 对抗路 =====
 {n:'姬小满',pos:['top'],t:'lane',hot:1},{n:'花木兰',pos:['top'],t:'lane'},
 {n:'关羽',pos:['top'],t:'lane',hot:1},{n:'马超',pos:['top'],t:'lane'},
 {n:'吕布',pos:['top'],t:'team'},{n:'狂铁',pos:['top'],t:'lane'},
 {n:'廉颇',pos:['top','sup'],t:'team'},{n:'猪八戒',pos:['top','sup'],t:'farm',hot:1},
 {n:'孙策',pos:['top'],t:'team'},{n:'白起',pos:['top','sup'],t:'team'},
 {n:'蒙恬',pos:['top'],t:'team'},{n:'达摩',pos:['top'],t:'lane'},
 {n:'夏洛特',pos:['top'],t:'lane'},{n:'老夫子',pos:['top'],t:'lane'},
 {n:'夏侯惇',pos:['top','jg','sup'],t:'farm',hot:1},{n:'司空震',pos:['top','jg'],t:'team'},
 {n:'亚连',pos:['top'],t:'team',hot:1},{n:'刘邦',pos:['top','sup'],t:'farm'},
 {n:'杨戬',pos:['top','jg'],t:'lane',hot:1},{n:'大司命',pos:['jg','top'],t:'farm',hot:1},
 // ===== 打野 =====
 {n:'镜',pos:['jg'],t:'team',hot:1},{n:'澜',pos:['jg'],t:'team'},
 {n:'娜可露露',pos:['jg'],t:'team'},{n:'兰陵王',pos:['jg','sup'],t:'farm',hot:1},
 {n:'裴擒虎',pos:['jg'],t:'farm'},{n:'露娜',pos:['jg'],t:'lane'},
 {n:'李白',pos:['jg'],t:'team'},{n:'韩信',pos:['jg'],t:'lane'},
 {n:'云缨',pos:['jg'],t:'team'},{n:'梦奇',pos:['top','jg'],t:'team'},
 {n:'曜',pos:['jg','top'],t:'lane'},{n:'阿古朵',pos:['jg'],t:'farm'},
 {n:'铠',pos:['jg','top'],t:'team'},{n:'宫本武藏',pos:['jg'],t:'team'},
 {n:'盘古',pos:['jg'],t:'farm'},{n:'嫦娥',pos:['jg','mid'],t:'farm'},
 // ===== 中路 =====
 {n:'西施',pos:['mid','sup'],t:'team'},{n:'干将莫邪',pos:['mid'],t:'lane'},
 {n:'不知火舞',pos:['mid'],t:'team'},{n:'沈梦溪',pos:['mid'],t:'farm'},
 {n:'王昭君',pos:['mid','sup'],t:'mind'},{n:'安琪拉',pos:['mid'],t:'team'},
 {n:'姜子牙',pos:['mid','sup'],t:'farm'},{n:'弈星',pos:['mid'],t:'farm'},
 {n:'张良',pos:['mid','sup'],t:'mind'},{n:'女娲',pos:['mid'],t:'farm'},
 {n:'貂蝉',pos:['mid'],t:'lane'},{n:'上官婉儿',pos:['mid'],t:'lane'},
 {n:'百里守约',pos:['ad','mid'],t:'lane',hot:1},{n:'海月',pos:['mid'],t:'farm',hot:1},
 {n:'金蝉',pos:['mid','sup'],t:'mind'},{n:'周瑜',pos:['mid'],t:'farm'},
 {n:'嬴政',pos:['mid'],t:'farm'},
 // ===== 发育路 =====
 {n:'公孙离',pos:['ad'],t:'team',hot:1},{n:'孙尚香',pos:['ad'],t:'lane'},
 {n:'马可波罗',pos:['ad'],t:'team'},{n:'虞姬',pos:['ad'],t:'lane'},
 {n:'鲁班七号',pos:['ad'],t:'farm'},{n:'伽罗',pos:['ad'],t:'farm'},
 {n:'后羿',pos:['ad'],t:'farm'},{n:'狄仁杰',pos:['ad'],t:'lane'},
 {n:'李元芳',pos:['ad','jg'],t:'farm'},{n:'艾琳',pos:['ad'],t:'lane'},
 {n:'黄忠',pos:['ad'],t:'team'},{n:'莱西奥',pos:['ad'],t:'team'},
 {n:'戈娅',pos:['ad'],t:'farm',hot:1},{n:'蒙犽',pos:['ad','mid'],t:'lane'},
 // ===== 游走 =====
 {n:'鬼谷子',pos:['sup'],t:'team'},{n:'张飞',pos:['sup'],t:'team',hot:1},
 {n:'大乔',pos:['sup','mid'],t:'farm'},{n:'盾山',pos:['sup'],t:'lane'},
 {n:'太乙真人',pos:['sup'],t:'farm'},{n:'牛魔',pos:['sup'],t:'team'},
 {n:'苏烈',pos:['sup','top'],t:'team'},{n:'明世隐',pos:['sup'],t:'farm'},
 {n:'孙膑',pos:['sup','mid'],t:'farm'},{n:'鲁班大师',pos:['sup'],t:'team'},
 {n:'桑启',pos:['sup'],t:'team'},{n:'墨子',pos:['sup','mid'],t:'farm'},
 {n:'东皇太一',pos:['sup'],t:'team'},{n:'庄周',pos:['sup'],t:'mind'},
 {n:'刘禅',pos:['sup'],t:'team'},
];
const TYPE_NAME={lane:'对线型',farm:'运营型',team:'团战型',mind:'心态型'};

/* ================= 选手池（KPL 真实选手 + 主播 + K甲新秀） =================
   name: 选手ID, team: 所属战队（羁绊依据）, tags: 🎤主播 / 🌱K甲新秀
   base: 四维基准=选手真实评级，直接决定总值（如清融[94,90,92,91]→总值92） */
const PLAYER_POOL=[
 // ===== 对抗路 =====
 {id:'top1',name:'fly',pos:'top',team:'传奇',tags:[],base:[93,89,90,94],skill:{n:'花木兰绝活',t:'lane',d:'对线属性额外+12%'},sig:'花木兰',career:'2017年出道于QGhappy，6次总冠军+5次FMVP，KPL历史第一对抗路，花木兰绝活哥。'},
 {id:'top2',name:'清清',pos:'top',team:'WB',tags:[],base:[91,86,89,88],skill:{n:'马超神威',t:'lane',d:'对线+12%，切C无情'},sig:'马超',career:'2019年出道于DYG.JC，2021年随广州TTG夺冠，巅峰期被称为"第一边路"，马超/关羽绝活。'},
 {id:'top3',name:'坦然',pos:'top',team:'eStar',tags:[],base:[89,87,93,90],skill:{n:'吕布战神',t:'team',d:'团战属性额外+12%'},sig:'吕布',career:'eStarPro三冠主力对抗路，2021年世冠FMVP，吕布战神，坦然自若。'},
 {id:'top4',name:'轩染',pos:'top',team:'AG',tags:[],base:[88,86,92,89],skill:{n:'姬小满绝活',t:'team',d:'团战+12%'},sig:'姬小满',career:'成都AG超玩会新生代对抗路，2025年随AG拿下春季赛+夏季赛+年度总冠军。'},
 {id:'top5',name:'梓墨',pos:'top',team:'WB',tags:[],base:[90,88,88,87],skill:{n:'关羽一刀',t:'farm',d:'运营+12%，团战绕后'},sig:'关羽',career:'eStar青训出身，2022年转会北京WB成为对抗路核心，关羽一刀斩。'},
 {id:'top6',name:'归期',pos:'top',team:'狼队',tags:[],base:[82,78,80,81],skill:{n:'狂铁抗压',t:'lane',d:'对线+10%'},sig:'狂铁',career:'重庆狼队对抗路，2023年KPL春季赛冠军成员，姬小满/狂铁绝活。'},
 {id:'top7',name:'百兽',pos:'top',team:'DRG',tags:[],base:[80,77,83,79],skill:{n:'猪八戒摇摆',t:'team',d:'团战+10%'},sig:'猪八戒',career:'佛山DRG对抗路，KPL老牌边路，猪八戒摇摆出名。'},
 {id:'top8',name:'苏沫',pos:'top',team:'TES.A',tags:[],base:[79,76,78,80],skill:{n:'蒙恬无双',t:'lane',d:'对线+10%'},sig:'蒙恬',career:'长沙TES.A对抗路，蒙恬绝活，大赛型选手。'},
 {id:'top9',name:'无痕',pos:'top',team:'传奇',tags:[],base:[81,75,80,83],skill:{n:'梦奇捣蛋',t:'mind',d:'心态+10%，老将风采'},sig:'梦奇',career:'eStarPro传奇对抗路，2019年冠军，梦奇绝活，"无痕=梦奇"。'},
 {id:'top10',name:'酷偕',pos:'top',team:'XYG',tags:['🌱'],base:[68,66,67,65],skill:{n:'廉颇开团',t:'team',d:'团战+8%'},sig:'廉颇',career:'XYG对抗路，从全国大赛一路打进KPL，K甲励志代表。'},
 // ===== 打野 =====
 {id:'jg1',name:'梦泪',pos:'jg',team:'主播',tags:['🎤'],base:[92,90,88,93],skill:{n:'韩信偷家',t:'farm',d:'运营属性额外+12%，经典名场面'},sig:'韩信',career:'AG超玩会传奇打野，2016年出道，韩信偷家名场面缔造者，现为顶流主播。'},
 {id:'jg2',name:'暖阳',pos:'jg',team:'WB',tags:[],base:[88,95,92,90],skill:{n:'镜之舞',t:'farm',d:'运营属性额外+12%'},sig:'镜',career:'北京WB（原TS）打野，2020年双冠+双FMVP，镜/兰陵王绝活。'},
 {id:'jg3',name:'花海',pos:'jg',team:'eStar',tags:[],base:[87,93,94,89],skill:{n:'娜可露露收割',t:'team',d:'团战属性额外+12%'},sig:'娜可露露',career:'eStarPro打野，2021-2022年四冠+FMVP，娜可露露/镜绝活，KPL顶级野核。'},
 {id:'jg4',name:'钟意',pos:'jg',team:'AG',tags:[],base:[89,93,91,88],skill:{n:'镜澜双修',t:'farm',d:'运营+12%'},sig:'澜',career:'AG超玩会打野，2024年KPL夏季赛冠军+FMVP，镜/澜双修。'},
 {id:'jg5',name:'小胖',pos:'jg',team:'狼队',tags:[],base:[90,94,90,87],skill:{n:'胖皇野核',t:'farm',d:'运营+12%，野区统治'},sig:'裴擒虎',career:'重庆狼队打野，2021年世冠冠军，裴擒虎/八戒野核，操作天花板之一。'},
 {id:'jg6',name:'无畏',pos:'jg',team:'Hero',tags:[],base:[87,92,90,91],skill:{n:'兰陵王节奏',t:'farm',d:'运营+12%'},sig:'兰陵王',career:'南京Hero久竞打野，2020年双冠，兰陵王绝活，人气与实力兼备。'},
 {id:'jg7',name:'今屿',pos:'jg',team:'KSG',tags:[],base:[80,82,78,76],skill:{n:'阿古朵节奏',t:'farm',d:'运营+10%'},sig:'阿古朵',career:'苏州KSG打野，KPL中坚打野，裴擒虎/阿古朵节奏型。'},
 {id:'jg8',name:'鹏鹏',pos:'jg',team:'DRG',tags:[],base:[78,80,81,77],skill:{n:'云缨控图',t:'farm',d:'运营+10%'},sig:'云缨',career:'佛山DRG打野，老牌野核，云缨/阿古朵绝活。'},
 {id:'jg9',name:'九月',pos:'jg',team:'XYG',tags:['🌱'],base:[76,78,79,75],skill:{n:'梦奇开团',t:'team',d:'团战+10%'},sig:'梦奇',career:'XYG打野，从K甲打上KPL，澜/梦奇绝活。'},
 {id:'jg10',name:'孤影',pos:'jg',team:'主播',tags:['🎤'],base:[79,77,75,78],skill:{n:'露娜无限连',t:'lane',d:'对线+10%'},sig:'露娜',career:'虎牙人气主播，露娜月下无限连的缔造者之一，直播教学顶流。'},
 {id:'jg11',name:'剑仙',pos:'jg',team:'主播',tags:['🎤'],base:[77,76,82,74],skill:{n:'李白十步一杀',t:'team',d:'团战+10%'},sig:'李白',career:'虎牙主播，李白绝活哥，"十步杀一人"的李白代言人。'},
 // ===== 中路 =====
 {id:'mid1',name:'清融',pos:'mid',team:'eStar',tags:[],base:[94,90,92,91],skill:{n:'西施王',t:'team',d:'团战属性额外+12%'},sig:'西施',career:'Hero/eStar双队传奇中单，2021年三冠+双FMVP，西施王，KPL历史第一中单。'},
 {id:'mid2',name:'九尾',pos:'mid',team:'TTG',tags:[],base:[93,88,91,89],skill:{n:'不知火舞法刺',t:'team',d:'团战+12%'},sig:'不知火舞',career:'广州TTG中单，法刺代言人，不知火舞绝活，2021年亚军。'},
 {id:'mid3',name:'长生',pos:'mid',team:'AG',tags:[],base:[92,89,90,88],skill:{n:'沈梦溪节奏',t:'lane',d:'对线+12%'},sig:'沈梦溪',career:'AG超玩会中单，2024-2025年连续夺冠，沈梦溪/海月绝活。'},
 {id:'mid4',name:'向鱼',pos:'mid',team:'狼队',tags:[],base:[90,91,89,92],skill:{n:'工具人王昭君',t:'mind',d:'心态+12%，无私奉献'},sig:'王昭君',career:'重庆狼队中单，2023年冠军，王昭君工具人典范。'},
 {id:'mid5',name:'久诚',pos:'mid',team:'传奇',tags:[],base:[93,87,89,90],skill:{n:'干将莫邪百发百中',t:'lane',d:'对线属性额外+12%'},sig:'干将莫邪',career:'Hero三冠中单，2020年世冠FMVP，干将莫邪百发百中的"狙神"。'},
 {id:'mid6',name:'花卷',pos:'mid',team:'WB',tags:[],base:[81,80,79,78],skill:{n:'安琪拉爆发',t:'team',d:'团战+10%'},sig:'安琪拉',career:'北京WB中单，安琪拉绝活，2020年TS双冠成员。'},
 {id:'mid7',name:'萧玦',pos:'mid',team:'DYG',tags:[],base:[80,77,76,81],skill:{n:'守约狙神',t:'lane',d:'对线+10%'},sig:'百里守约',career:'深圳DYG中单，2020年KPL秋季赛冠军，百里守约狙神。'},
 {id:'mid8',name:'青枫',pos:'mid',team:'DRG',tags:[],base:[78,79,77,80],skill:{n:'姜子牙老将',t:'mind',d:'心态+10%'},sig:'姜子牙',career:'佛山DRG中单，KPL常青树老将，姜子牙绝活。'},
 {id:'mid9',name:'灵梦',pos:'mid',team:'XYG',tags:['🌱'],base:[77,76,78,76],skill:{n:'弈星新星',t:'farm',d:'运营+10%'},sig:'弈星',career:'XYG中单，从K甲打上KPL，沈梦溪/弈星绝活。'},
 {id:'mid10',name:'张大仙',pos:'mid',team:'主播',tags:['🎤'],base:[88,85,84,95],skill:{n:'仙术教学',t:'mind',d:'心态属性额外+12%，全队开心'},sig:'女娲',career:'斗鱼一哥，XYG战队老板，女娲/露娜教学，"仙术"流主播。'},
 {id:'mid11',name:'骚白',pos:'mid',team:'主播',tags:['🎤'],base:[80,75,79,82],skill:{n:'中单五杀',t:'team',d:'团战+10%'},sig:'貂蝉',career:'快手头部主播，貂蝉五杀名场面，技术流代表。'},
 // ===== 发育路 =====
 {id:'ad1',name:'一诺',pos:'ad',team:'AG',tags:[],base:[95,90,93,90],skill:{n:'公孙离刀尖跳舞',t:'team',d:'团战属性额外+12%'},sig:'公孙离',career:'AG超玩会发育路，2019年KPL秋季赛冠军，2023年世冠FMVP，公孙离绝活，人气顶流。'},
 {id:'ad2',name:'妖刀',pos:'ad',team:'狼队',tags:[],base:[93,91,90,89],skill:{n:'孙尚香翻滚',t:'lane',d:'对线属性额外+12%'},sig:'孙尚香',career:'重庆狼队发育路，2021年冠军，孙尚香/狄仁杰绝活。'},
 {id:'ad3',name:'易峥',pos:'ad',team:'eStar',tags:[],base:[90,89,92,88],skill:{n:'马可波罗无畏',t:'team',d:'团战+12%'},sig:'马可波罗',career:'eStarPro发育路，2021-2022年四冠，马可波罗绝活，敢打敢拼。'},
 {id:'ad4',name:'乔兮',pos:'ad',team:'WB',tags:[],base:[81,80,80,79],skill:{n:'虞姬稳健',t:'lane',d:'对线+10%'},sig:'虞姬',career:'北京WB发育路，虞姬绝活，稳定Carry。'},
 {id:'ad5',name:'梦岚',pos:'ad',team:'DRG',tags:[],base:[80,78,83,76],skill:{n:'鲁班炮台',t:'team',d:'团战+10%'},sig:'鲁班七号',career:'佛山DRG发育路，鲁班七号绝活，"炮台"代言人。'},
 {id:'ad6',name:'小义',pos:'ad',team:'DYG',tags:[],base:[79,82,78,77],skill:{n:'野射双修',t:'farm',d:'运营+10%'},sig:'李元芳',career:'深圳DYG发育路，2020年冠军+FMVP，野射双修的全能王。'},
 {id:'ad7',name:'秀豆',pos:'ad',team:'XYG',tags:['🌱'],base:[78,77,76,75],skill:{n:'公孙离秀豆',t:'lane',d:'对线+10%'},sig:'公孙离',career:'XYG发育路，公孙离绝活，从K甲打上KPL。'},
 {id:'ad8',name:'绝意',pos:'ad',team:'LGD',tags:[],base:[77,76,79,76],skill:{n:'孙尚香滚翻',t:'team',d:'团战+10%'},sig:'孙尚香',career:'杭州LGD.NBW发育路，新生代射手，孙尚香绝活。'},
 {id:'ad9',name:'小玖',pos:'ad',team:'KSG',tags:[],base:[78,77,77,77],skill:{n:'伽罗长弓',t:'farm',d:'运营+10%'},sig:'伽罗',career:'苏州KSG发育路，伽罗绝活，大后期保证。'},
 // ===== 游走 =====
 {id:'sup1',name:'cat',pos:'sup',team:'传奇',tags:[],base:[86,93,91,94],skill:{n:'老猫指挥',t:'farm',d:'运营属性额外+12%，全队大脑'},sig:'鲁班大师',career:'2016年出道，7次总冠军+2次FMVP，2019年转会RNG.M，KPL历史第一辅助/中单双位置传奇。'},
 {id:'sup2',name:'子阳',pos:'sup',team:'eStar',tags:[],base:[85,92,94,90],skill:{n:'鬼谷子开团',t:'team',d:'团战属性额外+12%'},sig:'鬼谷子',career:'eStarPro游走，2021-2022年三冠+FMVP，鬼谷子/张飞绝活，开团机器。'},
 {id:'sup3',name:'大帅',pos:'sup',team:'AG',tags:[],base:[86,92,91,89],skill:{n:'大乔体系',t:'farm',d:'运营+12%'},sig:'大乔',career:'AG超玩会游走，2024-2025年冠军主力，大乔体系核心。'},
 {id:'sup4',name:'帆帆',pos:'sup',team:'狼队',tags:[],base:[87,91,93,88],skill:{n:'张飞怒吼',t:'team',d:'团战+12%'},sig:'张飞',career:'狼队/TTG游走，2021-2023年三冠，张飞怒吼开团，冠军辅助。'},
 {id:'sup5',name:'星宇',pos:'sup',team:'WB',tags:[],base:[80,81,79,78],skill:{n:'盾山铁壁',t:'lane',d:'对线+10%'},sig:'盾山',career:'北京WB游走，盾山绝活，2020年TS双冠成员。'},
 {id:'sup6',name:'久酷',pos:'sup',team:'Hero',tags:[],base:[78,80,80,79],skill:{n:'太乙真人',t:'farm',d:'运营+10%'},sig:'太乙真人',career:'南京Hero久竞游走，2020年双冠，太乙真人绝活。'},
 {id:'sup7',name:'羲和',pos:'sup',team:'XYG',tags:['🌱'],base:[76,78,77,75],skill:{n:'牛魔开团',t:'team',d:'团战+10%'},sig:'牛魔',career:'XYG游走，牛魔绝活，从K甲打上KPL。'},
 {id:'sup8',name:'阿改',pos:'sup',team:'DRG',tags:[],base:[77,79,78,77],skill:{n:'苏烈复活',t:'team',d:'团战+10%'},sig:'苏烈',career:'佛山DRG游走，苏烈绝活，老将辅助。'},
 {id:'sup9',name:'蓝烟',pos:'sup',team:'主播',tags:['🎤'],base:[76,77,75,79],skill:{n:'明世隐牵线',t:'farm',d:'运营+10%'},sig:'明世隐',career:'虎牙主播，明世隐绝活，"明世隐创始人"。'},
 {id:'top11',name:'凌隐',pos:'top',team:'JDG',tags:[],base:[87,91,91,90],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'达摩',career:'2024年出道，效力JDG，对抗路稳定轮换。'},
 {id:'jg12',name:'白露',pos:'jg',team:'JDG',tags:[],base:[89,91,88,88],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'曜',career:'辗转多队后加盟JDG，以打野路扎实基本功著称。'},
 {id:'mid12',name:'玄夜',pos:'mid',team:'JDG',tags:[],base:[91,90,88,89],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'姜子牙',career:'性格沉稳，JDG的中路定海神针。'},
 {id:'ad10',name:'赤影',pos:'ad',team:'JDG',tags:[],base:[82,83,81,80],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'伽罗',career:'2019年出道，效力JDG，发育路稳定轮换。'},
 {id:'sup10',name:'青鸾',pos:'sup',team:'JDG',tags:[],base:[79,79,80,78],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'白起',career:'2021年自青训提拔，JDG重点培养的游走路新星。'},
 {id:'sup11',name:'听雨',pos:'sup',team:'RW侠',tags:[],base:[80,79,81,78],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'姜子牙',career:'性格沉稳，RW侠的游走路定海神针。'},
 {id:'top12',name:'望舒',pos:'top',team:'TTG',tags:[],base:[83,82,80,79],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'铠',career:'2022年出道，效力TTG，对抗路稳定轮换。'},
 {id:'jg13',name:'疏影',pos:'jg',team:'TTG',tags:[],base:[83,81,79,79],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'盘古',career:'性格沉稳，TTG的打野路定海神针。'},
 {id:'mid13',name:'流苏',pos:'mid',team:'KSG',tags:[],base:[83,80,81,80],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'墨子',career:'2022年出道，效力KSG，中路稳定轮换。'},
 {id:'ad11',name:'拂晓',pos:'ad',team:'TTG',tags:[],base:[83,83,78,83],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'莱西奥',career:'辗转多队后加盟TTG，以发育路扎实基本功著称。'},
 {id:'sup12',name:'听澜',pos:'sup',team:'KSG',tags:[],base:[78,78,82,82],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'姜子牙',career:'2021年登上KPL舞台，KSG的游走路答案。'},
 {id:'sup13',name:'折镜',pos:'sup',team:'TTG',tags:[],base:[82,78,78,78],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'庄周',career:'辗转多队后加盟TTG，以游走路扎实基本功著称。'},
 {id:'top13',name:'孤鸿',pos:'top',team:'DYG',tags:[],base:[75,77,74,75],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'蒙恬',career:'2024年自青训提拔，DYG重点培养的对抗路新星。'},
 {id:'jg14',name:'寒鸦',pos:'jg',team:'DYG',tags:[],base:[74,78,75,75],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'盘古',career:'性格沉稳，DYG的打野路定海神针。'},
 {id:'ad12',name:'惊鸿',pos:'ad',team:'Hero',tags:[],base:[80,78,78,76],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'马可波罗',career:'2019年自青训提拔，Hero重点培养的发育路新星。'},
 {id:'sup14',name:'鹤归',pos:'sup',team:'DYG',tags:[],base:[76,78,79,76],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'张良',career:'2021年登上KPL舞台，DYG的游走路答案。'},
 {id:'top14',name:'竹隐',pos:'top',team:'KSG',tags:[],base:[80,74,74,75],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'刘邦',career:'2020年登上KPL舞台，苏州KSG的对抗路答案。'},
 {id:'jg15',name:'松间',pos:'jg',team:'TES.A',tags:[],base:[79,80,75,78],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'裴擒虎',career:'辗转多队后加盟TES.A，以打野路扎实基本功著称。'},
 {id:'mid14',name:'墨白',pos:'mid',team:'TES.A',tags:[],base:[77,79,78,76],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'姜子牙',career:'性格沉稳，TES.A的中路定海神针。'},
 {id:'ad13',name:'霜华',pos:'ad',team:'TES.A',tags:[],base:[78,78,76,75],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'蒙犽',career:'性格沉稳，TES.A的发育路定海神针。'},
 {id:'jg16',name:'云归',pos:'jg',team:'EDG.M',tags:[],base:[74,72,77,71],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'梦奇',career:'性格沉稳，EDG.M的打野路定海神针。'},
 {id:'mid15',name:'星回',pos:'mid',team:'EDG.M',tags:[],base:[72,77,71,71],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'嬴政',career:'2021年自青训提拔，EDG.M重点培养的中路新星。'},
 {id:'ad14',name:'夜白',pos:'ad',team:'EDG.M',tags:[],base:[71,77,75,70],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'马可波罗',career:'辗转多队后加盟EDG.M，以发育路扎实基本功著称。'},
 {id:'sup15',name:'长歌',pos:'sup',team:'EDG.M',tags:[],base:[72,74,78,75],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'姜子牙',career:'2023年自青训提拔，EDG.M重点培养的游走路新星。'},
 {id:'top15',name:'逐风',pos:'top',team:'LGD',tags:[],base:[74,73,70,72],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'刘邦',career:'性格沉稳，LGD的对抗路定海神针。'},
 {id:'jg17',name:'踏月',pos:'jg',team:'LGD',tags:[],base:[75,77,75,70],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'铠',career:'辗转多队后加盟LGD，以打野路扎实基本功著称。'},
 {id:'mid16',name:'掠影',pos:'mid',team:'LGD',tags:[],base:[75,72,73,71],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'海月',career:'2019年出道，效力LGD，中路稳定轮换。'},
 {id:'sup16',name:'断岳',pos:'sup',team:'LGD',tags:[],base:[78,77,71,70],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'东皇太一',career:'性格沉稳，LGD的游走路定海神针。'},
 {id:'top16',name:'裂空',pos:'top',team:'RNG.M',tags:[],base:[70,76,77,71],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'老夫子',career:'2019年自青训提拔，RNG.M重点培养的对抗路新星。'},
 {id:'mid17',name:'潮生',pos:'mid',team:'RNG.M',tags:[],base:[78,76,76,78],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'安琪拉',career:'2022年出道，效力RNG.M，中路稳定轮换。'},
 {id:'ad15',name:'岚翎',pos:'ad',team:'RNG.M',tags:[],base:[70,77,78,76],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'马可波罗',career:'辗转多队后加盟RNG.M，以发育路扎实基本功著称。'},
 {id:'top17',name:'青崖',pos:'top',team:'WE',tags:[],base:[70,74,78,75],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'马超',career:'性格沉稳，WE的对抗路定海神针。'},
 {id:'jg18',name:'渡鸦',pos:'jg',team:'WE',tags:[],base:[74,76,70,72],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'云缨',career:'辗转多队后加盟WE，以打野路扎实基本功著称。'},
 {id:'ad16',name:'驰野',pos:'ad',team:'WE',tags:[],base:[73,71,74,70],skill:{n:'团战体系',t:'team',d:'团战属性额外+10%'},sig:'蒙犽',career:'2023年自青训提拔，WE重点培养的发育路新星。'},
 {id:'sup17',name:'拓野',pos:'sup',team:'WE',tags:[],base:[75,77,72,77],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'姜子牙',career:'2021年自青训提拔，WE重点培养的游走路新星。'},
 {id:'top18',name:'燃秋',pos:'top',team:'情久',tags:[],base:[73,76,78,77],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'狂铁',career:'性格沉稳，情久的对抗路定海神针。'},
 {id:'jg19',name:'拾光',pos:'jg',team:'情久',tags:[],base:[76,74,75,73],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'娜可露露',career:'辗转多队后加盟情久，以打野路扎实基本功著称。'},
 {id:'ad17',name:'南屿',pos:'ad',team:'情久',tags:[],base:[73,77,71,76],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'伽罗',career:'性格沉稳，情久的发育路定海神针。'},
 {id:'sup18',name:'北辰',pos:'sup',team:'情久',tags:[],base:[70,77,74,73],skill:{n:'线霸体系',t:'lane',d:'对线属性额外+10%'},sig:'桑启',career:'2023年自青训提拔，情久重点培养的游走路新星。'},
 {id:'top19',name:'风眠',pos:'top',team:'UUG',tags:[],base:[75,71,78,75],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'老夫子',career:'2019年出道，效力UUG，对抗路稳定轮换。'},
 {id:'mid18',name:'亦驰',pos:'mid',team:'UUG',tags:[],base:[76,76,71,77],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'沈梦溪',career:'2024年登上KPL舞台，UUG的中路答案。'},
 {id:'ad18',name:'九章',pos:'ad',team:'UUG',tags:[],base:[75,75,72,74],skill:{n:'运营体系',t:'farm',d:'运营属性额外+10%'},sig:'莱西奥',career:'2022年登上KPL舞台，UUG的发育路答案。'},
 {id:'sup19',name:'抱朴',pos:'sup',team:'UUG',tags:[],base:[71,72,70,77],skill:{n:'大心脏体系',t:'mind',d:'心态属性额外+10%'},sig:'白起',career:'2023年自青训提拔，UUG重点培养的游走路新星。'}
];
/* 战队羁绊：上场选手中同队人数达到阈值触发（真实电竞经理核心玩法） */
const TEAM_BONDS={
  'AG':    {min:3,full:5,bonusMin:5,bonusFull:12,descMin:'AG超玩会羁绊（≥3人）：全队战力+5%',descFull:'AG超玩会全阵容出战！全队战力+12%'},
  'eStar': {min:3,full:5,bonusMin:5,bonusFull:12,descMin:'eStarPro羁绊（≥3人）：全队战力+5%',descFull:'eStarPro全阵容出战！全队战力+12%'},
  '狼队':  {min:3,full:5,bonusMin:5,bonusFull:12,descMin:'重庆狼队羁绊（≥3人）：全队战力+5%',descFull:'重庆狼队全阵容出战！全队战力+12%'},
  'WB':    {min:3,full:5,bonusMin:4,bonusFull:10,descMin:'北京WB羁绊（≥3人）：全队战力+4%',descFull:'北京WB全阵容出战！全队战力+10%'},
  '传奇':  {min:2,full:3,bonusMin:4,bonusFull:10,descMin:'传奇选手并肩（≥2人）：全队战力+4%',descFull:'fly·久诚·cat 三冠传奇合体！全队战力+10%'},
  '主播':  {min:3,full:5,bonusMin:5,bonusFull:12,descMin:'主播天团（≥3人）：全队战力+5%',descFull:'主播天团满编！流量拉满，全队战力+12%'},
  'XYG':   {min:3,full:5,bonusMin:4,bonusFull:10,descMin:'XYG青训羁绊（≥3人）：全队战力+4%',descFull:'XYG全阵容出战！张大仙狂喜，全队战力+10%'},
  'DRG':   {min:3,full:5,bonusMin:3,bonusFull:8,descMin:'佛山DRG羁绊（≥3人）：全队战力+3%',descFull:'佛山DRG全阵容出战！全队战力+8%'},
};

/* ================= 对手战队（2025 KPL 全部 18 队，玩家加入后 17 支 AI） ================= */
const AI_TEAMS=[
 {name:'常山UUG',icon:'🦍',power:300},
 {name:'桐乡情久',icon:'🏮',power:320},
 {name:'西安WE',icon:'🐺',power:340},
 {name:'长沙TES.A',icon:'🥊',power:360},
 {name:'上海RNG.M',icon:'🦁',power:380},
 {name:'北京JDG',icon:'🦅',power:400},
 {name:'深圳DYG',icon:'💀',power:420},
 {name:'上海EDG.M',icon:'⚡',power:440},
 {name:'南京Hero久竞',icon:'💀',power:460},
 {name:'佛山DRG',icon:'🐉',power:480},
 {name:'苏州KSG',icon:'🐯',power:500},
 {name:'杭州LGD.NBW',icon:'🐺',power:520},
 {name:'广州TTG',icon:'🥏',power:540},
 {name:'济南RW侠',icon:'⚔️',power:560},
 {name:'北京WB',icon:'🐻',power:580},
 {name:'武汉eStarPro',icon:'⭐',power:600},
 {name:'重庆狼队',icon:'🐺',power:620},
 {name:'成都AG超玩会',icon:'🔥',power:640},
];
/* KPL 2025 官方赛制常量 */
const KPL={GROUP_SIZE:6,ROUNDS:5,BO5:5,BO7:7}; // BO5/BO7：系列赛总局数（AI 赛果模拟用）

/* ================= 教练池（真实 KPL 主教练） =================
   bonus: 全队战力%  style: 侧重属性(对应属性额外加成)  wage: 周薪  cost: 签约费 */
const COACH_POOL=[
 {id:'co1',name:'Zwy',rating:90,style:'farm',bonus:9,styleBonus:6,wage:32,cost:320,skill:{n:'四冠教父',d:'全队战力+9%，运营属性额外+6%（2025三冠+最佳教练）'}},
 {id:'co2',name:'SK',rating:90,style:'team',bonus:9,styleBonus:6,wage:32,cost:320,skill:{n:'六冠王朝',d:'全队战力+9%，团战属性额外+6%（KPL六冠教头）'}},
 {id:'co3',name:'久哲',rating:90,style:'lane',bonus:9,styleBonus:6,wage:30,cost:300,skill:{n:'五冠哲神',d:'全队战力+9%，对线属性额外+6%（Hero王朝奠基人）'}},
 {id:'co4',name:'林',rating:90,style:'team',bonus:8,styleBonus:5,wage:28,cost:280,skill:{n:'赛训总监',d:'全队战力+8%，团战属性额外+5%（男人哥）'}},
 {id:'co5',name:'老林',rating:80,style:'farm',bonus:5,styleBonus:4,wage:16,cost:150,skill:{n:'赛训大师',d:'全队战力+5%，运营属性额外+4%'}},
 {id:'co6',name:'月光',rating:80,style:'mind',bonus:5,styleBonus:4,wage:15,cost:140,skill:{n:'月之BP',d:'全队战力+5%，心态属性额外+4%'}},
 {id:'co7',name:'Gemini',rating:80,style:'mind',bonus:5,styleBonus:4,wage:14,cost:130,skill:{n:'毒奶玄学',d:'全队战力+5%，心态属性额外+4%（比赛毒奶对手）'}},
 {id:'co8',name:'花楼',rating:80,style:'lane',bonus:4,styleBonus:3,wage:14,cost:120,skill:{n:'稳健BP',d:'全队战力+4%，对线属性额外+3%'}},
 {id:'co9',name:'张角',rating:80,style:'farm',bonus:4,styleBonus:3,wage:13,cost:115,skill:{n:'战术大师',d:'全队战力+4%，运营属性额外+3%'}},
 {id:'co10',name:'Awoke',rating:80,style:'team',bonus:4,styleBonus:3,wage:13,cost:115,skill:{n:'冠军赛训',d:'全队战力+4%，团战属性额外+3%'}},
 {id:'co11',name:'奶茶',rating:70,style:'mind',bonus:2,styleBonus:2,wage:8,cost:55,skill:{n:'鸡汤教练',d:'全队战力+2%，心态属性额外+2%'}},
 {id:'co12',name:'青训助教',rating:70,style:'farm',bonus:2,styleBonus:2,wage:7,cost:50,skill:{n:'新人培养',d:'全队战力+2%，运营属性额外+2%'}},
];
const COACH_STYLE={lane:'对线',farm:'运营',team:'团战',mind:'心态'};

/* ================= 转会市场：AI 战队选手池（u=非卖品） ================= */
const AI_ROSTERS={
 '成都AG超玩会':{p:['top4','jg4','mid3','ad1','sup3'],u:['ad1','jg4']},
 '重庆狼队':{p:['top6','jg5','mid4','ad2','sup4'],u:['ad2']},
 '武汉eStarPro':{p:['top3','jg3','mid1','ad3','sup2'],u:['mid1']},
 '北京WB':{p:['top5','jg2','mid6','ad4','sup5'],u:['jg2']},
 '广州TTG':{p:['top12','jg13','mid2','ad11','sup13'],u:['mid2']},
 '南京Hero久竞':{p:['top9','jg6','mid5','ad12','sup6'],u:['mid5']},
 '苏州KSG':{p:['top14','jg7','mid13','ad9','sup12'],u:[]},
 '佛山DRG':{p:['top7','jg8','mid8','ad5','sup8'],u:[]},
 '杭州LGD.NBW':{p:['top15','jg17','mid16','ad8','sup16'],u:[]},
 '济南RW侠':{p:['top1','jg1','mid10','ad7','sup11'],u:['top1']},
 '深圳DYG':{p:['top13','jg14','mid7','ad6','sup14'],u:[]},
 '上海EDG.M':{p:['top10','jg16','mid15','ad14','sup15'],u:[]},
 '长沙TES.A':{p:['top8','jg15','mid14','ad13','sup9'],u:[]},
 '上海RNG.M':{p:['top16','jg11','mid17','ad15','sup7'],u:[]},
 '北京JDG':{p:['top11','jg12','mid12','ad10','sup10'],u:[]},
 '西安WE':{p:['top17','jg18','mid9','ad16','sup17'],u:[]},
 '桐乡情久':{p:['top18','jg19','mid11','ad17','sup18'],u:[]},
 '常山UUG':{p:['top19','jg10','mid18','ad18','sup19'],u:[]}
};
/* ================= 原版俱乐部模板（豪门/中坚/草根预算差异化） =================
   budget: 初始资金  cap: 工资帽  coach: 教练  players: 首发  seed: 战力种子(开局分组用) */
const CLUB_TEMPLATES=[
 {name:'成都AG超玩会',icon:'🔥',budget:1500,cap:150,coach:'co1',seed:640,players:['top4','jg4','mid3','ad1','sup3'],desc:'银河战舰 · 2025三冠王朝 · 预算拉满'},
 {name:'重庆狼队',icon:'🐺',budget:1400,cap:145,coach:'co2',seed:620,players:['top6','jg5','mid4','ad2','sup4'],desc:'六冠豪门 · 野核体系 · 顶级预算'},
 {name:'武汉eStarPro',icon:'⭐',budget:1300,cap:140,coach:'co3',seed:600,players:['top3','jg3','mid1','ad3','sup2'],desc:'eStar王朝 · 三冠主力全保留'},
 {name:'北京WB',icon:'🐻',budget:1000,cap:125,coach:'co5',seed:580,players:['top5','jg2','mid6','ad4','sup5'],desc:'追光者 · 暖阳领衔 · 中坚预算'},
 {name:'广州TTG',icon:'🥏',budget:900,cap:118,coach:'co8',seed:540,players:['top12','jg13','mid2','ad11','sup13'],desc:'九尾带队 · 法刺体系'},
 {name:'南京Hero久竞',icon:'💀',budget:950,cap:120,coach:'co10',seed:460,players:['top9','jg6','mid5','ad12','sup6'],desc:'久竞传奇 · 久诚回归 · 中游预算'},
 {name:'苏州KSG',icon:'🐯',budget:850,cap:112,coach:'co9',seed:500,players:['top14','jg7','mid13','ad9','sup12'],desc:'新锐崛起 · 稳扎稳打'},
 {name:'上海EDG.M',icon:'⚡',budget:600,cap:100,coach:'co11',seed:440,players:['top10','jg16','mid15','ad14','sup15'],desc:'平民战队 · 挑战者之路 · 低预算高目标'},
 {name:'北京JDG',icon:'🐆',budget:950,cap:120,coach:'co4',seed:570,players:['top11','jg12','mid12','ad10','sup10'],desc:'劲旅 · 轩染领衔 · 顶配中坚'},
 {name:'济南RW侠',icon:'🗡️',budget:900,cap:118,coach:'co6',seed:560,players:['top1','jg1','mid10','ad7','sup11'],desc:'传奇飞牛坐镇 · 老牌侠客'},
 {name:'佛山DRG',icon:'🐉',budget:850,cap:112,coach:'co7',seed:500,players:['top7','jg8','mid8','ad5','sup8'],desc:'龙魂新锐 · 百兽野心'},
 {name:'深圳DYG',icon:'🦅',budget:800,cap:110,coach:'co4',seed:480,players:['top13','jg14','mid7','ad6','sup14'],desc:'小义引擎 · 重塑荣光'},
 {name:'长沙TES.A',icon:'🌪️',budget:700,cap:105,coach:'co6',seed:450,players:['top8','jg15','mid14','ad13','sup9'],desc:'滔搏青春风暴 · 稳中求进'},
 {name:'杭州LGD.NBW',budget:650,cap:100,coach:'co7',seed:430,icon:'🐧',players:['top15','jg17','mid16','ad8','sup16'],desc:'大鹅新军 · 敢打敢拼'},
 {name:'上海RNG.M',icon:'👑',budget:600,cap:100,coach:'co4',seed:420,players:['top16','jg11','mid17','ad15','sup7'],desc:'皇族余晖 · 重建之路'},
 {name:'西安WE',icon:'🦂',budget:550,cap:95,coach:'co6',seed:410,players:['top17','jg18','mid9','ad16','sup17'],desc:'蓝色风暴 · 草根逆袭'},
 {name:'桐乡情久',icon:'🧧',budget:520,cap:95,coach:'co7',seed:400,players:['top18','jg19','mid11','ad17','sup18'],desc:'新军冲击 · 从零开始'},
 {name:'常山UUG',icon:'🐃',budget:500,cap:92,coach:'co4',seed:390,players:['top19','jg10','mid18','ad18','sup19'],desc:'升班马 · 一切从零'},
];

/* ================= 2026 自由市场（真实 KPL 选手 · 合同到期/转会流拍） =================
   每个转会窗轮换上架 3 名，签一人少一人；传奇老将为"最后一舞"年龄 */
const FA_2026=[
 {id:'fa26_1',name:'老帅',pos:'mid',rarity:'SSR',team:'传奇',tags:[],base:[90,84,88,93],skill:{n:'中单教科书',t:'lane',d:'对线属性额外+12%'},sig:'露娜',career:'AG超玩会 2017 年首冠中单，KPL 初代传奇，露娜/貂蝉双绝，意识至今顶级。'},
 {id:'fa26_2',name:'Alan',pos:'mid',rarity:'SSR',team:'传奇',tags:[],base:[89,86,92,90],skill:{n:'决胜貂蝉',t:'team',d:'团战属性额外+12%'},sig:'貂蝉',career:'武汉eStarPro 2019 年世界冠军中单，决胜局貂蝉名场面载入史册。'},
 {id:'fa26_3',name:'虔诚',pos:'ad',rarity:'SSR',team:'传奇',tags:[],base:[90,88,86,89],skill:{n:'位移大师',t:'lane',d:'运营属性额外+12%'},sig:'马可波罗',career:'传奇射手，RNG.M 时期名震联盟，马可波罗教科书般的走位。'},
 {id:'fa26_4',name:'阿泰',pos:'sup',rarity:'SR',team:'传奇',tags:[],base:[82,88,84,90],skill:{n:'开团指挥',t:'team',d:'团战属性额外+10%'},sig:'太乙真人',career:'AG超玩会 2017 年冠军辅助，开团时机拿捏堪称教科书。'},
 {id:'fa26_5',name:'湘军',pos:'jg',rarity:'SR',team:'TTG',tags:[],base:[83,80,82,81],skill:{n:'野区节奏',t:'farm',d:'运营属性额外+10%'},sig:'澜',career:'广州TTG 打野，节奏型野核，26 年合同到期进入自由市场。'},
 {id:'fa26_6',name:'风箫',pos:'ad',rarity:'SR',team:'TTG',tags:[],base:[82,79,81,83],skill:{n:'稳定输出',t:'team',d:'团战属性额外+10%'},sig:'公孙离',career:'广州TTG 发育路，新生代射手里最稳的输出点之一。'},
 {id:'fa26_7',name:'释怀',pos:'mid',rarity:'SR',team:'DRG',tags:[],base:[81,80,83,80],skill:{n:'法核carry',t:'lane',d:'对线属性额外+10%'},sig:'上官婉儿',career:'佛山DRG 中路，carry 型法核，26 年合同到期寻求新挑战。'},
];

/* ================= 随机事件（含 KPL 真实事件） ================= */
const EVENTS=[
 // —— 日常随机 ——
 {t:'选手加练',desc:'{p} 深夜独自加练，手感火热。',good:true,fn:s=>{const p=pick(rosterAll(s));p.attrs[pick(['lane','farm','team'])]+=2;p.morale+=5;}},
 {t:'媒体专访',desc:'俱乐部接受专访，曝光度大增，收到一笔采访费。',good:true,fn:s=>s.fund+=12},
 {t:'粉丝应援',desc:'粉丝团自发应援，主场氛围拉满。',good:true,fn:s=>{s.fund+=15;moraleAll(s,3);}},
 {t:'商业活动',desc:'俱乐部参加官方商业活动，获得活动分成。',good:true,fn:s=>s.fund+=8},
 {t:'状态起伏',desc:'{p} 近期作息混乱，状态下滑。',good:false,fn:s=>{const p=pick(rosterAll(s));p.morale-=12;}},
 {t:'舆论风波',desc:'社交媒体出现不利言论，队员心态受挫。',good:false,fn:s=>moraleAll(s,-6)},
 {t:'身体不适',desc:'{p} 感冒发烧，需要休息两天。',good:false,fn:s=>{const p=pick(rosterAll(s));p.energy=Math.min(p.energy,30);p.morale-=8;}},
 {t:'赞助商洽谈',desc:'新赞助商对战队战绩满意，追加了赞助费！',good:true,fn:s=>s.fund+=20},
 {t:'战术研讨',desc:'教练组闭门研究新战术，团战配合更好了。',good:true,fn:s=>{const p=pick(rosterAll(s));p.attrs.team+=2;}},
 {t:'转会流言',desc:'{p} 被传出转会流言，本人表示不受影响。',good:false,fn:s=>{const p=pick(rosterAll(s));p.morale-=6;}},
 {t:'青训惊喜',desc:'青训队出了一个好苗子，俱乐部收到培养奖金。',good:true,fn:s=>s.fund+=8},
 {t:'老将觉醒',desc:'{p} 接受采访时表示要带新人拿冠军，士气大涨！',good:true,fn:s=>{const p=pick(rosterAll(s));p.morale+=12;}},
 // —— KPL 真实事件 ——
 {t:'亚运征召',desc:'{p} 入选亚运会电竞国家队，为国争光！',good:true,fn:s=>{const p=pick(rosterAll(s));p.morale=100;p.attrs.mind=Math.min(99,p.attrs.mind+3);}},
 {t:'FMVP皮肤',desc:'{p} 的FMVP签名皮肤正式上线，俱乐部收到分成！',good:true,fn:s=>{const p=pick(rosterAll(s));s.fund+=25;p.morale+=10;}},
 {t:'版本更新·削弱',desc:'新版本上线，{p} 擅长的英雄被削弱，需要时间适应。',good:false,fn:s=>{const p=pick(rosterAll(s));p.morale-=8;p.attrs[pick(['lane','team'])]=Math.max(55,p.attrs[pick(['lane','team'])]-2);}},
 {t:'版本更新·加强',desc:'新版本上线，{p} 的招牌英雄迎来版本红利，手感火热！',good:true,fn:s=>{const p=pick(rosterAll(s));p.attrs[pick(['lane','team'])]=Math.min(99,p.attrs[pick(['lane','team'])]+2);p.morale+=6;}},
 {t:'全明星周末',desc:'参加 KPL 全明星周末，选手们放松了心情。',good:true,fn:s=>moraleAll(s,8)},
 {t:'假赛风波',desc:'联盟严查假赛，俱乐部被要求配合调查，舆论压力巨大。',good:false,fn:s=>moraleAll(s,-10)},
 {t:'解说毒奶',desc:'著名解说公开"看好"你下一场的对手……',good:true,fn:s=>moraleAll(s,5)},
 {t:'对手换帅',desc:'下个对手官宣换帅，新阵容磨合期战斗力存疑。',good:true,fn:s=>moraleAll(s,4)},
 {t:'巅峰对决名场面',desc:'训练赛复刻当年巅峰对决的名场面，全队沸腾！',good:true,fn:s=>{moraleAll(s,6);s.fund+=5;}},
 {t:'主场扩容',desc:'俱乐部主场升级完成，门票收入大涨。',good:true,fn:s=>s.fund+=20},
 {t:'降薪传闻',desc:'俱乐部降薪传闻流出，队员人心浮动。',good:false,fn:s=>moraleAll(s,-8)},
 {t:'冠军杯启程',desc:'受邀参加世界冠军杯，俱乐部获得赛事奖金预支。',good:true,fn:s=>{s.fund+=25;}},
 {t:'青训挂牌',desc:'青训队新秀在转会市场被争抢，俱乐部收到问价。',good:true,fn:s=>s.fund+=10},
 {t:'转会传闻',desc:'媒体爆料 {p} 收到豪门高额报价，人心浮动。',good:false,fn:s=>{const p=pick(rosterAll(s));p.willingness=Math.max(5,(p.willingness||50)-8);p.morale=clamp(p.morale-5,20,100);}},
 {t:'忠诚续约',desc:'{p} 与俱乐部完成续约，表态愿为球队终老。',good:true,fn:s=>{const p=pick(rosterAll(s));p.willingness=Math.min(100,(p.willingness||50)+12);p.morale=clamp(p.morale+6,20,100);}},
];

/* ================= 比赛模拟（Elo 胜率） =================
   分母 220：削弱纯战力碾压（BP/选人/版本强势才能真正左右胜负，弱队靠 BP 有翻盘空间） */
function winChance(my,opp){return 1/(1+Math.pow(10,(opp-my)/220));}
const CASTER=['一拉三！','极限操作！','名场面预定！','这波运营拉满！','经典绕后，丝血反杀！','水晶不倒，战斗不止！','教科书级团战！','来了！又是他！','反手就是一记大招！','这波决策太顶了！'];
