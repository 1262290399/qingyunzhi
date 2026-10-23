/* ===========================================================
 * util.js — 基础工具
 * 所有模块挂在全局 window.Sect 下，按 <script> 顺序加载。
 * =========================================================== */
window.Sect = window.Sect || {};

(function (S) {
  'use strict';

  // ---------- 随机 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  /** 从数组里按权重取一个。items = [{w: 权重, ...}] 或 [value, weight] */
  function weighted(items, weightOf) {
    const wf = weightOf || ((it) => it.w);
    let total = 0;
    for (const it of items) total += Math.max(0, wf(it));
    if (total <= 0) return items[0];
    let r = Math.random() * total;
    for (const it of items) {
      r -= Math.max(0, wf(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** 不放回抽 n 个 */
  function sample(arr, n) {
    const copy = arr.slice();
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
    }
    return out;
  }

  // ---------- 数值 ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, d) => {
    const m = Math.pow(10, d || 0);
    return Math.round(v * m) / m;
  };

  /** 12345 -> "1.2万" */
  function fmt(n) {
    n = Math.round(n);
    if (Math.abs(n) < 10000) return String(n);
    if (Math.abs(n) < 100000000) return round(n / 10000, 1) + '万';
    return round(n / 100000000, 2) + '亿';
  }

  // ---------- 其它 ----------
  let _uid = 0;
  const uid = (prefix) => (prefix || 'id') + '_' + (Date.now().toString(36)) + '_' + (++_uid);

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** 带符号的百分比，如 +25% */
  const pct = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';

  /** 深拷贝（纯数据） */
  const clone = (o) => JSON.parse(JSON.stringify(o));

  S.util = {
    rand, randInt, pick, chance, weighted, sample,
    clamp, round, fmt, uid, shuffle, pct, clone,
  };
})(window.Sect);
