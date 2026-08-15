const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * 把 frontmatter / 导入用的日期规范成 YYYY-MM-DD。
 * 注意：不要对无年份串直接 new Date()——V8 会落到 2001 年。
 */
export function formatFrontmatterDate(value, fallbackYear = new Date().getFullYear()) {
  if (value == null || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // 无年份字符串被误解析时会出现 2001，交给字符串分支不可行；Date 已定年
    return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  // Wed Jul 08 / Jul 08 / Wed Jul 01 2026 08:00:00 GMT+0800 ...
  const named = s.match(
    /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:[\s,]+(\d{4}))?/i,
  );
  if (named) {
    const month = MONTHS[named[1].toLowerCase().slice(0, 3)];
    const day = Number(named[2]);
    if (month && day >= 1 && day <= 31) {
      const yearInStr = s.match(/\b(19|20)\d{2}\b/);
      const year = named[3] ? Number(named[3]) : yearInStr ? Number(yearInStr[0]) : fallbackYear;
      return ymd(year, month, day);
    }
  }

  // 仅当串里已有四位年份时才用 Date，避免无年份 → 2001
  if (/\b(19|20)\d{2}\b/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return ymd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
  }

  return s.slice(0, 32);
}
