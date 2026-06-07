// lib/anniversary.js — 생일/데뷔일 등 기념일 D-day 계산
// birthday: "MM-DD" 또는 "YYYY-MM-DD"
// debutDate: "YYYY-MM-DD"
(function () {
  // 다양한 입력을 너그럽게 파싱:
  //  "06-15", "6/15", "06.15", "0615"      -> {month:6, day:15}
  //  "2024-06-15", "20240615"              -> {year:2024, month:6, day:15}
  function parseMonthDay(str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str) return null;

    let nums;
    if (/[^0-9]/.test(str)) {
      // 구분자(하이픈/슬래시/점/공백 등)가 있으면 숫자 그룹으로 분리
      nums = str.split(/[^0-9]+/).filter(Boolean).map((n) => parseInt(n, 10));
    } else {
      // 숫자만: 4자리=MMDD, 8자리=YYYYMMDD
      if (str.length === 4) nums = [+str.slice(0, 2), +str.slice(2, 4)];
      else if (str.length === 8) nums = [+str.slice(0, 4), +str.slice(4, 6), +str.slice(6, 8)];
      else return null;
    }
    if (!nums || nums.some(isNaN)) return null;

    let year = null, month, day;
    if (nums.length === 3) [year, month, day] = nums;
    else if (nums.length === 2) [month, day] = nums;
    else return null;

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  // 표준형 문자열로 정규화: 연도 있으면 "YYYY-MM-DD", 없으면 "MM-DD".
  // 파싱 불가하면 원본을 그대로 반환(사용자 입력 보존).
  function normalize(str) {
    const md = parseMonthDay(str);
    if (!md) return (str == null ? "" : String(str)).trim();
    const mm = String(md.month).padStart(2, "0");
    const dd = String(md.day).padStart(2, "0");
    return md.year ? `${md.year}-${mm}-${dd}` : `${mm}-${dd}`;
  }

  // 오늘 기준 다음 기념일까지 남은 일수 (오늘이면 0)
  function daysUntil(md, today) {
    if (!md) return null;
    today = today || new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let next = new Date(t0.getFullYear(), md.month - 1, md.day);
    if (next < t0) next = new Date(t0.getFullYear() + 1, md.month - 1, md.day);
    return Math.round((next - t0) / 86400000);
  }

  // 데뷔 N주년 등 횟수 계산 (year 정보가 있을 때)
  function anniversaryCount(md, today) {
    if (!md || !md.year) return null;
    today = today || new Date();
    let count = today.getFullYear() - md.year;
    const passedThisYear =
      today.getMonth() + 1 > md.month ||
      (today.getMonth() + 1 === md.month && today.getDate() >= md.day);
    if (!passedThisYear) count -= 1;
    return count + 1; // 다가오는 기념일 기준 (이번에 맞이할 N주년)
  }

  // vtubers 배열에서 withinDays 이내 기념일을 모아 D-day 순 정렬
  function upcoming(vtubers, withinDays, today) {
    today = today || new Date();
    const events = [];
    for (const v of vtubers || []) {
      const bd = parseMonthDay(v.birthday);
      if (bd) {
        const d = daysUntil(bd, today);
        if (d != null && d <= withinDays)
          events.push({ type: "생일", vtuber: v, days: d, count: anniversaryCount(bd, today) });
      }
      const dv = parseMonthDay(v.debutDate);
      if (dv) {
        const d = daysUntil(dv, today);
        if (d != null && d <= withinDays)
          events.push({ type: "데뷔일", vtuber: v, days: d, count: anniversaryCount(dv, today) });
      }
    }
    events.sort((a, b) => a.days - b.days);
    return events;
  }

  globalThis.Anniversary = { parseMonthDay, normalize, daysUntil, anniversaryCount, upcoming };
})();
