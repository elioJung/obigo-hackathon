/**
 * TrafficInfo 센서 링크 탐색 스크립트
 *
 * Seoul Open Data TrafficInfo API에 13,277개 링크 ID를 전부 조회해서
 * 실제로 속도 데이터가 반환되는 링크만 추출하여 저장합니다.
 *
 * 실행: node scripts/discover-links.mjs
 * 예상 소요 시간: 10~15분
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── API 키 로드 ──────────────────────────────────────────────────────────────
const env = readFileSync(join(ROOT, '.env.local'), 'utf-8');
const KEY = env.match(/SEOUL_TRAFFIC_KEY=([^\n\r]+)/)?.[1]?.trim();

if (!KEY) {
  console.error('❌ .env.local에 SEOUL_TRAFFIC_KEY가 없습니다.');
  process.exit(1);
}

// ── 링크 ID 로드 (seoul-links.csv col24 = 링크ID) ────────────────────────────
const csvPath = join(ROOT, 'src', 'public', 'data', 'seoul-links.csv');
const lines = readFileSync(csvPath, 'utf-8').split('\n').slice(1);

const allLinkIds = [...new Set(
  lines
    .filter(l => l.trim())
    .map(l => l.split(',')[24]?.trim())
    .filter(Boolean)
)];

console.log(`\n📡 총 ${allLinkIds.length}개 고유 링크 탐색 시작`);
console.log(`   API 키: ${KEY.slice(0, 8)}...`);
console.log(`   예상 소요: ${Math.ceil(allLinkIds.length / 20 * 0.4)}분\n`);

// ── 개별 링크 조회 ────────────────────────────────────────────────────────────
async function checkLink(linkId) {
  try {
    const url = `http://openapi.seoul.go.kr:8088/${KEY}/xml/TrafficInfo/1/1/${linkId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    const text = await res.text();
    const spd = text.match(/<prcs_spd>([^<]+)<\/prcs_spd>/i)?.[1];
    const speed = parseFloat(spd ?? '');
    if (!isNaN(speed) && speed >= 0) return { linkId, speed };
    return null;
  } catch {
    return null;
  }
}

// ── 배치 처리 ─────────────────────────────────────────────────────────────────
const BATCH = 20;
const active = [];
let tested = 0;
const startedAt = Date.now();

for (let i = 0; i < allLinkIds.length; i += BATCH) {
  const batch = allLinkIds.slice(i, i + BATCH);
  const results = await Promise.all(batch.map(checkLink));

  for (const r of results) {
    if (r) active.push(r.linkId);
  }
  tested += batch.length;

  if (tested % 500 === 0 || tested >= allLinkIds.length) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const pct = ((tested / allLinkIds.length) * 100).toFixed(1);
    console.log(`  [${pct}%] ${tested}/${allLinkIds.length} 테스트 | ✅ ${active.length}개 활성 | ${elapsed}초 경과`);
  }
}

// ── 결과 저장 ─────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n✅ 완료! ${active.length}개 활성 링크 (${elapsed}초 소요)\n`);

const outPath = join(ROOT, 'src', 'public', 'data', 'active-links.json');
writeFileSync(outPath, JSON.stringify({ count: active.length, linkIds: active }, null, 2));
console.log(`💾 저장: src/public/data/active-links.json`);
console.log(`   활성: ${active.length}개 / 전체: ${allLinkIds.length}개 (${((active.length/allLinkIds.length)*100).toFixed(1)}%)\n`);
