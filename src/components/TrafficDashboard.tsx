'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import SeoulMap from './SeoulMap';
import TrafficPanel from './TrafficPanel';
import TimeGroupSelector, { type TgKey } from './TimeGroupSelector';
import IntroVideo from './IntroVideo';
import { fetchSeoulTraffic, fetchDailyData } from '@/lib/traffic';
import type { SeoulTrafficSummary, DailyData } from '@/lib/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import activeLinksData from '@/data/active-links.json';

function getKSTTime() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function getKSTYesterday(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  d.setDate(d.getDate() - 1);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('');
}

export default function TrafficDashboard() {
  const isMobile = useIsMobile();
  const [showIntro, setShowIntro] = useState(true);
  const [selectedTg, setSelectedTg]     = useState<TgKey | null>(null);
  const [kstHour, setKstHour]           = useState(() => getKSTTime().hour);
  const [kstMinute, setKstMinute]       = useState(() => getKSTTime().minute);
  const [liveTraffic, setLiveTraffic]   = useState<SeoulTrafficSummary | null>(null);
  const [liveLoading, setLiveLoading]   = useState(true);
  const [daily, setDaily]               = useState<DailyData | null>(null);
  const [historicalSpeeds, setHistoricalSpeeds] = useState<Record<string, number> | undefined>(undefined);
  const [dataInfo, setDataInfo]         = useState<{ date: string; tg: string } | null>(null);
  const [loadedTgs, setLoadedTgs]         = useState<Set<TgKey>>(new Set());
  const [failedTgs, setFailedTgs]         = useState<Set<TgKey>>(new Set());
  const [isInteracting, setIsInteracting]   = useState(false);
  const [isHidden, setIsHidden]             = useState(false);
  const [showAccidents, setShowAccidents]     = useState(false);
  const [accidentsLoaded, setAccidentsLoaded] = useState(false);
  const [testData, setTestData]           = useState<Record<string, number> | null>(null);
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

  // Real-time traffic — poll every 180s (data source updates every 30s)
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
    const id = setInterval(poll, 180_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Daily volume for timeline bars — hourly data, poll every 5min
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const data = await fetchDailyData();
      if (cancelled) return;
      if (data) setDaily(data);
      if (!cancelled) timer = setTimeout(poll, data?.loading ? 3_000 : 300_000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // 전일 도로통계 프리페치 — 마운트 시 T1/T2/T3 모두 즉시 fetch
  useEffect(() => {
    const dateStr = getKSTYesterday();
    const cancelled: Partial<Record<TgKey, boolean>> = {};

    (['T1', 'T2', 'T3'] as const).forEach(tg => {
      const fetchKey = `${dateStr}-${tg}`;
      if (speedsCacheRef.current.has(fetchKey)) {
        setLoadedTgs(prev => prev.has(tg) ? prev : new Set([...prev, tg]));
        return;
      }

      cancelled[tg] = false;
      const load = async () => {
        try {
          const res  = await fetch(`/api/topis/road-stats?date=${dateStr}&tg=${tg}`);
          const data = await res.json() as { speeds: Record<string, number>; date?: string };
          if (cancelled[tg]) return;
          if (Object.keys(data.speeds ?? {}).length > 0) {
            speedsCacheRef.current.set(fetchKey, { speeds: data.speeds, date: data.date ?? dateStr });
            setLoadedTgs(prev => new Set([...prev, tg]));
          } else {
            setFailedTgs(prev => new Set([...prev, tg]));
          }
        } catch {
          setFailedTgs(prev => new Set([...prev, tg]));
        }
      };
      load();
    });

    return () => {
      (['T1', 'T2', 'T3'] as const).forEach(tg => { cancelled[tg] = true; });
    };
  }, []);

  // 선택된 tg가 바뀌면 캐시에서 즉시 적용 (버튼은 로드 완료 후에만 활성화되므로 캐시 보장)
  useEffect(() => {
    if (!selectedTg || selectedTg === 'live') {
      setHistoricalSpeeds(undefined);
      setDataInfo(null);
      return;
    }
    if (selectedTg === 'TEST') return; // TEST는 별도 처리
    const cached = speedsCacheRef.current.get(`${getKSTYesterday()}-${selectedTg}`);
    if (cached) {
      setHistoricalSpeeds(cached.speeds);
      setDataInfo({ date: cached.date, tg: selectedTg });
    }
  }, [selectedTg]);

  // TEST 버튼 클릭 시에만 새 테스트 데이터 생성
  useEffect(() => {
    if (selectedTg === 'TEST') {
      const testSpeeds: Record<string, number> = {};
      const allLinks = activeLinksData.linkIds;
      allLinks.forEach(linkId => {
        const rand = Math.random();
        if (rand < 0.3) {
          testSpeeds[linkId] = 5 + Math.random() * 20; // Congested
        } else if (rand < 0.7) {
          testSpeeds[linkId] = 25 + Math.random() * 20; // Moderate
        } else {
          testSpeeds[linkId] = 45 + Math.random() * 25; // Smooth
        }
      });
      setTestData(testSpeeds);
    }
  }, [selectedTg]);

  let linkSpeeds: Record<string, number> | undefined;
  if (selectedTg === 'live')       linkSpeeds = liveTraffic?.linkSpeeds;
  else if (selectedTg === 'TEST')  linkSpeeds = testData ?? undefined;
  else if (selectedTg)             linkSpeeds = historicalSpeeds;

  const handleInteractionChange = useCallback((active: boolean) => {
    clearTimeout(hideTimerRef.current);
    if (active) {
      setIsInteracting(true);
    } else {
      hideTimerRef.current = setTimeout(() => setIsInteracting(false), 150);
    }
  }, []);

  const t  = useTranslations('title');
  const tc = useTranslations('controls');
  const ta = useTranslations('accidents');
  const tl = useTranslations('legend');
  const tm = useTranslations('mobile');

  const visible = !isHidden && !isInteracting;
  const overlayStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.25s ease',
  };

  // Mobile warning screen
  if (isMobile) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2a45 100%)',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🖥️</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#5aaadd', marginBottom: 16 }}>
          {tm('title')}
        </h1>
        <p style={{ fontSize: 16, color: '#7a9ab8', lineHeight: 1.6, maxWidth: 400 }}>
          {tm('description')}<br />
          {tm('instruction')}
        </p>
        <div style={{ marginTop: 32, fontSize: 14, color: '#4a6a88' }}>
          {tm('footer')}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Intro video overlay - plays while app loads in background (desktop only) */}
      {!isMobile && showIntro && <IntroVideo onComplete={() => setShowIntro(false)} />}

      {/* Main app - renders immediately to start loading in background */}
      <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <SeoulMap onInteractionChange={handleInteractionChange} linkSpeeds={linkSpeeds} showAccidents={showAccidents} onAccidentsLoaded={() => setAccidentsLoaded(true)} />

      {/* Title */}
      <div style={{
        ...overlayStyle,
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(90,170,220,0.15)', borderRadius: 11, padding: '14px 24px',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        <div style={{ fontSize: 23, fontWeight: 700, color: '#5aaadd', letterSpacing: 1.5, fontFamily: 'system-ui' }}>
          {t('main')}
        </div>
        <div style={{ fontSize: 16, color: '#2a5878', marginTop: 4, fontFamily: 'monospace', letterSpacing: 1 }}>
          {t('sub')}
        </div>
      </div>

      {/* Time group selector + accident toggle — left center */}
      <div style={{ ...overlayStyle, position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <TimeGroupSelector
          selected={selectedTg}
          liveAvailable={liveTraffic !== null}
          liveLoading={liveLoading}
          loadedTgs={loadedTgs}
          failedTgs={failedTgs}
          onSelect={(tg) => setSelectedTg(prev => prev === tg ? null : tg)}
        />
        <button
          data-no-drag
          onClick={() => accidentsLoaded && setShowAccidents(v => !v)}
          disabled={!accidentsLoaded}
          style={{
            background: showAccidents ? 'rgba(255,68,34,0.12)' : 'rgba(6,9,15,0.82)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${showAccidents ? 'rgba(255,100,60,0.5)' : !accidentsLoaded ? 'rgba(90,170,220,0.06)' : 'rgba(90,170,220,0.12)'}`,
            borderRadius: 11,
            padding: '12px 24px',
            color: !accidentsLoaded ? '#243040' : showAccidents ? '#ff8866' : '#3a6888',
            cursor: !accidentsLoaded ? 'default' : 'pointer',
            textAlign: 'left',
            fontFamily: 'system-ui, sans-serif',
            transition: 'all 0.2s',
            minWidth: 189,
          }}
        >
          <div style={{ fontSize: 19, fontWeight: showAccidents ? 700 : 500, display: 'flex', alignItems: 'center', gap: 9 }}>
            {ta('label')}
            {!accidentsLoaded && (
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#ffaa22', display: 'inline-block', flexShrink: 0,
                boxShadow: '0 0 4px #ffaa2288',
                animation: 'tg-blink 1s ease-in-out infinite',
              }} />
            )}
          </div>
          <div style={{ fontSize: 16, opacity: !accidentsLoaded ? 0.3 : 0.65, marginTop: 3 }}>{ta('sub')}</div>
        </button>
      </div>

      {/* Traffic panel — top right */}
      <div style={overlayStyle}>
        <TrafficPanel
          kstHour={kstHour}
          kstMinute={kstMinute}
          selectedTg={selectedTg}
          daily={daily}
          dataInfo={dataInfo}
          showAccidents={showAccidents}
        />
      </div>

      {/* Speed legend — bottom right */}
      <div style={{
        ...overlayStyle,
        position: 'absolute', bottom: 24, right: 20,
        background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(90,170,220,0.15)', borderRadius: 11,
        padding: '14px 20px',
        fontFamily: 'system-ui, monospace',
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 16, color: '#2a5878', marginBottom: 9, letterSpacing: 1 }}>{tl('speedTitle')}</div>
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
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <span style={{ width: 42, height: 7, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 16, color: '#3a6888' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(90,170,220,0.1)', marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 16, color: '#2a5878', marginBottom: 9, letterSpacing: 1 }}>{tl('accidentTitle')}</div>
          {([
            [5,  '3건',   '소'],
            [8,  '~8건',  '중'],
            [12, '15건+', '대'],
          ] as const).map(([size, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                width: 24, height: 24,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  width: size, height: size, borderRadius: '50%',
                  background: '#ff4422',
                  boxShadow: '0 0 6px #ff442266',
                  display: 'inline-block',
                }} />
              </span>
              <span style={{ fontSize: 16, color: '#3a6888' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setIsHidden(h => !h)}
        title={isHidden ? tc('showPanel') : tc('hidePanel')}
        style={{
          position: 'absolute', bottom: 24, left: 20,
          width: 56, height: 56, borderRadius: 11,
          background: 'rgba(6,9,15,0.82)', backdropFilter: 'blur(10px)',
          border: `1px solid rgba(90,170,220,${isHidden ? '0.5' : '0.15'})`,
          color: isHidden ? '#5aaadd' : '#2a5878',
          fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        {isHidden ? '◉' : '◎'}
      </button>
      </div>
    </>
  );
}
