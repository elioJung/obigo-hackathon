import { NextResponse, type NextRequest } from 'next/server';

const BASE = 'http://t-data.seoul.go.kr/apig/apiman-gateway/tapi';
const PAGE = 1000;

// null = loaded but no data; Map = has data
const trafficCache: Record<string, Map<number, Map<string, number>> | null> = {};
const loadingDates = new Set<string>();

function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
}

function dateFromYmd(s: string): Date {
  return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
}

async function loadDay(key: string, date: string) {
  if (date in trafficCache || loadingDates.has(date)) return;
  loadingDates.add(date);

  const hourMap = new Map<number, Map<string, number>>();
  let startRow = 1, total = 0;

  try {
    while (true) {
      const url = `${BASE}/TopisIccStTimesLinkTrfSectionStats/1.0?apikey=${key}&stndDt=${date}&startRow=${startRow}&rowCnt=${PAGE}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.warn(`[traffic] ${date} HTTP ${res.status}`); break; }

      const body = await res.json();
      if (startRow === 1) console.log(`[traffic] ${date} p1: ${Array.isArray(body) ? body.length : 'obj'} rows`);

      const list: Record<string, string>[] = Array.isArray(body) ? body
        : body.list ?? body.items ?? body.data ?? [];

      for (const row of list) {
        const hour   = parseInt(row.time_cd ?? row.timeCd ?? '-1');
        const linkId = row.link_id ?? row.linkId ?? '';
        const spd    = parseFloat(row.avgSpd ?? '0');
        if (hour < 0 || !linkId || isNaN(spd)) continue;
        if (!hourMap.has(hour)) hourMap.set(hour, new Map());
        hourMap.get(hour)!.set(linkId, spd);
        total++;
      }

      if (list.length < PAGE) break;
      startRow += PAGE;
      if (startRow > 2_000_000) break;
    }
  } finally {
    loadingDates.delete(date);
  }

  trafficCache[date] = hourMap.size > 0 ? hourMap : null;
  console.log(`[traffic] ${date} done — ${total} rows, hours:[${[...hourMap.keys()].sort().join(',')}]`);
}

// Preload strategic past dates in parallel to find working data quickly
function preloadStrategic(key: string, base: Date) {
  [7, 14, 30, 60, 90, 120, 180].forEach(n => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    const date = ymd(d);
    if (!(date in trafficCache) && !loadingDates.has(date)) {
      loadDay(key, date).catch(console.error);
    }
  });
}

let strategicPreloaded = false;

export async function GET(req: NextRequest) {
  const key = process.env.TOPIS_API_KEY;
  if (!key) return NextResponse.json({ error: 'TOPIS_API_KEY not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const reqDate = searchParams.get('date') ?? ymd(new Date());
  const hour    = parseInt(searchParams.get('hour') ?? '8');

  const base = dateFromYmd(reqDate);

  // On first call, preload strategic past dates in parallel
  if (!strategicPreloaded) {
    strategicPreloaded = true;
    preloadStrategic(key, base);
  }

  // Walk back up to 180 days to find a date with hourly data
  const d = new Date(base);
  for (let i = 0; i < 180; i++) {
    const date = ymd(d);

    if (loadingDates.has(date))  return NextResponse.json({ loading: true, hour, speeds: {}, date });
    if (!(date in trafficCache)) { loadDay(key, date).catch(console.error); return NextResponse.json({ loading: true, hour, speeds: {}, date }); }
    if (trafficCache[date] === null) { d.setDate(d.getDate() - 1); continue; }

    const hourMap = trafficCache[date]!.get(hour);
    const speeds  = hourMap ? Object.fromEntries(hourMap) : {};
    if (Object.keys(speeds).length === 0 && hour >= 0) {
      // This date has data but not for this specific hour — try same date different hour fallback
      console.log(`[traffic] ${date} no data for hour=${hour}, available: [${[...trafficCache[date]!.keys()].sort().join(',')}]`);
    } else {
      console.log(`[traffic] serving ${date} h${hour}: ${Object.keys(speeds).length} links`);
    }
    return NextResponse.json({ loading: false, hour, speeds, date });
  }

  return NextResponse.json({ loading: false, hour, speeds: {}, noData: true });
}
