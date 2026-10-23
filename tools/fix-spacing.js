/* 一次性工具：清理中文排版——去掉模板变量后紧跟汉字时的多余空格
 * 用法：node tools/fix-spacing.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  'js/data/stories.js',
  'js/data/npcs.js',
  'js/data/regions.js',
  'js/systems/events.js',
  'js/systems/relations.js',
  'js/systems/week.js',
  'js/systems/npc.js',
];

// 1) ${xxx} 后面紧跟一个空格 + 汉字 => 去掉空格
const RE1 = /\$\{([^{}]+?)\} (?=[\u4e00-\u9fff])/g;
// 2) 汉字 + 空格 + ${xxx} => 去掉空格
const RE2 = /([\u4e00-\u9fff]) (?=\$\{)/g;
// 3) 中文标点 + 空格 + ${xxx} => 去掉空格
const RE3 = /([\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a]) (?=\$\{)/g;

let total = 0;
for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  const before = fs.readFileSync(full, 'utf8');
  let count = 0;
  const after = before
    .replace(RE1, (m, expr) => { count++; return '${' + expr + '}'; })
    .replace(RE2, (m, ch) => { count++; return ch; })
    .replace(RE3, (m, ch) => { count++; return ch; });
  if (count > 0) {
    fs.writeFileSync(full, after, 'utf8');
    console.log(`${rel}: 清理 ${count} 处`);
    total += count;
  } else {
    console.log(`${rel}: 无需修改`);
  }
}
console.log(`\n共清理 ${total} 处中文多余空格`);
