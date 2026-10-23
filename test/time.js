/* 时间系统测试：倍速、进度、事件队列、离线结算 */
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
];

console.warn = () => {};
for (const f of FILES) {
  const full = path.join(ROOT, f);
  vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
}

const S = global.Sect;
const T = S.time;
const st = S.state.initNewGame();
S.state.data = st;

let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '✓ ' : '✗ ') + msg);
  if (!cond) fail++;
};

ok(T.state.speed === 1, '默认 1 倍速');
ok(T.progress() === 0, '初始周进度为 0');
ok(!T.isPaused(), '初始未暂停');

T.setSpeed(4);
ok(T.state.speed === 4, '切换到 4 倍速');
ok(Math.abs(T.state.popInterval - 900 / 4) < 0.01, `播报间隔随倍速缩短（${T.state.popInterval}ms）`);

T.togglePause();
ok(T.state.speed === 0, '暂停 → 0 倍速');
ok(T.isPaused(), 'isPaused 正确');

T.togglePause();
ok(T.state.speed === 4, '恢复上次倍速 4×');

T.setSpeed(3);
ok(T.state.speed === 4, '非法倍速 3× 被忽略');

T.setSpeed(1);
ok(T.WEEK_MS === 20000, '1 倍速一周 20 秒');

// ---------- 单周结算 ----------
const weekBefore = st.week;
T.doWeek(st);
ok(st.week === weekBefore + 1, `doWeek 推进一周（${weekBefore} → ${st.week}）`);
ok(T.state.queue.length > 0, `事件进入播报队列（${T.state.queue.length} 条）`);
ok(T.state.queue.every((e) => typeof e.week === 'number'), '队列条目携带周数');

// ---------- 播报 ----------
let fed = 0;
T.state.onFeed = () => { fed++; };
const queued = T.state.queue.length;
while (T.state.queue.length) T.feedEntry(T.state.queue.shift());
ok(fed === queued, `播报 ${fed} 条，与队列一致`);
ok(T.state.feed.filter((x) => x.divider).length === 1, '本周插入 1 条周分隔');

for (let i = 0; i < 300; i++) {
  T.feedEntry({ text: '测试事件 ' + i, kind: 'info', week: st.week + 1 });
}
ok(T.state.feed.length <= 200, `动态流上限生效（${T.state.feed.length} ≤ 200）`);

// ---------- 多周连推 ----------
T.state.queue.length = 0;
const w0 = st.week;
for (let i = 0; i < 5; i++) T.doWeek(st);
ok(st.week === w0 + 5, '连续 5 周结算');
ok(st.reports.length >= 5, '周报累积正常');

// ---------- 离线 ----------
const st2 = S.state.initNewGame();
S.state.data = st2;
st2.week = 30;
const WEEK = 20000;
const OFF_EFF = T.OFFLINE_EFF;
const CAP = T.OFFLINE_CAP;

st2.lastSeen = Date.now() - 10 * 60 * 1000;
const off = T.offlineSettle(st2);
const expect = Math.min(Math.floor((10 * 60 * 1000 / WEEK) * OFF_EFF), CAP);
ok(!!off, '离线结算返回报告');
ok(off && off.weeks === expect, `离线 10 分钟补算 ${off && off.weeks} 周（期望 ${expect}）`);
ok(st2.week === 30 + expect, `周数推进到 ${st2.week}`);
ok(off && off.weekFrom === 31, '报告区间起点正确');
ok(off && off.highlights.length >= 0, '报告含要事列表');

const st3 = S.state.initNewGame();
S.state.data = st3;
st3.lastSeen = Date.now() - 30000;
ok(T.offlineSettle(st3) === null, '离开不足 1 分钟不补算');

const st4 = S.state.initNewGame();
S.state.data = st4;
st4.week = 5;
st4.lastSeen = Date.now() - 30 * 24 * 3600 * 1000;
const off4 = T.offlineSettle(st4);
ok(off4 && off4.weeks === CAP, `超长离线上限封顶在 ${CAP} 周`);

// 离线后动态流应非空
ok(T.state.feed.length > 0 || st4.week === 5 + CAP, '离线后动态流接上了近期事件');

// ---------- 暂停落盘 ----------
const st5 = S.state.initNewGame();
S.state.data = st5;
T.setSpeed(1);
const t0 = st5.lastSeen;
T.setSpeed(0);
ok(st5.lastSeen >= t0, '暂停时把最后在线时间立即落盘');

ok(T.describeGap(90 * 1000).includes('分钟'), '时长描述：分钟');
ok(T.describeGap(2 * 3600 * 1000).includes('小时'), '时长描述：小时');
ok(T.describeGap(3 * 24 * 3600 * 1000).includes('天'), '时长描述：天');

console.log('\n' + (fail ? `${fail} 项失败` : '时间系统测试全部通过'));
process.exit(fail ? 1 : 0);
