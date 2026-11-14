import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { TripData, Waypoint } from '../../../types/travel';
import { dedupeWaypointsForMap } from '../../../utils/vietnamGeo';
import { escapeHtml, STATUS_LABEL, type MapLayer, type LiveBusPosition } from './mapHelpers';

interface UseLiveRouteMapOptions {
  trip: TripData;
  onSelectWaypoint?: (waypoint: Waypoint) => void;
  mapLayer: MapLayer;
  searchQuery: string;
}

export function useLiveRouteMap({ trip, onSelectWaypoint, mapLayer, searchQuery }: UseLiveRouteMapOptions) {
const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const busMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
// Waypoints lấy trực tiếp từ chuyến đi hiện tại (không còn viết cứng)
  const waypoints = React.useMemo(
    () =>
      (trip.waypoints || []).filter(
        (w) => !w.isHidden && Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)),
      ),
    [trip.waypoints],
  );
  const markerWaypoints = React.useMemo(
    () => dedupeWaypointsForMap(waypoints),
    [waypoints],
  );

  // Ưu tiên tọa độ GPS thực tế nếu có; nếu chưa bật GPS thì fallback theo điểm dừng hiện tại
  const hasRealGps =
    typeof trip.telematics.currentLat === 'number' &&
    typeof trip.telematics.currentLng === 'number' &&
    Number.isFinite(trip.telematics.currentLat) &&
    Number.isFinite(trip.telematics.currentLng);

  const busPos = React.useMemo(() => {
    if (hasRealGps) {
      return {
        lat: trip.telematics.currentLat as number,
        lng: trip.telematics.currentLng as number,
        isLiveGps: true,
      };
    }
    const wp =
      waypoints.find((w) => w.status === 'current') ||
      [...waypoints].reverse().find((w) => w.status === 'completed') ||
      waypoints[0];
    return wp ? { lat: wp.lat, lng: wp.lng, isLiveGps: false } : null;
  }, [hasRealGps, trip.telematics.currentLat, trip.telematics.currentLng, waypoints]);

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [16.18, 108.12],
        zoom: 10,
        zoomControl: false,
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove existing tile layer if any
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });


    // Add Tile Layer
    if (mapLayer === 'satellite') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri &mdash; Satellite Imagery',
          maxZoom: 18,
        },
      ).addTo(map);
    } else {
      const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;
      L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`,
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
          referrerPolicy: 'strict-origin-when-cross-origin',
        },
      ).addTo(map);
    }


    // Polyline connecting the route
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
    }
    const routeCoords: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lng]);
    const routeLine = L.polyline(routeCoords, {
      color: '#0F766E',
      weight: 4,
      opacity: 0.85,
      dashArray: '6, 8',
    }).addTo(map);
    polylineRef.current = routeLine;

    // Waypoint Markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    markerWaypoints.forEach((wp) => {
      const isCurrent = wp.status === 'current';
      const isCompleted = wp.status === 'completed';
      const timeLabel = [wp.arrivalTime, wp.departureTime].filter(Boolean).join(' - ') || '—';
      const bgColor = isCurrent ? '#0D9488' : isCompleted ? '#059669' : '#7C3AED';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background: ${bgColor};
            color: white;
            font-size: 11px;
            font-weight: 800;
            width: 28px;
            height: 28px;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);
            cursor: pointer;
            transform: translate(-50%, -50%);
          ">
            ${wp.code}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #0F172A; font-size: 13px;">${escapeHtml(wp.name)}</strong><br/>
          <span style="color: #0D9488; font-weight: 700;">Điểm #${escapeHtml(wp.code)} • ${STATUS_LABEL[wp.status] || ''}</span><br/>
          <span style="color: #64748B;">Khung giờ: ${escapeHtml(timeLabel)}</span>
        </div>
      `);

      marker.on('click', () => {
        onSelectWaypoint?.(wp);
      });

      markersRef.current[wp.id] = marker;
    });

    // Vehicle Bus Marker
    if (busMarkerRef.current) {
      map.removeLayer(busMarkerRef.current);
    }

    const busIcon = L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position: relative; cursor: pointer;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 9999px;
            background: rgba(13, 148, 136, 0.3);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            top: -22px;
            left: -22px;
          "></div>
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: #0F172A;
            color: #2DD4BF;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #2DD4BF;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4);
            transform: translate(-50%, -50%);
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6v6"></path>
              <path d="M15 6v6"></path>
              <path d="M2 12h19.6"></path>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-3.3-2.7-6-6-6H7c-3.3 0-6 2.7-6 6 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"></path>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="17" cy="18" r="2"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    busMarkerRef.current = null;
    if (busPos) {
      const busMarker = L.marker([busPos.lat, busPos.lng], { icon: busIcon }).addTo(map);
      const sourceLabel = busPos.isLiveGps
        ? `GPS trực tiếp (${trip.telematics.gpsUpdatedAt || 'Vừa cập nhật'})${typeof trip.telematics.speedKmh === 'number' ? ` • ${trip.telematics.speedKmh} km/h` : ''}`
        : 'Ước tính theo điểm dừng (Chưa bật GPS thiết bị)';
      busMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #0F172A; font-size: 13px;">${escapeHtml(trip.telematics.vehicleType)}${trip.telematics.licensePlate ? ` (${escapeHtml(trip.telematics.licensePlate)})` : ''}</strong><br/>
          <span style="color: #0D9488; font-weight: 700;">Tài xế: ${escapeHtml(trip.telematics.driver)}</span><br/>
          <span style="color: #64748B;">Chặng: ${escapeHtml(trip.telematics.from)} → ${escapeHtml(trip.telematics.to)}</span><br/>
          <span style="color: ${busPos.isLiveGps ? '#059669' : '#D97706'}; font-size: 11px; font-weight: 700;">${escapeHtml(sourceLabel)}</span>
        </div>
      `);
      busMarkerRef.current = busMarker;
    }

    return () => {
      // Map stays attached or is cleaned up on unmount
    };
  }, [mapLayer, trip, waypoints, markerWaypoints, busPos]);

  // Tự động zoom vừa khít tuyến mỗi khi đổi chuyến đi / đổi waypoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || waypoints.length === 0) return;
    map.invalidateSize();
    if (waypoints.length === 1) {
      map.setView([waypoints[0].lat, waypoints[0].lng], 12);
      return;
    }
    map.fitBounds(
      L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number])),
      { padding: [40, 40], maxZoom: 12 },
    );
  }, [trip.id, waypoints]);

  // Handle Search Query Pan
  useEffect(() => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    const q = searchQuery.toLowerCase();
    const matched = waypoints.find(
      (wp) => wp.name.toLowerCase().includes(q) || wp.code.toLowerCase().includes(q)
    );
    if (matched) {
      mapInstanceRef.current.flyTo([matched.lat, matched.lng], 13, { duration: 1.2 });
      markersRef.current[matched.id]?.openPopup();
    }
  }, [searchQuery, waypoints]);
// Zoom helpers
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetFocus = () => {
    if (!busPos) return;
    mapInstanceRef.current?.flyTo([busPos.lat, busPos.lng], 12, { duration: 1 });
    busMarkerRef.current?.openPopup();
  };
  return {
    mapContainerRef,
    mapInstanceRef,
    waypoints,
    hasRealGps,
    busPos,
    handleZoomIn,
    handleZoomOut,
    handleResetFocus,
  };
}
