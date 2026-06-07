// content.js — 치지직 채널/방송 페이지에서 버튜버 정보 카드를 띄움
(function () {
  // 채널 홈에서만 카드 표시.
  // O: https://chzzk.naver.com/{streamerHash}
  // X: /live/.., /video/.., /{hash}/community 등 다른 모든 링크
  function getChannelId() {
    const seg = location.pathname.split("/").filter(Boolean);
    // 세그먼트가 정확히 1개이고 그것이 채널 해시일 때만
    if (seg.length === 1 && /^[0-9a-f]{20,}$/i.test(seg[0])) return seg[0];
    return null;
  }

  // 페이지에서 보이는 채널명 추정 (없으면 빈 문자열)
  function guessChannelName() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return og.content.replace(/\s*-\s*치지직.*$/, "").trim();
    return document.title.replace(/\s*[-|].*$/, "").trim();
  }

  function ddayText(days) {
    if (days == null) return "-";
    if (days === 0) return "오늘! 🎉";
    return `D-${days}`;
  }

  function row(label, valueHtml) {
    return `<div class="cmw-row"><span class="cmw-label">${label}</span><span>${valueHtml}</span></div>`;
  }

  function setAvatar(card, v) {
    const img = card.querySelector(".cmw-avatar");
    if (img && v && v.profileImage) {
      img.src = v.profileImage;
      img.style.display = "";
    }
  }

  function renderInfo(card, channelId, v) {
    setAvatar(card, v);
    const body = card.querySelector(".cmw-body");
    if (!v) {
      body.innerHTML =
        `<div class="cmw-empty">아직 등록된 정보가 없어요.<br>처음으로 채워주실래요?</div>` +
        `<button class="cmw-edit">＋ 정보 추가하기</button>`;
      body.querySelector(".cmw-edit").onclick = () => renderForm(card, channelId, { id: channelId });
      return;
    }
    const bd = Anniversary.parseMonthDay(v.birthday);
    const dv = Anniversary.parseMonthDay(v.debutDate);
    const bdDays = bd ? Anniversary.daysUntil(bd) : null;
    const dvDays = dv ? Anniversary.daysUntil(dv) : null;

    let html = "";
    if (v.birthday)
      html += row("🎂 생일", `${v.birthday} <span class="cmw-dday">${ddayText(bdDays)}</span>`);
    if (v.debutDate) {
      const cnt = Anniversary.anniversaryCount(dv);
      const cntLabel = cnt ? ` (${cnt}주년)` : "";
      html += row("✨ 데뷔일", `${v.debutDate} <span class="cmw-dday">${ddayText(dvDays)}${cntLabel}</span>`);
    }
    if (v.schedule) html += row("📅 일정", escapeHtml(v.schedule));
    if (v.twitter)
      html += row("🐦 트위터", `<a href="${escapeAttr(v.twitter)}" target="_blank" style="color:#00ffa3">link</a>`);
    if (!html) html = `<div class="cmw-empty">등록된 항목이 없어요.</div>`;
    // editorNick은 기록만 하고 화면에는 표시하지 않음
    body.innerHTML = html + `<button class="cmw-edit">✎ 정보 수정</button>`;
    body.querySelector(".cmw-edit").onclick = () => renderForm(card, channelId, v);
  }

  function renderForm(card, channelId, v) {
    const body = card.querySelector(".cmw-body");
    v = v || {};
    body.innerHTML = `
      <label class="cmw-label">이름</label>
      <input id="cmw-name" value="${escapeAttr(v.name || guessChannelName())}" placeholder="버튜버 이름">
      <label class="cmw-label">생일 (MM-DD)</label>
      <input id="cmw-bd" value="${escapeAttr(v.birthday || "")}" placeholder="예: 03-21">
      <label class="cmw-label">데뷔일 (YYYY-MM-DD)</label>
      <input id="cmw-debut" value="${escapeAttr(v.debutDate || "")}" placeholder="예: 2023-08-15">
      <label class="cmw-label">방송 일정</label>
      <input id="cmw-sch" value="${escapeAttr(v.schedule || "")}" placeholder="예: 월·수·금 저녁 8시">
      <label class="cmw-label">트위터/X URL</label>
      <input id="cmw-tw" value="${escapeAttr(v.twitter || "")}" placeholder="https://x.com/...">
      <button class="cmw-edit" id="cmw-save">저장</button>
      <button class="cmw-mini" id="cmw-cancel" style="margin-top:6px">취소</button>
    `;
    body.querySelector("#cmw-cancel").onclick = () => load(card, channelId);
    body.querySelector("#cmw-save").onclick = async () => {
      const btn = body.querySelector("#cmw-save");
      btn.textContent = "확인 중...";
      btn.disabled = true;

      // 1) 치지직 로그인 필수 — userHashId로 작성자 구분
      const me = await Chzzk.getCurrentUser();
      if (!me.loggedIn || !me.userHashId) {
        btn.textContent = "치지직 로그인 필요";
        btn.disabled = false;
        return;
      }

      btn.textContent = "저장 중...";
      // 프로필 이미지는 치지직 채널 API에서 가져옴 (기존 값이 있으면 유지)
      let profileImage = (v && v.profileImage) || "";
      const chan = await Chzzk.getChannel(channelId);
      if (chan && chan.image) profileImage = chan.image;

      const data = {
        name: val("cmw-name"),
        birthday: Anniversary.normalize(val("cmw-bd")),
        debutDate: Anniversary.normalize(val("cmw-debut")),
        schedule: val("cmw-sch"),
        twitter: val("cmw-tw"),
        profileImage,
        channelId,
        channelUrl: `https://chzzk.naver.com/${channelId}`,
        editorHash: me.userHashId,
        editorNick: me.nickname || "",
        updatedAt: new Date().toISOString(),
      };
      try {
        // 2) Firebase 익명 토큰으로 쓰기 (규칙: request.auth != null)
        const idToken = await FbAuth.getToken();
        await Firestore.setDoc("vtubers", channelId, data, idToken);
        renderInfo(card, channelId, data);
      } catch (e) {
        btn.textContent = "저장 실패 (다시)";
        btn.disabled = false;
        console.error("[chzzk-my-wife]", e);
      }
    };
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  async function load(card, channelId) {
    const body = card.querySelector(".cmw-body");
    body.innerHTML = `<div class="cmw-empty">불러오는 중...</div>`;
    try {
      const v = await Firestore.getDoc("vtubers", channelId);
      renderInfo(card, channelId, v);
    } catch (e) {
      body.innerHTML = `<div class="cmw-empty">불러오기 실패.<br>config.js의 Firebase 설정을 확인하세요.</div>`;
      console.error("[chzzk-my-wife]", e);
    }
  }

  function mountCard(channelId) {
    if (document.getElementById("cmw-card")) return;
    const card = document.createElement("div");
    card.id = "cmw-card";
    card.innerHTML = `
      <div class="cmw-head">
        <img class="cmw-avatar" alt="" style="display:none">
        <span class="cmw-title">${escapeHtml(guessChannelName() || "내 아내임")}</span>
        <button title="닫기">×</button>
      </div>
      <div class="cmw-body"></div>
    `;
    card.querySelector(".cmw-head button").onclick = () => card.remove();
    document.body.appendChild(card);
    load(card, channelId);
  }

  // SPA(치지직)라 URL이 바뀌어도 페이지 리로드가 안 됨 → 주기적으로 채널 변화 감지
  let lastChannel = null;
  function removeCard() {
    const existing = document.getElementById("cmw-card");
    if (existing) existing.remove();
  }

  function tick() {
    const ch = getChannelId();
    if (ch && ch !== lastChannel) {
      lastChannel = ch;
      removeCard();
      mountCard(ch);
    } else if (!ch) {
      // 채널 홈이 아니면 카드 숨김
      lastChannel = null;
      removeCard();
    }
  }
  setInterval(tick, 1500);
  tick();
})();
