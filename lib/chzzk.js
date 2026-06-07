// lib/chzzk.js — 현재 치지직 로그인 사용자 식별
// content script(치지직 도메인)에서 호출해야 쿠키가 같이 전송됨.
// getUserStatus 응답의 userIdHash 로 사용자를 구분한다.
(function () {
  let cached = null;

  async function getCurrentUser() {
    if (cached) return cached;
    try {
      const res = await fetch(
        "https://comm-api.game.naver.com/nng_main/v1/user/getUserStatus",
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`getUserStatus ${res.status}`);
      const data = await res.json();
      const c = (data && data.content) || {};
      cached = {
        loggedIn: !!c.loggedIn,
        userHashId: c.userIdHash || null,
        nickname: c.nickname || null,
      };
      return cached;
    } catch (e) {
      console.error("[chzzk-my-wife] 치지직 로그인 확인 실패", e);
      return { loggedIn: false, userHashId: null, nickname: null };
    }
  }

  // 이름으로 치지직 채널 검색 → [{channelId, name, image, followers}]
  async function searchChannels(keyword, size) {
    keyword = (keyword || "").trim();
    if (!keyword) return [];
    const url =
      "https://api.chzzk.naver.com/service/v1/search/channels?keyword=" +
      encodeURIComponent(keyword) +
      "&offset=0&size=" +
      (size || 12);
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`치지직 검색 실패: ${res.status}`);
    const data = await res.json();
    const items = (data && data.content && data.content.data) || [];
    return items
      .map((it) => it.channel || it)
      .filter((c) => c && c.channelId)
      .map((c) => ({
        channelId: c.channelId,
        name: c.channelName || "",
        image: c.channelImageUrl || "",
        followers: c.followerCount || 0,
      }));
  }

  // 채널 ID로 채널 정보 조회 (프로필 이미지/이름)
  async function getChannel(channelId) {
    if (!channelId) return null;
    try {
      const res = await fetch(
        "https://api.chzzk.naver.com/service/v1/channels/" + encodeURIComponent(channelId)
      );
      if (!res.ok) throw new Error(`getChannel ${res.status}`);
      const data = await res.json();
      const c = (data && data.content) || {};
      return {
        channelId: c.channelId || channelId,
        name: c.channelName || "",
        image: c.channelImageUrl || "",
      };
    } catch (e) {
      console.error("[chzzk-my-wife] 채널 조회 실패", e);
      return null;
    }
  }

  globalThis.Chzzk = { getCurrentUser, searchChannels, getChannel };
})();
