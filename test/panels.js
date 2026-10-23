/* UI 面板冒烟测试：只验证 HTML 字符串生成，不依赖真实 DOM */
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
  'js/core/time.js',
  'js/ui/render.js',
  'js/ui/panels.js',
];

global.document = {
  getElementById: () => ({ textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }),
  querySelector: () => ({ textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }),
  querySelectorAll: () => [],
  addEventListener: () => {},
};

console.warn = () => {};
for (const f of FILES) {
  const full = path.join(ROOT, f);
  vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
}

const S = global.Sect;
const st = S.state.initNewGame();
S.state.data = st;

for (let i = 0; i < 40; i++) {
  if (st.candidates.length && st.disciples.length < S.state.capacity()) {
    S.systems.week.recruit(st, st.candidates[0].id);
  }
  // 建两处建筑并派个人进去，好让宗门面板有内容
  if (i === 3) S.systems.building.build(st, 'danfang');
  if (i === 10) S.systems.building.build(st, 'qige');
  const free = st.disciples.filter((d) => !d.homeBuilding && !d.missionId);
  if (free.length > 2) {
    for (const bid of ['danfang', 'qige']) {
      const b = st.buildings[bid];
      if (!b || b.level <= 0) continue;
      if (b.occupants.length >= S.systems.building.slotCount(st, bid)) continue;
      const pick = free.find((d) => S.ranks.canEnter(d.rank || 'menial', bid));
      if (pick) S.systems.building.assign(st, bid, pick.id);
    }
  }
  S.systems.week.advanceWeek(st);
}
S.systems.auction.buy(st, 0);

const PANELS = ['overview', 'disciples', 'missions', 'warehouse', 'auction', 'recruit', 'sect', 'jianghu', 'reports'];
let fail = 0;

for (const name of PANELS) {
  let html;
  try {
    html = S.panels[name](st);
  } catch (e) {
    console.log(`✗ ${name} 抛异常: ${e.message}`);
    const line = (e.stack || '').split('\n')[1] || '';
    console.log('   ' + line.trim());
    fail++;
    continue;
  }
  const issues = [];
  if (!html || html.length < 40) issues.push('输出过短');
  if (html.includes('undefined')) {
    const m = html.match(/.{0,50}undefined.{0,50}/);
    issues.push('含 undefined: …' + m[0] + '…');
  }
  if (html.includes('[object Object]')) {
    const m = html.match(/.{0,50}\[object Object\].{0,50}/);
    issues.push('含 [object Object]: …' + m[0] + '…');
  }
  if (html.includes('NaN')) issues.push('含 NaN');
  const open = (html.match(/<div/g) || []).length;
  const close = (html.match(/<\/div>/g) || []).length;
  if (open !== close) issues.push(`div 标签不匹配 ${open}/${close}`);

  if (issues.length) {
    console.log(`✗ ${name}: ${issues.join(' | ')}`);
    fail++;
  } else {
    console.log(`✓ ${name}  ${html.length} 字符`);
  }
}

let missing = [];
for (const d of st.disciples) {
  for (const k of ['id', 'name', 'realm', 'exp', 'tianfu', 'wuxing', 'daoxin', 'gengu', 'loyalty', 'mood', 'contribution', 'terms', 'bonds', 'history']) {
    if (d[k] === undefined) missing.push(`${d.name}.${k}`);
  }
  for (const oid of Object.keys(d.bonds || {})) {
    const b = d.bonds[oid];
    if (typeof b !== 'object' || b.score === undefined || !b.flags) {
      missing.push(`${d.name}.bonds[${oid}] 结构不完整`);
    }
  }
}
console.log(missing.length ? '✗ 数据缺失: ' + missing.join(', ') : '✓ 弟子与关系结构完整');
if (missing.length) fail++;

const json = JSON.stringify(st);
const restored = S.state.migrate(JSON.parse(json));
const okRound = restored.week === st.week &&
  restored.disciples.length === st.disciples.length &&
  typeof restored.disciples[0].bonds === 'object';
console.log(okRound ? '✓ 存档序列化往返正常' : '✗ 存档往返异常');
if (!okRound) fail++;

const knownNpcs = S.systems.npc.known(st);
console.log(knownNpcs.length > 0
  ? `✓ 江湖人物已结识 ${knownNpcs.length} 位`
  : '✗ 40 周内没有结识任何江湖人物');
if (!knownNpcs.length) fail++;

const lastReport = st.reports[0];
const maxLen = Math.max(...lastReport.entries.map((e) => e.text.length));
const storyEntries = lastReport.entries.filter((e) => e.text.length > 40);
console.log(storyEntries.length > 0
  ? `✓ 周报含叙事体条目（最长 ${maxLen} 字）`
  : '✗ 周报没有叙事体文本');
if (!storyEntries.length) fail++;

console.log('\n' + (fail ? `${fail} 项失败` : '全部面板渲染正常'));
process.exit(fail ? 1 : 0);
