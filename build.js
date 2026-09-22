#!/usr/bin/env node
/* 构建：src → 单文件 game.html（安全压缩：去注释/空行，不改全局名，onclick 可点）
   用法: node build.js  |  npm run build
   与 build.ps1 等价；CI/本地统一走本文件，避免 PS/Node 双实现漂移。 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'game.html');

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

/* 安全 JS 压缩：只删「整行注释」与块注释、压缩连续空行。
   不做 mangle/改写标识符——onclick="foo()" 依赖全局函数名。 */
function minifyJs(code) {
  let s = code.replace(/\r\n/g, '\n');
  // 块注释（非贪婪）；本仓源码注释不含嵌套 */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // 整行 // 注释（行首空白后只有注释）；保留行内 // 后代码的写法，避免误伤 URL/正则
  s = s.split('\n').map((ln) => {
    if (/^\s*\/\//.test(ln)) return '';
    return ln;
  }).join('\n');
  // 压缩连续空行
  s = s.replace(/\n{3,}/g, '\n\n');
  // 去行尾空白
  s = s.split('\n').map((ln) => ln.replace(/[ \t]+$/, '')).join('\n');
  return s.trim() + '\n';
}

function minifyCss(code) {
  let s = code.replace(/\r\n/g, '\n');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*([{}:;,>])\s*/g, '$1');
  s = s.replace(/;}/g, '}');
  return s.trim();
}

function build() {
  const htmlPath = path.join(SRC, 'index.html');
  const lines = readUtf8(htmlPath).split(/\r?\n/);
  const out = [];
  let cssInjected = false;
  let scriptCount = 0;

  for (const line of lines) {
    // 去掉 split(\r?\n) 留下的行尾 \r，避免输出混入 CRLF（与 git diff --exit-code game.html 冲突）
    const row = line.replace(/\r+$/, '');
    if (row.includes('<link rel="stylesheet" href="css/style.css">')) {
      const css = minifyCss(readUtf8(path.join(SRC, 'css', 'style.css')));
      out.push('<style>');
      out.push(css);
      out.push('</style>');
      cssInjected = true;
      continue;
    }
    const m = row.match(/<script src="(js\/|core\/)(.+?)"><\/script>/);
    if (m) {
      const dir = m[1] === 'js/' ? 'js' : 'core';
      const raw = readUtf8(path.join(SRC, dir, m[2]));
      out.push('<script>');
      out.push(minifyJs(raw));
      out.push('</script>');
      scriptCount++;
      continue;
    }
    out.push(row);
  }
  if (!cssInjected) throw new Error('style.css link not found');
  if (!scriptCount) throw new Error('no js modules inlined');

  // 输出统一 LF，保证 Windows checkout/autocrlf 下重建结果稳定
  fs.writeFileSync(OUT, out.join('\n').replace(/\r\n/g, '\n').replace(/\r/g, ''), 'utf8');
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log('OK -> ' + OUT + ' (' + kb + ' KB, scripts=' + scriptCount + ')');
}

build();
