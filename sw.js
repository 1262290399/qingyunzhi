/* ===========================================================
 * sw.js — 离线缓存
 *
 * 全部是静态文件，直接 cache-first；换版本号即可让旧缓存失效。
 * 注意：改完代码要把 VERSION 加一，否则手机上还是旧的。
 * =========================================================== */
const VERSION = 'qingyun-v1';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',

  './js/core/util.js',
  './js/core/state.js',
  './js/core/time.js',

  './js/data/realm.js',
  './js/data/terms.js',
  './js/data/names.js',
  './js/data/items.js',
  './js/data/regions.js',
  './js/data/missions.js',
  './js/data/npcs.js',
  './js/data/stories.js',
  './js/data/ranks.js',
  './js/data/buildings.js',
  './js/data/locations.js',
  './js/data/sagas.js',
  './js/data/worldevents.js',

  './js/systems/disciple.js',
  './js/systems/sect.js',
  './js/systems/auction.js',
  './js/systems/mission.js',
  './js/systems/warehouse.js',
  './js/systems/relations.js',
  './js/systems/npc.js',
  './js/systems/building.js',
  './js/systems/tournament.js',
  './js/systems/events.js',
  './js/systems/saga.js',
  './js/systems/worldevent.js',
  './js/systems/week.js',

  './js/ui/render.js',
  './js/ui/panels.js',
  './js/main.js',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // 同源才缓存
          if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
