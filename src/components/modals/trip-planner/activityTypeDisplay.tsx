import {
  Bus,
  Building2,
  ClipboardCheck,
  KeyRound,
  Landmark,
  Mountain,
  UtensilsCrossed,
} from 'lucide-react';

export function getActivityTypeIcon(type: string) {
  switch (type) {
    case 'meal':
      return <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />;
    case 'hotel':
      return <Building2 className="w-3.5 h-3.5 text-purple-600" />;
    case 'checkin':
      return <KeyRound className="w-3.5 h-3.5 text-indigo-600" />;
    case 'briefing':
      return <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />;
    case 'transport':
      return <Bus className="w-3.5 h-3.5 text-blue-600" />;
    case 'sightseeing':
      return <Mountain className="w-3.5 h-3.5 text-teal-600" />;
    default:
      return <Landmark className="w-3.5 h-3.5 text-slate-600" />;
  }
}

export function getActivityTypeLabel(type: string) {
  switch (type) {
    case 'meal':
      return 'Ăn uống';
    case 'hotel':
      return 'Khách sạn / Lưu trú';
    case 'checkin':
      return 'Check-in / Nhận phòng';
    case 'briefing':
      return 'Điều hành / Tập trung';
    case 'transport':
      return 'Di chuyển';
    case 'sightseeing':
      return 'Tham quan';
    default:
      return 'Khác';
  }
}
