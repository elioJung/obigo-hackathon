import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached: GeoJSON.FeatureCollection | null = null;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

export async function GET() {
  if (cached) return NextResponse.json(cached);

  const raw = readFileSync(
    join(process.cwd(), 'src', 'data', 'accident-hotspots-2025.csv'),
    'utf-8',
  );

  const lines = raw.split('\n').filter(l => !l.startsWith('#') && l.trim());
  const features: GeoJSON.Feature[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    if (cols.length < 14) continue;
    const lat = parseFloat(cols[12]);
    const lng = parseFloat(cols[13]);
    if (isNaN(lat) || isNaN(lng)) continue;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        name:      cols[5],
        district:  cols[4],
        accidents: parseInt(cols[6])  || 0,
        casualties:parseInt(cols[7])  || 0,
        deaths:    parseInt(cols[8])  || 0,
      },
    });
  }

  cached = { type: 'FeatureCollection', features };
  console.log(`[accident-hotspots] loaded ${features.length} points`);
  return NextResponse.json(cached);
}
