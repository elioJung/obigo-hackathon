# 서울 교통 시각화 — 데이터 가이드

## 한 줄 요약

| 모드 | 도로 색상 데이터 | 타임라인 바 데이터 |
|------|----------------|-----------------|
| **실시간** | Seoul OpenAPI TrafficInfo (56개 링크 실측 속도) | Seoul OpenAPI VolInfo (시간별 교통량) |
| **이력 시간대** | TOPIS DailyRoadStats (T0/T1/T2/T3 그룹 평균속도) | 동일 VolInfo |

---

## 데이터 소스

### 1. Seoul Open Data API (`openapi.seoul.go.kr`)
**인증키**: `SEOUL_TRAFFIC_KEY` (서버 전용)

| API | 데이터 | 갱신 주기 |
|-----|--------|----------|
| `TrafficInfo` | 56개 링크 실시간 속도 (km/h) | 30초마다 폴링 |
| `VolInfo` | 10개 관측소 시간별 교통량 (대/시간) | 로딩 중 3초, 완료 후 60초 |

### 2. TOPIS (`t-data.seoul.go.kr`)
**인증키**: `TOPIS_API_KEY` (서버 전용)

| API | 데이터 | 시간 단위 | 상태 |
|-----|--------|----------|------|
| `TopisIccStDailyRoadTrfRoadStats` | 도로축별 평균속도 | **4개 그룹** (T0/T1/T2/T3) | ✅ 사용 중 |
| `TopisIccStTimesLinkTrfSectionStats` | 링크별 시간별 속도 | 24시간 개별 | ❌ 최근 데이터 없음 |

> **중요**: `TopisIccStTimesLinkTrfSectionStats`는 구현은 되어 있으나 최근 날짜 데이터를 반환하지 않아 미사용. 대신 T0/T1/T2/T3 그룹 데이터를 사용.

### 3. 정적 CSV 파일 (`/src/data/`)

| 파일 | 내용 | 컬럼 |
|------|------|------|
| `seoul-nodes.csv` | 교차로 좌표 | col0=nodeId, col6=lng, col7=lat |
| `seoul-links.csv` | 도로 링크 정의 | col24=linkId, col1=startNode, col2=endNode, col9=roadName |
| `seoul-axis-links.csv` | 도로축↔링크 매핑 | col0=axisCd, col4=linkId |

---

## API 라우트

### `/api/traffic/seoul` → 실시간 속도
```
TrafficInfo API (×56 링크) → { LINK_ID, PRCS_SPD } 배열
→ lib/traffic.ts의 fetchSeoulTraffic()에서 파싱
→ SeoulTrafficSummary { averageSpeed, smoothPct, ..., linkSpeeds: { linkId: km/h } }
```

### `/api/traffic/daily` → 시간별 교통량
```
VolInfo API (×10 관측소 ×현재시간) → 시간별 합산
→ DailyData { hours: [ { hh, vol, intensity: 0~1, source } ], loading }
→ intensity = vol / 오늘최대값 (최소 0.05)
```

### `/api/topis/network` → 도로 네트워크 GeoJSON
```
seoul-nodes.csv + seoul-links.csv 파싱 (서버 메모리 캐시)
→ GeoJSON FeatureCollection (13,277개 LineString)
→ 각 feature: { linkId, roadName, roadRankCd, maxSpd, speed: -1 }
```

### `/api/topis/road-stats?date=YYYYMMDD&tg=T0|T1|T2|T3` → 이력 속도
```
TopisIccStDailyRoadTrfRoadStats (최근 180일 중 데이터 있는 날)
+ seoul-axis-links.csv (axisCd → linkId 조인)
→ { speeds: { linkId: avgSpd(km/h) }, date, loading }
```

---

## 프론트엔드 데이터 흐름

```
TrafficDashboard
  │
  ├─ [30초 폴링] fetchSeoulTraffic()
  │    → liveTraffic.linkSpeeds { linkId: speed }   ← 실시간 도로 색상
  │
  ├─ [3~60초 폴링] fetchDailyData()
  │    → daily.hours[0..23].intensity               ← 타임라인 바 높이
  │
  ├─ [시간대 선택 시] /api/topis/road-stats?tg=T1
  │    → historicalSpeeds { linkId: speed }          ← 이력 도로 색상
  │
  └─ linkSpeeds = isLive ? liveTraffic.linkSpeeds : historicalSpeeds
       ↓
     SeoulMap
       └─ network GeoJSON (13,277 링크)
          + linkSpeeds 주입 → feature.properties.speed
          → 도로별 색상 렌더링
```

---

## 지도 도로 색상 매핑

```
속도 (km/h)   색상
   0  →  #cc0000  ██  극심한 정체 (빨강)
  10  →  #ff3300  ██
  20  →  #ff9900  ██  혼잡 (주황)
  30  →  #ffbb00  ██  서행 (노랑)
  38  →  #99cc22  ██  준원활 (연두)
  55  →  #44aaff  ██  원활 (파랑)
  80  →  #aaddff  ██  쾌속 (하늘)
  -1  →  투명     ··  데이터 없음 (기본 지도 표시)
```

---

## 시간대 그룹 (T0~T3)

TOPIS DailyRoadStats는 **4개 시간대 그룹**으로만 데이터를 제공합니다.
24시간 개별 속도 데이터는 현재 미지원.

| 그룹 | 시간 범위 | 의미 |
|------|----------|------|
| T0 | 06~22시 | 전일 평균 |
| T1 | 07~09시 | **오전 첨두** (출근) |
| T2 | 10~16시 | 낮 |
| T3 | 17~19시 | **오후 첨두** (퇴근) |

---

## 커버리지 현황

| 데이터 | 커버 링크 수 | 비고 |
|--------|------------|------|
| 실시간 TrafficInfo | **139개** | 56개 링크 ID → 매핑 후 |
| 이력 DailyRoadStats | **11,713개** | 전체 13,277개 중 88% |
| 미매핑 | 1,564개 | 교통 센서 없는 도로 |

---

## 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_MAPTILER_KEY=  # 지도 타일 (없으면 OpenFreeMap 폴백)
SEOUL_TRAFFIC_KEY=         # Seoul Open Data TrafficInfo/VolInfo
TOPIS_API_KEY=             # TOPIS 도로 통계
```

---

## 알려진 제약사항

1. **시간별 도로 속도 없음**: TOPIS 시간별 API(`TopisIccStTimesLinkTrfSectionStats`)가 최근 날짜 데이터를 반환하지 않아 T0/T1/T2/T3 4개 그룹만 사용 가능
2. **이력 데이터 시간 지연**: TOPIS 일별 데이터는 1~2일 후 집계 → 어제 이전 날짜 기준
3. **실시간 링크 제한**: Seoul TrafficInfo는 56개 링크만 지원 (서울 전체 대비 낮은 커버리지)
4. **지도 스타일 API 키 필요**: MapTiler 무료 키 없으면 OpenFreeMap 기본 스타일 사용
