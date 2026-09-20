// 全量测试 runner：逐项执行，单挂不阻断后续，结束时汇总失败清单与耗时。
// 用法：node tests/run.js [--fail-fast] [--only=id,id] [--skip=id,id] [--timeout=秒]
// 只跑年终：node tests/run.js --only=sim-yearend
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* 单项超时（秒）。默认 120 s —— 全套 51 项实测 47 s，正常单项最慢约 5 s，
   120 s 只可能由「不收敛的循环」触发，而那正是没有上限时会永久挂住 CI 的情形。
   调试长压测时可 --timeout=600 放宽。 */
const SUITE_TIMEOUT_MS = (() => {
  const a = process.argv.find(x => x.startsWith('--timeout='));
  const sec = a ? Number(a.split('=')[1]) : 120;
  return (Number.isFinite(sec) && sec > 0 ? sec : 120) * 1000;
})();
const SUITES = [
  { id: 'audit-static', file: 'tests/audit-static.js', label: '静态审计' },
  { id: 'verify-regression', file: 'tests/verify-regression.js', label: '历史回归' },
  { id: 'verify-ai-coach', file: 'tests/verify-ai-coach.js', label: 'AI 教练' },
  { id: 'verify-annual', file: 'tests/verify-annual.js', label: '年度赛历' },
  { id: 'verify-entrypoints', file: 'tests/verify-entrypoints.js', label: '全赛段入口审计' },
  { id: 'probe-annual-stuck', file: 'tests/probe-annual-stuck.js', label: '年总卡死探针' },
  { id: 'probe-yearroll', file: 'tests/probe-yearroll.js', label: '年总年度轮换探针' },
  { id: 'probe-matchstore', file: 'tests/probe-matchstore.js', label: '扁平表 mid 探针' },
  { id: 'verify-series-resume', file: 'tests/verify-series-resume.js', label: '系列赛续赛身份' },
  { id: 'probe-startmatch', file: 'tests/probe-startmatch.js', label: '开赛探针' },
  { id: 'verify-fixes', file: 'tests/verify-fixes.js', label: '历史修复点' },
  { id: 'verify-contract', file: 'tests/verify-contract.js', label: '合同续约' },
  { id: 'verify-natcamp', file: 'tests/verify-natcamp.js', label: '亚运征召' },
  { id: 'verify-achieve', file: 'tests/verify-achieve.js', label: '成就' },
  { id: 'verify-save', file: 'tests/verify-save.js', label: '存档迁移' },
  { id: 'verify-migrate', file: 'tests/verify-migrate.js', label: '迁移矩阵' },
  { id: 'verify-legend-price', file: 'tests/verify-legend-price.js', label: '名宿教练定价' },
  { id: 'verify-market-refresh', file: 'tests/verify-market-refresh.js', label: '市场刷新免费额度' },
  { id: 'verify-card-bo', file: 'tests/verify-card-bo.js', label: '卡位赛 BO 数' },
  { id: 'verify-era-format', file: 'tests/verify-era-format.js', label: '赛制旋钮层' },
  { id: 'verify-logcat', file: 'tests/verify-logcat.js', label: '日志分类' },
  { id: 'verify-names', file: 'tests/verify-names.js', label: '命名生成' },
  { id: 'verify-board', file: 'tests/verify-board.js', label: '董事会' },
  { id: 'verify-scenario', file: 'tests/verify-scenario.js', label: '开局剧本' },
  { id: 'verify-scenarios-audit', file: 'tests/verify-scenarios-audit.js', label: '五剧本开局审计' },
  { id: 'verify-fans', file: 'tests/verify-fans.js', label: '粉丝商业' },
  { id: 'verify-squad', file: 'tests/verify-squad.js', label: '更衣室' },
  { id: 'verify-champcore', file: 'tests/verify-champcore.js', label: '冠军班底羁绊' },
  { id: 'verify-upset', file: 'tests/verify-upset.js', label: '以下克上' },
  { id: 'verify-tactics', file: 'tests/verify-tactics.js', label: '战术板' },
  { id: 'verify-kjia', file: 'tests/verify-kjia.js', label: 'K甲二队' },
  { id: 'verify-draft', file: 'tests/verify-draft.js', label: '选秀大会' },
  { id: 'verify-rules', file: 'tests/verify-rules.js', label: '联盟规则扩展' },
  { id: 'verify-academy', file: 'tests/verify-academy.js', label: '青训一键培养' },
  { id: 'verify-offer', file: 'tests/verify-offer.js', label: '转会报价' },
  { id: 'verify-kplrules', file: 'tests/verify-kplrules.js', label: 'KPL硬规则' },
  { id: 'verify-bp', file: 'tests/verify-bp.js', label: 'BP两段式引擎' },
  { id: 'verify-aiplan', file: 'tests/verify-aiplan.js', label: 'AI赛季规划' },
  { id: 'verify-wagecap', file: 'tests/verify-wagecap.js', label: '工资帽经济' },
  { id: 'verify-playerstatus', file: 'tests/verify-playerstatus.js', label: '选手状态机' },
  { id: 'verify-nanwage', file: 'tests/verify-nanwage.js', label: '周薪NaN/杯赛面板守卫' },
  { id: 'verify-review', file: 'tests/verify-review.js', label: '赛季回顾' },
  { id: 'verify-commentary', file: 'tests/verify-commentary.js', label: '解说文案' },
  { id: 'verify-career', file: 'tests/verify-career.js', label: '选手教练生涯' },
  { id: 'verify-playerops', file: 'tests/verify-playerops.js', label: '选手日决策' },
  { id: 'verify-hall', file: 'tests/verify-hall.js', label: '荣誉馆' },
  { id: 'verify-prevent', file: 'tests/verify-prevent.js', label: '防呆确认' },
  { id: 'verify-prefs', file: 'tests/verify-prefs.js', label: '本机偏好' },
  { id: 'verify-guide', file: 'tests/verify-guide.js', label: '新手引导' },
  { id: 'verify-moment', file: 'tests/verify-moment.js', label: '演出与赛季主线' },
  { id: 'verify-idle', file: 'tests/verify-idle.js', label: '怠政经济门禁' },
  { id: 'verify-playoff-entry', file: 'tests/verify-playoff-entry.js', label: '季后赛/卡位赛入口' },
  { id: 'verify-coach-mode', file: 'tests/verify-coach-mode.js', label: '教练身份回归' },
  { id: 'verify-no-deadend', file: 'tests/verify-no-deadend.js', label: '三身份状态推进不变量' },
  { id: 'verify-coachloan', file: 'tests/verify-coachloan.js', label: '教练租借与引援' },
  { id: 'verify-relations', file: 'tests/verify-relations.js', label: '战队关系事件' },
  { id: 'verify-sort', file: 'tests/verify-sort.js', label: '市场排序' },
  { id: 'verify-render-size', file: 'tests/verify-render-size.js', label: '渲染规模门禁' },
  { id: 'smoke', file: 'smoke.js', label: '冒烟' },
  { id: 'sim-quick', file: 'tests/sim-quick.js', label: '平衡门禁' },
  { id: 'sim-player', file: 'tests/sim-player.js', label: '选手长局门禁' },
  { id: 'sim-yearend', file: 'tests/sim-yearend.js', label: '年终全链路门禁' },
  { id: 'late-game-probe', file: 'tests/late-game-probe.js', label: '长局压测15年' },
  { id: 'verify-built', file: 'tests/verify-built.js', label: '构建产物校验' },
];

const argv = process.argv.slice(2);
const failFast = argv.includes('--fail-fast');
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const skip = ((argv.find(a => a.startsWith('--skip=')) || '').split('=')[1] || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const onlyIds = only ? only.split(',').map(s => s.trim()).filter(Boolean) : null;

const suites = SUITES.filter(s => {
  if (onlyIds && !onlyIds.includes(s.id)) return false;
  if (skip.includes(s.id)) return false;
  return true;
});

if (!suites.length) {
  console.error('没有匹配的测试项（--only / --skip 过滤后为空）');
  process.exit(1);
}

console.log('=== 测试 runner · ' + suites.length + ' 项' + (failFast ? ' · --fail-fast' : '') + ' ===\n');

const results = [];
let failed = 0;
const t0 = Date.now();

for (const s of suites) {
  const t = Date.now();
  // 超时保护：比赛链/赛季推进的重构里，一个不收敛的 while 会让 npm test（和 CI）永久挂住。
  // 全套 51 项实测总耗时 47 s，最慢单项远低于此——120 s 只有「真挂死」才会触发。
  const r = spawnSync(process.execPath, [s.file], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    timeout: SUITE_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
  const ms = Date.now() - t;
  const timedOut = r.error && (r.error.code === 'ETIMEDOUT' || r.signal === 'SIGKILL');
  const code = timedOut ? 1 : (r.status == null ? 1 : r.status);
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  // 子进程输出原样透传（保留 [PASS]/[FAIL]/门禁日志）
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (timedOut) console.error('\n[TIMEOUT] ' + s.label + ' 超过 ' + (SUITE_TIMEOUT_MS / 1000) + ' s 未结束，已强杀');
  const ok = code === 0;
  if (!ok) failed++;
  results.push({ id: s.id, label: s.label, ok, code, ms, timedOut });
  if (!ok) {
    console.error('\n[FAIL] ' + s.label + ' (' + s.file + ') ' + (timedOut ? '超时' : 'exit=' + code) + '  耗时 ' + (ms / 1000).toFixed(1) + 's');
    if (failFast) {
      console.error('已中止后续测试（--fail-fast）');
      break;
    }
  }
}

const totalMs = Date.now() - t0;
const pass = results.filter(r => r.ok).length;
const bad = results.filter(r => !r.ok);

console.log('\n=== 汇总 ' + pass + '/' + results.length + ' 通过 · 总耗时 ' + (totalMs / 1000).toFixed(1) + 's ===');
if (bad.length) {
  console.log('未通过：');
  bad.forEach(r => console.log('  ✗ ' + r.label + ' (' + r.id + ') exit=' + r.code));
  process.exit(1);
}
console.log('全部通过。');
