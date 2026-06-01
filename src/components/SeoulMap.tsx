'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
        id: 'label-city',
        type: 'symbol',
        source: 'v', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'state'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name']],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 14, 22],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#5aaadd',
          'text-halo-color': '#06090f',
          'text-halo-width': 2,
        },
      },
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

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  onInteractionChange?: (active: boolean) => void;
  linkSpeeds?: Record<string, number>;
  showAccidents?: boolean;
  onAccidentsLoaded?: () => void;
}

export default function SeoulMap({ onInteractionChange, linkSpeeds, showAccidents = true, onAccidentsLoaded }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const mapReadyRef   = useRef(false);
  const networkRef    = useRef<GeoJSON.FeatureCollection | null>(null);
  const linkSpeedsRef = useRef(linkSpeeds);
  useEffect(() => { linkSpeedsRef.current = linkSpeeds; }, [linkSpeeds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const vis = showAccidents ? 'visible' : 'none';
    if (map.getLayer('accident-glow')) map.setLayoutProperty('accident-glow', 'visibility', vis);
    if (map.getLayer('accident-dot'))  map.setLayoutProperty('accident-dot',  'visibility', vis);
  }, [showAccidents]);

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
      center: SEOUL_CENTER,
      zoom: 15,
      pitch: 55,
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 18, 18, 28],
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3.5, 18, 7],
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
