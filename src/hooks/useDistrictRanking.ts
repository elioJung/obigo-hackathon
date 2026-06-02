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
  const [districtMap, setDistrictMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch('/api/link-districts')
      .then(r => r.json())
      .then((data: unknown) => setDistrictMap(new Map(Object.entries(data as Record<string, string>))))
      .catch(() => {});
  }, []);

  return useMemo(() => {
    if (!linkSpeeds || districtMap.size === 0) return null;

    const buckets = new Map<string, number[]>();
    for (const [linkId, speed] of Object.entries(linkSpeeds)) {
      if (speed < 0) continue;
      const district = districtMap.get(linkId);
      if (!district) continue;
      const existing = buckets.get(district);
      if (existing) existing.push(speed);
      else buckets.set(district, [speed]);
    }

    const ranked = Array.from(buckets.entries())
      .filter(([, speeds]) => speeds.length >= 5)
      .map(([district, speeds]): DistrictRank => ({
        district,
        avgSpeed:  Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length),
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
