import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Module-level cache — built once per server process
let cache: GeoJSON.FeatureCollection | null = null;

function buildNetwork(): GeoJSON.FeatureCollection {
  const dir = join(process.cwd(), 'src', 'public', 'data');

  // ── 1. Parse nodes: col0=nodeId  col6=lng  col7=lat ─────────────────────
  const nodesRaw = readFileSync(join(dir, 'seoul-nodes.csv'), 'utf-8');
  const nodeMap = new Map<string, [number, number]>();

  for (const line of nodesRaw.split('\n').slice(1)) {
    const c = line.split(',');
    const nodeId = c[0]?.trim();
    const lng    = parseFloat(c[6]);
    const lat    = parseFloat(c[7]);
    if (nodeId && !isNaN(lng) && !isNaN(lat)) {
      nodeMap.set(nodeId, [lng, lat]);
    }
  }
  console.log(`[network] nodes: ${nodeMap.size}`);

  // ── 2. Parse links: col24=linkId  col1=stNode  col2=edNode ──────────────
  //    col4=roadRankCd  col9=roadName  col16=maxSpd
  const linksRaw = readFileSync(join(dir, 'seoul-links.csv'), 'utf-8');
  const features: GeoJSON.Feature[] = [];

  for (const line of linksRaw.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');

    const linkId    = c[24]?.trim();
    const stNodeId  = c[1]?.trim();
    const edNodeId  = c[2]?.trim();
    const roadRankCd = parseInt(c[4] ?? '999');
    const roadName  = c[9]?.trim() ?? '';
    const maxSpd    = parseFloat(c[16] ?? '0') || 60;

    if (!linkId || !stNodeId || !edNodeId) continue;

    const st = nodeMap.get(stNodeId);
    const ed = nodeMap.get(edNodeId);
    if (!st || !ed) continue;

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [st, ed] },
      properties: { linkId, roadName, roadRankCd, maxSpd, speed: -1 },
    });
  }

  console.log(`[network] features: ${features.length}`);
  return { type: 'FeatureCollection', features };
}

export async function GET() {
  try {
    if (!cache) cache = buildNetwork();
    return NextResponse.json(cache);
  } catch (e) {
    console.error('[network] build failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
