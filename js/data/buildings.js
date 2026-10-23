/* ===========================================================
 * buildings.js — 宗门建筑
 *
 * 建筑可以入驻弟子。入驻之后，弟子每年会在里面"干活"，
 * 按建筑类型和自身技能产出东西——不再出去跑任务。
 *
 * 等级 1~4，等级越高名额越多、效率越高。
 * =========================================================== */
(function (S) {
  'use strict';

  const BUILDINGS = [
    {
      id: 'lingtian',
      name: '灵田',
      icon: '田',
      cost: 500,
      upgrades: [900, 1600, 2600],
      slots: [2, 3, 4, 6],
      keySkill: null,
      minRank: 'menial',
      desc: '后山辟出的几畦药田。灵气不足，但胜在踏实，谁都能种。多余的灵材挑到山下卖了，也能换些灵石。',
      flavor: [
        '{d}在田里忙了一整天，直起腰的时候天已经黑了。',
        '{d}蹲在垄边看那几株苗看了半晌，伸手把旁边的杂草拔了。',
        '{d}挑了两桶水上山，一趟要走小半个时辰。',
        '{d}把这一茬多出来的灵草捆好，挑下山换了点散碎银子。',
      ],
      output: '灵石与灵材',
    },
    {
      id: 'lingkuang',
      name: '灵矿',
      icon: '矿',
      cost: 800,
      upgrades: [1400, 2400, 4000],
      slots: [2, 3, 4, 6],
      keySkill: null,
      minRank: 'menial',
      desc: '后山凿出来的一条矿脉。出力气就能挖，不看手艺。刨出来的石头能炼器，粗料也能换钱。',
      flavor: [
        '{d}在矿道里凿了一整天，出来时只剩眼白是干净的。',
        '{d}背着一筐矿石从坡上下来，肩膀磨破了，没吭声。',
        '{d}在掌子面上敲了敲，说"这边还有"，第二天果然见了货。',
      ],
      output: '灵石与矿材',
    },
    {
      id: 'danfang',
      name: '丹房',
      icon: '丹',
      cost: 900,
      upgrades: [1500, 2600, 4200],
      slots: [1, 2, 3, 4],
      keySkill: 'alchemy',
      minRank: 'outer',
      desc: '三口丹炉，一屋子药味。火候差一线，一炉就废了。',
      flavor: [
        '{d}在丹炉前守了两天两夜，眼睛都红了。',
        '{d}把废掉的一炉药倒掉，重新称量，一句话没说。',
        '{d}开炉的时候退了半步——那股气冲得人睁不开眼。',
      ],
      output: '丹药',
    },
    {
      id: 'qige',
      name: '器阁',
      icon: '器',
      cost: 1100,
      upgrades: [1800, 3000, 4800],
      slots: [1, 2, 3, 4],
      keySkill: 'forging',
      minRank: 'outer',
      desc: '风箱、铁砧、淬火池。叮叮当当，昼夜不歇。',
      flavor: [
        '{d}在炉前敲了三天，手上烫起好几个泡。',
        '{d}把剑胚浸进水里，白汽腾起来，遮住了半张脸。',
        '{d}对着一道裂纹发了半天呆，最后把整块料重新熔了。',
      ],
      output: '器物',
    },
    {
      id: 'zhangfang',
      name: '账房',
      icon: '账',
      cost: 1200,
      upgrades: [2000, 3200, 5000],
      slots: [1, 2, 3, 3],
      keySkill: 'trade',
      minRank: 'inner',
      desc: '一个管钱的地方。算盘声比丹炉声更让人安心，也更让人心烦。',
      flavor: [
        '{d}在账房里核了一夜的账，天亮时把算盘一推，长长出了口气。',
        '{d}跟山下商队的人磨了半个时辰，把价钱压下来两成。',
        '{d}把库房里积压的东西清出来，装车运下山去卖了。',
      ],
      output: '灵石',
    },
    {
      id: 'zhaoxian',
      name: '招贤馆',
      icon: '贤',
      cost: 1500,
      upgrades: [2400, 3800, 5600],
      slots: [1, 2, 2, 3],
      keySkill: 'leadership',
      minRank: 'elder',
      desc: '山门旁的一间偏厅。来求道的人先在这里坐一坐，喝碗茶。长老坐镇，够格的人当场就能入门。',
      flavor: [
        '{d}跟山下来的人聊了一下午，把人聊哭了，最后留了下来。',
        '{d}在偏厅里翻了翻名册，划掉几个名字，又添上一个。',
        '{d}写了十几封信，托人带下山去。',
      ],
      output: '弟子',
    },
    {
      id: 'cangjing',
      name: '藏经阁',
      icon: '经',
      cost: 1000,
      upgrades: [1600, 2800, 4400],
      slots: [1, 2, 3, 4],
      keySkill: null,
      minRank: 'inner',
      desc: '三层木楼，供着历代祖师的功法。谁守着它，谁就先读到它。',
      flavor: [
        '{d}把阁里的书搬出来晒了一遍，一册一册拍去灰尘。',
        '{d}在灯下抄了一夜的经文，笔尖磨秃了两支。',
        '{d}在阁顶坐了一宿，什么也没看，只是坐着。',
      ],
      output: '全宗门修炼加成',
    },
  ];

  const BY_ID = {};
  for (const b of BUILDINGS) BY_ID[b.id] = b;
  const get = (id) => BY_ID[id] || null;

  /** 升到 level 级需要的灵石 */
  function upgradeCost(def, targetLevel) {
    // targetLevel 2/3/4 -> upgrades[0/1/2]
    return def.upgrades[targetLevel - 2] || 0;
  }

  const MAX_LEVEL = 4;

  S.buildings = { BUILDINGS, BY_ID, get, upgradeCost, MAX_LEVEL };
})(window.Sect);
