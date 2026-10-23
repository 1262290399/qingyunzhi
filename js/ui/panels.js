/* ===========================================================
 * panels.js — 各功能面板的 HTML 生成
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const R = S.realm;
  const D = S.disciple;
  const UI = S.ui;
  const esc = UI.esc;

  // =========================================================
  //  山门总览
  // =========================================================
  function overview(st) {
    const cap = S.state.capacity();
    const totalPower = st.disciples.reduce((s, d) => s + D.power(d), 0);
    const injured = st.disciples.filter((d) => d.injureWeeks > 0).length;
    const avgRealm = st.disciples.length
      ? st.disciples.reduce((s, d) => s + d.realm, 0) / st.disciples.length : 0;

    // 提醒事项
    const todos = [];
    if (st.candidates.length && st.disciples.length < cap) {
      todos.push(`山门外有 <b>${st.candidates.length}</b> 人求见，可去「收徒」看看。`);
    }
    if (st.sect.spiritStones > 1200) {
      todos.push(`账上躺着 <b>${U.fmt(st.sect.spiritStones)}</b> 灵石，放着不会生息，不如去拍卖行换物资。`);
    }
    const emptyWh = Object.keys(st.warehouse).filter((k) => st.warehouse[k] > 0).length === 0;
    if (emptyWh) todos.push('仓库已经空了，弟子攒着贡献点无处可换，忠心会慢慢散掉。');
    const broke = st.disciples.filter((d) => d.contribution > 120);
    if (broke.length) todos.push(`<b>${broke.map((d) => esc(d.name)).join('、')}</b> 贡献点积压，仓库该补货了。`);
    if (injured) todos.push(`<b>${injured}</b> 名弟子带伤，可去拍卖行买疗伤丹。`);

    const regionCards = S.regions.REGIONS.map((r) => {
      const dots = Array.from({ length: 4 }, (_, i) =>
        `<i class="${i < r.tier ? 'on' : ''}"></i>`).join('');
      const drops = r.loot.slice(0, 3).map((l) => {
        const it = S.items.get(l.itemId);
        return it ? esc(it.name) : '';
      }).filter(Boolean).join('、');
      return `<div class="region">
        <div class="region-name">${esc(r.name)}
          <span class="chip">${r.tier} 阶</span>
        </div>
        <div class="region-desc">${esc(r.desc)}</div>
        <div class="region-meta">
          <span>危险 <span class="danger-dots">${dots}</span></span>
          <span>建议战力 ${r.powerNeed}</span>
        </div>
        <div class="region-meta tiny"><span>常见：${drops}</span></div>
      </div>`;
    }).join('');

    // 正在跑的剧情线
    const sagas = S.systems.saga ? S.systems.saga.active(st) : [];
    const sagaHtml = sagas.length
      ? `<div class="panel">
          <div class="panel-head">
            <div class="panel-title">正在上演</div>
            <div class="section-sub">这些事还没完，隔几年会接着来</div>
          </div>
          <div class="grid" style="gap:8px">
            ${sagas.map((s) => `<div class="saga-row">
              <span class="saga-icon">${esc(s.def.icon || '章')}</span>
              <div class="grow">
                <div class="small" style="color:var(--gold)">${esc(s.def.name)}</div>
                <div class="tiny mute">
                  ${s.actors.map((a) => esc(a.name)).join('、') || '相关的人已经不在了'}
                </div>
              </div>
              <span class="chip">${s.stage}/${s.total}</span>
            </div>`).join('')}
          </div>
        </div>`
      : '';

    return `
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门动态</div>
        <div class="section-sub" id="feedHint">
          ${S.time && S.time.state.speed === 0 ? '已暂停' : '实时'}
        </div>
      </div>
      <div class="feed" id="feedList">${UI.feedHtml()}</div>
    </div>

    ${sagaHtml}

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门概览</div>
        <div class="section-sub">第 ${st.week}年 · 开山于第 ${st.sect.foundedWeek}年</div>
      </div>

      <div class="kv">
        <div class="kv-item">
          <div class="kv-label">门下弟子</div>
          <div class="kv-value">${st.disciples.length} <span class="tiny mute">/ ${cap}</span></div>
        </div>
        <div class="kv-item">
          <div class="kv-label">总战力</div>
          <div class="kv-value g">${totalPower}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">平均境界</div>
          <div class="kv-value j">${U.round(avgRealm, 1)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">灵石</div>
          <div class="kv-value g">${U.fmt(st.sect.spiritStones)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">名望</div>
          <div class="kv-value">${st.sect.reputation}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">仓储种类</div>
          <div class="kv-value">${Object.keys(st.warehouse).filter((k) => st.warehouse[k] > 0).length}</div>
        </div>
      </div>

      ${todos.length ? `<div class="mt" style="background:#1a2029;border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div class="tiny mute" style="margin-bottom:4px">宗务提醒</div>
        ${todos.map((t) => `<div class="small" style="color:var(--text-dim);padding:2px 0">· ${t}</div>`).join('')}
      </div>` : ''}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门地界</div>
        <div class="section-sub">弟子会自主前往这些地方历练</div>
      </div>
      <div class="grid grid-3">${regionCards}</div>
    </div>`;
  }

  // =========================================================
  //  弟子
  // =========================================================
  function disciples(st) {
    if (!st.disciples.length) {
      return `<div class="panel"><div class="empty">
        <span class="big">门</span>宗门里冷冷清清，还没有弟子。<br>
        去「收徒」看看有没有人愿意拜入门下。
      </div></div>`;
    }

    const sorted = st.disciples.slice().sort((a, b) => b.realm - a.realm || D.power(b) - D.power(a));
    const cards = sorted.map(UI.discipleCard).join('');

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">门下弟子</div>
        <div class="section-sub">点击任意弟子查看详情 · 按境界排序</div>
      </div>
      <div class="grid grid-2">${cards}</div>
    </div>`;
  }

  // =========================================================
  //  任务
  // =========================================================
  function missions(st) {
    const open = st.missions.filter((m) => m.status === 'open');
    const taken = st.missions.filter((m) => m.status === 'taken');

    const render = (list) => list.map((m) => UI.missionCard(m, st)).join('');

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门任务板</div>
        <div class="section-sub">每年刷新 · 弟子会自行接取 · 也可手动指派</div>
      </div>
      ${open.length
        ? `<div class="grid" style="gap:10px">${render(open)}</div>`
        : '<div class="empty">这年的活都被接完了，来年再来。</div>'}
      ${taken.length ? `<div class="mt">
        <div class="section-sub" style="margin-bottom:8px">进行中</div>
        <div class="grid" style="gap:10px">${render(taken)}</div>
      </div>` : ''}
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">说明</div></div>
      <div class="small dim" style="line-height:1.9">
        · 任务难度以<b>建议战力</b>表示。弟子战力低于此值时，失败与受伤的概率明显上升。<br>
        · 弟子自主接任务时会挑"跳一跳够得着"的活；战力远超需求的任务他们反而不爱接。<br>
        · 点「指派…」可以强行安排某位弟子去做某件事，但被指派的弟子来年一定出发，风险自担。<br>
        · 任务给的<b>贡献点</b>归弟子个人，弟子会拿它去仓库换自己需要的东西。
      </div>
    </div>`;
  }

  // =========================================================
  //  仓库
  // =========================================================
  function warehouse(st) {
    const ids = Object.keys(st.warehouse).filter((k) => st.warehouse[k] > 0);
    if (!ids.length) {
      return `<div class="panel"><div class="empty">
        <span class="big">库</span>仓库空空如也。<br>
        去「拍卖行」买些物资，或者等弟子历练带东西回来。<br>
        <span class="tiny">没有可兑换的东西，弟子攒的贡献点会变成怨气。</span>
      </div></div>`;
    }

    // 按层级排序
    ids.sort((a, b) => (S.items.get(a) || {}).tier - (S.items.get(b) || {}).tier);

    const cards = ids.map((id) => {
      const item = S.items.get(id);
      if (!item) return '';
      // 谁最想换
      const eager = st.disciples
        .map((d) => ({ d, opt: S.systems.warehouse.decide(d, st) }))
        .filter((x) => x.opt && x.opt.itemId === id);
      const eagerTxt = eager.length
        ? `<span class="chip jade">${eager.map((x) => esc(x.d.name)).join('、')} 想要</span>`
        : '';

      return UI.itemCard(item, {
        qty: st.warehouse[id],
        meta: `<span class="cost">兑换需 ${item.contrib} 贡献</span>
               <span class="mute">·</span>
               <span>参考价 ${U.fmt(item.value)} 灵石</span>
               ${eagerTxt}`,
      });
    }).join('');

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门仓库</div>
        <div class="section-sub">弟子用贡献点自主兑换，宗主不直接分配</div>
      </div>
      <div class="grid grid-2" style="gap:10px">${cards}</div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">弟子贡献一览</div></div>
      <div class="grid grid-4">
        ${st.disciples.map((d) => {
          const need = S.realm.expNeed(d.realm);
          const fill = U.clamp(d.exp / need, 0, 1) * 100;
          const opt = S.systems.warehouse.decide(d, st);
          return `<div class="kv-item">
            <div class="kv-label">${esc(d.name)}</div>
            <div class="kv-value g">${d.contribution}</div>
            <div class="bar mt-sm"><i style="width:${fill.toFixed(0)}%;background:var(--purple)"></i></div>
            <div class="tiny mute mt-sm">${opt ? '想换「' + esc(opt.item.name) + '」' : '暂无中意之物'}</div>
          </div>`;
        }).join('') || '<div class="mute small">暂无弟子</div>'}
      </div>
    </div>`;
  }

  // =========================================================
  //  拍卖行
  // =========================================================
  function auction(st) {
    const rows = st.auction.map((slot, i) => {
      const item = S.items.get(slot.itemId);
      if (!item) return '';
      const afford = st.sect.spiritStones >= slot.price;
      const action = slot.sold
        ? '<span class="chip">已售出</span>'
        : `<button class="btn btn-sm ${afford ? 'btn-gold' : ''}" data-buy="${i}" ${afford ? '' : 'disabled'}>
             ${U.fmt(slot.price)} 灵石</button>`;

      return UI.itemCard(item, {
        meta: `<span class="price">${U.fmt(slot.price)} 灵石</span>
               ${slot.hot ? '<span class="chip red">抢手</span>' : ''}
               <span class="mute">·</span>
               <span>弟子兑换价 ${item.contrib} 贡献</span>`,
        action: `<div style="display:flex;flex-direction:column;justify-content:center">${action}</div>`,
      });
    }).join('');

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">拍卖行</div>
        <div class="section-sub">每年换一批货 · 价格随时浮动</div>
      </div>
      <div class="row-between" style="margin-bottom:12px">
        <div class="small dim">囊中灵石 <b class="nums" style="color:var(--gold)">${U.fmt(st.sect.spiritStones)}</b></div>
        <div class="tiny mute">买入的物资会自动存入仓库，等弟子来换</div>
      </div>
      <div class="grid grid-2" style="gap:10px">${rows || '<div class="empty">本年无货</div>'}</div>
    </div>`;
  }

  // =========================================================
  //  收徒
  // =========================================================
  function recruit(st) {
    const cap = S.state.capacity();
    const full = st.disciples.length >= cap;

    const cards = st.candidates.map((c) => {
      const terms = D.termList(c);
      const pr = UI.progressOf(c);
      return `<div class="dcard" style="cursor:default">
        <div class="dcard-top">
          <div class="avatar ${c.gender}">${esc(c.name.charAt(0))}</div>
          <div class="grow">
            <div class="dname">${esc(c.name)} ${UI.realmTag(c)}
              <span class="age">${c.age}岁</span></div>
            <div class="dstatus"><span class="act">${esc(c.pitch || '')}</span></div>
          </div>
        </div>

        <div class="stat-row" style="margin-top:2px">
          <span>资质 <b>${c.tianfu}</b></span>
          <span>悟性 <b>${c.wuxing}</b></span>
          <span>道心 <b>${c.daoxin}</b></span>
          <span>根骨 <b>${c.gengu}</b></span>
          <span>战力 <b style="color:var(--gold)">${D.power(c)}</b></span>
        </div>

        <div class="dterms">${terms.map(UI.termChip).join('')}</div>

        <div class="row-between mt" style="align-items:flex-end">
          <div class="tiny mute">修为 ${Math.round(pr.cur)} / ${pr.need}
            ${c.candidateWeek ? ` · 已候 ${st.week - c.candidateWeek}年` : ''}</div>
          <button class="btn btn-sm btn-primary" data-recruit="${c.id}" ${full ? 'disabled' : ''}>
            ${full ? '住不下了' : '留下干活'}</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">山门求见</div>
        <div class="section-sub">来的人都是求口饭吃 · 名额 ${st.disciples.length} / ${cap}</div>
      </div>
      ${st.candidates.length
        ? `<div class="grid grid-2" style="gap:12px">${cards}</div>`
        : `<div class="empty"><span class="big">静</span>山门外空无一人。<br>
            每年都可能有活不下去的人上山，也有人在等不到回音后自己走了。</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">收人是要干活的</div></div>
      <div class="small dim" style="line-height:1.95">
        · 来的都不是什么天才，是想找口饭吃的人。收进来先做<b>杂役</b>——挑水、劈柴、下田。<br>
        · 杂役修炼只有八成效率，贡献打八五折。干满六年、且有些功绩，才升<b>外门</b>。<br>
        · 进了外门才算正式弟子，能进丹房、器阁。再往上只能靠宗门大比。<br>
        · <b>资质</b>决定他适不适合修行，<b>性情词条</b>决定他适不适合留下来。<br>
        · 一个资质平平但「勤勉」「和气生财」的人，往往比空有天资的独狼更省心。<br>
        · 宗门规模越大，能留下的越多；驻地在哪，也决定来投的人多不多。
      </div>
    </div>`;
  }

  // =========================================================
  //  年报
  // =========================================================
  function reports(st) {
    const chronicle = chronicleBlock(st);

    if (!st.reports.length) {
      return `<div class="panel"><div class="empty">
        <span class="big">卷</span>第一卷年报还是空白。<br>推进一年，宗门里发生的事都会记在这里。
      </div></div>${chronicle}`;
    }
    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门年报</div>
        <div class="section-sub">共 ${st.reports.length} 卷 · 最新的在最上面</div>
      </div>
      ${st.reports.slice(0, 20).map(UI.reportBlock).join('')}
    </div>${chronicle}`;
  }

  // =========================================================
  //  宗门纪事：魔劫与传承
  // =========================================================
  function chronicleBlock(st) {
    const w = st.world || {};
    const log = S.worldevents.MAINLINE;
    const idx = w.mainlineIndex || 0;
    const seen = {};
    for (const h of w.history || []) {
      if (h.kind === 'mainline') seen[h.id] = h;
    }

    const mlRows = log.map((def, i) => {
      const done = seen[def.id];
      const state = done
        ? (done.win ? '<span class="chip jade">胜</span>' : '<span class="chip red">败</span>')
        : i < idx ? '<span class="chip">过</span>'
          : i === idx ? '<span class="chip gold">将至</span>'
            : '<span class="chip">未至</span>';
      const when = done ? `第 ${done.year} 年` : `第 ${def.year} 年`;
      const holder = st.disciples.find((d) => def.reward && def.reward.term && d.terms.includes(def.reward.term));
      const termName = def.reward && def.reward.term
        ? (S.terms.get(def.reward.term) || {}).name : '';
      return `<div class="chron-row">
        <span class="chron-year">${when}</span>
        <span class="chron-name">${esc(def.name)}</span>
        ${state}
        ${termName ? `<span class="tiny mute">${esc(termName)}${holder ? ' · ' + esc(holder.name) : ' · 未得其人'}</span>` : ''}
      </div>`;
    }).join('');

    const legs = st.legacyLog || [];
    const legRows = legs.length
      ? legs.map((l) => {
        const alive = st.disciples.some((d) => d.id === l.discipleId);
        return `<div class="chron-row">
          <span class="chron-year">第 ${l.year} 年</span>
          <span class="chron-name">${esc(l.termName)}</span>
          <span class="tiny">${esc(l.discipleName)} ← ${esc(l.npcName)}</span>
          ${alive ? '<span class="chip jade">在世</span>' : '<span class="chip">已故</span>'}
          ${l.mainline ? '<span class="chip gold">魔劫</span>' : ''}
        </div>`;
      }).join('')
      : '<div class="tiny mute">还没有人从江湖上带回过什么。</div>';

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门纪事</div>
        <div class="section-sub">魔劫四章与历代传承 · 人没了，这件事还在</div>
      </div>

      <div class="chron-block">
        <div class="chron-head">魔劫</div>
        ${mlRows}
      </div>

      <div class="chron-block">
        <div class="chron-head">传承 <span class="tiny mute">（${legs.length}）</span></div>
        ${legRows}
      </div>
    </div>`;
  }

  // =========================================================
  //  江湖
  // =========================================================
  function favBar(v) {
    // -100..100 映射到 0..100 宽度，零线居中
    const pct = (v + 100) / 2;
    const cls = v >= 10 ? '' : v <= -10 ? 'red' : 'gold';
    return `<div class="bar ${cls} fav-bar"><i style="width:${pct.toFixed(1)}%"></i>` +
      `<span class="fav-zero"></span></div>`;
  }

  function jianghu(st) {
    const known = S.systems.npc.known(st);
    const knownIds = new Set(known.map((k) => k.npc.id));
    const unknown = S.npcs.NPCS.filter((n) => !knownIds.has(n.id));

    // ---- 已结识的江湖人物 ----
    const cards = known.map(({ npc, rec, label }) => {
      const discipleRows = Object.keys(rec.discipleFavor)
        .map((did) => {
          const d = S.state.discipleById(did);
          if (!d) return null;
          const f = rec.discipleFavor[did];
          const fl = S.systems.npc.favorLabel(f);
          return `<span class="rel ${fl.cls}" title="对 ${d.name} 的好感 ${f}">` +
            `${esc(d.name)}<b>${fl.name}</b></span>`;
        })
        .filter(Boolean)
        .join('');

      const moodTxt = npc.mood
        ? (rec.sectFavor >= 35 ? npc.mood.warm
          : rec.sectFavor <= -25 ? npc.mood.cold
            : npc.mood.neutral)
        : '';

      const isFaction = npc.kind === 'faction';
      const gone = !!rec.departed;
      const lg = npc.legacy;
      // 词条唯一：看现在还有谁活着拿着它
      const holder = lg
        ? st.disciples.find((x) => x.terms.includes(lg.term))
        : null;
      const lgDone = !!holder;

      const legacyRow = !lg ? '' : `<div class="npc-legacy ${lgDone ? 'done' : ''}">
        ${holder
          ? `<span class="chip gold">已传</span> <span class="tiny">${esc(lg.name)}——在${esc(holder.name)}身上` +
            `${holder.realm >= 12 ? '（金丹）' : ''}</span>`
          : rec.legacyDone
            ? `<span class="chip">可再传</span> <span class="tiny mute">${esc(lg.name)}——上一位已不在，可另择传人</span>`
            : `<span class="chip">传承</span> <span class="tiny mute">${esc(lg.name)}——` +
              `好感 ${lg.require.favor} 以上，且${esc(lg.hint)}</span>`}
      </div>`;

      return `<div class="npc-card ${gone ? 'gone' : ''}">
        <div class="npc-head">
          <div class="npc-name">${esc(npc.name)}
            <span class="chip ${isFaction ? 'jade' : ''}">${
              isFaction ? '势力' : (S.npcs.ROLE_NAME[npc.role] || '江湖')}</span>
            ${gone ? '<span class="chip">已不在</span>' : ''}
          </div>
          <div class="tiny mute">${esc(npc.title)}</div>
        </div>
        <div class="npc-desc">${esc(npc.desc)}</div>

        ${gone ? '<div class="npc-mood">这个人已经不在江湖上了。</div>' : `
        <div class="npc-favrow">
          <span class="tiny mute">对宗门</span>
          ${favBar(rec.sectFavor)}
          <span class="rel ${label.cls}">${label.name}</span>
        </div>

        ${moodTxt ? `<div class="npc-mood">${esc(moodTxt)}</div>` : ''}

        ${discipleRows ? `<div class="npc-disc">
          <span class="tiny mute">对弟子：</span>${discipleRows}
        </div>` : ''}
        `}

        ${legacyRow}

        <div class="tiny mute" style="margin-top:6px">
          ${esc(S.regions.get(npc.region) ? S.regions.get(npc.region).name : '')}一带 ·
          见过 ${rec.met} 次 · 第 ${rec.lastWeek}年最近一次
          ${!isFaction && npc.lifespan && rec.age ? ` · ${rec.age}岁` : ''}
        </div>
      </div>`;
    }).join('');

    // ---- 听说过但没见过 ----
    const rumorCards = unknown.map((npc) => {
      const reg = S.regions.get(npc.region);
      return `<div class="npc-rumor">
        <span class="npc-rumor-name">？？？</span>
        <span class="tiny mute">${esc(reg ? reg.name : '')} · ${S.npcs.ROLE_NAME[npc.role] || ''}</span>
        <span class="tiny mute" style="opacity:.7">还没人见过</span>
      </div>`;
    }).join('');

    // ---- 弟子之间的关系网 ----
    const groups = { lover: [], sworn: [], enemy: [], close: [] };
    const seen = new Set();
    for (const d of st.disciples) {
      for (const oid of Object.keys(d.bonds || {})) {
        const o = S.state.discipleById(oid);
        if (!o) continue;
        const key = [d.id, oid].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const lab = S.relations.label(d, oid);
        const sc = Math.round(Math.min(
          S.relations.score(d, oid),
          S.relations.score(o, d.id)
        ));
        if (lab.id === 'lover') groups.lover.push({ a: d, b: o, sc });
        else if (lab.id === 'swornflag') groups.sworn.push({ a: d, b: o, sc });
        else if (lab.id === 'enemy' || lab.id === 'nemesis') groups.enemy.push({ a: d, b: o, sc });
        else if (lab.id === 'close' || lab.id === 'sworn') groups.close.push({ a: d, b: o, sc });
      }
    }

    const groupBlock = (title, list, cls, note) => {
      if (!list.length) return '';
      const items = list.map(({ a, b, sc }) =>
        `<div class="relpair ${cls}">
          <span class="relpair-name">${esc(a.name)} <span class="relpair-x">·</span> ${esc(b.name)}</span>
          <span class="tiny mute">${note(sc)}</span>
        </div>`).join('');
      return `<div class="mt">
        <div class="tiny mute" style="margin-bottom:6px">${title}</div>
        <div class="grid" style="gap:6px">${items}</div>
      </div>`;
    };

    const relHtml =
      groupBlock('道侣', groups.lover, 'rel-lover', (sc) => `情投意合 · 好感 ${sc}`) +
      groupBlock('结义', groups.sworn, 'rel-sworn', (sc) => `歃血为盟 · 好感 ${sc}`) +
      groupBlock('知己', groups.close, 'rel-close', (sc) => `交情深厚 · 好感 ${sc}`) +
      groupBlock('仇敌', groups.enemy, 'rel-enemy', (sc) => `势同水火 · 好感 ${sc}`);

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门内部</div>
        <div class="section-sub">弟子之间的关系，会自己生长，也会自己烂掉</div>
      </div>
      ${relHtml || `<div class="empty" style="padding:26px 0">
        弟子之间还没处出什么名堂。<br>
        <span class="tiny">关系要靠时间，也要靠他们自己愿意。</span>
      </div>`}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">江湖人物</div>
        <div class="section-sub">已结识 ${known.length} / ${S.npcs.NPCS.length} 位</div>
      </div>
      ${known.length
        ? `<div class="grid grid-2" style="gap:12px">${cards}</div>`
        : `<div class="empty"><span class="big">江</span>还没有见过什么人。<br>
            弟子外出历练时，总会遇上几个。</div>`}
    </div>

    ${rumorCards ? `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">听来的传闻</div>
        <div class="section-sub">没见过，但知道有这么个人</div>
      </div>
      <div class="grid" style="gap:6px">${rumorCards}</div>
    </div>` : ''}

    <div class="panel">
      <div class="panel-head"><div class="panel-title">江湖规矩</div></div>
      <div class="small dim" style="line-height:1.9">
        · 每个江湖人物都有<b>两套好感</b>：对宗门的，和对某个弟子的。两者互不相干。<br>
        · <b>对宗门好感高</b>，他会主动上山送东西、送人；好感低到一定程度，他会来找麻烦。<br>
        · <b>对某个弟子好感高</b>，他会私下给这个弟子好处——宗门未必知道，但东西确实进了库房。<br>
        · 好感会随着时间自然回落。想维持一段交情，就得有人常去看看。<br>
        · 弟子之间的关系也一样：常来往会更亲近，久不往来会淡，结了仇也很难解开。
      </div>
    </div>`;
  }

  // =========================================================
  //  宗门（建筑 + 身份）
  // =========================================================
  const SKILL_LABEL = { alchemy: '丹', forging: '器', trade: '商', leadership: '御' };

  function skillChips(d) {
    const s = D.skillSheet(d);
    return Object.keys(SKILL_LABEL).map((k) => {
      const v = s[k];
      const cls = v >= 60 ? 'jade' : v >= 35 ? '' : 'red';
      return `<span class="chip ${cls}" title="${SKILL_LABEL[k]} ${v}">` +
        `${SKILL_LABEL[k]}${v}</span>`;
    }).join('');
  }

  function buildingCard(st, def) {
    const b = S.systems.building.stateOf(st, def.id);
    const built = b && b.level > 0;
    const occ = built ? S.systems.building.occupantsOf(st, def.id) : [];
    const slots = built ? S.systems.building.slotCount(st, def.id) : 0;
    const rankReq = S.ranks.get(def.minRank);

    if (!built) {
      const afford = st.sect.spiritStones >= def.cost;
      return `<div class="bcard unbuilt">
        <div class="bcard-head">
          <div class="bcard-icon">${def.icon}</div>
          <div class="grow">
            <div class="bcard-name">${esc(def.name)}
              <span class="chip">未建</span></div>
            <div class="bcard-desc">${esc(def.desc)}</div>
          </div>
        </div>
        <div class="bcard-foot">
          <span class="tiny mute">最低身份 ${rankReq.name}</span>
          <button class="btn btn-sm ${afford ? 'btn-gold' : ''}" data-build="${def.id}"
            ${afford ? '' : 'disabled'}>建造 ${U.fmt(def.cost)} 灵石</button>
        </div>
      </div>`;
    }

    const occTags = occ.map((d) => `<span class="occ-tag" data-disciple="${d.id}">
        ${esc(d.name)}
        <b>${esc(S.ranks.nameOf(d.rank))}</b>
        <button class="occ-x" data-unassign="${def.id}:${d.id}" title="撤出">×</button>
      </span>`).join('');

    // 空位也画出来，一眼能看出还缺几个人
    const emptySlots = Math.max(0, slots - occ.length);
    const emptyTags = Array.from({ length: emptySlots }, () =>
      '<span class="occ-empty">空位</span>').join('');

    const occHtml = occ.length
      ? occTags + emptyTags
      : emptyTags || '<span class="tiny mute">还没有人</span>';

    const canUp = b.level < S.buildings.MAX_LEVEL;
    const upCost = canUp ? S.buildings.upgradeCost(def, b.level + 1) : 0;
    const affordUp = st.sect.spiritStones >= upCost;

    return `<div class="bcard">
      <div class="bcard-head">
        <div class="bcard-icon">${def.icon}</div>
        <div class="grow">
          <div class="bcard-name">${esc(def.name)}
            <span class="chip jade">Lv.${b.level}</span>
            <span class="chip">${occ.length}/${slots} 人</span>
          </div>
          <div class="bcard-desc">${esc(def.desc)}</div>
        </div>
      </div>

      <div class="bcard-occ">
        <span class="occ-label">入驻</span>
        ${occHtml}
      </div>

      <div class="bcard-foot">
        <span class="tiny mute">
          产 ${esc(def.output)} · 需${rankReq.name}${def.keySkill ? ' · ' + SKILL_LABEL[def.keySkill] : ''}
        </span>
        <div class="row" style="gap:6px">
          <button class="btn btn-sm" data-bassign="${def.id}"
            ${occ.length >= slots ? 'disabled' : ''}>入驻…</button>
          ${canUp
            ? `<button class="btn btn-sm ${affordUp ? 'btn-gold' : ''}" data-upgrade="${def.id}"
                 ${affordUp ? '' : 'disabled'}>扩建 ${U.fmt(upCost)}</button>`
            : '<span class="chip">已满级</span>'}
        </div>
      </div>
    </div>`;
  }

  function rankGroups(st) {
    const order = ['elder', 'personal', 'inner', 'outer', 'menial'];
    const groups = {};
    for (const d of st.disciples) {
      const r = d.rank || 'menial';
      (groups[r] = groups[r] || []).push(d);
    }

    return order.map((rid) => {
      const list = groups[rid] || [];
      if (!list.length) return '';
      const rank = S.ranks.get(rid);
      const rows = list
        .sort((a, b) => D.power(b) - D.power(a))
        .map((d) => {
          const canPersonal = S.ranks.levelOf(d.rank) === 2 && !d.rank;
          const isInner = d.rank === 'inner';
          const isPersonal = d.rank === 'personal';
          return `<div class="rankrow" data-disciple="${d.id}">
            <div class="grow">
              <span class="rankrow-name">${esc(d.name)}</span>
              <span class="tiny mute">${esc(S.realm.realmName(d.realm))} · 战力 ${D.power(d)}</span>
            </div>
            <div class="row" style="gap:4px">${skillChips(d)}</div>
            ${isInner ? `<button class="btn btn-sm btn-ghost" data-promote="${d.id}:personal">任命亲传</button>` : ''}
            ${isPersonal ? `<button class="btn btn-sm btn-ghost" data-promote="${d.id}:elder">升长老</button>` : ''}
          </div>`;
        }).join('');

      return `<div class="rankgroup">
        <div class="rankgroup-head">
          <span class="rank-pill ${rank.cls}">${rank.name}</span>
          <span class="tiny mute">${list.length} 人</span>
        </div>
        <div class="rankgroup-body">${rows}</div>
      </div>`;
    }).join('');
  }

  function sect(st) {
    const cards = S.buildings.BUILDINGS.map((def) => buildingCard(st, def)).join('');
    const cap = S.state.capacity();
    const upkeep = S.sect.totalUpkeep(st);
    const loc = S.locations.get(st.sect.location || 'houshan');
    const bestPow = S.sect.bestPower(st);
    const gap = S.sect.nextGradeGap(st);
    const expandCost = S.sect.expandCost(st);
    const nextT = S.systems.tournament.nextWeek(st.week);
    const untilT = nextT - st.week;
    const eligible = S.systems.tournament.eligible(st).length;

    // 还有没有空位可填——没有的话「一键派遣」就没意义
    const anyVacancy = S.buildings.BUILDINGS.some((def) => {
      const b = S.systems.building.stateOf(st, def.id);
      if (!b || b.level <= 0) return false;
      return b.occupants.length < S.systems.building.slotCount(st, def.id);
    });
    const idleCount = st.disciples.filter(
      (d) => !d.homeBuilding && !d.missionId && d.injureWeeks === 0
    ).length;

    const rankCount = {};
    for (const d of st.disciples) {
      const r = d.rank || 'menial';
      rankCount[r] = (rankCount[r] || 0) + 1;
    }

    return `<div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门事务</div>
        <div class="section-sub">
          ${st.sect.level} 级 · ${S.sect.scaleOf(st).name} ·
          门下 ${st.disciples.length}/${cap} 人
        </div>
      </div>

      ${(() => {
        const w = st.world || {};
        const debuff = S.systems.worldevent.currentDebuff(st);
        const nextMl = S.systems.worldevent.nextMainlineYear(st);
        const arrays = (w.arrays || []).map((id) => S.worldevents.ARRAY_BY_ID[id]).filter(Boolean);
        const treasures = (w.treasures || []).map((id) => S.worldevents.TREASURE_BY_ID[id]).filter(Boolean);

        const chip = (o, cls) => o
          ? `<span class="chip ${cls || ''}" title="${esc(o.desc)}">${esc(o.icon)} ${esc(o.name)}</span>`
          : '';

        return `<div class="mt" style="display:grid;gap:8px">
          ${debuff ? `<div class="we-debuff">
            <span class="chip red">魔劫余烬</span>
            <span class="tiny">到第 ${debuff.until} 年为止：修炼 −20%，但来投的人多五成</span>
          </div>` : ''}
          <div class="row wrap" style="gap:6px;align-items:center">
            <span class="tiny mute" style="width:44px">阵法</span>
            ${arrays.length ? arrays.map((a) => chip(a, 'jade')).join('') : '<span class="tiny mute">尚无</span>'}
            <span class="tiny mute" style="margin-left:8px">${arrays.length}/${S.systems.worldevent.MAX_ARRAYS}</span>
          </div>
          <div class="row wrap" style="gap:6px;align-items:center">
            <span class="tiny mute" style="width:44px">灵宝</span>
            ${treasures.length ? treasures.map((t) => chip(t, 'gold')).join('') : '<span class="tiny mute">尚无</span>'}
            <span class="tiny mute" style="margin-left:8px">${treasures.length}/${S.systems.worldevent.MAX_TREASURES}</span>
          </div>
          ${nextMl ? `<div class="tiny mute">下次魔劫：第 ${nextMl} 年</div>`
            : '<div class="tiny mute">魔劫已了</div>'}
        </div>`;
      })()}

      <div class="kv">
        <div class="kv-item">
          <div class="kv-label">灵石</div>
          <div class="kv-value g">${U.fmt(st.sect.spiritStones)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">名望</div>
          <div class="kv-value">${st.sect.reputation}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">年俸开销</div>
          <div class="kv-value" style="color:${upkeep > st.sect.spiritStones * 0.5 ? 'var(--red)' : 'var(--text)'}">
            ${U.fmt(upkeep)}<span class="tiny mute">/年</span>
          </div>
        </div>
        <div class="kv-item">
          <div class="kv-label">驻地</div>
          <div class="kv-value" style="font-size:13px">${esc(loc.name)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">长老</div>
          <div class="kv-value">${rankCount.elder || 0}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">亲传</div>
          <div class="kv-value">${rankCount.personal || 0}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">内门</div>
          <div class="kv-value">${rankCount.inner || 0}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">外门 / 杂役</div>
          <div class="kv-value">${rankCount.outer || 0} / ${rankCount.menial || 0}</div>
        </div>
      </div>

      <div class="mt" style="background:#161c24;border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div class="row-between wrap" style="gap:10px">
          <div>
            <div class="small" style="color:var(--jade)">
              宗门等级 ${st.sect.level} 级
              <span class="tiny mute">— 由声望与最强弟子实力共同评定</span>
            </div>
            <div class="tiny mute" style="margin-top:2px">
              声望 ${st.sect.reputation} · 最强战力 ${bestPow}
              ${gap ? ` · 距下一级还差${gap.rep ? ` 声望 ${gap.rep}` : ''}${gap.power ? ` 战力 ${gap.power}` : ''}` : ' · 已是最高评定'}
            </div>
          </div>
          ${gap ? '' : '<span class="chip gold">已至顶阶</span>'}
        </div>
      </div>

      <div class="mt" style="background:#161c24;border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div class="row-between wrap" style="gap:10px">
          <div>
            <div class="small" style="color:var(--gold)">
              规模：${S.sect.scaleOf(st).name}（容 ${cap} 人）
            </div>
            <div class="tiny mute" style="margin-top:2px">
              ${expandCost
                ? `扩建到「${S.sect.SCALES[(st.sect.scale | 0) + 1].name}」需要 ${U.fmt(expandCost)} 灵石`
                : '已经扩到最大'}
            </div>
          </div>
          ${expandCost
            ? `<button class="btn btn-sm ${st.sect.spiritStones >= expandCost ? 'btn-gold' : ''}"
                 data-expand ${st.sect.spiritStones >= expandCost ? '' : 'disabled'}>
                 扩建 ${U.fmt(expandCost)}</button>`
            : ''}
        </div>
      </div>

      <div class="mt" style="background:#161c24;border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div class="row-between wrap" style="gap:10px">
          <div class="grow">
            <div class="small" style="color:var(--purple)">驻地：${esc(loc.name)}</div>
            <div class="tiny" style="color:var(--green);margin-top:3px">
              利 · ${loc.pros.map(esc).join('；')}
            </div>
            <div class="tiny" style="color:var(--red);margin-top:1px">
              弊 · ${loc.cons.map(esc).join('；')}
            </div>
          </div>
          <button class="btn btn-sm" data-relocate>搬迁…</button>
        </div>
      </div>

      <div class="mt tournament-banner">
        <div class="row-between wrap" style="gap:8px">
          <div>
            <div class="small" style="color:var(--gold)">
              下一届宗门大比：第 ${nextT}年（还有 ${untilT}年）
            </div>
            <div class="tiny mute">
              参赛 ${eligible} 人 · 夺魁者晋入内门 · 亲传与长老不参赛
            </div>
          </div>
          <span class="chip gold">每 ${S.systems.tournament.INTERVAL}年一次</span>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">宗门建筑</div>
        <div class="row" style="gap:10px;align-items:center">
          <div class="section-sub">
            ${idleCount} 人空闲${anyVacancy ? ' · 有空位' : ' · 没有空位'}
          </div>
          <button class="btn btn-sm ${st.settings.autoFill ? 'btn-primary' : ''}"
            data-autofill-toggle
            title="开启后，每年结算时自动把空闲弟子派进各处">
            自动补位 ${st.settings.autoFill ? '开' : '关'}
          </button>
          <button class="btn btn-sm btn-primary" data-autofill
            ${anyVacancy && idleCount > 0 ? '' : 'disabled'}
            title="把空闲弟子按技艺自动分派到各处">一键派遣</button>
        </div>
      </div>
      <div class="grid grid-2" style="gap:12px">${cards}</div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">门内序列</div>
        <div class="section-sub">亲传由宗主或长老任命 · 内门只能靠大比</div>
      </div>
      ${rankGroups(st) || '<div class="empty">宗门里还没有人。</div>'}
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">规矩</div></div>
      <div class="small dim" style="line-height:1.95">
        · <b>杂役弟子</b>：修炼只有八成效率，贡献打八五折。入宗满八年且有些功绩，会自动升外门。<br>
        · <b>外门弟子</b>：正常待遇。想再往上，只有一条路——<b>宗门大比夺魁</b>。<br>
        · <b>内门弟子</b>：修炼快近两成，能进账房、藏经阁。<br>
        · <b>亲传弟子</b>：需内门身份，再由宗主钦点或长老举荐。<br>
        · <b>长老</b>：可进任何建筑，修炼最快，也能举荐亲传。<br>
        · 建筑需要<b>对应技艺</b>的人才有产出。技艺越高的弟子，炼出来的东西越好。<br>
        · 没料的时候炉子会空转——记得给丹房留灵材，给器阁留玄铁。
      </div>
    </div>`;
  }

  S.panels = { overview, disciples, missions, warehouse, auction, recruit, jianghu, sect, reports };
})(window.Sect);
