/* ===========================================================
 * sect.js — 宗门本身：规模、等级、驻地、年俸
 *
 * 三件事被拆开了：
 *   规模 → 能收多少人（扩建 / 搬迁决定）
 *   等级 → 声望 与 最强弟子实力 共同评定
 *   驻地 → 一套得失（修炼、年俸、招徒、矿脉……）
 * =========================================================== */
(function (S) {
  'use strict';

  // 规模：只决定容得下多少人
  const SCALES = [
    { name: '茅庐', capacity: 6, cost: 0 },
    { name: '小院', capacity: 12, cost: 2500 },
    { name: '庄院', capacity: 20, cost: 7000 },
    { name: '山门', capacity: 30, cost: 18000 },
    { name: '洞天', capacity: 44, cost: 45000 },
    { name: '福地', capacity: 60, cost: 100000 },
  ];

  // 等级：声望与最强实力，两样都得跟上
  const GRADE_REQ = [
    { rep: 0, power: 0 },
    { rep: 90, power: 45 },
    { rep: 240, power: 100 },
    { rep: 500, power: 180 },
    { rep: 900, power: 300 },
    { rep: 1500, power: 480 },
    { rep: 2400, power: 750 },
    { rep: 3800, power: 1150 },
    { rep: 6000, power: 1750 },
    { rep: 9500, power: 2600 },
  ];

  const MAX_GRADE = GRADE_REQ.length;
  const MAX_SCALE = SCALES.length - 1;

  const scaleOf = (st) => SCALES[Math.min(st.sect.scale | 0, MAX_SCALE)] || SCALES[0];

  /** 宗门最强弟子的战力 */
  function bestPower(st) {
    let best = 0;
    for (const d of st.disciples) {
      const p = S.disciple.power(d);
      if (p > best) best = p;
    }
    return best;
  }

  /** 当前能达到的等级（1~10） */
  function gradeOf(st) {
    const rep = st.sect.reputation;
    const pow = bestPower(st);
    let g = 1;
    for (let i = 0; i < GRADE_REQ.length; i++) {
      if (rep >= GRADE_REQ[i].rep && pow >= GRADE_REQ[i].power) g = i + 1;
      else break;
    }
    return g;
  }

  /** 下一级还差什么 */
  function nextGradeGap(st) {
    const g = gradeOf(st);
    if (g >= MAX_GRADE) return null;
    const req = GRADE_REQ[g];
    return {
      rep: Math.max(0, req.rep - st.sect.reputation),
      power: Math.max(0, req.power - bestPower(st)),
      req,
    };
  }

  /** 每年结算时把等级刷新到 st.sect.level */
  function refreshGrade(st) {
    const g = gradeOf(st);
    const old = st.sect.level || 1;
    st.sect.level = g;
    if (g > old) return g;
    return 0;
  }

  /** 容量 = 规模 + 驻地加成 */
  function capacityOf(st) {
    const eff = S.locations.effectsOf(st);
    return scaleOf(st).capacity + (eff.capacityBonus || 0);
  }

  // ---------------- 扩建 ----------------
  function expandCost(st) {
    const next = (st.sect.scale | 0) + 1;
    if (next > MAX_SCALE) return null;
    return SCALES[next].cost;
  }

  function expand(st) {
    const next = (st.sect.scale | 0) + 1;
    if (next > MAX_SCALE) return { ok: false, msg: '已经是最大的规模了。' };
    const cost = SCALES[next].cost;
    if (st.sect.spiritStones < cost) {
      return { ok: false, msg: `灵石不够，扩建要 ${cost}。` };
    }
    S.state.addStones(-cost);
    st.sect.scale = next;
    S.state.addLog(`宗门扩建为${SCALES[next].name}，可容纳弟子 ${capacityOf(st)} 人。`, 'sect');
    return {
      ok: true,
      msg: `${SCALES[next].name}落成，如今能容下 ${capacityOf(st)} 名弟子。`,
    };
  }

  // ---------------- 搬迁 ----------------
  function canRelocate(st, locId) {
    const loc = S.locations.get(locId);
    if (!loc) return { ok: false, msg: '没有这个地方。' };
    if ((st.sect.location || 'houshan') === locId) {
      return { ok: false, msg: '已经在那儿了。' };
    }
    if (gradeOf(st) < loc.minGrade) {
      return { ok: false, msg: `宗门等级不够，至少要 ${loc.minGrade} 级才站得住。` };
    }
    if (st.sect.spiritStones < loc.cost) {
      return { ok: false, msg: `搬迁要 ${loc.cost} 灵石，不够。` };
    }
    // 那边得住得下现有人数，不然搬过去一半人得睡山沟
    const newCap = scaleOf(st).capacity + (loc.effects.capacityBonus || 0);
    if (st.disciples.length > newCap) {
      return {
        ok: false,
        msg: `${loc.name}只容得下 ${newCap} 人，如今门下有 ${st.disciples.length} 人，住不开。`,
      };
    }
    return { ok: true, loc };
  }

  function relocate(st, locId) {
    const r = canRelocate(st, locId);
    if (!r.ok) return r;

    const loc = r.loc;
    S.state.addStones(-loc.cost);

    // 搬一次家伤筋动骨：声望掉一成，弟子心情受影响
    const repLoss = Math.round(st.sect.reputation * 0.1);
    st.sect.reputation = Math.max(0, st.sect.reputation - repLoss);
    st.sect.location = locId;
    for (const d of st.disciples) {
      S.disciple.adjustMood(d, -8);
    }

    S.state.addLog(`宗门迁往${loc.name}。`, 'sect');
    return {
      ok: true,
      msg: `宗门迁到了${loc.name}。安顿下来花了些时日。`,
      repLoss,
    };
  }

  // ---------------- 年俸 ----------------
  const RANK_UPKEEP = {
    menial: 0.5, outer: 1, inner: 1.3, personal: 1.7, elder: 2.2,
  };

  /** 一名弟子每年的开销 */
  function upkeepOf(d) {
    const realmCost = 4 + d.realm * 3;
    const rm = RANK_UPKEEP[d.rank || 'menial'] || 1;
    return realmCost * rm;
  }

  /** 全宗门每年要花多少 */
  function totalUpkeep(st) {
    const eff = S.locations.effectsOf(st);
    let sum = 0;
    for (const d of st.disciples) sum += upkeepOf(d);
    return Math.round(sum * (eff.upkeepMul || 1));
  }

  S.sect = {
    SCALES, GRADE_REQ, MAX_GRADE, MAX_SCALE, RANK_UPKEEP,
    scaleOf, bestPower, gradeOf, nextGradeGap, refreshGrade,
    capacityOf, expandCost, expand,
    canRelocate, relocate,
    upkeepOf, totalUpkeep,
  };
  // 两处都能拿到，免得调用方记混
  S.systems = S.systems || {};
  S.systems.sect = S.sect;
})(window.Sect);
