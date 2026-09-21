/* 深挖：coach market 遮挡、train s-chip 横向出界、start modal 按钮、底部 nav 遮挡、header */
const path = require('path');
const { chromium } = require('E:/sex/.workbuddy/tmp/node_modules/playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:8931';
const SHOT = 'E:\\sex\\kpl-manager\\.bug-hunt\\visual';

const PROBE = (arg) => {
  const { kind } = arg;
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = { kind, vw, vh, items: [] };

  const cssSel = (el) => {
    if (!el) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string')
      s += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    return s;
  };
  const isVisible = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null || st.position === 'fixed';
  };

  if (kind === 'coach-market-cover') {
    // 找「立即租借/申请租借」按钮，看祖先链与 elementFromPoint
    const btns = Array.from(document.querySelectorAll('#page-market button')).filter(b =>
      /租借|助教|解雇/.test(b.textContent || '')
    );
    btns.slice(0, 8).forEach((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let hit = null;
      if (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh) {
        const h = document.elementFromPoint(cx, cy);
        hit = h ? { sel: cssSel(h), text: (h.textContent || '').slice(0, 30), same: h === b || b.contains(h) } : null;
      } else {
        hit = { offscreen: true, top: r.top, bottom: r.bottom };
      }
      // 祖先链 z-index / position
      let anc = b.parentElement, chain = [];
      for (let i = 0; i < 6 && anc; i++) {
        const st = getComputedStyle(anc);
        chain.push({
          sel: cssSel(anc),
          pos: st.position,
          z: st.zIndex,
          ov: st.overflow,
          h: Math.round(anc.getBoundingClientRect().height),
        });
        anc = anc.parentElement;
      }
      out.items.push({
        btn: (b.textContent || '').trim().slice(0, 20),
        sel: cssSel(b),
        rect: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        hit,
        chain,
        parentHtml: b.parentElement ? b.parentElement.outerHTML.slice(0, 200) : null,
        panel: (() => {
          const p = b.closest('.panel, .match, .pcard, section');
          if (!p) return null;
          const pr = p.getBoundingClientRect();
          return { sel: cssSel(p), t: Math.round(pr.top), h: Math.round(pr.height), ch: p.clientHeight, sh: p.scrollHeight, ov: getComputedStyle(p).overflow };
        })(),
      });
    });
  }

  if (kind === 'train-chips') {
    const chips = Array.from(document.querySelectorAll('#page-train .s-chip, #page-train button')).filter(isVisible);
    chips.slice(0, 20).forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      out.items.push({
        sel: cssSel(el),
        text: (el.textContent || '').trim().slice(0, 16),
        l: Math.round(r.left * 10) / 10,
        r: Math.round(r.right * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        offX: r.left < -2 || r.right > vw + 2,
        parent: cssSel(el.parentElement),
        parentOverflow: el.parentElement ? getComputedStyle(el.parentElement).overflow : null,
        parentScrollW: el.parentElement ? el.parentElement.scrollWidth : null,
        parentClientW: el.parentElement ? el.parentElement.clientWidth : null,
      });
    });
  }

  if (kind === 'start-modal') {
    const m = document.getElementById('start-modal');
    const body = document.getElementById('start-modal-body');
    const mr = m.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    const bst = getComputedStyle(body);
    out.modal = {
      on: m.classList.contains('on'),
      bodyRect: { t: Math.round(br.top), l: Math.round(br.left), w: Math.round(br.width), h: Math.round(br.height), b: Math.round(br.bottom) },
      scrollH: body.scrollHeight, clientH: body.clientHeight,
      overflowY: bst.overflowY, maxH: bst.maxHeight,
      contentOverflowY: body.scrollHeight - body.clientHeight,
      overflowsViewportBottom: br.bottom > vh + 2,
      overflowsViewportRight: br.right > vw + 2,
    };
    // 五 tab 按钮 + 主 CTA
    const sels = ['#tab-player', '#tab-coach', '#tab-self', '#tab-club', '#tab-era',
      '#coach-apply-btn', '#club-apply-btn', '#era-apply-btn',
      'button[onclick="createTeam()"]', 'button[onclick="createPlayerCareer()"]'];
    sels.forEach((s) => {
      const el = document.querySelector(s);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      out.items.push({
        sel: s,
        text: (el.textContent || '').trim().slice(0, 20),
        w: Math.round(r.width), h: Math.round(r.height),
        t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), rgt: Math.round(r.right),
        minH: st.minHeight,
        visible: isVisible(el) && r.height > 0,
        tooSmall: r.height < 28,
        offBottom: r.bottom > vh,
        offRight: r.right > vw,
        disabled: !!el.disabled,
      });
    });
  }

  if (kind === 'nav-cover') {
    // 底部 nav 遮挡：页面最后一个可点元素是否在 nav 下方
    const nav = document.getElementById('nav');
    const nr = nav.getBoundingClientRect();
    const nst = getComputedStyle(nav);
    out.nav = {
      pos: nst.position,
      t: Math.round(nr.top), h: Math.round(nr.height), b: Math.round(nr.bottom),
      vh,
      buttons: Array.from(nav.querySelectorAll('button')).filter(b => b.style.display !== 'none').map(b => {
        const r = b.getBoundingClientRect();
        return { p: b.dataset.page, text: (b.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right) };
      }),
    };
    // body/wrap padding-bottom
    const wrap = document.querySelector('.wrap');
    const body = document.body;
    out.padding = {
      bodyPB: getComputedStyle(body).paddingBottom,
      wrapPB: wrap ? getComputedStyle(wrap).paddingBottom : null,
      footerPB: (() => { const f = document.querySelector('footer'); return f ? getComputedStyle(f).paddingBottom : null; })(),
    };
    // 被 nav 盖住的可点元素（中心点落在 nav 上）
    const cover = [];
    Array.from(document.querySelectorAll('section.page.on button, section.page.on .btn, section.page.on [onclick]')).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cy < nr.top || cy > nr.bottom) return;
      if (cx < nr.left || cx > nr.right) return;
      const h = document.elementFromPoint(cx, cy);
      if (!h) return;
      const covered = !(el.contains(h) || h.contains(el));
      if (covered || (h.closest && h.closest('#nav'))) {
        cover.push({
          sel: cssSel(el),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
          t: Math.round(r.top), b: Math.round(r.bottom),
          hit: cssSel(h),
        });
      }
    });
    out.coveredByNav = cover;
  }

  if (kind === 'header') {
    const h = document.getElementById('header');
    const r = h.getBoundingClientRect();
    const st = getComputedStyle(h);
    out.header = {
      w: Math.round(r.width), h: Math.round(r.height),
      scrollW: h.scrollWidth, clientW: h.clientWidth,
      overflowX: h.scrollWidth - h.clientWidth,
      pos: st.position, top: st.top, z: st.zIndex,
      overflowsRight: r.right > vw + 2,
    };
    // header 内文字/按钮
    Array.from(h.querySelectorAll('*')).forEach((el) => {
      const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent || '').trim());
      if (!hasText && !el.matches('button,.btn')) return;
      const er = el.getBoundingClientRect();
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      if (dx > 2 || dy > 2 || er.height < 24 && el.matches('button,.btn')) {
        out.items.push({
          sel: cssSel(el),
          text: (el.textContent || '').trim().slice(0, 40),
          dx, dy,
          w: Math.round(er.width), h: Math.round(er.height),
          to: getComputedStyle(el).textOverflow,
          ov: getComputedStyle(el).overflow,
        });
      }
    });
  }

  if (kind === 'tname-ellipsis') {
    // 所有 .tname / span.tname 截断样例
    Array.from(document.querySelectorAll('.tname, .vs-tname, .vs .tname')).forEach((el) => {
      const st = getComputedStyle(el);
      const dx = el.scrollWidth - el.clientWidth;
      if (dx <= 2) return;
      const r = el.getBoundingClientRect();
      out.items.push({
        sel: cssSel(el),
        text: (el.textContent || '').trim().slice(0, 50),
        dx,
        w: Math.round(r.width),
        parent: cssSel(el.parentElement),
        parentW: el.parentElement ? Math.round(el.parentElement.getBoundingClientRect().width) : null,
        to: st.textOverflow,
        fontSize: st.fontSize,
      });
    });
  }

  return out;
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  async function open(vw, vh) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'zh-CN' });
    const page = await ctx.newPage();
    page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });
    await page.goto(BASE + '/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    return { ctx, page };
  }

  const results = {};

  for (const [vpName, vw, vh] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
    const { ctx, page } = await open(vw, vh);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // start modal 各 tab
    results[vpName + ':start'] = {};
    for (const tab of ['player', 'coach', 'self', 'club', 'era']) {
      await page.evaluate((t) => { switchStartTab(t); }, tab);
      await page.waitForTimeout(150);
      const r = await page.evaluate(PROBE, { kind: 'start-modal' });
      results[vpName + ':start'][tab] = r;
      if (tab === 'coach' || tab === 'player' || tab === 'self') {
        await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-start-${tab}.png`) });
      }
    }

    // coach 开档 → market
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { switchStartTab('coach'); pickCoachClub(0); applyCoachClub(); try { tourSkip(); } catch (e) {} });
    await page.waitForTimeout(400);

    await page.evaluate(() => { goPage('market'); try { tourSkip(); } catch (e) {} });
    await page.waitForTimeout(300);
    results[vpName + ':coach-market-cover'] = await page.evaluate(PROBE, { kind: 'coach-market-cover' });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-coach-market.png`) });

    await page.evaluate(() => goPage('train'));
    await page.waitForTimeout(250);
    results[vpName + ':train-chips'] = await page.evaluate(PROBE, { kind: 'train-chips' });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-train.png`) });

    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(250);
    results[vpName + ':league-tname'] = await page.evaluate(PROBE, { kind: 'tname-ellipsis' });
    results[vpName + ':league-header'] = await page.evaluate(PROBE, { kind: 'header' });
    results[vpName + ':league-nav'] = await page.evaluate(PROBE, { kind: 'nav-cover' });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-league.png`) });

    // manager market 文字
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const n = document.getElementById('new-team-name');
      if (n) n.value = '视觉扫雷';
      createTeam(); try { tourSkip(); } catch (e) {}
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(300);
    results[vpName + ':mgr-market-tname'] = await page.evaluate(PROBE, { kind: 'tname-ellipsis' });
    results[vpName + ':mgr-club-header'] = await page.evaluate(PROBE, { kind: 'header' });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-mgr-market.png`) });

    await page.evaluate(() => goPage('union'));
    await page.waitForTimeout(250);
    results[vpName + ':union-nav'] = await page.evaluate(PROBE, { kind: 'nav-cover' });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-union.png`) });

    // toast 测试
    await page.evaluate(() => { toast('这是一条用于视觉排查的 toast 提示，字数故意写得比较长以观察是否截断或溢出视口'); });
    await page.waitForTimeout(200);
    results[vpName + ':toast'] = await page.evaluate(() => {
      const t = document.getElementById('toast');
      const r = t.getBoundingClientRect();
      return {
        text: (t.textContent || '').slice(0, 80),
        l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height),
        vw: window.innerWidth,
        overflows: r.right > window.innerWidth + 2 || r.left < -2,
        scrollW: t.scrollWidth, clientW: t.clientWidth,
        clipped: t.scrollWidth - t.clientWidth > 2,
        cls: t.className,
      };
    });
    await page.screenshot({ path: path.join(SHOT, `${vpName}-probe-toast.png`) });

    await ctx.close();
  }

  await browser.close();
  require('fs').writeFileSync(
    'E:\\sex\\kpl-manager\\.bug-hunt\\probe-deep.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
