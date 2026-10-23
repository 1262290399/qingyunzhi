/* ===========================================================
 * npcs.js — 地图上的势力与人物
 *
 * 两种：
 *   faction 势力（坊市、拍卖行、县衙、铁剑门、说书人）——不会老死，好感持续累积
 *   npc     个人——有寿数，会老、会走
 *
 * 每个都挂着一场「传承」：好感够了，弟子某方面也够格，才会触发。
 * 触发后那名弟子拿到一个只能从剧情里来的特殊词条。
 * =========================================================== */
(function (S) {
  'use strict';

  const hasTag = (d, tag) =>
    d.terms.some((id) => {
      const t = S.terms.get(id);
      return t && t.tags.includes(tag);
    });

  const skillOf = (d, k) => (S.disciple.effSkill ? S.disciple.effSkill(d, k) : 0);

  const NPCS = [
    // ======================= 势力 =======================
    {
      id: 'xin_lao',
      name: '落霞坊市',
      title: '掌柜辛老',
      kind: 'faction',
      region: 'luoxiagu',
      role: 'merchant',
      desc: '一整个坊市，三十几家铺子串成一条街。辛老是这条街上说话最管用的人。',
      persona: '精明、讲信用、嘴碎',
      likes: (d) => (hasTag(d, 'social') ? 0.5 : 0) + (hasTag(d, 'greedy') ? -0.4 : 0) + (d.daoxin > 70 ? 0.2 : 0),
      meet: [
        {
          text: (c) =>
            `辛老正拨着算盘，抬眼看了${c.d.name}一眼："又是你们宗门的。上回那批货，` +
            `回去用着还行？"他嘴上问着，手已经把柜台上一小包东西推了过来，` +
            `"拿着，不值钱，算我送的。"`,
          favor: [2, 5], disc: [4, 9], item: 'liaoshangdan', chance: 0.5,
        },
        {
          text: (c) =>
            `${c.d.name}在铺子前站了半天，辛老终于抬起头："看什么呢？想要就开口，` +
            `不开口我怎么知道你想要。"他叹了口气，` +
            `"你们这些修士啊，脸皮比我这柜台还薄。"`,
          favor: [1, 3], disc: [2, 6],
        },
        {
          text: (c) =>
            `辛老把${c.d.name}拉到一边，压低声音："跟你们宗主说一声，` +
            `下个月有批货从北边来，路子不太正，但东西是好东西。要的话，我留一份。"`,
          favor: [3, 7], disc: [1, 4], chance: 0.35,
        },
      ],
      mood: {
        warm: '坊市里见了青云宗的腰牌，价钱都好商量。',
        neutral: '坊市对宗门不冷不热，该多少是多少。',
        cold: '坊市那边把青云宗的货压了半个月，说是"验货"。',
      },
      legacy: {
        name: '辛老的账本',
        desc: '他把自己用了三十年的账本塞了过来，说"会看账的人，走到哪都饿不死"。',
        require: { favor: 70, check: (d) => skillOf(d, 'trade') >= 55 || hasTag(d, 'trade') },
        hint: '得懂买卖',
        term: 'shihuo',
        reward: { stones: 900 },
      },
    },
    {
      id: 'su_dajia',
      name: '落霞拍卖行',
      title: '女掌柜苏大家',
      kind: 'faction',
      region: 'luoxiagu',
      role: 'merchant',
      desc: '落霞谷最大的拍卖行。什么东西值什么价，在这儿一句话就定了。',
      persona: '精明、高傲、识货',
      likes: (d) => (d.tianfu > 78 ? 0.6 : -0.1) + (hasTag(d, 'genius') ? 0.5 : 0),
      meet: [
        {
          text: (c) =>
            `苏大家倚在二楼栏杆上，居高临下看了${c.d.name}一眼。` +
            `那一眼看得人心里发毛。半晌，她忽然开口："你这根骨，可惜了。` +
            `若早十年遇上我，如今该是另一番光景。"说完便转身进了内堂。`,
          favor: [1, 4], disc: [5, 12],
        },
        {
          text: (c) =>
            `${c.d.name}在拍卖行门口被伙计拦下，苏大家却从里面走了出来，` +
            `"让他进。这人身上有股味道，我闻得出来，将来是要上我这拍东西的。"`,
          favor: [2, 5], disc: [3, 8],
        },
      ],
      mood: {
        warm: '拍卖行肯把压箱底的东西拿出来给宗门过目。',
        neutral: '拍卖行待宗门与旁人无异。',
        cold: '拍卖行的人见了宗门的人就关门，说"今日歇业"。',
      },
      legacy: {
        name: '苏大家的眼',
        desc: '她难得地坐下来，教了三天——怎么从一堆杂物里挑出值钱的那件。',
        require: { favor: 70, check: (d) => d.tianfu >= 78 },
        hint: '天赋要够好',
        term: 'huiyan',
        reward: { item: 'qianjidan' },
      },
    },
    {
      id: 'chen_yasi',
      name: '山下县衙',
      title: '押司陈平安',
      kind: 'faction',
      region: 'houshan',
      role: 'official',
      desc: '山下县衙。官不大，事不少，宗门在凡间的名声，一半要过他们这道手。',
      persona: '圆滑、怕事、好面子',
      likes: (d) => (d.daoxin > 65 ? 0.4 : 0) + (hasTag(d, 'aggressive') ? -0.5 : 0) + (hasTag(d, 'social') ? 0.3 : 0),
      meet: [
        {
          text: (c) =>
            `陈押司远远就拱起手："哎哟，仙长！"他一边迎上来一边四下张望，` +
            `"上回那事，多亏贵宗出手。下官这里备了点薄礼，不成敬意，` +
            `不成敬意。"说着就把一个包袱往${c.d.name}怀里塞。`,
          favor: [3, 7], disc: [2, 5], item: 'juqisan', chance: 0.5,
        },
        {
          text: (c) =>
            `陈押司搓着手，为难得直叹气："不是下官不办，是上头的文书压着……"` +
            `他说着说着声音低下去，"仙长您看，能不能请贵宗出面说句话？"`,
          favor: [1, 4], disc: [1, 3],
        },
      ],
      mood: {
        warm: '县衙处处替宗门说好话，凡间的名声稳当。',
        neutral: '县衙公事公办。',
        cold: '县衙推说公务缠身，闭门不见。',
      },
      legacy: {
        name: '陈押司的印',
        desc: '他把自己那方小印借人用了半年，说"看人下菜碟，也是门学问"。',
        require: { favor: 65, check: (d) => d.daoxin >= 68 },
        hint: '道心要稳',
        term: 'guanmian',
        reward: { rep: 20 },
      },
    },
    {
      id: 'pei_qinhu',
      name: '铁剑门',
      title: '长老裴擒虎',
      kind: 'faction',
      region: 'heifengkuang',
      role: 'rival',
      desc: '邻宗铁剑门。几十年了，两家为着北边那片矿脉没少红脸。',
      persona: '暴躁、护短、记仇',
      likes: (d) => (hasTag(d, 'combat') ? 0.5 : 0) + (d.tianfu > 82 ? -0.4 : 0),
      meet: [
        {
          text: (c) =>
            `"站住。"裴擒虎抱着剑拦在道中间，上下打量${c.d.name}，` +
            `"青云宗的是吧？上个月你们的人在黑风岭抢了我们先看上的货。"` +
            `他冷笑，"今天碰上了，总得给个说法。"`,
          favor: [-4, -1], disc: [-4, -1],
        },
        {
          text: (c) =>
            `裴擒虎远远看见宗门的人，故意把剑往地上一插：` +
            `"铁剑门在此办事，闲杂人等绕道。"`,
          favor: [-3, -1], disc: [-3, 0],
        },
      ],
      mood: {
        warm: '铁剑门的人在山道上碰见，会点个头，不再拦路。',
        neutral: '铁剑门与宗门井水不犯河水。',
        cold: '裴擒虎放出话来：见青云宗的人，不必客气。',
      },
      legacy: {
        name: '裴擒虎的剑',
        desc: '他打输了一场，把剑往地上一插："这招我用不着了，你拿去。"',
        require: { favor: -100, check: (d) => S.disciple.power(d) >= 500 && S.state.data.sect.level >= 4 },
        hint: '得打得过他',
        term: 'jianyi',
        reward: { item: 'xuanTie' },
      },
    },
    {
      id: 'liu_san',
      name: '游方说书人',
      title: '柳三先生',
      kind: 'faction',
      region: 'houshan',
      role: 'wanderer',
      desc: '一帮走乡串镇的说书人，什么都听，什么都记。他们的书里，有一半是真的。',
      persona: '健谈、消息灵通、爱抬价',
      likes: (d) => (hasTag(d, 'social') ? 0.5 : 0) + (d.wuxing > 70 ? 0.2 : 0),
      meet: [
        {
          text: (c) =>
            `柳三先生醒木一拍："要说这断魂古战场啊——"他瞥见${c.d.name}，` +
            `话锋一转，"哟，贵宗的人。巧了，我这儿正好有一段关于贵宗的段子，` +
            `您要听听么？不要钱，就想问问细节。"`,
          favor: [1, 4], disc: [3, 8],
        },
        {
          text: (c) =>
            `柳三先生凑过来，声音压得极低："前几日有人向我打听你们宗门，` +
            `打听得很细。问的是个生面孔，给的银子不少。"他搓了搓手指，` +
            `"我就知道这么多。剩下的，得加钱。"`,
          favor: [2, 6], disc: [1, 4], info: 1, chance: 0.35,
        },
      ],
      mood: {
        warm: '说书人的段子里，青云宗是个好去处。',
        neutral: '说书人照常说着他的书。',
        cold: '说书人的段子里，青云宗成了反角。',
      },
      legacy: {
        name: '柳三的嘴',
        desc: '他教了一套"怎么听出话里的话"，说这比什么功法都管用。',
        require: { favor: 70, check: (d) => d.wuxing >= 72 },
        hint: '悟性要高',
        term: 'jianghu',
        reward: { stones: 600 },
      },
    },

    // ======================= 个人（长生） =======================
    {
      id: 'yun_gu',
      name: '云姑',
      title: '妖林采药婆',
      kind: 'npc',
      lifespan: null,
      region: 'miwuyanlin',
      role: 'hermit',
      desc: '在迷雾妖林里住了不知道多少年，背篓里的草药比镇上药铺还全。没人知道她怎么进来的，也没人敢问。',
      persona: '古怪、嘴硬心软',
      likes: (d) => (hasTag(d, 'combat') ? 0.4 : 0) + (hasTag(d, 'lonely') ? 0.3 : -0.2) + (d.gengu > 75 ? 0.3 : 0),
      meet: [
        {
          text: (c) =>
            `雾里忽然伸出一只手，把${c.d.name}拽到一边。云姑皱着眉：` +
            `"踩着我药田了。瞎了？"她弯腰把被踩倒的草扶起来，` +
            `又瞪了一眼，"手上划了口子都不知道疼？过来。"`,
          favor: [2, 4], disc: [4, 9], item: 'yunlingcao',
        },
        {
          text: (c) =>
            `云姑在雾里翻着背篓，头也不抬："你们宗门那个谁，上回替我把药篓背下山的，` +
            `还活着没？"得到肯定回答后，她从篓底摸出一样东西扔过来，` +
            `"告诉他，下次别走那条道，有东西。"`,
          favor: [3, 6], disc: [3, 7],
        },
        {
          text: (c) =>
            `${c.d.name}在雾里迷了三日，最后是闻着药味找到云姑的茅屋。` +
            `云姑递过一碗热水："能闻着味儿找过来，还不算太笨。"`,
          favor: [1, 3], disc: [5, 10],
        },
      ],
      mood: {
        warm: '云姑见了宗门的人，会从背篓里摸出两株新鲜草药塞过去。',
        neutral: '云姑对宗门谈不上好恶。',
        cold: '云姑见了宗门的人就绕道走，草药半株也不给。',
      },
      legacy: {
        name: '云姑的药方',
        desc: '她把一本手抄的药方给了人，说"这东西跟着我没用，跟着你还有点用处"。',
        require: { favor: 52, check: (d) => skillOf(d, 'alchemy') >= 45 || hasTag(d, 'craft') },
        hint: '得会摆弄药',
        term: 'yaoxing',
        reward: { item: 'tianlingguo' },
      },
    },
    {
      id: 'a_man',
      name: '阿蛮',
      title: '妖林小妖',
      kind: 'npc',
      lifespan: null,
      region: 'miwuyanlin',
      role: 'spirit',
      desc: '在妖林深处化形不足百年，还不大会说人话。喜欢亮闪闪的东西，也喜欢对她好的人。',
      persona: '单纯、记仇、认死理',
      likes: (d) => (hasTag(d, 'lucky') ? 0.5 : 0) + (hasTag(d, 'aggressive') ? -0.6 : 0) + (d.mood > 60 ? 0.3 : 0),
      meet: [
        {
          text: (c) =>
            `树后探出半张脸，眼睛又黑又亮。阿蛮盯着${c.d.name}看了很久，` +
            `忽然伸出手——不是要东西，是把自己采的一把野果放在地上，然后退开三步，` +
            `歪着头看他。`,
          favor: [2, 5], disc: [6, 12], item: 'tianlingguo', chance: 0.2,
        },
        {
          text: (c) =>
            `阿蛮记住${c.d.name}了。因为上次他给了她一块糖，` +
            `这次她一见他，就从树洞里捧出一样东西，郑重其事地塞进他手里，` +
            `然后又跑掉了。`,
          favor: [1, 3], disc: [8, 15],
        },
      ],
      mood: {
        warm: '阿蛮会远远跟着宗门的人，被发现了就跑，跑了两步又回头。',
        neutral: '阿蛮对宗门没什么概念。',
        cold: '阿蛮一听见宗门的名号就往树后躲。',
      },
      legacy: {
        name: '阿蛮的果子',
        desc: '她拉着他走到林子最深处，指着一棵树，说"以后都给你"。',
        require: { favor: 60, check: (d) => hasTag(d, 'lucky') || d.mood >= 65 },
        hint: '得让她真心喜欢',
        term: 'yaoyuan',
        reward: { item: 'tianlingguo' },
      },
    },
    {
      id: 'xuan_jizi',
      name: '玄玑子',
      title: '古战场老道',
      kind: 'npc',
      lifespan: null,
      region: 'duanhun',
      role: 'hermit',
      desc: '一个在断魂古战场边上结庐而居的老道，看不出年纪。据说他在这里已经等了三百年。',
      persona: '淡然、惜字如金',
      likes: (d) => (d.wuxing > 80 ? 0.7 : -0.2) + (hasTag(d, 'genius') ? 0.4 : 0) + (hasTag(d, 'aggressive') ? -0.3 : 0),
      meet: [
        {
          text: (c) =>
            `玄玑子坐在一块断碑上，连眼睛都没睁。半晌，他开口了，` +
            `说的不是${c.d.name}的修为，而是"你心里那件事，想通了没有"。` +
            `${c.d.name}愣在原地，一时答不上来。`,
          favor: [1, 4], disc: [6, 14],
        },
        {
          text: (c) =>
            `老道把${c.d.name}叫住，随手指了指天边一片云：` +
            `"看那个。看懂了再来找我。"说完就闭上眼，再不理人。`,
          favor: [2, 5], disc: [5, 12], wuxing: 1, chance: 0.4,
        },
        {
          text: (c) =>
            `玄玑子难得地站起身，绕着${c.d.name}走了一圈，` +
            `"根骨一般，悟性尚可。"他顿了顿，"比根骨一般的强。"`,
          favor: [0, 2], disc: [4, 9],
        },
      ],
      mood: {
        warm: '玄玑子见了宗门的人会点点头，这在他是极难得的礼数。',
        neutral: '玄玑子对宗门漠不关心。',
        cold: '玄玑子把茅屋的门关上了。',
      },
      legacy: {
        name: '玄玑子的道',
        desc: '他只说了三句话。说完就转过身去，再没开过口。',
        require: { favor: 55, check: (d) => d.wuxing >= 78 },
        hint: '悟性得极高',
        term: 'kuidao',
        reward: { exp: 400 },
      },
    },
    {
      id: 'xiazi_li',
      name: '瞎子李',
      title: '归墟守崖人',
      kind: 'npc',
      lifespan: null,
      region: 'guixu',
      role: 'hermit',
      desc: '守在归墟边上的一间破屋，眼睛看不见，但没人敢说他瞎。他听得见崖底的声音。',
      persona: '沉默、知道很多',
      likes: (d) => (d.daoxin > 78 ? 0.6 : 0) + (hasTag(d, 'fragile') ? 0.2 : 0),
      meet: [
        {
          text: (c) =>
            `瞎子李坐在门槛上，侧着耳朵。"你又来了。"他说。` +
            `${c.d.name}明明从未来过。老人没有解释，只把手里的木杖往崖边指了指：` +
            `"今天别往那边去。"`,
          favor: [2, 5], disc: [5, 11],
        },
        {
          text: (c) =>
            `瞎子李忽然开口："崖底下有东西在数人。数到第几了？"` +
            `没人答得上来。他自己笑了笑："我也没数清。"`,
          favor: [1, 3], disc: [3, 8],
        },
      ],
      mood: {
        warm: '瞎子李会主动跟宗门的人说一句"崖边风大"。',
        neutral: '瞎子李对宗门不置可否。',
        cold: '瞎子李把门关上了，屋里没点灯。',
      },
      legacy: {
        name: '瞎子李的听',
        desc: '他让人闭上眼，在崖边坐了七天。第八天睁眼时，说"现在能听见了"。',
        require: { favor: 50, check: (d) => d.daoxin >= 72 },
        hint: '道心要静',
        term: 'tingfeng',
        reward: { exp: 300 },
      },
    },
    {
      id: 'bai_xiaolou',
      name: '白小楼',
      title: '游荡散修',
      kind: 'npc',
      lifespan: 82,
      region: 'heifengkuang',
      role: 'wanderer',
      desc: '一个二十出头的散修，无门无派，剑法杂得很，但快。嘴也快。',
      persona: '话多、爱吹牛、讲义气',
      likes: (d) => (hasTag(d, 'combat') ? 0.4 : 0) + (hasTag(d, 'social') ? 0.4 : 0) + (d.age < 22 ? 0.3 : -0.1),
      meet: [
        {
          text: (c) =>
            `"哎，你是青云宗的人吧？"白小楼凑上来，自来熟得很，` +
            `"我跟你们宗门的人打过三回，输了两回。第三回那家伙叫什么来着——"` +
            `他挠挠头，"算了，反正我记不住名字。"`,
          favor: [1, 4], disc: [5, 11],
        },
        {
          text: (c) =>
            `白小楼蹲在矿洞口啃干粮，见了${c.d.name}就招手：` +
            `"来来来，分你一半。别客气，我这人就这样，见者有份。"` +
            `他把半块饼塞过来，油乎乎的手在衣服上蹭了蹭。`,
          favor: [2, 5], disc: [6, 12], mood: 6,
        },
        {
          text: (c) =>
            `白小楼神秘兮兮地压低声音："我在洞里头见着个东西，` +
            `比你见过的都大。要不要一起去看看？"他眼里有光，` +
            `"不过先说好，打不过你就跑，别管我。"`,
          favor: [1, 3], disc: [4, 9], chance: 0.4,
        },
      ],
      mood: {
        warm: '白小楼逢人就说宗门的好话，说得有点过了。',
        neutral: '白小楼对宗门的态度随缘。',
        cold: '白小楼见了宗门的人，把脸一扭。',
      },
      legacy: {
        name: '白小楼的剑',
        desc: '他把剑法拆开，一招一招慢动作演了三遍，说"快不难，难的是不乱"。',
        require: { favor: 50, check: (d) => hasTag(d, 'combat') || d.gengu >= 70 },
        hint: '得是个练剑的料',
        term: 'kuaiJian',
        reward: { item: 'xuanTie' },
      },
    },
  ];

  const BY_ID = {};
  for (const n of NPCS) BY_ID[n.id] = n;
  const get = (id) => BY_ID[id] || null;
  const ofRegion = (rid) => NPCS.filter((n) => n.region === rid);

  const ROLE_NAME = {
    merchant: '商贾', hermit: '隐世', rival: '对手',
    official: '官府', spirit: '精怪', wanderer: '游侠',
  };

  S.npcs = { NPCS, BY_ID, get, ofRegion, ROLE_NAME, hasTag };
})(window.Sect);
