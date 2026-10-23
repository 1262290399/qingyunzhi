/* ===========================================================
 * saga.js — 剧情线的推进引擎
 *
 * 每年最多推进一幕，同时最多两条线并行。
 * 这样年报读起来像连载，而不是一堆互不相干的短讯。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const MAX_ACTIVE = 2;

  function init(st) {
    if (!Array.isArray(st.sagas)) st.sagas = [];
    if (!st.sagaCooldown) st.sagaCooldown = {};
  }

  function drop(st, inst) {
    const i = st.sagas.indexOf(inst);
    if (i >= 0) st.sagas.splice(i, 1);
  }

  function buildCtx(st, inst, def, week) {
    const a = S.state.discipleById(inst.actorIds[0]);
    const b = inst.actorIds[1] ? S.state.discipleById(inst.actorIds[1]) : null;
    const npc = inst.data && inst.data.npcId ? S.npcs.get(inst.data.npcId) : null;
    return { st, week, a, b, npc, def };
  }

  /** 推进一幕 */
  function advance(st, inst, week, out) {
    const def = S.sagas.get(inst.id);
    if (!def) { drop(st, inst); return; }

    const stage = def.stages[inst.stage];
    if (!stage) { drop(st, inst); return; }

    const ctx = buildCtx(st, inst, def, week);

    // 当事的人已经不在宗门了：故事断掉
    // （没有第二个演员是单人故事；有却找不到人，说明那位没了）
    if (!ctx.a || (inst.actorIds[1] && !ctx.b)) {
      out.push({
        text: `【${def.name}】这桩事没有再往下走。当事的人已经不在了。`,
        kind: 'saga',
        meta: '线索中断',
      });
      drop(st, inst);
      st.sagaCooldown[def.id] = week + 20;
      return;
    }

    const stageNo = inst.stage + 1;
    const total = def.stages.length;

    out.push({
      text: `【${def.name} · ${stage.title}】${stage.text(ctx)}`,
      kind: 'saga',
      meta: `第 ${stageNo}/${total} 幕`,
    });

    let extra = null;
    if (stage.effect) {
      try {
        extra = stage.effect(ctx);
      } catch (e) {
        console.error('剧情线效果出错：', def.id, e);
      }
    }
    if (Array.isArray(extra)) {
      for (const t of extra) {
        if (t) out.push({ text: t, kind: 'saga' });
      }
    }

    inst.stage++;

    if (inst.stage >= total) {
      // 走到最后一幕：东西该有主了
      grantReward(st, def, ctx, out);
      drop(st, inst);
      st.sagaCooldown[def.id] = week + (def.cooldown || 45);
    } else {
      inst.nextAt = week + (def.stages[inst.stage].wait || 3);
    }
  }

  // =========================================================
  //  剧情线的收尾奖励
  // =========================================================
  /**
   * 每条线走完，给当事人留点东西：
   * 要么是个词条，要么是件认主的物件。
   * 认主的意思是——只跟这一个人，别人拿不走，人死了也没了。
   */
  const REWARD = {
    feud: { term: 'shihuai' },
    realm: { relic: 'gubei_ta' },
    sword: { relic: 'duanjian' },
    demon: { relic: 'gudi' },
    heart: { term: 'jiejie' },
  };

  function grantReward(st, def, ctx, out) {
    const r = REWARD[def.id];
    if (!r) return;
    const who = ctx.a;
    if (!who) return;

    if (r.term) {
      const term = S.terms.get(r.term);
      if (!term || who.terms.includes(r.term)) return;
      who.terms.push(r.term);
      if (!Array.isArray(who.termSources)) who.termSources = [];
      who.termSources.push({ term: r.term, from: def.name });
      S.disciple.addHistory(who, `走完「${def.name}」，得「${term.name}」`);
      out.push({
        text: `这件事过去之后，${who.name}看起来还是从前那个人。` +
          `可有些东西已经不一样了——「${term.name}」这两个字，` +
          `是旁人后来才慢慢看出来的。`,
        kind: 'fortune',
        meta: `${def.name} · 习得「${term.name}」`,
      });
      logIt(st, def, who, term.name, r.term);
      return;
    }

    const relic = S.sagas.relic(r.relic);
    if (!relic) return;
    if (!Array.isArray(who.relics)) who.relics = [];
    if (who.relics.some((x) => x.id === relic.id)) return;

    // 认主是独占的：天底下只有这一件，别人手里有了，就没你的份
    const taken = st.disciples.some(
      (x) => x.id !== who.id && Array.isArray(x.relics) && x.relics.some((y) => y.id === relic.id)
    );
    if (taken) return;

    who.relics.push({ id: relic.id, since: st.week - 1 });
    // 效果靠隐藏词条计入数值（词条栏里不显示）
    if (relic.termId) who.terms.push(relic.termId);
    S.disciple.addHistory(who, `得「${relic.name}」认主`);
    S.disciple.adjustMood(who, 15);
    out.push({
      text: `${relic.desc} 它认了${who.name}——东西往他手里一放，` +
        `就不再是别人的了。`,
      kind: 'fortune',
      meta: `${def.name} · 「${relic.name}」认主`,
    });
    logIt(st, def, who, relic.name, r.relic);
  }

  function logIt(st, def, who, itemName, itemId) {
    if (!Array.isArray(st.legacyLog)) st.legacyLog = [];
    st.legacyLog.unshift({
      year: st.week - 1,
      npcId: def.id,
      npcName: def.name,
      discipleId: who.id,
      discipleName: who.name,
      term: itemId,
      termName: itemName,
      saga: true,
    });
  }

  /** 每年调用：先推进已有的，再考虑开新的 */
  function tick(st, week) {
    init(st);
    const out = [];

    // ---- 推进（每年最多一条） ----
    let advanced = false;
    for (const inst of st.sagas.slice()) {
      if (advanced) break;
      if (week < inst.nextAt) continue;
      advance(st, inst, week, out);
      advanced = true;
    }

    // ---- 开启新线 ----
    if (!advanced && st.sagas.length < MAX_ACTIVE && U.chance(0.3)) {
      for (const def of S.sagas.SAGAS) {
        if (st.sagas.some((s) => s.id === def.id)) continue;
        if ((st.sagaCooldown[def.id] || 0) > week) continue;

        let castRes = null;
        try {
          castRes = def.canStart(st, week);
        } catch (e) {
          castRes = null;
        }
        if (!castRes || !castRes.ids || !castRes.ids.length) continue;

        const inst = {
          id: def.id,
          stage: 0,
          nextAt: week,
          actorIds: castRes.ids,
          data: castRes.data || {},
          started: week,
        };
        st.sagas.push(inst);
        advance(st, inst, week, out);
        break;
      }
    }

    return out;
  }

  /** 供 UI：当前在跑的剧情线 */
  function active(st) {
    init(st);
    const list = [];
    for (const inst of st.sagas) {
      const def = S.sagas.get(inst.id);
      if (!def) continue;
      const actors = inst.actorIds
        .map((id) => S.state.discipleById(id))
        .filter(Boolean);
      list.push({
        def,
        inst,
        stage: inst.stage + 1,
        total: def.stages.length,
        actors,
        nextAt: inst.nextAt,
      });
    }
    return list;
  }

  S.systems = S.systems || {};
  S.systems.saga = { init, tick, active, MAX_ACTIVE };
})(window.Sect);
