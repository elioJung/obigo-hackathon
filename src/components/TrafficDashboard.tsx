'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import SeoulMap from './SeoulMap';
import TrafficPanel from './TrafficPanel';
import TimeGroupSelector, { type TgKey, TG_MIN_HOUR } from './TimeGroupSelector';
import { fetchSeoulTraffic, fetchDailyData } from '@/lib/traffic';
import type { SeoulTrafficSummary, DailyData } from '@/lib/types';

function getKSTTime() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function getKSTYmd(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('');
}

export default function TrafficDashboard() {
  const [selectedTg, setSelectedTg]     = useState<TgKey | null>(null);
  const [kstHour, setKstHour]           = useState(() => getKSTTime().hour);
  const [kstMinute, setKstMinute]       = useState(() => getKSTTime().minute);
  const [liveTraffic, setLiveTraffic]   = useState<SeoulTrafficSummary | null>(null);
  const [liveLoading, setLiveLoading]   = useState(true);
  const [daily, setDaily]               = useState<DailyData | null>(null);
  const [historicalSpeeds, setHistoricalSpeeds] = useState<Record<string, number> | undefined>(undefined);
  const [dataInfo, setDataInfo]         = useState<{ date: string; tg: string } | null>(null);
  const [loadedTgs, setLoadedTgs]         = useState<Set<TgKey>>(new Set());
  const [isInteracting, setIsInteracting] = useState(false);
  const [isHidden, setIsHidden]           = useState(false);
  const hideTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speedsCacheRef  = useRef<Map<string, { speeds: Record<string, number>; date: string }>>(new Map());

  // KST clock
  useEffect(() => {
    const id = setInterval(() => {
      const { hour, minute } = getKSTTime();
      setKstMinute(minute);
      setKstHour(prev => prev !== hour ? hour : prev);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Real-time traffic — poll every 60s (fetch takes ~12s for 5817 links)
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      setLiveLoading(true);
      const data = await fetchSeoulTraffic();
      if (cancelled) return;
      setLiveLoading(false);
      if (data) setLiveTraffic(data);
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Daily volume for timeline bars
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const data = await fetchDailyData();
      if (cancelled) return;
      if (data) setDaily(data);
      if (!cancelled) timer = setTimeout(poll, data?.loading ? 3_000 : 60_000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // 시간이 지난 tg 백그라운드 프리페치 — kstHour가 바뀌면 새로 잠금 해제된 tg도 자동 fetch
  useEffect(() => {
    const dateStr = getKSTYmd();
    const cancelled: Partial<Record<TgKey, boolean>> = {};
    const timers:    Partial<Record<TgKey, ReturnType<typeof setTimeout>>> = {};

    (['T1', 'T2', 'T3'] as const).forEach(tg => {
      const minHour = TG_MIN_HOUR[tg];
      if (minHour === undefined || kstHour < minHour) return;

      const fetchKey = `${dateStr}-${tg}`;
      if (speedsCacheRef.current.has(fetchKey)) {
        setLoadedTgs(prev => prev.has(tg) ? prev : new Set([...prev, tg]));
        return;
      }

      cancelled[tg] = false;
      const poll = async () => {
        try {
          const res  = await fetch(`/api/topis/road-stats?date=${dateStr}&tg=${tg}`);
          const data = await res.json() as { loading: boolean; speeds: Record<string, number>; date?: string };
          if (cancelled[tg]) return;
          if (!data.loading && Object.keys(data.speeds ?? {}).length > 0) {
            const entry = { speeds: data.speeds, date: data.date ?? dateStr };
            speedsCacheRef.current.set(fetchKey, entry);
            setLoadedTgs(prev => new Set([...prev, tg]));
          } else if (data.loading) {
            timers[tg] = setTimeout(poll, 3_000);
          }
        } catch { /* ignore */ }
      };
      poll();
    });

    return () => {
      (['T1', 'T2', 'T3'] as const).forEach(tg => {
        cancelled[tg] = true;
        clearTimeout(timers[tg]);
      });
    };
  }, [kstHour]);

  // 선택된 tg가 바뀌면 캐시에서 즉시 적용 (버튼은 로드 완료 후에만 활성화되므로 캐시 보장)
  useEffect(() => {
    if (!selectedTg || selectedTg === 'live') {
      setHistoricalSpeeds(undefined);
      setDataInfo(null);
      return;
    }
    const cached = speedsCacheRef.current.get(`${getKSTYmd()}-${selectedTg}`);
    if (cached) {
      setHistoricalSpeeds(cached.speeds);
      setDataInfo({ date: cached.date, tg: selectedTg });
    }
  }, [selectedTg]);

  // linkSpeeds: live → TrafficInfo, else → road-stats, null → none
  const linkSpeeds = selectedTg === 'live' ? liveTraffic?.linkSpeeds : (selectedTg ? historicalSpeeds : undefined);

  const handleInteractionChange = useCallback((active: boolean) => {
    clearTimeout(hideTimerRef.current);
    if (active) {
      setIsInteracting(true);
    } else {
      hideTimerRef.current = setTimeout(() => setIsInteracting(false), 400);
    }
  }, []);

  const t = useTranslations('title');
  const tc = useTranslations('controls');
  const tl = useTranslations('legend');

  const visible = !isHidden && !isInteracting;
  const overlayStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.25s ease',
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <SeoulMap onInteractionChange={handleInteractionChange} linkSpeeds={linkSpeeds} />

      {/* Title */}
      <div style={{
        ...overlayStyle,
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(90,170,220,0.15)', borderRadius: 8, padding: '8px 14px',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#5aaadd', letterSpacing: 1.5, fontFamily: 'system-ui' }}>
          {t('main')}
        </div>
        <div style={{ fontSize: 9, color: '#2a5878', marginTop: 2, fontFamily: 'monospace', letterSpacing: 1 }}>
          {t('sub')}
        </div>
      </div>

      {/* Time group selector — left center */}
      <div style={{ ...overlayStyle, position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}>
        <TimeGroupSelector
          selected={selectedTg}
          liveAvailable={liveTraffic !== null}
          liveLoading={liveLoading}
          kstHour={kstHour}
          loadedTgs={loadedTgs}
          onSelect={setSelectedTg}
        />
      </div>

      {/* Traffic panel — top right */}
      <div style={overlayStyle}>
        <TrafficPanel
          kstHour={kstHour}
          kstMinute={kstMinute}
          selectedTg={selectedTg}
          daily={daily}
          dataInfo={dataInfo}
        />
      </div>

      {/* Speed legend — bottom right */}
      <div style={{
        ...overlayStyle,
        position: 'absolute', bottom: 24, right: 20,
        background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(90,170,220,0.15)', borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'system-ui, monospace',
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 9, color: '#2a5878', marginBottom: 5, letterSpacing: 1 }}>{tl('speedTitle')}</div>
        {([
          ['#cc0000', '0'],
          ['#ff5500', '17'],
          ['#ff9900', '25'],
          ['#ffbb00', '29'],
          ['#ddcc00', '33'],
          ['#99cc22', '38'],
          ['#55bb55', '45'],
          ['#44aaff', '55'],
          ['#aaddff', '90+'],
        ] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 24, height: 4, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: '#3a6888' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setIsHidden(h => !h)}
        title={isHidden ? tc('showPanel') : tc('hidePanel')}
        style={{
          position: 'absolute', bottom: 24, left: 20,
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(10px)',
          border: `1px solid rgba(90,170,220,${isHidden ? '0.5' : '0.15'})`,
          color: isHidden ? '#5aaadd' : '#2a5878',
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        {isHidden ? '◉' : '◎'}
      </button>
    </div>
  );
}
