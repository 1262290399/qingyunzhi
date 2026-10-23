/* 端到端测试：jsdom 真实加载 index.html，验证实时循环与倍速控制 */
const { JSDOM } = require('jsdom');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const file = path.join(__dirname, '..', 'index.html');
  const url = 'file:///' + file.replace(/\\/g, '/');

  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true, // 提供 requestAnimationFrame
    url,
  });

  const { window } = dom;
  const doc = window.document;
  const fail = [];
  const ok = (cond, msg) => {
    if (cond) console.log('✓ ' + msg);
    else { console.log('✗ ' + msg); fail.push(msg); }
  };

  await new Promise((res) => {
    if (doc.readyState === 'complete') return res();
    window.addEventListener('load', res);
    setTimeout(res, 5000);
  });
  await sleep(600);

  const S = window.Sect;
  const st = S.state.data;

  // ---------- 启动 ----------
  ok(!!S && !!S.time, 'Sect 与 time 模块已加载');
  ok(window.__errors.length === 0,
    '启动无脚本错误' + (window.__errors.length ? ': ' + window.__errors.join('; ') : ''));

  const view = doc.getElementById('view');
  ok(view && view.innerHTML.length > 500, `主视图已渲染（${view ? view.innerHTML.length : 0} 字符）`);

  // ---------- 实时控件存在 ----------
  ok(doc.querySelectorAll('.spbtn').length === 4, '四个倍速按钮存在');
  ok(!!doc.getElementById('weekFill'), '周进度条存在');
  ok(!!doc.getElementById('feedList'), '动态流容器存在');
  ok(!!doc.getElementById('weekLabel'), '周数标签存在');
  ok(doc.getElementById('btnAdvance') === null, '旧的「推进一周」按钮已移除');

  // ---------- 倍速点击 ----------
  const btn4 = doc.querySelector('.spbtn[data-speed="4"]');
  btn4.click();
  await sleep(30);
  ok(S.time.state.speed === 4, '点击 4× 生效');
  ok(btn4.classList.contains('active'), '4× 按钮高亮');
  ok(doc.getElementById('speedLabel').textContent.includes('4×'), '状态文字显示 4×');

  const btn0 = doc.querySelector('.spbtn[data-speed="0"]');
  btn0.click();
  await sleep(30);
  ok(S.time.state.speed === 0, '点击暂停生效');
  ok(doc.getElementById('speedLabel').textContent.includes('暂停'), '状态文字显示已暂停');
  ok(btn0.classList.contains('active'), '暂停按钮高亮');

  const btn1 = doc.querySelector('.spbtn[data-speed="1"]');
  btn1.click();
  await sleep(30);
  ok(S.time.state.speed === 1, '点击 1× 生效');

  // ---------- 空格暂停 ----------
  const spaceEvt = new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true });
  doc.dispatchEvent(spaceEvt);
  await sleep(30);
  ok(S.time.state.speed === 0, '空格键暂停');
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  await sleep(30);
  ok(S.time.state.speed === 1, '空格键恢复');

  // ---------- 时间自动推进一周 ----------
  T_resetAcc();
  function T_resetAcc() { S.time.state.acc = 0; }
  const w0 = st.week;
  S.time.state.acc = S.time.WEEK_MS - 50; // 只差一点点就到一周
  await sleep(600);
  ok(st.week > w0, `时间流逝自动推进周（${w0} → ${st.week}）`);

  // ---------- 动态流播报 ----------
  const feedList = doc.getElementById('feedList');
  const before = feedList.children.length;
  await sleep(1500); // 等播报队列吐出几条
  const after = feedList.children.length;
  ok(after > before, `动态流持续追加（${before} → ${after} 项）`);

  const feedHtml = feedList.innerHTML;
  ok(!feedHtml.includes('[object Object]'), '动态流无对象序列化残留');
  ok(!feedHtml.includes('undefined'), '动态流无 undefined');
  ok(feedList.querySelector('.feed-week') !== null, '动态流含周分隔');

  // 底部状态栏显示最新一条
  ok(doc.getElementById('statusRight').textContent.length > 0, '底部状态栏显示最新动态');

  // ---------- 手动结算 3 周，验证稳定 ----------
  for (let i = 0; i < 3; i++) {
    S.time.doWeek(st);
    await sleep(150);
  }
  ok(window.__errors.length === 0,
    '连续结算 3 周无错误' + (window.__errors.length ? ': ' + window.__errors.join('; ') : ''));

  // ---------- 标签切换 ----------
  for (const t of ['disciples', 'missions', 'warehouse', 'auction', 'recruit', 'sect', 'jianghu', 'reports', 'overview']) {
    const tab = doc.querySelector(`[data-tab="${t}"]`);
    tab.click();
    await sleep(50);
    const html = view.innerHTML;
    const bad = [];
    if (html.length < 200) bad.push('内容过少');
    if (html.includes('undefined')) bad.push('含 undefined');
    if (html.includes('[object Object]')) bad.push('含 [object Object]');
    if (html.includes('NaN')) bad.push('含 NaN');
    ok(bad.length === 0, `标签「${t}」渲染正常（${html.length} 字符）` + (bad.length ? ' — ' + bad.join(',') : ''));
  }

  // ---------- 收徒 ----------
  doc.querySelector('[data-tab="recruit"]').click();
  await sleep(50);
  const recruitBtn = view.querySelector('[data-recruit]');
  if (recruitBtn) {
    const n0 = st.disciples.length;
    recruitBtn.click();
    await sleep(60);
    ok(st.disciples.length === n0 + 1, `收徒成功（${n0} → ${st.disciples.length}）`);
  } else {
    console.log('· 无候选者，跳过收徒');
  }

  // ---------- 拍卖行 ----------
  doc.querySelector('[data-tab="auction"]').click();
  await sleep(50);
  const buyBtn = view.querySelector('[data-buy]');
  if (buyBtn) {
    const s0 = st.sect.spiritStones;
    buyBtn.click();
    await sleep(60);
    ok(st.sect.spiritStones < s0, '拍卖行购买扣灵石');
  } else {
    console.log('· 无可买商品，跳过购买');
  }

  // ---------- 弟子详情 ----------
  doc.querySelector('[data-tab="disciples"]').click();
  await sleep(50);
  const dcard = view.querySelector('[data-disciple]');
  if (dcard) {
    dcard.click();
    await sleep(60);
    ok(doc.getElementById('modalCard').innerHTML.includes('词条'), '弟子详情含词条区');
    doc.querySelector('#modal [data-close-modal]').click();
    await sleep(30);
  }

  // ---------- 离线报告 ----------
  const st2 = S.state.data;
  st2.lastSeen = Date.now() - 15 * 60 * 1000; // 离开 15 分钟
  const wBefore = st2.week;
  const off = S.time.offlineSettle(st2);
  ok(!!off && off.weeks > 0, `离线结算补算 ${off && off.weeks} 周`);
  ok(st2.week > wBefore, `离线后周数推进（${wBefore} → ${st2.week}）`);

  // ---------- 宗门面板与建筑 ----------
  doc.querySelector('[data-tab="sect"]').click();
  await sleep(80);
  const sc = view.innerHTML;
  ok(sc.includes('宗门建筑'), '宗门面板含建筑区块');
  ok(sc.includes('门内序列'), '宗门面板含身份区块');
  ok(sc.includes('宗门大比'), '宗门面板显示大比信息');
  ok(sc.includes('一键派遣'), '宗门面板有「一键派遣」按钮');

  const buildBtn = view.querySelector('[data-build]');
  if (buildBtn) {
    const stones0 = st.sect.spiritStones;
    buildBtn.click();
    await sleep(100);
    ok(st.sect.spiritStones < stones0, '建造建筑扣除灵石');
    const builtNow = Object.keys(st.buildings).filter((k) => st.buildings[k].level > 0);
    ok(builtNow.length >= 1, `已建成建筑 ${builtNow.length} 处`);
  } else {
    console.log('· 没有可建造的建筑（灵石不足或已全建）');
  }

  // 入驻
  const assignBtn = view.querySelector('[data-bassign]');
  if (assignBtn) {
    assignBtn.click();
    await sleep(100);
    const card = doc.getElementById('modalCard');
    const cardHtml = card.innerHTML;
    ok(cardHtml.includes('已入驻'), '入驻弹窗有「已入驻」区块');
    ok(cardHtml.includes('空闲弟子') || cardHtml.includes('没有空闲的人'),
      '入驻弹窗有「空闲弟子」区块');

    const pick = card.querySelector('[data-modal-action="assign-building"]:not([disabled])');
    if (pick) {
      pick.click();
      await sleep(100);
      const occupied = Object.values(st.buildings).some((b) => b.occupants.length > 0);
      ok(occupied, '有弟子入驻了建筑');
      ok(window.__errors.length === 0, '建筑入驻无脚本错误');

      // 再打开一次，此时应能看到已入驻的人
      const stx = S.state.data;
      // 造两个各有一人的建筑，才测得到「调岗」
      const ensureBuilt = (bid) => {
        if (!S.systems.building.isBuilt(stx, bid)) {
          stx.sect.spiritStones = Math.max(stx.sect.spiritStones, 4000);
          S.systems.building.build(stx, bid);
        }
      };
      ensureBuilt('danfang');
      ensureBuilt('qige');
      const freeOnes = stx.disciples.filter((d) => !d.homeBuilding && !d.missionId);
      if (freeOnes[0] && !S.systems.building.occupantsOf(stx, 'danfang').length) {
        S.systems.building.assign(stx, 'danfang', freeOnes[0].id);
      }
      if (freeOnes[1] && !S.systems.building.occupantsOf(stx, 'qige').length) {
        S.systems.building.assign(stx, 'qige', freeOnes[1].id);
      }
      // 重新渲染以反映上面直接改的数据
      doc.querySelector('[data-tab="disciples"]').click();
      await sleep(40);
      doc.querySelector('[data-tab="sect"]').click();
      await sleep(60);

      const qigeBtn = view.querySelector('[data-bassign="qige"]');
      if (qigeBtn && !qigeBtn.disabled) {
        qigeBtn.click();
        await sleep(100);
        const h2 = doc.getElementById('modalCard').innerHTML;
        ok(h2.includes('已入驻'), '弹窗列出当前建筑已入驻的人');
        ok(h2.includes('在其他建筑'), '弹窗列出其他建筑的人');

        // 调岗：二次确认
        const moveBtn = doc.getElementById('modalCard')
          .querySelector('[data-force="1"]:not([disabled])');
        if (moveBtn) {
          const did = moveBtn.dataset.id;
          const bid = moveBtn.dataset.bid;
          const d0 = stx.disciples.find((x) => x.id === did);
          const at0 = d0 ? d0.homeBuilding : null;

          moveBtn.click();
          await sleep(80);
          ok(moveBtn.textContent.includes('确认'), '第一次点击变成「确认调入」');
          const movedYet = stx.disciples.find((x) => x.id === did).homeBuilding;
          ok(movedYet === at0, '确认前没有真的把人调走');

          moveBtn.click();
          await sleep(120);
          const d1 = stx.disciples.find((x) => x.id === did);
          ok(d1.homeBuilding === bid, `确认后调岗成功（${at0} → ${bid}）`);
          ok(window.__errors.length === 0, '调岗无脚本错误');
        } else {
          console.log('· 弹窗里没有可调岗的人');
          const closer = doc.querySelector('#modal [data-close-modal]');
          if (closer) closer.click();
        }
      } else {
        console.log('· 器阁没有可用名额，跳过调岗测试');
        const closer = doc.querySelector('#modal [data-close-modal]');
        if (closer) closer.click();
      }
    } else {
      console.log('· 没有符合身份要求的弟子可入驻');
      const closer = doc.querySelector('#modal [data-close-modal]');
      if (closer) closer.click();
    }
  }

  // ---------- 多周结算后检查关系与江湖 ----------
  for (let i = 0; i < 18; i++) S.time.doWeek(st);
  const relCount = st.disciples.reduce((n, d) => n + Object.keys(d.bonds || {}).length, 0);
  ok(relCount > 0, `18 周后形成弟子关系 ${relCount} 条`);
  const npcKnown = S.systems.npc.known(st);
  ok(npcKnown.length > 0, `结识江湖人物 ${npcKnown.length} 位`);

  doc.querySelector('[data-tab="jianghu"]').click();
  await sleep(60);
  const jh = view.innerHTML;
  ok(jh.includes('江湖人物'), '江湖面板有「江湖人物」区块');
  ok(jh.includes('宗门内部'), '江湖面板有「宗门内部」关系区');
  ok(!jh.includes('undefined') && !jh.includes('[object Object]'), '江湖面板无脏数据');

  // 弟子详情应显示关系标签
  doc.querySelector('[data-tab="disciples"]').click();
  await sleep(60);
  const dc2 = view.querySelector('[data-disciple]');
  if (dc2) {
    dc2.click();
    await sleep(80);
    const mh2 = doc.getElementById('modalCard').innerHTML;
    ok(mh2.includes('人际'), '弟子详情含人际区');
    ok(/rel-/.test(mh2), '弟子详情含关系状态标签');
    ok(mh2.includes('近况'), '弟子详情含「近况」区（日常记录搬到这儿）');
    const someoneRecent = st.disciples.find((x) => (x.recent || []).length > 0);
    ok(someoneRecent ? mh2.includes('第') : true, '近况里有带周数的记录');
    doc.querySelector('#modal [data-close-modal]').click();
    await sleep(30);
  }

  // 周报含叙事体
  doc.querySelector('[data-tab="reports"]').click();
  await sleep(60);
  const rp = view.innerHTML;
  const longest = Math.max(...Array.from(rp.matchAll(/>([^<>]{40,})</g)).map((m) => m[1].length), 0);
  ok(longest > 40, `周报含叙事体长句（最长 ${longest} 字）`);

  // ---------- 一键派遣（放最后，免得把别的测试要用的空位占满） ----------
  {
    const stx = S.state.data;
    // 先腾出一个空位
    const busyB = Object.keys(stx.buildings).find(
      (k) => stx.buildings[k].level > 0 && stx.buildings[k].occupants.length > 0
    );
    if (busyB) {
      S.systems.building.remove(stx, busyB, stx.buildings[busyB].occupants[0]);
    }
    doc.querySelector('[data-tab="disciples"]').click();
    await sleep(40);
    doc.querySelector('[data-tab="sect"]').click();
    await sleep(60);

    const af = view.querySelector('[data-autofill]');
    if (af && !af.disabled) {
      const occBefore = Object.values(stx.buildings).reduce((n, b) => n + b.occupants.length, 0);
      af.click();
      await sleep(150);
      const occAfter = Object.values(stx.buildings).reduce((n, b) => n + b.occupants.length, 0);
      ok(occAfter > occBefore, `一键派遣把 ${occAfter - occBefore} 人派了进去`);
      ok(window.__errors.length === 0, '一键派遣无脚本错误');
    } else {
      console.log('· 一键派遣按钮不可用，跳过');
    }
  }

  // ---------- 汇总 ----------
  ok(window.__errors.length === 0,
    '整轮测试无脚本错误' + (window.__errors.length ? ': ' + window.__errors.join('; ') : ''));

  dom.window.close();
  console.log('\n' + (fail.length ? `${fail.length} 项失败` : '端到端测试全部通过'));
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error('测试脚本异常:', e);
  process.exit(1);
});
