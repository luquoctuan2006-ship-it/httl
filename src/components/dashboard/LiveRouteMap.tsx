import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Waypoint, TripData } from '../../types/travel';
import { LiveMapHeader } from './live-route-map/LiveMapHeader';
import { LiveMapCanvas } from './live-route-map/LiveMapCanvas';
import { TelematicsEditorModal } from './live-route-map/TelematicsEditorModal';
import { useLiveRouteMap } from './live-route-map/useLiveRouteMap';
import { useLiveRouteControls } from './live-route-map/useLiveRouteControls';
import type { MapLayer } from './live-route-map/mapHelpers';

interface LiveRouteMapProps {
  trip: TripData;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

// Weather Code translation to Vietnamese
function getWeatherDescription(code: number): string {
  if (code === 0) return 'Trời quang, nắng đẹp';
  if (code === 1) return 'Ít mây, trời trong';
  if (code === 2) return 'Mây rải rác';
  if (code === 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Có sương mù nhẹ';
  if (code >= 51 && code <= 55) return 'Mưa phùn nhẹ';
  if (code >= 61 && code <= 65) return 'Mưa rào';
  if (code >= 80 && code <= 82) return 'Mưa rào rải rác';
  if (code >= 95) return 'Dông sét đèo Hải Vân';
  return 'Thời tiết ổn định';
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c],
  );

const STATUS_LABEL: Record<string, string> = {
  completed: 'Hoàn tất',
  current: 'Đang diễn ra',
  pending: 'Chờ đến',
};


export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({ trip, onSelectWaypoint, onUpdateTrip, searchQuery = '' }) => {
  const [mapLayer, setMapLayer] = useState<MapLayer>('streets');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const map = useLiveRouteMap({ trip, onSelectWaypoint, mapLayer, searchQuery });
  const controls = useLiveRouteControls({
    trip,
    onUpdateTrip,
    busPos: map.busPos,
    mapInstanceRef: map.mapInstanceRef,
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col relative">
      <LiveMapHeader
        trip={trip}
        waypointCount={map.waypoints.length}
        mapLayer={mapLayer}
        setMapLayer={setMapLayer}
        layerDropdownOpen={layerDropdownOpen}
        setLayerDropdownOpen={setLayerDropdownOpen}
        isGpsTracking={controls.isGpsTracking}
        handleToggleGpsTracking={controls.handleToggleGpsTracking}
        isRefreshingWeather={controls.isRefreshingWeather}
        handleFetchLiveWeather={controls.handleFetchLiveWeather}
        openTelematicsEditor={controls.openTelematicsEditor}
      />
      <LiveMapCanvas {...map} {...controls} trip={trip} />
      <TelematicsEditorModal {...controls} trip={trip} />
    </div>
  );
};
