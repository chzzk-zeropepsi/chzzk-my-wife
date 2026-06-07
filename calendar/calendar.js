// calendar.js — 월별 기념일(생일/데뷔일) 캘린더
(function () {
  const monthEl = document.getElementById("month");
  const gridEl = document.getElementById("grid");
  const today = new Date();
  let viewY = today.getFullYear();
  let viewM = today.getMonth(); // 0-based
  let vtubers = [];

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }

  // 해당 월(viewY, viewM)의 날짜별 이벤트 맵: { day: [{type, v, count}] }
  function eventsForMonth() {
    const map = {};
    const add = (day, ev) => {
      (map[day] = map[day] || []).push(ev);
    };
    for (const v of vtubers) {
      const bd = Anniversary.parseMonthDay(v.birthday);
      if (bd && bd.month === viewM + 1) add(bd.day, { type: "birthday", v });
      const dv = Anniversary.parseMonthDay(v.debutDate);
      if (dv && dv.month === viewM + 1) {
        const count = dv.year ? viewY - dv.year : null;
        add(dv.day, { type: "debut", v, count });
      }
    }
    return map;
  }

  function chip(e) {
    const v = e.v;
    const url = v.channelUrl || `https://chzzk.naver.com/${v.id}`;
    const icon = e.type === "birthday" ? "🎂" : "✨";
    const cnt = e.type === "debut" && e.count > 0 ? `<span class="cnt">${e.count}주년</span>` : "";
    const img = v.profileImage ? `<img src="${escAttr(v.profileImage)}" alt="">` : "";
    return `<div class="chip ${e.type}" data-url="${escAttr(url)}" title="${escAttr(v.name || "")}">
      <span>${icon}</span>${img}<span class="cname">${escHtml(v.name || v.id)}</span>${cnt}</div>`;
  }

  function render() {
    monthEl.textContent = `${viewY}년 ${viewM + 1}월`;
    const map = eventsForMonth();
    const startDow = new Date(viewY, viewM, 1).getDay();
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const wd = ["일", "월", "화", "수", "목", "금", "토"];

    let html = '<div class="cal-grid">';
    wd.forEach((d, i) => {
      html += `<div class="cal-head ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}">${d}</div>`;
    });
    for (let i = 0; i < startDow; i++) html += '<div class="cal-cell empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = (startDow + day - 1) % 7;
      const isToday =
        viewY === today.getFullYear() && viewM === today.getMonth() && day === today.getDate();
      const evs = map[day] || [];
      const chips = evs.map(chip).join("");
      html += `<div class="cal-cell ${isToday ? "today" : ""}">
        <div class="cal-day ${dow === 0 ? "sun" : ""} ${dow === 6 ? "sat" : ""}">${day}</div>
        <div class="cal-events">${chips}</div>
      </div>`;
    }
    html += "</div>";
    gridEl.innerHTML = html;

    gridEl.querySelectorAll(".chip").forEach((el) => {
      el.onclick = () => {
        const url = el.dataset.url;
        if (url) chrome.tabs.create({ url });
      };
      const img = el.querySelector("img");
      if (img) img.addEventListener("error", () => (img.style.display = "none"));
    });
  }

  document.getElementById("prev").onclick = () => {
    viewM--;
    if (viewM < 0) {
      viewM = 11;
      viewY--;
    }
    render();
  };
  document.getElementById("next").onclick = () => {
    viewM++;
    if (viewM > 11) {
      viewM = 0;
      viewY++;
    }
    render();
  };
  document.getElementById("today").onclick = () => {
    viewY = today.getFullYear();
    viewM = today.getMonth();
    render();
  };

  // 팝업과 동일한 캐시를 공유 → 즉시 표시 후 네트워크 갱신
  async function load() {
    try {
      const o = await chrome.storage.local.get("vtubersCache");
      const c = o.vtubersCache;
      if (c && Array.isArray(c.data)) {
        vtubers = c.data;
        render();
      }
    } catch (_) {}
    try {
      vtubers = await Firestore.listDocs("vtubers");
      render();
      try {
        await chrome.storage.local.set({ vtubersCache: { ts: Date.now(), data: vtubers } });
      } catch (_) {}
    } catch (e) {
      console.error("[chzzk-my-wife]", e);
      if (!vtubers.length)
        gridEl.innerHTML = `<div class="status">불러오기 실패 — config.js 설정을 확인하세요.</div>`;
    }
  }
  load();
})();
