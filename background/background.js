// background.js — 하루 한 번 기념일을 확인해서 데스크톱 알림
importScripts("../config.js", "../lib/firestore.js", "../lib/anniversary.js");

const ALARM = "cmw-daily-check";

// 매일 오전 9시쯤 체크 (설치 직후 1회 + 24시간 주기)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 60 * 24 });
  checkAnniversaries();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 60 * 24 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) checkAnniversaries();
});

async function checkAnniversaries() {
  try {
    const vtubers = await Firestore.listDocs("vtubers");
    // 오늘(D-0)과 내일(D-1) 기념일만 알림
    const events = Anniversary.upcoming(vtubers, 1);
    if (!events.length) return;

    // 같은 날 중복 알림 방지
    const today = new Date().toISOString().slice(0, 10);
    const { lastNotified } = await chrome.storage.local.get("lastNotified");
    if (lastNotified === today) return;

    const lines = events.map((e) => {
      const when = e.days === 0 ? "오늘" : "내일";
      const cnt = e.count ? ` ${e.count}주년` : "";
      return `${e.vtuber.name || e.vtuber.id} ${e.type}${cnt} (${when})`;
    });

    chrome.notifications.create(`cmw-${today}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icon.png"),
      title: "💍 내 아내 기념일 알림",
      message: lines.join("\n"),
      priority: 2,
    });
    await chrome.storage.local.set({ lastNotified: today });
  } catch (e) {
    console.error("[chzzk-my-wife] 기념일 체크 실패", e);
  }
}
