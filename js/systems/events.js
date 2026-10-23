/* ===========================================================
 * events.js — 弟子之间的交互
 *
 * 每个事件返回 [{ text, meta?, kind }]，text 是叙事，meta 是数字摘要。
 * 好感改动统一走 relations.change / changeBoth，这样关系阶段会自动流转。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const R = S.relations;
  const ST = S.stories;

  const nm = (d) => d.name;

  function injureInto(d, weeks, out, reason) {
    const tmp = [];
    D.injure(d, weeks, tmp, reason);
    for (const e of tmp) out.push({ text: e.text, kind: e.kind });
  }

  /** 好感变化 + 阶段跃迁时补一句 */
  function bond(a, b, delta, out, week) {
    const r = R.changeBoth(a, b, delta, week);
    if (r.a.fromId !== r.a.toId) {
      // 只有跨进"知己以上"或"结了仇"才单独说一句。
      // 中间阶段挪来挪去（相识→好友）交给具体事件本身去交代，不重复。
      const big = ['close', 'sworn', 'enemy', 'nemesis'];
      if (big.includes(r.a.toId) || big.includes(r.a.fromId)) {
        out.push({ text: relationShiftText(a, b, r.a), kind: 'social' });
      }
    }
    return r;
  }

  /** 关系阶段跃迁的旁白 */
  function relationShiftText(a, b, res) {
    const { from, to } = res;
    if (to.min > from.min) {
      // 变好
      if (to.id === 'acquaintance') return `${nm(a)}和${nm(b)}算是真正认识了。`;
      if (to.id === 'friend') return `${nm(a)}与${nm(b)}处出了交情，见面会多说两句话了。`;
      if (to.id === 'close') return `${nm(a)}与${nm(b)}成了知己。有些话，不必对别人说，只说给他们两个听。`;
      if (to.id === 'sworn') return `${nm(a)}与${nm(b)}之间已经有了过命的交情。`;
      return `${nm(a)}与${nm(b)}的交情淡了些。`;
    }
    // 变坏
    if (to.id === 'rival') return `${nm(a)}和${nm(b)}之间有了嫌隙，见面不再打招呼。`;
    if (to.id === 'enemy') return `${nm(a)}与${nm(b)}结了怨。旁人看得出，他们自己更清楚。`;
    if (to.id === 'nemesis') return `${nm(a)}与${nm(b)}已成死敌。这梁子，怕是解不开了。`;
    return `${nm(a)}与${nm(b)}之间缓和了一些。`;
  }

  // =========================================================
  //  成对事件池
  // =========================================================
  const PAIR_EVENTS = [
    // ---------------- 正面 ----------------
    {
      id: 'spar', weight: 22,
      cond: (a, b) => !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        bond(a, b, U.randInt(4, 9), out, st.week);
        D.adjustMood(a, 3); D.adjustMood(b, 3);
        D.gainExp(a, U.rand(2, 6), { silent: true });
        D.gainExp(b, U.rand(2, 6), { silent: true });
        out.push({
          text: U.pick([
            `${nm(a)}与${nm(b)}在石坪上拆了两百多招。打到后来两人都没力气了，` +
            `躺在石头上喘气，谁也没赢。`,
            `天没亮${nm(a)}就去找${nm(b)}练手。等日头上来，` +
            `两人一个捂着脸，一个按着腰，谁都说自己让了对方一招。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },
    {
      id: 'discuss', weight: 18,
      cond: (a, b) => (a.realm > 0 || b.realm > 0) && !R.isHostile(a, b.id),
      run(a, b, st) {
        const out = [];
        const elder = a.realm >= b.realm ? a : b;
        const younger = elder === a ? b : a;
        bond(a, b, U.randInt(3, 7), out, st.week);
        D.adjustMood(younger, 6);
        const gain = U.rand(3, 9) * (1 + elder.realm * 0.1);
        D.gainExp(younger, gain, { silent: true });
        D.gainExp(elder, gain * 0.3, { silent: true });
        out.push({
          text: U.pick([
            `${elder.name}把${younger.name}叫到自己屋里，一直讲到后半夜。` +
            `灯芯换了三回，${younger.name}记了满满两页纸。`,
            `“你这处错了。”${elder.name}伸手在${younger.name}手心画了一道。` +
            `${younger.name}盯着自己的手掌看了很久，忽然抬头，眼睛是亮的。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },
    {
      id: 'help', weight: 15,
      cond: (a, b) => a.status === 'injured' || b.status === 'injured' || a.mood < 45 || b.mood < 45,
      run(a, b, st) {
        const out = [];
        const hurt = a.status === 'injured' ? a : (b.status === 'injured' ? b : null);
        let helper, target;
        if (hurt) { helper = hurt === a ? b : a; target = hurt; }
        else { target = a.mood <= b.mood ? a : b; helper = target === a ? b : a; }

        bond(a, b, U.randInt(9, 16), out, st.week);

        if (hurt) {
          hurt.injureWeeks = Math.max(0, hurt.injureWeeks - 1);
          if (hurt.injureWeeks === 0) hurt.status = 'idle';
          D.adjustMood(hurt, 12);
          out.push({
            text: U.pick([
              `${nm(helper)}守在${nm(hurt)}榻前煎了三天的药。` +
              `药很苦，${nm(hurt)}喝一口皱一下眉，${nm(helper)}就当没看见。`,
              `${nm(hurt)}半夜疼醒，发现${nm(helper)}就坐在门口，` +
              `背靠着门框睡着了。`,
            ]),
            kind: 'social',
          });
        } else {
          D.adjustMood(target, 12);
          D.adjustMood(helper, 5);
          out.push({
            text: U.pick([
              `${nm(helper)}拎了一壶酒去找${nm(target)}。两人坐在屋顶上喝到半夜，` +
              `什么也没说，喝完就各自回去睡了。`,
              `${nm(target)}这几天不对劲，${nm(helper)}看出来了，` +
              `但没问，只是每天吃饭都坐到他旁边。`,
            ]),
            kind: 'social',
          });
        }
        return out;
      },
    },
    {
      id: 'drink', weight: 12,
      cond: (a, b) => !R.isHostile(a, b.id),
      run(a, b, st) {
        const out = [];
        bond(a, b, U.randInt(6, 12), out, st.week);
        D.adjustMood(a, 8); D.adjustMood(b, 8);
        out.push({
          text: U.pick([
            `${nm(a)}从山下带了一坛酒回来，拽着${nm(b)}上了后山。` +
            `第二天两人都误了早课，执事罚他们抄了三天的功法。`,
            `后半夜下起雨，${nm(a)}和${nm(b)}躲在山神庙里，` +
            `把仅有的一壶酒分着喝了。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },
    {
      id: 'adventure', weight: 10,
      cond: (a, b) => !R.isHostile(a, b.id) && a.status !== 'injured' && b.status !== 'injured',
      run(a, b, st) {
        const out = [];
        bond(a, b, U.randInt(10, 18), out, st.week);
        D.adjustMood(a, 10); D.adjustMood(b, 10);
        const gain = U.rand(30, 70);
        D.gainExp(a, gain, { silent: true });
        D.gainExp(b, gain, { silent: true });

        // 偶尔带点东西回来
        if (U.chance(0.45)) {
          const it = U.pick(S.items.ofTier([1, 2]));
          S.state.warehouseAdd(it.id, 1);
          st.sect.totalLoot++;
          out.push({
            text: `${nm(a)}和${nm(b)}偷偷溜下山去了一趟，回来时带了「${it.name}」。` +
              `没人知道他们去了哪，两人也守口如瓶。`,
            meta: `收获${it.name}`,
            kind: 'social',
          });
        } else {
          out.push({
            text: `${nm(a)}拉着${nm(b)}溜出宗门，说是去“见见世面”。` +
              `回来时两人身上都是灰，眼睛里却亮得吓人。`,
            kind: 'social',
          });
        }
        return out;
      },
    },
    {
      id: 'gift', weight: 9,
      cond: (a, b) => R.score(a, b.id) > 35 || R.score(b, a.id) > 35,
      run(a, b, st) {
        const out = [];
        const giver = R.score(a, b.id) >= R.score(b, a.id) ? a : b;
        const taker = giver === a ? b : a;
        bond(a, b, U.randInt(7, 14), out, st.week);
        D.adjustMood(taker, 8);
        out.push({
          text: U.pick([
            `${nm(giver)}把攒了很久的东西塞给${nm(taker)}，` +
            `什么也没说。${nm(taker)}想推，被按了回去。`,
            `${nm(giver)}把自己的一份口粮分了一半给${nm(taker)}，` +
            `说“我吃不了这么多”。谁都知道他吃得下。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },
    {
      id: 'nighttalk', weight: 12,
      cond: (a, b) => R.score(a, b.id) > 25 && R.score(b, a.id) > 25 && !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        const r = bond(a, b, U.randInt(14, 22), out, st.week);
        D.adjustMood(a, 10); D.adjustMood(b, 10);
        out.push({
          text: U.pick([
            `${nm(a)}和${nm(b)}在屋顶上坐了一整夜。` +
            `说得不多，多半时候只是看着天。天快亮时，${nm(b)}忽然说了一句什么，` +
            `${nm(a)}没接话，只是点了点头。`,
            `“你怕不怕？”${nm(a)}问。${nm(b)}想了很久，“怕。”` +
            `然后两个人都不说话了。那晚的月亮很白。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },

    // ---------------- 负面 ----------------
    {
      id: 'quarrel', weight: 9,
      cond: (a, b) => !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        const aggA = D.aggOf(a);
        const aggB = D.aggOf(b);
        const intensity = (aggA.conflict + aggB.conflict) / 2;
        bond(a, b, -U.randInt(8, 17), out, st.week);
        D.adjustMood(a, -8); D.adjustMood(b, -8);

        out.push({
          text: U.pick([
            `${nm(a)}和${nm(b)}在饭堂吵了起来。起因小得可笑——` +
            `谁先动的那碗汤。可吵到后来，说的就不是汤了。`,
            `“你什么意思？”${nm(a)}把碗往桌上一放。` +
            `${nm(b)}没抬头：“我什么意思，你心里清楚。”`,
            `${nm(a)}和${nm(b)}三天没说话。旁人都看出来了，谁也没提。`,
          ]),
          kind: 'conflict',
        });

        if (U.chance(0.35 * intensity)) {
          const loser = D.power(a) >= D.power(b) ? b : a;
          const winner = loser === a ? b : a;
          bond(a, b, -10, out, st.week);
          injureInto(loser, U.randInt(1, 2), out, '被同门所伤');
          out.push({
            text: `${winner.name}动了真火。${loser.name}被一掌打翻，` +
              `半天没爬起来。这件事，宗门里传了很久。`,
            kind: 'conflict',
          });
          D.adjustLoyalty(loser, -6);
        }
        return out;
      },
    },
    {
      id: 'duel', weight: 4,
      cond: (a, b) => (D.aggOf(a).conflict > 1.5 || D.aggOf(b).conflict > 1.5) && !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        const hot = D.aggOf(a).conflict >= D.aggOf(b).conflict ? a : b;
        const other = hot === a ? b : a;
        bond(a, b, -U.randInt(14, 26), out, st.week);
        D.adjustMood(hot, -12);
        D.gainExp(a, U.rand(9, 20), { silent: true });
        D.gainExp(b, U.rand(9, 20), { silent: true });

        out.push({
          text: `${hot.name}不肯咽下那口气，当着满院的人向${other.name}下了战书。` +
            `两人在演武台上打了小半个时辰，围观的人挤满了半座山。` +
            `最后是执事出面才拆开。`,
          kind: 'conflict',
        });

        if (U.chance(0.5)) {
          const loser = D.power(hot) > D.power(other) ? other : hot;
          injureInto(loser, 1, out, '同门比武');
        }
        return out;
      },
    },
    {
      id: 'theft', weight: 5,
      cond: (a, b) => !R.isLover(a, b) && (D.aggOf(a).skim > 0 || D.aggOf(b).skim > 0),
      run(a, b, st) {
        const out = [];
        const thief = D.aggOf(a).skim > 0 ? a : b;
        const victim = thief === a ? b : a;
        const amount = Math.min(victim.contribution, U.randInt(8, 30));
        if (amount <= 0) return [];
        victim.contribution -= amount;
        thief.contribution += amount;
        bond(a, b, -U.randInt(16, 34), out, st.week);
        D.adjustLoyalty(victim, -4);
        out.push({
          text: `${nm(victim)}的贡献牌不见了。三天后，有人在${nm(thief)}的箱底` +
            `看见了一个一模一样的。`,
          kind: 'conflict',
        });
        return out;
      },
    },
    {
      id: 'jealous', weight: 6,
      cond: (a, b) => {
        const gap = Math.abs(a.realm - b.realm);
        return gap >= 3 && !R.isLover(a, b) && !R.isSworn(a, b);
      },
      run(a, b, st) {
        const out = [];
        const better = a.realm > b.realm ? a : b;
        const worse = better === a ? b : a;
        bond(a, b, -U.randInt(6, 12), out, st.week);
        D.adjustMood(worse, -12);
        out.push({
          text: U.pick([
            `${nm(better)}又一次突破，宗门上下都在道贺。` +
            `${nm(worse)}站在人群最外面，脸上的笑很淡，很快就走了。`,
            `${nm(worse)}这半年几乎没长进。别人不提，可他知道，` +
            `${nm(better)}每见他一次，那眼神都在说同一件事。`,
          ]),
          kind: 'conflict',
        });
        return out;
      },
    },
    {
      id: 'gossip', weight: 5,
      cond: (a, b) => !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        bond(a, b, -U.randInt(4, 10), out, st.week);
        D.adjustMood(a, -4); D.adjustMood(b, -4);
        out.push({
          text: U.pick([
            `不知道从谁开始，宗门里传起了${nm(b)}的闲话。` +
            `${nm(a)}说得最起劲，被${nm(b)}听见了。`,
            `${nm(a)}在背后把${nm(b)}的事说给旁人听，` +
            `添油加醋。第三天，话传了一圈，又回到${nm(b)}耳朵里。`,
          ]),
          kind: 'conflict',
        });
        return out;
      },
    },
    {
      id: 'misunderstanding', weight: 7,
      cond: (a, b) => R.score(a, b.id) > 0 && !R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        // 先降后升，一次说清
        bond(a, b, -U.randInt(8, 14), out, st.week);
        out.push({
          text: U.pick([
            `${nm(a)}误会了${nm(b)}。起因是一件极小的事，` +
            `可${nm(a)}认定了，${nm(b)}又懒得解释。`,
            `${nm(b)}那天没去。${nm(a)}等了一整夜，` +
            `回来就把话说绝了。后来才知道，${nm(b)}是替他挡了事。`,
          ]),
          kind: 'conflict',
        });
        if (U.chance(0.55)) {
          bond(a, b, U.randInt(12, 20), out, st.week);
          out.push({
            text: `事情说开之后，${nm(a)}在${nm(b)}门前站了很久。` +
              `${nm(b)}出来倒水，看见他，愣了一下。` +
              `两人最后谁也没提那天的话。`,
            kind: 'social',
          });
        }
        return out;
      },
    },

    // ---------------- 道侣专属 ----------------
    {
      id: 'lover_care', weight: 40,
      cond: (a, b) => R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        bond(a, b, U.randInt(6, 12), out, st.week);
        D.adjustMood(a, 10); D.adjustMood(b, 10);
        // 双修：双双受益
        D.gainExp(a, U.randInt(20, 45), { silent: true });
        D.gainExp(b, U.randInt(20, 45), { silent: true });
        out.push({
          text: U.pick([
            `${nm(a)}和${nm(b)}在洞府里一同打坐。` +
            `两个时辰下来，两人的气息渐渐合到了一处。`,
            `${nm(b)}这几日心浮气躁，${nm(a)}什么也没说，` +
            `只是每晚都来陪他坐一会儿。`,
            `有人看见${nm(a)}在灯下替${nm(b)}补衣服，` +
            `针脚很粗，补了半天。`,
          ]),
          kind: 'social',
        });
        return out;
      },
    },
    {
      id: 'lover_quarrel', weight: 10,
      cond: (a, b) => R.isLover(a, b),
      run(a, b, st) {
        const out = [];
        bond(a, b, -U.randInt(10, 20), out, st.week);
        D.adjustMood(a, -15); D.adjustMood(b, -15);
        out.push({
          text: `最近${nm(a)}和${nm(b)}之间不太对劲。` +
            `两人还是一起吃饭，还是一起走，可话少了。` +
            `有一天${nm(a)}一个人在后山坐到很晚。`,
          kind: 'conflict',
        });
        return out;
      },
    },
  ];

  // =========================================================
  //  个人际遇
  // =========================================================
  function personalEvents(st, d) {
    const out = [];
    const agg = D.aggOf(d);

    if (agg.sickChance > 0 && U.chance(agg.sickChance)) {
      D.adjustMood(d, -10);
      injureInto(d, 1, out, '旧疾复发');
      out.push({
        text: `${nm(d)}的旧伤又犯了。他没说，只是这几天脸色一直不好，` +
          `打坐的时候会忽然停住，缓一会儿再继续。`,
        kind: 'danger',
      });
    }

    if (agg.curse > 0 && U.chance(agg.curse)) {
      const others = st.disciples.filter((x) => x.id !== d.id);
      if (others.length) {
        const victim = U.pick(others);
        injureInto(victim, U.randInt(1, 2), out, `${d.name}的命格`);
        bond(d, victim, -12, out, st.week);
        out.push({
          text: `${nm(victim)}只是和${nm(d)}同行了一趟，回来就病倒了。` +
            `上面的人说是巧合，可宗门里的老人看${nm(d)}的眼神变了。`,
          kind: 'danger',
        });
      }
    }

    if (d.mood > 55) D.adjustMood(d, -1);
    return out;
  }

  /** 痴情弟子对心上人的反应 */
  function loveReaction(st, d) {
    if (!d.loveTarget) return null;
    const target = S.state.discipleById(d.loveTarget);
    if (!target || target.status !== 'injured') return null;
    D.adjustMood(d, -25);
    D.adjustLoyalty(d, -4);
    d.exp = Math.max(0, d.exp - Math.round(S.realm.expNeed(d.realm) * 0.05));
    return {
      text: `${nm(d)}听说${nm(target)}受了伤，在门外站了一整夜。` +
        `第二天有人看见他眼睛是肿的，问他，他说风大。`,
      kind: 'social',
    };
  }

  // =========================================================
  //  主入口
  // =========================================================
  function weekly(st) {
    const out = [];
    const ds = st.disciples.filter((d) => d.status !== 'injured' || Math.random() < 0.5);

    if (ds.length >= 2) {
      const maxPairs = Math.min(4, Math.floor(ds.length / 2) + (ds.length >= 4 ? 1 : 0));
      const seen = new Set();
      let guard = 0;
      let made = 0;

      while (made < maxPairs && guard++ < 60) {
        let a = null;
        let b = null;

        // 大部分机会让"已有交情的人"再碰面，关系才有机会往深处走
        if (U.chance(0.65)) {
          a = U.pick(ds);
          const partners = Object.keys(a.bonds || {})
            .map((id) => ds.find((x) => x.id === id))
            .filter((p) => p && Math.abs(R.score(a, p.id)) > 15);
          if (partners.length) {
            b = U.weighted(partners, (p) => 1 + Math.abs(R.score(a, p.id)));
          }
        }
        if (!a || !b) {
          const pair = U.sample(ds, 2);
          if (pair.length < 2) break;
          a = pair[0];
          b = pair[1];
        }
        if (!a || !b || a.id === b.id) continue;

        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        // 道侣之间互动概率更高
        const isLover = R.isLover(a, b);
        const socialA = D.aggOf(a).socialMul;
        const socialB = D.aggOf(b).socialMul;
        let p = 0.5 * (socialA * socialB > 0 ? 1 : 0.2) * (1 + (a.mood + b.mood - 120) / 400);
        if (isLover) p = Math.max(p, 0.8);
        if (!U.chance(U.clamp(p, 0.08, 0.95))) continue;

        bindLove(st, a, b);

        const cand = PAIR_EVENTS.filter((e) => e.cond(a, b, st));
        if (!cand.length) continue;
        // 道侣优先走道侣专属事件
        const pool = isLover ? cand.filter((e) => e.id.startsWith('lover_')) : cand;
        const ev = U.weighted(pool.length ? pool : cand, (e) => e.weight);
        if (!ev) continue;

        const lines = ev.run(a, b, st);
        if (lines.length) {
          out.push(...lines);
          made++;
        }
      }
    }

    for (const d of st.disciples) {
      out.push(...personalEvents(st, d));
      const love = loveReaction(st, d);
      if (love) out.push(love);
    }

    return out;
  }

  /** 痴情弟子绑定心上人 */
  function bindLove(st, a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.loveTarget) continue;
      const has = x.terms.some((id) => (S.terms.get(id) || {}).tags.includes('love'));
      if (!has) continue;
      x.loveTarget = y.id;
      D.addHistory(x, `与${y.name}渐生情愫`);
      // 痴情是单向的，但会推动好感
      R.change(x, y.id, 15, st.week);
    }
  }

  S.systems = S.systems || {};
  S.systems.events = { weekly, bond, bindLove, PAIR_EVENTS };
})(window.Sect);
