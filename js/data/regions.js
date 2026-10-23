/* ===========================================================
 * regions.js — 地图区域
 *
 * 弟子历练时会自主挑选区域（按自身战力匹配）。
 * powerNeed 只是"建议战力"，低于它受伤/失败概率明显上升。
 * flavor 是区域专属小事件，历练时有一定概率触发。
 * =========================================================== */
(function (S) {
  'use strict';

  const REGIONS = [
    {
      id: 'houshan', name: '青竹后山', tier: 1,
      powerNeed: 18, danger: 0.04,
      desc: '宗门后山，竹影深深。除了野兔和山鸡，没什么能伤人的东西。',
      loot: [
        { itemId: 'yunlingcao', w: 30 },
        { itemId: 'juqisan', w: 22 },
        { itemId: 'liaoshangdan', w: 16 },
        { itemId: 'huxinfu', w: 8 },
      ],
      stones: [10, 30],
      special: '这里灵气稀薄，却胜在安稳，是新入门弟子最常去的地方。',
      flavor: [
        { text: '在竹林深处撞见一只偷吃灵果的野猴，追了半座山也没追上。' },
        { text: '在溪边捡到半截断剑，锈得不成样子，还是揣回来了。' },
        { text: '午后在石上打了个盹，梦见有人教了一招，醒来只记得半式。' },
        { text: '帮山下的樵夫把柴推回了家，对方硬塞了两个馍。', effect: { mood: 4 } },
        { text: '蹲在竹笋旁看了两个时辰，忽然觉得天地安静得很。', effect: { daoxin: 1 } },
      ],
    },
    {
      id: 'luoxiagu', name: '落霞谷', tier: 1,
      powerNeed: 30, danger: 0.08,
      desc: '每逢黄昏满谷通红，谷底的溪水里偶尔能淘出灵砂。',
      loot: [
        { itemId: 'yunlingcao', w: 26 },
        { itemId: 'peiyuandan', w: 8 },
        { itemId: 'juhundan', w: 6 },
        { itemId: 'xuanTie', w: 5 },
      ],
      stones: [25, 60],
      special: '谷中常见采药人的旧踪迹，运气好能捡到他们留下的家伙。',
      flavor: [
        { text: '在谷底溪水里淘出几粒灵砂，随手卖给了路过的行商。', effect: { stones: [15, 45] } },
        { text: '遇上一位采药的老丈，聊了半晌，临走被塞了一包草药。', effect: { item: 'yunlingcao' } },
        { text: '看满谷红霞落了半日，忽然想通了功法里一直卡着的那一句。', effect: { wuxing: 1 } },
        { text: '在废弃的药棚里翻出一本字迹潦草的册子，看不懂，但记下了。' },
        { text: '遇到两个争水源的村夫，帮着评了理，得了两句好话。', effect: { rep: 1 } },
      ],
    },
    {
      id: 'heifengkuang', name: '黑风矿洞', tier: 2,
      powerNeed: 70, danger: 0.16,
      desc: '废弃的灵石矿洞，风从深处灌上来，带着铁锈和血腥味。',
      loot: [
        { itemId: 'xuanTie', w: 24 },
        { itemId: 'huiyuandan', w: 10 },
        { itemId: 'pijingdan', w: 6 },
        { itemId: 'yaowangneidan', w: 4 },
      ],
      stones: [60, 150],
      special: '洞里有东西活着，而且不止一只。',
      flavor: [
        { text: '在矿洞深处听见有人喊他的名字，回头只有自己的回声。' },
        { text: '在一辆生锈的矿车上找到半块残破的玉简，上面的字只认得出三个。', effect: { item: 'wudaojian' } },
        { text: '发现一具旧尸骨，替他掩埋了，插了三炷香。', effect: { daoxin: 1 } },
        { text: '顺着风往前走，走到一处石壁前，壁上全是抓痕。' },
        { text: '在矿道岔口选错了路，绕了两天才绕出来，出来时人瘦了一圈。' },
      ],
    },
    {
      id: 'miwuyanlin', name: '迷雾妖林', tier: 2,
      powerNeed: 100, danger: 0.22,
      desc: '终年不散的浓雾，树木会动，鸟鸣声总在身后。',
      loot: [
        { itemId: 'yaowangneidan', w: 18 },
        { itemId: 'juhundan', w: 12 },
        { itemId: 'wudaojian', w: 6 },
        { itemId: 'tianlingguo', w: 2 },
      ],
      stones: [80, 200],
      special: '老修士说，迷路的人最后都走进了同一棵树的肚子里。',
      flavor: [
        { text: '在雾里绕了三天，最后走出来时发现自己几乎没挪过地方。' },
        { text: '一只白鹿引他走到一棵树前，树下有具白骨，骨边压着一枚玉符。', effect: { item: 'huxinfu' } },
        { text: '听见树后有女子笑声，追过去只剩一地落叶。' },
        { text: '在雾中与另一名散修撞了个满怀，两人对骂一阵，各自走了。' },
        { text: '发现一处雾气稍薄的地方，坐在那里吐纳，比宗门里顺畅得多。', effect: { exp: 60 } },
      ],
    },
    {
      id: 'duanhun', name: '断魂古战场', tier: 3,
      powerNeed: 130, danger: 0.28,
      desc: '千年前一场大战的遗址，断戟残甲埋进土里，怨气凝而不散。',
      loot: [
        { itemId: 'wudaojian', w: 16 },
        { itemId: 'yaowangneidan', w: 14 },
        { itemId: 'xiuSuiDan', w: 4 },
        { itemId: 'tianlingguo', w: 4 },
      ],
      stones: [180, 420],
      special: '夜里有兵戈声。有人说是风，有人说是那些没走的人。',
      flavor: [
        { text: '夜里听见兵戈声，起身去看，只有月光照着一柄断戟。' },
        { text: '在一面残破战旗下捡到一枚刻着名字的护符，名字已经磨平了。' },
        { text: '一个半透明的老兵朝他笑了笑，然后散了。', effect: { daoxin: 2 } },
        { text: '在一处陷坑里发现成堆的骸骨，谁也没能出来。' },
        { text: '和一个守着旧阵的老鬼聊了一夜，学了些早已失传的手法。', effect: { wuxing: 1 } },
      ],
    },
    {
      id: 'guixu', name: '归墟深渊', tier: 4,
      powerNeed: 150, danger: 0.34,
      desc: '大地裂开的一道口子，深不见底。据说下面通往另一个世界。',
      loot: [
        { itemId: 'longxianguo', w: 6 },
        { itemId: 'xiuSuiDan', w: 10 },
        { itemId: 'qianjidan', w: 9 },
        { itemId: 'tianlingguo', w: 8 },
      ],
      stones: [400, 900],
      special: '站在崖边往下看，会觉得深渊也在看你。',
      flavor: [
        { text: '趴在崖边往下看，看了很久，忽然觉得深渊也在看他。' },
        { text: '在崖壁裂缝里摸到一支还很热的箭，箭杆上缠着新的布条。' },
        { text: '听见下面有人说话，说的是他完全不认识的一种方言。' },
        { text: '捡到一块黑得发亮的石头，握久了会烫手。', effect: { item: 'xuanTie' } },
        { text: '在崖顶打坐了七日，睁眼时觉得世间事都轻了几分。', effect: { daoxin: 3 } },
      ],
    },
  ];

  const BY_ID = {};
  for (const r of REGIONS) BY_ID[r.id] = r;
  const get = (id) => BY_ID[id] || null;

  /** 根据战力挑选弟子愿意去的最难区域 */
  function pickForPower(power) {
    const fit = REGIONS.filter((r) => r.powerNeed <= power * 1.5);
    if (!fit.length) return REGIONS[0];
    // 偏向"稍高于自己能力"的区域，但不能离谱
    const viable = fit.filter((r) => r.powerNeed <= power * 1.15);
    const pool = viable.length ? viable.slice(-3) : fit.slice(-2);
    return S.util.pick(pool);
  }

  S.regions = { REGIONS, BY_ID, get, pickForPower };
})(window.Sect);
