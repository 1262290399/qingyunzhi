/* ===========================================================
 * relations.js — 弟子之间的关系
 *
 * 关系分三层：
 *   1. score   好感度 -100 ~ 100（会自然向 0 衰减）
 *   2. state   由 score 推导的阶段（陌路/相识/好友/知己/不和/仇敌/死敌）
 *   3. flags   特殊关系（'lover' 道侣、'sworn' 结义）——需要专门事件才能确立/解除
 *
 * 道侣和结义是"双向确认"的：只有一方好感高不算。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;

  const STAGES = [
    { id: 'nemesis',      name: '死敌',     min: -100, max: -65, cls: 'rel-nemesis' },
    { id: 'enemy',        name: '仇敌',     min: -64,  max: -30, cls: 'rel-enemy' },
    { id: 'rival',        name: '不和',     min: -29,  max: -8,  cls: 'rel-rival' },
    { id: 'stranger',     name: '陌路',     min: -7,   max: 9,   cls: 'rel-stranger' },
    { id: 'acquaintance', name: '相识',     min: 10,  max: 29,  cls: 'rel-acq' },
    { id: 'friend',       name: '好友',     min: 30,  max: 59,  cls: 'rel-friend' },
    { id: 'close',        name: '知己',     min: 60,  max: 84,  cls: 'rel-close' },
    { id: 'sworn',        name: '生死之交', min: 85,  max: 100, cls: 'rel-sworn' },
  ];

  const BY_ID = {};
  for (const s of STAGES) BY_ID[s.id] = s;

  const LOVER = { id: 'lover', name: '道侣', cls: 'rel-lover' };
  const SWORN_FLAG = { id: 'swornflag', name: '结义', cls: 'rel-sworn' };

  function stateOf(score) {
    if (score <= -65) return BY_ID.nemesis;
    if (score <= -30) return BY_ID.enemy;
    if (score <= -8) return BY_ID.rival;
    if (score < 10) return BY_ID.stranger;
    if (score < 30) return BY_ID.acquaintance;
    if (score < 60) return BY_ID.friend;
    if (score < 85) return BY_ID.close;
    return BY_ID.sworn;
  }

  /** 取（必要时创建）单向关系 */
  function get(d, otherId) {
    if (!d.bonds) d.bonds = {};
    let b = d.bonds[otherId];
    if (typeof b === 'number') {
      // 兼容旧存档：数字 -> 结构体
      b = { score: b, state: stateOf(b).id, since: 0, flags: [] };
      d.bonds[otherId] = b;
    }
    if (!b) {
      b = { score: 0, state: 'stranger', since: 0, flags: [] };
      d.bonds[otherId] = b;
    }
    if (!b.flags) b.flags = [];
    return b;
  }

  const score = (d, otherId) => get(d, otherId).score;

  function label(d, otherId) {
    const b = get(d, otherId);
    if (b.flags.includes('lover')) return LOVER;
    if (b.flags.includes('sworn')) return SWORN_FLAG;
    return stateOf(b.score);
  }

  const isLover = (a, b) => get(a, b.id).flags.includes('lover');
  const isSworn = (a, b) => get(a, b.id).flags.includes('sworn');
  const isHostile = (d, otherId) => get(d, otherId).score <= -8;

  /**
   * 改变 A 对 B 的好感。返回 { crossed, from, to }，crossed 为真表示阶段发生了变化。
   *
   * 好感增长有边际递减：越亲近越难再进一步，
   * 否则线性累加会很快把所有人推到 100，关系就没了层次。
   */
  function change(a, bId, delta, week) {
    const b = get(a, bId);
    const fromState = stateOf(b.score);

    if (delta > 0) {
      // 二次曲线：中段（30~70）效率尚可，90 以后急剧变难
      const damp = Math.max(0.06, 1 - Math.pow(b.score / 105, 2));
      delta = delta * damp;
    } else if (delta < 0) {
      // 关系越好，一旦翻脸伤得越重
      const amp = 1 + Math.max(0, b.score) / 180;
      delta = delta * amp;
    }

    b.score = U.clamp(b.score + delta, -100, 100);
    const toState = stateOf(b.score);
    const crossed = fromState.id !== toState.id;
    if (crossed) {
      b.state = toState.id;
      if (!b.since) b.since = week || 0;
    }
    return { crossed, from: fromState, to: toState, fromId: fromState.id, toId: toState.id };
  }

  /** 双向同时变化 */
  function changeBoth(a, b, delta, week) {
    return {
      a: change(a, b.id, delta, week),
      b: change(b, a.id, delta, week),
    };
  }

  /** 双向好感均值，用于判定道侣/结义 */
  function mutual(a, b) {
    return (score(a, b.id) + score(b, a.id)) / 2;
  }

  function formLover(a, b, week) {
    get(a, b.id).flags.push('lover');
    get(b, a.id).flags.push('lover');
    get(a, b.id).since = week;
    get(b, a.id).since = week;
    a.loverId = b.id;
    b.loverId = a.id;
  }

  function breakLover(a, b) {
    const fa = get(a, b.id).flags;
    const fb = get(b, a.id).flags;
    fa.splice(fa.indexOf('lover'), 1);
    fb.splice(fb.indexOf('lover'), 1);
    a.loverId = null;
    b.loverId = null;
    // 分手后好感回落，但不至于立刻成仇
    get(a, b.id).score = Math.min(get(a, b.id).score, 45);
    get(b, a.id).score = Math.min(get(b, a.id).score, 45);
  }

  function formSworn(a, b, week) {
    get(a, b.id).flags.push('sworn');
    get(b, a.id).flags.push('sworn');
  }

  // =========================================================
  //  每年维护
  // =========================================================
  /**
   * @param st      全局状态
   * @param emit    (text, kind) => void 写年报
   */
  function weekly(st, emit) {
    const ds = st.disciples;
    const byId = {};
    for (const d of ds) byId[d.id] = d;

    // 清理已离开的弟子
    for (const d of ds) {
      for (const oid of Object.keys(d.bonds)) {
        if (!byId[oid]) delete d.bonds[oid];
      }
      if (d.loverId && !byId[d.loverId]) {
        d.loverId = null;
        emit(`${d.name}的道侣已经不在了，他变得沉默了许多。`, 'danger');
        d.mood = U.clamp(d.mood - 20, 0, 100);
      }
    }

    // 好感自然衰减：久不往来会淡
    for (const d of ds) {
      for (const oid of Object.keys(d.bonds)) {
        const b = get(d, oid);
        if (b.flags.length) continue; // 道侣/结义不衰减
        if (b.score > 0) {
          b.score = Math.max(0, b.score - 0.3);
        } else if (b.score > -40) {
          // 轻度不和会随时间淡去
          b.score = Math.min(0, b.score + 0.5);
        }
        // 深仇大恨不会自己消散
        b.state = stateOf(b.score).id;
      }
    }

    // 道侣检测
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i];
        const b = ds[j];
        const m = mutual(a, b);

        // 已成道侣：感情破裂则分开
        if (isLover(a, b)) {
          if (m < 35 && U.chance(0.3)) {
            breakLover(a, b);
            emit(`${a.name}与${b.name}到底没能走下去。两人在演武台上最后看了一眼，` +
              `谁也没说话，各自转身走了。`, 'conflict');
          }
          continue;
        }

        // 结为道侣：双方都动了心，且都还单着
        if (m >= 62 && !a.loverId && !b.loverId && U.chance(0.3)) {
          formLover(a, b, st.week);
          emit(`${a.name}与${b.name}结为道侣。没有大操大办，只是在后山那棵老槐树下` +
            `对拜了三拜。往后修行路上，算是有人作伴了。`, 'social');
          a.mood = U.clamp(a.mood + 20, 0, 100);
          b.mood = U.clamp(b.mood + 20, 0, 100);
          continue;
        }

        // 结义：需要极高的互信，而且一个人最多结义三次
        if (m >= 80 && !isSworn(a, b) && U.chance(0.12)) {
          if (countSworn(a) < 3 && countSworn(b) < 3) {
            formSworn(a, b, st.week);
            emit(`${a.name}与${b.name}歃血为盟，结为异姓兄弟。从此祸福同当。`, 'social');
          }
        }
      }
    }
  }

  function countSworn(d) {
    let n = 0;
    for (const oid of Object.keys(d.bonds || {})) {
      if (get(d, oid).flags.includes('sworn')) n++;
    }
    return n;
  }

  /** 供 UI：把某弟子的全部关系整理成数组 */
  function summary(d) {
    const out = [];
    for (const oid of Object.keys(d.bonds || {})) {
      const o = S.state.discipleById(oid);
      if (!o) continue;
      out.push({ other: o, score: score(d, oid), label: label(d, oid) });
    }
    out.sort((x, y) => Math.abs(y.score) - Math.abs(x.score));
    return out;
  }

  S.relations = {
    STAGES, BY_ID, LOVER, stateOf,
    get, score, label, change, changeBoth, mutual,
    isLover, isSworn, isHostile,
    formLover, breakLover, formSworn,
    weekly, summary,
  };
})(window.Sect);
