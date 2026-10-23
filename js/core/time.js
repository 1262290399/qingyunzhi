/* ===========================================================
 * time.js — 实时游戏循环
 *
 * 从「点按钮结算一年」改成「时间自然流逝」：
 *   - 每 WEEK_MS 毫秒推进一年（1 倍速），倍速会等比缩短
 *   - 倍速支持 0(暂停) / 1 / 2 / 4
 *   - 每年结算产生的事件不一次性倾倒，而是进入播报队列，
 *     在这一年内匀速"播"进动态流，让它看起来像在持续发生
 *   - 离开页面时记下时间戳，回来后按离线时长补算
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;

  const WEEK_MS = 20000;      // 1 倍速下一年所需的真实毫秒
  const SPEEDS = [0, 1, 2, 4];
  const OFFLINE_EFF = 0.5;    // 离线收益效率
  const OFFLINE_CAP = 24;     // 离线最多补算多少年
  const OFFLINE_MIN_GAP = 60000; // 离开超过 1 分钟才补算
  const MAX_FEED = 200;

  const t = {
    speed: 1,
    lastSpeed: 1,
    acc: 0,               // 当前年内累计的游戏毫秒
    queue: [],            // 待播事件
    popAcc: 0,
    popInterval: 900,     // 每多少毫秒播一条
    lastFrame: 0,
    feed: [],             // 动态流数据源
    lastFeedWeek: 0,
    started: false,
    lastSeenSave: 0,
    onWeek: null,
    onFeed: null,
  };

  // ---------------- 状态查询 ----------------
  const progress = () => U.clamp(t.acc / WEEK_MS, 0, 1);
  const isPaused = () => t.speed === 0;

  // ---------------- 倍速 ----------------
  function setSpeed(n) {
    n = Number(n);
    if (!SPEEDS.includes(n)) return;
    if (n > 0) t.lastSpeed = n;
    const wasRunning = t.speed > 0;
    t.speed = n;
    // 播报速度跟着倍速走，保证一年内能播完
    t.popInterval = n > 0 ? 900 / n : 900;

    // 暂停瞬间把"最后在线时间"落盘：
    // 暂停期间离开页面不应该拿到离线收益
    if (n === 0 && wasRunning) {
      const st = S.state.data;
      if (st) {
        st.lastSeen = Date.now();
        S.state.save(true);
      }
    }

    if (S.ui && S.ui.updateSpeedUI) S.ui.updateSpeedUI();
  }

  function togglePause() {
    setSpeed(t.speed > 0 ? 0 : (t.lastSpeed || 1));
    return t.speed;
  }

  // ---------------- 动态流 ----------------
  function feedEntry(entry) {
    if (t.lastFeedWeek !== entry.week) {
      t.feed.push({ week: entry.week, divider: true });
      t.lastFeedWeek = entry.week;
    }
    t.feed.push(entry);
    if (t.feed.length > MAX_FEED) t.feed.splice(0, t.feed.length - MAX_FEED);
    if (t.onFeed) t.onFeed(entry);
  }

  function enqueueReport(report) {
    for (const e of report.entries) {
      t.queue.push({ text: e.text, kind: e.kind, discipleId: e.discipleId || null, week: report.week });
    }
  }

  /** 清空队列和动态流（重开山门时用） */
  function reset() {
    t.acc = 0;
    t.queue.length = 0;
    t.popAcc = 0;
    t.feed.length = 0;
    t.lastFeedWeek = 0;
    t.lastFrame = 0;
  }

  // ---------------- 一年结算 ----------------
  function doWeek(st) {
    let report;
    try {
      report = S.systems.week.advanceWeek(st);
    } catch (err) {
      console.error('年结算异常', err);
      if (S.ui && S.ui.toast) S.ui.toast('结算出错：' + err.message, 'err');
      return null;
    }
    enqueueReport(report);
    if (t.onWeek) t.onWeek(report);
    return report;
  }

  // ---------------- 主循环 ----------------
  function loop(ts) {
    requestAnimationFrame(loop);

    const st = S.state.data;
    if (!st) return;

    if (!t.lastFrame) t.lastFrame = ts;
    let dt = ts - t.lastFrame;
    t.lastFrame = ts;

    // 切标签页/最小化回来时 rAF 会停很久，不补偿，避免瞬间跳几十年
    if (dt < 0) dt = 0;
    if (dt > 500) dt = 500;

    if (t.speed > 0) {
      t.acc += dt * t.speed;

      let guard = 0;
      while (t.acc >= WEEK_MS && guard++ < 8) {
        t.acc -= WEEK_MS;
        doWeek(st);
      }

      // 事件播报
      t.popAcc += dt;
      let popGuard = 0;
      while (t.popAcc >= t.popInterval && t.queue.length && popGuard++ < 12) {
        t.popAcc -= t.popInterval;
        feedEntry(t.queue.shift());
      }
      // 队列空了就把多余的累积清掉，避免来年开头喷一堆
      if (!t.queue.length) t.popAcc = 0;

      // 定期记下"我还活着"，供离线结算算时长
      const now = Date.now();
      if (now - t.lastSeenSave > 5000) {
        st.lastSeen = now;
        t.lastSeenSave = now;
      }
    }

    if (S.ui && S.ui.updateProgress) S.ui.updateProgress();
  }

  function start() {
    if (t.started) return;
    t.started = true;
    t.lastFrame = 0;
    requestAnimationFrame(loop);
  }

  // =========================================================
  //  离线结算
  // =========================================================
  const HIGHLIGHT_KINDS = ['breakthrough', 'danger', 'fortune', 'sect', 'recruit', 'conflict'];

  /**
   * 回到页面时补算离线时长。
   * 返回 null 表示没有值得报告的离线收益。
   */
  function offlineSettle(st) {
    const now = Date.now();
    const last = st.lastSeen || now;
    const gap = now - last;
    if (gap < OFFLINE_MIN_GAP) return null;

    const rawWeeks = (gap / WEEK_MS) * OFFLINE_EFF;
    const weeks = Math.min(Math.floor(rawWeeks), OFFLINE_CAP);
    if (weeks < 1) return null;

    const weekFrom = st.week + 1;
    const highlights = [];
    const recent = [];
    const before = { disciples: st.disciples.length, level: st.sect.level };

    for (let i = 0; i < weeks; i++) {
      const rep = S.systems.week.advanceWeek(st, { silent: true });
      for (const e of rep.entries) {
        const item = {
          text: e.text,
          kind: e.kind,
          discipleId: e.discipleId || null,
          week: rep.week,
        };
        recent.push(item);
        if (HIGHLIGHT_KINDS.includes(e.kind)) highlights.push(item);
      }
    }

    // 让动态流接上离线期间最后发生的事，否则回来是一片空白
    for (const e of recent.slice(-12)) feedEntry(e);

    S.state.save(true);

    return {
      weeks,
      gapMs: gap,
      weekFrom,
      weekTo: st.week - 1,
      highlights: highlights.slice(-20),
      discipleDelta: st.disciples.length - before.disciples,
      levelDelta: st.sect.level - before.level,
    };
  }

  function describeGap(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} 分钟`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
    const d = Math.floor(h / 24);
    return `${d} 天`;
  }

  // 暴露
  t.WEEK_MS = WEEK_MS;
  t.SPEEDS = SPEEDS;
  t.OFFLINE_CAP = OFFLINE_CAP;

  S.time = {
    state: t,
    WEEK_MS, SPEEDS, OFFLINE_EFF, OFFLINE_CAP,
    progress, isPaused, setSpeed, togglePause,
    start, reset, doWeek,
    offlineSettle, describeGap,
    feedEntry,
  };
})(window.Sect);
