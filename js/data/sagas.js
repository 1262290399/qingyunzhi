/* ===========================================================
 * sagas.js — 剧情线
 *
 * 一条 Saga 是跨越数年的连续故事，分几幕。每年只推进一幕，
 * 所以玩家会在年报里连着看到「旧怨 · 一」「旧怨 · 二」「旧怨 · 三」。
 *
 * 每一幕有：
 *   title   幕名（一/二/三）
 *   wait    距离上一幕隔几年
 *   text    叙事（ctx -> string）
 *   effect  对状态的实际影响（ctx -> string[] | void）
 *
 * canStart 返回 { ids: [...], data: {...} } 或 null。
 * =========================================================== */
(function (S) {
  'use strict';

  const U = S.util;

  const SAGAS = [
    // =========================================================
    //  一、旧怨：两个弟子结下的梁子，一步步走到摊牌
    // =========================================================
    {
      id: 'feud',
      name: '旧怨',
      cooldown: 45,
      canStart(st, week) {
        const ds = st.disciples;
        for (let i = 0; i < ds.length; i++) {
          for (let j = i + 1; j < ds.length; j++) {
            const a = ds[i];
            const b = ds[j];
            if (S.relations.mutual(a, b) <= -26) {
              return { ids: [a.id, b.id] };
            }
          }
        }
        return null;
      },
      stages: [
        {
          title: '一',
          wait: 0,
          text(c) {
            return U.pick([
              `${c.a.name}和${c.b.name}在饭堂又撞上了。这次是因为一桶水——` +
              `谁也不知道是谁先动的，反正桶翻了，两个人浑身都湿透了。` +
              `围观的人笑了一阵。笑声里，两个人的脸都不太好看。`,
              `一桩小事闹到了执事那里。${c.a.name}说${c.b.name}先动的手，` +
              `${c.b.name}说${c.a.name}嘴太脏。执事听完，把两个人都赶了回去。` +
              `事情没解决，只是被按下了。`,
            ]);
          },
          effect(c) {
            S.systems.events.bond(c.a, c.b, -12, [], c.week);
          },
        },
        {
          title: '二',
          wait: 3,
          text(c) {
            return U.pick([
              `这几天宗门里丢了几样小东西。没人报官，但有人看见` +
              `${c.b.name}半夜在库房外头转悠。话传了一圈，` +
              `最后传回${c.b.name}耳朵里时，已经变成了另一个版本。`,
              `${c.a.name}这几年格外用功，天不亮就上后山。` +
              `有人问他为什么，他只说“不想输给人”。` +
              `他说的那个人，不必问也知道是谁。`,
            ]);
          },
          effect(c) {
            S.systems.events.bond(c.a, c.b, -10, [], c.week);
            // 两人都憋着一口气，修为各自涨了些
            S.disciple.gainExp(c.a, U.rand(8, 16));
            S.disciple.gainExp(c.b, U.rand(8, 16));
          },
        },
        {
          title: '三',
          wait: 2,
          text(c) {
            return `${c.a.name}和${c.b.name}隔着三步远站定。演武台下站满了人，` +
              `谁也没说话。执事本来要拦，被长老按住了手——` +
              `“让他们打。打完了，这道坎就过去了；打不完，留着也是祸。”`;
          },
          effect(c) {
            const pa = S.disciple.power(c.a);
            const pb = S.disciple.power(c.b);
            const winner = pa >= pb ? c.a : c.b;
            const loser = winner === c.a ? c.b : c.a;
            const heal = U.chance(0.42);

            const lines = [];
            if (heal) {
              S.systems.events.bond(c.a, c.b, 45, [], c.week);
              S.disciple.adjustMood(c.a, 12);
              S.disciple.adjustMood(c.b, 12);
              lines.push(
                `两人打了半个时辰，最后同时停了手。${loser.name}先开的口：` +
                `“算了。”${winner.name}愣了半天，点了点头。` +
                `这件事之后，两人再没红过脸。`
              );
            } else {
              S.systems.events.bond(c.a, c.b, -20, [], c.week);
              const tmp = [];
              S.disciple.injure(loser, U.randInt(1, 2), tmp, '同门相争');
              for (const ev of tmp) lines.push(ev.text);
              lines.push(
                `${winner.name}赢了，但赢得很不体面。${loser.name}被扶下去的时候，` +
                `回头看了他一眼。那一眼，在场的人都记住了。`
              );
            }
            return lines;
          },
        },
      ],
    },

    // =========================================================
    //  二、秘境：某个弟子撞见了不该看见的东西
    // =========================================================
    {
      id: 'realm',
      name: '古碑',
      cooldown: 55,
      canStart(st, week) {
        if (week < 18) return null;
        const ds = st.disciples.filter((d) => d.realm >= 4 && d.injureWeeks === 0);
        if (!ds.length) return null;
        if (!U.chance(0.22)) return null;
        const d = U.pick(ds);
        return { ids: [d.id] };
      },
      stages: [
        {
          title: '一',
          wait: 0,
          text(c) {
            return `${c.a.name}这趟回来得比平时早。他没带什么东西，` +
              `人却是恍惚的。执事问了几遍，他才说：` +
              `“我在断魂古战场边上，看见一块碑。碑上没有字。”` +
              `他顿了顿，“可它在动。”`;
          },
          effect(c) {
            S.disciple.adjustMood(c.a, -10);
            S.disciple.addHistory(c.a, '在古战场见过一块会动的碑');
          },
        },
        {
          title: '二',
          wait: 3,
          text(c) {
            return `宗门派人去看了。三个人走了五天，回来两个。` +
              `带回来的说法对不上：一个说碑是石头的，纹丝不动；` +
              `另一个说，碑底下有台阶，往下走能听见水声。` +
              `长老听完，让人把话都记下来，然后把两个人分开住。`;
          },
          effect(c) {
            const tmp = [];
            S.disciple.injure(c.a, 1, tmp, '受碑上半句话的蛊惑');
            S.state.addRep(2);
            return ['那几天，见过碑的人睡不好。有一个人半夜爬起来，' +
              '在墙上用炭画了半张图。'];
          },
        },
        {
          title: '三',
          wait: 3,
          text(c) {
            return `宗门终于决定动手。${c.a.name}走在最前面——` +
              `是他先看见的，也该由他去开了那扇门。`;
          },
          effect(c) {
            const out = [];
            const it = U.pick(['xiuSuiDan', 'qianjidan', 'tianlingguo', 'wudaojian']);
            S.state.warehouseAdd(it, 1);
            c.st.sect.totalLoot++;
            S.disciple.gainExp(c.a, U.rand(40, 90));
            S.state.addRep(6);
            S.state.addStones(U.randInt(300, 800));

            out.push(`台阶下面是一个不大的石室。${c.a.name}在里面待了半个时辰，` +
              `出来时手里多了「${S.items.get(it).name}」。` +
              `他说里面还有东西，但拿不动，也带不走。`);

            if (U.chance(0.35)) {
              const tmp = [];
              S.disciple.injure(c.a, U.randInt(1, 2), tmp, '石室里的机关');
              out.push('出来的时候，石门在身后合上了。' +
                `${c.a.name}的肩上多了一道口子，他自己说“值”。`);
            }
            return out;
          },
        },
      ],
    },

    // =========================================================
    //  三、铁剑门：与邻宗的摩擦
    // =========================================================
    {
      id: 'sword',
      name: '铁剑门',
      cooldown: 60,
      canStart(st, week) {
        if (week < 30) return null;
        const rec = st.npcs && st.npcs.pei_qinhu;
        if (!rec || rec.met <= 0) return null;
        if (rec.sectFavor > -12) return null;
        const ds = st.disciples.filter((d) => d.realm >= 3);
        if (!ds.length) return null;
        return { ids: [U.pick(ds).id], data: { npcId: 'pei_qinhu' } };
      },
      stages: [
        {
          title: '一',
          wait: 0,
          text(c) {
            return `山下的货被截了。押货的是${c.a.name}，对方留了话：` +
              `“回去告诉你们宗主，黑风岭往北，以后不姓青云了。”` +
              `货不算多，但这口气咽不下去。`;
          },
          effect(c) {
            const loss = Math.min(c.st.sect.spiritStones, U.randInt(180, 420));
            S.state.addStones(-loss);
            S.state.addRep(-2);
            S.npcs && S.systems.npc.ensure(c.st, 'pei_qinhu');
            const rec = c.st.npcs.pei_qinhu;
            rec.sectFavor = U.clamp(rec.sectFavor - 6, -100, 100);
          },
        },
        {
          title: '二',
          wait: 3,
          text(c) {
            return `铁剑门来人了。来的是个年轻弟子，说话倒是客气，` +
              `意思却很清楚：黑风岭以北的矿脉，两家争了几十年，` +
              `“如今该有个说法了”。` +
              `宗主还没答话，${c.a.name}先站了起来。`;
          },
          effect(c) {
            S.disciple.adjustMood(c.a, 8);
            S.state.addRep(1);
          },
        },
        {
          title: '三',
          wait: 2,
          text(c) {
            return `两边最后谈定：一场比试，三局两胜，输的一方退出北岭。` +
              `地点在落霞谷外的空地上，谁都可以来看。`;
          },
          effect(c) {
            const out = [];
            const win = U.chance(0.55);
            const rec = c.st.npcs.pei_qinhu;
            if (win) {
              S.state.addRep(8);
              S.state.addStones(U.randInt(400, 900));
              S.disciple.addContribution(c.a, 150);
              S.disciple.adjustMood(c.a, 18);
              if (rec) rec.sectFavor = U.clamp(rec.sectFavor + 18, -100, 100);
              out.push(`${c.a.name}赢了第三局。铁剑门的人走得很快，` +
                `没留下什么话。但从那天起，山下再没人来截过货。`);
            } else {
              S.state.addRep(-4);
              S.disciple.adjustMood(c.a, -14);
              const tmp = [];
              S.disciple.injure(c.a, U.randInt(1, 2), tmp, '与铁剑门比武');
              for (const ev of tmp) out.push(ev.text);
              if (rec) rec.sectFavor = U.clamp(rec.sectFavor - 8, -100, 100);
              out.push(`第三局输了。${c.a.name}下台的时候一句话没说。` +
                `裴擒虎倒是走过来，扔下一句：“下次来，我带酒。”`);
            }
            return out;
          },
        },
      ],
    },

    // =========================================================
    //  四、妖患：山下的村子出了事
    // =========================================================
    {
      id: 'demon',
      name: '妖患',
      cooldown: 50,
      canStart(st, week) {
        if (week < 30) return null;
        const ds = st.disciples.filter((d) => d.realm >= 5 && d.injureWeeks === 0);
        if (ds.length < 2) return null;
        if (!U.chance(0.22)) return null;
        const pick = U.sample(ds, 2);
        return { ids: [pick[0].id, pick[1].id] };
      },
      stages: [
        {
          title: '一',
          wait: 0,
          text(c) {
            return `山下来了一群村民，跪在牌坊外头。领头的老人说，` +
              `连着三个村子，人一个接一个地没了。` +
              `“不是死，”他强调，“是不见了。”`;
          },
          effect(c) {
            S.state.addRep(1);
            S.disciple.adjustMood(c.a, -6);
          },
        },
        {
          title: '二',
          wait: 2,
          text(c) {
            return `${c.a.name}和${c.b.name}沿着村后的路走了三天。` +
              `第三天夜里，他们在一个枯井边上找到了痕迹——` +
              `不是兽爪，是人手印，很多，很多。`;
          },
          effect(c) {
            S.disciple.gainExp(c.a, U.rand(10, 20));
            S.disciple.gainExp(c.b, U.rand(10, 20));
            S.disciple.adjustMood(c.a, -8);
            S.disciple.adjustMood(c.b, -8);
          },
        },
        {
          title: '三',
          wait: 2,
          text(c) {
            return `井底下比想象中大。${c.a.name}举着灯走在前面，` +
              `${c.b.name}在后头断后。走了很久，灯忽然灭了。`;
          },
          effect(c) {
            const out = [];
            const hurt1 = U.chance(0.55);
            const hurt2 = U.chance(0.45);
            if (hurt1) {
              const tmp = [];
              S.disciple.injure(c.a, U.randInt(1, 3), tmp, '井底恶斗');
              for (const ev of tmp) out.push(ev.text);
            }
            if (hurt2) {
              const tmp = [];
              S.disciple.injure(c.b, U.randInt(1, 2), tmp, '井底恶斗');
              for (const ev of tmp) out.push(ev.text);
            }

            if (U.chance(0.7)) {
              S.state.addRep(12);
              S.state.addStones(U.randInt(500, 1200));
              const it = U.pick(['longxianguo', 'yaowangneidan', 'xiuSuiDan']);
              S.state.warehouseAdd(it, 1);
              c.st.sect.totalLoot++;
              c.st.disciples.forEach((d) => S.disciple.adjustMood(d, 6));
              out.push(`井底那东西死了。${c.b.name}把他的头带了回来，` +
                `挂在山门外示众了七天。` +
                `村民送来的谢礼不多，但此后每年这个时候，山下都会有人上山。`);
            } else {
              S.state.addRep(-5);
              c.st.disciples.forEach((d) => S.disciple.adjustMood(d, -10));
              out.push(`那东西跑了。只留下一地烂泥和几件衣服。` +
                `没人再提这件事，可往后好几年，山下的人都不太敢往山里走。`);
            }
            return out;
          },
        },
      ],
    },

    // =========================================================
    //  五、心结：一个弟子走不出去的一道坎
    // =========================================================
    {
      id: 'heart',
      name: '心结',
      cooldown: 40,
      canStart(st, week) {
        if (week < 24) return null;
        const ds = st.disciples.filter(
          (d) => d.weeksInSect >= 20 && d.injureWeeks === 0 && d.mood < 45
        );
        if (!ds.length) return null;
        if (!U.chance(0.24)) return null;
        return { ids: [U.pick(ds).id] };
      },
      stages: [
        {
          title: '一',
          wait: 0,
          text(c) {
            return `${c.a.name}最近不对劲。饭照吃，课照上，` +
              `可有人半夜起来，看见他一个人坐在台阶上。` +
              `问他，他说没事。`;
          },
          effect(c) {
            S.disciple.adjustMood(c.a, -6);
            S.disciple.addHistory(c.a, '心事重重');
          },
        },
        {
          title: '二',
          wait: 3,
          text(c) {
            return `长老找他谈了一次。谈了什么，没人知道。` +
              `只知道那天之后，${c.a.name}把自己关在屋里三天。` +
              `出来时，眼睛是肿的。`;
          },
          effect(c) {
            S.disciple.adjustLoyalty(c.a, 6);
            S.disciple.adjustMood(c.a, -4);
          },
        },
        {
          title: '三',
          wait: 2,
          text(c) {
            return `有人在后山看见${c.a.name}练剑。从天黑练到天亮，` +
              `一剑一剑，砍的是同一块石头。`;
          },
          effect(c) {
            const out = [];
            const ok = U.chance(0.62);
            if (ok) {
              const before = c.a.realm;
              const evs = S.disciple.gainExp(c.a, U.randInt(65, 140));
              for (const ev of evs) out.push(ev.text);
              S.disciple.adjustMood(c.a, 28);
              S.disciple.adjustLoyalty(c.a, 8);
              S.disciple.addHistory(c.a, '走过了一道坎');
              out.push(`那块石头被砍开了。${c.a.name}站在那儿看了很久，` +
                `然后笑了一下——宗门里已经很久没人见他笑过。`);
            } else {
              S.disciple.adjustMood(c.a, -12);
              S.disciple.adjustLoyalty(c.a, -6);
              out.push(`那块石头没开。${c.a.name}最终把剑插在土里，走了。` +
                `从此他再没去过那片后山。`);
            }
            return out;
          },
        },
      ],
    },
  ];

  // =========================================================
  //  认主之物
  //  只在剧情线里出现，跟着主人走：别人拿不走，主人死了也就没了
  // =========================================================
  const RELICS = [
    {
      id: 'duanjian',
      name: '断剑',
      termId: 'relic_duanjian',
      desc: '一柄断了半截的剑。握上去的时候，能听见很轻的一声响，像有人在数拍子。',
      effects: { powerMul: 1.18, growthMul: 1.03 },
    },
    {
      id: 'gudi',
      name: '妖王骨笛',
      termId: 'relic_gudi',
      desc: '用一节骨头磨的笛子。吹不响，但放在枕边，做噩梦的次数会少一些。',
      effects: { injureMul: 0.82, fortune: 1.15 },
    },
    {
      id: 'gubei_ta',
      name: '古碑拓片',
      termId: 'relic_gubei_ta',
      desc: '从石碑上拓下来的一张纸。字迹浅得几乎看不见，可看久了那些字会动。',
      effects: { breakthroughAdd: 0.1, growthMul: 1.05 },
    },
  ];

  const RELIC_BY_ID = {};
  for (const r of RELICS) RELIC_BY_ID[r.id] = r;

  const BY_ID = {};
  for (const s of SAGAS) BY_ID[s.id] = s;

  S.sagas = {
    SAGAS, BY_ID, RELICS, RELIC_BY_ID,
    get: (id) => BY_ID[id] || null,
    relic: (id) => RELIC_BY_ID[id] || null,
  };
})(window.Sect);
