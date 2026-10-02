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

/* KPL_NO_BROWSER=1 强制走跳过分支：让「环境缺失时到底算不算通过」这件事
   可以被确定性验证（否则只能靠换一台没装 Chrome 的机器去试）。
   CI 若要求必须真跑，用 node tests/run.js --require-browser 让跳过直接判失败。 */
const FORCE_NO_BROWSER = process.env.KPL_NO_BROWSER === '1';
if (!CHROME || !PW_DIR || FORCE_NO_BROWSER) {
  /* exit 3 = 显式跳过。绝不能用 exit 0：runner 旧口径按退出码计通过，而 CI 是干净检出
     （没有 node_modules、package.json 也没有依赖）→ 这条唯一的真机门禁会在 CI 上
     「从未跑过却一直报绿」。退出码语义见 tests/run.js 的 SKIP_EXIT/KNOWN_SKIPABLE。 */
  console.error('[SKIP] 跳过浏览器真机门禁'
    + (FORCE_NO_BROWSER ? '（KPL_NO_BROWSER=1 强制跳过）' : '')
    + '（Chrome=' + (CHROME || '缺失') + ' · playwright=' + (PW_DIR || '缺失') + '）');
  process.exit(3);
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
  /* 前提断言：上面那段遮挡检查是「有页签才查」。页签被改名/删掉时它会一条都不查却照样绿
     （旧版就是这个形态）。所以先钉住「必须找得到吸顶页签」这个前提。
     注意不要再加 `pagesToCheck.length>0` 之类：那是常量数组，恒真，等于没断言。 */
  {
    const tabProbe = await page.evaluate(() => {
      const all = [...document.querySelectorAll('.sec-tabs, .msec-tabs')];
      const visible = all.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      return { all: all.length, visible: visible.length };
    });
    T.check(tabProbe.all > 0, `未找到任何 .sec-tabs/.msec-tabs —— 吸顶遮挡断言的前提失效（选择器改名或组件被删）`);
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
    /* 找不到页签时**不能**返回 detected:true（那是把「测不了」当「通过」）。
       返回 false 并通过下面 null 安全的文案报红。 */
    if (!tabs) return { detected: false, msg: '未找到 .sec-tabs，证伪前提不成立', tabTop: null, hdBottom: null };
    
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

  T.check(falsifyCheck.detected, `反向证伪测试成功：若吸顶回退为 top:0px，检查器必定判定为被顶栏遮挡并拦截报错 (实测 tabTop=${falsifyCheck.tabTop == null ? 'n/a' : falsifyCheck.tabTop.toFixed(1)} < hdBottom=${falsifyCheck.hdBottom == null ? 'n/a' : falsifyCheck.hdBottom.toFixed(1)}${falsifyCheck.msg ? ' · ' + falsifyCheck.msg : ''})`);

  /* ⑥ 真机裁切断言：任何「有高度上限」的元素，内容不得被静默裁掉。
     为什么必须有这条：`.panel.collapsible>*:not(h3)` 带 max-height + overflow:hidden
     （折叠动画的前提），而旧口径是固定魔数 1200px —— 点名网格 20 张完整卡实测自然高度
     4320px(375 视口) / 3683px(768) / 1929px(1280)，**桌面 4 列也超**，超出的卡被裁掉
     且没有滚动条，玩家根本点不到。体积门禁（verify-render-size）只数 KB 与标签数，
     永远抓不到这种「内容还在、只是看不见」的失效。
     判据：computedMaxHeight 不是 none 时，要么 scrollHeight ≤ clientHeight+1，
     要么该元素的 overflow-y 是可滚的（auto/scroll）。 */
  const clipProbe = async () => page.evaluate(() => {
    const bad = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const mh = cs.maxHeight;
      if (!mh || mh === 'none') continue;
      const scrollable = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      if (scrollable) continue;                       // 可滚 = 玩家拿得到
      if (el.scrollHeight > el.clientHeight + 1) {
        bad.push({
          sel: el.tagName.toLowerCase()
            + (el.id ? '#' + el.id : '')
            + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
          maxH: mh, scrollH: el.scrollHeight, clientH: el.clientHeight,
          lost: el.scrollHeight - el.clientHeight,
        });
      }
    }
    return bad.slice(0, 8);
  });
  {
    const pagesAll = ['career', 'club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
    const clipped = [];
    for (const pName of pagesAll) {
      await page.evaluate((p) => { if (typeof goPage === 'function') goPage(p); }, pName);
      await page.waitForTimeout(200);
      // 展开全部可折叠面板：收起态本来就该是 0 高度，不该算裁切
      await page.evaluate(() => {
        document.querySelectorAll('.panel.collapsible.collapsed > h3').forEach(h => h.click());
      });
      await page.waitForTimeout(350);
      const bad = await clipProbe();
      bad.forEach(b => clipped.push({ page: pName, ...b }));
    }
    T.check(clipped.length === 0,
      `有内容被 max-height 静默裁掉（没有滚动条 = 玩家拿不到）：${JSON.stringify(clipped)}`);
  }

  /* ⑥b 点名阶段是这条裁切的**历史现场**：非交互回合只有紧凑行（约 700px），
     而「轮到我点名」会把 20 张完整卡铺进 .grid.g4 —— 自然高度 4320px(375) / 1929px(1280)，
     旧口径（固定 max-height:1200px + overflow:hidden）会裁掉一批卡且不给滚动条。
     必须单独把关卡推到这个状态再查，否则上面的 10 页遍历查的是收盘后的形态，等于没测。
     同时断言「真的进了网格分支」，否则这条又是「没测到却绿」。 */
  {
    const entered = await page.evaluate(async () => {
      if (!S || !S.draft) return { ok: false, why: 'no draft' };
      if (typeof goPage === 'function') goPage('market');
      await new Promise(r => setTimeout(r, 200));
      S.draft.done = false;
      S.draft.phase = 'pick';
      let idx = S.draft.order.indexOf(S.teamName);
      if (idx < 0) { S.draft.order.unshift(S.teamName); idx = 0; }
      S.draft.slot = idx;
      if (typeof renderPage === 'function') renderPage('market');
      await new Promise(r => setTimeout(r, 250));
      /* 卡片数**不能**用 `.draft-pool .grid.g4 .pcard` 去数：那等于把「容器在不在」
         混进前提里，容器一被摘掉就变成「没进网格分支」，真正的裁切几何反而没被验证。
         所以按面板 + 网格来数，容器的事交给下面那条独立断言。 */
      const pool = document.querySelectorAll('#page-market .panel[data-fold="mdraft"] .grid.g4 .pcard').length;
      const poolWrapScrollable = (() => {
        const w = document.querySelector('.draft-pool');
        if (!w) return false;
        const cs = getComputedStyle(w);
        return cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      })();
      return { ok: true, pool, poolWrapScrollable, phase: S.draft.phase };
    });
    T.check(entered.ok, '点名阶段裁切断言的前提：档内应有选秀对象（draft）');
    if (entered.ok) {
      T.check(entered.pool >= 10,
        `点名阶段应渲染可点卡片网格（实测 ${entered.pool} 张）—— 没进网格分支则这条裁切断言等于没测`);
      T.check(entered.poolWrapScrollable, '点名网格的容器必须可滚（overflow-y:auto）—— 这是不被裁掉的前提');
      const draftClip = await clipProbe();
      T.check(draftClip.length === 0,
        `点名阶段有卡片被 max-height 静默裁掉（玩家点不到）：${JSON.stringify(draftClip)}`);
    }
  }

  /* ⑦ 反向证伪：往页面里塞一个「高内容 + 小上限 + overflow:hidden」的元素，
     然后**用同一个检测器**跑一遍，必须报红。没有这一步，⑥ 也可能只是
     「碰巧没有东西超限」而恒绿 —— 这条门禁的价值全在能报红。
     注意别拿 .draft-pool 之类当靶子：它们带 overflow-y:auto，检测器本来就该放行。 */
  {
    await page.evaluate(async () => {
      if (typeof goPage === 'function') goPage('market');
      await new Promise(r => setTimeout(r, 200));
      const host = document.querySelector('.page.on') || document.body;
      const probe = document.createElement('div');
      probe.id = 'km-clip-falsify';
      probe.style.cssText = 'max-height:40px;overflow:hidden';
      probe.innerHTML = '<div style="height:400px"></div>';
      host.appendChild(probe);
    });
    const flagged = await clipProbe();
    T.check(flagged.some(b => /km-clip-falsify/.test(b.sel)),
      `反向证伪：注入「高内容 + max-height:40px + overflow:hidden」后检测器必须报红（实得 ${JSON.stringify(flagged)}）`);
    await page.evaluate(() => { const e = document.getElementById('km-clip-falsify'); if (e) e.remove(); });
  }

  // ⑤ 最终状态：全流程无运行时错误
  T.check(consoleErrors.length === 0, `浏览器全流程无运行时 JS 报错 (共 ${consoleErrors.length} 个错误)`);

  await browser.close();
  T.report();
})();
