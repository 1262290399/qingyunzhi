/* ===========================================================
 * state.js — 全局状态、初始化、存档
 * =========================================================== */
(function (S) {
  'use strict';

  const SAVE_KEY = 'sect_sim_save_v2';
  const U = S.util;

  /** 建筑/宗门等级带来的弟子上限 */
  const CAPACITY_BY_LEVEL = [3, 5, 7, 10, 13, 16, 20, 24, 28, 32];

  const CAPACITY_BY_LEVEL_FN = (lv) =>
    CAPACITY_BY_LEVEL[Math.min(lv - 1, CAPACITY_BY_LEVEL.length - 1)] + Math.max(0, lv - 10) * 4;

  /** 名望升级门槛 */
  const REP_FOR_LEVEL = (lv) => Math.round(28 * Math.pow(lv, 1.5));

  function newSect(level) {
    return {
      name: U.pick(S.names.SECT_NAMES),
      level: level || 1,
      scale: 0,              // 规模：决定收多少人
      location: 'houshan',   // 驻地：决定一套得失
      spiritStones: 3200,
      reputation: 0,
      foundedWeek: 1,
      // 累计统计，供年报与成就用
      totalMissions: 0,
      totalLoot: 0,
      totalRecruited: 0,
      totalDeaths: 0,
    };
  }

  function initNewGame(opts) {
    opts = opts || {};
    const level = opts.level || 1;
    const st = {
      version: 2,
      week: 1,
      phase: 'playing', // playing | gameover
      lastSeen: Date.now(),
      sect: newSect(level),
      disciples: [],
      warehouse: {},
      auction: [],
      missions: [],
      candidates: [],
      npcs: {},          // 江湖人物：{ npcId: { sectFavor, discipleFavor, met, lastWeek } }
      reports: [],
      pending: [],      // 待并入本年年报的事件
      activeMap: null,  // 当前查看的地图区域（纯 UI 态）
      log: [],          // 全局滚动日志（最近 200 条）
      stats: {
        weeksPlayed: 0,
        stonesEarned: 0,
        stonesSpent: 0,
        bestRealm: 0,
      },
      settings: { autoSave: true, autoFill: false },
      ui: { reportSeen: 0 },
      // 宗门纪事：传承谁拿过、主线打到哪，死人也留名
      legacyLog: [],
    };

    // 初始弟子：一名大师兄/大师姐
    const first = S.disciple.create({ realm: 2, quality: 'starter' });
    first.loyalty = 82;
    first.joinWeek = 1;
    first.rank = 'outer';       // 开山就在的老人，直接算外门
    st.disciples.push(first);

    // 初始仓库
    st.warehouse = { liaoshangdan: 3, juqisan: 4, yunlingcao: 2, huxinfu: 1 };

    // 初始候选（避免重名）—— 都记下"什么时候来的"，不然会在门口站一辈子
    const takenNames = new Set(st.disciples.map((d) => d.name));
    const c1 = S.disciple.makeCandidate(takenNames);
    c1.candidateWeek = 1;
    takenNames.add(c1.name);
    const c2 = S.disciple.makeCandidate(takenNames);
    c2.candidateWeek = 1;
    st.candidates = [c1, c2];

    // 初始建筑：后山那几畦灵田，开山的时候就垦出来了
    S.systems.building.init(st);
    st.buildings.lingtian.level = 1;

    // 大事件与主线
    S.systems.worldevent.init(st);

    // 首次刷新
    S.systems.auction.refresh(st);
    S.systems.mission.refresh(st);

    return st;
  }

  // ---------------- 存档 ----------------
  function storageOk() {
    try {
      const k = '__t__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  let _lastSaveAt = 0;

  /**
   * 存档。默认做 1.2 秒节流——实时模式下每年都会结算，
   * 不节流的话 localStorage 写入会过于频繁。
   */
  function save(force) {
    const now = Date.now();
    if (!force && now - _lastSaveAt < 1200) return true;
    _lastSaveAt = now;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state.data));
      return true;
    } catch (e) {
      console.warn('存档失败', e);
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.sect) return null;
      return migrate(data);
    } catch (e) {
      console.warn('读档失败', e);
      return null;
    }
  }

  function hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
  }

  /** 旧档字段补齐 */
  function migrate(d) {
    d.version = d.version || 2;
    if (!d.lastSeen) d.lastSeen = Date.now();
    d.pending = d.pending || [];
    d.reports = d.reports || [];
    d.candidates = d.candidates || [];
    d.npcs = d.npcs || {};
    d.log = d.log || [];
    d.stats = d.stats || { weeksPlayed: 0, stonesEarned: 0, stonesSpent: 0, bestRealm: 0 };
    d.stats.tournaments = d.stats.tournaments || 0;
    d.settings = d.settings || { autoSave: true, autoFill: false };
    if (d.settings.autoFill === undefined) d.settings.autoFill = false;
    d.ui = d.ui || { reportSeen: 0 };
    if (d.ui.reportSeen === undefined) d.ui.reportSeen = 0;

    // 宗门：规模与驻地是后加的字段
    if (d.sect) {
      if (d.sect.scale === undefined) {
        // 旧档按原来的等级折算一个规模，别让老玩家一夜回到茅庐
        const lv = d.sect.level || 1;
        d.sect.scale = lv >= 8 ? 4 : lv >= 6 ? 3 : lv >= 4 ? 2 : lv >= 2 ? 1 : 0;
      }
      if (!d.sect.location) d.sect.location = 'houshan';
      if (d.sect.totalDeaths === undefined) d.sect.totalDeaths = 0;
    }
    d.lastTournament = d.lastTournament || null;

    // 建筑
    d.buildings = d.buildings || {};
    if (S.buildings) {
      for (const def of S.buildings.BUILDINGS) {
        if (!d.buildings[def.id]) d.buildings[def.id] = { level: 0, occupants: [] };
        if (!Array.isArray(d.buildings[def.id].occupants)) d.buildings[def.id].occupants = [];
      }
    }
    // 开山时不送建筑的话，旧档会什么都没有——补一座灵田
    if (!Object.values(d.buildings).some((b) => b.level > 0)) {
      d.buildings.lingtian = d.buildings.lingtian || { level: 0, occupants: [] };
      d.buildings.lingtian.level = 1;
    }

    for (const p of d.disciples) {
      p.history = p.history || [];
      p.recent = p.recent || [];
      p.bonds = p.bonds || {};
      // 旧存档的 bonds 是纯数字，升级成关系结构体
      for (const k of Object.keys(p.bonds)) {
        const b = p.bonds[k];
        if (typeof b === 'number') {
          p.bonds[k] = {
            score: b,
            state: S.relations ? S.relations.stateOf(b).id : 'stranger',
            since: 0,
            flags: [],
          };
        } else if (b && !b.flags) {
          b.flags = [];
        }
      }
      p.loverId = p.loverId || null;
      p.loveTarget = p.loveTarget || null;
      p.infoBonus = p.infoBonus || 0;
      p.guard = p.guard || 0;
      p.breakBonus = p.breakBonus || 0;
      p.mood = p.mood === undefined ? 60 : p.mood;
      p.injureWeeks = p.injureWeeks || 0;
      p.status = p.status || 'idle';
      p.contribution = p.contribution || 0;
      // 旧档没有身份与技艺：按"已经是正式弟子"处理，别让老玩家一夜回到杂役
      p.rank = p.rank || 'outer';
      p.skills = p.skills || { alchemy: 25, forging: 25, trade: 25, leadership: 25 };
      p.homeBuilding = p.homeBuilding || null;
    }
    // 年报条目补 meta 字段
    for (const r of d.reports) {
      for (const e of r.entries || []) {
        if (e.meta === undefined) e.meta = '';
      }
    }
    return d;
  }

  // ---------------- 日志 ----------------
  const MAX_LOG = 300;

  function addLog(text, kind) {
    const entry = { week: state.data.week, text, kind: kind || 'info' };
    state.data.log.push(entry);
    if (state.data.log.length > MAX_LOG) state.data.log.splice(0, state.data.log.length - MAX_LOG);
    return entry;
  }

  /** 写入本年年报（年推进结束后打包） */
  function pending(text, kind, discipleId) {
    state.data.pending.push({ text, kind: kind || 'info', discipleId: discipleId || null });
  }

  // ---------------- 资源操作 ----------------
  function addStones(n, reason) {
    state.data.sect.spiritStones += n;
    if (n > 0) state.data.stats.stonesEarned += n;
    else state.data.stats.stonesSpent += -n;
    return state.data.sect.spiritStones;
  }

  function addRep(n) {
    // 驻地影响名声涨得多快（皇城脚下自然传得快）
    if (n > 0 && S.locations && state.data) {
      n = Math.round(n * (S.locations.effectsOf(state.data).repMul || 1));
    }
    state.data.sect.reputation += n;
    checkLevelUp();
  }

  /**
   * 刷新宗门等级。
   * 等级不再是"攒声望就升"，而是声望与最强弟子实力共同评定——
   * 一个没有强者的宗门，名声再响也只是空架子。
   */
  function checkLevelUp() {
    if (!S.sect) return;
    const g = S.sect.refreshGrade(state.data);
    if (g) {
      addLog(`宗门评定升为 ${g} 级。`, 'sect');
      pending(`【宗门评定】声望与实力俱到，宗门升为 ${g} 级。`, 'sect');
    }
  }

  /** 能收多少弟子：看规模与驻地，与等级无关 */
  function capacity() {
    if (!state.data) return 4;
    if (S.sect) return S.sect.capacityOf(state.data);
    return 4;
  }

  function warehouseAdd(itemId, count) {
    const w = state.data.warehouse;
    w[itemId] = (w[itemId] || 0) + (count || 1);
    return w[itemId];
  }

  function warehouseTake(itemId, count) {
    const w = state.data.warehouse;
    count = count || 1;
    if ((w[itemId] || 0) < count) return false;
    w[itemId] -= count;
    if (w[itemId] <= 0) delete w[itemId];
    return true;
  }

  function warehouseCount(itemId) {
    return state.data.warehouse[itemId] || 0;
  }

  function discipleById(id) {
    return state.data.disciples.find((d) => d.id === id) || null;
  }

  /**
   * 唯一的全局状态对象。内部闭包函数与对外接口共用同一个引用，
   * 否则 S.state.data = xxx 会写到一个孤儿对象上。
   */
  const state = {
    SAVE_KEY, CAPACITY_BY_LEVEL_FN, REP_FOR_LEVEL,
    data: null,
    initNewGame,
    save, load, hasSave, clearSave, storageOk, migrate,
    addLog, pending,
    addStones, addRep, checkLevelUp, capacity,
    warehouseAdd, warehouseTake, warehouseCount,
    discipleById,
  };

  S.state = state;
})(window.Sect);
