export interface HourEntry {
  hh: number;
  vol: number | null;
  intensity: number | null;
  source: 'historical' | 'realtime' | 'future';
}

export interface DailyData {
  ymd: string;
  currentHour: number;
  maxVol: number;
  hours: HourEntry[];
  loading: boolean;
  loadedCount: number;
  totalHours: number;
}

export interface SeoulTrafficSummary {
  averageSpeed: number;
  smoothPct: number;
  slowPct: number;
  congestedPct: number;
  fetchedAt: number;
  linkSpeeds: Record<string, number>; // linkId → km/h
}

export interface RoadSegment {
  id: number;
  type: string;
  coords: [number, number][]; // [lng, lat] GeoJSON order
}

export interface SimVehicle {
  segIndex: number;
  progress: number;         // 0..1 along segment
  speed: number;            // progress per second
  color: [number, number, number]; // RGB 0..1
}
