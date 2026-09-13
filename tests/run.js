// 全量测试 runner：逐项执行，单挂不阻断后续，结束时汇总失败清单与耗时。
// 用法：node tests/run.js [--fail-fast] [--only=id,id] [--skip=id,id]
// 只跑年终：node tests/run.js --only=sim-yearend
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SUITES = [
  { id: 'audit-static', file: 'tests/audit-static.js', label: '静态审计' },
  { id: 'verify-regression', file: 'tests/verify-regression.js', label: '历史回归' },
  { id: 'verify-ai-coach', file: 'tests/verify-ai-coach.js', label: 'AI 教练' },
  { id: 'verify-annual', file: 'tests/verify-annual.js', label: '年度赛历' },
  { id: 'verify-fixes', file: 'tests/verify-fixes.js', label: '历史修复点' },
  { id: 'verify-contract', file: 'tests/verify-contract.js', label: '合同续约' },
  { id: 'verify-natcamp', file: 'tests/verify-natcamp.js', label: '亚运征召' },
  { id: 'verify-achieve', file: 'tests/verify-achieve.js', label: '成就' },
  { id: 'verify-save', file: 'tests/verify-save.js', label: '存档迁移' },
  { id: 'verify-logcat', file: 'tests/verify-logcat.js', label: '日志分类' },
  { id: 'verify-names', file: 'tests/verify-names.js', label: '命名生成' },
  { id: 'verify-board', file: 'tests/verify-board.js', label: '董事会' },
  { id: 'verify-scenario', file: 'tests/verify-scenario.js', label: '开局剧本' },
  { id: 'verify-fans', file: 'tests/verify-fans.js', label: '粉丝商业' },
  { id: 'verify-squad', file: 'tests/verify-squad.js', label: '更衣室' },
  { id: 'verify-tactics', file: 'tests/verify-tactics.js', label: '战术板' },
  { id: 'verify-kjia', file: 'tests/verify-kjia.js', label: 'K甲二队' },
  { id: 'verify-offer', file: 'tests/verify-offer.js', label: '转会报价' },
  { id: 'verify-kplrules', file: 'tests/verify-kplrules.js', label: 'KPL硬规则' },
  { id: 'verify-wagecap', file: 'tests/verify-wagecap.js', label: '工资帽经济' },
  { id: 'verify-review', file: 'tests/verify-review.js', label: '赛季回顾' },
  { id: 'verify-commentary', file: 'tests/verify-commentary.js', label: '解说文案' },
  { id: 'verify-career', file: 'tests/verify-career.js', label: '选手教练生涯' },
  { id: 'verify-hall', file: 'tests/verify-hall.js', label: '荣誉馆' },
  { id: 'verify-prevent', file: 'tests/verify-prevent.js', label: '防呆确认' },
  { id: 'verify-guide', file: 'tests/verify-guide.js', label: '新手引导' },
  { id: 'verify-sort', file: 'tests/verify-sort.js', label: '市场排序' },
  { id: 'smoke', file: 'smoke.js', label: '冒烟' },
  { id: 'sim-quick', file: 'tests/sim-quick.js', label: '平衡门禁' },
  { id: 'sim-yearend', file: 'tests/sim-yearend.js', label: '年终全链路门禁' },
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
  const r = spawnSync(process.execPath, [s.file], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  const ms = Date.now() - t;
  const code = r.status == null ? 1 : r.status;
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  // 子进程输出原样透传（保留 [PASS]/[FAIL]/门禁日志）
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  const ok = code === 0;
  if (!ok) failed++;
  results.push({ id: s.id, label: s.label, ok, code, ms });
  if (!ok) {
    console.error('\n[FAIL] ' + s.label + ' (' + s.file + ') exit=' + code + '  耗时 ' + (ms / 1000).toFixed(1) + 's');
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
