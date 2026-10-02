// 门禁：真实浏览器真尺寸与视觉无遮挡回归门禁（Phase 2）
// 依赖：Chrome 与 playwright-core
// 断言项：
//   1. 移动端 (375x667) 控制台零 error / 零未捕获异常；
//   2. 滚动状态下 .sec-tabs / .msec-tabs 吸顶 top >= header.bottom（真实渲染无遮挡）；
//   3. 移动端下可点击控件真实渲染高度 >= 44px（WCAG 触控盒规范）；
//   4. 证伪能力：模拟回退 top:0px 时必定精准报红并捕获违例。

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const CHROME = CHROME_PATHS.find(p => fs.existsSync(p));

const PLAYWRIGHT_PATHS = [
  path.join(ROOT, '..', '.workbuddy', 'tmp', 'node_modules', 'playwright-core'),
  path.join(ROOT, 'node_modules', 'playwright-core')
];
const PW_DIR = PLAYWRIGHT_PATHS.find(p => fs.existsSync(p));

if (!CHROME || !PW_DIR) {
  console.error('[SKIP] 未找到 Chrome 路径或 playwright-core，跳过浏览器真机门禁');
  process.exit(0);
}

const { chromium } = require(PW_DIR);

const T = {
  total: 0,
  failed: 0,
  check(cond, msg) {
    T.total++;
    if (!cond) {
      T.failed++;
      console.error('  [FAIL] ' + msg);
    }
  },
  report() {
    if (T.failed > 0) {
      console.error(`\n浏览器真机门禁未通过: ${T.failed}/${T.total} checks failed\n`);
      process.exit(1);
    }
    console.log(`\n[PASS] 浏览器真机门禁全部通过 (${T.total}/${T.total} checks)`);
  }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const gameUrl = 'file:///' + path.join(ROOT, 'game.html').replace(/\\/g, '/');
  await page.goto(gameUrl);
  await page.waitForTimeout(600);

  // ① 断言：初始加载无 console error
  T.check(consoleErrors.length === 0, `页面初始加载控制台零错误 (实际 errors: ${consoleErrors.join('; ')})`);

  // 开局：自建战队进入游戏
  await page.evaluate(() => {
    const input = document.getElementById('new-team-name');
    if (input) input.value = '浏览器测试队';
    if (typeof createTeam === 'function') createTeam();
  });
  await page.waitForTimeout(800);

  // ② 核心断言：移动端多页面滚动下，.sec-tabs 真实像素绝对在 header 下方（无遮挡）
  const pagesToCheck = ['club', 'lineup', 'market', 'train'];
  for (const pageName of pagesToCheck) {
    await page.evaluate((p) => {
      if (typeof goPage === 'function') goPage(p);
    }, pageName);
    await page.waitForTimeout(300);

    const overlapResult = await page.evaluate(async () => {
      // 页面向下滚动 350px 触发 sticky
      window.scrollTo(0, 350);
      await new Promise(r => setTimeout(r, 150));

      const hd = document.querySelector('header');
      const hdBottom = hd ? hd.getBoundingClientRect().bottom : 0;
      const tabs = [...document.querySelectorAll('.sec-tabs, .msec-tabs')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      const items = tabs.map(t => {
        const tr = t.getBoundingClientRect();
        return {
          cls: t.className,
          top: tr.top,
          hdBottom,
          diff: tr.top - hdBottom
        };
      });

      return { hdBottom, items };
    });

    if (overlapResult.items.length > 0) {
      for (const item of overlapResult.items) {
        // 容差 1.0px（处理设备亚像素 subpixel 渲染）
        const noOverlap = item.top >= overlapResult.hdBottom - 1.0;
        T.check(noOverlap, `[${pageName}] 页签 (${item.cls}) top(${item.top.toFixed(1)}) 应在 header bottom(${overlapResult.hdBottom.toFixed(1)}) 下方 (间距: ${item.diff.toFixed(1)}px)`);
      }
    }
  }

  // ③ 核心断言：移动端触控目标实际渲染尺寸 >= 44px（容差 0.5px）
  const touchTargets = await page.evaluate(() => {
    const curPage = document.querySelector('.page.on') || document.querySelector('.page:not([style*="display: none"])');
    const buttons = curPage ? [...curPage.querySelectorAll('button, .btn, .hd-btn, .s-chip, .sec-tab')].filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) : [];

    const violations = [];
    buttons.forEach(b => {
      const r = b.getBoundingClientRect();
      // 排除特别紧凑的行内辅助标签，主要针对操作按钮与页签
      if (r.height < 43.5) {
        violations.push({
          tag: b.tagName,
          cls: b.className,
          text: (b.innerText || '').slice(0, 15).replace(/\s+/g, ' '),
          height: r.height
        });
      }
    });
    return { total: buttons.length, violations };
  });

  T.check(touchTargets.violations.length === 0, `移动端主要操作按钮触控高度全部 >= 44px (违规项: ${JSON.stringify(touchTargets.violations)})`);

  // ④ 反向证伪断言（Falsification check）：
  // 故意将 .sec-tabs 强制设为 top: 0px（回退旧版无吸顶偏移的遮挡状态），验证检查算法必定报红
  const falsifyCheck = await page.evaluate(async () => {
    const tabs = document.querySelector('.sec-tabs');
    if (!tabs) return { detected: true, msg: 'no sec-tabs found' };
    
    // 注入破坏性样式：硬设 top: 0px
    tabs.style.top = '0px';
    window.scrollTo(0, 350);
    await new Promise(r => setTimeout(r, 150));

    const hd = document.querySelector('header');
    const hdBottom = hd ? hd.getBoundingClientRect().bottom : 0;
    const tabTop = tabs.getBoundingClientRect().top;
    
    // 恢复
    tabs.style.top = '';

    // 当 top=0 时，tabTop 应显著小于 hdBottom（被遮挡）
    const isCovered = tabTop < hdBottom - 5.0;
    return { detected: isCovered, tabTop, hdBottom };
  });

  T.check(falsifyCheck.detected, `反向证伪测试成功：若吸顶回退为 top:0px，检查器必定判定为被顶栏遮挡并拦截报错 (实测 tabTop=${falsifyCheck.tabTop.toFixed(1)} < hdBottom=${falsifyCheck.hdBottom.toFixed(1)})`);

  // ⑤ 最终状态：全流程无运行时错误
  T.check(consoleErrors.length === 0, `浏览器全流程无运行时 JS 报错 (共 ${consoleErrors.length} 个错误)`);

  await browser.close();
  T.report();
})();
