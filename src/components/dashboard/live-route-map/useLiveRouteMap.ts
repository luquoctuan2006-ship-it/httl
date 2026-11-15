import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { formatTravelDuration, type RouteStopItem } from '../../../utils/routeProgress';
import { escapeHtml, STATUS_LABEL, type MapLayer } from './mapHelpers';

interface UseLiveRouteMapOptions {
  tripId: string;
  stops: RouteStopItem[];
  selectedStopKey: string | null;
  onSelectStop?: (stop: RouteStopItem) => void;
  mapLayer: MapLayer;
  searchQuery: string;
}

type LocatedRouteStop = RouteStopItem & { lat: number; lng: number };

export function getStopKey(stop: Pick<RouteStopItem, 'id' | 'order'>): string {
  return `${stop.id}:${stop.order}`;
}

export function useLiveRouteMap({
  tripId,
  stops,
  selectedStopKey,
  onSelectStop,
  mapLayer,
  searchQuery,
}: UseLiveRouteMapOptions) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylinesRef = useRef<L.Polyline[]>([]);
  const segmentLabelsRef = useRef<L.Marker[]>([]);

  const locatedStops = useMemo(
    () =>
      stops.filter(
        (s): s is LocatedRouteStop =>
          s.hasCoordinates && typeof s.lat === 'number' && typeof s.lng === 'number',
      ),
    [stops],
  );

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

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

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
        `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : ''}`,
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
          referrerPolicy: 'strict-origin-when-cross-origin',
        },
      ).addTo(map);
    }

    polylinesRef.current.forEach((line) => map.removeLayer(line));
    polylinesRef.current = [];
    segmentLabelsRef.current.forEach((label) => map.removeLayer(label));
    segmentLabelsRef.current = [];
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    // Draw ordered route segments colored by progress using only stops with valid coordinates
    for (let i = 1; i < locatedStops.length; i += 1) {
      const prev = locatedStops[i - 1];
      const curr = locatedStops[i];
      const legDone = prev.status === 'completed' && (curr.status === 'completed' || curr.status === 'current');

      const segmentLine = L.polyline(
        [
          [prev.lat, prev.lng],
          [curr.lat, curr.lng],
        ],
        legDone
          ? { color: '#059669', weight: 4.5, opacity: 0.9 }
          : { color: '#0F766E', weight: 4, opacity: 0.8, dashArray: '6, 8' },
      ).addTo(map);
      polylinesRef.current.push(segmentLine);

      if (curr.distanceFromPrevKm >= 1 && locatedStops.length <= 15) {
        const midLat = (prev.lat + curr.lat) / 2;
        const midLng = (prev.lng + curr.lng) / 2;
        const segText = `${curr.distanceFromPrevKm} km • ~${formatTravelDuration(curr.travelMinutesFromPrev)}`;
        const segIcon = L.divIcon({
          className: 'route-segment-pill',
          html: `
            <div style="
              background: rgba(255,255,255,0.94);
              color: #0F172A;
              border: 1px solid #CBD5E1;
              border-radius: 9999px;
              padding: 2px 7px;
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(15,23,42,0.12);
              transform: translate(-50%, -50%);
              pointer-events: none;
            ">
              ${escapeHtml(segText)}
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const labelMarker = L.marker([midLat, midLng], {
          icon: segIcon,
          interactive: false,
          keyboard: false,
        }).addTo(map);
        segmentLabelsRef.current.push(labelMarker);
      }
    }

    // Offset markers slightly if multiple stops share exact coordinates so every visit order number is clickable
    const coordCount = new Map<string, number>();

    locatedStops.forEach((stop) => {
      const coordKey = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
      const dupIndex = coordCount.get(coordKey) ?? 0;
      coordCount.set(coordKey, dupIndex + 1);
      const angle = dupIndex * ((2 * Math.PI) / 5);
      const offsetRadius = dupIndex === 0 ? 0 : 0.0018;
      const pinLat = stop.lat + Math.sin(angle) * offsetRadius;
      const pinLng = stop.lng + Math.cos(angle) * offsetRadius;

      const key = getStopKey(stop);
      const isSelected = selectedStopKey === key;
      const isCurrent = stop.status === 'current';
      const isCompleted = stop.status === 'completed';
      const bgColor = isCurrent ? '#0D9488' : isCompleted ? '#059669' : '#6366F1';
      const ringShadow = isSelected
        ? '0 0 0 4px rgba(20, 184, 166, 0.35), 0 6px 12px rgba(15, 23, 42, 0.3)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.25)';

      const pulseRing = isCurrent
        ? `<div style="
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 9999px;
            background: rgba(13, 148, 136, 0.28);
            animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
            top: -20px;
            left: -20px;
          "></div>`
        : '';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative;">
            ${pulseRing}
            <div style="
              background: ${bgColor};
              color: white;
              font-size: 11px;
              font-weight: 800;
              width: ${isSelected ? 32 : 28}px;
              height: ${isSelected ? 32 : 28}px;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2.5px solid white;
              box-shadow: ${ringShadow};
              cursor: pointer;
              transform: translate(-50%, -50%);
            ">
              ${stop.order}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([pinLat, pinLng], { icon: customIcon }).addTo(map);
      const legLine =
        stop.distanceFromPrevKm > 0
          ? `<div style="color:#475569;margin-top:3px;">Di chuyển ước tính: <strong>${stop.distanceFromPrevKm} km</strong> (~${escapeHtml(formatTravelDuration(stop.travelMinutesFromPrev))})</div>`
          : `<div style="color:#0D9488;margin-top:3px;font-weight:600;">Điểm khởi đầu tuyến</div>`;
      const dayTimeLine = [
        stop.dayIndex ? `Ngày ${stop.dayIndex}` : '',
        stop.timeLabel || '',
      ]
        .filter(Boolean)
        .join(' • ');

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px; min-width: 190px;">
          <strong style="color: #0F172A; font-size: 13px;">#${stop.order}. ${escapeHtml(stop.name)}</strong><br/>
          <span style="color: ${isCompleted ? '#059669' : isCurrent ? '#0D9488' : '#6366F1'}; font-weight: 700;">
            ${escapeHtml(STATUS_LABEL[stop.status] || '')}
          </span>
          ${dayTimeLine ? `<br/><span style="color: #64748B;">${escapeHtml(dayTimeLine)}</span>` : ''}
          ${stop.activityTitle ? `<br/><span style="color: #334155;">Hoạt động: ${escapeHtml(stop.activityTitle)}</span>` : ''}
          ${legLine}
        </div>
      `);

      marker.on('click', () => {
        onSelectStop?.(stop);
      });

      markersRef.current[key] = marker;
    });

    return () => {
      // Keep map instance attached across layer/stop updates
    };
  }, [mapLayer, locatedStops, selectedStopKey, onSelectStop]);

  const handleFitRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || locatedStops.length === 0) return;
    map.invalidateSize();
    if (locatedStops.length === 1) {
      map.flyTo([locatedStops[0].lat, locatedStops[0].lng], 12, { duration: 0.7 });
      return;
    }
    map.fitBounds(
      L.latLngBounds(locatedStops.map((s) => [s.lat, s.lng] as [number, number])),
      { padding: [44, 44], maxZoom: 13 },
    );
  }, [locatedStops]);

  useEffect(() => {
    handleFitRoute();
  }, [tripId, locatedStops, handleFitRoute]);

  useEffect(() => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    const q = searchQuery.toLowerCase();
    const matched = locatedStops.find(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.activityTitle && s.activityTitle.toLowerCase().includes(q)),
    );
    if (matched) {
      mapInstanceRef.current.flyTo([matched.lat, matched.lng], 13, { duration: 1.0 });
      markersRef.current[getStopKey(matched)]?.openPopup();
    }
  }, [searchQuery, locatedStops]);

  const focusStop = useCallback((stop: RouteStopItem) => {
    const map = mapInstanceRef.current;
    if (!map || !stop.hasCoordinates || stop.lat === null || stop.lng === null) return;
    map.flyTo([stop.lat, stop.lng], 13, { duration: 0.8 });
    markersRef.current[getStopKey(stop)]?.openPopup();
  }, []);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return {
    mapContainerRef,
    mapInstanceRef,
    handleZoomIn,
    handleZoomOut,
    handleFitRoute,
    focusStop,
  };
}
