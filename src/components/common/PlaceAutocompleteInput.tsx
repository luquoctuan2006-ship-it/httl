import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Compass, Globe2, Loader2, MapPin, Search, X } from 'lucide-react';
import { authenticatedFetch, safeJsonResponse } from '../../api';
import { lookupCoordinates, normalizeVietnameseText, searchLocalPlaces } from '../../utils/route/vietnamGeo';

export interface PlaceCoordinates {
  lat: number;
  lng: number;
}

interface PlaceSuggestion {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  source: 'local' | 'osm';
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (nextText: string) => void;
  coordinates?: PlaceCoordinates;
  onChangeCoordinates: (nextCoordinates: PlaceCoordinates | undefined) => void;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

function formatSelectedLabel(suggestion: PlaceSuggestion): string {
  if (suggestion.source === 'local') {
    return suggestion.name;
  }
  const segments = suggestion.displayName
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return suggestion.name;
  }
  const compact: string[] = [];
  for (const seg of segments) {
    if (seg.toLowerCase() === 'việt nam' || seg.toLowerCase() === 'vietnam') continue;
    if (/^\d{4,6}$/.test(seg)) continue; // bỏ mã bưu chính
    if (!compact.some((c) => normalizeVietnameseText(c) === normalizeVietnameseText(seg))) {
      compact.push(seg);
    }
    if (compact.length >= 3) break;
  }
  const joined = compact.join(', ');
  if (!joined) return suggestion.name;
  return joined.length > 96 ? suggestion.name : joined;
}

function mergeSuggestions(
  remote: readonly PlaceSuggestion[],
  local: readonly PlaceSuggestion[],
): PlaceSuggestion[] {
  const merged: PlaceSuggestion[] = [];
  const pushUnique = (item: PlaceSuggestion) => {
    const normName = normalizeVietnameseText(item.name);
    const exists = merged.some(
      (existing) =>
        Math.abs(existing.lat - item.lat) < 0.001 &&
        Math.abs(existing.lng - item.lng) < 0.001 &&
        normalizeVietnameseText(existing.name) === normName,
    );
    if (!exists) merged.push(item);
  };
  for (const item of remote) pushUnique(item);
  for (const item of local) pushUnique(item);
  return merged.slice(0, 8);
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  value,
  onChangeText,
  coordinates,
  onChangeCoordinates,
  placeholder = 'Tìm địa điểm trên bản đồ hoặc nhập địa chỉ...',
  inputClassName,
  disabled = false,
  id,
  required = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const skipNextRemoteRef = useRef(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [showManualCoords, setShowManualCoords] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualCoordsError, setManualCoordsError] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!hasUserEdited || disabled) return;
    if (skipNextRemoteRef.current) {
      skipNextRemoteRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const localMatches = searchLocalPlaces(query, 4);
    setSuggestions(localMatches);
    setHighlightedIndex(-1);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await authenticatedFetch(
          `/api/routing/geocode?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setIsSearching(false);
          return;
        }
        const payload = await safeJsonResponse<{
          success?: boolean;
          results?: PlaceSuggestion[];
        }>(res);
        if (!controller.signal.aborted && Array.isArray(payload.results)) {
          setSuggestions(mergeSuggestions(payload.results, localMatches));
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          // Giữ lại gợi ý cục bộ nếu ngoại tuyến hoặc không thể truy vấn OpenStreetMap
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value, hasUserEdited, disabled]);

  const handleSelectSuggestion = (item: PlaceSuggestion) => {
    skipNextRemoteRef.current = true;
    const nextLabel = formatSelectedLabel(item);
    onChangeText(nextLabel);
    onChangeCoordinates({
      lat: Number(item.lat.toFixed(5)),
      lng: Number(item.lng.toFixed(5)),
    });
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setShowManualCoords(false);
    setManualCoordsError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setHasUserEdited(true);
    setIsDropdownOpen(true);
    onChangeText(nextText);

    const trimmed = nextText.trim();
    if (!trimmed) {
      onChangeCoordinates(undefined);
      return;
    }
    const dictMatch = lookupCoordinates(trimmed);
    onChangeCoordinates(dictMatch ? { lat: dictMatch.lat, lng: dictMatch.lng } : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleOpenManualCoords = () => {
    setManualLat(coordinates ? String(coordinates.lat) : '');
    setManualLng(coordinates ? String(coordinates.lng) : '');
    setManualCoordsError(null);
    setShowManualCoords((prev) => !prev);
  };

  const handleApplyManualCoords = () => {
    const lat = Number(manualLat.trim());
    const lng = Number(manualLng.trim());
    if (
      !manualLat.trim() ||
      !manualLng.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (Math.abs(lat) <= 0.0001 && Math.abs(lng) <= 0.0001)
    ) {
      setManualCoordsError('Tọa độ không hợp lệ (Vĩ độ -90..90, Kinh độ -180..180).');
      return;
    }
    onChangeCoordinates({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
    });
    setManualCoordsError(null);
    setShowManualCoords(false);
  };

  const hasValidCoords = Boolean(
    coordinates &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lng) &&
      (Math.abs(coordinates.lat) > 0.0001 || Math.abs(coordinates.lng) > 0.0001),
  );

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          required={required}
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled && value.trim().length >= 2) {
              setHasUserEdited(true);
              setIsDropdownOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={
            inputClassName ||
            'w-full pl-8 pr-8 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none'
          }
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
          {!isSearching && value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChangeText('');
                onChangeCoordinates(undefined);
                setSuggestions([]);
                setIsDropdownOpen(false);
              }}
              className="p-0.5 text-neutral-400 hover:text-neutral-700 rounded"
              title="Xóa địa điểm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isDropdownOpen && (suggestions.length > 0 || isSearching) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-neutral-100">
            {suggestions.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(item);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2 transition cursor-pointer ${
                    isHighlighted ? 'bg-blue-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-900 truncate">{item.name}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0 flex items-center gap-1">
                        {item.source === 'osm' ? (
                          <>
                            <Globe2 className="w-2.5 h-2.5 text-blue-600" />
                            <span>OSM</span>
                          </>
                        ) : (
                          <span>Từ điển VN</span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">{item.displayName}</p>
                    <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                      {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                    </p>
                  </div>
                </button>
              );
            })}
            {isSearching && suggestions.length === 0 && (
              <div className="px-3 py-2.5 text-[11px] text-neutral-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Đang tìm địa điểm trên bản đồ OpenStreetMap...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trạng thái tọa độ & nhập thủ công */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {hasValidCoords && coordinates ? (
          <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              Đã gắn tọa độ: <span className="font-mono">{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-neutral-600 font-medium">
            <Compass className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>
              {value.trim()
                ? 'Chưa có tọa độ bản đồ — chọn từ gợi ý hoặc nhập tay'
                : 'Gõ để tìm địa điểm và tự động gắn tọa độ'}
            </span>
          </div>
        )}

        {!disabled && (
          <div className="flex items-center gap-2">
            {hasValidCoords && (
              <button
                type="button"
                onClick={() => onChangeCoordinates(undefined)}
                className="text-[11px] font-semibold text-neutral-500 hover:text-red-600 cursor-pointer"
              >
                Gỡ tọa độ
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenManualCoords}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
            >
              {showManualCoords ? 'Đóng' : hasValidCoords ? 'Sửa tọa độ' : 'Nhập tọa độ thủ công'}
            </button>
          </div>
        )}
      </div>

      {showManualCoords && !disabled && (
        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">Vĩ độ (Lat)</label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => {
                  setManualLat(e.target.value);
                  setManualCoordsError(null);
                }}
                placeholder="VD: 16.2367"
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">Kinh độ (Lng)</label>
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => {
                  setManualLng(e.target.value);
                  setManualCoordsError(null);
                }}
                placeholder="VD: 108.0885"
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono outline-none focus:border-blue-600"
              />
            </div>
          </div>
          {manualCoordsError && (
            <p className="text-[11px] font-semibold text-red-600">{manualCoordsError}</p>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowManualCoords(false)}
              className="px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-200 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApplyManualCoords}
              className="px-3 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
            >
              Áp dụng tọa độ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
