/* ===========================================================
 * worldevent.js — 大事件调度与判定
 *
 * 每隔 15~25 年抛一次常规考验；主线按固定年份推进。
 * 事件会挂起，等玩家拍板；玩家不处理就一直等着（不会自动失败）。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const WE = () => S.worldevents;

  const TRIAL_GAP = [15, 25];
  const MAX_ARRAYS = 3;
  const MAX_TREASURES = 3;

  function init(st) {
    if (!st.world) {
      st.world = {
        nextTrialAt: 12,
        pending: null,
        mainlineIndex: 0,
        arrays: [],
        treasures: [],
        debuff: null,
        history: [],
        trialCount: 0,
        wins: 0,
        losses: 0,
      };
    }
    const w = st.world;
    if (!Array.isArray(w.arrays)) w.arrays = [];
    if (!Array.isArray(w.treasures)) w.treasures = [];
    if (!Array.isArray(w.history)) w.history = [];
    if (w.debuff === undefined) w.debuff = null;
    return w;
  }

  // =========================================================
  //  加成聚合
  // =========================================================
  /** 阵法 + 灵宝 + debuff 合起来的效果 */
  function bonus(st) {
    const w = st.world || {};
    const out = {
      growthMul: 1, powerMul: 1, repMul: 1, recruitMul: 1,
      mineMul: 1, injureMul: 1, loyaltyDrift: 0,
      breakthroughAdd: 0, vsDemon: 1,
    };

    const apply = (e) => {
      if (!e) return;
      if (e.growthMul) out.growthMul *= e.growthMul;
      if (e.powerMul) out.powerMul *= e.powerMul;
      if (e.repMul) out.repMul *= e.repMul;
      if (e.recruitMul) out.recruitMul *= e.recruitMul;
      if (e.mineMul) out.mineMul *= e.mineMul;
      if (e.injureMul) out.injureMul *= e.injureMul;
      if (e.vsDemon) out.vsDemon *= e.vsDemon;
      if (e.loyaltyDrift) out.loyaltyDrift += e.loyaltyDrift;
      if (e.breakthroughAdd) out.breakthroughAdd += e.breakthroughAdd;
    };

    for (const id of w.arrays || []) {
      const a = WE().ARRAY_BY_ID[id];
      if (a) apply(a.effects);
    }
    for (const id of w.treasures || []) {
      const t = WE().TREASURE_BY_ID[id];
      if (t) apply(t.effects);
    }
    // debuff 生效到指定年份为止
    if (w.debuff && st.week <= w.debuff.until) apply(w.debuff.effects);
    else if (w.debuff && st.week > w.debuff.until) w.debuff = null;

    return out;
  }

  // =========================================================
  //  调度
  // =========================================================
  const isMainlineTurn = (st) => {
    const w = init(st);
    const next = WE().MAINLINE[w.mainlineIndex];
    return next && st.week >= next.year;
  };

  const MAINLINE_OPTIONS = [
    { id: 'all', text: '全力迎战', hint: '宗门上下一起上，胜算全押在这一战', kind: 'battle', full: true },
    { id: 'elite', text: '精锐尽出', hint: '只派最强的三人，留些底子', kind: 'battle', top: 3 },
    { id: 'hold', text: '闭山自守', hint: '不掺和，保住宗门就行', kind: 'evade' },
  ];

  function tick(st) {
    const w = init(st);
    if (w.pending) return [];      // 还压着一件事没处理

    // 主线优先
    if (isMainlineTurn(st)) {
      const def = WE().MAINLINE[w.mainlineIndex];
      if (!def.options) def.options = MAINLINE_OPTIONS;
      w.pending = { kind: 'mainline', id: def.id, atWeek: st.week, def };
      return [{
        text: `【魔劫 · ${def.name}】${def.desc}`,
        kind: 'danger',
        meta: '需要宗主决断',
      }];
    }

    // 常规考验
    if (st.week >= w.nextTrialAt) {
      const pool = WE().TRIALS;
      const def = U.pick(pool);
      w.pending = { kind: 'trial', id: def.id, atWeek: st.week, def };
      w.nextTrialAt = st.week + U.randInt(TRIAL_GAP[0], TRIAL_GAP[1]);

      return [{
        text: `【${def.name}】${def.desc}`,
        kind: 'danger',
        meta: '需要宗主决断',
      }];
    }

    return [];
  }

  // =========================================================
  //  判定
  // =========================================================
  function eventPower(st, def) {
    return typeof def.power === 'function' ? def.power(st) : (def.power || 0);
  }

  function sentPower(st, sentIds, vsDemon) {
    let p = 0;
    for (const id of sentIds || []) {
      const d = S.state.discipleById(id);
      if (d) p += D.power(d);
    }
    return p;
  }

  /**
   * 处理选择。
   * optId: 选项 id；sentIds: 出战弟子
   * 返回 { ok, win, lines[], gains{} }
   */
  function resolve(st, optId, sentIds) {
    const w = init(st);
    const p = w.pending;
    if (!p) return { ok: false, msg: '现在没有要处理的事。' };

    const def = p.def;
    const opt = (def.options || []).find((o) => o.id === optId);
    if (!opt) return { ok: false, msg: '没有这个选择。' };

    const lines = [];
    const gains = { stones: 0, rep: 0, items: [], array: null, treasure: null, deaths: 0 };

    // ---- 花钱类（赈济） ----
    if (opt.kind === 'spend') {
      const cost = typeof opt.cost === 'function' ? opt.cost(st) : (opt.cost || 0);
      if (st.sect.spiritStones < cost) {
        return { ok: false, msg: `拿不出 ${cost} 灵石。` };
      }
      S.state.addStones(-cost);
      lines.push(`宗门拿出 ${cost} 灵石开仓放粮。`);
    }

    // ---- 回避类 ----
    if (opt.kind === 'evade') {
      const ev = def.evade || {};
      if (ev.rep) { S.state.addRep(ev.rep); gains.rep += ev.rep; }
      if (ev.loyalty) {
        for (const d of st.disciples) D.adjustLoyalty(d, ev.loyalty);
      }
      lines.push(evadeLine(def, opt));

      w.pending = null;
      record(st, p, false, '避而不战');
      if (p.kind === 'mainline') w.mainlineIndex++;
      return finish(st, p, false, lines, gains);
    }

    // ---- 战斗 / 出人 ----
    const need = eventPower(st, def);
    const b = bonus(st);
    const isDemon = p.kind === 'mainline';
    const raw = sentPower(st, sentIds, b.vsDemon);
    const power = raw * (isDemon ? b.vsDemon : 1);
    const ratio = need > 0 ? power / need : 1;

    const winChance = U.clamp(0.3 + ratio * 0.62, 0.12, 0.96);
    const win = need === 0 || Math.random() < winChance;

    // 参战的人要承担风险
    const dead = [];
    const hurt = [];
    const sent = (sentIds || []).map((id) => S.state.discipleById(id)).filter(Boolean);

    if (sent.length) {
      const loseDef = def.lose || {};
      for (const d of sent) {
        if (win && U.chance(0.15)) {
          const tmp = [];
          D.injure(d, 1, tmp, def.name);
          hurt.push(d.name);
          continue;
        }
        if (!win) {
          if (U.chance(loseDef.deathChance || 0)) { dead.push(d); continue; }
          if (U.chance(loseDef.injure || 0.3)) {
            const tmp = [];
            D.injure(d, U.randInt(1, 3), tmp, def.name);
            hurt.push(d.name);
          }
        }
      }
    }

    // 死人
    for (const d of dead) {
      gains.deaths++;
      S.state.addLog(`${d.name} 战死于${def.name}。`, 'danger');
      const i = st.disciples.indexOf(d);
      if (i >= 0) st.disciples.splice(i, 1);
      if (d.homeBuilding) S.systems.building.remove(st, d.homeBuilding, d.id);
      for (const x of st.disciples) {
        if (x.loverId === d.id) { x.loverId = null; x.mood = U.clamp(x.mood - 30, 0, 100); }
        delete x.bonds[d.id];
      }
    }

    if (win) {
      w.wins = (w.wins || 0) + 1;
      lines.push(winLine(def, p.kind));
      applyWin(st, def, p.kind, lines, gains);
    } else {
      w.losses = (w.losses || 0) + 1;
      lines.push(loseLine(def, p.kind));
      if (p.kind === 'mainline') {
        applyDemonDebuff(st, def);
      } else {
        const loseDef = def.lose || {};
        if (loseDef.rep) { S.state.addRep(loseDef.rep); gains.rep += loseDef.rep; }
      }
    }

    if (dead.length) {
      lines.push(`这一战折了 ${dead.map((d) => d.name).join('、')}。`);
    }
    if (hurt.length && !dead.length) {
      lines.push(`${hurt.join('、')} 带伤回来，要养些日子。`);
    }

    // 主线打赢了：参战的人里最强的那个，落一份传承
    if (win && p.kind === 'mainline') {
      const termId = p.kind === 'mainline' && def.reward ? def.reward.term : null;
      const term = termId ? S.terms.get(termId) : null;
      if (term && sent.length) {
        const best = sent
          .slice()
          .sort((a, b) => D.power(b) - D.power(a))[0];
        if (best && !best.terms.includes(termId)) {
          best.terms.push(termId);
          if (!Array.isArray(best.termSources)) best.termSources = [];
          best.termSources.push({ term: termId, from: def.name });
          D.addHistory(best, `${def.name}一战成名，得「${term.name}」`);
          D.adjustMood(best, 25);
          D.adjustLoyalty(best, 10);
          gains.term = term.name;
          lines.push(
            `${best.name}从那片焦土里走回来时，整个人都不一样了。` +
              `多年以后宗门里提起这一战，说的都是他——「${term.name}」这个名号，是从这儿来的。`
          );

          if (!Array.isArray(st.legacyLog)) st.legacyLog = [];
          st.legacyLog.unshift({
            year: st.week - 1,
            npcId: def.id,
            npcName: def.name,
            discipleId: best.id,
            discipleName: best.name,
            term: termId,
            termName: term.name,
            mainline: true,
          });
        }
      }
    }

    w.pending = null;
    record(st, p, win, win ? '胜' : '败');
    if (p.kind === 'mainline') w.mainlineIndex++;
    return finish(st, p, win, lines, gains);
  }

  function finish(st, p, win, lines, gains) {
    return {
      ok: true,
      win,
      lines,
      gains,
      kind: p.kind,
      name: p.def.name,
    };
  }

  function record(st, p, win, tag) {
    init(st).history.unshift({
      year: st.week - 1,
      id: p.id,
      name: p.def.name,
      kind: p.kind,
      win,
      tag,
    });
    if (st.world.history.length > 40) st.world.history.length = 40;
  }

  // ---------------- 奖励 ----------------
  function applyWin(st, def, kind, lines, gains) {
    const re = def.win || def.reward || {};
    const b = bonus(st);

    if (re.rep) {
      const v = Math.round(re.rep * b.repMul);
      S.state.addRep(v);
      gains.rep += v;
    }
    if (Array.isArray(re.stones)) {
      const v = U.randInt(re.stones[0], re.stones[1]);
      if (v !== 0) { S.state.addStones(v); gains.stones = v; }
    } else if (typeof re.stones === 'number') {
      S.state.addStones(re.stones);
      gains.stones = re.stones;
    }
    if (Array.isArray(re.item) && re.item.length) {
      const id = U.pick(re.item);
      const it = S.items.get(id);
      if (it) {
        S.state.warehouseAdd(id, 1);
        st.sect.totalLoot++;
        gains.items.push(it.name);
        lines.push(`从这一战里得了「${it.name}」。`);
      }
    }
    if (re.recruit) {
      for (let i = 0; i < re.recruit; i++) {
        const taken = new Set(st.disciples.map((x) => x.name).concat(st.candidates.map((x) => x.name)));
        const c = D.makeCandidate(taken);
        c.candidateWeek = st.week;
        st.candidates.push(c);
      }
      if (re.recruit) lines.push(`此事传开，山门外多了几个来投的人。`);
    }

    // 阵法
    if (re.array) {
      const arr = WE().ARRAY_BY_ID[re.array];
      if (arr && !st.world.arrays.includes(re.array)) {
        if (st.world.arrays.length < MAX_ARRAYS) {
          st.world.arrays.push(re.array);
          gains.array = arr.name;
          lines.push(`得阵法「${arr.name}」：${arr.desc}`);
        }
      }
    }
    // 灵宝
    if (re.treasure) {
      const tr = WE().TREASURE_BY_ID[re.treasure];
      if (tr && !st.world.treasures.includes(re.treasure)) {
        if (st.world.treasures.length < MAX_TREASURES) {
          st.world.treasures.push(re.treasure);
          gains.treasure = tr.name;
          lines.push(`得灵宝「${tr.name}」：${tr.desc}`);
        }
      }
    }
  }

  /** 魔劫失败：贴 debuff 到下一章 */
  function applyDemonDebuff(st, def) {
    const w = init(st);
    // 注意：这时 mainlineIndex 还没递增，所以要往前看一章
    const next = WE().MAINLINE[w.mainlineIndex + 1];
    const until = next ? next.year : st.week + 60;

    w.debuff = {
      id: 'demon_aftermath',
      name: '魔劫余烬',
      until,
      effects: { growthMul: 0.8, recruitMul: 1.5 },
    };
  }

  // ---------------- 文案 ----------------
  function winLine(def, kind) {
    if (kind === 'mainline') {
      return `${def.desc} 宗门顶住了。消息传出去，好几天都有人上山送东西。`;
    }
    return `【${def.name}】守住了。`;
  }

  function loseLine(def, kind) {
    if (kind === 'mainline') {
      return `${def.desc} 没能挡住。山门保住了，可方圆百里都成了焦土。`;
    }
    return `【${def.name}】没守住。`;
  }

  function evadeLine(def, opt) {
    return `【${def.name}】宗门选择了避而不谈，把山门关了起来。`;
  }

  // ---------------- 主线下一次 ----------------
  function advanceMainline(st) {
    const w = init(st);
    if (w.pending && w.pending.kind === 'mainline') {
      w.mainlineIndex = Math.min(w.mainlineIndex + 1, WE().MAINLINE.length);
    }
  }

  // =========================================================
  //  供 UI
  // =========================================================
  function currentDebuff(st) {
    const w = st.world;
    if (!w || !w.debuff) return null;
    if (st.week > w.debuff.until) { w.debuff = null; return null; }
    return w.debuff;
  }

  function nextMainlineYear(st) {
    const w = init(st);
    const n = WE().MAINLINE[w.mainlineIndex];
    return n ? n.year : null;
  }

  S.systems = S.systems || {};
  S.systems.worldevent = {
    init, tick, resolve, bonus, advanceMainline,
    currentDebuff, nextMainlineYear, eventPower,
    MAX_ARRAYS, MAX_TREASURES,
  };
})(window.Sect);
