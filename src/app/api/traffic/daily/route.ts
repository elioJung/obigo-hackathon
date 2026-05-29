import { NextResponse } from 'next/server';

const VOL_SPOTS = ['A-01','A-07','B-07','B-10','C-04','D-01','D-03','F-01','F-02','F-05'];

function getKST(): { ymd: string; hour: number } {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const ymd = [
    kst.getFullYear(),
    String(kst.getMonth() + 1).padStart(2, '0'),
    String(kst.getDate()).padStart(2, '0'),
  ].join('');
  return { ymd, hour: kst.getHours() };
}

async function fetchHourVol(apiKey: string, ymd: string, hh: number): Promise<number> {
  const hhStr = String(hh).padStart(2, '0');
  const totals = await Promise.all(
    VOL_SPOTS.map(async spot => {
      try {
        const url = `http://openapi.seoul.go.kr:8088/${apiKey}/xml/VolInfo/1/20/${spot}/${ymd}/${hhStr}/`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
        const text = await res.text();
        const vols = [...text.matchAll(/<vol>([^<]+)<\/vol>/gi)].map(m => parseInt(m[1]) || 0);
        return vols.reduce((a, b) => a + b, 0);
      } catch { return 0; }
    }),
  );
  return totals.reduce((a, b) => a + b, 0);
}

// Module-level in-memory cache (persists across requests in same process)
const volCache: Record<string, (number | null)[]> = {};
const volLoading: Record<string, boolean> = {};

function startLoad(apiKey: string, ymd: string, upToHour: number) {
  if (volLoading[ymd]) return;
  if (!volCache[ymd]) volCache[ymd] = new Array(24).fill(null);

  const missing = Array.from({ length: upToHour }, (_, h) => h)
    .filter(h => volCache[ymd][h] === null);
  if (!missing.length) return;

  volLoading[ymd] = true;
  (async () => {
    for (let i = 0; i < missing.length; i += 3) {
      const batch = missing.slice(i, i + 3);
      const results = await Promise.all(batch.map(h => fetchHourVol(apiKey, ymd, h)));
      batch.forEach((h, idx) => { if (volCache[ymd]) volCache[ymd][h] = results[idx]; });
    }
  })().finally(() => { volLoading[ymd] = false; });
}

export async function GET() {
  const key = process.env.SEOUL_TRAFFIC_KEY;
  if (!key) {
    return NextResponse.json({ error: 'SEOUL_TRAFFIC_KEY not configured' }, { status: 503 });
  }

  const { ymd, hour: currentHour } = getKST();
  if (!volCache[ymd]) volCache[ymd] = new Array(24).fill(null);

  startLoad(key, ymd, currentHour);

  const cache = volCache[ymd];
  const loadedCount = cache.slice(0, currentHour).filter(v => v !== null).length;
  const loading = loadedCount < currentHour;

  const rawVols = cache.slice(0, currentHour).filter(v => v !== null) as number[];
  const maxVol = rawVols.length ? Math.max(...rawVols, 1) : 1;

  const hours = cache.map((vol, hh) => ({
    hh,
    vol,
    intensity: vol !== null ? Math.max(0.05, vol / maxVol) : null,
    source: hh < currentHour ? 'historical' : hh === currentHour ? 'realtime' : 'future',
  }));

  return NextResponse.json({
    ymd, currentHour, maxVol, hours, loading, loadedCount, totalHours: currentHour,
  });
}
