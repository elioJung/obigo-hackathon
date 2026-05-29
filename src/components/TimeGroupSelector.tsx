'use client';

import { useTranslations } from 'next-intl';

export const TIME_GROUPS = [
  { tg: 'live', color: '#4ade80' },
  { tg: 'T1',   color: '#ff8833' },
  { tg: 'T2',   color: '#88cc44' },
  { tg: 'T3',   color: '#ff5533' },
] as const;

export type TgKey = typeof TIME_GROUPS[number]['tg'];

export const TG_MIN_HOUR: Partial<Record<TgKey, number>> = {
  T1: 10,
  T2: 17,
  T3: 20,
};

interface Props {
  selected: TgKey | null;
  liveAvailable: boolean;
  liveLoading: boolean;
  kstHour: number;
  loadedTgs: Set<TgKey>;
  onSelect: (tg: TgKey) => void;
  style?: React.CSSProperties;
}

export default function TimeGroupSelector({ selected, liveAvailable, liveLoading, kstHour, loadedTgs, onSelect, style }: Props) {
  const t = useTranslations('timeGroup');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <style>{`
        @keyframes tg-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
      {TIME_GROUPS.map(g => {
        const isLiveBtn  = g.tg === 'live';
        const minHour    = TG_MIN_HOUR[g.tg];
        const notYet     = minHour !== undefined && kstHour < minHour;
        const isLoading  = isLiveBtn
          ? (liveLoading || !liveAvailable)
          : !notYet && !loadedTgs.has(g.tg);
        const disabled   = notYet || isLoading;
        const active     = selected === g.tg;

        const label   = t(g.tg);
        const subText = notYet
          ? t('notYet', { hour: minHour })
          : t(`${g.tg}Sub` as Parameters<typeof t>[0]);

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
              borderRadius: 8,
              padding: '7px 14px',
              color: disabled ? '#243040' : active ? g.color : '#3a6888',
              cursor: disabled ? 'default' : 'pointer',
              textAlign: 'left',
              fontFamily: 'system-ui, sans-serif',
              transition: 'all 0.2s',
              minWidth: 108,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: active ? 700 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
              {label}
              {notYet && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff4444', display: 'inline-block', flexShrink: 0 }} />
              )}
              {!notYet && isLoading && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#ffaa22', display: 'inline-block', flexShrink: 0,
                  boxShadow: '0 0 4px #ffaa2288',
                  animation: 'tg-blink 1s ease-in-out infinite',
                }} />
              )}
              {isLiveBtn && !disabled && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 4px #4ade80' }} />
              )}
            </div>
            <div style={{ fontSize: 9, opacity: disabled ? 0.3 : 0.65, marginTop: 1 }}>{subText}</div>
          </button>
        );
      })}
    </div>
  );
}
