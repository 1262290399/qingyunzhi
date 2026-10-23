/* ===========================================================
 * building.js — 宗门建筑
 *
 * 入驻建筑的弟子每年在里面干活，按建筑类型产出东西：
 *   灵田   产灵材          丹房   消耗灵材炼丹
 *   器阁   消耗灵矿炼器    账房   自动买卖，赚灵石
 *   招贤馆 自动拉人          藏经阁 全宗门修炼加成
 *
 * 入驻的弟子不出去跑任务，但仍在修炼（只是慢一些）。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const B = S.buildings;

  // =========================================================
  //  状态
  // =========================================================
  function init(st) {
    if (!st.buildings) st.buildings = {};
    for (const def of B.BUILDINGS) {
      if (!st.buildings[def.id]) {
        st.buildings[def.id] = { level: 0, occupants: [] };
      }
      if (!Array.isArray(st.buildings[def.id].occupants)) {
        st.buildings[def.id].occupants = [];
      }
    }
    return st.buildings;
  }

  const stateOf = (st, id) => (st.buildings ? st.buildings[id] : null);
  const isBuilt = (st, id) => {
    const b = stateOf(st, id);
    return !!(b && b.level > 0);
  };

  function slotCount(st, id) {
    const b = stateOf(st, id);
    if (!b || b.level <= 0) return 0;
    const def = B.get(id);
    return def.slots[b.level - 1] || 0;
  }

  function occupantsOf(st, id) {
    const b = stateOf(st, id);
    if (!b) return [];
    return b.occupants
      .map((did) => S.state.discipleById(did))
      .filter(Boolean);
  }

  // =========================================================
  //  建造 / 升级
  // =========================================================
  function build(st, id) {
    const def = B.get(id);
    if (!def) return { ok: false, msg: '没有这处地方。' };
    const b = stateOf(st, id);
    if (b && b.level > 0) return { ok: false, msg: '已经建好了。' };
    if (st.sect.spiritStones < def.cost) {
      return { ok: false, msg: `灵石不够，需要 ${def.cost}。` };
    }
    S.state.addStones(-def.cost);
    b.level = 1;
    b.occupants = [];
    S.state.addLog(`宗门建起了${def.name}。`, 'sect');
    return { ok: true, msg: `${def.name}落成，往后有人在这里做事了。` };
  }

  function upgrade(st, id) {
    const def = B.get(id);
    const b = stateOf(st, id);
    if (!def || !b || b.level <= 0) return { ok: false, msg: '这处地方还没有。' };
    if (b.level >= B.MAX_LEVEL) return { ok: false, msg: '已经是最高规格了。' };
    const cost = B.upgradeCost(def, b.level + 1);
    if (st.sect.spiritStones < cost) {
      return { ok: false, msg: `灵石不够，需要 ${cost}。` };
    }
    S.state.addStones(-cost);
    b.level++;
    S.state.addLog(`${def.name}扩建到 ${b.level} 级。`, 'sect');
    return { ok: true, msg: `${def.name}扩了，能多容下几个人。` };
  }

  // =========================================================
  //  入驻 / 撤出
  // =========================================================
  /**
   * 派人进建筑。
   * opts.force = true 时，如果人已经在别处，会先把他从那处撤出来（调岗）。
   * 默认不这么做——那会让人莫名其妙少个干活的。
   */
  function assign(st, id, discipleId, opts) {
    const def = B.get(id);
    const b = stateOf(st, id);
    const d = S.state.discipleById(discipleId);
    if (!def || !b || b.level <= 0) return { ok: false, msg: '这处地方还没有。' };
    if (!d) return { ok: false, msg: '查无此人。' };
    if (d.missionId) return { ok: false, msg: `${d.name}还在外面办事。` };

    if (!S.ranks.canEnter(d.rank || 'menial', id)) {
      return { ok: false, msg: `${S.ranks.nameOf(d.rank)}进不了${def.name}。` };
    }
    if (b.occupants.includes(discipleId)) return { ok: false, msg: '已经在里面了。' };
    if (b.occupants.length >= slotCount(st, id)) {
      return { ok: false, msg: `${def.name}满了。` };
    }

    // 已经从别处来的人：要么拒绝，要么显式调岗
    let fromName = null;
    if (d.homeBuilding && d.homeBuilding !== id) {
      const from = B.get(d.homeBuilding);
      fromName = from ? from.name : '别处';
      if (!opts || !opts.force) {
        return { ok: false, msg: `${d.name}还在${fromName}，得先把他撤出来。` };
      }
      remove(st, d.homeBuilding, discipleId);
    }

    b.occupants.push(discipleId);
    d.homeBuilding = id;
    d.lastAction = `在${def.name}`;
    return {
      ok: true,
      msg: fromName
        ? `${d.name}从${fromName}调来了${def.name}。`
        : `${d.name}进了${def.name}。`,
      moved: !!fromName,
    };
  }

  function remove(st, id, discipleId) {
    const b = stateOf(st, id);
    const d = S.state.discipleById(discipleId);
    if (!b) return { ok: false, msg: '这处地方还没有。' };
    const i = b.occupants.indexOf(discipleId);
    if (i < 0) return { ok: false, msg: '他不在这里。' };
    b.occupants.splice(i, 1);
    if (d && d.homeBuilding === id) {
      d.homeBuilding = null;
      d.lastAction = '离开' + (B.get(id) || {}).name;
    }
    return { ok: true, msg: `${d ? d.name : '他'}离开了${(B.get(id) || {}).name}。` };
  }

  // =========================================================
  //  任命与晋升
  // =========================================================
  function promote(st, discipleId, rankId) {
    const d = S.state.discipleById(discipleId);
    if (!d) return { ok: false, msg: '查无此人。' };
    const cur = S.ranks.levelOf(d.rank);
    const target = S.ranks.levelOf(rankId);
    if (target <= cur) return { ok: false, msg: '这不算升。' };

    // 亲传 / 长老只能由宗主（玩家）或长老推荐产生
    if (rankId === 'elder' || rankId === 'personal') {
      if (cur < S.ranks.levelOf('inner')) {
        return { ok: false, msg: '还没进内门，直接提拔难以服众。' };
      }
    }
    if (rankId === 'inner') {
      return { ok: false, msg: '内门只能靠宗门大比夺魁，不能直接任命。' };
    }

    d.rank = rankId;
    // 身份变了，如果新身份进不了当前建筑，得搬出来
    if (d.homeBuilding && !S.ranks.canEnter(rankId, d.homeBuilding)) {
      remove(st, d.homeBuilding, d.id);
    }
    S.state.addLog(`${d.name} 被任命为${S.ranks.nameOf(rankId)}。`, 'sect');
    return { ok: true, msg: `${d.name} 成了${S.ranks.nameOf(rankId)}。` };
  }

  /** 每年检查杂役 → 外门的自动晋升 */
  function checkPromotions(st, out) {
    for (const d of st.disciples) {
      if (d.rank !== 'menial') continue;
      const r = S.ranks.canPromoteToOuter(d, st.week);
      if (!r.ok) continue;
      d.rank = 'outer';
      D.adjustMood(d, 15);
      D.adjustLoyalty(d, 6);
      D.addHistory(d, '升入外门');
      out.push({
        text: `${d.name} 从杂役升进了外门。管事把新的腰牌递给他，他捏在手里看了很久，` +
          `最后只说了句“我记着这个人情”。`,
        kind: 'sect',
        meta: '杂役 → 外门',
      });
    }
  }

  // =========================================================
  //  每年产出
  // =========================================================
  const DAN_POOL = [
    { id: 'juqisan', w: 40, minSkill: 0 },
    { id: 'huiyuandan', w: 26, minSkill: 28 },
    { id: 'peiyuandan', w: 16, minSkill: 42 },
    { id: 'ningshendan', w: 10, minSkill: 52 },
    { id: 'pijingdan', w: 8, minSkill: 62 },
  ];

  const QI_POOL = [
    { id: 'huxinfu', w: 40, minSkill: 0 },
    { id: 'xuanTie', w: 34, minSkill: 0 },
    { id: 'peiyuandan', w: 14, minSkill: 40 },
    { id: 'qianjidan', w: 8, minSkill: 60 },
  ];

  function pickBySkill(pool, skill) {
    const avail = pool.filter((p) => skill >= p.minSkill);
    if (!avail.length) return U.pick(pool);
    return U.weighted(avail, (p) => p.w);
  }

  function pickFlavor(def, d) {
    if (!def.flavor || !def.flavor.length) return null;
    return U.pick(def.flavor).replace('{d}', d ? d.name : '弟子');
  }

  function weekly(st) {
    const out = [];
    init(st);

    for (const def of B.BUILDINGS) {
      const b = stateOf(st, def.id);
      if (!b || b.level <= 0) continue;
      const occ = occupantsOf(st, def.id);
      if (!occ.length) continue;

      const lvl = b.level;
      const who = U.pick(occ);
      const flavor = pickFlavor(def, who);

      switch (def.id) {
        case 'lingtian': out.push(...runLingtian(st, b, occ, who, flavor, lvl)); break;
        case 'lingkuang': out.push(...runLingkuang(st, b, occ, who, flavor, lvl)); break;
        case 'danfang': out.push(...runDanfang(st, b, occ, who, flavor, lvl)); break;
        case 'qige': out.push(...runQige(st, b, occ, who, flavor, lvl)); break;
        case 'zhangfang': out.push(...runZhangfang(st, b, occ, who, flavor, lvl)); break;
        case 'zhaoxian': out.push(...runZhaoxian(st, b, occ, who, flavor, lvl)); break;
        case 'cangjing': out.push(...runCangjing(st, b, occ, who, flavor, lvl)); break;
        default: break;
      }
    }

    // 入驻弟子仍在修炼，只是慢；同时干活也算功绩
    for (const d of st.disciples) {
      if (!d.homeBuilding) continue;
      const bb = stateOf(st, d.homeBuilding);
      const lv = bb ? bb.level : 1;
      // 在建筑里做事，同样记贡献——否则他们攒不到东西换，人心会散
      D.addContribution(d, 8 + lv * 4);
      if (d.injureWeeks > 0) continue;
      const gain = 9 * (1 + d.realm * 0.35) * (d.tianfu / 65) * (d.wuxing / 70)
        * D.growthMul(d) * 0.45 * U.rand(0.8, 1.15);
      for (const ev of D.gainExp(d, gain)) {
        out.push({
          text: ev.text,
          kind: ev.kind,
          minor: ev.minor,
          discipleId: ev.minor ? d.id : null,
        });
      }
      if (!d.lastAction) d.lastAction = '在建筑里做事';
    }

    checkPromotions(st, out);

    // 建筑产出属于"日常经营"，年报里会折叠成一行；
    // 招贤馆招到人（recruit）是大事，不折
    for (const e of out) {
      if (e.kind === 'growth') e.fold = true;
    }

    return out;
  }

  function addOut(st, itemId, n) {
    if (n <= 0) return null;
    S.state.warehouseAdd(itemId, n);
    st.sect.totalLoot += n;
    return S.items.get(itemId);
  }

  // ---------------- 灵田 ----------------
  function runLingtian(st, b, occ, who, flavor, lvl) {
    const out = [];
    let n = Math.max(1, Math.floor((occ.length + lvl) / 2));
    if (U.chance(0.12)) n++;
    const got = [];
    for (let i = 0; i < n; i++) {
      const it = U.chance(0.08) ? addOut(st, 'tianlingguo', 1) : addOut(st, 'yunlingcao', 1);
      if (it) got.push(it.name);
    }

    // 田里的零碎也是能换钱的：多余的灵材、边角料、挑剩下的次品
    const stones = Math.round(40 + lvl * 25 + occ.length * 15);
    S.state.addStones(stones);

    if (!got.length && stones <= 0) return out;
    out.push({
      text: flavor || `${who.name}在灵田里忙了一年。`,
      kind: 'growth',
      meta: `灵田 · 灵石 +${stones}${got.length ? '、' + got.join('、') : ''}`,
    });
    return out;
  }

  // ---------------- 灵矿 ----------------
  function runLingkuang(st, b, occ, who, flavor, lvl) {
    const out = [];
    const eff = S.locations ? S.locations.effectsOf(st) : { mineMul: 1 };

    // 开矿是出力气，不看手艺——人多、矿深，出的就多
    const base = (180 + lvl * 90 + occ.length * 45) * (eff.mineMul || 1);
    const stones = Math.round(base);
    S.state.addStones(stones);

    // 顺带出矿材
    const oreN = Math.max(1, Math.floor((lvl + occ.length) / 2));
    const got = [];
    for (let i = 0; i < oreN; i++) {
      const it = addOut(st, 'xuanTie', 1);
      if (it) got.push(it.name);
    }

    out.push({
      text: flavor || `${who.name}在矿道里待了一年。`,
      kind: 'growth',
      meta: `灵矿 · 灵石 +${stones}${got.length ? '、玄铁精 +' + got.length : ''}`,
    });
    return out;
  }

  // ---------------- 丹房 ----------------
  function runDanfang(st, b, occ, who, flavor, lvl) {
    const out = [];
    const skill = Math.round(occ.reduce((s, d) => s + D.effSkill(d, 'alchemy'), 0) / occ.length);
    // 消耗灵材
    let fuel = 0;
    for (const id of ['yunlingcao', 'tianlingguo']) {
      const have = S.state.warehouseCount(id);
      const use = Math.min(have, 2 + lvl);
      if (use > 0) {
        S.state.warehouseTake(id, use);
        fuel += use * (id === 'tianlingguo' ? 3 : 1);
      }
    }
    let n = Math.max(0, Math.floor((skill + 20) / 55 * lvl / 1.6));
    if (fuel <= 0) n = Math.max(0, Math.floor(n * 0.3)); // 没料，只能炼点粗货
    if (fuel > 6) n += 1;
    if (n <= 0) {
      out.push({
        text: `${who.name}在丹房守了一年，炉子里只出了一层黑灰。`,
        kind: 'info',
        minor: true,
        discipleId: who.id,
      });
      return out;
    }
    const got = new Set();
    for (let i = 0; i < n; i++) {
      const p = pickBySkill(DAN_POOL, skill);
      const it = addOut(st, p.id, 1);
      if (it) got.add(it.name);
    }
    out.push({
      text: flavor || `${who.name}在丹房里待了一年。`,
      kind: 'growth',
      meta: `丹房产出 ${[...got].join('、')}${fuel <= 0 ? '（缺灵材，只出粗货）' : ''}`,
    });
    return out;
  }

  // ---------------- 器阁 ----------------
  function runQige(st, b, occ, who, flavor, lvl) {
    const out = [];
    const skill = Math.round(occ.reduce((s, d) => s + D.effSkill(d, 'forging'), 0) / occ.length);
    let fuel = 0;
    const have = S.state.warehouseCount('xuanTie');
    const use = Math.min(have, 1 + lvl);
    if (use > 0) {
      S.state.warehouseTake('xuanTie', use);
      fuel = use;
    }
    let n = Math.max(0, Math.floor((skill + 15) / 60 * lvl / 1.6));
    if (fuel <= 0) n = Math.max(0, Math.floor(n * 0.35));
    if (n <= 0) {
      out.push({
        text: `${who.name}在器阁里敲了一年，废了三块料，一件成品也没出来。`,
        kind: 'info',
        minor: true,
        discipleId: who.id,
      });
      return out;
    }
    const got = new Set();
    for (let i = 0; i < n; i++) {
      const p = pickBySkill(QI_POOL, skill);
      const it = addOut(st, p.id, 1);
      if (it) got.add(it.name);
    }
    out.push({
      text: flavor || `${who.name}在器阁里待了一年。`,
      kind: 'growth',
      meta: `器阁产出 ${[...got].join('、')}${fuel <= 0 ? '（缺玄铁，只出粗货）' : ''}`,
    });
    return out;
  }

  // ---------------- 账房 ----------------
  function runZhangfang(st, b, occ, who, flavor, lvl) {
    const out = [];
    const skill = Math.round(occ.reduce((s, d) => s + D.effSkill(d, 'trade'), 0) / occ.length);
    const sellRate = 0.5 + skill / 240;   // 0.5 ~ 0.92
    let earned = 0;
    const sold = [];

    // 卖掉仓库里积压的东西（每种最多卖到剩 3 件）
    for (const id of Object.keys(st.warehouse)) {
      const it = S.items.get(id);
      if (!it) continue;
      const have = st.warehouse[id];
      if (have <= 3) continue;
      const sell = Math.min(have - 3, 1 + Math.floor(lvl / 2));
      if (sell <= 0) continue;
      S.state.warehouseTake(id, sell);
      const price = Math.round(it.value * sellRate * sell);
      S.state.addStones(price);
      earned += price;
      sold.push(`${it.name}×${sell}`);
    }

    // 顺带在拍卖行捡漏
    let bought = 0;
    for (let i = 0; i < st.auction.length; i++) {
      const slot = st.auction[i];
      if (slot.sold) continue;
      const it = S.items.get(slot.itemId);
      if (!it) continue;
      // 只会买"明显便宜"的，且留够本钱
      if (slot.price < it.value * 0.82 && st.sect.spiritStones > slot.price * 3) {
        const r = S.systems.auction.buy(st, i);
        if (r.ok) {
          bought++;
          if (bought >= 2) break;
        }
      }
    }

    if (earned > 0 || bought > 0) {
      const bits = [];
      if (sold.length) bits.push(`卖出 ${sold.join('、')}，进账 ${earned} 灵石`);
      if (bought > 0) bits.push(`趁着行情低，收了两件`);
      out.push({
        text: flavor || `${who.name}在账房里核了一年的账。`,
        kind: 'sect',
        meta: bits.join('；'),
      });
    } else {
      out.push({
        text: `${who.name}在账房里坐了一年，没什么生意。`,
        kind: 'info',
        minor: true,
        discipleId: who.id,
      });
    }
    return out;
  }

  // ---------------- 招贤馆 ----------------
  function runZhaoxian(st, b, occ, who, flavor, lvl) {
    const out = [];
    const skill = Math.round(occ.reduce((s, d) => s + D.effSkill(d, 'leadership'), 0) / occ.length);
    const cap = S.state.capacity();

    if (st.disciples.length + st.candidates.length >= cap + 3) {
      return [{
        text: `${who.name}这年没再招人——宗门快住不下了。`,
        kind: 'info',
        minor: true,
        discipleId: who.id,
      }];
    }

    const p = U.clamp(0.25 + skill / 260 + lvl * 0.08, 0.15, 0.85);
    if (!U.chance(p)) {
      out.push({
        text: `${who.name}在招贤馆坐了一年，来的人都不太合适。`,
        kind: 'info',
        minor: true,
        discipleId: who.id,
      });
      return out;
    }

    const taken = new Set(st.disciples.map((x) => x.name).concat(st.candidates.map((x) => x.name)));
    const c = D.makeCandidate(taken);
    // 长老的眼光，挑出来的人底子更好
    const boost = Math.round(skill / 8);
    c.tianfu = U.clamp(c.tianfu + boost, 10, 99);
    c.wuxing = U.clamp(c.wuxing + Math.round(boost * 0.7), 10, 99);
    c.candidateWeek = st.week;

    // 有空位就直接入门——省得宗主一个个点
    if (st.disciples.length < cap) {
      delete c.isCandidate;
      delete c.pitch;
      c.joinWeek = st.week;
      c.weeksInSect = 0;
      c.status = 'idle';
      c.missionId = null;
      c.assignedMissionId = null;
      c.rank = 'menial';
      c.bonds = c.bonds || {};
      st.disciples.push(c);
      st.sect.totalRecruited++;
      out.push({
        text: `${who.name}从山下领回来一个人，${c.name}，${c.age}岁。` +
          `问了几句话，看了看根骨，当场就把入门的文书签了。`,
        kind: 'recruit',
        meta: `自动收徒 · ${c.name}（资质 ${c.tianfu}）`,
      });
    } else {
      // 满了，先候着
      c.pitch = `由${who.name}从山下招来。`;
      st.candidates.push(c);
      out.push({
        text: `${who.name}相中了一个叫${c.name}的年轻人，可宗门已经住不下了。` +
          `人先留在山下的客栈里，等有空位再说。`,
        kind: 'recruit',
        meta: `招到 ${c.name}（资质 ${c.tianfu}）· 宗门已满`,
      });
    }
    return out;
  }

  // ---------------- 藏经阁 ----------------
  function runCangjing(st, b, occ, who, flavor, lvl) {
    const out = [];
    const occCount = occ.length;
    if (!occCount) return out;

    // 每名弟子每年额外获得一点修为，人数越多这份越薄
    const per = occCount >= st.disciples.length ? 0 : Math.round(12 + 5 * lvl + occCount * 2);
    if (per <= 0) return out;

    let gained = 0;
    let count = 0;
    for (const d of st.disciples) {
      if (d.homeBuilding) continue;          // 建筑里的已在上面结算
      if (d.injureWeeks > 0) continue;
      const amt = per * (1 + d.wuxing / 200);
      const before = d.realm;
      for (const ev of D.gainExp(d, amt)) {
        out.push({
          text: ev.text,
          kind: ev.kind,
          minor: ev.minor,
          discipleId: ev.minor ? d.id : null,
        });
      }
      if (d.realm > before) count++;
      gained++;
    }
    if (gained > 0) {
      out.push({
        text: flavor || `${who.name}守着藏经阁，弟子们轮流来听讲。`,
        kind: 'growth',
        meta: `藏经阁加持 · ${gained} 名弟子受益${count ? `，${count} 人突破` : ''}`,
      });
    }
    return out;
  }

  // =========================================================
  //  一键派遣
  // =========================================================
  // 先填"专业"的地方，再填不需要技艺的；顺序即优先级
  const AUTO_ORDER = ['zhaoxian', 'zhangfang', 'danfang', 'qige', 'cangjing', 'lingkuang', 'lingtian'];

  /**
   * 把空闲弟子自动派进各处。
   * 只动"完全空闲"的人——已经在别处干活、在做任务、在养伤的一概不碰。
   */
  function autoFill(st) {
    init(st);

    let pool = st.disciples.filter(
      (d) => !d.homeBuilding && !d.missionId && d.injureWeeks === 0
    );
    if (!pool.length) {
      return { ok: false, msg: '没有空闲的弟子可派。', moved: [] };
    }

    const moved = [];

    for (const bid of AUTO_ORDER) {
      const def = B.get(bid);
      const b = stateOf(st, bid);
      if (!def || !b || b.level <= 0) continue;

      let free = slotCount(st, bid) - b.occupants.length;
      if (free <= 0) continue;

      const cands = pool.filter((d) => S.ranks.canEnter(d.rank || 'menial', bid));
      if (!cands.length) continue;

      if (def.keySkill) {
        // 技艺高的先上
        cands.sort((x, y) => D.effSkill(y, def.keySkill) - D.effSkill(x, def.keySkill));
      } else {
        // 不需要技艺的粗活，身份低的先去
        cands.sort(
          (x, y) => (S.ranks.levelOf(x.rank || 'menial') - S.ranks.levelOf(y.rank || 'menial')) ||
            (y.realm - x.realm)
        );
      }

      for (const d of cands) {
        if (free <= 0) break;
        const r = assign(st, bid, d.id);
        if (!r.ok) continue;
        moved.push({ name: d.name, building: def.name });
        pool = pool.filter((x) => x.id !== d.id);
        free--;
      }
    }

    if (!moved.length) {
      return {
        ok: false,
        msg: '各处要么不缺人，要么没有身份够得上的空闲弟子。',
        moved: [],
      };
    }

    return {
      ok: true,
      moved,
      msg: `已派遣 ${moved.length} 人入驻`,
    };
  }

  S.systems = S.systems || {};
  S.systems.building = {
    init, stateOf, isBuilt, slotCount, occupantsOf,
    build, upgrade, assign, remove, promote,
    weekly, checkPromotions, autoFill,
  };
})(window.Sect);
