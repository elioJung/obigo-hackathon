import { NextResponse, type NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = 'http://t-data.seoul.go.kr/apig/apiman-gateway/tapi';
const PAGE = 1000;

type TimeGroup = 'T0' | 'T1' | 'T2' | 'T3';

// ── Static: axisCd → linkId[] (from CSV) ──────────────────────────────────
let axisLinkMap: Map<string, string[]> | null = null;

function getAxisLinkMap(): Map<string, string[]> {
  if (axisLinkMap) return axisLinkMap;

  const raw = readFileSync(
    join(process.cwd(), 'src', 'data', 'seoul-axis-links.csv'),
    'utf-8',
  ).replace(/^﻿/, ''); // strip BOM

  const map = new Map<string, string[]>();
  for (const line of raw.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const axisCd = c[0]?.trim();
    const linkId = c[4]?.trim();
    if (!axisCd || !linkId) continue;
    if (!map.has(axisCd)) map.set(axisCd, []);
    map.get(axisCd)!.push(linkId);
  }

  axisLinkMap = map;
  const total = [...map.values()].reduce((s, v) => s + v.length, 0);
  console.log(`[road-stats] axis-link map: ${map.size} axes, ${total} links`);
  return map;
}

// ── Dynamic cache: date → timeGroup → { linkId: avgSpd } ──────────────────
const cache: Record<string, Record<TimeGroup, Record<string, number>> | null> = {};
const loadingPromises = new Map<string, Promise<void>>();

function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
}

async function loadDay(key: string, date: string) {
  if (date in cache) return;
  if (loadingPromises.has(date)) return loadingPromises.get(date);

  const promise = fetchDay(key, date).finally(() => loadingPromises.delete(date));
  loadingPromises.set(date, promise);
  return promise;
}

async function fetchDay(key: string, date: string) {

  const axisMap = getAxisLinkMap();
  // axisCd → timeGroup → avgSpd (temporary)
  const axisSpeeds = new Map<string, Map<TimeGroup, number>>();

  let startRow = 1;
  let total = 0;

  while (true) {
      const url = `${BASE}/TopisIccStDailyRoadTrfRoadStats/1.0?apikey=${key}&stndDt=${date}&startRow=${startRow}&rowCnt=${PAGE}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) { console.warn(`[road-stats] ${date} HTTP ${res.status}`); break; }

      const body = await res.json();
      const list: Record<string, string>[] = Array.isArray(body) ? body
        : body.list ?? body.items ?? body.data ?? [];

      if (startRow === 1) console.log(`[road-stats] ${date} first page: ${list.length} rows`);

      for (const row of list) {
        const axisCd = row.axisCd?.trim() ?? '';
        const tg     = (row.timeGrpCd ?? 'T0') as TimeGroup;
        const spd    = parseFloat(row.avgSpd ?? '0');
        if (!axisCd || isNaN(spd)) continue;

        if (!axisSpeeds.has(axisCd)) axisSpeeds.set(axisCd, new Map());
        axisSpeeds.get(axisCd)!.set(tg, spd);
        total++;
      }

      if (list.length < PAGE) break;
      startRow += PAGE;
      if (startRow > 500_000) break;
  }

  if (total === 0) {
    cache[date] = null;
    console.log(`[road-stats] ${date} no data`);
    return;
  }

  // Join axisCd → linkId[] with axisCd → tg → avgSpd
  const result: Record<TimeGroup, Record<string, number>> = { T0: {}, T1: {}, T2: {}, T3: {} };
  let linked = 0;

  for (const [axisCd, tgMap] of axisSpeeds) {
    const links = axisMap.get(axisCd) ?? [];
    for (const [tg, spd] of tgMap) {
      for (const linkId of links) {
        result[tg][linkId] = spd;
        linked++;
      }
    }
  }

  cache[date] = result;
  console.log(`[road-stats] ${date} done — ${total} rows → ${linked} link-speed entries, T0: ${Object.keys(result.T0).length} links`);
}

export async function GET(req: NextRequest) {
  const key = process.env.TOPIS_API_KEY;
  if (!key) return NextResponse.json({ error: 'TOPIS_API_KEY not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const reqDate = searchParams.get('date') ?? ymd(new Date());
  const tg = (searchParams.get('tg') ?? 'T0') as TimeGroup;

  const d = new Date(
    parseInt(reqDate.slice(0, 4)),
    parseInt(reqDate.slice(4, 6)) - 1,
    parseInt(reqDate.slice(6, 8)),
  );

  const date = ymd(d);
  if (!(date in cache)) await loadDay(key, date).catch(console.error);

  const speeds = cache[date]?.[tg] ?? {};
  return NextResponse.json({ speeds, date });
}
