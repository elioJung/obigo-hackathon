import type { DailyData, SeoulTrafficSummary } from './types';

function parseCongestion(speed: number): 1 | 2 | 3 {
  if (speed >= 40) return 1;
  if (speed >= 20) return 2;
  return 3;
}

export function speedToMultiplier(avgSpeed: number): number {
  return Math.max(0.1, Math.min(0.95, 1 - (avgSpeed - 5) / 60));
}

export function getTrafficMultiplier(hour: number): number {
  if (hour >= 7.5 && hour <= 9.5)   return 0.3 + (1 - Math.abs(hour - 8.5)) * 0.7;
  if (hour >= 17.5 && hour <= 19.5) return 0.25 + (1 - Math.abs(hour - 18.5)) * 0.75;
  if (hour >= 12 && hour <= 13.5)   return 0.4;
  if (hour >= 22 || hour <= 5)      return 0.08;
  return 0.2;
}

export function getPhaseLabel(mult: number): { label: string; color: string } {
  if (mult > 0.7)  return { label: '혼잡', color: '#ff4444' };
  if (mult > 0.4)  return { label: '서행', color: '#ffaa22' };
  if (mult > 0.15) return { label: '원활', color: '#44bbff' };
  return { label: '심야', color: '#334466' };
}

export function intensityToColor(intensity: number): string {
  if (intensity < 0.33) return '#44bbff';
  if (intensity < 0.66) return '#ffaa22';
  return '#ff4444';
}

export async function fetchSeoulTraffic(): Promise<SeoulTrafficSummary | null> {
  try {
    const res = await fetch('/api/traffic/seoul', {
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { TrafficInfo: { row: { LINK_ID: string; PRCS_SPD: string }[] } };
    const rows = data?.TrafficInfo?.row ?? [];
    if (!rows.length) return null;

    const linkSpeeds: Record<string, number> = {};
    let sumSpeed = 0, smooth = 0, slow = 0;

    for (const r of rows) {
      const speed = parseFloat(r.PRCS_SPD) || 30;
      linkSpeeds[r.LINK_ID] = speed;
      sumSpeed += speed;
      const c = parseCongestion(speed);
      if (c === 1) smooth++;
      else if (c === 2) slow++;
    }

    const total        = rows.length;
    const avgSpeed     = Math.round(sumSpeed / total);
    const smoothPct    = Math.round(smooth / total * 100);
    const slowPct      = Math.round(slow   / total * 100);
    const congestedPct = 100 - smoothPct - slowPct;

    return { averageSpeed: avgSpeed, smoothPct, slowPct, congestedPct, fetchedAt: Date.now(), linkSpeeds };
  } catch {
    return null;
  }
}

export async function fetchDailyData(): Promise<DailyData | null> {
  try {
    const res = await fetch('/api/traffic/daily', {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.json() as DailyData;
  } catch {
    return null;
  }
}
