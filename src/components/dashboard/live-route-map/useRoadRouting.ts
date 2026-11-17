import { useEffect, useMemo, useRef, useState } from 'react';
import { authenticatedFetch, safeJsonResponse } from '../../../api';
import { makeRoadLegKey, type RoadLegData, type RouteStopItem } from '../../../utils/routeProgress';

interface RoutingApiResponse {
  success?: boolean;
  source?: 'osrm' | 'fallback';
  legs?: RoadLegData[];
}

export function useRoadRouting(stops: RouteStopItem[], guestJoinCode?: string) {
  const cacheRef = useRef<Map<string, RoadLegData>>(new Map());
  const [roadLegsMap, setRoadLegsMap] = useState<ReadonlyMap<string, RoadLegData>>(() => new Map());
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const locatedPoints = useMemo(
    () =>
      stops
        .filter(
          (s): s is RouteStopItem & { lat: number; lng: number } =>
            s.hasCoordinates && typeof s.lat === 'number' && typeof s.lng === 'number',
        )
        .map((s) => ({ lat: s.lat, lng: s.lng })),
    [stops],
  );

  const coordsSignature = useMemo(
    () => locatedPoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'),
    [locatedPoints],
  );

  useEffect(() => {
    if (locatedPoints.length < 2) {
      setIsRoutingLoading(false);
      return;
    }

    let missingAnyLeg = false;
    for (let i = 1; i < locatedPoints.length; i += 1) {
      const key = makeRoadLegKey(locatedPoints[i - 1], locatedPoints[i]);
      if (!cacheRef.current.has(key)) {
        missingAnyLeg = true;
        break;
      }
    }

    if (!missingAnyLeg) {
      setRoadLegsMap(new Map(cacheRef.current));
      setIsRoutingLoading(false);
      return;
    }

    let cancelled = false;
    setIsRoutingLoading(true);

    (async () => {
      try {
        const res = guestJoinCode
          ? await fetch('/api/guest/routing/road', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ joinCode: guestJoinCode, points: locatedPoints }),
            })
          : await authenticatedFetch('/api/routing/road', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ points: locatedPoints }),
            });
        if (!res.ok) return;
        const data = await safeJsonResponse<RoutingApiResponse>(res);
        if (cancelled) return;
        if (data?.source === 'osrm' && Array.isArray(data.legs) && data.legs.length > 0) {
          for (const leg of data.legs) {
            if (leg.fromKey && leg.toKey) {
              cacheRef.current.set(`${leg.fromKey}->${leg.toKey}`, leg);
            }
          }
          setRoadLegsMap(new Map(cacheRef.current));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useRoadRouting] Fallback to estimate routing:', err);
        }
      } finally {
        if (!cancelled) {
          setIsRoutingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordsSignature, locatedPoints, guestJoinCode]);

  return { roadLegsMap, isRoutingLoading };
}

export async function fetchRealOsrmRouteSummary(
  points: readonly { lat: number; lng: number }[],
  guestJoinCode?: string,
): Promise<{ totalKm: number; totalMinutes: number; source: 'osrm' } | null> {
  if (points.length < 2) return null;
  try {
    const res = guestJoinCode
      ? await fetch('/api/guest/routing/road', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ joinCode: guestJoinCode, points }),
        })
      : await authenticatedFetch('/api/routing/road', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points }),
        });
    if (!res.ok) return null;
    const data = await safeJsonResponse<RoutingApiResponse>(res);
    if (data?.source === 'osrm' && Array.isArray(data.legs) && data.legs.length > 0) {
      const totalKm = Math.round(
        data.legs.reduce((sum, leg) => sum + (Number.isFinite(leg.distanceKm) ? leg.distanceKm : 0), 0),
      );
      const totalMinutes = Math.round(
        data.legs.reduce((sum, leg) => sum + (Number.isFinite(leg.durationMinutes) ? leg.durationMinutes : 0), 0),
      );
      if (totalKm > 0) {
        return { totalKm, totalMinutes, source: 'osrm' };
      }
    }
  } catch {
    // Graceful fallback when OSRM is unreachable
  }
  return null;
}

