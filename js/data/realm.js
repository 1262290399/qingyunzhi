/* ===========================================================
 * realm.js — 境界体系与修为/战力换算
 * =========================================================== */
(function (S) {
  'use strict';

  /**
   * 境界表。expNeed = 从该境界突破到下一境界所需修为。
   * major = 是否大境界（突破需要判定，失败有代价）。
   */
  const REALMS = [
    { name: '凡人',       expNeed: 40,    major: false },
    { name: '炼气一层',   expNeed: 70,    major: false },
    { name: '炼气二层',   expNeed: 110,   major: false },
    { name: '炼气三层',   expNeed: 160,   major: false },
    { name: '炼气四层',   expNeed: 220,   major: false },
    { name: '炼气五层',   expNeed: 290,   major: false },
    { name: '炼气六层',   expNeed: 370,   major: false },
    { name: '炼气七层',   expNeed: 460,   major: false },
    { name: '炼气八层',   expNeed: 560,   major: false },
    { name: '炼气九层',   expNeed: 700,   major: true  },  // → 筑基
    { name: '筑基初期',   expNeed: 900,   major: false },
    { name: '筑基中期',   expNeed: 1150,  major: false },
    { name: '筑基后期',   expNeed: 1450,  major: true  },  // → 金丹
    { name: '金丹初期',   expNeed: 1800,  major: false },
    { name: '金丹中期',   expNeed: 2200,  major: false },
    { name: '金丹后期',   expNeed: 2700,  major: true  },  // → 元婴
    { name: '元婴初期',   expNeed: 3300,  major: false },
    { name: '元婴中期',   expNeed: 4000,  major: false },
    { name: '元婴后期',   expNeed: 4800,  major: true  },
    { name: '化神期',     expNeed: 5800,  major: false },
  ];

  /** 大境界段位，用于 UI 配色 */
  const TIER = [
    { name: '凡', cls: 'tier-fan' },
    { name: '炼气', cls: 'tier-lianqi' },
    { name: '筑基', cls: 'tier-zhuji' },
    { name: '金丹', cls: 'tier-jindan' },
    { name: '元婴', cls: 'tier-yuanying' },
    { name: '化神', cls: 'tier-huashen' },
  ];

  function tierOf(realm) {
    if (realm <= 0) return 0;
    if (realm <= 9) return 1;
    if (realm <= 12) return 2;
    if (realm <= 15) return 3;
    if (realm <= 18) return 4;
    return 5;
  }

  const realmName = (r) => (REALMS[r] || REALMS[REALMS.length - 1]).name;
  const expNeed = (r) => (REALMS[r] || REALMS[REALMS.length - 1]).expNeed;
  const isMajor = (r) => !!(REALMS[r] && REALMS[r].major);
  const maxRealm = () => REALMS.length - 1;

  /**
   * 战力：由境界主导，根骨/资质做系数修正。
   * 这里只算"基础战力"，词条倍率由 disciple 系统叠加。
   */
  function basePower(realm, gengu, tianfu) {
    const base = 14 + realm * 11;
    return base * (0.55 + gengu / 100) * (0.85 + tianfu / 400);
  }

  /** 战力对应的等级描述，用于任务难度对比 */
  function powerLabel(p) {
    if (p < 20) return '凡俗';
    if (p < 45) return '初窥门径';
    if (p < 90) return '小有所成';
    if (p < 160) return '登堂入室';
    if (p < 280) return '炉火纯青';
    if (p < 460) return '出神入化';
    return '深不可测';
  }

  S.realm = { REALMS, TIER, tierOf, realmName, expNeed, isMajor, maxRealm, basePower, powerLabel };
})(window.Sect);
