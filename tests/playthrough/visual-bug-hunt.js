/* 视觉/文字/可点击性 bug 排查：桌面 1280x800 + 手机 390x844 × manager/player/coach
   Run: node tests/playthrough/visual-bug-hunt.js
   需要本地 http://127.0.0.1:8931 指向 E:\sex\kpl-manager
   输出: .bug-hunt/visual-report.md + .bug-hunt/visual/*.png
   只读产品代码；本脚本与报告写在 .bug-hunt / tests/playthrough */
const fs = require('fs');
const path = require('path');
const { chromium } = require('E:/sex/.workbuddy/tmp/node_modules/playwright-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.KPL_BASE || 'http://127.0.0.1:8931';
const ROOT = 'E:\\sex\\kpl-manager';
const OUT = path.join(ROOT, '.bug-hunt');
const SHOT_DIR = path.join(OUT, 'visual');
const REPORT = path.join(OUT, 'visual-report.md');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const MODES = ['manager', 'player', 'coach'];
const H_MIN = 28; // 按钮最小高度
const H_MIN_MOBILE = 36; // 移动端触控目标（报告用；仍以 28 作为硬缺陷）

const MODE_PAGES = {
  manager: ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'],
  player: ['career', 'club', 'league', 'kjia', 'union', 'hall'],
  coach: ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall'],
};

/* ---------- 启动并构造三种身份 ---------- */
const BOOT_MODE = (mode) => {
  try { tourSkip(); } catch (e) {}
  try { installEra(null); } catch (e) {}
  if (mode === 'manager') {
    const nameEl = document.getElementById('new-team-name');
    if (nameEl) nameEl.value = '视觉扫雷';
    createTeam();
  } else if (mode === 'coach') {
    pickCoachClub(0);
    applyCoachClub();
  } else if (mode === 'player') {
    const n = document.getElementById('pc-name');
    if (n) n.value = '视觉扫雷';
    // 默认 mid + 青训新秀 + 第一支球队已由 initStart 填好
    createPlayerCareer();
  }
  try { tourSkip(); } catch (e) {}
  applyModeNav();
  return {
    ok: !!(typeof S === 'object' && S),
    mode: S && S.mode,
    team: S && S.teamName,
    pages: (typeof MODE_PAGES !== 'undefined' && MODE_PAGES[(S && S.mode) || mode]) || [],
  };
};

/* ---------- 页面内检测器（整函数注入浏览器，勿再引用外部闭包） ---------- */
const SCAN_IN_PAGE = (opts) => {
  const { pageLabel, mode, hMin, startTab } = opts || {};
  if (startTab) {
    try { switchStartTab(startTab); } catch (e) { return { pageLabel: startTab, mode, error: String(e.message || e) }; }
    void document.documentElement.offsetWidth;
  }
  const de = document.documentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollW = de.scrollWidth;
  const clientW = de.clientWidth;
  const bodyScrollW = document.body ? document.body.scrollWidth : null;
  const overflowPx = scrollW - clientW;
  const HH = hMin || 28;

  const isVisible = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    if (el.offsetParent === null && st.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const cssSel = (el) => {
    if (!el) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).slice(0, 3).join('.');
      if (cls) s += '.' + cls;
    }
    if (el.dataset && el.dataset.page) s += '[data-page=' + el.dataset.page + ']';
    return s;
  };

  const brief = (el, n) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, n || 40);

  // 1) 页面级横向溢出
  const wideEls = [];
  if (overflowPx > 2) {
    Array.from(document.querySelectorAll('body *'))
      .filter(isVisible)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vw + 2 && r.width > 8;
      })
      .slice(0, 20)
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        wideEls.push({
          tag: el.tagName,
          sel: cssSel(el),
          w: Math.round(r.width),
          right: Math.round(r.right),
          text: brief(el, 36),
          parent: cssSel(el.parentElement),
        });
      });
  }

  // 2) 文本被裁
  const truncated = [];
  const styleHasClip = (st) => {
    return (
      st.textOverflow === 'ellipsis' ||
      st.overflow === 'hidden' ||
      st.overflowX === 'hidden' ||
      st.overflowY === 'hidden' ||
      (st.webkitLineClamp && st.webkitLineClamp !== 'none' && st.webkitLineClamp !== '')
    );
  };
  Array.from(document.querySelectorAll('body *'))
    .filter(isVisible)
    .filter((el) => {
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0
      );
      return hasText || (el.children.length === 0 && (el.textContent || '').trim());
    })
    .slice(0, 4000)
    .forEach((el) => {
      const st = getComputedStyle(el);
      if (!styleHasClip(st)) return;
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      if (dx <= 2 && dy <= 2) return;
      if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return;
      if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return;
      if (el.classList && el.classList.contains('tbl')) return;
      const r = el.getBoundingClientRect();
      truncated.push({
        sel: cssSel(el),
        text: brief(el, 48),
        dx, dy,
        ow: st.overflow,
        ox: st.overflowX,
        oy: st.overflowY,
        to: st.textOverflow,
        clamp: st.webkitLineClamp || null,
        w: Math.round(r.width),
        h: Math.round(r.height),
        parent: cssSel(el.parentElement),
      });
    });

  // 3) 按钮/可点
  const clickableSel =
    'button, .btn, .hd-btn, .s-chip, .league-btn, [onclick], a[href], input[type=button], input[type=submit]';
  const buttons = [];
  Array.from(document.querySelectorAll(clickableSel))
    .filter(isVisible)
    .slice(0, 500)
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const text = brief(el, 40);
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      const textClipped = (dx > 2 || dy > 2) && text.length > 0;
      const tooSmall = r.height < HH || r.width < 20;
      const offX = r.left < -2 || r.right > vw + 2;
      const hit = (() => {
        try {
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx < 0 || cy < 0 || cx > vw || cy > vh) return 'offscreen';
          const hitEl = document.elementFromPoint(cx, cy);
          if (!hitEl) return 'no-hit';
          if (el.contains(hitEl) || hitEl.contains(el)) return 'ok';
          return 'covered-by:' + cssSel(hitEl);
        } catch (e) {
          return 'err:' + e.message;
        }
      })();
      if (!tooSmall && !textClipped && hit === 'ok' && !offX) return;
      buttons.push({
        sel: cssSel(el),
        text,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        tooSmall,
        textClipped,
        dx, dy,
        to: st.textOverflow,
        ov: st.overflow,
        disabled: !!el.disabled,
        hit,
        offX,
        minH: st.minHeight,
      });
    });

  // 4) nav / header / modal / toast
  const chrome = {};
  ['#nav', '#header', '#toast', '#app-modal', '#start-modal'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || !isVisible(el)) {
      chrome[sel] = { present: !!el, visible: false };
      return;
    }
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    chrome[sel] = {
      present: true,
      visible: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      overflowX: el.scrollWidth - el.clientWidth,
      overflowY: el.scrollHeight - el.clientHeight,
      overflowsViewport: r.right > vw + 2 || r.left < -2,
      position: st.position,
      zIndex: st.zIndex,
    };
  });

  const navBtns = [];
  const nav = document.querySelector('#nav');
  if (nav && isVisible(nav)) {
    Array.from(nav.querySelectorAll('button'))
      .filter(isVisible)
      .forEach((b) => {
        const r = b.getBoundingClientRect();
        const text = brief(b, 16);
        navBtns.push({
          page: b.dataset.page,
          text,
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          inX: r.left >= -1 && r.right <= vw + 1,
          tooSmall: r.height < HH,
          clipped: b.scrollWidth - b.clientWidth > 2,
        });
      });
  }

  const activePage = (() => {
    const b = document.querySelector('nav button.on');
    return b ? b.dataset.page : null;
  })();
  const sectionOn = Array.from(document.querySelectorAll('section.page.on')).map((p) => p.id);

  return {
    pageLabel: pageLabel || (startTab ? 'start-modal:' + startTab : 'unknown'),
    mode,
    vw, vh,
    activePage,
    sectionOn,
    overflowPx,
    overflowDoc: overflowPx > 2,
    bodyScrollW,
    scrollW,
    clientW,
    wideEls,
    truncated: truncated.slice(0, 40),
    truncatedCount: truncated.length,
    buttons: buttons.slice(0, 40),
    buttonIssueCount: buttons.length,
    chrome,
    navBtns,
  };
};

/* ---------- 问题分级 ---------- */
function severityFor(rec, viewportName) {
  const issues = [];
  const { mode, pageLabel, overflowPx, truncated, buttons, chrome, wideEls } = rec;

  if (overflowPx > 40) {
    issues.push({
      sev: 'P0',
      kind: 'doc-overflow',
      desc: `documentElement 横向溢出 ${overflowPx}px（scrollW ${rec.scrollW} > clientW ${rec.clientW}）`,
      clue: wideEls.slice(0, 5).map((w) => `${w.sel} w=${w.w} right=${w.right}`).join(' | ') || '见 wideEls',
    });
  } else if (overflowPx > 2) {
    issues.push({
      sev: 'P1',
      kind: 'doc-overflow',
      desc: `documentElement 横向溢出 ${overflowPx}px`,
      clue: wideEls.slice(0, 4).map((w) => `${w.sel} w=${w.w}`).join(' | '),
    });
  }

  // 导航/header 溢出
  if (chrome['#nav'] && chrome['#nav'].visible && chrome['#nav'].overflowsViewport) {
    issues.push({
      sev: 'P0',
      kind: 'nav-overflow',
      desc: `#nav 超出视口 left=${chrome['#nav'].left} right=${chrome['#nav'].right}`,
      clue: '#nav',
    });
  }
  if (chrome['#header'] && chrome['#header'].visible && chrome['#header'].overflowsViewport) {
    issues.push({
      sev: 'P0',
      kind: 'header-overflow',
      desc: `#header 超出视口 left=${chrome['#header'].left} right=${chrome['#header'].right}`,
      clue: '#header',
    });
  }
  if (chrome['#app-modal'] && chrome['#app-modal'].visible && chrome['#app-modal'].overflowsViewport) {
    issues.push({
      sev: 'P0',
      kind: 'modal-overflow',
      desc: `#app-modal 超出视口`,
      clue: '#app-modal',
    });
  }
  if (chrome['#start-modal'] && chrome['#start-modal'].visible && chrome['#start-modal'].overflowX > 2) {
    // 弹窗内部横向滚动/溢出
    const ox = chrome['#start-modal'].overflowX;
    issues.push({
      sev: ox > 20 ? 'P1' : 'P2',
      kind: 'start-modal-overflow',
      desc: `#start-modal 内容横向溢出 ${ox}px`,
      clue: '#start-modal / .modal',
    });
  }

  // nav 按钮不可点
  (rec.navBtns || []).forEach((b) => {
    if (b.tooSmall) {
      issues.push({
        sev: 'P0',
        kind: 'nav-btn-small',
        desc: `导航按钮「${b.text}」高度 ${b.h}px < ${H_MIN}`,
        clue: `#nav button[data-page="${b.page}"]`,
      });
    }
    if (!b.inX) {
      issues.push({
        sev: 'P0',
        kind: 'nav-btn-offscreen',
        desc: `导航按钮「${b.text}」不在视口内 w=${b.w}`,
        clue: `#nav button[data-page="${b.page}"]`,
      });
    }
  });

  // 按钮
  buttons.forEach((b) => {
    if (b.hit && b.hit.startsWith('covered-by') && !b.disabled) {
      issues.push({
        sev: 'P1',
        kind: 'btn-covered',
        desc: `按钮「${b.text}」被 ${b.hit.replace('covered-by:', '')} 遮挡，无法点击`,
        clue: b.sel,
      });
    } else if (b.tooSmall && b.h < 28 && !b.disabled) {
      issues.push({
        sev: viewportName === 'mobile' ? 'P1' : 'P2',
        kind: 'btn-small',
        desc: `可点元素「${b.text}」高度 ${b.h}px < ${H_MIN}（${viewportName}）`,
        clue: `${b.sel} h=${b.h} minH=${b.minH}`,
      });
    } else if (b.tooSmall && viewportName === 'mobile' && b.h < 36 && !b.disabled) {
      issues.push({
        sev: 'P2',
        kind: 'btn-tap-small',
        desc: `移动端可点「${b.text}」高度 ${b.h}px < 36 触控建议`,
        clue: `${b.sel} h=${b.h}`,
      });
    }
    if (b.textClipped && b.text && b.text.length > 1) {
      const isBtn = /button|\.btn|hd-btn/i.test(b.sel);
      issues.push({
        sev: isBtn ? 'P1' : 'P2',
        kind: 'btn-text-clipped',
        desc: `可点元素文字被裁「${b.text}」 dx=${b.dx} dy=${b.dy}`,
        clue: `${b.sel} overflow=${b.ov} text-overflow=${b.to}`,
      });
    }
  });

  // 文本截断：区分关键 UI vs 次要
  truncated.forEach((t) => {
    if (!t.text || t.text.length < 2) return;
    // 表格单元格、toast、title 提示类次要
    const isKey =
      /nav|header|\.hd-name|\.btn|button|modal|h2|h3|\.stat\b|\.s-chip|tab-/i.test(t.sel) ||
      t.dy > 8; // 多行被砍
    // 纯 ellipsis 单行短词：若文字本身很长则是设计截断；仍报
    const clippedHard = t.dy > 4 || t.dx > 20;
    if (isKey && clippedHard) {
      issues.push({
        sev: 'P1',
        kind: 'text-clipped',
        desc: `文字被截断「${t.text}」 dx=${t.dx} dy=${t.dy} clamp=${t.clamp}`,
        clue: `${t.sel} | ${t.to} ${t.ov} ${t.ox}/${t.oy} w=${t.w} parent=${t.parent}`,
      });
    } else if (clippedHard) {
      issues.push({
        sev: 'P2',
        kind: 'text-ellipsis',
        desc: `文字 ellipsis/hidden 截断「${t.text}」 dx=${t.dx} dy=${t.dy}`,
        clue: `${t.sel} | ${t.to} ${t.ov} w=${t.w}`,
      });
    }
  });

  return issues;
}

/* ---------- 主流程 ---------- */
(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const findings = []; // {sev, viewport, mode, page, desc, clue, repro, shot}
  const scanTable = []; // 全页面 overflow 表
  const okNotes = [];
  const shots = [];
  const runtimeErrors = [];

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  async function openPage(vw) {
    const context = await browser.newContext({
      viewport: { width: vw.width, height: vw.height },
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => runtimeErrors.push('[pageerror] ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') runtimeErrors.push('[console.error] ' + msg.text().slice(0, 200));
    });
    page.on('dialog', async (d) => {
      try { await d.accept(); } catch (e) {}
    });
    await page.goto(BASE + '/game.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(400);
    return { context, page };
  }

  async function shot(page, name) {
    const file = path.join(SHOT_DIR, name.endsWith('.png') ? name : name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    shots.push(file);
    return file;
  }

  function pushIssues(rec, viewportName, shotPath, repro) {
    const issues = severityFor(rec, viewportName);
    issues.forEach((iss) => {
      findings.push({
        sev: iss.sev,
        viewport: viewportName,
        mode: rec.mode,
        page: rec.pageLabel,
        desc: iss.desc,
        clue: iss.clue,
        kind: iss.kind,
        shot: shotPath || '',
        repro: repro || '',
      });
    });
  }

  for (const vp of VIEWPORTS) {
    console.log('=== VIEWPORT', vp.name, vp.width + 'x' + vp.height, '===');
    const { context, page } = await openPage(vp);

    // 清档重开，保证 start modal
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    // ---- start modal ----
    const startVisible = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return !!(m && m.classList.contains('on'));
    });
    console.log('start modal visible:', startVisible);

    const startShot = await shot(page, `${vp.name}-00-start-modal`);
    if (startVisible) {
      // 各 tab
      for (const tab of ['player', 'coach', 'self', 'club', 'era']) {
        const rec = await page.evaluate(SCAN_IN_PAGE, {
          pageLabel: 'start-modal:' + tab,
          mode: 'boot',
          hMin: H_MIN,
          startTab: tab,
        });
        if (rec.error) {
          console.log('start tab error', tab, rec.error);
          continue;
        }
        const tabShot = await shot(page, `${vp.name}-start-${tab}`);
        pushIssues(
          rec,
          vp.name,
          tabShot,
          `打开 game.html → start modal → switchStartTab('${tab}')`
        );
        scanTable.push({
          viewport: vp.name,
          mode: 'boot',
          page: 'start-modal:' + tab,
          overflowPx: rec.overflowPx,
          scrollW: rec.scrollW,
          clientW: rec.clientW,
          truncated: rec.truncatedCount,
          btnIssues: rec.buttonIssueCount,
          active: rec.activePage,
        });
        console.log(`  start:${tab} overflow=${rec.overflowPx} trunc=${rec.truncatedCount} btnIssue=${rec.buttonIssueCount}`);
      }
    }

    // ---- 三种身份 ----
    for (const mode of MODES) {
      // 回到干净 start → 按身份开局
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      // 确保 start modal 打开
      await page.evaluate(() => {
        const m = document.getElementById('start-modal');
        if (m && !m.classList.contains('on')) {
          try { initStart(); } catch (e) {
            m.classList.add('on');
          }
        }
      });
      await page.waitForTimeout(200);

      // 选手/教练需先切 tab（默认 self）
      if (mode === 'player') {
        await page.evaluate(() => { try { switchStartTab('player'); } catch (e) {} });
        await page.waitForTimeout(150);
      } else if (mode === 'coach') {
        await page.evaluate(() => { try { switchStartTab('coach'); } catch (e) {} });
        await page.waitForTimeout(150);
      }

      const boot = await page.evaluate(BOOT_MODE, mode);
      await page.waitForTimeout(400);
      try { await page.evaluate(() => { try { tourSkip(); } catch (e) {} }); } catch (e) {}
      await page.waitForTimeout(200);
      console.log('BOOT', mode, JSON.stringify(boot));

      if (!boot.ok || (boot.mode && boot.mode !== mode && mode !== 'manager')) {
        // manager createTeam 不改 mode（默认 manager）
        if (!(mode === 'manager' && boot.ok)) {
          runtimeErrors.push(`boot-fail ${mode}: ${JSON.stringify(boot)}`);
        }
      }

      const pages = (MODE_PAGES[mode] || []).slice();
      // 扫 MODE_PAGES 里所有页 + 强制 goPage
      for (const pg of pages) {
        const goRes = await page.evaluate((p) => {
          try { if (typeof tourSkip === 'function') tourSkip(); } catch (e) {}
          try { goPage(p); } catch (e) { return { error: String(e.message || e) }; }
          void document.documentElement.offsetWidth;
          return { ok: true };
        }, pg);
        await page.waitForTimeout(280);
        if (goRes.error) {
          findings.push({
            sev: 'P0',
            viewport: vp.name,
            mode,
            page: pg,
            desc: `goPage('${pg}') 抛错: ${goRes.error}`,
            clue: 'goPage',
            kind: 'gopage-error',
            shot: '',
            repro: `身份 ${mode} → goPage('${pg}')`,
          });
          continue;
        }

        const rec = await page.evaluate(SCAN_IN_PAGE, {
          pageLabel: pg,
          mode,
          hMin: H_MIN,
        });

        const shotName = `${vp.name}-${mode}-${pg}`;
        const sp = await shot(page, shotName);
        pushIssues(rec, vp.name, sp, `身份 ${mode} → goPage('${pg}') @ ${vp.width}x${vp.height}`);

        scanTable.push({
          viewport: vp.name,
          mode,
          page: pg,
          overflowPx: rec.overflowPx,
          scrollW: rec.scrollW,
          clientW: rec.clientW,
          truncated: rec.truncatedCount,
          btnIssues: rec.buttonIssueCount,
          active: rec.activePage,
          sectionOn: (rec.sectionOn || []).join(','),
        });
        console.log(
          `  ${vp.name}/${mode}/${pg} overflow=${rec.overflowPx} trunc=${rec.truncatedCount} btnIssue=${rec.buttonIssueCount} active=${rec.activePage}`
        );

        // 有问题时把详细 wide/trunc 打到日志
        if (rec.overflowPx > 2 || rec.truncatedCount > 0 || rec.buttonIssueCount > 0) {
          if (rec.wideEls && rec.wideEls.length) console.log('    wide', JSON.stringify(rec.wideEls.slice(0, 4)));
          if (rec.truncated && rec.truncated.length) console.log('    trunc', JSON.stringify(rec.truncated.slice(0, 3)));
          if (rec.buttons && rec.buttons.length) console.log('    btns', JSON.stringify(rec.buttons.slice(0, 4)));
        }
      }
    }

    await context.close();
  }

  await browser.close();

  /* ---------- 汇总去重：同 kind+page+clue 只保留一次，但记录双视口 ---------- */
  const byKey = new Map();
  findings.forEach((f) => {
    const key = `${f.kind}|${f.page}|${f.clue}|${f.desc.slice(0, 60)}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...f, viewports: [f.viewport], modes: [f.mode] });
    } else {
      const e = byKey.get(key);
      if (!e.viewports.includes(f.viewport)) e.viewports.push(f.viewport);
      if (!e.modes.includes(f.mode)) e.modes.push(f.mode);
      if (!e.shot && f.shot) e.shot = f.shot;
    }
  });
  let merged = Array.from(byKey.values()).map((f) => ({
    ...f,
    viewport: f.viewports.join('+'),
    mode: f.modes.join('+'),
  }));

  // 压掉大量 P2 nav-btn-tap-smaller / btn-tap-small 噪音：只保留有截断或 <28 的
  // 但保留报告在附录
  const p2TapNoise = merged.filter((f) => f.kind === 'btn-tap-small');
  merged = merged.filter((f) => f.kind !== 'btn-tap-small');

  // 真实产品 CSS 在移动端已设 min-height 40/36，若仍 <28 才是硬伤；
  // 再过滤：btn-small 且 h>=28 的移动端建议项已在上面
  // 继续过滤：text-ellipsis 里 dx 很小且非关键（标题 title 属性等）— 保留但 P2

  const rank = { P0: 0, P1: 1, P2: 2 };
  merged.sort((a, b) => (rank[a.sev] - rank[b.sev]) || a.page.localeCompare(b.page));

  const p0 = merged.filter((f) => f.sev === 'P0');
  const p1 = merged.filter((f) => f.sev === 'P1');
  const p2 = merged.filter((f) => f.sev === 'P2');

  // 无问题的页
  const badKeys = new Set(merged.map((f) => `${f.viewport}|${f.page}`));
  // scanTable 里 overflow<=2 且 truncated=0 且 btnIssues=0
  const cleanPages = scanTable.filter(
    (r) => r.overflowPx <= 2 && r.truncated === 0 && r.btnIssues === 0
  );

  /* ---------- 写报告 ---------- */
  const lines = [];
  lines.push('# 视觉排查报告');
  lines.push('');
  lines.push(`> 生成时间：${new Date().toISOString()}`);
  lines.push(`> 目标：kpl-manager 正式版 game.html · 视口 desktop 1280×800 + mobile 390×844`);
  lines.push(`> 身份：manager / player / coach · 页：MODE_PAGES 全量 + start modal 五标签`);
  lines.push(`> 检测项：document 横向溢出 · 文字 ellipsis/hidden/line-clamp 裁切 · 按钮高度/遮挡/文字裁切 · nav/header/modal 溢出`);
  lines.push(`> 截图目录：\`.bug-hunt/visual/\``);
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push(`| 级别 | 条数 |`);
  lines.push(`|------|------|`);
  lines.push(`| P0 | ${p0.length} |`);
  lines.push(`| P1 | ${p1.length} |`);
  lines.push(`| P2 | ${p2.length} |`);
  lines.push(`| 全页面扫描点 | ${scanTable.length} |`);
  lines.push(`| 无溢出/无裁切/无按钮问题的扫描点 | ${cleanPages.length} |`);
  lines.push(`| 移动端触控建议噪声（h<36，已单列） | ${p2TapNoise.length} |`);
  lines.push(`| 运行时 console/pageerror | ${runtimeErrors.length} |`);
  lines.push('');

  function writeIssueList(title, list) {
    lines.push(`## ${title}`);
    lines.push('');
    if (!list.length) {
      lines.push('（无）');
      lines.push('');
      return;
    }
    list.forEach((f, i) => {
      const shotRel = f.shot ? path.relative(ROOT, f.shot).replace(/\\/g, '/') : '';
      lines.push(`### ${title.split(' ')[0]}-${String(i + 1).padStart(2, '0')} · ${f.kind}`);
      lines.push('');
      lines.push(`- **视口**: ${f.viewport}`);
      lines.push(`- **页面/弹窗**: ${f.page}（身份 ${f.mode}）`);
      lines.push(`- **现象**: ${f.desc}`);
      lines.push(`- **选择器/CSS线索**: \`${f.clue}\``);
      lines.push(`- **复现步骤**: ${f.repro || '见页面字段'}`);
      if (shotRel) lines.push(`- **截图**: \`${shotRel}\``);
      lines.push('');
    });
  }

  writeIssueList('P0 列表', p0);
  writeIssueList('P1 列表', p1);
  writeIssueList('P2 列表', p2);

  // top10
  const top10 = merged.slice(0, 10);
  lines.push('## Top 10 Bug');
  lines.push('');
  top10.forEach((f, i) => {
    const shotRel = f.shot ? path.relative(ROOT, f.shot).replace(/\\/g, '/') : '—';
    lines.push(`${i + 1}. **[${f.sev}]** ${f.page} @ ${f.viewport} · ${f.desc}`);
    lines.push(`   - 线索: \`${f.clue}\` · 截图: ${shotRel}`);
  });
  lines.push('');

  // 全页面 overflow 扫描表
  lines.push('## 全页面 overflow 扫描表');
  lines.push('');
  lines.push('| 视口 | 身份 | 页面 | overflowPx | scrollW/clientW | 文字裁切 | 按钮问题 | 当前 active |');
  lines.push('|------|------|------|------------|-----------------|----------|----------|-------------|');
  scanTable.forEach((r) => {
    const flag = r.overflowPx > 2 ? '⚠️' : 'ok';
    lines.push(
      `| ${r.viewport} | ${r.mode} | ${r.page} | ${r.overflowPx} ${flag} | ${r.scrollW}/${r.clientW} | ${r.truncated} | ${r.btnIssues} | ${r.active || r.sectionOn || '—'} |`
    );
  });
  lines.push('');

  lines.push('## 无问题的项简要说明');
  lines.push('');
  if (!cleanPages.length) {
    lines.push('无。');
  } else {
    // 按视口+身份分组
    const groups = {};
    cleanPages.forEach((r) => {
      const k = `${r.viewport} / ${r.mode}`;
      (groups[k] = groups[k] || []).push(r.page);
    });
    Object.keys(groups).forEach((k) => {
      lines.push(`- **${k}**: ${groups[k].join('、')} — document 无横向溢出，未检出 ellipsis/hidden 文字裁切，按钮高度≥${H_MIN} 且未被遮挡。`);
    });
  }
  lines.push('');
  if (p2TapNoise.length) {
    lines.push(`### 附：移动端触控目标建议项（h<36，非硬伤）`);
    lines.push('');
    lines.push(`共 ${p2TapNoise.length} 条，产品 CSS 已在 max-width:640px 下为 \`.btn/.btn.sm/nav button\` 设置 min-height 40/38/52；若仍低于 36 多为内联 icon chip 或表格内小控件。抽查样例：`);
    lines.push('');
    p2TapNoise.slice(0, 15).forEach((f) => {
      lines.push(`- ${f.page} @ ${f.viewport}: ${f.desc} · \`${f.clue}\``);
    });
    if (p2TapNoise.length > 15) lines.push(`- …其余 ${p2TapNoise.length - 15} 条略`);
    lines.push('');
  }

  if (runtimeErrors.length) {
    lines.push('## 运行时错误（console/pageerror）');
    lines.push('');
    const uniq = Array.from(new Set(runtimeErrors)).slice(0, 40);
    uniq.forEach((e) => lines.push(`- ${e}`));
    if (runtimeErrors.length > 40) lines.push(`- …共 ${runtimeErrors.length} 条`);
    lines.push('');
  }

  lines.push('## 方法说明');
  lines.push('');
  lines.push('1. Playwright + 本机 Chrome，`http://127.0.0.1:8931/game.html`（本地静态服务，不改产品代码）。');
  lines.push('2. 每视口：清 localStorage → 弹出 start modal → 扫 player/coach/self/club/era 五标签 → 分别用 `createTeam` / `applyCoachClub` / `createPlayerCareer` 开档。');
  lines.push('3. 每身份：`applyModeNav()` + `goPage` 遍历 `MODE_PAGES[mode]`，在 `page.evaluate` 内检测溢出/裁切/按钮并截图。');
  lines.push('4. 文字裁切判定：元素 `scrollWidth-clientWidth>2` 或 `scrollHeight-clientHeight>2`，且 computed style 含 `text-overflow:ellipsis` / `overflow:hidden` / `-webkit-line-clamp`；排除 `.tbl` 与 auto/scroll 可滚容器。');
  lines.push('5. 按钮判定：可见 `button/.btn/[onclick]` 等，高度 < 28px、文字被裁、中心点 `elementFromPoint` 被其他元素覆盖、或横向出视口。');
  lines.push('');

  fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
  console.log('REPORT', REPORT);
  console.log('SUMMARY P0=', p0.length, 'P1=', p1.length, 'P2=', p2.length, 'scanPoints=', scanTable.length);
  console.log('TOP10');
  top10.forEach((f, i) => console.log(`${i + 1}. [${f.sev}] ${f.page} @ ${f.viewport} :: ${f.desc} :: ${f.clue}`));
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
