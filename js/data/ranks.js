/* ===========================================================
 * ranks.js — 宗门内的身份序列
 *
 * 杂役 → 外门 → 内门 → 亲传 → 长老
 *
 * 宗主是玩家自己，不在弟子序列里。
 * 身份影响三件事：修炼效率、贡献倍率、能不能进建筑。
 *
 * 晋升规则：
 *   杂役 → 外门   自动（入宗满 8年，且贡献或境界达标）
 *   外门 → 内门   只能靠宗门大比（每 10年一次，冠军晋级）
 *   内门 → 亲传   长老推荐 / 宗主直接任命
 *   内门 → 长老   宗主任命
 * =========================================================== */
(function (S) {
  'use strict';

  const RANKS = [
    {
      id: 'menial', name: '杂役弟子', level: 0,
      growth: 0.8, contrib: 0.85,
      cls: 'rank-menial',
      desc: '劈柴、挑水、扫台阶。没人指望他们成器，可宗门总得有人干这些。',
      canEnter: ['lingtian', 'lingkuang'],
    },
    {
      id: 'outer', name: '外门弟子', level: 1,
      growth: 1.0, contrib: 1.0,
      cls: 'rank-outer',
      desc: '有资格听早课，有一间自己的小屋。往上一步是内门，很多人一辈子卡在这。',
      canEnter: ['lingtian', 'lingkuang', 'danfang', 'qige'],
    },
    {
      id: 'inner', name: '内门弟子', level: 2,
      growth: 1.18, contrib: 1.15,
      cls: 'rank-inner',
      desc: '宗门真正的中坚。月例、丹房、藏经阁，都向他们敞开。',
      canEnter: ['lingtian', 'lingkuang', 'danfang', 'qige', 'zhangfang', 'cangjing'],
    },
    {
      id: 'personal', name: '亲传弟子', level: 3,
      growth: 1.38, contrib: 1.32,
      cls: 'rank-personal',
      desc: '有名有姓的徒弟。师父一句话，抵得上半年苦修。',
      canEnter: ['lingtian', 'lingkuang', 'danfang', 'qige', 'zhangfang', 'cangjing'],
    },
    {
      id: 'elder', name: '长老', level: 4,
      growth: 1.55, contrib: 1.45,
      cls: 'rank-elder',
      desc: '可以拍板的人。宗门大事，宗主要先问过他们。',
      canEnter: ['lingtian', 'lingkuang', 'danfang', 'qige', 'zhangfang', 'cangjing', 'zhaoxian'],
    },
  ];

  const BY_ID = {};
  for (const r of RANKS) BY_ID[r.id] = r;

  const get = (id) => BY_ID[id] || BY_ID.menial;
  const nameOf = (id) => get(id).name;
  const levelOf = (id) => get(id).level;

  /** a 是否不低于 b */
  function atLeast(rankId, minId) {
    return levelOf(rankId) >= levelOf(minId);
  }

  /** 该身份能否入驻某建筑 */
  function canEnter(rankId, buildingId) {
    return get(rankId).canEnter.includes(buildingId);
  }

  /** 杂役晋升外门的门槛：干满几年，且有点功绩或修为 */
  const OUTER_REQ = { weeks: 6, contribution: 120, realm: 4 };

  function canPromoteToOuter(d, week) {
    const weeks = week - (d.joinWeek || 0);
    if (weeks < OUTER_REQ.weeks) return { ok: false, reason: '入宗未满八年' };
    if (d.contribution >= OUTER_REQ.contribution || d.realm >= OUTER_REQ.realm) {
      return { ok: true };
    }
    return { ok: false, reason: '功绩或修为不足' };
  }

  /** 晋升到内门需要什么（仅用于文案说明） */
  const INNER_NOTE = '只能在宗门大比中夺魁';
  const PERSONAL_NOTE = '需长老举荐或宗主钦点';

  S.ranks = {
    RANKS, BY_ID, get, nameOf, levelOf, atLeast, canEnter,
    OUTER_REQ, canPromoteToOuter,
    INNER_NOTE, PERSONAL_NOTE,
  };
})(window.Sect);
