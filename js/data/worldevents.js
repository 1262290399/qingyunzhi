/* ===========================================================
 * worldevents.js — 大事件与主线
 *
 * 两类：
 *   trial    每 15~25 年一次的常规考验（兽潮、比武、灾荒……）
 *   mainline 贯穿全局的魔劫主线，分四章
 *
 * 判定核心：把弟子的战力凑起来，和事件强度比。
 * 失败不致命——常规事件损失有限，主线失败只是贴一个
 * "魔劫余烬"的 debuff，降修炼、催人才，撑到下一章就好。
 * =========================================================== */
(function (S) {
  'use strict';

  // =========================================================
  //  阵法（永久，占阵法位，最多 3 个）
  // =========================================================
  const ARRAYS = [
    {
      id: 'juling', name: '聚灵阵', icon: '灵',
      desc: '引地脉灵气入山门，弟子吐纳事半功倍。',
      effects: { growthMul: 1.12 },
    },
    {
      id: 'hushan', name: '护山大阵', icon: '护',
      desc: '山门罩着一层光，寻常妖兽撞不进来。',
      effects: { injureMul: 0.75 },
    },
    {
      id: 'jubao', name: '聚宝阵', icon: '财',
      desc: '财气聚而不散，灵矿与灵田的产出都厚一些。',
      effects: { mineMul: 1.2 },
    },
    {
      id: 'zhenhun', name: '镇魂阵', icon: '魂',
      desc: '钟声一响，人心就定。弟子不容易起异心。',
      effects: { loyaltyDrift: 1.5 },
    },
    {
      id: 'zhuxie', name: '诛邪阵', icon: '诛',
      desc: '专为魔物所布。邪祟入阵，战力先折三分。',
      effects: { vsDemon: 1.3 },
    },
  ];

  // =========================================================
  //  灵宝（永久，占灵宝位，最多 3 件）
  // =========================================================
  const TREASURES = [
    {
      id: 'zhenzongjian', name: '镇宗剑', icon: '剑',
      desc: '开山祖师留下的剑。挂在殿上，宗门弟子出手都硬三分。',
      effects: { powerMul: 1.1 },
    },
    {
      id: 'shanheyin', name: '山河印', icon: '印',
      desc: '一方旧印。盖在公文上，天下人都认。',
      effects: { repMul: 1.25 },
    },
    {
      id: 'wanminsan', name: '万民伞', icon: '伞',
      desc: '百姓送的。撑着它站在山门口，来投的人就多。',
      effects: { recruitMul: 1.4 },
    },
    {
      id: 'yudie', name: '传功玉牒', icon: '牒',
      desc: '历代宗主的手札合订。后人翻一遍，少走十年弯路。',
      effects: { growthMul: 1.1, breakthroughAdd: 0.08 },
    },
  ];

  // =========================================================
  //  常规考验
  // =========================================================
  const TRIALS = [
    {
      id: 'beast_tide',
      name: '兽潮',
      icon: '兽',
      desc: '黑风岭的妖兽成群下山，一路啃到山脚下。',
      detail: '村子的炊烟断了三天。第四天，有人看见林子边缘的树在动。',
      options: [
        {
          id: 'all', text: '倾巢而出', hint: '所有能动的都上，伤亡难料',
          kind: 'battle', full: true,
        },
        {
          id: 'elite', text: '精锐迎击', hint: '只派战力最高的几人',
          kind: 'battle', top: 3,
        },
        {
          id: 'close', text: '闭山不出', hint: '护住山门，山下的事不管了',
          kind: 'evade',
        },
      ],
      power: (st) => 120 + st.sect.level * 90 + Math.floor(st.week * 2.2),
      win: { rep: 12, stones: [600, 1400], item: ['yaowangneidan', 'xuanTie'] },
      lose: { rep: -6, deathChance: 0.18, injure: 0.55 },
      evade: { rep: -10, loyalty: -4 },
    },
    {
      id: 'duel_meet',
      name: '邻宗比武',
      icon: '武',
      desc: '铁剑门递了帖子，说要来切磋三场。',
      detail: '帖子上写得很客气，字里行间却不是那个意思。',
      options: [
        {
          id: 'elite', text: '接帖应战', hint: '派三名最强的弟子',
          kind: 'battle', top: 3,
        },
        {
          id: 'all', text: '全员列阵', hint: '气势上先赢一头，但打得难看',
          kind: 'battle', full: true,
        },
        {
          id: 'decline', text: '称病推了', hint: '不丢脸，但面子肯定没了',
          kind: 'evade',
        },
      ],
      power: (st) => 100 + st.sect.level * 110 + Math.floor(st.week * 2.6),
      win: { rep: 15, stones: [400, 900], item: ['pijingdan', 'huiyuandan'] },
      lose: { rep: -8, deathChance: 0.06, injure: 0.4 },
      evade: { rep: -12, loyalty: -2 },
    },
    {
      id: 'famine',
      name: '旱灾',
      icon: '灾',
      desc: '山下绝收。流民成群结队往山上涌。',
      detail: '山门外的路上，全是拖家带口的人。他们不走，也不闹，就那么坐着。',
      options: [
        {
          id: 'relief', text: '开仓赈济', hint: '花一大笔灵石',
          kind: 'spend', cost: (st) => 800 + st.sect.level * 300,
        },
        {
          id: 'close', text: '紧闭山门', hint: '省下这笔钱，但名声要坏',
          kind: 'evade',
        },
      ],
      power: () => 0,
      win: { rep: 18, stones: [-200, 300], recruit: 2 },
      lose: { rep: -10, deathChance: 0, injure: 0 },
      evade: { rep: -14, loyalty: -6 },
    },
    {
      id: 'ruins',
      name: '古墓现世',
      icon: '墓',
      desc: '山洪冲开了一座古墓，里面还亮着灯。',
      detail: '附近几个宗门都动了心思。谁先进去，谁先挑。',
      options: [
        {
          id: 'elite', text: '派精锐进去', hint: '战力最高的三人',
          kind: 'battle', top: 3,
        },
        {
          id: 'all', text: '带上一批人', hint: '人多抢得多，也容易出事',
          kind: 'battle', full: true,
        },
        {
          id: 'close', text: '不掺和', hint: '这种事，进去的人很少全须全尾地出来',
          kind: 'evade',
        },
      ],
      power: (st) => 150 + st.sect.level * 80 + Math.floor(st.week * 2.0),
      win: { rep: 10, stones: [300, 800], item: ['longxianguo', 'xiuSuiDan'] },
      lose: { rep: -4, deathChance: 0.22, injure: 0.65 },
      evade: { rep: -3, loyalty: 0 },
    },
  ];

  // =========================================================
  //  主线：魔劫
  // =========================================================
  const MAINLINE = [
    {
      id: 'm1',
      year: 60,
      name: '魔气南侵',
      icon: '魔',
      desc: '北边的天，红了整整一个月。',
      detail:
        '先是飞鸟不落，然后是河水变苦，再然后，边关传来消息——' +
        '北边裂了一道口子，底下的东西出来了。',
      power: 260,
      reward: { array: 'zhuxie', treasure: null, rep: 40, stones: 3000, term: 'yumo' },
      hint: '这是第一次露头，来的不过是些魔气化形的杂兵。',
    },
    {
      id: 'm2',
      year: 115,
      name: '魔潮压境',
      icon: '潮',
      desc: '魔潮南下，三个州县一夜之间没了人。',
      detail:
        '逃难的人从北边过来，一路走一路死。有人说看见了不该看见的东西，' +
        '话没说完就咽了气。',
      power: 700,
      reward: { array: null, treasure: 'zhenzongjian', rep: 80, stones: 8000, term: 'tiebi' },
      hint: '魔潮不是杂兵了。这一次，是真东西。',
    },
    {
      id: 'm3',
      year: 175,
      name: '魔将现身',
      icon: '将',
      desc: '一个披甲的影子立在边境上，站了七天没动。',
      detail:
        '所有修士的灵识扫过去，都被弹了回来。有人说那不是人。' +
        '也有人说，那曾经是。',
      power: 1600,
      reward: { array: 'juling', treasure: 'yudie', rep: 150, stones: 20000, term: 'zhanjiang' },
      hint: '魔将。打不过也别硬撑，撑住宗门就好。',
    },
    {
      id: 'm4',
      year: 250,
      name: '魔渊决战',
      icon: '渊',
      desc: '裂缝彻底张开。天是黑的，日头没了。',
      detail:
        '各家各派都来了。有人算过，这一战之后，能站着的宗门大概不会太多。',
      power: 3600,
      reward: { array: 'zhuxie', treasure: 'shanheyin', rep: 400, stones: 60000, term: 'zhenyuan' },
      hint: '最后一仗。赢了，宗门能传下去；输了，也不是这一代人的错。',
    },
  ];

  const ARRAY_BY_ID = {};
  for (const a of ARRAYS) ARRAY_BY_ID[a.id] = a;
  const TREASURE_BY_ID = {};
  for (const t of TREASURES) TREASURE_BY_ID[t.id] = t;
  const TRIAL_BY_ID = {};
  for (const t of TRIALS) TRIAL_BY_ID[t.id] = t;

  S.worldevents = {
    ARRAYS, TREASURES, TRIALS, MAINLINE,
    ARRAY_BY_ID, TREASURE_BY_ID, TRIAL_BY_ID,
  };
})(window.Sect);
