/* ===========================================================
 * npc.js — 江湖人物的交互
 *
 * 三种接触方式：
 *   1. 弟子历练时偶遇（按区域匹配）
 *   2. 宗门好感够高时，NPC 主动来访
 *   3. 宗门好感太低时，NPC 上门找麻烦
 *
 * 好感分两套：sectFavor 对宗门，discipleFavor 对具体弟子。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;

  function ensure(st, npcId) {
    if (!st.npcs) st.npcs = {};
    if (!st.npcs[npcId]) {
      const def = S.npcs.get(npcId);
      st.npcs[npcId] = {
        sectFavor: 0,
        discipleFavor: {},
        met: 0,
        lastWeek: 0,
        // 有寿数的（凡人）才记年龄，长生的不记
        age: def && def.lifespan ? 20 : null,
        departed: false,
        legacyDone: false,
      };
    }
    return st.npcs[npcId];
  }

  const sectFavorOf = (st, npcId) => (st.npcs && st.npcs[npcId] ? st.npcs[npcId].sectFavor : 0);
  const discFavorOf = (st, npcId, dId) => {
    const r = st.npcs && st.npcs[npcId];
    return r ? (r.discipleFavor[dId] || 0) : 0;
  };

  /** 好感档位，用于文案与判定 */
  function favorLabel(v) {
    if (v >= 70) return { name: '亲近', cls: 'fav-great' };
    if (v >= 35) return { name: '友善', cls: 'fav-good' };
    if (v >= 10) return { name: '点头之交', cls: 'fav-mild' };
    if (v > -10) return { name: '泛泛', cls: 'fav-none' };
    if (v > -35) return { name: '冷淡', cls: 'fav-bad' };
    if (v > -70) return { name: '敌意', cls: 'fav-worse' };
    return { name: '仇视', cls: 'fav-worst' };
  }

  // =========================================================
  //  偶遇
  // =========================================================
  /**
   * 弟子在某个区域历练时，可能碰到该区域的 NPC。
   * 返回 { text, meta, kind } 或 null。
   */
  function encounter(st, d, region, week) {
    // 已经不在的人/势力，不会再遇到
    const pool = S.npcs.ofRegion(region.id).filter((n) => {
      const r = st.npcs && st.npcs[n.id];
      return !(r && r.departed);
    });
    if (!pool.length) return null;
    if (!U.chance(0.46)) return null;

    const npc = U.pick(pool);
    const rec = ensure(st, npc.id);
    const meet = U.pick(npc.meet);

    const likes = npc.likes ? npc.likes(d) : 0;  // -1 ~ 1
    const scale = 1 + likes * 0.75;

    let dSect = Math.round(U.rand(meet.favor[0], meet.favor[1]) * scale);
    let dDisc = Math.round(U.rand(meet.disc[0], meet.disc[1]) * scale);

    // 好感越高越难再涨——不然跑几十年就全都顶到 100 了
    if (dSect > 0) {
      dSect = Math.round(dSect * 1.5 * Math.max(0.12, 1 - rec.sectFavor / 130));
    }
    // 关系差的时候，一点小事都会被放大
    if (dSect < 0 && rec.sectFavor < -20) {
      dSect = Math.round(dSect * 1.3);
    }

    rec.sectFavor = U.clamp(rec.sectFavor + dSect, -100, 100);
    rec.discipleFavor[d.id] = U.clamp((rec.discipleFavor[d.id] || 0) + dDisc, -100, 100);
    rec.met++;
    rec.lastWeek = week;

    const out = [];
    out.push({
      text: meet.text({ d, npc, st, region }),
      kind: 'social',
    });

    const metaParts = [];
    if (dSect !== 0) metaParts.push(`${npc.name}对宗门${S.stories.fmtSigned(dSect)}`);
    if (dDisc !== 0) metaParts.push(`对${d.name} ${S.stories.fmtSigned(dDisc)}`);
    let meta = metaParts.join(' · ');

    // 附带效果
    if (meet.item && U.chance(meet.chance === undefined ? 0.5 : meet.chance)) {
      const it = S.items.get(meet.item);
      if (it) {
        S.state.warehouseAdd(it.id, 1);
        st.sect.totalLoot++;
        out.push({
          text: `${npc.name}塞过来一样东西：「${it.name}」。${d.name}想推辞，被瞪了一眼。`,
          kind: 'loot',
        });
        meta = (meta ? meta + ' · ' : '') + `得${it.name}`;
      }
    }
    if (meet.wuxing) {
      d.wuxing = U.clamp(d.wuxing + meet.wuxing, 10, 99);
      out.push({
        text: `${npc.name}说了几句话。${d.name}回去的路上一直在想，` +
          `走到山门时，忽然明白了一点什么。`,
        kind: 'growth',
      });
      meta = (meta ? meta + ' · ' : '') + `悟性 +${meet.wuxing}`;
    }
    if (meet.mood) D.adjustMood(d, meet.mood);
    if (meet.info) {
      // 情报：来年历练收益提升（写入临时标记）
      d.infoBonus = 1;
      out.push({
        text: `柳三先生凑过来，压低声音说了几句。${d.name}听完，` +
          `脸色变了变，拱手道了谢。`,
        kind: 'social',
      });
    }

    out[out.length - 1].meta = meta;

    // 好感够了、弟子也够格，也许他会多教一点东西
    const legacy = tryLegacy(st, d, npc, rec);
    if (legacy) out.push(legacy);

    return out;
  }

  // =========================================================
  //  传承
  // =========================================================
  /** 现在谁手里还拿着这个词条（死了/走了就没了） */
  function holderOf(st, termId) {
    for (const x of st.disciples) {
      if (x.terms.includes(termId)) return x;
    }
    return null;
  }

  /**
   * 好感 + 弟子条件都达标时，触发传承。
   * 词条是唯一的——只要还有人活着拿着它，就不会再传给第二个人。
   * 拿的人死了（寿元到、战死、渡劫没过去），才轮得到下一位。
   */
  function tryLegacy(st, d, npc, rec) {
    const lg = npc.legacy;
    if (!lg) return null;
    if (rec.sectFavor < lg.require.favor) return null;
    if (!lg.require.check(d)) return null;

    // 唯一性：还有人拿着，就等
    const holder = holderOf(st, lg.term);
    if (holder) return null;

    rec.legacyDone = true;
    rec.legacyWho = d.id;

    const term = S.terms.get(lg.term);
    d.terms.push(lg.term);
    if (!Array.isArray(d.termSources)) d.termSources = [];
    d.termSources.push({ term: lg.term, from: npc.name });

    const gains = [];
    const rw = lg.reward || {};
    if (rw.stones) {
      S.state.addStones(rw.stones);
      gains.push(`灵石 +${rw.stones}`);
    }
    if (rw.rep) {
      S.state.addRep(rw.rep);
      gains.push(`名望 +${rw.rep}`);
    }
    if (rw.item) {
      const it = S.items.get(rw.item);
      if (it) {
        S.state.warehouseAdd(it.id, 1);
        gains.push(`得「${it.name}」`);
      }
    }
    if (rw.exp) {
      const tmp = [];
      S.disciple.gainExp(d, rw.exp);
      gains.push(`修为 +${rw.exp}`);
    }

    D.addHistory(d, `得${npc.name}传授，习得「${term ? term.name : lg.term}」`);
    D.adjustMood(d, 20);
    D.adjustLoyalty(d, 8);

    // 记进宗门纪事：人没了，这件事该还在
    if (!Array.isArray(st.legacyLog)) st.legacyLog = [];
    st.legacyLog.unshift({
      year: st.week - 1,
      npcId: npc.id,
      npcName: npc.name,
      discipleId: d.id,
      discipleName: d.name,
      term: lg.term,
      termName: term ? term.name : lg.term,
    });

    return {
      text: `${lg.desc} ${d.name}愣住了，半天才想起要行礼。` +
        `${npc.name}摆摆手，把话头岔开了。` +
        (gains.length ? `（${gains.join('、')}）` : ''),
      kind: 'fortune',
      meta: `传承 · 习得「${term ? term.name : '?'}」`,
      legacyTerm: lg.term,
      legacyFrom: npc.name,
    };
  }

  // =========================================================
  //  NPC 对弟子的个别待遇
  // =========================================================
  /** 弟子在某 NPC 那的私人好感带来的额外结果 */
  function personalFavorBonus(st, d, region, out) {
    if (!st.npcs) return;
    for (const npcId of Object.keys(st.npcs)) {
      const npc = S.npcs.get(npcId);
      if (!npc || npc.region !== region.id) continue;
      const rec = st.npcs[npcId];
      const f = rec.discipleFavor[d.id] || 0;
      if (f < 60 || !U.chance(0.3)) continue;

      // 特别照顾
      const it = U.pick(S.items.ofTier([2, 3]));
      S.state.warehouseAdd(it.id, 1);
      st.sect.totalLoot++;
      out.push({
        text: `${npc.name}听说${d.name}来了，特地绕过来，把一样东西塞给他：` +
          `「${it.name}」。他嘴上说的是“顺手”，可人人都知道不是。`,
        meta: `${npc.name}私交 · 得${it.name}`,
        kind: 'loot',
      });
      rec.discipleFavor[d.id] = U.clamp(f + 3, -100, 100);
    }
  }

  // =========================================================
  //  主动来访
  // =========================================================
  function visit(st, week) {
    const out = [];
    if (!st.npcs) return out;

    for (const npcId of Object.keys(st.npcs)) {
      const npc = S.npcs.get(npcId);
      if (!npc) continue;
      const rec = st.npcs[npcId];

      // ---- 友人来访 ----
      if (rec.sectFavor >= 55 && U.chance(0.13)) {
        const r = U.rand(0, 1);
        if (r < 0.4) {
          const stones = U.randInt(120, 400);
          S.state.addStones(stones);
          out.push({
            text: `${npc.name}来了。没带什么东西，只带了一句话：` +
              `“这一年多承蒙照应。”他把一个钱袋放在桌上就走了。`,
            meta: `灵石 +${stones}`,
            kind: 'sect',
          });
        } else if (r < 0.75) {
          const it = U.pick(S.items.ofTier([2, 3]));
          S.state.warehouseAdd(it.id, 1);
          st.sect.totalLoot++;
          out.push({
            text: `${npc.name}绕了远路来了一趟，把「${it.name}」留在库房门口。` +
              `守门的问他为什么不留个名，他摆摆手：“不必。”`,
            meta: `入库${it.name}`,
            kind: 'sect',
          });
        } else {
          // 引荐人才
          if (st.candidates.length < 4) {
            const taken = new Set(st.disciples.map((x) => x.name));
            const c = D.makeCandidate(taken);
            c.candidateWeek = week;
            c.pitch = `由${npc.name}引荐而来。`;
            // 引荐的人质量更好
            c.tianfu = U.clamp(c.tianfu + 8, 10, 99);
            c.wuxing = U.clamp(c.wuxing + 6, 10, 99);
            st.candidates.push(c);
            out.push({
              text: `${npc.name}带了个年轻人上山，说是故人之子，` +
                `“这孩子根骨不差，放你这儿我放心。”`,
              meta: `候选者 +1（${c.name}）`,
              kind: 'recruit',
            });
          }
        }
        rec.sectFavor = U.clamp(rec.sectFavor - 4, -100, 100);
      }

      // ---- 仇家找麻烦 ----
      else if (rec.sectFavor <= -45 && U.chance(0.11)) {
        const r = U.rand(0, 1);
        if (r < 0.5) {
          const loss = Math.min(st.sect.spiritStones, U.randInt(200, 600));
          if (loss > 0) {
            S.state.addStones(-loss);
            out.push({
              text: `${npc.name}的人在山道上劫了一批货。损失不算大，` +
                `但这件事传出去，面子不好看。`,
              meta: `灵石 -${loss}`,
              kind: 'danger',
            });
          }
        } else {
          const ds = st.disciples.filter((d) => d.injureWeeks === 0);
          if (ds.length) {
            const d = U.pick(ds);
            const tmp = [];
            D.injure(d, U.randInt(1, 2), tmp, `${npc.name}寻仇`);
            out.push({
              text: `${npc.name}在半路上堵了${d.name}。` +
                `对方没下死手，可比下死手更让人憋屈——他撂下一句话就走了：` +
                `“回去告诉你们宗主，这事没完。”`,
              meta: `${d.name}受伤`,
              kind: 'danger',
            });
            S.state.addRep(-2);
          }
        }
      }

      // ---- 好感自然回落 ----
      // 不来往就淡了。势力年年有人打交道，落得快些；
      // 隐世之人本就难得一见，淡得慢，不然永远也攒不够。
      const decay = npc.kind === 'faction' ? 1.0 : 0.3;
      if (rec.sectFavor > 0) rec.sectFavor = Math.max(0, rec.sectFavor - decay);
      else if (rec.sectFavor < 0) rec.sectFavor = Math.min(0, rec.sectFavor + decay * 0.6);
    }

    // ---- 凡人会老 ----
    ageNpcs(st, out);

    // ---- 有些人不请自来 ----
    dropIn(st, out);

    return out;
  }

  // =========================================================
  //  稀客下山
  // =========================================================
  /**
   * 归墟、断魂那种地方，弟子一辈子也去不了几回。
   * 所以让那两位偶尔自己摸上山来——不请自来，说一句就走。
   */
  const DROP_IN = {
    xiazi_li: [
      (c) =>
        `瞎子李站在山门外。没人看见他怎么上来的，山路那么陡。` +
        `执事要请他进去坐，他摆了摆手："我不进门。"` +
        `他在门槛外站了很久，侧着耳朵，忽然说："你们这山门底下，埋着东西。"` +
        `说完转身就走，竹杖点在石阶上，一下一下，慢慢下山去了。`,
      (c) =>
        `${c.d.name}在院子里扫地，抬头看见一个老人坐在廊下晒太阳。` +
        `问是谁放进来的，没人知道。老人从早上坐到日头偏西，` +
        `临走时站起来，说："东边那口井，别再用了。"`,
      (c) =>
        `瞎子李来得没头没尾。他在门口听了听，说："你们这儿人多。"` +
        `顿了顿，又补一句："以前没这么多。"`,
    ],
    xuan_jizi: [
      (c) =>
        `玄玑子出现在山道上，谁也没看见他上来。他绕着山门走了一圈，` +
        `抬头看了看那块匾，说："风水不错。"然后背着手，一步一步下山去了。`,
      (c) =>
        `老道在门槛上坐了一天，跟谁都没说话。日头偏西时他站起来，` +
        `对着${c.d.name}说了一句："告诉你们宗主，三年之内，别往北走。"`,
      (c) =>
        `${c.d.name}挑水回来，看见一个老道在溪边洗手。` +
        `水很凉，他洗得很慢。洗完站起来，看了${c.d.name}一眼，` +
        `"你身上有股味道。"说完就走了。`,
    ],
  };

  function dropIn(st, out) {
    if (!U.chance(0.075)) return;

    const pool = Object.keys(DROP_IN).filter((id) => {
      const r = st.npcs && st.npcs[id];
      return !(r && r.departed);
    });
    if (!pool.length) return;
    if (!st.disciples.length) return;

    const id = U.pick(pool);
    const npc = S.npcs.get(id);
    const rec = ensure(st, id);
    const d = U.pick(st.disciples);

    rec.met++;
    rec.lastWeek = st.week;
    const gain = U.rand(4, 8);
    rec.sectFavor = U.clamp(rec.sectFavor + gain, -100, 100);
    rec.discipleFavor[d.id] = U.clamp((rec.discipleFavor[d.id] || 0) + U.rand(5, 10), -100, 100);

    out.push({
      text: U.pick(DROP_IN[id])({ d, st }),
      kind: 'social',
      meta: `${npc.name}来访 · 对宗门 +${gain}`,
    });

    // 好感够了就照常走传承
    const legacy = tryLegacy(st, d, npc, rec);
    if (legacy) out.push(legacy);
  }

  /** 非长生的 NPC 会一年年老去，到寿数就退场 */
  function ageNpcs(st, out) {
    for (const npc of S.npcs.NPCS) {
      if (npc.lifespan === null || npc.lifespan === undefined) continue;
      const rec = ensure(st, npc.id);
      if (rec.departed) continue;

      rec.age = (rec.age || 20) + 1;
      if (rec.age < npc.lifespan) continue;

      rec.departed = true;
      rec.departedWeek = st.week;
      out.push({
        text: `${npc.name}老了。最后一次有人见他，是在${npc.region ? '山道' : '路上'}上，` +
          `背驼着，走得慢。后来就没人再见过他了。`,
        kind: 'info',
        meta: `${npc.name} 不再出现`,
      });
    }
  }

  /** 初始化：给每个 NPC 建档（不预先给好感） */
  function init(st) {
    if (!st.npcs) st.npcs = {};
    return st.npcs;
  }

  /** 已遇到过的人（江湖面板用） */
  function known(st) {
    const list = [];
    for (const npc of S.npcs.NPCS) {
      const rec = st.npcs ? st.npcs[npc.id] : null;
      if (!rec || rec.met <= 0) continue;
      list.push({ npc, rec, label: favorLabel(rec.sectFavor) });
    }
    list.sort((a, b) => b.rec.sectFavor - a.rec.sectFavor);
    return list;
  }

  S.systems = S.systems || {};
  S.systems.npc = {
    init, ensure, encounter, personalFavorBonus, visit, known,
    favorLabel, sectFavorOf, discFavorOf,
  };
})(window.Sect);
