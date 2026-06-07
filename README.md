# 💍 chzzk-my-wife (치지직 "내 아내임")

치지직 버튜버의 **생일·데뷔일·방송 일정·프로필**을 함께 기록하고,
같은 확장을 쓰는 사람들끼리 **중앙 DB로 공유**하는 크롬 확장입니다.

> "내 아내임" 밈에서 출발 — 기억은 휘발되니까, 기념일은 다 같이 챙기자.

## 동작 방식

- **확장 (Chrome MV3)**: UI 담당. 치지직 채널 페이지에 정보 카드 오버레이 + 팝업에서 다가오는 기념일/검색.
- **Firebase Firestore (무료 티어)**: 중앙 공유 DB. 서버를 직접 돌리지 않고 REST API를 `fetch`로 호출 (SDK·빌드 불필요).
- **기념일 알림**: 백그라운드에서 하루 한 번 확인 → 오늘/내일 생일·데뷔일이면 데스크톱 알림.

```
manifest.json          확장 설정 (MV3) — 루트 고정
config.js              Firebase 설정 (본인 값으로 채움 — config.example.js 참고)
config.example.js      설정 템플릿
assets/
  icon.png             아이콘
lib/                   공용 라이브러리 (content/popup/calendar/background가 공유)
  firestore.js         Firestore REST 클라이언트 (SDK 없이)
  anniversary.js       생일/데뷔일 D-day · N주년 계산 · 입력 정규화
  auth.js              Firebase 익명 인증 (REST, 토큰 캐시)
  chzzk.js             치지직 로그인 사용자 / 채널 검색 / 채널 조회
background/
  background.js        기념일 알림 (alarms + notifications)
content/
  content.js / .css    치지직 페이지 오버레이 카드 (조회/등록/수정)
popup/
  popup.html / .js     팝업: 다가오는 기념일 + 목록(페이지네이션) + 스트리머 등록
calendar/
  calendar.html / .js  월별 기념일 캘린더 (전체 화면 탭)
```

> 경로 규칙: `manifest.json`·`config.js`·`lib/`는 루트 기준. 각 기능 폴더(popup/calendar/background)의 스크립트는 `../`로 루트의 config·lib를 참조합니다.

## 데이터 모델 (Firestore `vtubers` 컬렉션)

문서 ID = 치지직 채널 해시. 각 문서:

| 필드 | 예시 | 설명 |
|------|------|------|
| `name` | "○○○" | 버튜버 이름 |
| `birthday` | "03-21" | 생일 (MM-DD, 연도 생략 가능) |
| `debutDate` | "2023-08-15" | 데뷔일 (YYYY-MM-DD) |
| `schedule` | "월·수·금 저녁 8시" | 방송 일정 (자유 텍스트) |
| `twitter` | "https://x.com/..." | SNS 링크 |
| `profileImage` | "https://..." | 채널 프로필 사진 (치지직 API) |
| `channelId` / `channelUrl` | | 치지직 채널 |
| `editorHash` | 치지직 userIdHash | 마지막 수정자 (구분용) |
| `editorNick` | "○○○" | 마지막 수정자 닉네임 |
| `updatedAt` | ISO 문자열 | 마지막 수정 시각 |

## 인증 / 권한 구조

- **읽기**: 누구나 (로그인 불필요). 팝업·카드 조회는 토큰 없이 동작.
- **쓰기**: 두 가지를 동시에 요구
  1. **Firebase 익명 인증 토큰** — Firestore 규칙이 `request.auth != null`로 강제. (앱을 거치지 않은 무단 쓰기 차단)
  2. **치지직 로그인** — `getUserStatus` API로 `userIdHash`를 읽어 작성자(`editorHash`)로 기록. 미로그인 시 확장이 수정 버튼을 막음.

> ⚠️ 한계: "치지직 로그인 필수"는 **클라이언트 단 강제**입니다. Firestore 규칙은 치지직 로그인을 알 수 없어,
> 결연한 공격자는 익명 토큰만으로 직접 쓰기가 가능합니다. 강화하려면 Cloud Functions로 치지직 토큰을
> 검증해 커스텀 클레임을 주거나, App Check를 도입하세요. (MVP는 여기까지)

## 설치 / 설정

### 1. Firebase 프로젝트 만들기 (무료)

1. https://console.firebase.google.com → **프로젝트 추가**
2. 좌측 **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 선택 → **테스트 모드로 시작** (나중에 규칙 강화)
3. 좌측 톱니 **프로젝트 설정 → 일반** 탭에서:
   - **프로젝트 ID** 복사
   - 하단 "내 앱"에서 **웹 앱(`</>`) 추가** → 표시되는 `apiKey` 복사

### 2. 익명 인증 켜기 (필수)

콘솔 **빌드 → Authentication → 시작하기 → 로그인 방법** 탭 →
**익명(Anonymous)** 선택 → **사용 설정** ON → 저장.
(이게 꺼져 있으면 쓰기 시 "익명 로그인 실패" 에러가 납니다.)

### 3. config.js 채우기

`config.js`는 이미 본 프로젝트(`chzzk-eecb7`) 값으로 채워져 있습니다.
다른 Firebase 프로젝트를 쓰려면 `config.example.js`를 참고해 교체하세요.

### 4. Firestore 보안 규칙

콘솔 **Firestore → 규칙**에 아래를 넣으세요.
읽기는 공개, 쓰기는 **익명 토큰 + 작성자(editorHash) 기록**을 요구합니다:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /vtubers/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && request.resource.data.name is string
        && request.resource.data.name.size() < 100
        && request.resource.data.editorHash is string;
    }
  }
}
```

### 5. 확장 로드

1. 크롬 `chrome://extensions` → 우상단 **개발자 모드** ON
2. **압축해제된 확장 프로그램을 로드** → 이 폴더 선택
3. 치지직 채널/방송 페이지를 열면 우하단에 정보 카드가 뜹니다.

## 로드맵

- [x] 익명 인증 + 치지직 userIdHash로 작성자 기록
- [ ] 수정 이력 (변경 전후 + 시각을 별도 컬렉션에 누적)
- [ ] 정기 방송 요일/시간 구조화 → "다음 방송까지 D-day"
- [ ] 즐겨찾기(내 최애) 별도 알림
- [ ] 데뷔 N주년 카운트다운 위젯
