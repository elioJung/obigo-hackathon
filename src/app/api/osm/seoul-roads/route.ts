import { NextResponse } from 'next/server';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const QUERY = `
[out:json][timeout:60];
(
  way["highway"~"motorway|trunk|primary|secondary"](37.42,126.76,37.70,127.18);
);
out body;
>;
out skel qt;
`.trim();

export async function GET() {
  let lastError = '';

  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SeoulTrafficVisualization/1.0 (educational demo)',
        },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(65_000),
      });
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({ error: 'All Overpass mirrors failed', detail: lastError }, { status: 502 });
}
