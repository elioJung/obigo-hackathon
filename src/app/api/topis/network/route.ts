import { NextResponse } from 'next/server';
import { getNodeMap, getLinkRows } from '@/lib/csv-data';

let cache: GeoJSON.FeatureCollection | null = null;

function buildNetwork(): GeoJSON.FeatureCollection {
  const nodeMap = getNodeMap();
  const features: GeoJSON.Feature[] = [];

  for (const { linkId, stNodeId, edNodeId, roadName, roadRankCd, maxSpd } of getLinkRows()) {
    const st = nodeMap.get(stNodeId);
    const ed = nodeMap.get(edNodeId);
    if (!st || !ed) continue;

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [st, ed] },
      properties: { linkId, roadName, roadRankCd, maxSpd, speed: -1 },
    });
  }

  return { type: 'FeatureCollection', features };
}

export async function GET() {
  try {
    if (!cache) cache = buildNetwork();
    return NextResponse.json(cache);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
