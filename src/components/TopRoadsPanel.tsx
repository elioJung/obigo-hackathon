'use client';

import type { RoadRank } from '@/hooks/useRoadRanking';

function speedColor(speed: number): string {
  if (speed < 20) return '#ff4422';
  if (speed < 30) return '#ff9900';
  if (speed < 40) return '#ddcc00';
  if (speed < 55) return '#55bb55';
  return '#44aaff';
}

function congestionLabel(speed: number): string {
  if (speed < 20) return '정체';
  if (speed < 35) return '서행';
  if (speed < 55) return '원활';
  return '쾌속';
}

interface Props {
  roads: RoadRank[];
  onRoadClick?: (road: RoadRank) => void;
  style?: React.CSSProperties;
}

export default function TopRoadsPanel({ roads, onRoadClick, style }: Props) {
  return (
    <div style={{
      background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(90,170,220,0.15)', borderRadius: 11,
      padding: '12px 16px',
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
      minWidth: 220,
      ...style,
    }}>
      <div style={{ fontSize: 13, color: '#2a5878', marginBottom: 10, letterSpacing: 1 }}>
        막히는 도로 TOP 5
        <span style={{ fontSize: 11, color: '#1a3850', marginLeft: 6 }}>(km/h)</span>
      </div>
      {roads.map((r, i) => (
        <div
          key={r.roadName}
          onClick={() => onRoadClick?.(r)}
          style={{
            display: 'flex', alignItems: 'center',
            gap: 6, marginBottom: 6,
            cursor: onRoadClick ? 'pointer' : 'default',
            borderRadius: 6, padding: '3px 4px', margin: '0 -4px 4px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (onRoadClick) (e.currentTarget as HTMLElement).style.background = 'rgba(90,170,220,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 11, color: '#2a4060', width: 12, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: speedColor(r.avgSpeed),
            boxShadow: `0 0 4px ${speedColor(r.avgSpeed)}88`,
          }} />
          <span style={{
            fontSize: 13, color: '#c8dff0', flex: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {r.roadName}
          </span>
          <span style={{ fontSize: 12, color: speedColor(r.avgSpeed), fontFamily: 'monospace', flexShrink: 0 }}>
            {r.avgSpeed}
          </span>
          <span style={{ fontSize: 10, color: speedColor(r.avgSpeed), opacity: 0.7, flexShrink: 0, width: 24 }}>
            {congestionLabel(r.avgSpeed)}
          </span>
        </div>
      ))}
    </div>
  );
}
