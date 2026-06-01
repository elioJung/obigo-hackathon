# 서울 교통 시각화 · Seoul Traffic Visualization

서울 도심 실시간 교통 상황을 3D 씨티맵 위에 시각화하는 웹 대시보드입니다.

![Seoul Traffic](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs) ![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-5-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

**🌐 Live Demo**: https://obigo-hackathon.vercel.app/

> ℹ️ **데이터 기준**: 시간대별(출근·낮·퇴근) 통계는 **전일 기준** 데이터를 표시합니다. TOPIS 일별 통계 API는 당일 데이터를 제공하지 않습니다.
> 데이터가 표시되지 않을 경우, 좌측 **"테스트 데이터"** 버튼(보라색)을 클릭하면 즉시 시각화를 확인할 수 있습니다.

---

## 참여 인원
| 이름 | 소속 | 직함 | 역할 |
|------|------|------|------|
| Elio.Jung (정영준) | 오비고 | 프론트엔드 개발자 | 팀장 |
| Dennis.Han (한호수) | 오비고 | 프론트엔드 개발자 | 팀원 |

## 🚀 개발 과정

**빠른 프로토타이핑 → AI 기반 반복 개발**

1. **Replit**: 초기 아이디어를 빠르게 코드로 구현
2. **Claude Code**: 프로토타입을 받아 실제 배포 가능한 수준으로 개선
   - API 연동 최적화 (폴링 간격 조정: 실시간 3분, 일별 5분)
   - 반응형 UI/UX 개선 (위젯 크기 1.75배 증가)
   - 국제화(i18n) 적용 (한국어/영어)
   - 모바일 차단 및 PC 전용 모드
   - 인트로 영상을 활용한 로딩 UX

**결과**: 실제 작동하는 라이브 데모 배포 완료

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 교통** | TOPIS API 기반 서울 5,800+ 도로 링크 속도 (60초 갱신) |
| **시간대별 조회** | 전일 기준 출근(07-09), 낮(10-16), 퇴근(17-19) 통계 |
| **도로 색상 시각화** | 속도 0~90 km/h 구간별 그라디언트 (정체→원활) |
| **3D 씨티맵** | MapLibre GL + MapTiler 벡터 타일, SimCity 스타일 |
| **오늘 교통량 차트** | 실시간 모드 한정 · 24시간 시간별 막대그래프 |
| **데이터 캐싱** | 전일 시간대 데이터 재요청 없음 (Map 기반 메모리 캐시) |
| **국제화 (i18n)** | 한국어 / 영어 (`next-intl`) |

---

## 기술 스택

- **Framework** — Next.js 15 (App Router)
- **Map** — MapLibre GL JS 5, MapTiler OpenMapTiles v3
- **Data** — 서울시 TOPIS 실시간 교통 API, TOPIS 도로 통계 API
- **i18n** — next-intl
- **Language** — TypeScript 5
- **Package Manager** — pnpm

---

## 시작하기

### 환경 변수

`.env.local` 파일을 생성하고 아래 값을 설정합니다.

```env
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_api_key
TOPIS_API_KEY=your_topis_api_key
SEOUL_TRAFFIC_KEY=your_seoul_traffic_api_key
```

- **MapTiler API Key** — [MapTiler Cloud](https://cloud.maptiler.com/) 가입 후 발급
- **TOPIS API Key** — [서울교통빅데이터플랫폼](https://t-data.seoul.go.kr/) 신청
- **Seoul Traffic API Key** — [서울 열린데이터 광장](https://data.seoul.go.kr/) 신청

### 설치 및 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000` 접속

### 프로덕션 빌드

```bash
pnpm build
pnpm start
```

---

## 화면 구성

```
┌─────────────────────────────────────────────────────┐
│ [서울 교통 시각화]              [시각 / 시간대 배지] │
│                                  [오늘 교통량 차트]  │
│  [실시간   ●]                                        │
│  [출근 시간]        3D 서울 씨티맵                   │
│  [낮 시간  ]        (도로 색상 = 속도)               │
│  [퇴근 시간]                                         │
│                                                      │
│  [◎]                           [속도 범례 0~90km/h] │
└─────────────────────────────────────────────────────┘
```

### 버튼 상태 표시

| 표시 | 의미 |
|------|------|
| 초록 점 `●` | 실시간 데이터 수신 완료 |
| 노란 깜빡임 | 데이터 로딩 중 |

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── topis/          # TOPIS 도로 속도·통계 API 프록시
│   │   └── traffic/        # 실시간 교통·일별 데이터 API
│   ├── layout.tsx           # NextIntlClientProvider 포함
│   └── page.tsx
├── components/
│   ├── SeoulMap.tsx         # MapLibre GL 지도 + 교통 레이어
│   ├── TrafficDashboard.tsx # 전체 레이아웃, 상태 관리
│   ├── TrafficPanel.tsx     # 우측 상단 정보 카드
│   └── TimeGroupSelector.tsx # 좌측 시간대 선택 버튼
├── i18n/
│   └── request.ts           # next-intl 서버 설정
└── lib/
    ├── traffic.ts           # 속도 → 색상 변환, API fetch
    └── types.ts             # 공통 타입 정의
messages/
├── ko.json                  # 한국어
└── en.json                  # English
```

---

## 도로 색상 기준

| 속도 | 색상 | 상태 |
|------|------|------|
| 0 km/h | 진한 빨강 | 완전 정체 |
| ~20 km/h | 빨강 계열 | 극심한 혼잡 |
| ~30 km/h | 주황 | 혼잡 |
| ~35 km/h | 노랑 | 서행 |
| ~45 km/h | 연두 / 초록 | 준원활 |
| 55 km/h+ | 하늘색 | 원활 |

---

## 라이선스

MIT
