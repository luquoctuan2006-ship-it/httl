import { useMemo, useState } from 'react';
import type { Waypoint } from '../../../types/travel';
import type { CalculatedLeg, DistanceLeg, OperatingHoursItem } from './planningDataTypes';

function computeHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radiusKm * c * 1.35 * 10) / 10;
}

function formatTravelTime(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes} phút`;
}

export function usePlanningRoute(locations: Waypoint[], tripTotalKm?: number) {
  const [calcOrigin, setCalcOrigin] = useState('');
  const [calcDest, setCalcDest] = useState('');

  const dynamicOperatingHours = useMemo<OperatingHoursItem[]>(
    () =>
      locations.map((waypoint) => {
        const hours = (waypoint.openHours && waypoint.openHours.trim()) || '07:30 - 18:00';
        const parts = hours.includes('-') ? hours.split('-').map((part) => part.trim()) : [hours, ''];
        const open = parts[0] || '08:00';
        const close = parts[1] || '18:00';

        let duration = '2 - 3 giờ';
        if (waypoint.category === 'nature') duration = '3 - 4 giờ';
        else if (waypoint.category === 'entertainment') duration = '4 - 5 giờ';
        else if (waypoint.category === 'food') duration = '1 - 1.5 giờ';
        else if (waypoint.category === 'stay') duration = '12 - 24 giờ';

        return {
          id: waypoint.id,
          code: waypoint.code,
          place: waypoint.name,
          category: waypoint.category || 'culture',
          open,
          close,
          openHours: hours,
          duration,
          note: waypoint.description || 'Lịch trình tham quan tiêu chuẩn Voyager',
          ticketPrice: waypoint.ticketPrice || 'Miễn phí',
          rawWaypoint: waypoint,
        };
      }),
    [locations],
  );

  const dynamicDistanceMatrix = useMemo<DistanceLeg[]>(() => {
    if (locations.length < 2) return [];
    const matrix: DistanceLeg[] = [];

    for (let index = 0; index < locations.length - 1; index++) {
      const current = locations[index];
      const next = locations[index + 1];
      const km = computeHaversineKm(current.lat, current.lng, next.lat, next.lng);
      const minutes = Math.max(10, Math.round((km / 42) * 60));
      const estTime = formatTravelTime(minutes);

      let road = `Tuyến kết nối Chặng ${index + 1} ➔ Chặng ${index + 2}`;
      if (current.name.includes('Bà Nà') || next.name.includes('Bà Nà')) {
        road = 'Tuyến QL14B & Tuyến Bà Nà - Suối Mơ';
      } else if (current.name.includes('Hải Vân') || next.name.includes('Hải Vân')) {
        road = 'Tuyến ven biển Nguyễn Tất Thành & Đèo Hải Vân';
      } else if (current.name.includes('Huế') || next.name.includes('Huế')) {
        road = 'Quốc lộ 1A thông thoáng kết nối Cố đô Huế';
      } else if (current.name.includes('Hội An') || next.name.includes('Hội An')) {
        road = 'Tuyến ven biển Võ Nguyên Giáp & Lạc Long Quân';
      }

      matrix.push({
        from: current.name,
        to: next.name,
        distance: `${km} km`,
        estTime,
        road,
        km,
      });
    }
    return matrix;
  }, [locations]);

  const totalCalculatedKm = useMemo(
    () =>
      dynamicDistanceMatrix.length > 0
        ? Math.round(dynamicDistanceMatrix.reduce((total, leg) => total + leg.km, 0))
        : tripTotalKm || 146,
    [dynamicDistanceMatrix, tripTotalKm],
  );

  const totalCalculatedHours = useMemo(
    () => formatTravelTime(Math.round((totalCalculatedKm / 42) * 60)),
    [totalCalculatedKm],
  );

  const calculatedLeg = useMemo<CalculatedLeg | null>(() => {
    if (!calcOrigin || !calcDest || calcOrigin === calcDest) return null;
    const origin = locations.find((location) => location.id === calcOrigin);
    const destination = locations.find((location) => location.id === calcDest);
    if (!origin || !destination) return null;

    const km = computeHaversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const minutes = Math.max(10, Math.round((km / 42) * 60));
    return {
      from: origin.name,
      to: destination.name,
      distance: `${km} km`,
      estTime: formatTravelTime(minutes),
    };
  }, [calcOrigin, calcDest, locations]);

  return {
    calcOrigin,
    setCalcOrigin,
    calcDest,
    setCalcDest,
    dynamicOperatingHours,
    dynamicDistanceMatrix,
    totalCalculatedKm,
    totalCalculatedHours,
    calculatedLeg,
  };
}
