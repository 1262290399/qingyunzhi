/* ===========================================================
 * disciple.js — 弟子：生成、属性聚合、修炼与突破
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const R = S.realm;

  // 乘算聚合的字段
  const MUL_KEYS = [
    'growthMul', 'powerMul', 'contributionMul', 'lootMul',
    'injureMul', 'socialMul', 'conflict', 'fortune', 'deathResist',
  ];
  // 加算聚合的字段
  const ADD_KEYS = [
    'breakthroughAdd', 'loyaltyDrift', 'missionMul', 'skim',
    'pillDiscount', 'curse', 'sickChance', 'qiDevChance', 'sectMorale',
    'lifespan', 'tribulationAdd',
  ];
  // 技艺加成（四项，直接加到弟子的静态技能上）
  const SKILL_KEYS = ['alchemy', 'forging', 'trade', 'leadership'];

  /** 词条 -> 汇总效果（带缓存，key = 词条签名） */
  const _aggCache = new Map();

  function aggregate(termIds) {
    const key = termIds.slice().sort().join('|');
    const hit = _aggCache.get(key);
    if (hit) return hit;

    const agg = {
      growthMul: 1, powerMul: 1, contributionMul: 1, lootMul: 1,
      injureMul: 1, socialMul: 1, conflict: 1, fortune: 1, deathResist: 1,
      breakthroughAdd: 0, loyaltyDrift: 0, missionMul: 0, skim: 0,
      pillDiscount: 0, curse: 0, sickChance: 0, qiDevChance: 0,
      sectMorale: 0, levyStones: false, growthByTier: null,
      lifespan: 0, tribulationAdd: 0,
      skillBonus: { alchemy: 0, forging: 0, trade: 0, leadership: 0 },
      terms: [],
    };

    for (const id of termIds) {
      const t = S.terms.get(id);
      if (!t) continue;
      agg.terms.push(t);
      const e = t.effects || {};
      for (const k of MUL_KEYS) if (e[k] !== undefined) agg[k] *= e[k];
      for (const k of ADD_KEYS) if (e[k] !== undefined) agg[k] += e[k];
      for (const k of SKILL_KEYS) if (e[k] !== undefined) agg.skillBonus[k] += e[k];
      if (e.levyStones) agg.levyStones = true;
      if (e.growthByTier) agg.growthByTier = e.growthByTier;
    }

    _aggCache.set(key, agg);
    if (_aggCache.size > 500) _aggCache.clear();
    return agg;
  }

  /** 弟子当前战力 */
  function power(d) {
    const agg = aggregate(d.terms);
    let p = R.basePower(d.realm, d.gengu, d.tianfu) * agg.powerMul;
    if (S.systems && S.systems.worldevent && S.state && S.state.data) {
      p *= S.systems.worldevent.bonus(S.state.data).powerMul || 1;
    }
    return Math.round(p);
  }

  /** 修炼效率（含大境界曲线与身份加成） */
  function growthMul(d) {
    const agg = aggregate(d.terms);
    let m = agg.growthMul;
    if (agg.growthByTier) {
      const tier = R.tierOf(d.realm);
      m *= agg.growthByTier[Math.min(tier, agg.growthByTier.length - 1)];
    }
    // 身份加成：长老修炼比杂役快得多
    const rank = S.ranks ? S.ranks.get(d.rank || 'menial') : null;
    if (rank) m *= rank.growth;
    // 驻地灵气：山门扎在哪儿，就吃哪儿的饭
    if (S.locations && S.state && S.state.data) {
      m *= S.locations.effectsOf(S.state.data).growthMul || 1;
    }
    return m;
  }

  /** 弟子某门技艺的实际值（静态值 + 词条加成） */
  function effSkill(d, key) {
    const base = (d.skills && d.skills[key]) || 0;
    const bonus = aggregate(d.terms).skillBonus[key] || 0;
    return U.clamp(Math.round(base + bonus), 0, 100);
  }

  /** 四项技艺的值 */
  function skillSheet(d) {
    return {
      alchemy: effSkill(d, 'alchemy'),
      forging: effSkill(d, 'forging'),
      trade: effSkill(d, 'trade'),
      leadership: effSkill(d, 'leadership'),
    };
  }

  // ---------------- 生成 ----------------
  function statRoll(base, spread, boost) {
    const v = base + U.rand(-spread, spread) + (boost || 0);
    return Math.round(U.clamp(v, 10, 99));
  }

  /**
   * 创建一名弟子。
   * opts.realm   初始境界
   * opts.quality 'starter' 保证较好的词条与属性
   * opts.terms   指定词条（不填则随机）
   */
  function create(opts) {
    opts = opts || {};
    const quality = opts.quality;
    const boost = quality === 'starter' ? 12 : 0;

    const gender = U.chance(0.55) ? 'm' : 'f';
    const realm = opts.realm === undefined ? 0 : opts.realm;

    // 词条数量：1 条 40%，2 条 42%，3 条 18%
    let nTerms;
    if (opts.terms) nTerms = opts.terms.length;
    else {
      const r = Math.random();
      nTerms = r < 0.4 ? 1 : r < 0.82 ? 2 : 3;
    }

    let termIds;
    if (opts.terms) {
      termIds = opts.terms.slice();
    } else {
      termIds = S.terms.roll(nTerms);
      if (quality === 'starter') {
        // 至少一条正面，避免初始弟子太差
        const hasGood = termIds.some((id) => S.terms.get(id).kind === 'good');
        if (!hasGood) {
          const goodPool = S.terms.TERMS.filter((t) => t.kind === 'good');
          termIds[0] = U.pick(goodPool).id;
        }
      }
    }

    const d = {
      id: U.uid('d'),
      name: S.names.personName(gender),
      gender,
      age: U.randInt(13, 20) + realm * 2,
      realm,
      exp: 0,
      tianfu: statRoll(58, 14, boost + realm * 3),
      wuxing: statRoll(52, 16, boost + realm * 2),
      daoxin: statRoll(52, 16, boost),
      gengu: statRoll(55, 16, boost + realm * 2),
      loyalty: U.randInt(55, 75),
      mood: U.randInt(55, 75),
      contribution: 0,
      terms: termIds,
      status: 'idle',
      injureWeeks: 0,
      guard: 0,
      breakBonus: 0,
      joinWeek: 0,
      missionId: null,
      lastAction: '初入宗门',
      bonds: {},
      history: [],
      recent: [],          // 近况：修炼、兑换这些不进年报的小事
      titles: [],
      weeksInSect: 0,
      totalContribution: 0,
      rank: 'menial',
      homeBuilding: null,
    };

    // 技艺四维：基础值随资质悟性浮动，词条会再叠加
    const sBase = Math.round(d.tianfu * 0.08 + d.wuxing * 0.12);
    d.skills = {
      alchemy: U.clamp(U.randInt(4, 30) + sBase, 5, 95),
      forging: U.clamp(U.randInt(4, 30) + sBase, 5, 95),
      trade: U.clamp(U.randInt(4, 30) + sBase, 5, 95),
      leadership: U.clamp(U.randInt(4, 30) + sBase, 5, 95),
    };

    if (realm > 0) {
      d.exp = Math.round(R.expNeed(realm) * U.rand(0.05, 0.35));
    }

    // 随机雅号
    if (U.chance(0.35)) d.titles.push(U.pick(S.names.TITLES));
    return d;
  }

  /** 收徒候选：比普通弟子质量略浮动 */
  function makeCandidate(avoidNames) {
    const r = Math.random();
    let quality = null;
    if (r < 0.12) quality = 'starter'; // 偶尔出现天赋异禀者
    const c = create({ quality });
    // 避免与同门重名
    if (avoidNames && avoidNames.size) {
      let guard = 0;
      while (avoidNames.has(c.name) && guard++ < 60) {
        c.name = S.names.personName(c.gender);
      }
    }
    c.isCandidate = true;
    c.candidateWeek = 0;
    c.rank = 'menial';   // 来投的人一律先从杂役做起
    // 候选者带一句自我介绍——都是来讨活路的，不是来当弟子的
    c.pitch = U.pick([
      '说家里遭了灾，来讨口饭吃。',
      '背着个破包袱，站在山门外头，不敢进来。',
      '问能不能留下干点杂活，管饭就行。',
      '是山下村子送来的，说这孩子力气大，能干活。',
      '原本在别家做杂役，听说这边管得松，想过来。',
      '瘦得厉害，可眼神不躲。',
      '一句话没说，先把身上的柴卸在了门口。',
      '说他什么都能干，就是不想饿死。',
    ]);
    return c;
  }

  // ---------------- 修炼 ----------------
  /**
   * 结算修为增长与突破。
   * ctx: { silent: boolean }  —— silent 时不写年报，只返回事件
   * 返回事件数组 [{text, kind}]
   */
  function gainExp(d, amount, ctx) {
    ctx = ctx || {};
    const events = [];
    if (amount <= 0) return events;
    d.exp += amount;

    let guard = 0;
    while (d.realm < R.maxRealm() && guard++ < 12) {
      const need = R.expNeed(d.realm);
      if (d.exp < need) break;

      // 炼气九层往上，每一次冲关都得过天劫
      if (d.realm >= TRIBULATION_FROM) {
        const r = tribulate(d, need, events);
        if (r === 'died') { d.dead = true; break; }
        if (r === 'fail') break;
        // 成功：tribulate 里已经升了级、扣了修为
        continue;
      }

      // 炼气期的寻常突破，直接过
      d.realm++;
      d.exp -= need;
      events.push({
        kind: 'breakthrough',
        text: `${d.name} 修为精进，晋入${R.realmName(d.realm)}。`,
        minor: true,
      });
    }

    if (d.exp > R.expNeed(d.realm)) d.exp = R.expNeed(d.realm);
    return events;
  }

  // =========================================================
  //  天劫
  // =========================================================
  /** 从这一层开始，往上每一关都要渡劫 */
  const TRIBULATION_FROM = 9;

  /**
   * 渡劫判定。
   * 返回 'ok'（已晋级） | 'fail'（重伤，修为倒退） | 'died'（没扛住）
   *
   * 天赋越强，越容易过。境界越高，劫越重。
   */
  function tribulate(d, need, events) {
    const agg = aggregate(d.terms);
    const nextTier = R.tierOf(d.realm + 1);

    const p = U.clamp(
      0.5
      + (d.tianfu - 50) / 170
      + (d.wuxing - 50) / 240
      + (d.daoxin - 50) / 260
      + (agg.tribulationAdd || 0)
      + (d.breakBonus || 0) * 0.55
      - nextTier * 0.045,
      0.06, 0.93
    );
    d.breakBonus = 0;

    if (Math.random() < p) {
      d.realm++;
      d.exp -= need;
      const tierName = R.realmName(d.realm);
      events.push({
        kind: 'tribulation',
        text: `${d.name} 渡过了${tierName}的天劫。雷云散尽，他站在焦土里，` +
          `身上的气息已经不是昨天那个人了。`,
        meta: `渡劫成功 · ${tierName}`,
        major: true,   // 大境界突破，年报里必须留一笔
      });
      addHistory(d, `渡劫成功，晋入${tierName}`);
      return 'ok';
    }

    // 没过去：可能死，也可能只是重伤
    const deathP = U.clamp(
      (0.3 + nextTier * 0.055) * (agg.deathResist || 1),
      0.04, 0.8
    );

    if (Math.random() < deathP) {
      events.push({
        kind: 'danger',
        text: `${d.name} 没能扛过这一道天雷。` +
          `劫云散的时候，原地只剩下一片焦黑，和一枚烧变形的腰牌。`,
        meta: '渡劫身亡',
      });
      return 'died';
    }

    // 重伤：修为倒退、长期养伤
    d.exp = Math.round(need * 0.55);
    const tmp = [];
    injure(d, U.randInt(2, 4), tmp, '渡劫失败');
    for (const ev of tmp) events.push(ev);
    events.push({
      kind: 'danger',
      text: `${d.name} 的劫没渡过去。人活着，可一身修为折了大半，` +
        `经脉里像留下了什么东西。再想冲一次，得先养很多年。`,
      meta: '渡劫失败 · 重伤',
    });
    addHistory(d, '渡劫失败，重伤');
    return 'fail';
  }

  // =========================================================
  //  寿元
  // =========================================================
  // 各境界额外带来的寿数（叠在凡人的基数上）
  const LIFE_BY_REALM = [
    0,                                        // 凡人
    20, 40, 60, 80, 100, 120, 140, 160, 190,  // 炼气一至九层
    260, 320, 380,                            // 筑基
    620, 720, 820,                            // 金丹
    1250, 1450, 1650,                         // 元婴
    2600,                                     // 化神
  ];

  /** 这名弟子的寿元上限 */
  function lifespanOf(d) {
    const idx = Math.min(d.realm, LIFE_BY_REALM.length - 1);
    const base = 90 + (LIFE_BY_REALM[idx] || 0);
    const bonus = aggregate(d.terms).lifespan || 0;
    return Math.max(25, Math.round(base + bonus));
  }

  function addHistory(d, text) {
    d.history.push({ week: S.state.data ? S.state.data.week : 0, text });
    if (d.history.length > 60) d.history.shift();
  }

  /** 受伤 */
  function injure(d, weeks, events, reason) {
    if (d.guard > 0) {
      d.guard = 0;
      events.push({ kind: 'info', text: `${d.name} 身上的护心符化作一片红光，替他挡了一劫。` });
      return false;
    }
    d.injureWeeks = Math.max(d.injureWeeks, weeks);
    d.status = 'injured';
    d.mood = U.clamp(d.mood - 8, 0, 100);
    if (reason) addHistory(d, `因${reason}受伤`);
    return true;
  }

  /** 每年自然修炼（未出任务时） */
  function trainWeek(d, opts) {
    opts = opts || {};
    const events = [];
    if (d.injureWeeks > 0) {
      d.injureWeeks--;
      events.push({
        kind: 'info',
        text: `${d.name} 正在养伤，本年未能静心修炼。`,
        minor: true,
      });
      if (d.injureWeeks <= 0) {
        d.status = 'idle';
        events.push({ kind: 'info', text: `${d.name} 伤势痊愈，重新开始修炼。` });
      }
      // 养伤期间少量恢复
      return events;
    }

    const mul = growthMul(d);
    // 一年只涨这么点：炼气期一层要三五年，筑基之后动辄几十年
    const base = 9 * (1 + d.realm * 0.35);
    const gain = base * (d.tianfu / 65) * (d.wuxing / 70) * mul * U.rand(0.85, 1.15);
    const before = d.realm;
    events.push(...gainExp(d, gain, opts));
    if (!events.length && d.realm === before) {
      d.lastAction = '静修';
    }
    return events;
  }

  // ---------------- 其它 ----------------
  function addContribution(d, n) {
    const agg = aggregate(d.terms);
    const rank = S.ranks ? S.ranks.get(d.rank || 'menial') : { contrib: 1 };
    const real = Math.round(n * agg.contributionMul * rank.contrib);
    d.contribution += real;
    d.totalContribution += real;
    return real;
  }

  function adjustLoyalty(d, n) {
    const agg = aggregate(d.terms);
    d.loyalty = U.clamp(d.loyalty + n + (n > 0 ? 0 : 0), 0, 100);
    return d.loyalty;
  }

  function adjustMood(d, n) {
    d.mood = U.clamp(d.mood + n, 0, 100);
  }

  /** 词条文本列表（给 UI） */
  function termList(d) {
    // hidden 的是认主之物的数值载体，不在词条栏里露脸
    return d.terms
      .map((id) => S.terms.get(id))
      .filter((t) => t && !t.hidden);
  }

  /** 认主之物（跟着主人走，别人拿不走） */
  function relicList(d) {
    if (!Array.isArray(d.relics)) return [];
    return d.relics
      .map((x) => S.sagas && S.sagas.relic(x.id))
      .filter(Boolean);
  }

  function aggOf(d) {
    return aggregate(d.terms);
  }

  S.disciple = {
    aggregate, aggOf, power, growthMul, effSkill, skillSheet,
    create, makeCandidate,
    gainExp, trainWeek, injure, addHistory,
    addContribution, adjustLoyalty, adjustMood, termList, relicList,
    lifespanOf, tribulate, TRIBULATION_FROM,
  };
})(window.Sect);
