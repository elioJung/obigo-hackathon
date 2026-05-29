import type { RoadSegment } from './types';

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
}

export function parseOsmResponse(data: { elements: OverpassElement[] }): RoadSegment[] {
  const nodeMap = new Map<number, [number, number]>(); // [lng, lat]

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      nodeMap.set(el.id, [el.lon, el.lat]);
    }
  }

  const segments: RoadSegment[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.tags?.highway || !el.nodes?.length) continue;

    const coords: [number, number][] = [];
    for (const nid of el.nodes) {
      const c = nodeMap.get(nid);
      if (c) coords.push(c);
    }

    if (coords.length >= 2) {
      segments.push({ id: el.id, type: el.tags.highway, coords });
    }
  }

  return segments;
}
