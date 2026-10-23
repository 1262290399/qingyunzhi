/* ===========================================================
 * names.js — 弟子姓名与称号生成
 * =========================================================== */
(function (S) {
  'use strict';

  const SURNAMES = [
    '林', '叶', '苏', '沈', '顾', '陆', '谢', '萧', '楚', '江',
    '温', '裴', '秦', '宋', '许', '韩', '柳', '白', '墨', '云',
    '宁', '姜', '唐', '薛', '程', '贺', '连', '段', '慕容', '上官',
    '东方', '南宫', '司徒', '独孤', '尉迟', '公孙',
  ];

  const GIVEN_M = [
    '玄', '尘', '渊', '霄', '辰', '昭', '朔', '野', '川', '山',
    '墨', '砚', '锋', '骁', '衡', '崟', '彻', '衍', '烬', '梧',
    '松', '岳', '峥', '临', '渡', '鹜', '沉', '渊', '澈', '祁',
  ];

  const GIVEN_F = [
    '霜', '雪', '凝', '烟', '汐', '漪', '萤', '绾', '萝', '棠',
    '绫', '筝', '芸', '芷', '苓', '葭', '杳', '覃', '琬', '筝',
    '粼', '黛', '缈', '歆', '媱', '韵', '岚', '曦', '璃', '婉',
  ];

  /** 单字名 + 双字名混合 */
  function givenName(gender) {
    const pool = gender === 'f' ? GIVEN_F : GIVEN_M;
    const r = Math.random();
    if (r < 0.55) return S.util.pick(pool);
    if (r < 0.92) {
      const a = S.util.pick(pool);
      let b = S.util.pick(pool);
      let guard = 0;
      while (b === a && guard++ < 10) b = S.util.pick(pool);
      return a + b;
    }
    return S.util.pick(GIVEN_M.concat(GIVEN_F));
  }

  function personName(gender) {
    const surname = S.util.pick(SURNAMES);
    const last = surname.charAt(surname.length - 1);
    let given = givenName(gender || (Math.random() < 0.5 ? 'm' : 'f'));
    // 别取成「墨墨岳」「云云归」这种
    let guard = 0;
    while (given.charAt(0) === last && guard++ < 20) {
      given = givenName(gender || (Math.random() < 0.5 ? 'm' : 'f'));
    }
    return surname + given;
  }

  /** 外号：由词条触发的称号，或随机雅号 */
  const TITLES = [
    '剑痴', '冷面书生', '笑面虎', '铁算盘', '小药王', '云中客',
    '孤鸿子', '青衫客', '醉道人', '无尘', '半盏茶', '三寸舌',
    '断水流', '拾荒人', '苦行僧', '不夜侯', '壁上观', '拾遗',
  ];

  const SECT_NAMES = ['青云宗', '太虚门', '归元阁', '落霞宗', '问道山', '苍梧剑派'];

  S.names = { personName, givenName, TITLES, SECT_NAMES };
})(window.Sect);
