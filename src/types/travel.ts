export interface Activity {
  id: string;
  timeStart: string;
  timeEnd: string;
  title: string;
  location: string;
  status: 'Hoàn tất' | 'Đang diễn ra' | 'Cần xử lý' | 'Đã xác nhận' | 'Chờ duyệt';
  type: 'transport' | 'meal' | 'sightseeing' | 'hotel' | 'checkin' | 'briefing';
  details: string;
  cost?: number;
  highlight?: boolean;
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

export interface DaySchedule {
  dayIndex: number;
  dateLabel: string; // e.g. "T4 14"
  dayName: string; // e.g. "T4"
  dateNum: number; // e.g. 14
  fullDate: string; // e.g. "Thứ Tư, 14 tháng 10"
  hasWarning?: boolean;
  activities: Activity[];
  dispatcherNote?: string;
  confirmedCount: number;
  pendingCount: number;
}

export interface Waypoint {
  id: string;
  code: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  lat: number;
  lng: number;
  xPercent: number; // For responsive SVG placement
  yPercent: number;
  arrivalTime?: string;
  departureTime?: string;
}

export interface OperationalAlert {
  id: string;
  title: string;
  timeAgo: string;
  description: string;
  severity: 'warning' | 'error' | 'info';
  category: 'weather' | 'schedule' | 'traffic' | 'hotel';
}

export interface AISuggestion {
  id: string;
  title: string;
  badge: string;
  badgeColor?: string;
  description: string;
  timeSaved?: string;
  costSaved?: string;
  confidence?: string;
  applied?: boolean;
}

export interface TripMember {
  id: string;
  name: string;
  avatar: string;
  role: 'Trưởng đoàn' | 'Hướng dẫn viên' | 'Tài xế' | 'Khách du lịch';
  phone: string;
  status: 'online' | 'busy' | 'offline';
  attendanceStatus?: 'Chưa điểm danh' | 'Có mặt' | 'Vắng mặt';
  specialPreference?: string;
}

export interface TripData {
  id: string;
  code: string; // "VN-1024"
  title: string; // "Khám phá miền Trung 7 ngày"
  status: 'Đang vận hành' | 'Chuẩn bị' | 'Hoàn thành';
  dates: string; // "12–18 THG 10, 2026"
  origin: string; // "ĐN"
  originFull: string; // "Đà Nẵng"
  destination: string; // "HUE"
  destinationFull: string; // "Huế"
  destinationsCount: number; // 5
  totalKm: number; // 428
  vehicle: string; // "Xe 29 chỗ"
  currentDay: number; // 3
  totalDays: number; // 7
  totalActivities: number; // 18
  confirmedActivities: number; // 16
  pendingActivities: number; // 2
  budgetTotal: number; // 48600000 (48.6 triệu)
  budgetUsed: number; // 18800000 (đã dùng 62%)
  budgetRemaining: number; // 29800000
  budgetUsedPercent: number; // 62
  membersOnline: number; // 8
  membersTotal: number; // 8
  membersStatus: string; // "Tất cả đã tập trung"
  members: TripMember[];
  weather: {
    temp: number;
    description: string;
    rainProb: string;
    rainProbTime: string;
  };
  telematics: {
    from: string; // "Sơn Trà"
    to: string; // "Bà Nà Hills"
    durationMinutes: number; // 42
    eta: string; // "10:24"
    vehicleType: string; // "Xe 29 chỗ"
    driver: string; // "Trần Bình"
    passengerCount: number; // 18
    gpsStatus: string; // "GPS ổn định"
    trafficStatus: string; // "Lưu thông tốt"
    lastUpdated: string; // "09:42"
  };
  waypoints: Waypoint[];
  alerts: OperationalAlert[];
  aiSuggestions: AISuggestion[];
  aiSavingsEstimate: string; // "640.000đ"
  aiConfidence: string; // "94%"
  days: DaySchedule[];
}
