/* ===========================================================
 * missions.js — 宗门任务模板
 *
 * 任务由年推进系统按宗门等级从模板池里刷新，弟子自主接取。
 * =========================================================== */
(function (S) {
  'use strict';

  const TEMPLATES = [
    // ---------------- 一阶 ----------------
    {
      id: 'm_yaocao', name: '山中采药', type: 'gather', tier: 1,
      powerNeed: 15, contrib: 18, stones: [20, 45], rep: 1,
      region: 'houshan',
      desc: '药堂缺几味常用药材，去后山采些回来。',
    },
    {
      id: 'm_xiuqiang', name: '修补围墙', type: 'guard', tier: 1,
      powerNeed: 20, contrib: 16, stones: [15, 35], rep: 1,
      region: 'houshan',
      desc: '上月山洪冲垮了西侧围墙，需要人手搬石垒墙。',
    },
    {
      id: 'm_songxin', name: '坊市送信', type: 'escort', tier: 1,
      powerNeed: 25, contrib: 22, stones: [30, 60], rep: 1,
      region: 'luoxiagu',
      desc: '把宗主的信送到落霞谷坊市的旧识手里。',
    },
    {
      id: 'm_yetu', name: '清剿野兔', type: 'hunt', tier: 1,
      powerNeed: 18, contrib: 20, stones: [25, 50], rep: 1,
      region: 'houshan',
      desc: '灵田被野兔糟蹋得不成样子，去抓几只回来。',
    },
    {
      id: 'm_kanmen', name: '山门值守', type: 'guard', tier: 1,
      powerNeed: 22, contrib: 18, stones: [20, 40], rep: 1,
      region: 'houshan',
      desc: '在牌坊下守三日，登记往来人等。',
    },

    // ---------------- 二阶 ----------------
    {
      id: 'm_yaoshou', name: '猎杀一阶妖兽', type: 'hunt', tier: 2,
      powerNeed: 55, contrib: 48, stones: [90, 180], rep: 2,
      region: 'heifengkuang',
      desc: '矿洞外有妖兽伤人，取它内丹回来复命。',
    },
    {
      id: 'm_huwei', name: '护送商队', type: 'escort', tier: 2,
      powerNeed: 70, contrib: 55, stones: [120, 240], rep: 2,
      region: 'luoxiagu',
      desc: '一支商队要走黑风岭，需要修士压阵。',
    },
    {
      id: 'm_zhenya', name: '镇压山匪', type: 'hunt', tier: 2,
      powerNeed: 85, contrib: 65, stones: [150, 300], rep: 3,
      region: 'luoxiagu',
      desc: '一伙凡匪聚众劫掠山下村落，去把他们打散。',
    },
    {
      id: 'm_tanlu', name: '勘探灵脉', type: 'explore', tier: 2,
      powerNeed: 60, contrib: 50, stones: [80, 200], rep: 2,
      region: 'miwuyanlin',
      desc: '宗门打算新辟灵田，先摸清妖林外围的情况。',
    },
    {
      id: 'm_hushan', name: '镇守药园', type: 'guard', tier: 2,
      powerNeed: 65, contrib: 45, stones: [100, 200], rep: 2,
      region: 'houshan',
      desc: '药园近日常有贼人窥伺，守上半月。',
    },

    // ---------------- 三阶 ----------------
    {
      id: 'm_guzhan', name: '古战场拾遗', type: 'explore', tier: 3,
      powerNeed: 180, contrib: 110, stones: [280, 520], rep: 4,
      region: 'duanhun',
      desc: '断魂古战场最近塌了一角，露出的东西值得一看。',
    },
    {
      id: 'm_yaowang', name: '讨伐妖王', type: 'hunt', tier: 3,
      powerNeed: 240, contrib: 150, stones: [400, 800], rep: 6,
      region: 'miwuyanlin',
      desc: '妖林深处的老妖已经成气候，再拖下去要出大乱。',
    },
    {
      id: 'm_huyuan', name: '驰援友宗', type: 'escort', tier: 3,
      powerNeed: 200, contrib: 130, stones: [320, 600], rep: 6,
      region: 'duanhun',
      desc: '邻宗被邪修围困，飞书求援。去不去，是个态度。',
    },
    {
      id: 'm_zhenmo', name: '封印裂隙', type: 'guard', tier: 3,
      powerNeed: 220, contrib: 140, stones: [350, 700], rep: 5,
      region: 'duanhun',
      desc: '古战场中央裂开一道缝隙，阴气外泄，需以符阵封住。',
    },

    // ---------------- 四阶 ----------------
    {
      id: 'm_guixu', name: '探归墟', type: 'explore', tier: 4,
      powerNeed: 400, contrib: 260, stones: [700, 1400], rep: 9,
      region: 'guixu',
      desc: '宗门典籍里对归墟语焉不详。去看一眼，活着回来。',
    },
    {
      id: 'm_damo', name: '斩杀魔修', type: 'hunt', tier: 4,
      powerNeed: 460, contrib: 300, stones: [900, 1800], rep: 12,
      region: 'guixu',
      desc: '一名结丹魔修在归墟一带屠了三个村子。',
    },
    {
      id: 'm_zhenzong', name: '宗门大比压阵', type: 'guard', tier: 4,
      powerNeed: 380, contrib: 240, stones: [600, 1200], rep: 10,
      region: 'houshan',
      desc: '十年一度的宗门大比，需要高手坐镇以防有人捣乱。',
    },
  ];

  const BY_ID = {};
  for (const t of TEMPLATES) BY_ID[t.id] = t;

  const TYPE_NAME = {
    gather: '采集', hunt: '除妖', escort: '护送', guard: '镇守', explore: '探索',
  };
  const TYPE_ICON = {
    gather: '采', hunt: '斩', escort: '护', guard: '守', explore: '探',
  };

  /** 宗门等级 → 每年刷新任务数与可用阶数 */
  const LEVEL_CONF = [
    { maxTier: 1, count: 3 },  // 1 级
    { maxTier: 2, count: 4 },  // 2
    { maxTier: 2, count: 5 },  // 3
    { maxTier: 3, count: 5 },  // 4
    { maxTier: 3, count: 6 },  // 5
    { maxTier: 4, count: 6 },  // 6
    { maxTier: 4, count: 7 },  // 7+
  ];

  function confForLevel(level) {
    return LEVEL_CONF[Math.min(level - 1, LEVEL_CONF.length - 1)];
  }

  function templatesUpTo(tier) {
    return TEMPLATES.filter((t) => t.tier <= tier);
  }

  S.missions = { TEMPLATES, BY_ID, TYPE_NAME, TYPE_ICON, confForLevel, templatesUpTo };
})(window.Sect);
