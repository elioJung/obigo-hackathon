import type { RoadSegment, SimVehicle } from './types';

const ROAD_SPEED: Record<string, number> = {
  motorway: 0.055,
  trunk:    0.045,
  primary:  0.035,
  secondary:0.025,
  tertiary: 0.018,
  residential: 0.012,
  unclassified: 0.012,
};

function lerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function vehicleColor(mult: number): [number, number, number] {
  const free: [number, number, number] = [0.27, 0.73, 1.00]; // #44bbff
  const mid:  [number, number, number] = [1.00, 0.67, 0.13]; // #ffaa22
  const jam:  [number, number, number] = [1.00, 0.27, 0.27]; // #ff4444
  if (mult < 0.5) return lerp(free, mid, mult * 2);
  return lerp(mid, jam, (mult - 0.5) * 2);
}

export function vehicleCount(mult: number): number {
  return Math.round(60 + mult * 190); // 60 (night) … 250 (peak)
}

export function initSimVehicles(segments: RoadSegment[], mult: number): SimVehicle[] {
  if (!segments.length) return [];
  const count = vehicleCount(mult);
  const color = vehicleColor(mult);

  return Array.from({ length: count }, () => {
    const segIndex = Math.floor(Math.random() * segments.length);
    const type = segments[segIndex]?.type ?? 'residential';
    const base = ROAD_SPEED[type] ?? 0.018;
    const speed = base * (1 - mult * 0.6) * (0.8 + Math.random() * 0.4);
    return { segIndex, progress: Math.random(), speed, color: [...color] as [number, number, number] };
  });
}

export function updateSimVehicles(
  vehicles: SimVehicle[],
  segments: RoadSegment[],
  dt: number,
  mult: number,
): void {
  for (const v of vehicles) {
    v.progress += v.speed * dt;
    if (v.progress >= 1) {
      v.progress = 0;
      v.segIndex = Math.floor(Math.random() * segments.length);
      const type = segments[v.segIndex]?.type ?? 'residential';
      const base = ROAD_SPEED[type] ?? 0.018;
      v.speed = base * (1 - mult * 0.6) * (0.8 + Math.random() * 0.4);
      v.color = vehicleColor(mult);
    }
  }
}

export function buildVehicleGeoJSON(
  vehicles: SimVehicle[],
  segments: RoadSegment[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const v of vehicles) {
    const seg = segments[v.segIndex];
    if (!seg || seg.coords.length < 2) continue;

    const t = v.progress * (seg.coords.length - 1);
    const i = Math.min(Math.floor(t), seg.coords.length - 2);
    const frac = t - i;
    const a = seg.coords[i];
    const b = seg.coords[i + 1];
    const lng = a[0] + (b[0] - a[0]) * frac;
    const lat = a[1] + (b[1] - a[1]) * frac;

    const [r, g, bl] = v.color;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        color: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)})`,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
