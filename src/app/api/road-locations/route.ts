import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached: Record<string, [number, number]> | null = null;

function buildRoadLocations(): Record<string, [number, number]> {
  const dir = join(process.cwd(), 'src', 'data');

  const nodesRaw = readFileSync(join(dir, 'seoul-nodes.csv'), 'utf-8');
  const nodeMap = new Map<string, [number, number]>();
  for (const line of nodesRaw.split('\n').slice(1)) {
    const c = line.split(',');
    const nodeId = c[0]?.trim();
    const lng = parseFloat(c[6]);
    const lat = parseFloat(c[7]);
    if (nodeId && !isNaN(lng) && !isNaN(lat)) nodeMap.set(nodeId, [lng, lat]);
  }

  const linksRaw = readFileSync(join(dir, 'seoul-links.csv'), 'utf-8');
  const result: Record<string, [number, number]> = {};

  for (const line of linksRaw.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const roadName = c[9]?.trim();
    const stNodeId = c[1]?.trim();
    const edNodeId = c[2]?.trim();

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
