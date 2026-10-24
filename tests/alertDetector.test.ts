import test from 'node:test';
import assert from 'node:assert/strict';
import { detectScheduleAndWeatherAlerts } from '../src/utils/alertDetector';
import { initialTripData } from '../src/data/mockData';
import { TripData } from '../src/types/travel';

test('detectScheduleAndWeatherAlerts detects rain alert when weather rain probability >= 40%', () => {
  const trip: TripData = {
    ...initialTripData,
    weather: {
      ...initialTripData.weather,
      rainProb: '65%',
    },
    alerts: [],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  const rainAlert = alerts.find((a) => a.title.includes('mưa') || a.title.includes('Mưa'));
  assert.ok(rainAlert, 'Should generate weather rain alert when rain probability >= 40%');
  assert.equal(rainAlert?.severity, 'warning');
});

test('detectScheduleAndWeatherAlerts detects midday outdoor activity alert', () => {
  const trip: TripData = {
    ...initialTripData,
    days: [
      {
        dayIndex: 1,
        dateLabel: 'T2 12',
        dayName: 'T2',
        dateNum: 12,
        fullDate: 'Thứ Hai, 12 tháng 10',
        hasWarning: false,
        pendingCount: 0,
        confirmedCount: 1,
        activities: [
          {
            id: 'act-noon-outdoor',
            timeStart: '12:00',
            timeEnd: '13:30',
            title: 'Khám phá bán đảo Sơn Trà',
            location: 'Bán đảo Sơn Trà',
            type: 'sightseeing',
            details: 'Tham quan chùa Linh Ứng và ngắm cảnh biển trời',
            status: 'Cần xử lý',
          },
        ],
      },
    ],
    alerts: [],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  const noonAlert = alerts.find((a) => a.title.includes('nhiệt độ cao') || a.title.includes('nắng gắt') || a.title.includes('Sơn Trà'));
  assert.ok(noonAlert, 'Should generate alert for outdoor sightseeing in midday heat');
  assert.equal(noonAlert?.severity, 'warning');
});

test('detectScheduleAndWeatherAlerts detects buffer shortage between different locations', () => {
  const trip: TripData = {
    ...initialTripData,
    days: [
      {
        dayIndex: 1,
        dateLabel: 'T2 12',
        dayName: 'T2',
        dateNum: 12,
        fullDate: 'Thứ Hai, 12 tháng 10',
        hasWarning: false,
        pendingCount: 0,
        confirmedCount: 1,
        activities: [
          {
            id: 'act-1',
            timeStart: '08:00',
            timeEnd: '09:30',
            title: 'Bảo tàng Điêu khắc Chăm',
            location: 'Bình Hiên, Hải Châu, Đà Nẵng',
            type: 'sightseeing',
            details: 'Chiêm ngưỡng các tác phẩm điêu khắc Champa',
            status: 'Đã xác nhận',
          },
          {
            id: 'act-2',
            timeStart: '09:35', // Buffer only 5 mins (< 15 mins)
            timeEnd: '11:00',
            title: 'Bán đảo Sơn Trà',
            location: 'Thọ Quang, Sơn Trà, Đà Nẵng',
            type: 'sightseeing',
            details: 'Tham quan rừng nguyên sinh Sơn Trà',
            status: 'Cần xử lý',
          },
        ],
      },
    ],
    alerts: [],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  const bufferAlert = alerts.find((a) => a.title.includes('đệm di chuyển') || a.title.includes('5 phút'));
  assert.ok(bufferAlert, 'Should flag buffer < 15 mins between different locations');
  assert.equal(bufferAlert?.severity, 'warning');
});

test('detectScheduleAndWeatherAlerts detects early hotel check-in before 13:00', () => {
  const trip: TripData = {
    ...initialTripData,
    days: [
      {
        dayIndex: 1,
        dateLabel: 'T2 12',
        dayName: 'T2',
        dateNum: 12,
        fullDate: 'Thứ Hai, 12 tháng 10',
        hasWarning: false,
        pendingCount: 0,
        confirmedCount: 1,
        activities: [
          {
            id: 'act-hotel-early',
            timeStart: '11:00',
            timeEnd: '12:00',
            title: 'Check-in Khách sạn Mường Thanh Grand',
            location: 'Đà Nẵng',
            type: 'checkin',
            details: 'Nhận phòng và cất hành lý',
            status: 'Cần xử lý',
          },
        ],
      },
    ],
    alerts: [],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  const checkinAlert = alerts.find((a) => a.title.includes('giờ nhận phòng') || a.title.includes('Check-in'));
  assert.ok(checkinAlert, 'Should flag hotel check-in scheduled before standard check-in hour');
  assert.equal(checkinAlert?.category, 'hotel');
});
