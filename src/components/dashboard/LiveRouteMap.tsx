import React, { useCallback, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Waypoint, TripData } from '../../types/travel';
import {
  applyStopStatusUpdate,
  buildRouteProgress,
  type RouteStopItem,
  type RouteStopStatus,
} from '../../utils/routeProgress';
import { LiveMapHeader } from './live-route-map/LiveMapHeader';
import { LiveMapCanvas } from './live-route-map/LiveMapCanvas';
import { RouteStopsPanel } from './live-route-map/RouteStopsPanel';
import { getStopKey, useLiveRouteMap } from './live-route-map/useLiveRouteMap';
import { useLiveRouteControls } from './live-route-map/useLiveRouteControls';
import { useRoadRouting } from './live-route-map/useRoadRouting';
import { STATUS_LABEL, type MapLayer } from './live-route-map/mapHelpers';

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
  const [mapLayer, setMapLayer] = useState<MapLayer>('streets');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null);

  const baseProgress = useMemo(
    () => buildRouteProgress(trip, dayFilter),
    [trip, dayFilter],
  );

  const { roadLegsMap, isRoutingLoading } = useRoadRouting(baseProgress.stops, guestJoinCode);

  const progress = useMemo(
    () => buildRouteProgress(trip, dayFilter, roadLegsMap),
    [trip, dayFilter, roadLegsMap],
  );

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
    mapLayer,
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
        mapLayer={mapLayer}
        setMapLayer={setMapLayer}
        layerDropdownOpen={layerDropdownOpen}
        setLayerDropdownOpen={setLayerDropdownOpen}
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
      />
    </div>
  );
};
