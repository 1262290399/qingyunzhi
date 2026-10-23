/* ===========================================================
 * render.js — 公共渲染组件
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const R = S.realm;
  const D = S.disciple;

  const $ = (id) => document.getElementById(id);

  /** HTML 转义 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------- 顶栏 ----------------
  function refreshTop(st) {
    const sect = st.sect;
    $('sectName').textContent = sect.name;
    $('sectSeal').textContent = sect.name.charAt(0);
    $('sectLevel').textContent = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][sect.level - 1] + '级宗门';

    const need = S.state.REP_FOR_LEVEL(sect.level);
    const pct = U.clamp(sect.reputation / need, 0, 1);
    $('repFill').style.width = (pct * 100).toFixed(1) + '%';
    $('repNum').textContent = `${sect.reputation} / ${need}`;

    $('resStones').textContent = U.fmt(sect.spiritStones);
    $('resDisciples').textContent = `${st.disciples.length}/${S.state.capacity()}`;
    $('resStock').textContent = Object.keys(st.warehouse).filter((k) => st.warehouse[k] > 0).length;
    $('resWeek').textContent = st.week;

    // 标签徽标：只提示"真正没看过的东西"，不做常驻装饰
    const tabMission = document.querySelector('[data-tab="missions"]');
    tabMission.innerHTML = '任务';

    const tabRecruit = document.querySelector('[data-tab="recruit"]');
    const canRecruit = st.disciples.length < S.state.capacity();
    tabRecruit.innerHTML = '收徒' +
      (canRecruit && st.candidates.length ? `<span class="badge">${st.candidates.length}</span>` : '');

    // 年报：只显示还没读过的卷数，进过年报页就清零
    const tabReports = document.querySelector('[data-tab="reports"]');
    const seen = (st.ui && st.ui.reportSeen) || 0;
    const unread = Math.max(0, (st.week - 1) - seen);
    tabReports.innerHTML = '年报' + (unread > 0 ? `<span class="badge">${unread}</span>` : '');

    // 状态栏
    const totalPower = st.disciples.reduce((s, d) => s + D.power(d), 0);
    $('statusLeft').textContent =
      `第 ${st.week}年 · 门下 ${st.disciples.length} 人 · 总战力 ${totalPower} · 名望 ${sect.reputation}`;
    $('statusRight').textContent = sect.totalMissions
      ? `累计完成任务 ${sect.totalMissions} 次 · 入库物资 ${sect.totalLoot} 件`
      : '刚开山立派，一切从简';
  }

  // ---------------- 弟子 ----------------
  function realmTag(d) {
    return `<span class="realm-tag">${esc(R.realmName(d.realm))}</span>`;
  }

  function statusText(d) {
    if (d.injureWeeks > 0) return `<span style="color:var(--red)">养伤中</span>（还需 ${d.injureWeeks}年）`;
    if (d.missionId) {
      const m = S.state.data.missions.find((x) => x.id === d.missionId);
      return `<span class="act">在外执行「${esc(m ? m.name : '任务')}」</span>`;
    }
    if (d.assignedMissionId) return `<span class="act">已领命，整装待发</span>`;
    if (d.status === 'mission') return '<span class="act">在外执行任务</span>';
    return `<span class="act">${esc(d.lastAction || '静修')}</span>`;
  }

  function termChip(term) {
    if (!term) return '';
    const r = S.terms.RARITY[term.rarity];
    const kindTxt = term.kind === 'good' ? '吉' : term.kind === 'bad' ? '凶' : '平';
    return `<span class="term ${r.cls} ${term.kind}" title="${esc(term.desc)}">
      ${esc(term.name)}<span class="t-kind">${kindTxt}</span></span>`;
  }

  function progressOf(d) {
    const need = R.expNeed(d.realm);
    return { cur: Math.min(d.exp, need), need, pct: U.clamp(d.exp / need, 0, 1) * 100 };
  }

  function discipleCard(d) {
    const tier = R.tierOf(d.realm);
    const pr = progressOf(d);
    const terms = D.termList(d);
    const inj = d.injureWeeks > 0 ? ' injured' : '';
    return `<div class="dcard tier-${tier}${inj}" data-disciple="${d.id}">
      <div class="dcard-top">
        <div class="avatar ${d.gender}">${esc(d.name.charAt(0))}</div>
        <div class="grow">
          <div class="dname">${esc(d.name)} ${realmTag(d)}
            <span class="age" title="年龄 / 寿元">${d.age}/${S.disciple.lifespanOf(d)}岁</span></div>
          <div class="dstatus">${statusText(d)}</div>
        </div>
        <div class="tiny mute nums" title="贡献点">${d.contribution} 贡献</div>
      </div>

      <div class="bar"><i style="width:${pr.pct.toFixed(1)}%"></i></div>
      <div class="stat-row">
        <span>修为 <b>${Math.round(pr.cur)}</b>/${pr.need}</span>
        <span>战力 <b style="color:var(--gold)">${D.power(d)}</b></span>
        <span>忠诚 <b>${Math.round(d.loyalty)}</b></span>
        <span>资质 <b>${d.tianfu}</b></span>
      </div>

      <div class="dterms">${terms.map(termChip).join('')}</div>
    </div>`;
  }

  // ---------------- 物品 ----------------
  const TYPE_ICON = { pill: '丹', material: '材', manual: '简', talisman: '符' };

  function itemCard(item, opts) {
    opts = opts || {};
    const t = item.tier;
    const qty = opts.qty;
    return `<div class="item t${t}">
      <div class="item-icon">${TYPE_ICON[item.type] || '物'}</div>
      <div class="grow">
        <div class="item-name">${esc(item.name)}
          <span class="chip">${S.items.TIER_NAME[t]}${S.items.TYPE_NAME[item.type]}</span>
          ${qty ? `<span class="chip jade">×${qty}</span>` : ''}
        </div>
        <div class="item-desc">${esc(item.desc)}</div>
        <div class="item-meta">${opts.meta || ''}</div>
      </div>
      ${opts.action || ''}
    </div>`;
  }

  // ---------------- 任务 ----------------
  function missionCard(m, st) {
    const typeName = S.missions.TYPE_NAME[m.type];
    const icon = S.missions.TYPE_ICON[m.type];
    const region = S.regions.get(m.region);
    let stateCls = '';
    let assignee = '';
    if (m.status === 'taken') {
      stateCls = ' taken';
      const d = st.disciples.find((x) => x.id === m.takenBy);
      assignee = d ? `<span class="chip gold">${esc(d.name)} 承接中</span>` : '';
    } else if (m.status === 'done') {
      stateCls = ' done';
      assignee = '<span class="chip">已完成</span>';
    }
    return `<div class="mission${stateCls}">
      <div class="mission-head">
        <span class="chip">${icon} ${typeName}</span>
        <span class="mission-name">${esc(m.name)}</span>
        ${assignee}
      </div>
      <div class="mission-desc">${esc(m.desc)}</div>
      <div class="mission-foot">
        <span>地点 <span class="need">${esc(region ? region.name : '未知')}</span></span>
        <span>建议战力 <span class="need">${m.powerNeed}</span></span>
        <span>贡献 <b>${m.contrib}</b></span>
        <span>灵石 <b>${m.stones}</b></span>
        <span>名望 <b>${m.rep}</b></span>
        ${m.status === 'open' ? `<button class="btn btn-sm btn-ghost" data-assign="${m.id}">指派…</button>` : ''}
      </div>
    </div>`;
  }

  // ---------------- 年报 ----------------
  const KIND_ICON = {
    mission: '命', expedition: '历', loot: '宝', social: '交',
    conflict: '斗', danger: '险', breakthrough: '破', fortune: '奇',
    sect: '宗', recruit: '收', exchange: '换', growth: '修',
    tournament: '比', saga: '章', info: '·',
  };

  function reportBlock(report) {
    const lines = report.entries.length
      ? report.entries.map((e) => `<div class="rline ${e.kind}">
          <span class="rk">${KIND_ICON[e.kind] || '·'}</span>
          <span>${esc(e.text)}${
            e.meta ? `<span class="rline-meta">${esc(e.meta)}</span>` : ''
          }</span>
        </div>`).join('')
      : '<div class="rline info"><span class="rk">·</span><span>宗门无事，弟子们各做各的。</span></div>';

    const m = report.moment;
    const momentTxt = m ? `${m.season} · ${m.weather}` : '';

    return `<div class="report">
      <div class="report-week"></div>
      <div class="row-between" style="margin-bottom:6px">
        <div class="panel-title" style="font-size:14px">
          第 ${report.week}年
          ${momentTxt ? `<span class="moment">${esc(momentTxt)}</span>` : ''}
        </div>
        <div class="tiny mute">
          弟子 ${report.stats.disciples} · 总战力 ${report.stats.totalPower} ·
          灵石 ${U.fmt(report.stats.stones)} · 名望 ${report.stats.reputation}
        </div>
      </div>
      ${report.prelude ? `<div class="report-prelude">${esc(report.prelude)}</div>` : ''}
      ${lines}
    </div>`;
  }

  // ---------------- Toast ----------------
  let toastTimer = null;
  function toast(msg, type) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2400);
  }

  // ---------------- 时间与进度 ----------------
  let _lastWeekTxt = '';
  let _progFill = null;

  /** 每帧调用：只改进度条宽度，不重复查询 DOM */
  function updateProgress() {
    const st = S.state.data;
    if (!st) return;
    if (!_progFill) _progFill = $('weekFill');
    if (_progFill) {
      const p = S.time ? S.time.progress() : 0;
      _progFill.style.width = (p * 100).toFixed(1) + '%';
    }
    const lbl = $('weekLabel');
    if (lbl) {
      const txt = `第 ${st.week}年`;
      if (txt !== _lastWeekTxt) {
        _lastWeekTxt = txt;
        lbl.textContent = txt;
      }
    }
  }

  /** 倍速变化时调用 */
  function updateSpeedUI() {
    if (!S.time) return;
    const t = S.time.state;
    document.querySelectorAll('.spbtn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.speed) === t.speed);
    });
    const sl = $('speedLabel');
    if (sl) {
      sl.textContent = t.speed === 0
        ? '已暂停'
        : `${t.speed}× 进行中`;
      sl.classList.toggle('paused', t.speed === 0);
    }
  }

  // ---------------- 动态流 ----------------
  function feedItemHtml(e) {
    const icon = KIND_ICON[e.kind] || '·';
    const meta = e.meta ? `<span class="fi-meta">${esc(e.meta)}</span>` : '';
    return `<div class="feed-item ${e.kind}"><span class="rk">${icon}</span>` +
      `<span class="tx">${esc(e.text)}${meta}</span></div>`;
  }

  function feedDividerHtml(week) {
    return `<div class="feed-week"><span>第 ${week}年</span></div>`;
  }

  /** 全量渲染动态流（切换回山门页时用） */
  function feedHtml() {
    const feed = S.time ? S.time.state.feed : [];
    if (!feed.length) {
      return '<div class="feed-empty">宗门刚刚开山，还没有什么值得记的事。</div>';
    }
    return feed.map((e) => (e.divider ? feedDividerHtml(e.week) : feedItemHtml(e))).join('');
  }

  /** 增量追加一条（每播报一条事件时用） */
  function appendFeed(entry) {
    const list = $('feedList');
    if (!list) return;

    const empty = list.querySelector('.feed-empty');
    if (empty) empty.remove();

    // 只有用户没有往上翻历史时才自动贴底
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;

    // feed 数组里 divider 紧挨在当年第一条之前，靠它判断要不要插年分隔
    const feed = S.time.state.feed;
    const prev = feed[feed.length - 2];
    if (prev && prev.divider && prev.week === entry.week) {
      list.insertAdjacentHTML('beforeend', feedDividerHtml(entry.week));
    }

    list.insertAdjacentHTML('beforeend', feedItemHtml(entry));

    while (list.children.length > 160) list.removeChild(list.firstChild);
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }

  /** 关系标签：名字 + 关系阶段 */
  function relationChip(d, other) {
    const lab = S.relations.label(d, other.id);
    const sc = Math.round(S.relations.score(d, other.id));
    return `<span class="rel ${lab.cls}" title="好感 ${sc}">` +
      `${esc(other.name)}<b>${lab.name}</b></span>`;
  }

  S.ui = { $, esc, refreshTop, discipleCard, termChip, itemCard, missionCard, reportBlock, toast, progressOf, realmTag, statusText, TYPE_ICON, KIND_ICON, updateProgress, updateSpeedUI, feedHtml, appendFeed, feedItemHtml, relationChip };
})(window.Sect);
