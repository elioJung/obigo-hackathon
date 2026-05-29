'use client';

import { useTranslations } from 'next-intl';
import type { DailyData } from '@/lib/types';
import type { TgKey } from './TimeGroupSelector';
import { intensityToColor } from '@/lib/traffic';

const TG_COLOR: Record<string, string> = {
  live: '#4ade80',
  T1:   '#ff8833',
  T2:   '#88cc44',
  T3:   '#ff5533',
};

const TG_RANGE: Record<string, [number, number]> = {
  T1: [7, 9], T2: [10, 16], T3: [17, 19],
};

interface Props {
  kstHour: number;
  kstMinute: number;
  selectedTg: TgKey | null;
  daily: DailyData | null;
  dataInfo?: { date: string; tg: string } | null;
}

function formatClock(h: number, m: number): string {
  const hh = h % 24;
  return `${(hh % 12 || 12)}:${String(m).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

export default function TrafficPanel({ kstHour, kstMinute, selectedTg, daily, dataInfo }: Props) {
  const t = useTranslations('timeGroup');
  const tp = useTranslations('panel');

  const color     = selectedTg ? TG_COLOR[selectedTg] : null;
  const tgRange   = selectedTg ? TG_RANGE[selectedTg] : undefined;
  const rangeStart = tgRange?.[0];
  const rangeEnd   = tgRange?.[1];

  const panel: React.CSSProperties = {
    background: 'rgba(6,9,15,0.88)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(90,170,220,0.15)',
    borderRadius: 12,
    color: '#fff',
    fontFamily: 'system-ui, monospace',
  };

  return (
    <div style={{ ...panel, position: 'absolute', top: 20, right: 20, padding: '10px 14px', minWidth: 180 }}>

      {/* Current time */}
      <div style={{ fontSize: 17, fontWeight: 700, color: '#e8f4ff', letterSpacing: -0.5, marginBottom: 8 }}>
        {formatClock(kstHour, kstMinute)}
      </div>

      {/* Selected time group badge */}
      {selectedTg && color && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${color}1a`,
          border: `1px solid ${color}55`,
          borderRadius: 6, padding: '4px 10px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{t(selectedTg)}</span>
          <span style={{ fontSize: 9, color, opacity: 0.75 }}>{t(`${selectedTg}Sub` as Parameters<typeof t>[0])}</span>
        </div>
      )}

      {/* Data date info */}
      {dataInfo && selectedTg !== 'live' && (
        <div style={{ fontSize: 9, color: '#4a7a9a', marginBottom: 8 }}>
          {tp('dataDate')}: {dataInfo.date.slice(0,4)}.{dataInfo.date.slice(4,6)}.{dataInfo.date.slice(6,8)}
        </div>
      )}

      {/* Daily volume bars */}
      {daily && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#4a7a9a', marginBottom: 4 }}>{tp('todayTraffic')}</div>
          <div style={{ position: 'relative' }}>
            {color && rangeStart !== undefined && rangeEnd !== undefined && (
              <div style={{
                position: 'absolute',
                left:  `${(rangeStart / 24) * 100}%`,
                width: `${((rangeEnd - rangeStart + 1) / 24) * 100}%`,
                top: 0, bottom: 0,
                background: `${color}18`,
                borderLeft:  `1px solid ${color}55`,
                borderRight: `1px solid ${color}55`,
                borderRadius: 2,
                pointerEvents: 'none',
              }} />
            )}
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24 }}>
              {Array.from({ length: 24 }, (_, hh) => {
                const entry     = daily.hours[hh];
                const intensity = entry?.intensity ?? 0;
                const isNow     = hh === kstHour;
                const isFuture  = entry?.source === 'future';
                const inRange   = rangeStart !== undefined && hh >= rangeStart && hh <= rangeEnd!;
                const hasRange  = rangeStart !== undefined;

                const barColor = isNow
                  ? '#4ade80'
                  : isFuture
                    ? '#0d1a28'
                    : entry?.intensity != null
                      ? intensityToColor(entry.intensity)
                      : '#1e3a50';

                return (
                  <div
                    key={hh}
                    style={{
                      flex: 1,
                      height: Math.max(2, Math.round(intensity * 20)),
                      background: barColor,
                      borderRadius: 1,
                      opacity: isFuture ? 0.3 : (hasRange && !inRange && !isNow) ? 0.3 : 1,
                      transition: 'opacity 0.3s, background 0.3s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
