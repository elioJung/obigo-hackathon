'use client';

import type { DistrictRank } from '@/lib/types';

function speedColor(speed: number): string {
  if (speed < 20) return '#ff4422';
  if (speed < 30) return '#ff9900';
  if (speed < 40) return '#ddcc00';
  if (speed < 55) return '#55bb55';
  return '#44aaff';
}

interface ColumnProps {
  title: string;
  titleColor: string;
  arrow: string;
  items: DistrictRank[];
}

function RankColumn({ title, titleColor, arrow, items }: ColumnProps) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: titleColor,
        marginBottom: 8, letterSpacing: 1,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>{arrow}</span>{title}
      </div>
      {items.map((r, i) => (
        <div key={r.district} style={{
          display: 'flex', alignItems: 'center',
          gap: 6, marginBottom: 5,
        }}>
          <span style={{ fontSize: 11, color: '#2a4060', width: 12, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: speedColor(r.avgSpeed),
            boxShadow: `0 0 4px ${speedColor(r.avgSpeed)}88`,
          }} />
          <span style={{ fontSize: 13, color: '#c8dff0', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.district}
          </span>
          <span style={{ fontSize: 12, color: speedColor(r.avgSpeed), fontFamily: 'monospace', flexShrink: 0 }}>
            {r.avgSpeed}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  congested: DistrictRank[];
  smooth: DistrictRank[];
  style?: React.CSSProperties;
}

export default function DistrictRankingPanel({ congested, smooth, style }: Props) {
  return (
    <div style={{
      background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(90,170,220,0.15)', borderRadius: 11,
      padding: '12px 16px',
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
      minWidth: 320,
      ...style,
    }}>
      <div style={{ fontSize: 13, color: '#2a5878', marginBottom: 10, letterSpacing: 1 }}>
        구별 혼잡도 랭킹
        <span style={{ fontSize: 11, color: '#1a3850', marginLeft: 6 }}>(km/h)</span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <RankColumn
          title="혼잡"
          titleColor="#ff6644"
          arrow="▼"
          items={congested}
        />
        <div style={{ width: 1, background: 'rgba(90,170,220,0.1)' }} />
        <RankColumn
          title="원활"
          titleColor="#44aaff"
          arrow="▲"
          items={smooth}
        />
      </div>
    </div>
  );
}
