// 构建产物校验：game.html 结构完整性 + 内联脚本在 vm 沙箱可跑通 UI 入口。
// 补齐「源码测过了但忘了 build / 拼接漏模块」这类静态审计与源码沙箱都盖不住的缺口。
// 运行：node tests/verify-built.js   （需已存在 game.html；CI 在 npm run build 之后跑）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'game.html');
const srcIdxPath = path.join(ROOT, 'src', 'index.html');
const T = makeTester('构建产物校验');

if (!fs.existsSync(htmlPath)) {
  T.check(false, 'game.html 不存在——请先 npm run build');
  T.report();
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const srcIdx = fs.readFileSync(srcIdxPath, 'utf8');

// ① 外部资源必须已内联（双击 file:// 可玩）
T.check(!/<script\s+src=/i.test(html), '存在未内联的 <script src=…>');
T.check(!/<link[^>]+rel=["']stylesheet["']/i.test(html), '存在未内联的 <link rel=stylesheet>');
T.check(html.includes('<style>') && html.includes('</style>'), '缺少内联 <style>（CSS 未注入）');
T.check(html.includes('<script>') && html.includes('</script>'), '缺少内联 <script>（JS 未注入）');
T.check(!/src\/js\//.test(html), '产物中残留 src/js/ 路径引用');
T.check(!html.includes('href="css/style.css"'), '产物中仍引用外部 css/style.css');

// ② 体积合理（过小=漏拼，过大=误嵌资源）
const kb = Math.round(html.length / 1024);
T.check(kb >= 200, 'game.html 过小(' + kb + 'KB)，疑似漏拼模块');
T.check(kb <= 4096, 'game.html 过大(' + kb + 'KB)，疑似误嵌资源');

// ③ 导航页容器与 src 一致
const navPages = [...srcIdx.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]);
T.check(navPages.length > 0, 'src/index.html 未解析到导航页');
const missingPages = navPages.filter(p => !html.includes('id="page-' + p + '"'));
T.check(!missingPages.length, 'game.html 缺少页面容器: ' + missingPages.join(', '));
T.check(html.includes('id="app-modal"') && html.includes('id="start-modal"'), '缺少弹窗容器');

// ④ 关键引擎函数出现在产物文本里
const MUST_FNS = [
  'newState', 'goPage', 'renderAll', 'renderPage', 'startMatch', 'startCup',
  'boardSettle', 'setBoardKpi', 'save', 'migrateSave', 'applyBp', 'playGame',
  'advanceCalendar', 'newSeason', 'installEra',
];
const missingFns = MUST_FNS.filter(fn => !html.includes('function ' + fn + '('));
T.check(!missingFns.length, 'game.html 缺少关键函数: ' + missingFns.join(', '));

// ⑤ 从产物抽出内联脚本，在沙箱里跑 UI 入口（真·构建产物运行时，而不是再读一遍 src）
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
T.check(scripts.length > 100 * 1024, '内联脚本过短(' + Math.round(scripts.length / 1024) + 'KB)，疑似拼接失败');

let runtime = null;
try {
  const { dom } = makeDom({ code: scripts });
  runtime = vm.runInContext(`
(function(){
  const R=[];
  // 开局：自建队 → 各页渲染
  S=newState('构建队','⚔️');
  fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  setBoardKpi(S);
  const pages=['career','club','lineup','market','train','league','kjia','union','hall','biz'];
  const renderErr=[];
  pages.forEach(p=>{try{renderPage(p);}catch(e){renderErr.push(p+':'+e.message);}});
  if(renderErr.length)R.push('渲染异常:'+renderErr.join(' | '));
  // goPage 不抛错（导航壳）
  pages.forEach(p=>{try{goPage(p);}catch(e){R.push('goPage('+p+'):'+e.message);}});
  // 存档序列化在产物环境可用
  const js=serializeForSave(S);
  if(!js||js.length<50)R.push('serializeForSave 过短');
  if(typeof HEROES==='undefined')R.push('缺少 HEROES');
  if(typeof PLAYER_POOL==='undefined')R.push('缺少 PLAYER_POOL');
  if(typeof CLUB_TEMPLATES==='undefined')R.push('缺少 CLUB_TEMPLATES');
  if(typeof KPL==='undefined')R.push('缺少 KPL');
  return JSON.stringify({ok:R.length===0, issues:R, pages:pages.length});
})()
`, dom);
} catch (e) {
  T.check(false, '内联脚本在沙箱执行失败: ' + (e && e.message || e));
  T.report();
  process.exit(1);
}

const rt = JSON.parse(runtime);
T.check(rt.ok, '产物运行时问题: ' + (rt.issues || []).join(' | '));
T.check(rt.pages === 10, '页面渲染数量异常: ' + rt.pages);

// ⑥ 与 src 交叉：产物字节应显著大于单个源模块，且包含每个模块的入口函数名
const HARNESS_FILES = require('./harness').FILES;
const missingMod = HARNESS_FILES.filter(f => {
  // 用模块内一个稳定符号判断是否被拼进产物
  const p = path.join(ROOT, 'src', 'js', f);
  if (!fs.existsSync(p)) return true;
  const src = fs.readFileSync(p, 'utf8');
  const m = src.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (!m) return false;
  return !html.includes('function ' + m[1] + '(');
});
T.check(!missingMod.length, '以下源模块疑似未拼进 game.html: ' + missingMod.join(', '));

T.report();
