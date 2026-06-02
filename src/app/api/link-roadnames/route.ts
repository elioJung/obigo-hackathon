import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached: Record<string, string> | null = null;

function buildLinkRoadNames(): Record<string, string> {
  const raw = readFileSync(join(process.cwd(), 'src', 'data', 'seoul-links.csv'), 'utf-8');
  const result: Record<string, string> = {};

  for (const line of raw.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const linkId   = c[24]?.trim();
    const roadName = c[9]?.trim();
    if (linkId && roadName && roadName !== '-') result[linkId] = roadName;
  }

  return result;
}

export async function GET() {
  try {
    if (!cached) cached = buildLinkRoadNames();
    return NextResponse.json(cached);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
