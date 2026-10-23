/* ===========================================================
 * locations.js — 宗门驻地
 *
 * 搬一次家，换一套得失。没有纯粹更好的地方，只有更适合当下处境的地方。
 *
 * effects：
 *   growthMul    全宗门修炼倍率
 *   upkeepMul    弟子年俸倍率
 *   repMul       声望获取倍率
 *   recruitMul   招徒概率倍率（也影响招贤馆）
 *   mineMul      灵矿产出倍率
 *   dangerMul    弟子受伤/遇险倍率
 *   auctionBonus 拍卖行品质加成（+1 表示高一档货）
 *   missionBonus 任务等级加成
 *   capacityBonus 额外容量
 * =========================================================== */
(function (S) {
  'use strict';

  const LOCATIONS = [
    {
      id: 'houshan',
      name: '青竹后山',
      desc: '开山时就在这儿。竹影深，灵气平，离县城不远不近，什么都是"还行"。',
      pros: ['地势安稳，弟子少遭横祸', '没什么开销，养得起人'],
      cons: ['灵气平平，修炼不快', '商路偏远，拍不到好东西'],
      effects: {
        growthMul: 1.0, upkeepMul: 1.0, repMul: 1.0,
        recruitMul: 1.0, mineMul: 1.0, dangerMul: 1.0,
        auctionBonus: 0, missionBonus: 0, capacityBonus: 0,
      },
      cost: 0,
      minGrade: 1,
    },
    {
      id: 'luoxiagu',
      name: '落霞谷口',
      desc: '在坊市边上。出门就是人声，抬头就是价签。热闹，也吵。',
      pros: ['拍卖行就在门口，能见到高档货', '来往的人多，招徒容易'],
      cons: ['灵气被市井冲散了，修炼慢', '山门开销大，年俸要加三成'],
      effects: {
        growthMul: 0.88, upkeepMul: 1.2, repMul: 1.1,
        recruitMul: 1.25, mineMul: 1.0, dangerMul: 1.0,
        auctionBonus: 1, missionBonus: 0, capacityBonus: 4,
      },
      cost: 4000,
      minGrade: 2,
    },
    {
      id: 'heifeng',
      name: '黑风岭',
      desc: '整条岭都是矿。风大，石头多，土里埋着灵石，也埋着东西。',
      pros: ['灵矿产量翻倍，灵石来得快', '年俸便宜——山里什么都能自己种'],
      cons: ['妖兽出没，弟子出门就有风险', '离坊市远，拍不到稀罕物'],
      effects: {
        growthMul: 1.0, upkeepMul: 0.88, repMul: 0.95,
        recruitMul: 0.9, mineMul: 2.0, dangerMul: 1.35,
        auctionBonus: -1, missionBonus: 0, capacityBonus: 6,
      },
      cost: 7000,
      minGrade: 3,
    },
    {
      id: 'yunmeng',
      name: '云梦泽',
      desc: '一整片水泽泡在灵脉上。有人说在这儿打坐一年，顶别处三年。',
      pros: ['灵气极盛，修炼快三成', '地方大，容得下更多人'],
      cons: ['地价贵，年俸要加四成', '偏僻，招不到什么人'],
      effects: {
        growthMul: 1.28, upkeepMul: 1.42, repMul: 0.95,
        recruitMul: 0.8, mineMul: 0.9, dangerMul: 1.0,
        auctionBonus: 0, missionBonus: 0, capacityBonus: 10,
      },
      cost: 16000,
      minGrade: 4,
    },
    {
      id: 'duanhun',
      name: '断魂原',
      desc: '就在古战场边上。夜里能听见兵戈声，白天能捡到前人的东西。',
      pros: ['任务等级高一档，声望涨得快', '古战场出好东西'],
      cons: ['凶险，弟子容易折在这儿', '风水不好，修炼略有妨碍'],
      effects: {
        growthMul: 1.08, upkeepMul: 1.05, repMul: 1.3,
        recruitMul: 0.95, mineMul: 1.0, dangerMul: 1.55,
        auctionBonus: 0, missionBonus: 1, capacityBonus: 6,
      },
      cost: 26000,
      minGrade: 5,
    },
    {
      id: 'huangcheng',
      name: '皇城郊',
      desc: '在天子脚下。官府认你，百姓敬你，来投的人踏破门槛。',
      pros: ['声望涨得快，招徒极容易', '凡俗供奉多，名声就是钱'],
      cons: ['灵气最薄，修炼最慢', '处处要打点，年俸最贵'],
      effects: {
        growthMul: 0.8, upkeepMul: 1.35, repMul: 1.45,
        recruitMul: 1.6, mineMul: 0.8, dangerMul: 0.8,
        auctionBonus: 1, missionBonus: 0, capacityBonus: 8,
      },
      cost: 40000,
      minGrade: 5,
    },
  ];

  const BY_ID = {};
  for (const l of LOCATIONS) BY_ID[l.id] = l;

  const get = (id) => BY_ID[id] || LOCATIONS[0];

  /** 默认全是 1 / 0，方便各处直接取用 */
  const DEFAULT_EFFECTS = {
    growthMul: 1, upkeepMul: 1, repMul: 1, recruitMul: 1,
    mineMul: 1, dangerMul: 1, auctionBonus: 0, missionBonus: 0, capacityBonus: 0,
  };

  function effectsOf(st) {
    const loc = get(st && st.sect ? st.sect.location : 'houshan');
    return Object.assign({}, DEFAULT_EFFECTS, loc.effects);
  }

  S.locations = { LOCATIONS, BY_ID, get, effectsOf, DEFAULT_EFFECTS };
})(window.Sect);
