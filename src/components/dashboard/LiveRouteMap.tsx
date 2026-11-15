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
import { STATUS_LABEL, type MapLayer } from './live-route-map/mapHelpers';

interface LiveRouteMapProps {
  trip: TripData;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  trip,
  onSelectWaypoint,
  onUpdateTrip,
  searchQuery = '',
}) => {
  const [mapLayer, setMapLayer] = useState<MapLayer>('streets');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null);

  const progress = useMemo(
    () => buildRouteProgress(trip, dayFilter),
    [trip, dayFilter],
  );

  const handleSelectStopOnMap = useCallback((stop: RouteStopItem) => {
    setSelectedStopKey(getStopKey(stop));
  }, []);

  const map = useLiveRouteMap({
    tripId: trip.id,
    stops: progress.stops,
    selectedStopKey,
    onSelectStop: handleSelectStopOnMap,
    mapLayer,
    searchQuery,
  });

  const weatherCoords = useMemo(() => {
    const refStop =
      progress.currentStop?.hasCoordinates &&
      progress.currentStop.lat !== null &&
      progress.currentStop.lng !== null
        ? progress.currentStop
        : progress.stops.find((s) => s.hasCoordinates && s.lat !== null && s.lng !== null);
    return refStop && refStop.lat !== null && refStop.lng !== null
      ? { lat: refStop.lat, lng: refStop.lng }
      : null;
  }, [progress.currentStop, progress.stops]);

  const controls = useLiveRouteControls({
    trip,
    onUpdateTrip,
    weatherCoords,
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
        trip={trip}
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
        selectedStopKey={selectedStopKey}
        onFocusStop={handleFocusStop}
        onChangeStopStatus={onUpdateTrip ? handleChangeStopStatus : undefined}
        onOpenStopActivity={onSelectWaypoint ? handleOpenStopActivity : undefined}
      />
    </div>
  );
};
