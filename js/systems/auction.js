/* ===========================================================
 * auction.js — 拍卖行
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;

  /** 宗门等级 -> 各层级出现权重 */
  function tierWeights(level) {
    if (level <= 2) return { 1: 70, 2: 26, 3: 4, 4: 0 };
    if (level <= 4) return { 1: 45, 2: 40, 3: 13, 4: 2 };
    if (level <= 6) return { 1: 25, 2: 40, 3: 27, 4: 8 };
    return { 1: 12, 2: 33, 3: 38, 4: 17 };
  }

  function pickItem(level) {
    const w = tierWeights(level);
    const tier = Number(S.util.weighted(Object.keys(w), (k) => w[k]));
    const pool = S.items.ofTier([tier]);
    if (!pool.length) return U.pick(S.items.ITEMS);
    return U.pick(pool);
  }

  /** 刷新一批商品 */
  function refresh(st) {
    const level = st.sect.level;
    const count = 5 + Math.floor(level / 3);
    const list = [];
    const used = new Set();
    let guard = 0;
    while (list.length < count && guard++ < 200) {
      const it = pickItem(level);
      if (used.has(it.id)) continue;
      used.add(it.id);
      const priceMul = U.rand(0.82, 1.3);
      list.push({
        itemId: it.id,
        price: Math.max(5, Math.round(it.value * priceMul)),
        // 稀有货会被标红
        hot: priceMul > 1.18,
        sold: false,
      });
    }
    st.auction = list;
    return st.auction;
  }

  /** 购买：返回 {ok, msg} */
  function buy(st, index) {
    const slot = st.auction[index];
    if (!slot) return { ok: false, msg: '这件东西已经不在架子上了。' };
    if (slot.sold) return { ok: false, msg: '此物已售出。' };
    if (st.sect.spiritStones < slot.price) {
      return { ok: false, msg: '灵石不够，只能干看着。' };
    }
    const before = st.sect.spiritStones;
    S.state.addStones(-slot.price);
    S.state.warehouseAdd(slot.itemId, 1);
    slot.sold = true;
    const item = S.items.get(slot.itemId);
    S.state.addLog(`以 ${slot.price} 灵石拍下「${item.name}」，已存入仓库。`, 'auction');
    return { ok: true, msg: `以 ${slot.price} 灵石拍下「${item.name}」。` };
  }

  S.systems = S.systems || {};
  S.systems.auction = { refresh, buy, tierWeights };
})(window.Sect);
