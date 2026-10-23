/* ===========================================================
 * week.js — 年推进主循环
 *
 * 一年结算顺序：
 *   1. 弟子行动（任务 / 历练 / 静修）
 *   2. 弟子用贡献点兑换仓库物资
 *   3. 弟子之间的交互
 *   4. 关系维护（道侣、结义、感情破裂）
 *   5. 江湖人物来访 / 寻仇
 *   6. 忠诚、心情、叛逃
 *   7. 拍卖行、任务板、候选者刷新
 *   8. 名望与宗门升级
 *   9. 打包年报
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const R = S.realm;
  const ST = S.stories;
  const REL = S.relations;

  const MAX_REPORTS = 60;

  // =========================================================
  //  主入口
  // =========================================================
  function advanceWeek(st, opts) {
    opts = opts || {};
    st.week++;
    st.stats.weeksPlayed++;

    const entries = [];
    /**
     * 记一条事件。
     * minor = true 的是"杂事"（每年修炼、兑换补药之类）：
     * 不进年报、不进动态流，但会留在当事人的「近况」里。
     */
    const push = (text, kind, d, meta, minor, fold) => {
      const entry = {
        text,
        kind: kind || 'info',
        discipleId: d ? d.id : null,
        meta: meta || '',
        minor: !!minor,
        fold: !!fold,
      };
      entries.push(entry);

      if (minor && d) {
        if (!Array.isArray(d.recent)) d.recent = [];
        d.recent.push({ week: st.week - 1, text, kind: entry.kind });
        if (d.recent.length > 24) d.recent.shift();
      }
    };
    const pushAll = (list) => {
      for (const e of list) {
        const dd = e.discipleId ? S.state.discipleById(e.discipleId) : null;
        push(e.text, e.kind, dd, e.meta, e.minor, e.fold);
      }
    };

    const moment = ST.moment(st);

    // ---------- 1. 弟子行动 ----------
    for (const d of st.disciples.slice()) {
      const assigned = d.assignedMissionId
        ? st.missions.find((m) => m.id === d.assignedMissionId)
        : null;

      if (assigned && assigned.status === 'open') {
        S.systems.mission.take(st, assigned, d);
      }
      d.assignedMissionId = null;

      if (d.missionId) {
        const m = st.missions.find((x) => x.id === d.missionId);
        if (m && m.status === 'taken') {
          pushAll(resolveMission(st, d, m, moment));
        } else {
          d.missionId = null;
          d.status = 'idle';
        }
      } else if (d.injureWeeks > 0) {
        for (const ev of D.trainWeek(d)) push(ev.text, ev.kind, d, '', ev.minor);
        d.lastAction = '养伤';
      } else if (d.homeBuilding) {
        // 在建筑里做事，产出由建筑系统统一结算
        const bd = S.buildings.get(d.homeBuilding);
        d.lastAction = bd ? `在${bd.name}做事` : '做事';
      } else {
        const decision = decideAction(st, d);
        if (decision.type === 'mission') {
          S.systems.mission.take(st, decision.mission, d);
          pushAll(resolveMission(st, d, decision.mission, moment));
        } else if (decision.type === 'expedition') {
          pushAll(resolveExpedition(st, d, moment));
        } else {
          for (const ev of D.trainWeek(d)) push(ev.text, ev.kind, d, '', ev.minor);
          d.lastAction = '静修';
        }
      }

      d.weeksInSect++;
      d.age++;   // 一年一岁
      if (d.infoBonus) d.infoBonus = 0;
    }

    // ---------- 1.5 生死 ----------
    // 渡劫没扛住的、寿元到头的，都在这里离开
    for (const d of st.disciples.slice()) {
      if (d.dead) {
        die(st, d, push, 'tribulation');
      } else if (d.age >= S.disciple.lifespanOf(d)) {
        die(st, d, push, 'age');
      }
    }

    // ---------- 2. 年俸 ----------
    // 养人是要花钱的，境界越高、身份越高，越贵
    const upkeep = S.sect.totalUpkeep(st);
    if (upkeep > 0) {
      const pay = Math.min(st.sect.spiritStones, upkeep);
      S.state.addStones(-pay);
      const short = upkeep - pay;
      if (short > 0) {
        for (const d of st.disciples) {
          D.adjustLoyalty(d, -3);
          D.adjustMood(d, -6);
        }
        push(
          `这一年宗门的年俸发不齐，短了 ${short} 灵石。弟子们嘴上不说，心里有数。`,
          'danger',
          null,
          `年俸 ${upkeep} · 缺口 ${short}`
        );
      }
    }
    st.stats.lastUpkeep = upkeep;

    // ---------- 2.5 建筑产出 ----------
    // 开了自动补位的话，先把空位填上，再结算产出
    if (st.settings && st.settings.autoFill) {
      S.systems.building.autoFill(st);
    }
    pushAll(S.systems.building.weekly(st));

    // ---------- 3. 兑换 ----------
    for (const d of st.disciples) {
      const opt = S.systems.warehouse.decide(d, st);
      if (!opt) continue;
      const c = { d, itemName: opt.item.name, cost: opt.cost };
      const story = ST.gen(ST.EXCHANGE, {
        ...c,
        meta: `贡献 -${opt.cost} · 得${opt.item.name}`,
      });
      // 兑换的实际效果不写在正文里，避免打断叙事
      const lines = S.systems.warehouse.exchange(d, opt, st);
      // 换东西是日常，不进年报，只留在他的近况里
      push(story ? story.text : lines[0], 'exchange', d, story ? story.meta : '', true);
      // 附带的效果（修为提升等）单独成条；若因此突破了，那条要留下
      for (const extra of lines.slice(1)) {
        if (extra.includes('兑换了')) continue;
        const important = /晋入|突破|冲击|走火入魔/.test(extra);
        push(extra, important ? 'breakthrough' : 'growth', d, '', !important);
      }
      d.lastAction = `兑换「${opt.item.name}」`;
    }

    // ---------- 3. 交互 ----------
    const interactions = S.systems.events.weekly(st);
    pushAll(interactions);

    // ---------- 4. 关系 ----------
    REL.weekly(st, (text, kind) => push(text, kind || 'social'));

    // ---------- 5. 江湖 ----------
    pushAll(S.systems.npc.visit(st, st.week));

    // ---------- 5.5 剧情线（每年最多推一幕） ----------
    pushAll(S.systems.saga.tick(st, st.week - 1));

    // ---------- 6. 宗门大比（每 10年一次，按刚结算完的那一年算） ----------
    const playedWeek = st.week - 1;
    if (S.systems.tournament.shouldRun(playedWeek)) {
      pushAll(S.systems.tournament.run(st));
    }

    // ---------- 6.5 大事件 ----------
    pushAll(S.systems.worldevent.tick(st));

    // ---------- 7. 忠诚 / 叛逃 ----------
    for (const d of st.disciples.slice()) {
      settleLoyalty(st, d, push);
    }

    // ---------- 8. 刷新 ----------
    S.systems.auction.refresh(st);
    S.systems.mission.refresh(st);
    refreshCandidates(st, push);

    // ---------- 9. 名望 ----------
    S.state.checkLevelUp();

    // ---------- 10. 年报 ----------
    // 杂事（每年修炼、兑换补药）不进年报，只留在弟子近况里；
    // 日常经营（灵田灵矿丹房这类产出、零碎掉落）折叠成一行
    const reportEntries = [];
    const folded = [];
    let foldAt = -1;
    for (const e of entries) {
      if (e.minor) continue;
      // 小境界突破是杂事，只在弟子近况里留一笔；渡劫那种才进年报
      if (e.kind === 'breakthrough') continue;
      if (e.fold) {
        folded.push(e.meta || e.text);
        if (foldAt < 0) foldAt = reportEntries.length;
        continue;
      }
      reportEntries.push(e);
    }
    if (folded.length) {
      const head = folded.slice(0, 3).join('；');
      const tail = folded.length > 3 ? `；等共 ${folded.length} 项` : '';
      reportEntries.splice(foldAt, 0, {
        text: `各处照常运转：${head}${tail}。`,
        kind: 'info',
        meta: '',
      });
    }

    // 弟子一多，年报就长得看不完。次要的收进一句里。
    const HEAVY = new Set(['danger', 'tribulation', 'tournament', 'saga', 'sect', 'recruit', 'conflict', 'fortune']);
    const MAX_LINES = 15;
    if (reportEntries.length > MAX_LINES) {
      const kept = [];
      const rest = [];
      let minorBudget = Math.max(0, MAX_LINES - reportEntries.filter((e) => HEAVY.has(e.kind)).length);
      for (const e of reportEntries) {
        if (HEAVY.has(e.kind)) { kept.push(e); continue; }
        if (minorBudget > 0) { kept.push(e); minorBudget--; }
        else rest.push(e);
      }
      if (rest.length) {
        const kinds = {};
        for (const e of rest) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
        const label = { mission: '任务', expedition: '历练', social: '交往', loot: '收获', growth: '经营', info: '琐事' };
        const parts = Object.keys(kinds).map((k) => `${label[k] || k} ${kinds[k]}`).join('、');
        kept.push({
          text: `另有 ${rest.length} 件事（${parts}），各有各的，不再一一记。`,
          kind: 'info',
          meta: '',
        });
      }
      reportEntries.length = 0;
      reportEntries.push(...kept);
    }

    const report = {
      week: st.week - 1,
      entries: reportEntries,
      moment,
      prelude: ST.prelude(moment, reportEntries),
      stats: snapshotStats(st),
    };
    st.reports.unshift(report);
    if (st.reports.length > MAX_REPORTS) st.reports.length = MAX_REPORTS;

    for (const e of entries) {
      S.state.addLog(`[第${report.week}年] ${e.text}`, e.kind);
    }
    st.pending = [];

    if (!opts.silent) S.state.save();
    return report;
  }

  // =========================================================
  //  行动决策
  // =========================================================
  function decideAction(st, d) {
    const agg = D.aggOf(d);

    const m = S.systems.mission.pickFor(st, d);
    let missionWish = 0.7 * (0.7 + d.loyalty / 200) * (0.8 + d.mood / 250);
    if (agg.terms.some((t) => t.tags.includes('combat'))) missionWish += 0.1;

    let expWish = 0.3;
    if (agg.terms.some((t) => t.tags.includes('lucky'))) expWish += 0.15;
    if (agg.terms.some((t) => t.tags.includes('combat'))) expWish += 0.12;
    if (d.mood < 35) expWish += 0.1;
    if (d.exp > R.expNeed(d.realm) * 0.85) expWish -= 0.15;

    if (m && U.chance(U.clamp(missionWish, 0.05, 0.95))) {
      return { type: 'mission', mission: m };
    }
    if (U.chance(U.clamp(expWish, 0.05, 0.9))) {
      return { type: 'expedition' };
    }
    return { type: 'train' };
  }

  // =========================================================
  //  任务结算
  // =========================================================
  function resolveMission(st, d, m, moment) {
    const out = [];
    const agg = D.aggOf(d);
    const p = D.power(d);
    const ratio = p / Math.max(1, m.powerNeed);
    const successRate = U.clamp(0.16 + 0.74 * ratio + agg.missionMul, 0.06, 0.97);
    const ok = Math.random() < successRate;
    const region = S.regions.get(m.region);

    st.sect.totalMissions++;
    d.missionId = null;
    d.status = 'idle';
    m.status = 'done';

    const c = { d, m, region, moment };

    if (ok) {
      const contrib = D.addContribution(d, m.contrib);
      S.state.addStones(m.stones);
      S.state.addRep(m.rep);
      d.lastAction = `完成「${m.name}」`;
      D.addHistory(d, `完成「${m.name}」`);
      D.adjustMood(d, 6);

      const table = ST.MISSION_OK[m.type] || ST.MISSION_OK.gather;
      const story = ST.gen(table, {
        ...c,
        meta: ST.meta([
          `贡献 +${contrib}`,
          `灵石 +${m.stones}`,
          `名望 +${m.rep}`,
        ]),
      });
      out.push({ text: story.text, meta: story.meta, kind: 'mission' });

      // 实战修为
      const expGain = U.rand(5, 13) * (1 + m.tier * 0.45);
      for (const ev of D.gainExp(d, expGain)) {
        out.push({ text: ev.text, kind: ev.kind, minor: ev.minor, discipleId: ev.minor ? d.id : null });
      }

      // 额外掉落
      const drops = missionDrops(m, agg);
      for (const it of drops) {
        S.state.warehouseAdd(it.id, 1);
        st.sect.totalLoot++;
        out.push({
          text: `路上还顺手带回了「${it.name}」，已经交到库房。`,
          meta: `入库${it.name}`,
          kind: 'loot',
          fold: true,   // 零碎掉落并进年报的那一行汇总
        });
      }

      // 途中偶遇江湖人物
      if (region) {
        const enc = S.systems.npc.encounter(st, d, region, st.week);
        if (enc) out.push(...enc);
        S.systems.npc.personalFavorBonus(st, d, region, out);
      }
    } else {
      const contrib = D.addContribution(d, Math.round(m.contrib * 0.2));
      d.lastAction = `「${m.name}」失手`;
      const hurtP = U.clamp((1.5 - ratio) * 0.75 * agg.injureMul, 0.05, 0.9);
      const hurt = Math.random() < hurtP;

      const story = ST.gen(ST.MISSION_FAIL, {
        ...c,
        meta: ST.meta([`贡献 +${contrib}`, hurt ? '负伤' : '']),
      });
      out.push({ text: story.text, meta: story.meta, kind: 'danger' });

      if (hurt) {
        const tmp = [];
        D.injure(d, U.randInt(1, 3), tmp, '任务失手');
        out.push({ text: ST.gen(ST.MISSION_HURT, { d }).text, kind: 'danger' });
      }
      S.state.addRep(-1);
      D.adjustMood(d, -10);
      D.addHistory(d, `「${m.name}」失手${hurt ? '并受伤' : ''}`);
    }
    return out;
  }

  function missionDrops(m, agg) {
    const drops = [];
    const luck = agg.lootMul;
    if (m.type === 'hunt' && Math.random() < 0.35 * luck) {
      drops.push(S.items.get('yaowangneidan'));
    }
    if (m.type === 'explore' && Math.random() < 0.5 * luck) {
      const pool = S.items.ofTier([Math.min(4, m.tier), Math.min(4, m.tier + 1)]);
      if (pool.length) drops.push(U.pick(pool));
    }
    if (m.type === 'gather' && Math.random() < 0.55 * luck) {
      drops.push(U.pick(S.items.ofTier([1])));
    }
    if (m.type === 'escort' && Math.random() < 0.35 * luck) {
      drops.push(U.pick(S.items.ofTier([1, 2])));
    }
    return drops.filter(Boolean);
  }

  // =========================================================
  //  历练结算
  // =========================================================
  function resolveExpedition(st, d, moment) {
    const out = [];
    const agg = D.aggOf(d);
    const p = D.power(d);
    const region = S.regions.pickForPower(p);

    d.status = 'idle';
    d.lastAction = `前往${region.name}历练`;

    let n = 1;
    if (Math.random() < 0.3 * agg.lootMul) n = 2;
    if (Math.random() < 0.08 * agg.lootMul) n = 3;
    if (d.infoBonus) n += 1;

    const got = [];
    for (let i = 0; i < n; i++) {
      const pickRow = U.weighted(region.loot, (r) => r.w * agg.lootMul);
      const item = S.items.get(pickRow.itemId);
      if (item) got.push(item);
    }

    const stones = Math.round(U.rand(region.stones[0], region.stones[1]) * (0.8 + agg.lootMul * 0.3));
    S.state.addStones(stones);

    // 私吞
    let skimmed = false;
    if (agg.skim > 0 && got.length && Math.random() < agg.skim) {
      const stolen = got.pop();
      skimmed = true;
      out.push({
        text: `${d.name}从${region.name}回来，说身上什么也没剩。` +
          `可三天后，坊市里有人见过他，手里多了一件「${stolen.name}」。`,
        kind: 'danger',
      });
      D.adjustLoyalty(d, -3);
    }

    // 上交换贡献
    let contribTotal = 0;
    const names = [];
    for (const it of got) {
      S.state.warehouseAdd(it.id, 1);
      const cc = D.addContribution(d, Math.round(it.contrib * 0.42));
      contribTotal += cc;
      names.push(`「${it.name}」`);
      st.sect.totalLoot++;
    }

    const c = { d, region, moment, itemsText: names.join('、') };

    if (got.length) {
      const story = ST.gen(ST.EXP_LOOT, {
        ...c,
        meta: ST.meta([`贡献 +${contribTotal}`, stones ? `灵石 +${stones}` : '']),
      });
      out.push({ text: story.text, meta: story.meta, kind: 'expedition' });
    } else if (!skimmed) {
      const story = ST.gen(ST.EXP_EMPTY, {
        ...c,
        meta: stones ? `灵石 +${stones}` : '',
      });
      out.push({ text: story.text, meta: story.meta, kind: 'expedition' });
    }

    // 区域风貌
    applyFlavor(st, d, region, out);

    // 偶遇江湖人物
    const enc = S.systems.npc.encounter(st, d, region, st.week);
    if (enc) out.push(...enc);
    S.systems.npc.personalFavorBonus(st, d, region, out);

    // 奇遇
    const fortuneP = U.clamp(0.06 * agg.fortune, 0, 0.35);
    if (Math.random() < fortuneP) {
      const lines = rollFortune(st, d, region);
      for (const line of lines) out.push({ text: line, kind: 'fortune' });
    }

    // 受伤
    const locEff = S.locations ? S.locations.effectsOf(st) : { dangerMul: 1 };
    let dangerP = region.danger * agg.injureMul * (locEff.dangerMul || 1);
    if (p < region.powerNeed) dangerP *= 1 + (region.powerNeed - p) / region.powerNeed * 1.8;
    if (d.guard > 0) dangerP *= 0.3;
    if (Math.random() < U.clamp(dangerP, 0, 0.85)) {
      const tmp = [];
      D.injure(d, U.randInt(1, 2), tmp, `在${region.name}遇险`);
      for (const e of tmp) out.push({ text: e.text, kind: e.kind });
      out.push({ text: ST.gen(ST.EXP_HURT, { d, region }).text, kind: 'danger' });
      D.adjustMood(d, -12);
    } else if (got.length) {
      D.adjustMood(d, 8);
    }
    return out;
  }

  /** 区域专属小事件 */
  function applyFlavor(st, d, region, out) {
    if (!region.flavor || !region.flavor.length) return;
    // 每年都来一条会腻，降点频
    if (Math.random() > 0.22) return;

    const f = U.pick(region.flavor);
    out.push({ text: `${region.name}——${f.text}`, kind: 'info' });

    const e = f.effect || {};
    if (e.stones) {
      const n = U.randInt(e.stones[0], e.stones[1]);
      S.state.addStones(n);
      out.push({ text: `这点外快他也交了上来，${n}灵石。`, meta: `灵石 +${n}`, kind: 'expedition' });
    }
    if (e.item) {
      const it = S.items.get(e.item);
      if (it) {
        S.state.warehouseAdd(e.item, 1);
        st.sect.totalLoot++;
        out.push({ text: `「${it.name}」被带回了宗门，交入库房。`, meta: `入库${it.name}`, kind: 'loot' });
      }
    }
    if (e.mood) D.adjustMood(d, e.mood);
    if (e.daoxin) {
      d.daoxin = U.clamp(d.daoxin + e.daoxin, 10, 99);
      out.push({
        text: `${d.name}的心境更稳了些。`,
        meta: `道心 +${e.daoxin}`,
        kind: 'growth',
        minor: true,
      });
    }
    if (e.wuxing) {
      d.wuxing = U.clamp(d.wuxing + e.wuxing, 10, 99);
      out.push({
        text: `${d.name}像是忽然开窍了。`,
        meta: `悟性 +${e.wuxing}`,
        kind: 'growth',
        minor: true,
      });
    }
    if (e.rep) S.state.addRep(e.rep);
    if (e.exp) {
      for (const ev of D.gainExp(d, e.exp)) {
        out.push({
          text: ev.text,
          kind: ev.kind,
          minor: ev.minor,
          discipleId: ev.minor ? d.id : null,
        });
      }
    }
  }

  /** 奇遇池 */
  function rollFortune(st, d, region) {
    const pool = [
      () => {
        const gain = U.rand(18, 48);
        const evs = D.gainExp(d, gain, { silent: true });
        const t = evs.length ? evs[evs.length - 1].text : '';
        return [ST.gen(ST.FORTUNE_LINES, { d, region }).text + (t ? ' ' + t : '')];
      },
      () => {
        const it = U.pick(S.items.ofTier([1, 2]));
        S.state.warehouseAdd(it.id, 1);
        st.sect.totalLoot++;
        return [`${d.name}在一具白骨旁拾到「${it.name}」，不知是哪位前辈的遗物。`];
      },
      () => {
        const n = U.randInt(60, 200);
        S.state.addStones(n);
        return [`${d.name}发现了一窝散落的灵石，拢共${n}枚，都背回宗门了。`];
      },
      () => {
        d.wuxing = U.clamp(d.wuxing + 1, 10, 99);
        return [`${d.name}偶遇一位云游散人，被点拨了一句，从此对“道”的理解变了。`];
      },
      () => {
        d.daoxin = U.clamp(d.daoxin + 1, 10, 99);
        return [`${d.name}在崖边看了一夜的云海，心里的某个结忽然开了。`];
      },
      () => {
        const it = U.pick(S.items.ofTier([2, 3]));
        S.state.warehouseAdd(it.id, 1);
        st.sect.totalLoot++;
        return [`${d.name}从${region.name}深处带回了「${it.name}」，连他自己都说不清是怎么拿到的。`];
      },
    ];
    const lines = U.pick(pool)();
    D.addHistory(d, `在${region.name}得奇遇`);
    return lines.map((t) => `奇遇——${t}`);
  }

  // =========================================================
  //  离世
  // =========================================================
  /**
   * 弟子离世。cause: 'age' 寿终 | 'tribulation' 渡劫
   * 渡劫身亡的叙事已在 tribulate 里写过，这里只管收尾。
   */
  function die(st, d, push, cause) {
    const i = st.disciples.indexOf(d);
    if (i < 0) return;
    st.disciples.splice(i, 1);

    if (d.homeBuilding) {
      S.systems.building.remove(st, d.homeBuilding, d.id);
    }

    if (cause === 'age') {
      const years = d.age;
      const stayed = st.week - (d.joinWeek || 0);
      push(
        U.pick([
          `${d.name} 走了。走的时候在打坐，第二天早上同门才发现，身子已经凉了。` +
          `他活了 ${years} 岁，其中 ${stayed} 年是在青云宗过的。`,
          `${d.name} 的寿元到了尽头。最后那几年他很少出门，` +
          `有人去看他，他就笑一笑，说"差不多了"。享年 ${years} 岁。`,
          `${d.name} 是在一个很平常的早晨没的。没有征兆，也没有留下话。`,
        ]),
        'danger'
      );
    }

    // 关系清账
    for (const x of st.disciples) {
      if (x.loveTarget === d.id) {
        x.loveTarget = null;
        x.mood = U.clamp(x.mood - 20, 0, 100);
      }
      if (x.loverId === d.id) {
        x.loverId = null;
        x.mood = U.clamp(x.mood - 35, 0, 100);
        x.loyalty = U.clamp(x.loyalty - 8, 0, 100);
      }
      delete x.bonds[d.id];
    }

    st.sect.totalDeaths = (st.sect.totalDeaths || 0) + 1;
    S.state.addLog(`${d.name} 离世（${cause === 'age' ? '寿终' : '渡劫'}）。`, 'danger');
  }

  // =========================================================
  //  忠诚与叛逃
  // =========================================================
  function settleLoyalty(st, d, push) {
    const agg = D.aggOf(d);

    let drift = (62 - d.loyalty) * 0.06;
    drift += agg.loyaltyDrift;
    if (S.systems.worldevent) drift += S.systems.worldevent.bonus(st).loyaltyDrift;
    drift += (d.mood - 55) / 100;
    if (d.contribution < 10) drift -= 0.4;
    if (d.injureWeeks > 0) drift -= 0.5;
    // 有道侣的人更不愿意走
    if (d.loverId) drift += 0.8;

    d.loyalty = U.clamp(d.loyalty + drift, 0, 100);

    if (d.loyalty < 15 && Math.random() < 0.35) {
      const i = st.disciples.indexOf(d);
      if (i >= 0) st.disciples.splice(i, 1);
      push(`${d.name}留下一封书信，连夜下了山。` +
        `信上只有一句话：“弟子不孝。”宗门损失了一名弟子。`, 'danger', d);
      S.state.addRep(-3);
      S.state.addLog(`${d.name}叛出宗门。`, 'danger');
    } else if (d.loyalty < 25) {
      push(`${d.name}近来话少了。有人看见他一个人在山门外站了很久，` +
        `不知道在看什么。`, 'warning', d);
    }
  }

  // =========================================================
  //  候选者
  // =========================================================
  function refreshCandidates(st, push) {
    const cap = S.state.capacity();

    // 先处理门口等着的人——不管宗门还收不收得下，他们都会老、会走
    for (const c of st.candidates.slice()) {
      c.age++;
      const waited = st.week - (c.candidateWeek || st.week);
      const giveUp = waited >= 6 || (waited >= 3 && Math.random() < 0.4);
      if (!giveUp) continue;

      const i = st.candidates.indexOf(c);
      if (i >= 0) st.candidates.splice(i, 1);
      push(
        waited >= 6
          ? `${c.name}在山门外等了六年，最后没等到回话，走了。` +
            `门房说他走的时候回头看了两眼。`
          : `${c.name}等不下去了，说山下还有别处可去。`,
        'recruit'
      );
    }

    // 再看要不要来新人
    if (st.candidates.length >= 4) return;
    if (st.disciples.length >= cap + 2) return;

    const locEff2 = S.locations ? S.locations.effectsOf(st) : { recruitMul: 1 };
    const weBonus = S.systems.worldevent ? S.systems.worldevent.bonus(st) : { recruitMul: 1 };
    let p = 0.42 * (locEff2.recruitMul || 1) * (weBonus.recruitMul || 1);
    if (st.sect.reputation > 20) p += 0.12;
    if (st.disciples.length < cap) p += 0.08;

    if (Math.random() < p) {
      const taken = new Set(
        st.disciples.map((x) => x.name).concat(st.candidates.map((x) => x.name))
      );
      const c = D.makeCandidate(taken);
      c.candidateWeek = st.week;
      st.candidates.push(c);
      push(S.stories.recruitLine(c), 'recruit');
    }
  }

  // =========================================================
  //  统计
  // =========================================================
  function snapshotStats(st) {
    const totalPower = st.disciples.reduce((s, d) => s + D.power(d), 0);
    const avgRealm = st.disciples.length
      ? st.disciples.reduce((s, d) => s + d.realm, 0) / st.disciples.length
      : 0;
    return {
      disciples: st.disciples.length,
      totalPower: Math.round(totalPower),
      avgRealm: U.round(avgRealm, 2),
      stones: st.sect.spiritStones,
      reputation: st.sect.reputation,
    };
  }

  // =========================================================
  //  玩家操作
  // =========================================================
  function assign(st, discipleId, missionId) {
    const d = S.state.discipleById(discipleId);
    const m = st.missions.find((x) => x.id === missionId);
    if (!d || !m) return { ok: false, msg: '找不到目标。' };
    if (m.status !== 'open') return { ok: false, msg: '这个任务已经有人接了。' };
    if (d.injureWeeks > 0) return { ok: false, msg: `${d.name}身上有伤，去不了。` };
    if (d.missionId) return { ok: false, msg: `${d.name}手头还有任务没交。` };
    d.assignedMissionId = m.id;
    return { ok: true, msg: `已指派${d.name}执行「${m.name}」，来年结算。` };
  }

  function recruit(st, candidateId) {
    const cap = S.state.capacity();
    if (st.disciples.length >= cap) {
      return { ok: false, msg: `宗门最多只能容纳${cap}人，先扩建再说。` };
    }
    const i = st.candidates.findIndex((c) => c.id === candidateId);
    if (i < 0) return { ok: false, msg: '此人已经离开了。' };
    const c = st.candidates.splice(i, 1)[0];
    delete c.isCandidate;
    delete c.pitch;
    c.joinWeek = st.week;
    c.weeksInSect = 0;
    c.status = 'idle';
    c.missionId = null;
    c.assignedMissionId = null;
    c.rank = 'menial';   // 进门先做杂役
    c.bonds = c.bonds || {};
    st.disciples.push(c);
    st.sect.totalRecruited++;
    S.state.addLog(`${c.name}入宗，做杂役。`, 'recruit');
    return {
      ok: true,
      msg: `${c.name}留下了，先从杂役做起。干出样子才能升外门。`,
    };
  }

  function expel(st, discipleId) {
    const i = st.disciples.findIndex((d) => d.id === discipleId);
    if (i < 0) return { ok: false, msg: '查无此人。' };
    const d = st.disciples[i];
    st.disciples.splice(i, 1);
    for (const x of st.disciples) {
      if (x.loveTarget === d.id) x.loveTarget = null;
      if (x.loverId === d.id) x.loverId = null;
      delete x.bonds[d.id];
    }
    S.state.addRep(-2);
    S.state.addLog(`${d.name}被逐出宗门。`, 'danger');
    return { ok: true, msg: `${d.name}收拾行囊，头也不回地走了。` };
  }

  S.systems = S.systems || {};
  S.systems.week = {
    advanceWeek, assign, recruit, expel,
    snapshotStats, decideAction,
  };
})(window.Sect);
