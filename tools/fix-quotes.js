/* 一次性工具：把中文语境里的英文引号 " 统一成中文引号 “ ”
 *
 * 做法：先把注释挖空（换成等长空格），再按出现顺序奇偶配对，
 * 这样跨行拼接的对话也能正确成对。最后把注释还原。
 * 用法：node tools/fix-quotes.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  'js/data/stories.js',
  'js/data/npcs.js',
  'js/systems/events.js',
  'js/systems/relations.js',
  'js/systems/week.js',
  'js/systems/npc.js',
];

function maskComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

let totalAll = 0;
for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  const src = fs.readFileSync(full, 'utf8');
  const masked = maskComments(src);

  // 收集所有 " 的位置
  const pos = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === '"') pos.push(i);
  }
  if (!pos.length) {
    console.log(`${rel}: 没有英文引号`);
    continue;
  }
  if (pos.length % 2 !== 0) {
    console.log(`${rel}: ⚠ 引号数为奇数（${pos.length}），跳过一次，请人工检查`);
    continue;
  }

  const arr = src.split('');
  for (let k = 0; k < pos.length; k += 2) {
    arr[pos[k]] = '\u201c';      // “
    arr[pos[k + 1]] = '\u201d';  // ”
  }
  fs.writeFileSync(full, arr.join(''), 'utf8');
  console.log(`${rel}: 配对替换 ${pos.length / 2} 对引号`);
  totalAll += pos.length / 2;
}
console.log(`\n共替换 ${totalAll} 对`);
