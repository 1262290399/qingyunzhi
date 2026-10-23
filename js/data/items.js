/* ===========================================================
 * items.js — 物资库
 *
 * type: pill 丹药 / material 灵材 / manual 功法玉简 / talisman 符箓
 * value     拍卖行基础价（灵石）
 * contrib   弟子用贡献点兑换所需
 * effect    弟子兑换后生效的效果
 * =========================================================== */
(function (S) {
  'use strict';

  const ITEMS = [
    // ---------------- 一品（炼气期常用） ----------------
    {
      id: 'liaoshangdan', name: '疗伤丹', type: 'pill', tier: 1,
      value: 60, contrib: 25,
      desc: '最寻常的金疮药，化开吞服，三日可愈。',
      effect: { heal: 1 },
    },
    {
      id: 'juqisan', name: '聚气散', type: 'pill', tier: 1,
      value: 80, contrib: 32,
      desc: '低阶修士的日课，一包下去顶得上半月打坐。',
      effect: { exp: 45 },
    },
    {
      id: 'yunlingcao', name: '蕴灵草', type: 'material', tier: 1,
      value: 110, contrib: 45,
      desc: '生于阴湿崖壁，叶脉里游走着淡淡灵光。',
      effect: { exp: 70 },
    },
    {
      id: 'huxinfu', name: '护心符', type: 'talisman', tier: 1,
      value: 90, contrib: 35,
      desc: '贴身佩戴，可挡一次致命伤。',
      effect: { guard: 1 },
    },
    {
      id: 'peiyuandan', name: '培元丹', type: 'pill', tier: 1,
      value: 220, contrib: 90,
      desc: '固本培元，长久服用可缓慢拓宽经脉。',
      effect: { tianfu: 1 },
    },

    // ---------------- 二品 ----------------
    {
      id: 'juhundan', name: '聚魂丹', type: 'pill', tier: 2,
      value: 260, contrib: 100,
      desc: '滋神养魂，服后再参悟功法往往豁然开朗。',
      effect: { wuxing: 2 },
    },
    {
      id: 'ningshendan', name: '凝神丹', type: 'pill', tier: 2,
      value: 300, contrib: 120,
      desc: '定心凝神，心魔难侵。',
      effect: { daoxin: 2 },
    },
    {
      id: 'pijingdan', name: '破境丹', type: 'pill', tier: 2,
      value: 420, contrib: 150,
      desc: '大境界突破时服下，可稳下三分把握。',
      effect: { breakBonus: 0.3 },
    },
    {
      id: 'huiyuandan', name: '回元丹', type: 'pill', tier: 2,
      value: 380, contrib: 140,
      desc: '一枚入腹，半身修为凭空补回。',
      effect: { exp: 200 },
    },
    {
      id: 'wudaojian', name: '悟道玉简', type: 'manual', tier: 2,
      value: 500, contrib: 180,
      desc: '前人手书的修行札记，字里行间藏着一条捷径。',
      effect: { exp: 150, wuxing: 2 },
    },
    {
      id: 'yaowangneidan', name: '妖王内丹', type: 'material', tier: 2,
      value: 640, contrib: 220,
      desc: '三阶妖兽的心血所凝，蕴含精纯妖力。',
      effect: { exp: 340 },
    },
    {
      id: 'xuanTie', name: '玄铁精', type: 'material', tier: 2,
      value: 340, contrib: 130,
      desc: '铸剑的上好材料，淬火后削铁如泥。',
      effect: { power: 3 },
    },

    // ---------------- 三品（稀世） ----------------
    {
      id: 'xiuSuiDan', name: '洗髓丹', type: 'pill', tier: 3,
      value: 1800, contrib: 620,
      desc: '伐毛洗髓，可涤去一身沉疴旧疾。',
      effect: { purify: 1 },
    },
    {
      id: 'tianlingguo', name: '天灵果', type: 'material', tier: 3,
      value: 1500, contrib: 520,
      desc: '百年一熟的灵果，服之如重铸一次灵根。',
      effect: { tianfu: 3, exp: 120 },
    },
    {
      id: 'qianjidan', name: '千机丹', type: 'pill', tier: 3,
      value: 1600, contrib: 560,
      desc: '以七种灵材九蒸九晒而成，开人神智。',
      effect: { wuxing: 3 },
    },
    {
      id: 'longxianguo', name: '龙涎果', type: 'material', tier: 4,
      value: 4200, contrib: 1500,
      desc: '传说真龙泣血之地才生此果，百年不过三枚。',
      effect: { tianfu: 5, exp: 500, daoxin: 3 },
    },
  ];

  const BY_ID = {};
  for (const it of ITEMS) BY_ID[it.id] = it;

  const get = (id) => BY_ID[id] || null;

  /** 按层级筛选，用于拍卖行/历练掉落 */
  const ofTier = (tiers) => ITEMS.filter((it) => tiers.includes(it.tier));

  const TIER_NAME = { 1: '一品', 2: '二品', 3: '三品', 4: '四品' };
  const TYPE_NAME = { pill: '丹药', material: '灵材', manual: '玉简', talisman: '符箓' };

  S.items = { ITEMS, BY_ID, get, ofTier, TIER_NAME, TYPE_NAME };
})(window.Sect);
