'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DistrictRank } from '@/lib/types';

const SEOUL_CENTER: [number, number] = [126.9780, 37.5665];
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

// ── SimCity dark style ──────────────────────────────────────────────────────
// Fully custom MapLibre style built on MapTiler's OpenMapTiles v3 vector tiles.
// All layer IDs, colors and widths are tuned for a cinematic top-down city look.
function buildStyle(key: string): StyleSpecification {
  const src = {
    type: 'vector' as const,
    url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
  };
  const glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`;

  return {
    version: 8,
    glyphs,
    sources: { v: src },
    layers: [

      // ── Ground ────────────────────────────────────────────────────────────
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#06090f' },
      },
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'v', 'source-layer': 'landuse',
        filter: ['in', 'class', 'residential', 'suburb', 'quarter'],
        paint: { 'fill-color': '#080d16' },
      },
      {
        id: 'landuse-commercial',
        type: 'fill',
        source: 'v', 'source-layer': 'landuse',
        filter: ['in', 'class', 'commercial', 'retail', 'office'],
        paint: { 'fill-color': '#090e1c' },
      },
      {
        id: 'landuse-industrial',
        type: 'fill',
        source: 'v', 'source-layer': 'landuse',
        filter: ['in', 'class', 'industrial'],
        paint: { 'fill-color': '#07111a' },
      },
      {
        id: 'landuse-park',
        type: 'fill',
        source: 'v', 'source-layer': 'landuse',
        filter: ['in', 'class', 'park', 'forest', 'grass', 'recreation_ground', 'cemetery'],
        paint: { 'fill-color': '#08130d' },
      },

      // ── Water ─────────────────────────────────────────────────────────────
      // Han River and lakes get a dark metallic blue
      {
        id: 'water',
        type: 'fill',
        source: 'v', 'source-layer': 'water',
        paint: { 'fill-color': '#091928' },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'v', 'source-layer': 'waterway',
        paint: {
          'line-color': '#0c2038',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2, 18, 4],
        },
      },
      // Subtle water shimmer — second layer with low opacity lighter color
      {
        id: 'water-shine',
        type: 'fill',
        source: 'v', 'source-layer': 'water',
        paint: {
          'fill-color': '#1a4060',
          'fill-opacity': 0.12,
        },
      },

      // ── Roads — each type gets a "glow" (wide, blurred) + "fill" (narrow, bright) ──

      // Motorway (고속도로)
      {
        id: 'road-motorway-glow',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1e5ab8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 18, 18, 30],
          'line-opacity': 0.18,
          'line-blur': 4,
        },
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2268cc',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 5, 18, 10],
        },
      },

      // Trunk (간선도로)
      {
        id: 'road-trunk-glow',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'trunk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#174898',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 14, 14, 18, 22],
          'line-opacity': 0.2,
          'line-blur': 3,
        },
      },
      {
        id: 'road-trunk',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'trunk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1c54b0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 4, 18, 8],
        },
      },

      // Primary (주요 도로)
      {
        id: 'road-primary-glow',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#123880',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 10, 18, 18],
          'line-opacity': 0.2,
          'line-blur': 2,
        },
      },
      {
        id: 'road-primary',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#163e90',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 3, 18, 7],
        },
      },

      // Secondary / Tertiary (2·3차 도로)
      {
        id: 'road-secondary',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0e2460',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 1.8, 18, 5],
        },
      },

      // Minor / service / residential
      {
        id: 'road-minor',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        minzoom: 14,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0a1848',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.3, 18, 2],
        },
      },

      // ── Rail ──────────────────────────────────────────────────────────────
      {
        id: 'rail',
        type: 'line',
        source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'rail', 'transit'],
        paint: {
          'line-color': '#1a2a50',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 1.5],
          'line-dasharray': [3, 2],
        },
      },

      // ── Building footprints (flat, rendered under the 3D layer) ───────────
      {
        id: 'building-footprint',
        type: 'fill',
        source: 'v', 'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': '#0c1828',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 14, 0],
        },
      },

      // ── Buildings 3D (SimCity money shot) ────────────────────────────────
      // Color goes from very dark navy (low) → electric blue (tall towers)
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'v', 'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'render_height'], 10],
             0,  '#0d1b30',
            10,  '#101f38',
            20,  '#152844',
            40,  '#1b3358',
            80,  '#224070',
            130, '#295290',
            200, '#3068b0',
            320, '#3a80d0',
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': [
            'interpolate', ['linear'], ['zoom'],
            13, 0,
            13.5, 0.88,
          ],
        },
      },

      // ── Labels ────────────────────────────────────────────────────────────
      {
        id: 'label-town',
        type: 'symbol',
        source: 'v', 'source-layer': 'place',
        filter: ['in', 'class', 'town', 'suburb', 'neighbourhood'],
        minzoom: 11,
        layout: {
          'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name']],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 14],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#3a7aaa',
          'text-halo-color': '#06090f',
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'label-road',
        type: 'symbol',
        source: 'v', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        minzoom: 13,
        layout: {
          'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name']],
          'text-font': ['Open Sans Regular'],
          'text-size': 10,
          'symbol-placement': 'line',
          'text-pitch-alignment': 'viewport',
        },
        paint: {
          'text-color': '#2a5888',
          'text-halo-color': '#06090f',
          'text-halo-width': 1,
        },
      },
    ],
  };
}

// ── Speed → color: fine-grained gradient for Seoul (10~35 km/h is the dense zone)
const SPEED_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'interpolate', ['linear'],
  ['max', ['get', 'speed'], 0],
   0,  '#cc0000',   // 완전 정체
   8,  '#ee1100',
  13,  '#ff3300',   // 극심한 혼잡
  17,  '#ff5500',
  21,  '#ff7700',   // 혼잡
  25,  '#ff9900',
  29,  '#ffbb00',   // 서행
  33,  '#ddcc00',
  38,  '#99cc22',   // 준원활
  45,  '#55bb55',
  55,  '#44aaff',   // 원활
  70,  '#66ccff',
  90,  '#aaddff',   // 쾌속
];

// Opacity: 0 when no data, visible otherwise
const SPEED_OPACITY_EXPR = (base: number): maplibregl.ExpressionSpecification => [
  'case', ['<', ['get', 'speed'], 0], 0, base,
];

const KOREA_BOUNDS: maplibregl.LngLatBoundsLike = [[124.0, 32.5], [132.5, 39.5]];

const SEOUL_CITY_CENTER: [number, number] = [126.978, 37.555];

// ── Seoul district centroids (approximate centers for labels) ─────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  '강남구':   [127.062, 37.517],
  '강동구':   [127.137, 37.543],
  '강북구':   [127.030, 37.642],
  '강서구':   [126.849, 37.557],
  '관악구':   [126.944, 37.478],
  '광진구':   [127.082, 37.546],
  '구로구':   [126.863, 37.497],
  '금천구':   [126.900, 37.457],
  '노원구':   [127.079, 37.654],
  '도봉구':   [127.047, 37.668],
  '동대문구': [127.050, 37.575],
  '동작구':   [126.964, 37.512],
  '마포구':   [126.909, 37.563],
  '서대문구': [126.939, 37.578],
  '서초구':   [127.033, 37.484],
  '성동구':   [127.041, 37.554],
  '성북구':   [127.020, 37.606],
  '송파구':   [127.112, 37.514],
  '양천구':   [126.869, 37.527],
  '영등포구': [126.911, 37.527],
  '용산구':   [126.991, 37.532],
  '은평구':   [126.930, 37.618],
  '종로구':   [126.982, 37.590],
  '중구':     [126.998, 37.563],
  '중랑구':   [127.092, 37.593],
};

function districtSpeedColor(speed: number): string {
  if (speed < 20) return '#ff4422';
  if (speed < 30) return '#ff9900';
  if (speed < 40) return '#ddcc00';
  if (speed < 55) return '#55bb55';
  return '#44aaff';
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  onInteractionChange?: (active: boolean) => void;
  linkSpeeds?: Record<string, number>;
  showAccidents?: boolean;
  onAccidentsLoaded?: () => void;
  districtRanking?: DistrictRank[];
  flyTarget?: [number, number] | null;
}

export default function SeoulMap({
  onInteractionChange, linkSpeeds,
  showAccidents = false, onAccidentsLoaded,
  districtRanking, flyTarget,
}: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<maplibregl.Map | null>(null);
  const mapReadyRef      = useRef(false);
  const networkRef       = useRef<GeoJSON.FeatureCollection | null>(null);
  const linkSpeedsRef    = useRef(linkSpeeds);
  const showAccidentsRef = useRef(showAccidents);

  useEffect(() => { linkSpeedsRef.current    = linkSpeeds; },    [linkSpeeds]);
  useEffect(() => { showAccidentsRef.current = showAccidents; }, [showAccidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const vis = showAccidents ? 'visible' : 'none';
    if (map.getLayer('accident-glow')) map.setLayoutProperty('accident-glow', 'visibility', vis);
    if (map.getLayer('accident-dot'))  map.setLayoutProperty('accident-dot',  'visibility', vis);
  }, [showAccidents]);

  useEffect(() => {
    if (!flyTarget || !mapRef.current || !mapReadyRef.current) return;
    mapRef.current.flyTo({
      center: flyTarget,
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 1400,
      pitch: 55,
    });
  }, [flyTarget]);

  // 항상 25개 구 라벨 표시 — 데이터 없으면 기본 색, 있으면 혼잡도 색 + 속도
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource('district-overlay') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const speedByDistrict: Record<string, number> = {};
    if (districtRanking) {
      for (const r of districtRanking) speedByDistrict[r.district] = r.avgSpeed;
    }

    const features: GeoJSON.Feature[] = [
      {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: SEOUL_CITY_CENTER },
        properties: { name: '서울특별시', speedLabel: '', color: '#3d7a99', isCity: true },
      },
      ...Object.entries(DISTRICT_CENTERS).map(([district, coords]) => {
        const speed = speedByDistrict[district];
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: coords },
          properties: {
            name:       district,
            speedLabel: speed != null ? `${speed}km/h` : '',
            color:      speed != null ? districtSpeedColor(speed) : '#3d7a99',
            isCity:     false,
          },
        };
      }),
    ];

    src.setData({ type: 'FeatureCollection', features });
  }, [districtRanking]);

  function applyTraffic(
    map: maplibregl.Map,
    network: GeoJSON.FeatureCollection | null | undefined,
    ls: Record<string, number> | undefined,
  ) {
    if (!network?.features?.length) return;
    const src = map.getSource('traffic-links') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const hasLink = ls && Object.keys(ls).length > 0;
    const features = network.features.map(f => {
      const linkId = f.properties!.linkId as string;
      const speed  = hasLink && ls![linkId] !== undefined ? ls![linkId] : -1;
      return { ...f, properties: { ...f.properties, speed } };
    });

    src.setData({ ...network, features });
  }

  // Re-apply whenever speed data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !networkRef.current) return;
    applyTraffic(map, networkRef.current, linkSpeeds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkSpeeds]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAPTILER_KEY
        ? buildStyle(MAPTILER_KEY)
        : 'https://tiles.openfreemap.org/styles/liberty/style.json',
      center:  SEOUL_CENTER,
      zoom:    15,
      pitch:   55,
      bearing: -15,
      maxZoom: 20,
      minZoom: 8,
      maxBounds: KOREA_BOUNDS,
      attributionControl: false,
    });

    const onStart = (e: { originalEvent?: Event }) => {
      if (e.originalEvent) onInteractionChange?.(true);
    };
    const onEnd = () => onInteractionChange?.(false);
    map.on('movestart', onStart);
    map.on('moveend',   onEnd);

    map.on('load', () => {
      const style = map.getStyle();
      const srcId = Object.entries(style.sources ?? {})
        .find(([, s]) => (s as { type: string }).type === 'vector')?.[0] ?? '';
      if (!srcId) return;

      // 3D buildings for OpenFreeMap fallback
      if (!MAPTILER_KEY && !map.getLayer('building-3d-fallback')) {
        map.addLayer({
          id: 'building-3d-fallback',
          type: 'fill-extrusion', source: srcId, 'source-layer': 'building', minzoom: 13,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 0, '#0d1b30', 80, '#224070', 300, '#3a80d0'],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
            'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.88,
          },
        });
      }

      const labelLayerId = style.layers?.find(l => l.type === 'symbol')?.id;

      // ── Per-link traffic GeoJSON source + layers ──────────────────────
      map.addSource('traffic-links', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Glow halo — transparent when speed=-1 (no data), colored otherwise
      map.addLayer({
        id: 'tl-glow',
        type: 'line', source: 'traffic-links',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': SPEED_COLOR_EXPR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 12, 15, 27, 18, 42],
          'line-blur': 7,
          'line-opacity': SPEED_OPACITY_EXPR(0.35),
        },
      }, labelLayerId);

      // Bright center line — transparent when no data
      map.addLayer({
        id: 'tl-line',
        type: 'line', source: 'traffic-links',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': SPEED_COLOR_EXPR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 15, 5, 18, 10.5],
          'line-blur': 0.5,
          'line-opacity': SPEED_OPACITY_EXPR(0.85),
        },
      }, labelLayerId);

      // ── Accident hotspots ─────────────────────────────────────────────
      map.addSource('accident-hotspots', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'accident-glow',
        type: 'circle',
        source: 'accident-hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            10, ['interpolate', ['linear'], ['get', 'accidents'], 3, 6, 15, 14],
            15, ['interpolate', ['linear'], ['get', 'accidents'], 3, 12, 15, 28],
          ],
          'circle-color': '#ff2200',
          'circle-opacity': 0.25,
          'circle-blur': 1,
        },
      }, labelLayerId);

      map.addLayer({
        id: 'accident-dot',
        type: 'circle',
        source: 'accident-hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            10, ['interpolate', ['linear'], ['get', 'accidents'], 3, 3, 15, 7],
            15, ['interpolate', ['linear'], ['get', 'accidents'], 3, 5, 15, 14],
          ],
          'circle-color': '#ff4422',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ff8866',
          'circle-stroke-opacity': 0.6,
        },
      }, labelLayerId);

      // 초기 visibility를 현재 showAccidents 값으로 설정
      const initVis = showAccidentsRef.current ? 'visible' : 'none';
      map.setLayoutProperty('accident-glow', 'visibility', initVis);
      map.setLayoutProperty('accident-dot',  'visibility', initVis);

      fetch('/api/accident-hotspots')
        .then(r => r.json())
        .then((body: unknown) => {
          const src = map.getSource('accident-hotspots') as maplibregl.GeoJSONSource | undefined;
          src?.setData(body as GeoJSON.FeatureCollection);
          onAccidentsLoaded?.();
        })
        .catch(console.error);

      // ── Accident popup on hover ────────────────────────────────────────
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'accident-popup',
      });

      map.on('mouseenter', 'accident-dot', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const { name, district, accidents, casualties, deaths } = f.properties as {
          name: string; district: string; accidents: number; casualties: number; deaths: number;
        };
        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:system-ui;font-size:13px;color:#e8f4ff;line-height:1.6">
            <div style="font-weight:700;font-size:14px;color:#ff8866;margin-bottom:6px">${name}</div>
            <div style="color:#7aaabb;margin-bottom:4px">${district}</div>
            <div style="display:flex;gap:16px;margin-top:6px">
              <span>사고 <b style="color:#ffaa44">${accidents}건</b></span>
              <span>사상 <b style="color:#ff8844">${casualties}명</b></span>
              <span>사망 <b style="color:#ff4444">${deaths}명</b></span>
            </div>
          </div>
        `).addTo(map);
      });

      map.on('mousemove', 'accident-dot', (e) => {
        popup.setLngLat(e.lngLat);
      });

      map.on('mouseleave', 'accident-dot', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // ── Road link click popup ─────────────────────────────────────────
      const roadPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: '260px',
        className: 'accident-popup',
      });

      map.on('mouseenter', 'tl-line', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const { roadName, speed, maxSpd } = f.properties as {
          roadName: string; speed: number; maxSpd: number;
        };
        if (speed < 0) return;

        map.getCanvas().style.cursor = 'pointer';

        const label = speed < 20 ? '정체' : speed < 35 ? '서행' : speed < 55 ? '원활' : '쾌속';
        const color = speed < 20 ? '#ff4422' : speed < 35 ? '#ff9900' : speed < 55 ? '#55bb55' : '#44aaff';

        roadPopup.setLngLat(e.lngLat).setHTML(`
          <div style="font-family:system-ui;padding:4px 2px;color:#e8f4ff;line-height:1.6">
            <div style="font-weight:700;font-size:15px;color:#5aaadd;margin-bottom:8px">
              ${roadName || '이름 없는 도로'}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:24px;font-weight:700;color:${color}">${speed}</span>
              <span style="font-size:13px;color:${color}">km/h</span>
              <span style="margin-left:2px;background:${color}22;border:1px solid ${color}55;color:${color};padding:2px 10px;border-radius:5px;font-size:12px">${label}</span>
            </div>
            <div style="color:#2a5878;font-size:12px;margin-top:6px">제한속도 ${maxSpd} km/h</div>
          </div>
        `).addTo(map);
      });

      map.on('mousemove', 'tl-line', (e) => {
        roadPopup.setLngLat(e.lngLat);
      });

      map.on('mouseleave', 'tl-line', () => {
        map.getCanvas().style.cursor = '';
        roadPopup.remove();
      });

      // ── District congestion labels (custom GeoJSON centroids) ─────────
      const defaultDistrictFeatures: GeoJSON.Feature[] = [
        // 서울특별시 city label
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: SEOUL_CITY_CENTER },
          properties: { name: '서울특별시', speedLabel: '', color: '#3d7a99', isCity: true },
        },
        // 25 districts
        ...Object.entries(DISTRICT_CENTERS).map(([district, coords]) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: coords },
          properties: { name: district, speedLabel: '', color: '#3d7a99', isCity: false },
        })),
      ];

      map.addSource('district-overlay', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: defaultDistrictFeatures },
      });

      // 서울특별시 city label — visible at lower zoom, very large
      map.addLayer({
        id: 'seoul-label',
        type: 'symbol',
        source: 'district-overlay',
        filter: ['==', ['get', 'isCity'], true],
        minzoom: 8,
        maxzoom: 11,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 32, 11, 48],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#06090f',
          'text-halo-width': 3,
        },
      });

      // District name labels
      map.addLayer({
        id: 'district-label',
        type: 'symbol',
        source: 'district-overlay',
        filter: ['==', ['get', 'isCity'], false],
        minzoom: 9,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 24, 14, 36],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-max-width': 5,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#06090f',
          'text-halo-width': 2.5,
        },
      });

      // Speed sub-label below district name
      map.addLayer({
        id: 'district-speed',
        type: 'symbol',
        source: 'district-overlay',
        filter: ['==', ['get', 'isCity'], false],
        minzoom: 10,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'speedLabel'],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 18, 14, 26],
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#06090f',
          'text-halo-width': 1.5,
          'text-opacity': 0.85,
        },
      });

      mapReadyRef.current = true;

      // Fetch network GeoJSON — after load, apply any linkSpeeds that arrived early
      fetch('/api/topis/network')
        .then(r => r.json())
        .then((body: unknown) => {
          const geojson = body as GeoJSON.FeatureCollection;
          if (!Array.isArray(geojson?.features)) {
            console.warn('[SeoulMap] network response invalid:', body);
            return;
          }
          networkRef.current = geojson;
          applyTraffic(map, geojson, linkSpeedsRef.current);
        })
        .catch(console.error);
    });

    mapRef.current = map;
    return () => {
      map.off('movestart', onStart);
      map.off('moveend',   onEnd);
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, [onInteractionChange]);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}
