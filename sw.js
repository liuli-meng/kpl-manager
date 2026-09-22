/* KPL 电竞经理离线缓存（PWA）——借鉴开源浏览器游戏 Goooool.net 的离线可玩模式。
 策略：导航请求 network-first（在线永远拿到最新版），失败回退缓存（断网可玩）；
 静态资源命中缓存优先。改版本号 CACHE 即可全量刷新。
 iOS Safari（WebKitBlobResourceError 1）注意：
 - 绝不缓存 !ok / opaque / 206，避免坏响应被当作文档导航结果；
 - 不拦截 blob:/data: 等非 http(s) 请求，避免下载/分享触发的 blob 导航被 SW 劫持；
 - 导航离线兜底返回显式 HTML，绝不 respondWith(undefined)。 */
const CACHE = 'kpl-mgr-v4-20260214-ios-blobfix';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function isHttpUrl(u) {
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:';
  } catch (_) { return false; }
}
/* 只缓存同源、完整、成功的响应；opaque/error/206 一律不进 CacheStorage */
function isCacheable(r) {
  return !!(r && r.ok && r.status === 200 && (r.type === 'basic' || r.type === 'default'));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* blob:/data:/filesystem: 等交给浏览器默认处理——SW 介入会变成 WebKitBlobResourceError */
  if (!isHttpUrl(req.url)) return;

  const isNav = req.mode === 'navigate' || req.destination === 'document';

  if (isNav) {
    // 导航：强制 network-first + 禁用 HTTP 缓存，避免微信/系统 WebView 拿到旧包
    e.respondWith(
      fetch(req, { cache: 'no-store', redirect: 'follow' })
        .then(r => {
          if (isCacheable(r)) {
            const cp = r.clone();
            caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
          }
          return r;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then(m =>
            (m && m.ok) ? m : caches.match('./').then(root =>
              (root && root.ok) ? root : new Response(
                '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>离线</title></head><body><p>当前离线，且无可用缓存。请联网后刷新。</p></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              )
            )
          )
        )
    );
    return;
  }

  // 静态资源：缓存优先，未命中再网络并只写入可缓存响应
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(r => {
        if (isCacheable(r)) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
        }
        return r;
      });
    })
  );
});
