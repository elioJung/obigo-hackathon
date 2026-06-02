import { NextResponse } from 'next/server';
import { getNodeMap, getLinkRows } from '@/lib/csv-data';

let cached: Record<string, [number, number]> | null = null;

function buildRoadLocations(): Record<string, [number, number]> {
  const nodeMap = getNodeMap();
  const result: Record<string, [number, number]> = {};

  for (const { roadName, stNodeId, edNodeId } of getLinkRows()) {
    if (!roadName || roadName === '-' || result[roadName]) continue;
    const st = nodeMap.get(stNodeId);
    const ed = nodeMap.get(edNodeId);
    if (!st || !ed) continue;
    result[roadName] = [(st[0] + ed[0]) / 2, (st[1] + ed[1]) / 2];
  }

  return result;
}

export async function GET() {
  try {
    if (!cached) cached = buildRoadLocations();
    return NextResponse.json(cached);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
