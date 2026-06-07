// lib/firestore.js — Firestore REST API 경량 클라이언트
// Firebase SDK 없이 fetch만 사용 (MV3에서 번들/빌드 불필요).
// 사용: Firestore.listDocs("vtubers"), Firestore.getDoc("vtubers", id),
//       Firestore.setDoc("vtubers", id, {...})
(function () {
  const cfg = globalThis.CHZZK_WIFE_CONFIG || {};
  const BASE = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;

  function buildUrl(path, params = {}) {
    const usp = new URLSearchParams();
    if (cfg.apiKey) usp.set("key", cfg.apiKey);
    for (const [k, v] of Object.entries(params)) usp.set(k, v);
    const qs = usp.toString();
    return `${BASE}/${path}${qs ? `?${qs}` : ""}`;
  }

  // JS 값 -> Firestore typed value
  function encode(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number")
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    if (typeof value === "string") return { stringValue: value };
    if (Array.isArray(value))
      return { arrayValue: { values: value.map(encode) } };
    if (typeof value === "object")
      return { mapValue: { fields: encodeFields(value) } };
    return { stringValue: String(value) };
  }
  function encodeFields(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) fields[k] = encode(v);
    return fields;
  }

  // Firestore typed value -> JS 값
  function decode(value) {
    if (!value) return null;
    if ("nullValue" in value) return null;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("stringValue" in value) return value.stringValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
    if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
    return null;
  }
  function decodeFields(fields) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) obj[k] = decode(v);
    return obj;
  }

  function docId(doc) {
    return doc.name ? doc.name.split("/").pop() : null;
  }
  function toRecord(doc) {
    return { id: docId(doc), ...decodeFields(doc.fields || {}) };
  }

  async function listDocs(collection) {
    const out = [];
    let pageToken = "";
    do {
      const params = { pageSize: "300" };
      if (pageToken) params.pageToken = pageToken;
      const res = await fetch(buildUrl(collection, params));
      if (!res.ok) throw new Error(`Firestore list ${collection} 실패: ${res.status}`);
      const data = await res.json();
      for (const doc of data.documents || []) out.push(toRecord(doc));
      pageToken = data.nextPageToken || "";
    } while (pageToken);
    return out;
  }

  async function getDoc(collection, id) {
    const res = await fetch(buildUrl(`${collection}/${encodeURIComponent(id)}`));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore get ${collection}/${id} 실패: ${res.status}`);
    return toRecord(await res.json());
  }

  // 문서 전체를 덮어씀 (id 고정). 부분 업데이트가 필요하면 updateMask 사용.
  // 쓰기는 idToken 필요 (FbAuth.getToken). 규칙에서 request.auth != null 검증.
  async function setDoc(collection, id, data, idToken) {
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(
      buildUrl(`${collection}/${encodeURIComponent(id)}`),
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields: encodeFields(data) }),
      }
    );
    if (!res.ok) throw new Error(`Firestore set ${collection}/${id} 실패: ${res.status}`);
    return toRecord(await res.json());
  }

  globalThis.Firestore = { listDocs, getDoc, setDoc, encode, decode };
})();
