/* ===========================================================
 * mission.js — 宗门任务的刷新与判定
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;

  /** 刷新任务板（保留已被接取但未结算的任务） */
  function refresh(st) {
    const conf = S.missions.confForLevel(st.sect.level);
    const pool = S.missions.templatesUpTo(conf.maxTier);
    const keep = (st.missions || []).filter((m) => m.status === 'taken');
    const list = keep.slice();
    const used = new Set(list.map((m) => m.tplId));
    let guard = 0;

    while (list.length < conf.count && guard++ < 300) {
      const tpl = U.weighted(pool, (t) => {
        // 低阶任务权重略高，保证总有活干
        const base = t.tier === 1 ? 30 : t.tier === 2 ? 22 : t.tier === 3 ? 12 : 6;
        return used.has(t.id) ? 0 : base;
      });
      if (!tpl || used.has(tpl.id)) {
        if (guard > 100) break;
        continue;
      }
      used.add(tpl.id);
      list.push(instantiate(tpl, st.sect.level));
    }

    st.missions = list;
    return list;
  }

  function instantiate(tpl, level) {
    const jitter = U.rand(0.9, 1.15);
    return {
      id: U.uid('m'),
      tplId: tpl.id,
      name: tpl.name,
      type: tpl.type,
      tier: tpl.tier,
      powerNeed: Math.round(tpl.powerNeed * jitter * (1 + (level - 1) * 0.04)),
      contrib: Math.round(tpl.contrib * U.rand(0.9, 1.2)),
      stones: Math.round(U.rand(tpl.stones[0], tpl.stones[1])),
      rep: tpl.rep,
      desc: tpl.desc,
      region: tpl.region,
      status: 'open',
      takenBy: null,
      takenWeek: null,
    };
  }

  /** 宗门整体任务池里，适合该弟子战力且空着的任务 */
  function suitableFor(st, d) {
    const p = S.disciple.power(d);
    return st.missions.filter((m) => {
      if (m.status !== 'open') return false;
      // 战力太低的不接（会送命）
      if (m.powerNeed > p * 1.9) return false;
      return true;
    });
  }

  /**
   * 弟子挑选任务：偏好"跳一跳够得着"的，贡献/风险比高的。
   */
  function pickFor(st, d) {
    const agg = S.disciple.aggOf(d);
    const p = S.disciple.power(d);
    const list = suitableFor(st, d);
    if (!list.length) return null;

    const scored = list.map((m) => {
      const ratio = p / Math.max(1, m.powerNeed);
      // 战力远超需求则不感兴趣（没有油水）
      let score = m.contrib / Math.max(1, m.powerNeed);
      if (ratio < 0.8) score *= 0.35;      // 打不过，谨慎
      else if (ratio > 2.6) score *= 0.55; // 太轻松，没意思
      // 好斗/战斗倾向偏好除妖
      if (agg.terms.some((t) => t.tags.includes('combat'))) {
        if (m.type === 'hunt') score *= 1.5;
        if (m.type === 'guard') score *= 0.85;
      }
      if (agg.terms.some((t) => t.tags.includes('lucky')) && m.type === 'explore') score *= 1.4;
      if (agg.terms.some((t) => t.tags.includes('lonely')) && m.type === 'escort') score *= 0.7;
      score *= U.rand(0.85, 1.2);
      return { m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].m;
  }

  function take(st, m, d) {
    m.status = 'taken';
    m.takenBy = d.id;
    m.takenWeek = st.week;
    d.missionId = m.id;
    d.status = 'mission';
    return m;
  }

  S.systems = S.systems || {};
  S.systems.mission = { refresh, instantiate, suitableFor, pickFor, take };
})(window.Sect);
