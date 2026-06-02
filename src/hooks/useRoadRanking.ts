'use client';

import { useState, useEffect, useMemo } from 'react';

export interface RoadRank {
  roadName: string;
  avgSpeed: number;
  linkCount: number;
  center: [number, number];
}

export function useRoadRanking(
  linkSpeeds: Record<string, number> | undefined,
): RoadRank[] | null {
  const [roadNameMap,   setRoadNameMap]   = useState<Record<string, string>>({});
  const [roadLocations, setRoadLocations] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    fetch('/api/link-roadnames')
      .then(r => r.json())
      .then((d: unknown) => setRoadNameMap(d as Record<string, string>))
      .catch(() => {});
    fetch('/api/road-locations')
      .then(r => r.json())
      .then((d: unknown) => setRoadLocations(d as Record<string, [number, number]>))
      .catch(() => {});
  }, []);

  return useMemo(() => {
    if (!linkSpeeds || Object.keys(roadNameMap).length === 0) return null;

    const buckets: Record<string, number[]> = {};
    for (const [linkId, speed] of Object.entries(linkSpeeds)) {
      if (speed < 0) continue;
      const roadName = roadNameMap[linkId];
      if (!roadName) continue;
      if (!buckets[roadName]) buckets[roadName] = [];
      buckets[roadName].push(speed);
    }

    return Object.entries(buckets)
      .filter(([name, speeds]) => speeds.length >= 3 && roadLocations[name])
      .map(([roadName, speeds]): RoadRank => ({
        roadName,
        avgSpeed:  Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length),
        linkCount: speeds.length,
        center:    roadLocations[roadName],
      }))
      .sort((a, b) => a.avgSpeed - b.avgSpeed)
      .slice(0, 5);
  }, [linkSpeeds, roadNameMap, roadLocations]);
}
