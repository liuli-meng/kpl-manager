/* KPL 电竞经理离线缓存（PWA）——借鉴开源浏览器游戏 Goooool.net 的离线可玩模式。
 策略：导航请求 network-first（在线永远拿到最新版），失败回退缓存（断网可玩）；
 静态资源命中缓存优先。改版本号 CACHE 即可全量刷新。 */
const CACHE = 'kpl-mgr-v2-20260905';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // 导航 / 主文档：强制 network-first，并禁用 HTTP 缓存，避免微信/系统 WebView 拿到旧包
  const isNav = e.request.mode === 'navigate' || e.request.destination === 'document';
  e.respondWith(
    fetch(e.request, isNav ? { cache: 'no-store' } : undefined)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match('./')))
  );
});
