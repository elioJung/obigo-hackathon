'use client';

import { useTranslations } from 'next-intl';

export const TIME_GROUPS = [
  { tg: 'live', color: '#4ade80' },
  { tg: 'T1',   color: '#ff8833' },
  { tg: 'T2',   color: '#88cc44' },
  { tg: 'T3',   color: '#ff5533' },
  { tg: 'TEST', color: '#9333ea' },
] as const;

export type TgKey = typeof TIME_GROUPS[number]['tg'];

interface Props {
  selected: TgKey | null;
  liveAvailable: boolean;
  liveLoading: boolean;
  loadedTgs: Set<TgKey>;
  onSelect: (tg: TgKey) => void;
  style?: React.CSSProperties;
}

export default function TimeGroupSelector({ selected, liveAvailable, liveLoading, loadedTgs, onSelect, style }: Props) {
  const t = useTranslations('timeGroup');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, ...style }}>
      {TIME_GROUPS.map(g => {
        const isLiveBtn  = g.tg === 'live';
        const isTestBtn  = g.tg === 'TEST';
        const isLoading  = isLiveBtn ? (liveLoading || !liveAvailable) : !isTestBtn && !loadedTgs.has(g.tg);
        const disabled   = isTestBtn ? false : isLoading;
        const active     = selected === g.tg;

        const label   = t(g.tg);
        const subText = t(`${g.tg}Sub` as Parameters<typeof t>[0]);

        return (
          <button
            key={g.tg}
            data-no-drag
            onClick={() => !disabled && onSelect(g.tg)}
            disabled={disabled}
            style={{
              background: active ? `${g.color}1a` : 'rgba(6,9,15,0.82)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${active ? `${g.color}88` : disabled ? 'rgba(90,170,220,0.06)' : 'rgba(90,170,220,0.12)'}`,
              borderRadius: 11,
              padding: '12px 24px',
              color: disabled ? '#243040' : active ? g.color : '#3a6888',
              cursor: disabled ? 'default' : 'pointer',
              textAlign: 'left',
              fontFamily: 'system-ui, sans-serif',
              transition: 'all 0.2s',
              minWidth: 189,
            }}
          >
            <div style={{ fontSize: 19, fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 9 }}>
              {label}
              {isLoading && (
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: '#ffaa22', display: 'inline-block', flexShrink: 0,
                  boxShadow: '0 0 4px #ffaa2288',
                  animation: 'tg-blink 1s ease-in-out infinite',
                }} />
              )}
              {isLiveBtn && !disabled && (
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 4px #4ade80' }} />
              )}
            </div>
            <div style={{ fontSize: 16, opacity: disabled ? 0.3 : 0.65, marginTop: 3 }}>{subText}</div>
          </button>
        );
      })}
    </div>
  );
}
