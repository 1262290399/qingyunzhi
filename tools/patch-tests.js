/* 一次性工具：把新增模块加进测试文件的 FILES 列表（幂等） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = ['test/sim.js', 'test/panels.js', 'test/time.js'];

const RULES = [
  {
    marker: "'js/data/locations.js'",
    anchor: /(  'js\/data\/buildings\.js',\r?\n)/,
    insert: "  'js/data/locations.js',\n",
  },
  {
    marker: "'js/systems/sect.js'",
    anchor: /(  'js\/systems\/disciple\.js',\r?\n)/,
    insert: "  'js/systems/sect.js',\n",
  },
  {
    marker: "'js/data/sagas.js'",
    anchor: /(  'js\/data\/locations\.js',\r?\n)/,
    insert: "  'js/data/sagas.js',\n",
  },
  {
    marker: "'js/systems/saga.js'",
    anchor: /(  'js\/systems\/tournament\.js',\r?\n)/,
    insert: "  'js/systems/saga.js',\n",
  },
  {
    marker: "'js/data/worldevents.js'",
    anchor: /(  'js\/data\/sagas\.js',\r?\n)/,
    insert: "  'js/data/worldevents.js',\n",
  },
  {
    marker: "'js/systems/worldevent.js'",
    anchor: /(  'js\/systems\/saga\.js',\r?\n)/,
    insert: "  'js/systems/worldevent.js',\n",
  },
];

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  let s = fs.readFileSync(full, 'utf8');
  let changed = 0;

  for (const rule of RULES) {
    if (s.includes(rule.marker)) continue;
    if (!rule.anchor.test(s)) {
      console.log(`${rel}: 未找到锚点 ${rule.marker}`);
      continue;
    }
    s = s.replace(rule.anchor, `$1${rule.insert}`);
    changed++;
  }

  if (changed) {
    fs.writeFileSync(full, s, 'utf8');
    console.log(`${rel}: 加了 ${changed} 个模块`);
  } else {
    console.log(`${rel}: 无需修改`);
  }
}
