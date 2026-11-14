import type { Waypoint } from '../../../types/travel';
export type { Waypoint };

export interface VehicleItem {
  id: string;
  type: string;
  speedAvg: string;
  capacity: string;
  consumption: string;
  status: 'Sẵn sàng điều phối' | 'Đang chạy tour' | 'Bảo dưỡng định kỳ';
}

export interface ReferenceCostItem {
  id: string;
  category: string;
  item: string;
  price: string;
  note: string;
}

export interface NewLocationForm {
  code: string;
  name: string;
  lat: string;
  lng: string;
  category: string;
  openHours: string;
  ticketPrice: string;
  description: string;
}

export interface NewVehicleForm {
  type: string;
  speedAvg: string;
  capacity: string;
  consumption: string;
  status: VehicleItem['status'];
}

export interface NewCostForm {
  category: string;
  item: string;
  price: string;
  note: string;
}

export interface OperatingHoursItem {
  id: string;
  code: string;
  place: string;
  category: string;
  open: string;
  close: string;
  openHours: string;
  duration: string;
  note: string;
  ticketPrice: string;
  rawWaypoint: Waypoint;
}

export interface DistanceLeg {
  from: string;
  to: string;
  distance: string;
  estTime: string;
  road: string;
  km: number;
}

export interface CalculatedLeg {
  from: string;
  to: string;
  distance: string;
  estTime: string;
}
