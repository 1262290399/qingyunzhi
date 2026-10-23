/* ===========================================================
 * terms.js — 弟子词条库
 *
 * 词条在弟子入门时随机生成，直接决定该弟子的成长曲线与行为倾向。
 * effects 字段说明：
 *   growthMul        修炼效率倍率
 *   powerMul         战力倍率
 *   contributionMul  任务贡献点倍率
 *   lootMul          历练产出倍率
 *   injureMul        受伤概率倍率
 *   breakthroughAdd  突破成功率加成（0.1 = +10%）
 *   loyaltyDrift     每年忠诚度自然变化
 *   missionMul       任务成功率加成
 *   grantStones?     无
 * growthByTier：按大境界段位（0凡人 1炼气 2筑基 3金丹 4元婴 5化神）覆盖 growthMul
 * =========================================================== */
(function (S) {
  'use strict';

  const RARITY = {
    common:    { name: '凡品', weight: 62, cls: 'rar-common' },
    rare:      { name: '珍稀', weight: 26, cls: 'rar-rare' },
    epic:      { name: '稀世', weight: 9,  cls: 'rar-epic' },
    legendary: { name: '天命', weight: 3,  cls: 'rar-legendary' },
  };

  const TERMS = [
    // ---------------- 天赋类（正面） ----------------
    {
      id: 'tianlinggen', name: '天灵根', rarity: 'legendary', kind: 'good',
      desc: '万中无一的修炼天赋，吐纳之间灵气自涌，一日千里。',
      tags: ['genius'],
      effects: { growthMul: 1.6, breakthroughAdd: 0.1 },
    },
    {
      id: 'linggen', name: '灵根', rarity: 'rare', kind: 'good',
      desc: '根骨清奇，灵台通透，天生适合修行。',
      tags: ['genius'],
      effects: { growthMul: 1.3 },
    },
    {
      id: 'suhui', name: '宿慧', rarity: 'epic', kind: 'good',
      desc: '似有前世修行记忆，许多关口一点就通。',
      tags: ['genius'],
      effects: { growthMul: 1.35, breakthroughAdd: 0.1 },
    },
    {
      id: 'juling', name: '聚灵之体', rarity: 'epic', kind: 'good',
      desc: '经脉如江河，吸纳灵气远胜常人。',
      tags: ['genius'],
      effects: { growthMul: 1.45 },
    },
    {
      id: 'guomuwang', name: '过目不忘', rarity: 'rare', kind: 'good',
      desc: '功法口诀听一遍便刻进心里，省下大量参悟时间。',
      tags: [],
      effects: { growthMul: 1.15, breakthroughAdd: 0.05 },
    },

    // ---------------- 性格类 ----------------
    {
      id: 'ruxinzhi', name: '心如止水', rarity: 'epic', kind: 'good',
      desc: '喜怒不形于色，闭关十年如一日，道心极稳。',
      tags: ['calm'],
      effects: { breakthroughAdd: 0.15, loyaltyDrift: 1 },
    },
    {
      id: 'danxin', name: '丹心', rarity: 'epic', kind: 'good',
      desc: '一门心思向着宗门，从不动摇。',
      tags: ['loyal'],
      effects: { loyaltyDrift: 2, breakthroughAdd: 0.05 },
    },
    {
      id: 'qinmian', name: '勤勉', rarity: 'common', kind: 'good',
      desc: '别人打坐一个时辰，他打坐三个时辰。',
      tags: [],
      effects: { growthMul: 1.12 },
    },
    {
      id: 'heqi', name: '和气生财', rarity: 'rare', kind: 'good',
      desc: '人缘极好，办事往往能多得几分薄面。',
      tags: ['social'],
      effects: { contributionMul: 1.2, loyaltyDrift: 1 },
    },
    {
      id: 'huasao', name: '话痨', rarity: 'common', kind: 'neutral',
      desc: '一日不说话就浑身难受，倒是让宗门热闹不少。',
      tags: ['social'],
      effects: { growthMul: 0.93, sectMorale: 1 },
    },
    {
      id: 'gupi', name: '孤僻', rarity: 'common', kind: 'neutral',
      desc: '不爱与人来往，独处时反而更专注。',
      tags: ['lonely'],
      effects: { growthMul: 1.1, socialMul: 0 },
    },
    {
      id: 'chixiang', name: '痴情', rarity: 'rare', kind: 'neutral',
      desc: '心里装着一个人。那个人好，他就好；那个人受伤，他便魂不守舍。',
      tags: ['love'],
      effects: { growthMul: 1.05 },
    },

    // ---------------- 战斗类 ----------------
    {
      id: 'jianshengu', name: '天生剑骨', rarity: 'rare', kind: 'good',
      desc: '骨骼如剑，出手便带三分锋锐。',
      tags: ['combat'],
      effects: { powerMul: 1.25 },
    },
    {
      id: 'jianxintongming', name: '剑心通明', rarity: 'epic', kind: 'good',
      desc: '剑道上的天授之才，同阶之中少有敌手。',
      tags: ['combat'],
      effects: { powerMul: 1.35 },
    },
    {
      id: 'shenli', name: '天生神力', rarity: 'common', kind: 'good',
      desc: '力能扛鼎，正面硬拼从不吃亏。',
      tags: ['combat'],
      effects: { powerMul: 1.18 },
    },
    {
      id: 'tiegu', name: '铁骨', rarity: 'common', kind: 'good',
      desc: '皮糙肉厚，寻常伤势养两日就好。',
      tags: [],
      effects: { injureMul: 0.45 },
    },
    {
      id: 'wuchi', name: '武痴', rarity: 'rare', kind: 'neutral',
      desc: '痴迷拳脚刀剑，却对打坐悟道提不起兴趣。',
      tags: ['combat'],
      effects: { powerMul: 1.2, growthMul: 0.85 },
    },
    {
      id: 'haodou', name: '好斗', rarity: 'common', kind: 'bad',
      desc: '一天不打架就手痒，最容易和同门起冲突。',
      tags: ['aggressive', 'combat'],
      effects: { powerMul: 1.1, conflict: 2.2 },
    },
    {
      id: 'danxiao', name: '胆小', rarity: 'common', kind: 'bad',
      desc: '一遇危险就想往后躲，真要动手时手脚发软。',
      tags: [],
      effects: { powerMul: 0.9, contributionMul: 0.75 },
    },

    // ---------------- 运势与际遇 ----------------
    {
      id: 'fuxing', name: '福星', rarity: 'rare', kind: 'good',
      desc: '走到哪里都有好事发生，捡漏是一把好手。',
      tags: ['lucky'],
      effects: { lootMul: 1.35, fortune: 1.6 },
    },
    {
      id: 'xingyunxing', name: '幸运星', rarity: 'epic', kind: 'good',
      desc: '天眷之人。别人九死一生的地方，他总能全身而退还顺走点什么。',
      tags: ['lucky'],
      effects: { lootMul: 1.5, fortune: 2.0, injureMul: 0.7 },
    },
    {
      id: 'ercong', name: '耳聪目明', rarity: 'common', kind: 'good',
      desc: '对灵气波动异常敏感，寻宝探路事半功倍。',
      tags: [],
      effects: { lootMul: 1.15 },
    },

    // ---------------- 缺陷类 ----------------
    {
      id: 'weilinggen', name: '伪灵根', rarity: 'common', kind: 'bad',
      desc: '灵根驳杂不纯，吸纳灵气总要散掉一半。',
      tags: [],
      effects: { growthMul: 0.82 },
    },
    {
      id: 'lansan', name: '懒散', rarity: 'common', kind: 'bad',
      desc: '能坐着绝不站着，能躺着绝不坐着。',
      tags: [],
      effects: { growthMul: 0.75 },
    },
    {
      id: 'luchi', name: '路痴', rarity: 'common', kind: 'bad',
      desc: '出门三步就迷路，历练一趟有一半时间在找路。',
      tags: [],
      effects: { lootMul: 0.78 },
    },
    {
      id: 'tancai', name: '贪财', rarity: 'common', kind: 'bad',
      desc: '什么都要先算算能换多少灵石，连宗门的便宜都想占。',
      tags: ['greedy'],
      effects: { levyStones: true },
    },
    {
      id: 'jiaozha', name: '狡诈', rarity: 'rare', kind: 'bad',
      desc: '带回的东西总比说的少一点。',
      tags: ['sly'],
      effects: { skim: 0.3 },
    },
    {
      id: 'yinji', name: '隐疾', rarity: 'common', kind: 'bad',
      desc: '旧伤未愈，每逢阴雨天便发作。',
      tags: ['fragile'],
      effects: { injureMul: 1.8, sickChance: 0.18 },
    },
    {
      id: 'xinmo', name: '心魔未除', rarity: 'rare', kind: 'bad',
      desc: '心口有一道过不去的坎，突破时最容易出岔子。',
      tags: [],
      effects: { breakthroughAdd: -0.2, qiDevChance: 0.08 },
    },
    {
      id: 'tiansha', name: '天煞孤星', rarity: 'epic', kind: 'bad',
      desc: '命格太硬。修行一日千里，可身边人总要替他挡灾。',
      tags: ['cursed'],
      effects: { growthMul: 1.7, curse: 0.25 },
    },

    // ---------------- 技艺类 ----------------
    {
      id: 'dandao', name: '丹道天赋', rarity: 'rare', kind: 'good',
      desc: '闻一闻就知道火候差几分。这种人天生该守在丹炉边。',
      tags: ['craft'],
      effects: { alchemy: 35 },
    },
    {
      id: 'qidao', name: '器道天赋', rarity: 'rare', kind: 'good',
      desc: '手上有准头。别人敲十下出一件，他敲三下就有模样。',
      tags: ['craft'],
      effects: { forging: 35 },
    },
    {
      id: 'shanggu', name: '商贾之才', rarity: 'rare', kind: 'good',
      desc: '看货、看人、看行情，一眼就能算出赚头。',
      tags: ['trade'],
      effects: { trade: 35 },
    },
    {
      id: 'yuren', name: '御人之术', rarity: 'epic', kind: 'good',
      desc: '说话让人爱听，办事让人放心。这样的人往山门口一坐，来投的人就多一半。',
      tags: ['lead'],
      effects: { leadership: 30, sectMorale: 1 },
    },
    {
      id: 'yaolu', name: '药炉童子', rarity: 'common', kind: 'good',
      desc: '从小在药铺里长大，抓药看秤比念书还熟。',
      tags: ['craft'],
      effects: { alchemy: 16 },
    },
    {
      id: 'datie', name: '打铁出身', rarity: 'common', kind: 'good',
      desc: '入宗之前是铁匠铺的学徒，膀子比同龄人粗一圈。',
      tags: ['craft'],
      effects: { forging: 16 },
    },
    {
      id: 'zoujie', name: '走街串巷', rarity: 'common', kind: 'good',
      desc: '在市井里混大的，什么话都听过，什么价都还过。',
      tags: ['trade'],
      effects: { trade: 16 },
    },
    {
      id: 'gudao', name: '古道热肠', rarity: 'common', kind: 'good',
      desc: '见不得别人为难。这种人当不了官，却最得人心。',
      tags: ['lead'],
      effects: { leadership: 13, loyaltyDrift: 1 },
    },
    {
      id: 'shoucan', name: '手残', rarity: 'common', kind: 'bad',
      desc: '做精细活计的时候，手总会抖一下。',
      tags: ['craft'],
      effects: { forging: -26, alchemy: -8 },
    },
    {
      id: 'yanzhuo', name: '眼拙', rarity: 'common', kind: 'bad',
      desc: '看什么都是好的，看什么都觉得值这个价。',
      tags: ['trade'],
      effects: { trade: -22 },
    },
    {
      id: 'dandu', name: '丹毒缠身', rarity: 'rare', kind: 'bad',
      desc: '早年吃错了药，底子坏了。闻见药味就发怵。',
      tags: ['craft'],
      effects: { alchemy: -18, injureMul: 1.25 },
    },
    {
      id: 'jiangrenchi', name: '匠人痴', rarity: 'rare', kind: 'neutral',
      desc: '认准了一件东西就放不下，能不吃不睡磨到天亮。',
      tags: ['craft'],
      effects: { forging: 26, growthMul: 0.86 },
    },

    // ---------------- 命格类 ----------------
    {
      id: 'changshou', name: '长寿', rarity: 'common', kind: 'good',
      desc: '家里老人个个活到八九十。这种人好像天生就比别人多几年。',
      tags: [],
      effects: { lifespan: 90 },
    },
    {
      id: 'jiren', name: '福缘深厚', rarity: 'epic', kind: 'good',
      desc: '一辈子没遇过什么大坎。真到过不去的时候，总有人或有事拉他一把。',
      tags: ['lucky'],
      effects: { lifespan: 60, deathResist: 0.35, fortune: 1.4 },
    },
    {
      id: 'yingming', name: '命硬', rarity: 'common', kind: 'good',
      desc: '受了别人受不住的伤，还能站起来。',
      tags: [],
      effects: { deathResist: 0.5 },
    },
    {
      id: 'leiting', name: '雷霆之体', rarity: 'rare', kind: 'good',
      desc: '生来不怕雷。别人渡劫是过鬼门关，他像是回家。',
      tags: [],
      effects: { tribulationAdd: 0.15 },
    },
    {
      id: 'xiantian', name: '先天道体', rarity: 'epic', kind: 'good',
      desc: '娘胎里带出来的一副好皮囊，天生与道亲近。',
      tags: ['genius'],
      effects: { tribulationAdd: 0.1, lifespan: 40 },
    },
    {
      id: 'tianjie', name: '天劫加身', rarity: 'rare', kind: 'bad',
      desc: '老天爷好像格外看得起他。修得快，劫也重。',
      tags: [],
      effects: { tribulationAdd: -0.15, growthMul: 1.15 },
    },
    {
      id: 'duanming', name: '短命', rarity: 'common', kind: 'bad',
      desc: '面相上说，这种人活不过四十。修了仙，也就多撑些年头。',
      tags: [],
      effects: { lifespan: -50 },
    },
    {
      id: 'shouyuan', name: '寿元将尽', rarity: 'rare', kind: 'bad',
      desc: '底子早就空了。旁人看不出，他自己心里清楚。',
      tags: ['fragile'],
      effects: { lifespan: -120, injureMul: 1.2 },
    },

    // ---------------- 成长节奏类 ----------------
    {
      id: 'daqiwancheng', name: '大器晚成', rarity: 'rare', kind: 'neutral',
      desc: '前期愚钝，越往后越厚积薄发。',
      tags: [],
      effects: { growthByTier: [0.65, 0.8, 1.35, 1.55, 1.7, 1.8] },
    },
    {
      id: 'zaohui', name: '早慧', rarity: 'rare', kind: 'neutral',
      desc: '少年时锋芒毕露，可根基不牢，越往高处越吃力。',
      tags: [],
      effects: { growthByTier: [1.4, 1.45, 1.0, 0.8, 0.7, 0.6] },
    },
    {
      id: 'yaoguanzi', name: '药罐子', rarity: 'common', kind: 'neutral',
      desc: '从小拿丹药当饭吃，对药性了如指掌，兑换丹药能省不少。',
      tags: [],
      effects: { pillDiscount: 0.35, growthMul: 0.95 },
    },
    {
      id: 'yemaozi', name: '夜猫子', rarity: 'common', kind: 'neutral',
      desc: '白天昏昏沉沉，夜里精神抖擞。',
      tags: [],
      effects: { growthMul: 1.08, contributionMul: 0.92 },
    },

    // ---------------- 传承词条（只能从剧情里拿，不进随机池） ----------------
    {
      id: 'shihuo', name: '识货', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '辛老教的。一眼就能看出东西值多少、人值不值得打交道。',
      tags: ['trade'],
      effects: { trade: 20, pillDiscount: 0.12 },
    },
    {
      id: 'huiyan', name: '慧眼', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '苏大家教的。看人看货，看多了就准了。',
      tags: ['trade'],
      effects: { trade: 18, fortune: 1.2 },
    },
    {
      id: 'guanmian', name: '官面', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '陈押司教的。在官府面前说得上话，名声传得比别处快。',
      tags: ['social'],
      effects: { repMul: 1.18 },
    },
    {
      id: 'jianyi', name: '剑意', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '裴擒虎教的。这人脾气不好，剑倒是真的好。',
      tags: ['combat'],
      effects: { powerMul: 1.16 },
    },
    {
      id: 'jianghu', name: '江湖耳', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '柳三先生教的。哪条路上有东西、哪座山头不能去，他心里都有数。',
      tags: [],
      effects: { lootMul: 1.25, fortune: 1.3 },
    },
    {
      id: 'kuidao', name: '窥道', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '玄玑子教的。说不清是什么，可冲关的时候心里会多一分底。',
      tags: ['genius'],
      effects: { breakthroughAdd: 0.12, growthMul: 1.06 },
    },
    {
      id: 'yaoxing', name: '药性通神', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '云姑教的。闻一闻就知道火候差几分。',
      tags: ['craft'],
      effects: { alchemy: 32 },
    },
    {
      id: 'yaoyuan', name: '妖缘', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '阿蛮留下的。山川草木好像都认得他。',
      tags: ['lucky'],
      effects: { fortune: 1.7, lootMul: 1.15 },
    },
    {
      id: 'tingfeng', name: '听风', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '瞎子李教的。眼睛看不见之后，耳朵就替眼睛使了。',
      tags: [],
      effects: { injureMul: 0.58 },
    },
    {
      id: 'kuaiJian', name: '快剑', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '白小楼教的。他说快就是快，没别的道理。',
      tags: ['combat'],
      effects: { powerMul: 1.2, growthMul: 0.96 },
    },

    // ---------------- 魔劫词条（只在主线里拿得到） ----------------
    {
      id: 'yumo', name: '御魔', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '在魔气里站过一夜的人，皮肤底下会留下点东西。',
      tags: ['combat'],
      effects: { powerMul: 1.08, injureMul: 0.88 },
    },
    {
      id: 'tiebi', name: '铁壁', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '魔潮里守过山门的人，往后遇着什么都不会先退。',
      tags: ['sturdy'],
      effects: { injureMul: 0.72, loyalty: 5 },
    },
    {
      id: 'zhanjiang', name: '斩将', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '和魔将照过面还站着的人，出手就不一样了。',
      tags: ['combat'],
      effects: { powerMul: 1.16 },
    },
    {
      id: 'zhenyuan', name: '镇渊', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '在魔渊边上活下来的人。宗门里没人再拿他当普通弟子看。',
      tags: ['combat', 'genius'],
      effects: { powerMul: 1.22, growthMul: 1.06, breakthroughAdd: 0.05 },
    },

    // ---------------- 剧情线词条（只在特定支线里出现） ----------------
    {
      id: 'shihuai', name: '释怀', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '把一桩压了多年的事放下了。放下之后，心反而静了。',
      tags: ['social'],
      effects: { growthMul: 1.1, loyalty: 6, daoxin: 1 },
    },
    {
      id: 'beixin', name: '碑心', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '在古碑前坐过一整夜的人，看东西的眼神会变。',
      tags: ['genius'],
      effects: { growthMul: 1.14, breakthroughAdd: 0.08 },
    },
    {
      id: 'jiejie', name: '解结', rarity: 'legendary', kind: 'good', legacy: true,
      desc: '心里那个死扣解开了。往后遇着什么，都不至于走极端。',
      tags: [],
      effects: { growthMul: 1.08, mood: 1, injureMul: 0.9 },
    },

    // 认主之物挂在弟子身上时，效果走这几条隐藏词条——
    // 它们不出现在词条栏里，只为了让数值计算统一
    {
      id: 'relic_duanjian', name: '断剑', rarity: 'legendary', kind: 'good', legacy: true, hidden: true,
      desc: '', tags: [], effects: { powerMul: 1.18, growthMul: 1.03 },
    },
    {
      id: 'relic_gudi', name: '妖王骨笛', rarity: 'legendary', kind: 'good', legacy: true, hidden: true,
      desc: '', tags: [], effects: { injureMul: 0.82, fortune: 1.15 },
    },
    {
      id: 'relic_gubei_ta', name: '古碑拓片', rarity: 'legendary', kind: 'good', legacy: true, hidden: true,
      desc: '', tags: [], effects: { breakthroughAdd: 0.1, growthMul: 1.05 },
    },
  ];

  const BY_ID = {};
  for (const t of TERMS) BY_ID[t.id] = t;

  const get = (id) => BY_ID[id] || null;

  /** 随机抽一条词条：rarity 权重随品质递减 */
  function rollOne() {
    const r = S.util.weighted(Object.keys(RARITY), (k) => RARITY[k].weight);
    const pool = TERMS.filter((t) => t.rarity === r && !t.legacy);
    return S.util.pick(pool);
  }

  /** 随机生成 n 条不重复词条 */
  function roll(n) {
    const out = [];
    const used = new Set();
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const t = rollOne();
      if (used.has(t.id)) continue;
      used.add(t.id);
      out.push(t.id);
    }
    return out;
  }

  S.terms = { RARITY, TERMS, BY_ID, get, roll, rollOne };
})(window.Sect);
