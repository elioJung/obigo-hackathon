'use client';

import type { DailyData } from '@/lib/types';
import { intensityToColor } from '@/lib/traffic';
import type { TgKey } from './TimeGroupSelector';

const TG_RANGE: Record<string, [number, number]> = {
  T0: [6, 22], T1: [7, 9], T2: [10, 16], T3: [17, 19],
};
const TG_COLOR: Record<string, string> = {
  T1: '#ff8833', T2: '#88cc44', T3: '#ff5533',
};

interface Props {
  daily: DailyData | null;
  kstHour: number;
  selectedTg: TgKey;
}

export default function HourTimeline({ daily, kstHour, selectedTg }: Props) {
  const [rangeStart, rangeEnd] = selectedTg !== 'live' ? (TG_RANGE[selectedTg] ?? []) : [];

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(6,9,15,0.97) 55%, transparent)',
      padding: '10px 24px 16px',
      fontFamily: 'system-ui, monospace',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#2a5878', letterSpacing: 1 }}>
          {daily?.loading
            ? `오늘 교통량 로딩 중… (${daily.loadedCount}/${daily.totalHours}시간)`
            : '시간대별 교통량 (참고용 · 클릭 불가)'}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#2a5878' }}>
          {([['#44bbff', '원활'], ['#ffaa22', '서행'], ['#ff4444', '혼잡']] as const).map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Zone highlight + bars */}
      <div style={{ position: 'relative' }}>
        {/* Selected time group zone overlay */}
        {rangeStart !== undefined && rangeEnd !== undefined && (
          <div style={{
            position: 'absolute',
            left:  `${(rangeStart / 24) * 100}%`,
            width: `${((rangeEnd - rangeStart + 1) / 24) * 100}%`,
            top: 0, bottom: 0,
            background: `${TG_COLOR[selectedTg] ?? '#5aaadd'}18`,
            borderLeft:  `1px solid ${TG_COLOR[selectedTg] ?? '#5aaadd'}55`,
            borderRight: `1px solid ${TG_COLOR[selectedTg] ?? '#5aaadd'}55`,
            borderRadius: 2,
            pointerEvents: 'none',
          }} />
        )}

        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48 }}>
          {Array.from({ length: 24 }, (_, hh) => {
            const entry    = daily?.hours[hh];
            const isNow    = hh === kstHour;
            const isFuture = hh > kstHour;
            const intensity = entry?.intensity ?? null;
            const hasData  = intensity !== null && entry?.source === 'historical';
            const barColor = hasData ? intensityToColor(intensity!) : isFuture ? '#0d1a28' : '#1a2e40';
            const barH     = hasData ? Math.max(6, Math.round(intensity! * 40)) : isFuture ? 4 : 5;
            const inZone   = rangeStart !== undefined && hh >= rangeStart && hh <= rangeEnd!;

            return (
              <div
                key={hh}
                title={`${hh}시 ${hasData ? `교통량 ${entry?.vol?.toLocaleString()}대` : isNow ? '실시간' : isFuture ? '미래' : '로딩 중'}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 2 }}
              >
                <div style={{
                  width: '100%', height: barH,
                  background: isNow ? '#4ade80' : barColor,
                  borderRadius: '2px 2px 0 0',
                  opacity: isFuture ? 0.3 : inZone ? 1 : 0.5,
                  transition: 'height 0.3s, background 0.3s, opacity 0.3s',
                  ...(isNow ? { boxShadow: '0 0 6px #4ade8088', animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                }} />
                <div style={{
                  fontSize: 8, marginTop: 3, lineHeight: 1,
                  color: isNow ? '#4ade80' : inZone ? '#5aaadd' : '#1e3a50',
                  fontWeight: isNow || inZone ? 600 : 400,
                }}>
                  {hh % 3 === 0 ? `${hh}h` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
    </div>
  );
}
