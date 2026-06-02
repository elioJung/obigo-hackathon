import { NextResponse } from 'next/server';
import { getLinkRows } from '@/lib/csv-data';

let cached: Record<string, string> | null = null;

function buildLinkRoadNames(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { linkId, roadName } of getLinkRows()) {
    if (roadName && roadName !== '-') result[linkId] = roadName;
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
