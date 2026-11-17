import React, { useCallback, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Waypoint, TripData } from '../../types/travel';
import {
  applyStopStatusUpdate,
  buildRouteProgress,
  type RouteStopItem,
  type RouteStopStatus,
} from '../../utils/routeProgress';
import {
  optimizeDayActivitiesByRoute,
  optimizeTripByRouteTSP,
} from '../../utils/routeTspOptimizer';
import { buildAIPlanWaypoints, isLegacyHashedCoordinate } from '../../utils/vietnamGeo';
import { LiveMapHeader } from './live-route-map/LiveMapHeader';
import { LiveMapCanvas } from './live-route-map/LiveMapCanvas';
import { RouteStopsPanel } from './live-route-map/RouteStopsPanel';
import { getStopKey, useLiveRouteMap } from './live-route-map/useLiveRouteMap';
import { useLiveRouteControls } from './live-route-map/useLiveRouteControls';
import { fetchRealOsrmRouteSummary, useRoadRouting } from './live-route-map/useRoadRouting';
import { STATUS_LABEL } from './live-route-map/mapHelpers';

interface LiveRouteMapProps {
  trip: TripData;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  readOnly?: boolean;
  guestJoinCode?: string;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  trip,
  onSelectWaypoint,
  onUpdateTrip,
  searchQuery = '',
  readOnly = false,
  guestJoinCode,
}) => {
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null);
  const [isApplyingTsp, setIsApplyingTsp] = useState(false);

  const baseProgress = useMemo(
    () => buildRouteProgress(trip, dayFilter),
    [trip, dayFilter],
  );

  const { roadLegsMap, isRoutingLoading } = useRoadRouting(baseProgress.stops, guestJoinCode);

  const progress = useMemo(
    () => buildRouteProgress(trip, dayFilter, roadLegsMap),
    [trip, dayFilter, roadLegsMap],
  );

  const tspPreview = useMemo(() => {
    if (readOnly || !onUpdateTrip || !trip.days?.length) return null;
    if (typeof dayFilter === 'number') {
      const targetDay = trip.days.find((d) => d.dayIndex === dayFilter);
      if (!targetDay) return null;
      const res = optimizeDayActivitiesByRoute(targetDay);
      if (!res.changedOrder || res.savedKm < 0.5) return null;
      return {
        scope: 'day' as const,
        dayIndex: dayFilter,
        originalKm: res.originalKm,
        optimizedKm: res.optimizedKm,
        savedKm: res.savedKm,
        savedPercent: res.savedPercent,
        orderedStopNames: res.orderedStopNames,
        dayResult: res,
      };
    }
    const tripRes = optimizeTripByRouteTSP(trip);
    if (tripRes.changedDaysCount === 0 || tripRes.savedKm < 0.5) return null;
    return {
      scope: 'trip' as const,
      originalKm: tripRes.originalKm,
      optimizedKm: tripRes.optimizedKm,
      savedKm: tripRes.savedKm,
      savedPercent: tripRes.savedPercent,
      tripResult: tripRes,
    };
  }, [trip, dayFilter, readOnly, onUpdateTrip]);

  const handleApplyTspRoute = useCallback(async () => {
    if (!onUpdateTrip || !tspPreview || isApplyingTsp) return;
    setIsApplyingTsp(true);
    try {
      let nextTrip: TripData;
      if (tspPreview.scope === 'day') {
        const updatedDays = trip.days.map((d) =>
          d.dayIndex === tspPreview.dayIndex ? tspPreview.dayResult.updatedDay : d,
        );
        const allActs = updatedDays.flatMap((d) => d.activities || []);
        const nextWaypoints = buildAIPlanWaypoints(
          trip.originFull || trip.origin || 'Điểm khởi hành',
          trip.destinationFull || trip.destination || 'Điểm đến',
          allActs,
        );
        nextTrip = {
          ...trip,
          days: updatedDays,
          ...(nextWaypoints.length >= 2
            ? { waypoints: nextWaypoints, destinationsCount: nextWaypoints.length }
            : {}),
        };
      } else {
        nextTrip = tspPreview.tripResult.updatedTrip;
      }

      const locatedPoints = (nextTrip.waypoints || []).filter(
        (wp) =>
          (Math.abs(wp.lat) > 0.0001 || Math.abs(wp.lng) > 0.0001) &&
          !isLegacyHashedCoordinate(wp.name || '', wp.lat, wp.lng),
      );
      const osrmSummary = await fetchRealOsrmRouteSummary(locatedPoints, guestJoinCode);
      if (osrmSummary) {
        nextTrip = { ...nextTrip, totalKm: osrmSummary.totalKm };
      }

      await Promise.resolve(
        onUpdateTrip(
          nextTrip,
          `Đã tối ưu lộ trình TSP${tspPreview.scope === 'day' ? ` Ngày ${tspPreview.dayIndex}` : ''}: tiết kiệm ${tspPreview.savedKm} km (${tspPreview.savedPercent}%)!`,
        ),
      );
    } finally {
      setIsApplyingTsp(false);
    }
  }, [onUpdateTrip, tspPreview, isApplyingTsp, trip, guestJoinCode]);

  const canSyncOsrmKm = Boolean(
    !readOnly &&
      onUpdateTrip &&
      dayFilter === 'all' &&
      progress.routingSource === 'osrm' &&
      progress.totalRouteKm > 0 &&
      Math.abs(Math.round(progress.totalRouteKm) - Math.round(trip.totalKm || 0)) >= 2,
  );

  const handleSyncOsrmKm = useCallback(() => {
    if (!onUpdateTrip || !canSyncOsrmKm) return;
    const roundedOsrmKm = Math.round(progress.totalRouteKm);
    onUpdateTrip(
      {
        ...trip,
        totalKm: roundedOsrmKm,
      },
      `Đã đồng bộ tổng quãng đường thực tế theo OSRM: ${roundedOsrmKm} km!`,
    );
  }, [onUpdateTrip, canSyncOsrmKm, progress.totalRouteKm, trip]);

  const handleSelectStopOnMap = useCallback((stop: RouteStopItem) => {
    setSelectedStopKey(getStopKey(stop));
  }, []);

  const controls = useLiveRouteControls({
    trip,
    onUpdateTrip: readOnly ? undefined : onUpdateTrip,
    stops: progress.stops,
    currentStop: progress.currentStop,
  });

  const map = useLiveRouteMap({
    tripId: trip.id,
    dayFilter,
    stops: progress.stops,
    stopForecasts: controls.weather?.stopForecasts,
    selectedStopKey,
    onSelectStop: handleSelectStopOnMap,
    searchQuery,
  });

  const handleFocusStop = useCallback(
    (stop: RouteStopItem) => {
      setSelectedStopKey(getStopKey(stop));
      if (stop.hasCoordinates && stop.lat !== null && stop.lng !== null) {
        map.focusStop(stop);
      }
    },
    [map],
  );

  const handleChangeStopStatus = useCallback(
    (stop: RouteStopItem, nextStatus: RouteStopStatus) => {
      if (!onUpdateTrip) return;
      const updatedTrip = applyStopStatusUpdate(trip, stop, nextStatus);
      onUpdateTrip(
        updatedTrip,
        `Đã cập nhật "${stop.name}" sang "${STATUS_LABEL[nextStatus] || nextStatus}"!`,
      );
    },
    [trip, onUpdateTrip],
  );

  const handleOpenStopActivity = useCallback(
    (stop: RouteStopItem) => {
      if (!onSelectWaypoint) return;
      const wp: Waypoint = stop.waypointRef || {
        id: stop.id,
        code: stop.code,
        name: stop.name,
        status: stop.status,
        lat: stop.lat ?? 0,
        lng: stop.lng ?? 0,
        xPercent: 50,
        yPercent: 50,
      };
      onSelectWaypoint(wp);
    },
    [onSelectWaypoint],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col relative">
      <LiveMapHeader
        trip={trip}
        stopCount={progress.totalStops}
        totalRouteKm={progress.totalRouteKm}
        totalTravelMinutes={progress.totalTravelMinutes}
        routingSource={progress.routingSource}
        isRoutingLoading={isRoutingLoading}
        dayFilter={dayFilter}
        setDayFilter={setDayFilter}
        isRefreshingWeather={controls.isRefreshingWeather}
        handleFetchLiveWeather={controls.handleFetchLiveWeather}
        handleFitRoute={map.handleFitRoute}
      />
      <LiveMapCanvas
        weather={controls.weather}
        isRefreshingWeather={controls.isRefreshingWeather}
        progress={progress}
        mapContainerRef={map.mapContainerRef}
        weatherNotice={controls.weatherNotice}
        setWeatherNotice={controls.setWeatherNotice}
        handleZoomIn={map.handleZoomIn}
        handleZoomOut={map.handleZoomOut}
        handleFitRoute={map.handleFitRoute}
      />
      <RouteStopsPanel
        progress={progress}
        stopForecasts={controls.weather?.stopForecasts}
        selectedStopKey={selectedStopKey}
        onFocusStop={handleFocusStop}
        onChangeStopStatus={!readOnly && onUpdateTrip ? handleChangeStopStatus : undefined}
        onOpenStopActivity={!readOnly && onSelectWaypoint ? handleOpenStopActivity : undefined}
        tspPreview={
          tspPreview
            ? {
                originalKm: tspPreview.originalKm,
                optimizedKm: tspPreview.optimizedKm,
                savedKm: tspPreview.savedKm,
                savedPercent: tspPreview.savedPercent,
                isApplying: isApplyingTsp,
                onApply: handleApplyTspRoute,
              }
            : undefined
        }
        osrmSyncAction={
          canSyncOsrmKm
            ? {
                osrmKm: Math.round(progress.totalRouteKm),
                currentTripKm: Math.round(trip.totalKm || 0),
                onSync: handleSyncOsrmKm,
              }
            : undefined
        }
      />
    </div>
  );
};

