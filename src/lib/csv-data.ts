import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'src', 'data');

export interface LinkRow {
  linkId:     string;
  stNodeId:   string;
  edNodeId:   string;
  roadName:   string;
  maxSpd:     number;
  roadRankCd: number;
}

let nodeMapCache: Map<string, [number, number]> | null = null;
let linkRowsCache: LinkRow[] | null = null;

export function getNodeMap(): Map<string, [number, number]> {
  if (nodeMapCache) return nodeMapCache;

  const map = new Map<string, [number, number]>();
  for (const line of readFileSync(join(DATA_DIR, 'seoul-nodes.csv'), 'utf-8').split('\n').slice(1)) {
    const c = line.split(',');
    const nodeId = c[0]?.trim();
    const lng = parseFloat(c[6]);
    const lat = parseFloat(c[7]);
    if (nodeId && !isNaN(lng) && !isNaN(lat)) map.set(nodeId, [lng, lat]);
  }

  nodeMapCache = map;
  return map;
}

export function getLinkRows(): LinkRow[] {
  if (linkRowsCache) return linkRowsCache;

  const rows: LinkRow[] = [];
  for (const line of readFileSync(join(DATA_DIR, 'seoul-links.csv'), 'utf-8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const linkId   = c[24]?.trim();
    const stNodeId = c[1]?.trim();
    const edNodeId = c[2]?.trim();
    if (!linkId || !stNodeId || !edNodeId) continue;
    rows.push({
      linkId,
      stNodeId,
      edNodeId,
      roadName:   c[9]?.trim()  ?? '',
      maxSpd:     parseFloat(c[16] ?? '0') || 60,
      roadRankCd: parseInt(c[4]  ?? '999'),
    });
  }

  linkRowsCache = rows;
  return rows;
}
