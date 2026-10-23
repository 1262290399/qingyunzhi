/* ===========================================================
 * main.js — 启动、路由、事件绑定
 *
 * 游戏由 time.js 的实时循环驱动，不再有"推进一年"按钮。
 * 玩家能做的是：调速度、暂停、以及在山门里指手画脚。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;
  const D = S.disciple;
  const UI = S.ui;
  const $ = UI.$;

  let currentTab = 'overview';

  // =========================================================
  //  启动
  // =========================================================
  function boot() {
    const saved = S.state.load();
    S.state.data = saved || S.state.initNewGame();
    const st = S.state.data;

    // 离线结算要在首次渲染之前跑，否则数字会跳一下
    let offline = null;
    try {
      offline = S.time.offlineSettle(st);
    } catch (e) {
      console.error('离线结算失败', e);
    }

    render();
    bindGlobal();
    UI.updateSpeedUI();
    UI.updateProgress();

    if (offline) {
      showOfflineReport(offline);
    }

    st.lastSeen = Date.now();
    S.time.state.lastSeenSave = Date.now();
    S.time.start();

    if (!S.state.storageOk()) {
      UI.toast('当前环境无法使用本地存档，进度不会保留', 'err');
    }
  }

  // =========================================================
  //  渲染
  // =========================================================
  function render(preserveScroll) {
    const st = S.state.data;
    UI.refreshTop(st);

    const view = $('view');
    const top = preserveScroll ? view.scrollTop : 0;

    const fn = S.panels[currentTab] || S.panels.overview;
    view.innerHTML = fn(st);
    view.scrollTop = preserveScroll ? top : 0;

    // 动态流始终贴着最新
    const feed = $('feedList');
    if (feed) feed.scrollTop = feed.scrollHeight;

    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === currentTab);
    });

    const hints = {
      overview: '宗门自己会运转，你只决定方向',
      disciples: '词条不会变，会陪这名弟子一辈子',
      missions: '战力不够硬接任务，容易躺着回来',
      warehouse: '仓库是弟子的动力来源，空仓会散人心',
      auction: '灵石不生息，该花就花',
      recruit: '看清楚词条再决定收不收',
      sect: '建筑要有人管，身份要有人升',
      jianghu: '江湖上的交情，也是要花心思养的',
      reports: '每年一卷，宗门里发生过的事都在这儿',
    };
    $('tabHint').textContent = hints[currentTab] || '';

    UI.updateSpeedUI();
  }

  function switchTab(tab) {
    if (currentTab === tab) return;
    currentTab = tab;
    // 看过年报就把未读清零
    if (tab === 'reports' && S.state.data) {
      S.state.data.ui = S.state.data.ui || {};
      S.state.data.ui.reportSeen = S.state.data.week - 1;
    }
    render();
  }

  // =========================================================
  //  实时循环的回调
  // =========================================================
  function onWeek(report) {
    const st = S.state.data;
    UI.refreshTop(st);

    // 停在别的页面时，顺手把那一页也刷新，但不要打断弹窗
    const modalOpen = !$('modal').classList.contains('hidden');
    if (!modalOpen) {
      render(true);
    } else {
      UI.updateSpeedUI();
    }
  }

  function onFeed(entry) {
    UI.appendFeed(entry);

    // 底部状态栏常驻最新一条，方便在别的页面也能看到动静
    const right = $('statusRight');
    if (right) right.textContent = entry.text;
  }

  // =========================================================
  //  全局事件
  // =========================================================
  function bindGlobal() {
    $('tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) switchTab(t.dataset.tab);
    });

    // 倍速
    $('speeds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (!b) return;
      S.time.setSpeed(Number(b.dataset.speed));
      const sp = S.time.state.speed;
      UI.toast(sp === 0 ? '已暂停，宗门静止' : `已切换到 ${sp} 倍速`, sp === 0 ? '' : 'ok');
    });

    // 空格：暂停 / 继续
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const sp = S.time.togglePause();
        UI.toast(sp === 0 ? '已暂停' : `继续 · ${sp} 倍速`, sp === 0 ? '' : 'ok');
      }
      if (e.key === 'Escape') closeModal();
    });

    $('btnMenu').addEventListener('click', openMenu);
    $('view').addEventListener('click', onViewClick);

    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
      if (e.target.closest('[data-close-modal]')) closeModal();
      const weBtn = e.target.closest('[data-we-choose]');
      if (weBtn) { doWorldEventChoose(weBtn.dataset.weChoose); return; }
      const act = e.target.closest('[data-modal-action]');
      if (act) handleModalAction(act.dataset.modalAction, act.dataset, act);
    });

    // 离开页面时把最后在线时间落盘，回来好算离线
    window.addEventListener('beforeunload', () => {
      const st = S.state.data;
      if (st) {
        st.lastSeen = Date.now();
        S.state.save(true);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const st = S.state.data;
        if (st) {
          st.lastSeen = Date.now();
          S.state.save(true);
        }
      } else {
        // 切回来：若离开超过门槛，补算离线
        const st = S.state.data;
        if (!st) return;
        const off = S.time.offlineSettle(st);
        if (off) {
          render(true);
          showOfflineReport(off);
        }
        S.time.state.lastFrame = 0; // 让循环丢掉这段大间隔
      }
    });

    // 设置回调（time.js 内部读的是 state 上的字段）
    S.time.state.onWeek = onWeek;
    S.time.state.onFeed = onFeed;
  }

  function onViewClick(e) {
    const dcard = e.target.closest('[data-disciple]');
    const buy = e.target.closest('[data-buy]');
    const rec = e.target.closest('[data-recruit]');
    const asg = e.target.closest('[data-assign]');
    const bassign = e.target.closest('[data-bassign]');
    const goTo = e.target.closest('[data-goto]');
    const buildBtn = e.target.closest('[data-build]');
    const upBtn = e.target.closest('[data-upgrade]');
    const unassignBtn = e.target.closest('[data-unassign]');
    const promoteBtn = e.target.closest('[data-promote]');
    const autoFillBtn = e.target.closest('[data-autofill]');
    const autoFillToggle = e.target.closest('[data-autofill-toggle]');
    const expandBtn = e.target.closest('[data-expand]');
    const relocateBtn = e.target.closest('[data-relocate]');

    if (goTo) { switchTab(goTo.dataset.goto); return; }
    if (expandBtn) { doExpand(); return; }
    if (relocateBtn) { openRelocate(); return; }
    if (unassignBtn) { doUnassign(unassignBtn.dataset.unassign); return; }
    if (buildBtn) { doBuild(buildBtn.dataset.build); return; }
    if (upBtn) { doUpgrade(upBtn.dataset.upgrade); return; }
    if (promoteBtn) { doPromote(promoteBtn.dataset.promote); return; }
    if (autoFillToggle) { toggleAutoFill(); return; }
    if (autoFillBtn) { doAutoFill(); return; }
    if (bassign) { openAssignBuilding(bassign.dataset.bassign); return; }
    if (asg) { openAssign(asg.dataset.assign); return; }
    if (buy) { doBuy(Number(buy.dataset.buy)); return; }
    if (rec) { doRecruit(rec.dataset.recruit); return; }
    if (dcard) { openDisciple(dcard.dataset.disciple); return; }
  }

  // ---------------- 宗门 ----------------
  function doExpand() {
    const st = S.state.data;
    const r = S.systems.sect.expand(st);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  function openRelocate() {
    const st = S.state.data;
    const cur = st.sect.location || 'houshan';

    const rows = S.locations.LOCATIONS.map((loc) => {
      const isCur = loc.id === cur;
      const gate = S.systems.sect.canRelocate(st, loc.id);
      const locked = !isCur && !gate.ok && /等级/.test(gate.msg);

      return `<div class="assign-row" style="align-items:flex-start;${isCur ? 'opacity:.55' : ''}">
        <div class="grow">
          <div class="small" style="color:var(--text)">
            ${UI.esc(loc.name)}
            ${isCur ? '<span class="chip">现驻地</span>' : ''}
            ${loc.minGrade > 1 ? `<span class="chip">需 ${loc.minGrade} 级</span>` : ''}
            ${loc.cost ? `<span class="chip gold">${U.fmt(loc.cost)} 灵石</span>` : ''}
          </div>
          <div class="tiny" style="color:var(--green);margin-top:2px">利 · ${loc.pros.map(UI.esc).join('；')}</div>
          <div class="tiny" style="color:var(--red)">弊 · ${loc.cons.map(UI.esc).join('；')}</div>
        </div>
        <div style="flex-shrink:0">
          ${isCur ? '' : `<button class="btn btn-sm ${gate.ok ? 'btn-gold' : ''}"
            data-modal-action="relocate" data-loc="${loc.id}"
            ${gate.ok ? '' : 'disabled'}
            title="${UI.esc(gate.ok ? '' : gate.msg)}">迁往</button>`}
        </div>
      </div>`;
    }).join('');

    openModal(`
      <div class="panel-title" style="margin-bottom:4px">搬迁宗门</div>
      <div class="small mute" style="margin-bottom:10px">
        搬一次家伤筋动骨：声望会掉一成，弟子心情也会受影响。<br>
        但换个地方，就换一套得失——没有纯赚的选址。
      </div>
      ${rows}
      <div class="row mt" style="justify-content:flex-end">
        <button class="btn" data-close-modal>算了</button>
      </div>
    `);
  }

  // ---------------- 建筑 ----------------
  function toggleAutoFill() {
    const st = S.state.data;
    st.settings.autoFill = !st.settings.autoFill;
    S.state.save(true);
    UI.toast(
      st.settings.autoFill
        ? '已开启自动补位：每年结算时会把空闲弟子派进各处'
        : '已关闭自动补位',
      st.settings.autoFill ? 'ok' : ''
    );
    render(true);
  }

  function doAutoFill() {
    const st = S.state.data;
    const r = S.systems.building.autoFill(st);
    if (!r.ok) {
      UI.toast(r.msg, 'err');
      return;
    }
    // 派了谁、去哪了，值得说清楚
    const detail = r.moved.map((m) => `${m.name}→${m.building}`).join('、');
    UI.toast(`${r.msg}：${detail}`, 'ok');
    S.state.save(true);
    render(true);
  }

  function doBuild(id) {
    const st = S.state.data;
    const r = S.systems.building.build(st, id);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  function doUpgrade(id) {
    const st = S.state.data;
    const r = S.systems.building.upgrade(st, id);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  function doUnassign(payload) {
    const [bid, did] = String(payload).split(':');
    const st = S.state.data;
    const r = S.systems.building.remove(st, bid, did);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  function doPromote(payload) {
    const [did, rankId] = String(payload).split(':');
    const st = S.state.data;
    const r = S.systems.building.promote(st, did, rankId);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  /** 选一个弟子进建筑 */
  function openAssignBuilding(buildingId) {
    const st = S.state.data;
    const def = S.buildings.get(buildingId);
    if (!def) return;
    const slots = S.systems.building.slotCount(st, buildingId);
    const occ = S.systems.building.occupantsOf(st, buildingId);
    const occIds = new Set(occ.map((o) => o.id));
    const full = occ.length >= slots;

    // 分三拨：已经在这里的 / 闲着的 / 在别处干活的
    const elsewhere = [];
    const free = [];
    for (const d of st.disciples) {
      if (occIds.has(d.id)) continue;
      if (d.homeBuilding) {
        const at = S.buildings.get(d.homeBuilding);
        elsewhere.push({ d, at });
      } else {
        free.push(d);
      }
    }

    const occRows = occ.length
      ? occ.map((d) => {
          const skillVal = def.keySkill ? D.effSkill(d, def.keySkill) : null;
          return `<div class="assign-row">
            <div class="grow">
              <div class="small" style="color:var(--text)">${UI.esc(d.name)}
                <span class="tiny mute">${UI.esc(S.ranks.nameOf(d.rank))}</span></div>
            </div>
            <div class="row" style="gap:6px">
              ${skillVal !== null ? `<span class="chip jade">${SKILL_LABEL_UI[def.keySkill]} ${skillVal}</span>` : ''}
              <button class="btn btn-sm btn-ghost" data-unassign="${buildingId}:${d.id}">撤出</button>
            </div>
          </div>`;
        }).join('')
      : '<div class="mute small" style="padding:6px 0">还没有人。</div>';

    const freeRows = free.map((d) => {
      const okRank = S.ranks.canEnter(d.rank || 'menial', buildingId);
      const busy = !!d.missionId;
      const disabled = !okRank || busy;
      const why = !okRank ? `${S.ranks.nameOf(d.rank)}进不来` : busy ? '在外办事' : '';

      const skillVal = def.keySkill ? D.effSkill(d, def.keySkill) : null;
      const skillTxt = skillVal !== null
        ? `<span class="chip ${skillVal >= 55 ? 'jade' : skillVal >= 30 ? '' : 'red'}">` +
          `${SKILL_LABEL_UI[def.keySkill]} ${skillVal}</span>`
        : '';

      return `<div class="assign-row">
        <div class="grow">
          <div class="small" style="color:var(--text)">${UI.esc(d.name)}
            <span class="tiny mute">${UI.esc(S.ranks.nameOf(d.rank))} ·
              ${UI.esc(S.realm.realmName(d.realm))}</span></div>
          ${why ? `<div class="tiny" style="color:var(--red)">${why}</div>` : ''}
        </div>
        <div class="row" style="gap:6px">
          ${skillTxt}
          <button class="btn btn-sm" data-modal-action="assign-building"
            data-id="${d.id}" data-bid="${buildingId}"
            ${disabled ? 'disabled' : ''}>入驻</button>
        </div>
      </div>`;
    }).join('');

    // 在别处干活的人：列出来，点了会调过来（需二次确认）
    const elsewhereRows = elsewhere.map(({ d, at }) => {
      const okRank = S.ranks.canEnter(d.rank || 'menial', buildingId);
      const busy = !!d.missionId;
      const disabled = !okRank || busy || full;
      const skillVal = def.keySkill ? D.effSkill(d, def.keySkill) : null;
      const skillTxt = skillVal !== null
        ? `<span class="chip ${skillVal >= 55 ? 'jade' : skillVal >= 30 ? '' : 'red'}">` +
          `${SKILL_LABEL_UI[def.keySkill]} ${skillVal}</span>`
        : '';

      return `<div class="assign-row">
        <div class="grow">
          <div class="small" style="color:var(--text)">${UI.esc(d.name)}
            <span class="tiny mute">${UI.esc(S.ranks.nameOf(d.rank))} ·
              ${UI.esc(S.realm.realmName(d.realm))}</span></div>
          <div class="tiny mute">在${UI.esc(at ? at.name : '别处')}</div>
        </div>
        <div class="row" style="gap:6px">
          ${skillTxt}
          <button class="btn btn-sm btn-ghost" data-modal-action="assign-building"
            data-id="${d.id}" data-bid="${buildingId}" data-force="1"
            ${disabled ? 'disabled' : ''}>调入</button>
        </div>
      </div>`;
    }).join('');

    openModal(`
      <div class="panel-title" style="margin-bottom:4px">派人进${UI.esc(def.name)}</div>
      <div class="small mute" style="margin-bottom:12px">
        名额 <b style="color:var(--jade)">${occ.length}/${slots}</b>。${def.keySkill
          ? `这处看重「${SKILL_LABEL_UI[def.keySkill]}」，技艺越高产出越好。`
          : '这处不需要专门技艺，谁都能做。'}
        ${full ? '<br><span style="color:var(--gold)">名额已满，得先撤出一个人。</span>' : ''}
      </div>

      <div class="assign-block">
        <div class="assign-label">已入驻</div>
        ${occRows}
      </div>

      <div class="assign-block">
        <div class="assign-label">空闲弟子</div>
        ${freeRows || '<div class="mute small" style="padding:6px 0">没有空闲的人。</div>'}
      </div>

      ${elsewhere.length ? `<div class="assign-block">
        <div class="assign-label">在其他建筑 · 调入会先撤出原处</div>
        ${elsewhereRows}
      </div>` : ''}

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn" data-close-modal>关闭</button>
      </div>
    `);
  }

  const SKILL_LABEL_UI = { alchemy: '丹道', forging: '器道', trade: '商道', leadership: '御人' };

  // =========================================================
  //  操作
  // =========================================================
  function doBuy(index) {
    const st = S.state.data;
    const r = S.systems.auction.buy(st, index);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  function doRecruit(id) {
    const st = S.state.data;
    const r = S.systems.week.recruit(st, id);
    UI.toast(r.msg, r.ok ? 'ok' : 'err');
    if (r.ok) S.state.save(true);
    render(true);
  }

  // =========================================================
  //  离线报告
  // =========================================================
  function showOfflineReport(off) {
    const lines = off.highlights.length
      ? off.highlights.map((e) => `<div class="rline ${e.kind}">
          <span class="rk">${UI.KIND_ICON[e.kind] || '·'}</span>
          <span>${UI.esc(e.text)}</span>
        </div>`).join('')
      : '<div class="rline info"><span class="rk">·</span><span>宗门平静无事。</span></div>';

    const delta = [];
    if (off.discipleDelta > 0) delta.push(`弟子 +${off.discipleDelta}`);
    if (off.discipleDelta < 0) delta.push(`弟子 ${off.discipleDelta}`);
    if (off.levelDelta > 0) delta.push(`宗门升了 ${off.levelDelta} 级`);

    openModal(`
      <div class="offline-head">
        <div class="offline-icon">归</div>
        <div class="grow">
          <div class="detail-name">你离开了 ${S.time.describeGap(off.gapMs)}</div>
          <div class="detail-sub">
            宗门自行运转了 <b style="color:var(--jade)">${off.weeks}</b> 年
            （第 ${off.weekFrom} — ${off.weekTo}年）
            ${delta.length ? ' · ' + delta.join(' · ') : ''}
          </div>
        </div>
      </div>

      <div class="tiny mute" style="margin-bottom:6px">期间的要事</div>
      <div style="max-height:44vh;overflow-y:auto;margin:0 -6px;padding:0 6px">${lines}</div>

      <div class="tiny mute mt">
        离线时的宗门运转效率为 ${Math.round(S.time.OFFLINE_EFF * 100)}%，
        单次最多补算 ${S.time.OFFLINE_CAP}年。
      </div>

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn btn-primary" data-close-modal>回山</button>
      </div>
    `);
  }

  // =========================================================
  //  大事件
  // =========================================================
  /** 按选项规则自动挑出战的人 */
  function pickSent(st, opt) {
    const pool = st.disciples.filter((d) => d.injureWeeks === 0 && !d.missionId);
    if (opt.top) {
      return pool
        .slice()
        .sort((a, b) => D.power(b) - D.power(a))
        .slice(0, opt.top)
        .map((d) => d.id);
    }
    if (opt.full) return pool.map((d) => d.id);
    return [];
  }

  function openWorldEvent() {
    const st = S.state.data;
    const p = st.world && st.world.pending;
    if (!p) return;

    const def = p.def;
    const isMain = p.kind === 'mainline';
    const need = S.systems.worldevent.eventPower(st, def);
    const b = S.systems.worldevent.bonus(st);

    const optRows = (def.options || []).map((opt) => {
      const sent = pickSent(st, opt);
      let power = 0;
      for (const id of sent) {
        const d = S.state.discipleById(id);
        if (d) power += D.power(d);
      }
      if (opt.kind === 'battle' && isMain) power *= b.vsDemon || 1;

      let est = '';
      if (opt.kind === 'battle') {
        const ratio = need > 0 ? power / need : 1;
        const chance = Math.min(96, Math.max(12, Math.round((0.3 + ratio * 0.62) * 100)));
        est = `预计战力 ${Math.round(power)} / 需 ${Math.round(need)} · 胜算约 ${chance}%`;
      } else if (opt.kind === 'spend') {
        const cost = typeof opt.cost === 'function' ? opt.cost(st) : opt.cost;
        est = `花费 ${cost} 灵石`;
      } else {
        est = '不出人';
      }

      return `<div class="we-opt">
        <div class="grow">
          <div class="small" style="color:var(--text)">${UI.esc(opt.text)}</div>
          <div class="tiny mute">${UI.esc(opt.hint || '')}</div>
          <div class="tiny" style="color:var(--gold);margin-top:2px">${UI.esc(est)}</div>
        </div>
        <button class="btn btn-sm ${opt.kind === 'battle' ? 'btn-gold' : ''}"
          data-we-choose="${opt.id}">${opt.text}</button>
      </div>`;
    }).join('');

    openModal(`
      <div class="we-head ${isMain ? 'main' : ''}">
        <div class="we-icon">${UI.esc(def.icon || '事')}</div>
        <div class="grow">
          <div class="detail-name">${UI.esc(def.name)}</div>
          <div class="detail-sub">${isMain ? '魔劫 · 主线' : '宗门大事'} · 第 ${st.week - 1} 年</div>
        </div>
      </div>

      <div class="small" style="line-height:1.75;color:var(--text-dim);margin-bottom:8px">
        ${UI.esc(def.detail || def.desc)}
      </div>
      ${def.hint ? `<div class="tiny" style="color:var(--purple);margin-bottom:10px">${UI.esc(def.hint)}</div>` : ''}

      ${isMain ? `<div class="tiny mute" style="margin-bottom:8px">
        这一战输了也不会垮——只是会留下些后患，撑到下一次就好。
      </div>` : ''}

      <div class="assign-label" style="margin-top:12px">如何应对</div>
      ${optRows}

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn btn-sm btn-ghost" data-close-modal>先放着</button>
      </div>
    `);
  }

  function doWorldEventChoose(optId) {
    const st = S.state.data;
    const p = st.world && st.world.pending;
    if (!p) return;
    const opt = (p.def.options || []).find((o) => o.id === optId);
    if (!opt) return;

    const sent = pickSent(st, opt);
    const r = S.systems.worldevent.resolve(st, optId, sent);
    if (!r.ok) {
      UI.toast(r.msg, 'err');
      return;
    }
    S.state.save(true);
    render(true);
    showWorldEventResult(r);
  }

  function showWorldEventResult(r) {
    const gains = r.gains || {};
    const bits = [];
    if (gains.rep) bits.push(`声望 ${gains.rep > 0 ? '+' : ''}${gains.rep}`);
    if (gains.stones) bits.push(`灵石 ${gains.stones > 0 ? '+' : ''}${gains.stones}`);
    if (gains.array) bits.push(`阵法「${gains.array}」`);
    if (gains.treasure) bits.push(`灵宝「${gains.treasure}」`);
    if (gains.deaths) bits.push(`折损 ${gains.deaths} 人`);

    openModal(`
      <div class="we-head ${r.win ? 'win' : 'lose'}">
        <div class="we-icon">${r.win ? '胜' : '负'}</div>
        <div class="grow">
          <div class="detail-name">${UI.esc(r.name)} · ${r.win ? '守住了' : '没守住'}</div>
          <div class="detail-sub">${r.kind === 'mainline' ? '魔劫' : '宗门大事'}</div>
        </div>
      </div>

      ${r.lines.map((t) => `<div class="rline info"><span class="rk">·</span><span>${UI.esc(t)}</span></div>`).join('')}

      ${bits.length ? `<div class="tiny" style="color:var(--gold);margin-top:10px">${UI.esc(bits.join(' · '))}</div>` : ''}

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn btn-primary" data-close-modal>知道了</button>
      </div>
    `);
  }

  // =========================================================
  //  弟子详情
  // =========================================================
  function openDisciple(id) {
    const st = S.state.data;
    const d = S.state.discipleById(id);
    if (!d) return;

    const pr = UI.progressOf(d);
    const terms = D.termList(d);

    const termRows = terms.map((t) => {
      const r = S.terms.RARITY[t.rarity];
      const kindTxt = t.kind === 'good' ? '吉' : t.kind === 'bad' ? '凶' : '平';
      const eff = describeEffects(t);
      return `<div class="row" style="align-items:flex-start;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.05)">
        <span class="term ${r.cls} ${t.kind}" style="flex-shrink:0">${UI.esc(t.name)}<span class="t-kind">${kindTxt}</span></span>
        <div class="grow">
          <div class="small dim">${UI.esc(t.desc)}</div>
          ${eff ? `<div class="tiny" style="color:var(--jade);margin-top:2px">${eff}</div>` : ''}
        </div>
      </div>`;
    }).join('') || '<div class="mute small">无词条</div>';

    // 认主之物：跟着这个人走，别人拿不走，人没了也就没了
    const relics = D.relicList(d);
    const relicRows = relics.length ? relics.map((r) => {
      const eff = describeEffects(r);
      return `<div class="row" style="align-items:flex-start;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.05)">
        <span class="chip gold" style="flex-shrink:0">${UI.esc(r.name)}</span>
        <div class="grow">
          <div class="small dim">${UI.esc(r.desc)}</div>
          ${eff ? `<div class="tiny" style="color:var(--jade);margin-top:2px">${eff}</div>` : ''}
          <div class="tiny mute" style="margin-top:2px">认主 · 他人不可用</div>
        </div>
      </div>`;
    }).join('') : '';

    const rels = S.relations.summary(d);
    const bondHtml = rels.length ? rels.map(({ other, score, label }) =>
      `<span class="rel ${label.cls}" title="好感 ${Math.round(score)}">` +
      `${UI.esc(other.name)}<b>${label.name}</b></span>`
    ).join('') : '<span class="mute small">与同门没什么来往</span>';

    const lover = d.loverId ? S.state.discipleById(d.loverId) : null;

    const hist = d.history.slice(-10).reverse().map((h) =>
      `<div class="hist"><span class="w">第${h.week}年</span> · ${UI.esc(h.text)}</div>`
    ).join('') || '<div class="mute small">暂无记录</div>';

    // 近况：从年报里撤下来的日常
    const recentList = (d.recent || []).slice().reverse().slice(0, 12);
    const recentHtml = recentList.length
      ? recentList.map((r) =>
          `<div class="hist"><span class="w">第${r.week}年</span> · ${UI.esc(r.text)}</div>`
        ).join('')
      : '<div class="mute small">还没有什么日常记录。</div>';

    const loveTarget = d.loveTarget ? S.state.discipleById(d.loveTarget) : null;

    openModal(`
      <div class="detail-head">
        <div class="avatar ${d.gender}">${UI.esc(d.name.charAt(0))}</div>
        <div class="grow">
          <div class="detail-name">${UI.esc(d.name)}</div>
          <div class="detail-sub">
            ${UI.esc(S.realm.realmName(d.realm))} · ${d.age} / ${S.disciple.lifespanOf(d)}岁 ·
            ${d.gender === 'm' ? '男' : '女'} · 入宗第 ${st.week - d.joinWeek}年
            ${d.titles.length ? ' · ' + d.titles.map(UI.esc).join('、') : ''}
          </div>
        </div>
        <button class="btn btn-sm btn-ghost" data-close-modal>关闭</button>
      </div>

      <div class="kv">
        <div class="kv-item"><div class="kv-label">战力</div><div class="kv-value g">${D.power(d)}</div></div>
        <div class="kv-item"><div class="kv-label">贡献点</div><div class="kv-value">${d.contribution}</div></div>
        <div class="kv-item"><div class="kv-label">忠诚</div><div class="kv-value">${Math.round(d.loyalty)}</div></div>
        <div class="kv-item"><div class="kv-label">心情</div><div class="kv-value">${Math.round(d.mood)}</div></div>
      </div>

      <div class="mt">
        <div class="row-between" style="margin-bottom:4px">
          <span class="tiny mute">修为进度</span>
          <span class="tiny mute">${Math.round(pr.cur)} / ${pr.need}</span>
        </div>
        <div class="bar"><i style="width:${pr.pct.toFixed(1)}%"></i></div>
      </div>

      <div class="mt">
        <div class="kv">
          <div class="kv-item"><div class="kv-label">资质</div><div class="kv-value j">${d.tianfu}</div></div>
          <div class="kv-item"><div class="kv-label">悟性</div><div class="kv-value j">${d.wuxing}</div></div>
          <div class="kv-item"><div class="kv-label">道心</div><div class="kv-value j">${d.daoxin}</div></div>
          <div class="kv-item"><div class="kv-label">根骨</div><div class="kv-value j">${d.gengu}</div></div>
        </div>
      </div>

      <div class="mt">
        <div class="panel-title" style="font-size:13px;margin-bottom:6px">词条</div>
        ${termRows}
      </div>

      ${relicRows ? `<div class="mt">
        <div class="panel-title" style="font-size:13px;margin-bottom:6px">随身之物</div>
        ${relicRows}
      </div>` : ''}

      <div class="mt">
        <div class="panel-title" style="font-size:13px;margin-bottom:6px">人际</div>
        ${lover ? `<div class="small" style="color:var(--purple);margin-bottom:6px">
          道侣：${UI.esc(lover.name)}</div>` : ''}
        ${loveTarget && (!lover || lover.id !== loveTarget.id) ? `<div class="small" style="color:var(--purple);margin-bottom:6px">
          心中之人：${UI.esc(loveTarget.name)}（那个人受伤，${UI.esc(d.name)} 就练不进去功）</div>` : ''}
        <div class="wrap row" style="gap:6px">${bondHtml}</div>
      </div>

      <div class="mt">
        <div class="panel-title" style="font-size:13px;margin-bottom:6px">经历</div>
        ${hist}
      </div>

      <div class="mt">
        <div class="panel-title" style="font-size:13px;margin-bottom:6px">
          近况
          <span class="tiny mute" style="font-weight:400;letter-spacing:0">
            · 修炼、换药这类日常，不进年报，记在这里
          </span>
        </div>
        ${recentHtml}
      </div>

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn btn-danger btn-sm" data-modal-action="expel" data-id="${d.id}">逐出宗门</button>
      </div>
    `);
  }

  /** 把词条效果翻译成人话 */
  function describeEffects(t) {
    const e = t.effects || {};
    const out = [];
    if (e.growthMul !== undefined) out.push(`修炼效率 ${U.pct(e.growthMul - 1)}`);
    if (e.powerMul !== undefined) out.push(`战力 ${U.pct(e.powerMul - 1)}`);
    if (e.contributionMul !== undefined) out.push(`贡献获取 ${U.pct(e.contributionMul - 1)}`);
    if (e.lootMul !== undefined) out.push(`历练收获 ${U.pct(e.lootMul - 1)}`);
    if (e.injureMul !== undefined) out.push(`受伤概率 ${U.pct(e.injureMul - 1)}`);
    if (e.breakthroughAdd) out.push(`突破成功率 ${U.pct(e.breakthroughAdd)}`);
    if (e.loyaltyDrift) out.push(`每年忠诚 ${e.loyaltyDrift > 0 ? '+' : ''}${e.loyaltyDrift}`);
    if (e.growthByTier) out.push('成长曲线随境界变化');
    if (e.levyStones) out.push('兑换时会顺走灵石');
    if (e.skim) out.push('历练收获可能私吞');
    if (e.sickChance) out.push('每年可能旧疾发作');
    if (e.qiDevChance) out.push('修炼有走火入魔之险');
    if (e.curse) out.push('身边同门易遭横祸');
    if (e.pillDiscount) out.push(`丹药兑换 ${U.pct(-e.pillDiscount)} 花费`);
    return out.join(' · ');
  }

  // =========================================================
  //  指派任务
  // =========================================================
  function openAssign(missionId) {
    const st = S.state.data;
    const m = st.missions.find((x) => x.id === missionId);
    if (!m) return;

    const rows = st.disciples.map((d) => {
      const p = D.power(d);
      const ratio = p / Math.max(1, m.powerNeed);
      const risk = ratio >= 1.6 ? '稳' : ratio >= 1 ? '尚可' : ratio >= 0.7 ? '风险不小' : '送死';
      const color = ratio >= 1.6 ? 'var(--green)' : ratio >= 1 ? 'var(--jade)'
        : ratio >= 0.7 ? 'var(--gold)' : 'var(--red)';
      const busyTxt = d.injureWeeks > 0 ? `（养伤 ${d.injureWeeks}年）`
        : d.missionId ? '（手头有任务）' : '';
      return `<div class="row-between" style="padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.05)">
        <div>
          <div class="small" style="color:var(--text)">${UI.esc(d.name)}
            <span class="tiny mute">${UI.esc(S.realm.realmName(d.realm))} · 战力 ${p}</span></div>
          <div class="tiny mute">${busyTxt || '空闲'}</div>
        </div>
        <div class="row" style="gap:8px">
          <span class="tiny" style="color:${color}">${risk}</span>
          <button class="btn btn-sm" data-modal-action="assign"
            data-id="${d.id}" data-mid="${m.id}"
            ${(d.injureWeeks > 0 || d.missionId) ? 'disabled' : ''}>指派</button>
        </div>
      </div>`;
    }).join('') || '<div class="mute small">宗门里没有弟子。</div>';

    openModal(`
      <div class="panel-title" style="margin-bottom:4px">指派「${UI.esc(m.name)}」</div>
      <div class="small mute" style="margin-bottom:10px">
        建议战力 ${m.powerNeed}。被指派的弟子会在下一个结算年出发，无论成败。
      </div>
      ${rows}
      <div class="row mt" style="justify-content:flex-end">
        <button class="btn" data-close-modal>算了</button>
      </div>
    `);
  }

  // =========================================================
  //  弹窗
  // =========================================================
  function openModal(html) {
    $('modalCard').innerHTML = html;
    $('modal').classList.remove('hidden');
  }

  function closeModal() {
    $('modal').classList.add('hidden');
    $('modalCard').innerHTML = '';
  }

  function handleModalAction(action, data, el) {
    const st = S.state.data;
    if (action === 'relocate') {
      const r = S.systems.sect.relocate(st, data.loc);
      UI.toast(r.msg, r.ok ? 'ok' : 'err');
      if (r.ok) S.state.save(true);
      closeModal();
      render(true);
    } else if (action === 'assign-building') {
      // 从别处调人：第一次点击只把按钮变成「确认调入」，再点一次才真调
      if (data.force && el && el.dataset.confirmed !== '1') {
        el.dataset.confirmed = '1';
        el.dataset.orig = el.textContent;
        el.textContent = '确认调入';
        el.classList.remove('btn-ghost');
        el.classList.add('btn-danger');
        setTimeout(() => {
          if (el && el.isConnected) {
            el.dataset.confirmed = '';
            el.textContent = el.dataset.orig || '调入';
            el.classList.remove('btn-danger');
            el.classList.add('btn-ghost');
          }
        }, 3500);
        return;
      }
      const r = S.systems.building.assign(st, data.bid, data.id, {
        force: !!data.force,
      });
      UI.toast(r.msg, r.ok ? 'ok' : 'err');
      if (r.ok) {
        S.state.save(true);
        closeModal();
        render(true);
      }
    } else if (action === 'assign') {
      const r = S.systems.week.assign(st, data.id, data.mid);
      UI.toast(r.msg, r.ok ? 'ok' : 'err');
      closeModal();
      render(true);
    } else if (action === 'expel') {
      const r = S.systems.week.expel(st, data.id);
      UI.toast(r.msg, r.ok ? 'ok' : 'err');
      if (r.ok) S.state.save(true);
      closeModal();
      render(true);
    } else if (action === 'newgame') {
      closeModal();
      if (confirm('开一个新的宗门？当前进度会被覆盖。')) {
        S.state.clearSave();
        S.state.data = S.state.initNewGame();
        S.time.reset();
        S.state.data.lastSeen = Date.now();
        currentTab = 'overview';
        render();
        UI.toast('新的宗门已开山', 'ok');
      }
    } else if (action === 'export') {
      const txt = JSON.stringify(S.state.data);
      const blob = new Blob([txt], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `宗门存档_第${st.week}年.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('存档已导出', 'ok');
    } else if (action === 'togglepause') {
      const sp = S.time.togglePause();
      closeModal();
      UI.toast(sp === 0 ? '已暂停' : `继续 · ${sp} 倍速`, sp === 0 ? '' : 'ok');
    }
  }

  // =========================================================
  //  菜单
  // =========================================================
  function openMenu() {
    const st = S.state.data;
    const t = S.time.state;
    openModal(`
      <div class="panel-title" style="margin-bottom:12px">宗门事务</div>

      <div class="grid" style="gap:8px">
        <button class="btn" data-modal-action="togglepause" style="justify-content:flex-start">
          ${t.speed === 0 ? '继续运转' : '暂停宗门运转'}
        </button>
        <button class="btn" data-modal-action="export" style="justify-content:flex-start">导出存档 JSON</button>
        <button class="btn" data-modal-action="newgame" style="justify-content:flex-start">重新开山（覆盖当前进度）</button>
      </div>

      <div class="mt small dim" style="line-height:1.9">
        ${st.sect.name} · ${st.sect.level} 级 · 第 ${st.week}年<br>
        1 倍速一年约 ${Math.round(S.time.WEEK_MS / 1000)} 秒，可用右上角切换 1× / 2× / 4×。<br>
        空格键随时暂停。进度自动保存在浏览器本地。
      </div>

      <div class="row mt" style="justify-content:flex-end">
        <button class="btn" data-close-modal>关闭</button>
      </div>
    `);
  }

  // =========================================================
  document.addEventListener('DOMContentLoaded', boot);
})(window.Sect);
