// popup.js — 홈(다가오는 기념일+검색) / 등록(치지직 검색 → 생일·데뷔일 입력)
(function () {
  // ---------- 공통 ----------
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }
  function ddayText(days) {
    return days === 0 ? "오늘!" : `D-${days}`;
  }
  function avatar(src, size) {
    size = size || 28;
    if (!src) return `<span style="width:${size}px;height:${size}px;border-radius:50%;background:#2a2a30;display:inline-block;flex-shrink:0"></span>`;
    return `<img src="${escapeAttr(src)}" style="width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;object-fit:cover">`;
  }
  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  // ---------- 탭 ----------
  const tabHome = document.getElementById("tab-home");
  const tabReg = document.getElementById("tab-reg");
  const viewHome = document.getElementById("view-home");
  const viewReg = document.getElementById("view-reg");
  let regInited = false;

  function activate(tabBtn, view) {
    [tabHome, tabReg].forEach((b) => b.classList.remove("active"));
    [viewHome, viewReg].forEach((v) => v.classList.remove("active"));
    tabBtn.classList.add("active");
    view.classList.add("active");
  }
  document.getElementById("open-cal").onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("calendar/calendar.html") });
  };

  tabHome.onclick = () => activate(tabHome, viewHome);
  tabReg.onclick = () => {
    activate(tabReg, viewReg);
    if (!regInited) {
      regInited = true;
      initRegister();
    }
  };

  // ===================== 홈 =====================
  const upcomingEl = document.getElementById("upcoming");
  const searchEl = document.getElementById("search");
  const resultsEl = document.getElementById("results");
  const moreBtn = document.getElementById("more");
  const upCntEl = document.getElementById("up-cnt");
  const regCntEl = document.getElementById("reg-cnt");

  const PAGE = 30; // 한 번에 그릴 목록 개수
  let allVtubers = [];
  let lastUpcoming = [];
  let lastResults = [];
  let currentQ = "";
  let shown = PAGE; // 검색 결과에서 현재까지 보여준 개수

  function renderUpcoming() {
    const events = Anniversary.upcoming(allVtubers, 30);
    lastUpcoming = events;
    upCntEl.textContent = events.length ? ` ${events.length}` : "";
    if (!events.length) {
      upcomingEl.innerHTML = `<div class="empty">30일 이내 기념일이 없어요.</div>`;
      return;
    }
    upcomingEl.innerHTML = events
      .map((e, i) => {
        const cnt = e.count ? ` ${e.count}주년` : "";
        return `<div class="ann clickable" data-i="${i}" title="클릭해서 수정">
          ${avatar(e.vtuber.profileImage)}
          <span class="name">${escapeHtml(e.vtuber.name || e.vtuber.id)}</span>
          <span class="tag">${e.type}${cnt}</span>
          <span class="dday">${ddayText(e.days)}</span>
        </div>`;
      })
      .join("");
    upcomingEl.querySelectorAll(".ann").forEach((el) => {
      el.onclick = () => editFromHome(lastUpcoming[Number(el.dataset.i)].vtuber);
    });
  }

  function renderResults() {
    const q = currentQ.trim().toLowerCase();
    // 검색어가 없으면 등록된 전체 목록을 이름순으로 보여줌
    const list = q
      ? allVtubers.filter((v) => (v.name || "").toLowerCase().includes(q))
      : allVtubers.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    lastResults = list;
    regCntEl.textContent = allVtubers.length ? ` ${allVtubers.length}명` : "";

    if (!list.length) {
      resultsEl.innerHTML = `<div class="empty">${q ? "검색 결과 없음" : "아직 등록된 버튜버가 없어요."}</div>`;
      moreBtn.style.display = "none";
      return;
    }

    const page = list.slice(0, shown);
    resultsEl.innerHTML = page
      .map((v, i) => {
        const url = v.channelUrl || `https://chzzk.naver.com/${v.id}`;
        const bits = [];
        if (v.birthday) bits.push(`🎂 ${v.birthday}`);
        if (v.debutDate) bits.push(`✨ ${v.debutDate}`);
        return `<div class="list-item" data-i="${i}" title="클릭해서 수정">
          ${avatar(v.profileImage, 32)}
          <span class="name">${escapeHtml(v.name || v.id)}<br>
          <span class="sub">${escapeHtml(bits.join("  "))}</span></span>
          <a class="open-link" href="${escapeAttr(url)}" target="_blank" title="치지직 채널 열기">↗</a>
        </div>`;
      })
      .join("");
    resultsEl.querySelectorAll(".list-item").forEach((el) => {
      el.onclick = () => editFromHome(lastResults[Number(el.dataset.i)]);
      const link = el.querySelector(".open-link");
      if (link) link.onclick = (ev) => ev.stopPropagation();
    });

    const remaining = list.length - page.length;
    if (remaining > 0) {
      moreBtn.style.display = "";
      moreBtn.textContent = `더 보기 (${remaining}명 남음)`;
    } else {
      moreBtn.style.display = "none";
    }
  }

  // 등록 탭의 수정 폼을 홈 목록에서 바로 연다 (채널 페이지 방문 불필요)
  function editFromHome(v) {
    if (!v) return;
    activate(tabReg, viewReg);
    if (!regInited) {
      regInited = true;
      initRegister();
    }
    openForm({
      channelId: v.channelId || v.id,
      name: v.name || v.id,
      image: v.profileImage || "",
    });
  }

  searchEl.addEventListener("input", (e) => {
    currentQ = e.target.value;
    shown = PAGE; // 새 검색 시 페이지 리셋
    renderResults();
  });
  moreBtn.addEventListener("click", () => {
    shown += PAGE;
    renderResults();
  });

  function renderHome() {
    renderUpcoming();
    renderResults();
  }

  const CACHE_KEY = "vtubersCache";
  const CACHE_TTL = 90 * 1000; // 90초: 그보다 최신이면 네트워크 생략 (읽기 절감)

  async function loadHome(force) {
    // 1) 캐시 즉시 표시 (있으면)
    let cache = null;
    try {
      const o = await chrome.storage.local.get(CACHE_KEY);
      cache = o[CACHE_KEY];
    } catch (_) {}
    if (cache && Array.isArray(cache.data)) {
      allVtubers = cache.data;
      renderHome();
      // 캐시가 충분히 신선하면 네트워크 생략 (단, force면 항상 갱신)
      if (!force && Date.now() - (cache.ts || 0) < CACHE_TTL) return;
    } else {
      upcomingEl.innerHTML = `<div class="empty">불러오는 중...</div>`;
    }

    // 2) 네트워크 갱신 (stale-while-revalidate)
    try {
      const data = await Firestore.listDocs("vtubers");
      allVtubers = data;
      renderHome();
      try {
        await chrome.storage.local.set({ [CACHE_KEY]: { ts: Date.now(), data } });
      } catch (_) {}
    } catch (e) {
      if (!cache) {
        upcomingEl.innerHTML = `<div class="empty">불러오기 실패.<br>config.js의 Firebase 설정을 확인하세요.</div>`;
      }
      console.error("[chzzk-my-wife]", e);
    }
  }

  // ===================== 등록 =====================
  const loginStatusEl = document.getElementById("login-status");
  const regSearchEl = document.getElementById("reg-search");
  const regResultsEl = document.getElementById("reg-results");
  const regSearchBox = document.getElementById("reg-search-box");
  const regFormBox = document.getElementById("reg-form-box");
  let me = { loggedIn: false, userHashId: null, nickname: null };

  async function initRegister() {
    try {
      me = await Chzzk.getCurrentUser();
    } catch (_) {
      me = { loggedIn: false };
    }
    if (me.loggedIn) {
      loginStatusEl.className = "status";
      loginStatusEl.textContent = `치지직 로그인됨: ${me.nickname || me.userHashId}`;
    } else {
      loginStatusEl.className = "status warn";
      loginStatusEl.textContent =
        "치지직 미로그인 — 검색은 되지만 저장하려면 치지직 로그인이 필요합니다.";
    }
  }

  const runRegSearch = debounce(async (kw) => {
    if (!kw.trim()) {
      regResultsEl.innerHTML = "";
      return;
    }
    regResultsEl.innerHTML = `<div class="empty">검색 중...</div>`;
    try {
      const chans = await Chzzk.searchChannels(kw);
      if (!chans.length) {
        regResultsEl.innerHTML = `<div class="empty">검색 결과 없음</div>`;
        return;
      }
      regResultsEl.innerHTML = chans
        .map(
          (c, i) => `<div class="list-item" data-i="${i}">
            <img src="${escapeAttr(c.image)}" alt="">
            <span class="name">${escapeHtml(c.name)}<br>
            <span class="sub">팔로워 ${Number(c.followers).toLocaleString()}</span></span>
          </div>`
        )
        .join("");
      regResultsEl.querySelectorAll(".list-item").forEach((el) => {
        const img = el.querySelector("img");
        if (img) img.addEventListener("error", () => (img.style.visibility = "hidden"));
        el.onclick = () => openForm(chans[Number(el.dataset.i)]);
      });
    } catch (e) {
      regResultsEl.innerHTML = `<div class="empty">검색 실패: ${escapeHtml(e.message)}</div>`;
      console.error("[chzzk-my-wife]", e);
    }
  }, 350);

  regSearchEl.addEventListener("input", (e) => runRegSearch(e.target.value));

  async function openForm(chan) {
    regSearchBox.style.display = "none";
    regFormBox.style.display = "block";
    regFormBox.innerHTML = `<div class="empty">기존 정보 확인 중...</div>`;

    let existing = null;
    try {
      existing = await Firestore.getDoc("vtubers", chan.channelId);
    } catch (_) {}
    const v = existing || {};

    const img = v.profileImage || chan.image || "";
    regFormBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        ${img ? `<img src="${escapeAttr(img)}" style="width:44px;height:44px;border-radius:50%">` : ""}
        <h3 style="margin:0">${escapeHtml(chan.name)} 등록/수정</h3>
      </div>
      <label>이름</label>
      <input id="f-name" value="${escapeAttr(v.name || chan.name)}">
      <label>생일 (MM-DD)</label>
      <input id="f-bd" value="${escapeAttr(v.birthday || "")}" placeholder="예: 03-21">
      <label>데뷔일 (YYYY-MM-DD)</label>
      <input id="f-debut" value="${escapeAttr(v.debutDate || "")}" placeholder="예: 2023-08-15">
      <label>방송 일정</label>
      <input id="f-sch" value="${escapeAttr(v.schedule || "")}" placeholder="예: 월·수·금 저녁 8시">
      <label>트위터/X URL</label>
      <input id="f-tw" value="${escapeAttr(v.twitter || "")}" placeholder="https://x.com/...">
      <button class="btn" id="f-save">저장</button>
      <button class="link" id="f-back">← 검색으로</button>
      <div id="f-msg" class="status"></div>
    `;
    document.getElementById("f-back").onclick = backToSearch;
    document.getElementById("f-save").onclick = () => saveForm(chan);
  }

  function backToSearch() {
    regFormBox.style.display = "none";
    regFormBox.innerHTML = "";
    regSearchBox.style.display = "block";
  }

  function fval(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  async function saveForm(chan) {
    const btn = document.getElementById("f-save");
    const msg = document.getElementById("f-msg");
    btn.disabled = true;
    btn.textContent = "확인 중...";

    // 치지직 로그인 필수
    if (!me.loggedIn || !me.userHashId) {
      try {
        me = await Chzzk.getCurrentUser();
      } catch (_) {}
    }
    if (!me.loggedIn || !me.userHashId) {
      msg.className = "status warn";
      msg.textContent = "치지직 로그인이 필요합니다. 치지직에 로그인 후 다시 시도하세요.";
      btn.disabled = false;
      btn.textContent = "저장";
      return;
    }

    const data = {
      name: fval("f-name") || chan.name,
      birthday: Anniversary.normalize(fval("f-bd")),
      debutDate: Anniversary.normalize(fval("f-debut")),
      schedule: fval("f-sch"),
      twitter: fval("f-tw"),
      profileImage: chan.image || "",
      channelId: chan.channelId,
      channelUrl: `https://chzzk.naver.com/${chan.channelId}`,
      editorHash: me.userHashId,
      editorNick: me.nickname || "",
      updatedAt: new Date().toISOString(),
    };

    btn.textContent = "저장 중...";
    try {
      const idToken = await FbAuth.getToken();
      await Firestore.setDoc("vtubers", chan.channelId, data, idToken);
      // 홈 목록 강제 갱신(방금 저장 반영) 후 검색 화면으로 복귀
      await loadHome(true);
      backToSearch();
      regSearchEl.value = "";
      regResultsEl.innerHTML = "";
      regSearchEl.focus();
    } catch (e) {
      msg.className = "status warn";
      msg.textContent = "저장 실패: " + e.message;
      btn.disabled = false;
      btn.textContent = "저장";
      console.error("[chzzk-my-wife]", e);
    }
  }

  // 시작
  loadHome();
})();
