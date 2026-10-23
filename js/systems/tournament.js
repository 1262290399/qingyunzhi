/* ===========================================================
 * tournament.js — 宗门大比
 *
 * 分两个场子：
 *   外门场：杂役 + 外门。前两名晋内门（内门有比例上限，满了只记功）。
 *   内门场：内门。夺魁记大功；首轮出局且战力垫底的那个人，降回外门。
 *
 * 内门不是只进不出的保险箱——打得差就下去，位置留给后面的人。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;

  const MAX_PLAYERS = 16;
  const INTERVAL = 10;
  const INNER_RATIO = 0.4;   // 内门最多占宗门人数的四成

  const shouldRun = (week) => week > 0 && week % INTERVAL === 0;
  const nextWeek = (week) => (Math.floor(week / INTERVAL) + 1) * INTERVAL;

  function eligible(st) {
    return st.disciples.filter((d) => S.ranks.levelOf(d.rank || 'menial') <= 2);
  }

  /** 内门名额上限：随宗门规模浮动 */
  function innerCap(st) {
    return Math.max(2, Math.floor(S.state.capacity() * INNER_RATIO));
  }

  function innerCount(st) {
    return st.disciples.filter((d) => d.rank === 'inner').length;
  }

  function pickPlayers(list) {
    if (list.length <= MAX_PLAYERS) return list.slice();
    return list.slice().sort((a, b) => D.power(b) - D.power(a)).slice(0, MAX_PLAYERS);
  }

  // ---------------- 单场 ----------------
  function duel(a, b, st) {
    const pa = Math.max(1, D.power(a));
    const pb = Math.max(1, D.power(b));

    const ra = S.relations.score(a, b.id);
    const rb = S.relations.score(b, a.id);
    let ba = 0;
    let bb = 0;
    if (ra < -30) ba += 0.1;
    if (rb < -30) bb += 0.1;
    if (ra > 55) ba -= 0.05;
    if (rb > 55) bb -= 0.05;
    if (S.relations.isLover(a, b)) { ba -= 0.08; bb -= 0.08; }

    const rollA = pa * (1 + ba) * U.rand(0.72, 1.32);
    const rollB = pb * (1 + bb) * U.rand(0.72, 1.32);
    const winner = rollA >= rollB ? a : b;
    const loser = winner === a ? b : a;

    return {
      winner,
      loser,
      upset: D.power(winner) < D.power(loser) * 0.82,
      ratio: Math.max(rollA, rollB) / Math.max(1, Math.min(rollA, rollB)),
    };
  }

  // ---------------- 战报：同届不重样 ----------------
  const LINES = {
    crush: [
      (w, l) => `${w}只出了三招，${l}就坐倒在地。`,
      (w, l) => `${w}根本没动兵器。${l}冲上去，又退回来，最后自己认了输。`,
      (w, l) => `这一场没什么可说的——${l}连${w}的衣角都没碰到。`,
      (w, l) => `${l}的剑还没出鞘，${w}的手已经按在他肩上。`,
      (w, l) => `台下有人捂住了眼。${l}倒下去的时候，${w}已经转身了。`,
      (w, l) => `一共七息。执事数到七，${l}就起不来了。`,
    ],
    steady: [
      (w, l) => `${w}赢得很稳。${l}撑到第二十招，还是被逼下了台。`,
      (w, l) => `${l}拼得很凶，可${w}一步没退。`,
      (w, l) => `${w}收手的时候，${l}还站着，只是手里的剑在抖。`,
      (w, l) => `${l}换了三种打法，${w}只用了同一种。`,
      (w, l) => `打到一半，台下就没人喊了。大家都知道结果。`,
      (w, l) => `${w}退了三步，${l}进不了第四步。`,
    ],
    upset: [
      (w, l) => `没人想到${w}会赢。连他自己都愣了一下，才想起要抱拳。`,
      (w, l) => `台下的人本来都在看${l}，看到最后，看的是${w}。`,
      (w, l) => `${w}在最后一刻翻了盘。${l}站在台上，半天没下来。`,
      (w, l) => `${l}的手抖了一下。就这一下，${w}看见了。`,
      (w, l) => `押注的人赔了。买${w}赢的只有三个，其中一个是${w}自己。`,
      (w, l) => `${w}被逼到台边，然后他没有再退——${l}没想到。`,
    ],
    close: [
      (w, l) => `${w}和${l}斗了小半个时辰，最后${w}险胜半招。`,
      (w, l) => `两人打得难分难解，裁判数到十，${l}没能起来。`,
      (w, l) => `${w}赢了，但赢得不轻松。散场的时候，${l}的师弟把他扶了下去。`,
      (w, l) => `最后一招是同时出的。执事看了很久，才判${w}赢。`,
      (w, l) => `${l}输了半式，坐在地上笑了。${w}伸手去拉，他没接。`,
      (w, l) => `打了这么多次，这一次最接近。${w}自己也知道。`,
    ],
  };

  function makePicker() {
    const used = { crush: new Set(), steady: new Set(), upset: new Set(), close: new Set() };
    return function pick(res) {
      const w = res.winner.name;
      const l = res.loser.name;
      let kind;
      if (res.ratio > 2.3) kind = 'crush';
      else if (res.ratio > 1.5) kind = 'steady';
      else if (res.upset) kind = 'upset';
      else kind = 'close';

      const pool = LINES[kind];
      const avail = [];
      for (let i = 0; i < pool.length; i++) if (!used[kind].has(i)) avail.push(i);
      const idx = avail.length ? avail[U.randInt(0, avail.length - 1)] : U.randInt(0, pool.length - 1);
      used[kind].add(idx);
      return pool[idx](w, l);
    };
  }

  // ---------------- 单场淘汰赛 ----------------
  function bracket(st, players, label, out, pickLine) {
    if (!players.length) return null;

    const list = U.shuffle(pickPlayers(players));

    if (list.length === 1) {
      out.push({
        text: `【${label}】只有${list[0].name}一个人报了名，没对手，直接算他赢。`,
        kind: 'tournament',
      });
      return { champion: list[0], runnerUp: null, semi: [], firstOut: [], label, matches: [] };
    }

    let round = list.slice();
    let runnerUp = null;
    let semi = [];
    let firstOut = [];
    let roundNo = 0;
    const matches = [];

    while (round.length > 1 && roundNo < 6) {
      roundNo++;
      const isFinal = round.length === 2;
      const isSemi = round.length <= 4;
      const isFirst = roundNo === 1;
      const next = [];
      const roundMatches = [];

      for (let i = 0; i < round.length; i += 2) {
        if (i + 1 >= round.length) { next.push(round[i]); continue; }
        const res = duel(round[i], round[i + 1], st);
        roundMatches.push(res);
        matches.push(res);
        next.push(res.winner);

        if (U.chance(0.12)) {
          const tmp = [];
          D.injure(res.loser, 1, tmp, '大比受伤');
          for (const ev of tmp) out.push({ text: ev.text, kind: ev.kind });
        }
      }

      if (isFirst) firstOut = roundMatches.map((r) => r.loser);

      const roundName = isFinal ? '决赛' : isSemi ? '半决赛' : `第${roundNo}轮`;

      if (roundMatches.length) {
        let cover;
        if (isFinal) cover = roundMatches;
        else if (isSemi) {
          // 半决赛只写最接近的那一场，省点篇幅
          cover = [roundMatches.slice().sort((a, b) => a.ratio - b.ratio)[0]];
        } else {
          cover = [roundMatches.find((r) => r.upset) || roundMatches[0]];
        }

        for (const res of cover) {
          out.push({
            text: `【${label} · ${roundName}】${pickLine(res)}`,
            kind: 'tournament',
          });
          if (isFinal || isSemi) {
            res.winner.mood = U.clamp(res.winner.mood + 5, 0, 100);
            res.loser.mood = U.clamp(res.loser.mood - 4, 0, 100);
          }
        }
      }

      if (isFinal) runnerUp = roundMatches[0].loser;
      else if (isSemi) semi = roundMatches.map((r) => r.loser);

      round = next;
    }

    return { champion: round[0], runnerUp, semi, firstOut, label, matches };
  }

  // ---------------- 外门场前二：晋内门 ----------------
  function promoteFromOuter(st, d, out, tag) {
    const before = d.rank;
    const lv = S.ranks.levelOf(before);

    if (lv >= 2) {
      const c = D.addContribution(d, 180);
      out.push({
        text: `【${tag}】${d.name}守住了名次，内门的位置没丢。`,
        kind: 'tournament',
        meta: `贡献 +${c}`,
      });
      return;
    }

    if (lv === 0) {
      d.rank = 'outer';
      D.adjustMood(d, 22);
      D.addHistory(d, '大比表现优异，升入外门');
      out.push({
        text: `【${tag}】杂役里出了个${d.name}，一路打到最后。` +
          `管事当场给了他外门的腰牌。`,
        kind: 'sect',
        meta: `杂役 → 外门 · ${tag}`,
      });
      return;
    }

    // 内门名额满了：记功，但进不去
    if (innerCount(st) >= innerCap(st)) {
      const c = D.addContribution(d, 200);
      out.push({
        text: `【${tag}】${d.name}打到了外门场${tag}，本该进内门——` +
          `可内门的位置满了。执事把名字记在册子上，说"下届再说"。`,
        kind: 'sect',
        meta: `内门已满（${innerCount(st)}/${innerCap(st)}）· 贡献 +${c}`,
      });
      return;
    }

    d.rank = 'inner';
    D.adjustMood(d, 25);
    D.adjustLoyalty(d, 6);
    D.addHistory(d, `大比${tag}，晋入内门`);
    S.state.addRep(4);

    if (d.homeBuilding && !S.ranks.canEnter('inner', d.homeBuilding)) {
      S.systems.building.remove(st, d.homeBuilding, d.id);
    }

    out.push({
      text: `【${tag}】${tag === '夺魁'
        ? `${d.name}拿下了外门场头名。`
        : `${d.name}在外门场打到最后一战，拿了次席。`}` +
        `执事把名册递到宗主案前，上面新添了一行字——${d.name}，内门。`,
      kind: 'sect',
      meta: `${S.ranks.nameOf(before)} → 内门弟子`,
    });
  }

  // ---------------- 内门场末位：降回外门 ----------------
  function demoteWorst(st, res, out) {
    if (!res || !res.firstOut || !res.firstOut.length) return;

    // 首轮就出局，而且战力最低的那个——最没资格占着内门位置
    const worst = res.firstOut.slice().sort((a, b) => D.power(a) - D.power(b))[0];
    if (!worst) return;

    // 内门本来就不多的话，不折腾
    if (innerCount(st) <= Math.max(2, Math.floor(innerCap(st) * 0.6))) return;
    if (!U.chance(0.55)) return;

    worst.rank = 'outer';
    D.adjustMood(worst, -18);
    D.adjustLoyalty(worst, -4);
    D.addHistory(worst, '大比垫底，降回外门');

    out.push({
      text: `【内门场 · 末位】${worst.name}首轮就出了局。执事按规矩把腰牌换了——` +
        `内门不留闲人，位置要留给下面的人。`,
      kind: 'sect',
      meta: `内门 → 外门 · ${worst.name}`,
    });
  }

  // ---------------- 主流程 ----------------
  function run(st) {
    const out = [];
    const wk = st.week - 1;
    const all = eligible(st);

    if (all.length < 2) {
      out.push({
        text: `第 ${wk}年，宗门大比。可这次报名的只有一个人——` +
          `连一场都打不起来，只得作罢。`,
        kind: 'tournament',
      });
      return out;
    }

    const low = all.filter((d) => S.ranks.levelOf(d.rank || 'menial') <= 1);
    const high = all.filter((d) => S.ranks.levelOf(d.rank || 'menial') === 2);
    const pickLine = makePicker();

    out.push({
      text: `第 ${wk}年，宗门大比。演武台分成两块——` +
        `外门场 ${low.length} 人，内门场 ${high.length} 人。` +
        `执事宣布：外门场前两名晋内门（现取 ${innerCount(st)}/${innerCap(st)}），` +
        `内门场夺魁记大功。`,
      kind: 'tournament',
      meta: `外门 ${low.length} · 内门 ${high.length}`,
    });

    // ---- 外门场 ----
    const lowRes = bracket(st, low, '外门场', out, pickLine);
    if (lowRes) {
      promoteFromOuter(st, lowRes.champion, out, '夺魁');
      if (lowRes.runnerUp) promoteFromOuter(st, lowRes.runnerUp, out, '次席');
    }

    // ---- 内门场 ----
    const highRes = bracket(st, high, '内门场', out, pickLine);
    if (highRes) {
      const c1 = D.addContribution(highRes.champion, 300);
      highRes.champion.mood = U.clamp(highRes.champion.mood + 20, 0, 100);
      D.adjustLoyalty(highRes.champion, 6);
      D.addHistory(highRes.champion, '内门场夺魁');
      S.state.addRep(5);
      out.push({
        text: `【内门场 · 夺魁】${highRes.champion.name}压了内门一头。` +
          `这一场没什么可争的，剩下的只是分寸。`,
        kind: 'tournament',
        meta: `贡献 +${c1} · 名望 +5`,
      });

      if (highRes.runnerUp) {
        const c2 = D.addContribution(highRes.runnerUp, 150);
        out.push({
          text: `【内门场 · 次席】${highRes.runnerUp.name}差了一口气。` +
            `不过内门的名次，本来就只差这一点。`,
          kind: 'tournament',
          meta: `贡献 +${c2}`,
        });
      }

      demoteWorst(st, highRes, out);
    }

    st.stats.tournaments = (st.stats.tournaments || 0) + 1;
    st.lastTournament = {
      week: wk,
      champion: lowRes && lowRes.champion ? lowRes.champion.id : null,
      innerChampion: highRes && highRes.champion ? highRes.champion.id : null,
      count: all.length,
    };

    return out;
  }

  S.systems = S.systems || {};
  S.systems.tournament = {
    run, shouldRun, nextWeek, eligible, INTERVAL, MAX_PLAYERS,
    innerCap, innerCount, INNER_RATIO,
  };
})(window.Sect);
