import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load active link IDs discovered via `pnpm run discover`
function loadActiveLinkIds(): string[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), 'src', 'public', 'data', 'active-links.json'),
      'utf-8',
    );
    const { linkIds } = JSON.parse(raw) as { linkIds: string[] };
    console.log(`[traffic/seoul] loaded ${linkIds.length} active links`);
    return linkIds;
  } catch {
    // Fallback to original 56 hardcoded IDs
    console.warn('[traffic/seoul] active-links.json not found, using fallback');
    return [
      '1110000800','1110002800','1110005800','1110008800','1110011800',
      '1120001800','1120005800','1120009800','1120012800',
      '1130000800','1130002800','1130005800','1130010800',
      '1140000800','1140011800',
      '1150002800','1150005800','1150008800','1150011800',
      '1160001800','1160004800','1160007800','1160010800',
      '1170001800','1170004800','1170007800','1170010800',
      '1180000800','1180003800','1180006800','1180009800','1180012800',
      '1190000800','1190004800','1190006800',
      '1200001800','1200004800','1200007800','1200010800',
      '1210000800','1210003800','1210007800','1210010800',
      '1220000800','1220003800','1220006800','1220009800','1220012800',
      '1230002800','1230005800','1230008800','1230011800',
      '1240001800','1240006800','1240009800','1240012800',
    ];
  }
}

// Cache link IDs at module level (loaded once per server process)
const LINK_IDS = loadActiveLinkIds();
const BATCH = 50;

async function fetchLink(key: string, linkId: string): Promise<{ LINK_ID: string; PRCS_SPD: string } | null> {
  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/xml/TrafficInfo/1/1/${linkId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    const text = await res.text();
    const spd = text.match(/<prcs_spd>([^<]+)<\/prcs_spd>/i)?.[1];
    if (!spd) return null;
    return { LINK_ID: linkId, PRCS_SPD: spd };
  } catch {
    return null;
  }
}

export async function GET() {
  const key = process.env.SEOUL_TRAFFIC_KEY;
  if (!key) {
    return NextResponse.json({ error: 'SEOUL_TRAFFIC_KEY not configured' }, { status: 503 });
  }

  const rows: Array<{ LINK_ID: string; PRCS_SPD: string }> = [];

  for (let i = 0; i < LINK_IDS.length; i += BATCH) {
    const results = await Promise.all(
      LINK_IDS.slice(i, i + BATCH).map(id => fetchLink(key, id)),
    );
    for (const r of results) {
      if (r) rows.push(r);
    }
  }

  console.log(`[traffic/seoul] fetched ${rows.length}/${LINK_IDS.length} links`);
  return NextResponse.json({ TrafficInfo: { row: rows } });
}
