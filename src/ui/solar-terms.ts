/** 二十四节气（近似公历日期，适合 UI / 季节装饰判定） */

export type SolarTerm = {
  name: string;
  /** 约起始月（1–12） */
  month: number;
  /** 约起始日 */
  day: number;
};

/** 按一年顺序：从小寒起 */
export const SOLAR_TERMS: SolarTerm[] = [
  { name: '小寒', month: 1, day: 6 },
  { name: '大寒', month: 1, day: 20 },
  { name: '立春', month: 2, day: 4 },
  { name: '雨水', month: 2, day: 19 },
  { name: '惊蛰', month: 3, day: 6 },
  { name: '春分', month: 3, day: 21 },
  { name: '清明', month: 4, day: 5 },
  { name: '谷雨', month: 4, day: 20 },
  { name: '立夏', month: 5, day: 6 },
  { name: '小满', month: 5, day: 21 },
  { name: '芒种', month: 6, day: 6 },
  { name: '夏至', month: 6, day: 21 },
  { name: '小暑', month: 7, day: 7 },
  { name: '大暑', month: 7, day: 23 },
  { name: '立秋', month: 8, day: 8 },
  { name: '处暑', month: 8, day: 23 },
  { name: '白露', month: 9, day: 8 },
  { name: '秋分', month: 9, day: 23 },
  { name: '寒露', month: 10, day: 8 },
  { name: '霜降', month: 10, day: 23 },
  { name: '立冬', month: 11, day: 7 },
  { name: '小雪', month: 11, day: 22 },
  { name: '大雪', month: 12, day: 7 },
  { name: '冬至', month: 12, day: 22 },
];

function dayOfYear(month: number, day: number, year: number): number {
  const d = new Date(year, month - 1, day);
  const start = new Date(year, 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

export function getSolarTerm(date = new Date()): SolarTerm {
  const year = date.getFullYear();
  const today = dayOfYear(date.getMonth() + 1, date.getDate(), year);
  let current = SOLAR_TERMS[SOLAR_TERMS.length - 1];
  for (const term of SOLAR_TERMS) {
    if (today >= dayOfYear(term.month, term.day, year)) current = term;
  }
  // 1 月初仍属上年冬至段 → 小寒前显示冬至
  const xiaohan = dayOfYear(1, 6, year);
  if (today < xiaohan) current = SOLAR_TERMS[SOLAR_TERMS.length - 1];
  return current;
}

/** 樱花季：惊蛰–谷雨（对齐旧站 3–4 月） */
export function isSakuraSeason(date = new Date()): boolean {
  const name = getSolarTerm(date).name;
  return ['惊蛰', '春分', '清明', '谷雨'].includes(name);
}

/** 落叶季：白露–霜降（对齐旧站 9–11 月前半；立冬起偏冬） */
export function isLeavesSeason(date = new Date()): boolean {
  const name = getSolarTerm(date).name;
  return ['白露', '秋分', '寒露', '霜降', '立冬'].includes(name);
}

export type SeasonDecor = 'sakura' | 'leaves' | 'none';

export function seasonDecor(date = new Date()): SeasonDecor {
  if (isSakuraSeason(date)) return 'sakura';
  if (isLeavesSeason(date)) return 'leaves';
  return 'none';
}
