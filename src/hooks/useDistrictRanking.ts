'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DistrictRank } from '@/lib/types';

interface DistrictRankingResult {
  congested: DistrictRank[];
  smooth:    DistrictRank[];
  all:       DistrictRank[];
}

export function useDistrictRanking(
  linkSpeeds: Record<string, number> | undefined,
): DistrictRankingResult | null {
  const [districtMap, setDistrictMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/link-districts')
      .then(r => r.json())
      .then((data: unknown) => setDistrictMap(data as Record<string, string>))
      .catch(() => {});
  }, []);

  return useMemo(() => {
    if (!linkSpeeds || Object.keys(districtMap).length === 0) return null;

    const buckets: Record<string, number[]> = {};
    for (const [linkId, speed] of Object.entries(linkSpeeds)) {
      if (speed < 0) continue;
      const district = districtMap[linkId];
      if (!district) continue;
      if (!buckets[district]) buckets[district] = [];
      buckets[district].push(speed);
    }

    const ranked = Object.entries(buckets)
      .filter(([, speeds]) => speeds.length >= 5)
      .map(([district, speeds]): DistrictRank => ({
        district,
        avgSpeed: Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length),
        linkCount: speeds.length,
      }))
      .sort((a, b) => a.avgSpeed - b.avgSpeed);

    return {
      congested: ranked.slice(0, 5),
      smooth:    ranked.slice(-5).reverse(),
      all:       ranked,
    };
  }, [linkSpeeds, districtMap]);
}
