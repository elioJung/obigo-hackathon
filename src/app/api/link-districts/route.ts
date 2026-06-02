import { NextResponse } from 'next/server';
import { getNodeMap, getLinkRows } from '@/lib/csv-data';

const DISTRICT_BOUNDS: Record<string, [number, number, number, number]> = {
  '강남구':   [127.015, 37.490, 127.105, 37.545],
  '강동구':   [127.090, 37.510, 127.185, 37.575],
  '강북구':   [127.000, 37.610, 127.075, 37.670],
  '강서구':   [126.795, 37.525, 126.895, 37.590],
  '관악구':   [126.895, 37.450, 126.995, 37.500],
  '광진구':   [127.045, 37.530, 127.120, 37.560],
  '구로구':   [126.820, 37.465, 126.905, 37.530],
  '금천구':   [126.870, 37.435, 126.925, 37.480],
  '노원구':   [127.050, 37.610, 127.110, 37.685],
  '도봉구':   [127.010, 37.635, 127.090, 37.705],
  '동대문구': [127.025, 37.555, 127.075, 37.600],
  '동작구':   [126.925, 37.488, 127.005, 37.540],
  '마포구':   [126.885, 37.535, 126.965, 37.580],
  '서대문구': [126.905, 37.548, 126.975, 37.600],
  '서초구':   [126.990, 37.465, 127.090, 37.515],
  '성동구':   [127.015, 37.530, 127.075, 37.570],
  '성북구':   [126.990, 37.575, 127.060, 37.640],
  '송파구':   [127.085, 37.480, 127.170, 37.535],
  '양천구':   [126.840, 37.500, 126.905, 37.550],
  '영등포구': [126.878, 37.505, 126.950, 37.545],
  '용산구':   [126.960, 37.510, 127.025, 37.555],
  '은평구':   [126.905, 37.580, 126.975, 37.650],
  '종로구':   [126.950, 37.560, 127.020, 37.615],
  '중구':     [126.972, 37.545, 127.020, 37.580],
  '중랑구':   [127.065, 37.565, 127.120, 37.620],
};

const DISTRICT_ENTRIES = Object.entries(DISTRICT_BOUNDS);

function classifyPoint(lng: number, lat: number): string | null {
  const candidates = DISTRICT_ENTRIES.filter(
    ([, b]) => lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3],
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0][0];

  let best = candidates[0][0];
  let bestDist = Infinity;
  for (const [name, b] of candidates) {
    const d = (lng - (b[0] + b[2]) / 2) ** 2 + (lat - (b[1] + b[3]) / 2) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

let cached: Record<string, string> | null = null;

function buildLinkDistricts(): Record<string, string> {
  const nodeMap = getNodeMap();
  const result: Record<string, string> = {};

  for (const { linkId, stNodeId } of getLinkRows()) {
    const node = nodeMap.get(stNodeId);
    if (!node) continue;
    const district = classifyPoint(node[0], node[1]);
    if (district) result[linkId] = district;
  }

  return result;
}

export async function GET() {
  try {
    if (!cached) cached = buildLinkDistricts();
    return NextResponse.json(cached);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
