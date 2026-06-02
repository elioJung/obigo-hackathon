'use client';

import { useState, useEffect, useMemo } from 'react';

export interface RoadRank {
  roadName:  string;
  avgSpeed:  number;
  linkCount: number;
  center:    [number, number];
}

interface RoadMaps {
  names:     Map<string, string>;
  locations: Map<string, [number, number]>;
}

export function useRoadRanking(
  linkSpeeds: Record<string, number> | undefined,
): RoadRank[] | null {
  const [roadMaps, setRoadMaps] = useState<RoadMaps | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/link-roadnames').then(r => r.json()),
      fetch('/api/road-locations').then(r => r.json()),
    ])
      .then(([names, locations]) => setRoadMaps({
        names:     new Map(Object.entries(names     as Record<string, string>)),
        locations: new Map(Object.entries(locations as Record<string, [number, number]>)),
      }))
      .catch(() => {});
  }, []);

  return useMemo(() => {
    if (!linkSpeeds || !roadMaps) return null;
    const { names, locations } = roadMaps;

    const buckets = new Map<string, number[]>();
    for (const [linkId, speed] of Object.entries(linkSpeeds)) {
      if (speed < 0) continue;
      const roadName = names.get(linkId);
      if (!roadName) continue;
      const existing = buckets.get(roadName);
      if (existing) existing.push(speed);
      else buckets.set(roadName, [speed]);
    }

    return Array.from(buckets.entries())
      .filter(([name, speeds]) => speeds.length >= 3 && locations.has(name))
      .map(([roadName, speeds]): RoadRank => ({
        roadName,
        avgSpeed:  Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length),
        linkCount: speeds.length,
        center:    locations.get(roadName)!,
      }))
      .sort((a, b) => a.avgSpeed - b.avgSpeed)
      .slice(0, 5);
  }, [linkSpeeds, roadMaps]);
}
