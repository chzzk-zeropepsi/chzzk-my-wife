// lib/auth.js — Firebase 익명 인증 (REST, SDK 없이)
// 쓰기 작업에 필요한 idToken을 발급/갱신/캐시.
// Firestore 규칙에서 request.auth != null 을 통과시키기 위한 용도.
// ⚠️ Firebase 콘솔 → Authentication → 로그인 방법 → "익명" 사용 설정 필요.
(function () {
  const cfg = globalThis.CHZZK_WIFE_CONFIG || {};
  const KEY = cfg.apiKey;
  const STORE = "fbAuth";

  async function readCache() {
    const o = await chrome.storage.local.get(STORE);
    return o[STORE] || null;
  }
  async function writeCache(v) {
    await chrome.storage.local.set({ [STORE]: v });
  }

  async function signUpAnonymous() {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    if (!res.ok) throw new Error(`익명 로그인 실패: ${res.status} (콘솔에서 익명 인증을 켰는지 확인)`);
    const d = await res.json();
    return {
      idToken: d.idToken,
      refreshToken: d.refreshToken,
      uid: d.localId,
      expiresAt: Date.now() + Number(d.expiresIn) * 1000,
    };
  }

  async function refresh(refreshToken) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`토큰 갱신 실패: ${res.status}`);
    const d = await res.json();
    return {
      idToken: d.id_token,
      refreshToken: d.refresh_token,
      uid: d.user_id,
      expiresAt: Date.now() + Number(d.expires_in) * 1000,
    };
  }

  // 유효한 idToken을 반환 (필요 시 갱신/신규 발급)
  async function getToken() {
    let auth = await readCache();
    const fresh = (a) => a && a.expiresAt > Date.now() + 60000;
    if (fresh(auth)) return auth.idToken;
    try {
      if (auth && auth.refreshToken) auth = await refresh(auth.refreshToken);
      else auth = await signUpAnonymous();
    } catch (e) {
      // 갱신 실패 시 신규 발급으로 폴백
      auth = await signUpAnonymous();
    }
    await writeCache(auth);
    return auth.idToken;
  }

  async function getUid() {
    await getToken();
    const auth = await readCache();
    return auth ? auth.uid : null;
  }

  globalThis.FbAuth = { getToken, getUid };
})();
