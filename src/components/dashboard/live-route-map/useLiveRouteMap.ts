import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { RouteStopWeather } from '../../../types/travel';
import { formatTravelDuration, type RouteStopItem } from '../../../utils/route/routeProgress';
import { escapeHtml, findStopWeather, STATUS_LABEL } from './mapHelpers';

interface UseLiveRouteMapOptions {
  tripId: string;
  dayFilter: number | 'all';
  stops: RouteStopItem[];
  stopForecasts?: RouteStopWeather[];
  selectedStopKey: string | null;
  onSelectStop?: (stop: RouteStopItem) => void;
  searchQuery: string;
}

type LocatedRouteStop = RouteStopItem & { lat: number; lng: number };

interface MarkerRecord {
  marker: L.Marker;
  iconSignature: string;
  popupSignature: string;
  stopRef: LocatedRouteStop;
}

export function getStopKey(stop: Pick<RouteStopItem, 'id' | 'order'>): string {
  return `${stop.id}:${stop.order}`;
}

function buildStopMarkerIcon(
  stop: LocatedRouteStop,
  isSelected: boolean,
): { icon: L.DivIcon; signature: string } {
  const isCurrent = stop.status === 'current';
  const isCompleted = stop.status === 'completed';
  const signature = `${stop.order}|${stop.status}|${isSelected ? 1 : 0}`;

  const bgColor = isCurrent ? '#DC2626' : isCompleted ? '#111827' : '#2563EB';
  const ringShadow = isSelected
    ? '0 0 0 4px rgba(37, 99, 235, 0.35), 0 6px 12px rgba(10, 10, 10, 0.35)'
    : '0 4px 6px -1px rgba(0, 0, 0, 0.28)';

  const pulseRing = isCurrent
    ? `<div style="
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        background: rgba(220, 38, 38, 0.28);
        animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        top: -20px;
        left: -20px;
      "></div>`
    : '';

  const icon = L.divIcon({
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

  return { icon, signature };
}

function buildStopPopupContent(
  stop: LocatedRouteStop,
  stopWeather?: RouteStopWeather,
): { html: string; signature: string } {
  const isCurrent = stop.status === 'current';
  const isCompleted = stop.status === 'completed';
  const sourceLabel = stop.legSource === 'osrm' ? 'đường bộ OSRM' : 'ước tính';

  const legLine =
    stop.distanceFromPrevKm > 0
      ? `<div style="color:#404040;margin-top:3px;">Di chuyển (${sourceLabel}): <strong>${stop.distanceFromPrevKm} km</strong> (~${escapeHtml(formatTravelDuration(stop.travelMinutesFromPrev))})</div>`
      : `<div style="color:#2563EB;margin-top:3px;font-weight:600;">Điểm khởi đầu tuyến</div>`;

  const dayTimeLine = [
    stop.dayIndex ? `Ngày ${stop.dayIndex}` : '',
    stop.timeLabel || '',
  ]
    .filter(Boolean)
    .join(' • ');

  const weatherLine = stopWeather
    ? `<div style="color:#1D4ED8;margin-top:3px;font-weight:600;">Thời tiết hôm nay: ${stopWeather.temp}°C • ${escapeHtml(stopWeather.description)}${stopWeather.rainProb ? ` • Mưa ${escapeHtml(stopWeather.rainProb)}` : ''}</div>`
    : '';

  const html = `
    <div style="font-family: sans-serif; font-size: 12px; padding: 2px; min-width: 200px;">
      <strong style="color: #0A0A0A; font-size: 13px;">#${stop.order}. ${escapeHtml(stop.name)}</strong><br/>
      <span style="color: ${isCompleted ? '#111827' : isCurrent ? '#DC2626' : '#2563EB'}; font-weight: 700;">
        ${escapeHtml(STATUS_LABEL[stop.status] || '')}
      </span>
      ${dayTimeLine ? `<br/><span style="color: #525252;">${escapeHtml(dayTimeLine)}</span>` : ''}
      ${stop.activityTitle ? `<br/><span style="color: #262626;">Hoạt động: ${escapeHtml(stop.activityTitle)}</span>` : ''}
      ${legLine}
      ${weatherLine}
    </div>
  `;

  const signature = [
    stop.order,
    stop.name,
    stop.status,
    stop.dayIndex ?? '',
    stop.timeLabel ?? '',
    stop.activityTitle ?? '',
    stop.distanceFromPrevKm,
    stop.travelMinutesFromPrev,
    stop.legSource ?? '',
    stopWeather?.temp ?? '',
    stopWeather?.description ?? '',
    stopWeather?.rainProb ?? '',
  ].join('|');

  return { html, signature };
}

export function useLiveRouteMap({
  tripId,
  dayFilter,
  stops,
  stopForecasts,
  selectedStopKey,
  onSelectStop,
  searchQuery,
}: UseLiveRouteMapOptions) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const segmentLabelLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;
  const lastFittedSignatureRef = useRef<string | null>(null);

  const locatedStops = useMemo(
    () =>
      stops.filter(
        (s): s is LocatedRouteStop =>
          s.hasCoordinates && typeof s.lat === 'number' && typeof s.lng === 'number',
      ),
    [stops],
  );

  // 1. Initialize Leaflet map & persistent LayerGroups once; always remove map on unmount
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [16.18, 108.12],
      zoom: 10,
      zoomControl: false,
    });
    mapInstanceRef.current = map;
    const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
    const cartoTileUrl =
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' +
      (cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : '');
    L.tileLayer(
      cartoTileUrl,
      {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
      },
    ).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    segmentLabelLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      markersRef.current.clear();
      routeLayerRef.current = null;
      segmentLabelLayerRef.current = null;
      markerLayerRef.current = null;
      mapInstanceRef.current = null;
      lastFittedSignatureRef.current = null;
      map.remove();
    };
  }, []);

  // 2. Draw route segments & distance pills (real OSRM road path when available, dashed fallback otherwise)
  const routeDrawSignature = useMemo(
    () =>
      locatedStops
        .map(
          (s) =>
            `${s.id}:${s.order}:${s.status}:${s.lat.toFixed(5)},${s.lng.toFixed(5)}:${s.distanceFromPrevKm}:${s.travelMinutesFromPrev}:${s.legSource || 'est'}:${s.legCoordinates?.length || 0}`,
        )
        .join('|'),
    [locatedStops],
  );

  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    const labelLayer = segmentLabelLayerRef.current;
    if (!routeLayer || !labelLayer) return;

    routeLayer.clearLayers();
    labelLayer.clearLayers();

    for (let i = 1; i < locatedStops.length; i += 1) {
      const prev = locatedStops[i - 1];
      const curr = locatedStops[i];
      const legDone =
        prev.status === 'completed' &&
        (curr.status === 'completed' || curr.status === 'current');

      const hasOsrmPath =
        curr.legSource === 'osrm' &&
        Array.isArray(curr.legCoordinates) &&
        curr.legCoordinates.length >= 2;

      const lineCoords: [number, number][] = hasOsrmPath
        ? curr.legCoordinates!
        : [
            [prev.lat, prev.lng],
            [curr.lat, curr.lng],
          ];

      const segmentLine = L.polyline(
        lineCoords,
        legDone
          ? { color: '#111827', weight: 4.5, opacity: 0.92 }
          : hasOsrmPath
            ? { color: '#2563EB', weight: 4, opacity: 0.88, dashArray: '8, 6' }
            : { color: '#DC2626', weight: 3.5, opacity: 0.78, dashArray: '4, 8' },
      );
      segmentLine.addTo(routeLayer);

      if (curr.distanceFromPrevKm >= 1 && locatedStops.length <= 15) {
        const midPoint = hasOsrmPath
          ? lineCoords[Math.floor(lineCoords.length / 2)]
          : [(prev.lat + curr.lat) / 2, (prev.lng + curr.lng) / 2];

        const prefix = curr.legSource === 'osrm' ? '' : '~';
        const segText = `${prefix}${curr.distanceFromPrevKm} km • ${formatTravelDuration(curr.travelMinutesFromPrev)}`;
        const segIcon = L.divIcon({
          className: 'route-segment-pill',
          html: `
            <div style="
              background: #FFFFFF;
              color: #111827;
              border: 1px solid ${curr.legSource === 'osrm' ? '#3B82F6' : '#EF4444'};
              border-radius: 9999px;
              padding: 2px 7px;
              font-size: 10px;
              font-weight: 800;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(15,23,42,0.28);
              transform: translate(-50%, -50%);
              pointer-events: none;
            ">
              ${escapeHtml(segText)}
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([midPoint[0], midPoint[1]], {
          icon: segIcon,
          interactive: false,
          keyboard: false,
        }).addTo(labelLayer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDrawSignature]);

  // 4. Incrementally reconcile markers (selecting a stop only updates the affected marker icons!)
  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;

    const coordCount = new Map<string, number>();
    const activeKeys = new Set<string>();

    for (const stop of locatedStops) {
      const coordKey = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
      const dupIndex = coordCount.get(coordKey) ?? 0;
      coordCount.set(coordKey, dupIndex + 1);
      const angle = dupIndex * ((2 * Math.PI) / 5);
      const offsetRadius = dupIndex === 0 ? 0 : 0.0018;
      const pinLat = stop.lat + Math.sin(angle) * offsetRadius;
      const pinLng = stop.lng + Math.cos(angle) * offsetRadius;

      const key = getStopKey(stop);
      activeKeys.add(key);

      const isSelected = selectedStopKey === key;
      const stopWeather = findStopWeather(stop, stopForecasts);
      const { icon, signature: iconSignature } = buildStopMarkerIcon(stop, isSelected);
      const { html: popupHtml, signature: popupSignature } = buildStopPopupContent(stop, stopWeather);

      const existing = markersRef.current.get(key);
      if (existing) {
        existing.stopRef = stop;
        const currentLatLng = existing.marker.getLatLng();
        if (
          Math.abs(currentLatLng.lat - pinLat) > 1e-6 ||
          Math.abs(currentLatLng.lng - pinLng) > 1e-6
        ) {
          existing.marker.setLatLng([pinLat, pinLng]);
        }
        if (existing.iconSignature !== iconSignature) {
          existing.marker.setIcon(icon);
          existing.iconSignature = iconSignature;
        }
        if (existing.popupSignature !== popupSignature) {
          existing.marker.setPopupContent(popupHtml);
          existing.popupSignature = popupSignature;
        }
      } else {
        const marker = L.marker([pinLat, pinLng], { icon });
        marker.bindPopup(popupHtml);
        const record: MarkerRecord = {
          marker,
          iconSignature,
          popupSignature,
          stopRef: stop,
        };
        marker.on('click', () => {
          onSelectStopRef.current?.(record.stopRef);
        });
        marker.addTo(markerLayer);
        markersRef.current.set(key, record);
      }
    }

    for (const [key, record] of markersRef.current.entries()) {
      if (!activeKeys.has(key)) {
        markerLayer.removeLayer(record.marker);
        markersRef.current.delete(key);
      }
    }
  }, [locatedStops, selectedStopKey, stopForecasts]);

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

  // 5. Fit map bounds ONLY when trip/day/stop coordinates change (never reset zoom on status/weather/selection updates)
  const routeGeometrySignature = useMemo(
    () =>
      `${tripId}::${dayFilter}::${locatedStops
        .map((s) => `${s.id}@${s.lat.toFixed(5)},${s.lng.toFixed(5)}`)
        .join('|')}`,
    [tripId, dayFilter, locatedStops],
  );

  useEffect(() => {
    if (locatedStops.length === 0) return;
    if (lastFittedSignatureRef.current === routeGeometrySignature) return;
    lastFittedSignatureRef.current = routeGeometrySignature;
    handleFitRoute();
  }, [routeGeometrySignature, locatedStops.length, handleFitRoute]);

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
      markersRef.current.get(getStopKey(matched))?.marker.openPopup();
    }
  }, [searchQuery, locatedStops]);

  const focusStop = useCallback((stop: RouteStopItem) => {
    const map = mapInstanceRef.current;
    if (!map || !stop.hasCoordinates || stop.lat === null || stop.lng === null) return;
    map.flyTo([stop.lat, stop.lng], 13, { duration: 0.8 });
    markersRef.current.get(getStopKey(stop))?.marker.openPopup();
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
