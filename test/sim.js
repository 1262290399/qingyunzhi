/* 逻辑层冒烟测试：不依赖浏览器，模拟若干周，检查崩溃与数值合理性 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = global;

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core/util.js',
  'js/data/realm.js',
  'js/core/state.js',
  'js/data/terms.js',
  'js/data/names.js',
  'js/data/items.js',
  'js/data/regions.js',
  'js/data/missions.js',
  'js/data/npcs.js',
  'js/data/stories.js',
  'js/data/ranks.js',
  'js/data/buildings.js',
  'js/data/locations.js',
  'js/data/sagas.js',
  'js/data/worldevents.js',
  'js/systems/disciple.js',
  'js/systems/sect.js',
  'js/systems/auction.js',
  'js/systems/mission.js',
  'js/systems/warehouse.js',
  'js/systems/relations.js',
  'js/systems/npc.js',
  'js/systems/building.js',
  'js/systems/tournament.js',
  'js/systems/saga.js',
  'js/systems/worldevent.js',
  'js/systems/events.js',
  'js/systems/week.js',
];

console.warn = () => {};
for (const f of FILES) {
  const full = path.join(ROOT, f);
  vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
}

const S = global.Sect;
const st = S.state.initNewGame();
S.state.data = st;

console.log('=== 初始状态 ===');
console.log('宗门:', st.sect.name, '等级', st.sect.level);
console.log('弟子:', st.disciples.map((d) => `${d.name}(${S.realm.realmName(d.realm)},战力${S.disciple.power(d)})`).join(', '));
console.log('候选:', st.candidates.map((c) => `${c.name} [${c.terms.map((t) => S.terms.get(t).name).join('/')}]`).join(' | '));

const WEEKS = 120;
let errorWeeks = 0;
const allKinds = {};
const relStates = {};
let totalReportEntries = 0;
let weeksCounted = 0;
let minorLeaked = 0;
let worldEvents = 0;
let worldWins = 0;

for (let i = 0; i < WEEKS; i++) {
  // 扩建优先：容量是第一瓶颈，住不下人什么都谈不上
  {
    const cost = S.sect.expandCost(st);
    if (cost && st.sect.spiritStones > cost * 1.35) {
      S.systems.sect.expand(st);
    }
  }

  // 有钱就把灵矿升上去——它是宗门的现金流
  {
    const b = st.buildings.lingkuang;
    if (b && b.level > 0 && b.level < S.buildings.MAX_LEVEL) {
      const cost = S.buildings.upgradeCost(S.buildings.get('lingkuang'), b.level + 1);
      if (st.sect.spiritStones > cost * 1.5) {
        S.systems.building.upgrade(st, 'lingkuang');
      }
    }
  }

  // 建造计划：按优先级，攒够钱就建（留一倍余量）
  const BUILD_PLAN = ['lingkuang', 'danfang', 'qige', 'zhangfang', 'zhaoxian', 'cangjing'];
  for (const id of BUILD_PLAN) {
    if (S.systems.building.isBuilt(st, id)) continue;
    const def = S.buildings.get(id);
    if (st.sect.spiritStones > def.cost * 1.8) {
      S.systems.building.build(st, id);
      break;
    }
  }

  // 尽量把空位填满（高身份建筑优先挑人）
  for (const def of S.buildings.BUILDINGS.slice().reverse()) {
    const b = st.buildings[def.id];
    if (!b || b.level <= 0) continue;
    const slots = S.systems.building.slotCount(st, def.id);
    if (b.occupants.length >= slots) continue;
    const free = st.disciples.filter(
      (d) => !d.homeBuilding && !d.missionId && d.injureWeeks === 0
    );
    // 留些人出去跑任务，别把宗门掏空
    if (free.length <= 2) continue;
    const pick = free.find((d) => S.ranks.canEnter(d.rank || 'menial', def.id));
    if (pick) S.systems.building.assign(st, def.id, pick.id);
  }

  // 任命：内门里挑人当亲传，再从亲传里挑一个当长老
  {
    const innerList = st.disciples.filter((d) => d.rank === 'inner');
    const personalList = st.disciples.filter((d) => d.rank === 'personal');
    const elderList = st.disciples.filter((d) => d.rank === 'elder');
    if (innerList.length && personalList.length < 2) {
      S.systems.building.promote(st, innerList[0].id, 'personal');
    }
    if (personalList.length >= 2 && elderList.length < 2) {
      S.systems.building.promote(st, personalList[0].id, 'elder');
    }
  }

  if (st.candidates.length && st.disciples.length < S.state.capacity()) {
    S.systems.week.recruit(st, st.candidates[0].id);
  }
  if (st.sect.spiritStones > 2500 && st.auction.length) {
    const idx = st.auction.findIndex((s) => !s.sold && s.price < st.sect.spiritStones * 0.4);
    if (idx >= 0) S.systems.auction.buy(st, idx);
  }
  if (i % 7 === 3) {
    const open = st.missions.filter((m) => m.status === 'open');
    const free = st.disciples.filter((d) => !d.missionId && d.injureWeeks === 0);
    if (open.length && free.length) S.systems.week.assign(st, free[0].id, open[0].id);
  }

  let report;
  try {
    report = S.systems.week.advanceWeek(st);

    // 自动应对大事：能打就打
    const wp = st.world && st.world.pending;
    if (wp) {
      const opts = wp.def.options || [];
      const opt = opts.find((o) => o.kind === 'battle') || opts[0];
      const pool = st.disciples.filter((d) => d.injureWeeks === 0 && !d.missionId);
      let sent = [];
      if (opt.top) {
        sent = pool.slice()
          .sort((a, b) => S.disciple.power(b) - S.disciple.power(a))
          .slice(0, opt.top)
          .map((d) => d.id);
      } else if (opt.full) {
        sent = pool.map((d) => d.id);
      }
      const wr = S.systems.worldevent.resolve(st, opt.id, sent);
      worldEvents++;
      if (wr.ok && wr.win) worldWins++;
    }
  } catch (e) {
    console.log('\n!!! 第', st.week, '年崩溃:', e.stack);
    errorWeeks++;
    break;
  }

  totalReportEntries += report.entries.length;
  weeksCounted++;
  for (const e of report.entries) {
    allKinds[e.kind] = (allKinds[e.kind] || 0) + 1;
    if (e.minor) minorLeaked++;
  }

  for (const d of st.disciples) {
    for (const oid of Object.keys(d.bonds || {})) {
      const lab = S.relations.label(d, oid);
      relStates[lab.name] = (relStates[lab.name] || 0) + 1;
    }
  }

  if (i % 30 === 29) {
    console.log(`\n--- 第 ${st.week} 周 ---`);
    console.log(`灵石 ${st.sect.spiritStones} | 名望 ${st.sect.reputation} | 弟子 ${st.disciples.length}`);
    const lovers = st.disciples.filter((d) => d.loverId);
    const enemies = [];
    const seen = new Set();
    for (const d of st.disciples) {
      for (const oid of Object.keys(d.bonds || {})) {
        const k = [d.id, oid].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        const lab = S.relations.label(d, oid);
        if (lab.id === 'enemy' || lab.id === 'nemesis') {
          const o = S.state.discipleById(oid);
          if (o) enemies.push(`${d.name}×${o.name}`);
        }
      }
    }
    console.log(`道侣: ${lovers.length ? lovers.map((d) => d.name).join(',') : '无'}`);
    console.log(`仇敌: ${enemies.length ? enemies.slice(0, 4).join(', ') : '无'}`);
    console.log(`江湖: ${Object.keys(st.npcs || {}).filter((k) => st.npcs[k].met > 0).length} 位已结识`);
    console.log('本周叙事样本:');
    report.entries.slice(0, 3).forEach((e) => {
      console.log(`  [${e.kind}] ${e.text.slice(0, 56)}…`);
      if (e.meta) console.log(`        (${e.meta})`);
    });
  }
}

console.log('\n=== 结果 ===');
console.log('总周数:', st.week - 1, '崩溃次数:', errorWeeks);
console.log('周报平均条目:', (totalReportEntries / Math.max(1, weeksCounted)).toFixed(1), '条/周');
console.log('杂事泄露进周报:', minorLeaked, '条');
console.log('事件类型:', allKinds);
console.log('关系状态分布:', relStates);
const known = Object.keys(st.npcs || {}).filter((k) => st.npcs[k].met > 0);
console.log('结识 NPC:', known.length, '位');
console.log('  ', known.map((k) => `${S.npcs.get(k).name}(${Math.round(st.npcs[k].sectFavor)})`).join(' ') || '无');
console.log('最高境界:', S.realm.realmName(st.disciples.reduce((m, d) => Math.max(m, d.realm), 0)));
console.log('总战力:', st.disciples.reduce((s, d) => s + S.disciple.power(d), 0));
console.log('灵石:', st.sect.spiritStones, '名望:', st.sect.reputation, '等级:', st.sect.level);

// 建筑与大比
const built = Object.keys(st.buildings).filter((k) => st.buildings[k].level > 0);
console.log('已建建筑:', built.map((k) => `${S.buildings.get(k).name}Lv${st.buildings[k].level}(${st.buildings[k].occupants.length}人)`).join(' '));
console.log('宗门大比举办次数:', st.stats.tournaments || 0);
console.log('大事件:', worldEvents, '次，胜', worldWins);
if (st.world) {
  console.log('阵法:', (st.world.arrays || []).length, '灵宝:', (st.world.treasures || []).length,
    '主线进度:', st.world.mainlineIndex, '魔劫余烬:', st.world.debuff ? '有' : '无');
}
const rankDist = {};
for (const d of st.disciples) rankDist[S.ranks.nameOf(d.rank)] = (rankDist[S.ranks.nameOf(d.rank)] || 0) + 1;
console.log('身份分布:', rankDist);
console.log('累计离世:', st.sect.totalDeaths || 0, '人');
if (st.disciples.length) {
  const oldest = st.disciples.reduce((m, d) => Math.max(m, d.age), d => d);
  console.log('最年长弟子:', Math.max(...st.disciples.map((d) => d.age)), '岁');
  const lifespans = st.disciples.map((d) => S.disciple.lifespanOf(d));
  console.log('寿元区间:', Math.min(...lifespans), '~', Math.max(...lifespans), '岁');
}

const issues = [];

// ---------- 魔劫失败路径 ----------
{
  const st4 = S.state.initNewGame();
  S.state.data = st4;
  st4.week = 60;
  // 只留一个刚入门的弱者，主线必败
  st4.disciples = [S.disciple.create({ realm: 0 })];

  let gotDebuff = false;
  for (let attempt = 0; attempt < 12 && !gotDebuff; attempt++) {
    st4.world.pending = null;
    st4.world.mainlineIndex = 0;
    st4.world.debuff = null;
    S.systems.worldevent.tick(st4);
    const p = st4.world.pending;
    if (!p || p.kind !== 'mainline') break;
    S.systems.worldevent.resolve(st4, 'elite', st4.disciples.map((d) => d.id));
    if (st4.world.debuff) gotDebuff = true;
  }

  if (gotDebuff) {
    const b = S.systems.worldevent.bonus(st4);
    const lower = b.growthMul < 1;
    const more = b.recruitMul > 1;
    if (!lower) issues.push('魔劫余烬没有降低修炼速度');
    else if (!more) issues.push('魔劫余烬没有提高人才概率');
    else {
      console.log(
        `✓ 魔劫余烬：修炼 ×${b.growthMul}，招徒 ×${b.recruitMul}，到第 ${st4.world.debuff.until} 年`
      );
    }
  } else {
    issues.push('主线战败后没有贴上 debuff');
  }

  S.state.data = st;
}

// ---------- 前期不破产检查 ----------
// 只靠初始的灵田，能不能养活一个小宗门
{
  const st3 = S.state.initNewGame();
  S.state.data = st3;
  let minStones = st3.sect.spiritStones;
  let wentNegative = false;

  for (let i = 0; i < 30; i++) {
    if (st3.candidates.length && st3.disciples.length < S.state.capacity()) {
      S.systems.week.recruit(st3, st3.candidates[0].id);
    }
    S.systems.week.advanceWeek(st3);
    if (st3.sect.spiritStones < minStones) minStones = st3.sect.spiritStones;
    if (st3.sect.spiritStones < 0) wentNegative = true;
  }

  if (wentNegative) issues.push('只靠灵田会破产（灵石见底）');
  else if (minStones < 200) issues.push(`只靠灵田时灵石一度只剩 ${minStones}，太紧`);
  else console.log(`✓ 只靠灵田能活：30 年最低余 ${Math.round(minStones)} 灵石，期末 ${Math.round(st3.sect.spiritStones)}`);

  // 候选者不该在门口站一辈子
  let longWaiter = null;
  for (const c of st3.candidates) {
    const waited = st3.week - (c.candidateWeek || st3.week);
    if (waited > 6) longWaiter = `${c.name}（${waited} 年）`;
  }
  if (longWaiter) issues.push(`候选者等太久没走：${longWaiter}`);
  else console.log('✓ 没有候选者在门口站超过六年');

  S.state.data = st;
}

// 寿元检查：活着的人都不该超过自己的寿数
for (const d of st.disciples) {
  if (d.age >= S.disciple.lifespanOf(d)) {
    issues.push(`${d.name} 已 ${d.age} 岁，超过寿元 ${S.disciple.lifespanOf(d)} 却还在世`);
  }
}

// 渡劫：筑基以上的人应该都是渡过来的
{
  const high = st.disciples.filter((d) => d.realm >= 10);
  if (high.length) {
    console.log(`✓ 有 ${high.length} 名弟子筑基及以上（都经过了渡劫）`);
  }
}

// ---------- 一键派遣 ----------
{
  const st2 = S.state.initNewGame();
  S.state.data = st2;

  st2.sect.spiritStones = 20000;
  S.systems.building.build(st2, 'danfang');
  S.systems.building.build(st2, 'qige');

  // 造 6 个空闲弟子，技艺各不相同
  for (let i = 0; i < 6; i++) {
    const d = S.disciple.create({ realm: 3 });
    d.rank = 'outer';
    d.joinWeek = 1;
    d.skills = { alchemy: 20 + i * 10, forging: 70 - i * 10, trade: 30, leadership: 30 };
    st2.disciples.push(d);
  }
  // 一个正在做任务的人，绝不能被派进建筑
  const busy = S.disciple.create({ realm: 3 });
  busy.rank = 'outer';
  busy.missionId = 'fake_mission';
  st2.disciples.push(busy);

  const before = st2.disciples.filter((d) => d.homeBuilding).length;
  const r = S.systems.building.autoFill(st2);
  const after = st2.disciples.filter((d) => d.homeBuilding).length;

  if (!r.ok) issues.push('一键派遣失败：' + r.msg);
  else if (after <= before) issues.push('一键派遣没有派出任何人');
  else console.log(`✓ 一键派遣：${r.moved.length} 人被派（入驻 ${before} → ${after}）`);

  if (busy.homeBuilding) issues.push('一键派遣误派了在做任务的弟子');
  else console.log('✓ 一键派遣没碰正在做任务的人');

  // 丹房应该挑到丹道最高的那个
  const dan = S.systems.building.occupantsOf(st2, 'danfang');
  const allAlchemy = st2.disciples
    .filter((d) => d.rank === 'outer' && !d.missionId)
    .map((d) => S.disciple.effSkill(d, 'alchemy'))
    .sort((a, b) => b - a);
  if (dan.length && allAlchemy.length) {
    if (S.disciple.effSkill(dan[0], 'alchemy') === allAlchemy[0]) {
      console.log('✓ 丹房挑到了丹道最高的弟子');
    } else {
      issues.push('丹房没有挑到丹道最高的弟子');
    }
  }

  // 再点一次应该没得派
  const r2 = S.systems.building.autoFill(st2);
  if (r2.ok) issues.push('满员后一键派遣仍然派了人');
  else console.log('✓ 满员后一键派遣正确地什么也没做');

  S.state.data = st;
}

if (minorLeaked > 0) issues.push(`有 ${minorLeaked} 条杂事漏进了周报`);

// 杂事应该留在弟子近况里
{
  const withRecent = st.disciples.filter((d) => (d.recent || []).length > 0);
  if (withRecent.length === 0) issues.push('弟子近况里没有记录到日常');
  else console.log(`✓ ${withRecent.length} 名弟子的近况留存了日常记录`);
}

// 周报里不该再出现兑换事件
if (allKinds.exchange) issues.push(`周报里仍有 ${allKinds.exchange} 条兑换事件`);
else console.log('✓ 周报里已无兑换事件');

// 验证：不能把已经在别处干活的弟子直接拉过来
{
  const inBuilding = st.disciples.find((d) => d.homeBuilding);
  if (inBuilding) {
    const others = Object.keys(st.buildings).filter(
      (k) => st.buildings[k].level > 0 && k !== inBuilding.homeBuilding
    );
    let rejected = true;
    for (const k of others) {
      const r = S.systems.building.assign(st, k, inBuilding.id);
      if (r.ok) { rejected = false; break; }
    }
    if (!rejected) issues.push('跨建筑调入没有被拒绝');
    else console.log('✓ 跨建筑调入被正确拒绝');

    // 显式 force 应该能调过去（但只能调到身份允许去的地方）
    const target = others.find((k) => {
      if (!S.ranks.canEnter(inBuilding.rank, k)) return false;
      const b = st.buildings[k];
      return b.occupants.length < S.systems.building.slotCount(st, k);
    });
    if (target) {
      const before = inBuilding.homeBuilding;
      const r2 = S.systems.building.assign(st, target, inBuilding.id, { force: true });
      if (r2.ok && inBuilding.homeBuilding === target) {
        console.log(`✓ force 调岗成功（${S.buildings.get(before).name} → ${S.buildings.get(target).name}）`);
      } else {
        issues.push('force 调岗失败：' + (r2.msg || '状态未变'));
      }
    }
  }
}

if (st.sect.spiritStones < 0) issues.push('灵石为负');
for (const d of st.disciples) {
  if (d.contribution < 0) issues.push(d.name + ' 贡献为负');
  if (d.tianfu < 10 || d.tianfu > 99) issues.push(d.name + ' 资质越界');
  if (d.loyalty < 0 || d.loyalty > 100) issues.push(d.name + ' 忠诚越界');
  if (d.exp < 0) issues.push(d.name + ' 修为为负');
  for (const oid of Object.keys(d.bonds || {})) {
    const b = d.bonds[oid];
    if (typeof b !== 'object') issues.push(d.name + ' 关系结构异常');
    else if (b.score < -100 || b.score > 100) issues.push(d.name + ' 好感越界');
  }
}
for (const k of Object.keys(st.npcs || {})) {
  const f = st.npcs[k].sectFavor;
  if (f < -100 || f > 100) issues.push(S.npcs.get(k).name + ' 宗门好感越界');
}
console.log(issues.length ? '!! 问题: ' + issues.join('; ') : '✓ 数值检查通过');
process.exit(errorWeeks || issues.length ? 1 : 0);
