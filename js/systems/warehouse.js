/* ===========================================================
 * warehouse.js — 仓库与弟子自主兑换
 *
 * 弟子用自己攒下的贡献点，从宗门仓库里兑换物资。
 * 兑换决策由词条与当前状态共同决定，玩家只能通过"买什么放进仓库"来引导。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const R = S.realm;

  /** 某弟子兑换该物品实际需要的贡献点 */
  function costFor(d, item) {
    const agg = D.aggOf(d);
    let c = item.contrib;
    if (item.type === 'pill') c *= 1 - agg.pillDiscount;
    return Math.max(1, Math.round(c));
  }

  /** 弟子是否需要这件东西（返回优先级分数，0 表示不要） */
  function desire(d, item) {
    const e = item.effect || {};
    let score = 0;

    if (e.heal && d.injureWeeks > 0) score += 100;
    if (e.heal && d.injureWeeks === 0) score += 0; // 没伤就不换

    if (e.breakBonus) {
      const need = R.expNeed(d.realm);
      const nearMajor = R.isMajor(d.realm) && d.exp > need * 0.6;
      score += nearMajor ? 90 : 5;
    }

    if (e.exp) {
      const need = R.expNeed(d.realm);
      const fill = Math.min(1, d.exp / need);
      // 越接近突破越愿意换，避免浪费
      score += (e.exp / 40) * (1 - fill * 0.5) * 12;
    }

    if (e.tianfu) {
      // 资质越低于 80，越想要
      score += e.tianfu * (d.tianfu < 80 ? 9 : 1);
    }
    if (e.wuxing) score += e.wuxing * (d.wuxing < 78 ? 7 : 1);
    if (e.daoxin) score += e.daoxin * (d.daoxin < 75 ? 6 : 1);
    if (e.purify) {
      const bad = d.terms.filter((id) => (S.terms.get(id) || {}).kind === 'bad').length;
      score += bad * 70;
    }
    if (e.guard) score += d.terms.some((id) => {
      const t = S.terms.get(id);
      return t && (t.tags.includes('fragile') || t.tags.includes('aggressive'));
    }) ? 35 : 6;

    if (e.power) score += 14;

    return Math.round(score);
  }

  /** 本年该弟子最想兑换的一件仓库物品 */
  function decide(d, st) {
    const options = [];
    for (const itemId of Object.keys(st.warehouse)) {
      if (st.warehouse[itemId] <= 0) continue;
      const item = S.items.get(itemId);
      if (!item) continue;
      const cost = costFor(d, item);
      if (d.contribution < cost) continue;
      const s = desire(d, item);
      if (s <= 0) continue;
      // 性价比：优先换效果强的，但不盲目换贵的
      const value = s / Math.max(6, cost);
      options.push({ itemId, item, cost, score: s, value });
    }
    if (!options.length) return null;

    // 受伤时优先疗伤丹，不要被性价比带偏
    if (d.injureWeeks > 0) {
      const heal = options.find((o) => o.item.effect && o.item.effect.heal);
      if (heal) return heal;
    }

    options.sort((a, b) => (b.value + b.score * 0.01) - (a.value + a.score * 0.01));
    const best = options[0];
    // 太贵的单项要犹豫一下（贡献点攒着更有用）
    if (best.cost > d.contribution * 0.92 && Math.random() < 0.35) return null;
    return best;
  }

  /** 执行兑换，返回事件文本数组 */
  function exchange(d, opt, st) {
    if (!S.state.warehouseTake(opt.itemId, 1)) {
      return [`${d.name} 想换「${opt.item.name}」，可仓库里已经空了。`];
    }

    d.contribution -= opt.cost;
    const events = [];
    const agg = D.aggOf(d);

    // 贪财：额外从宗门揩一笔
    if (agg.levyStones && st.sect.spiritStones > 0) {
      const levy = Math.min(
        st.sect.spiritStones,
        Math.max(5, Math.round(opt.item.value * 0.12))
      );
      S.state.addStones(-levy);
      events.push(`${d.name} 兑换时手脚不干净，顺走了宗门 ${levy} 灵石。`);
    }

    events.push(`${d.name} 以 ${opt.cost} 贡献点兑换了「${opt.item.name}」。`);
    events.push(...applyEffect(d, opt.item));
    D.addHistory(d, `兑换「${opt.item.name}」`);
    return events;
  }

  /** 应用物品效果 */
  function applyEffect(d, item) {
    const e = item.effect || {};
    const out = [];
    const R2 = R;

    if (e.heal) {
      if (d.injureWeeks > 0) {
        d.injureWeeks = 0;
        d.status = 'idle';
        D.adjustMood(d, 12);
        out.push(`${d.name} 服下${item.name}，伤势痊愈。`);
      }
    }
    if (e.guard) {
      d.guard = 1;
      out.push(`${d.name} 将${item.name}贴身收好。`);
    }
    if (e.breakBonus) {
      d.breakBonus += e.breakBonus;
      out.push(`${d.name} 备下${item.name}，只等突破那一日。`);
    }
    if (e.purify) {
      const idx = d.terms.findIndex((id) => (S.terms.get(id) || {}).kind === 'bad');
      if (idx >= 0) {
        const t = S.terms.get(d.terms[idx]);
        d.terms.splice(idx, 1);
        out.push(`${d.name} 服下${item.name}，身上「${t.name}」的旧患被一并涤去。`);
        // 词条变化后战力/成长立即变化
        D.addHistory(d, `洗去「${t.name}」`);
      } else {
        out.push(`${d.name} 服下${item.name}，一身轻松，却也没洗出什么名堂。`);
      }
    }
    if (e.tianfu) {
      d.tianfu = U.clamp(d.tianfu + e.tianfu, 10, 99);
      out.push(`${d.name} 服下${item.name}，根骨更上层楼（资质 +${e.tianfu}）。`);
    }
    if (e.wuxing) {
      d.wuxing = U.clamp(d.wuxing + e.wuxing, 10, 99);
      out.push(`${d.name} 参研${item.name}，心窍顿开（悟性 +${e.wuxing}）。`);
    }
    if (e.daoxin) {
      d.daoxin = U.clamp(d.daoxin + e.daoxin, 10, 99);
      out.push(`${d.name} 道心愈发坚固（道心 +${e.daoxin}）。`);
    }
    if (e.power) {
      d.gengu = U.clamp(d.gengu + e.power, 10, 99);
      out.push(`${d.name} 炼化${item.name}，筋骨更壮（根骨 +${e.power}）。`);
    }
    if (e.exp) {
      const evs = D.gainExp(d, e.exp, { silent: true });
      if (!evs.length) {
        out.push(`${d.name} 炼化${item.name}，修为涨了一截。`);
      } else {
        for (const ev of evs) out.push(ev.text);
      }
    }
    return out;
  }

  S.systems = S.systems || {};
  S.systems.warehouse = { costFor, desire, decide, exchange, applyEffect };
})(window.Sect);
