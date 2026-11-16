import test from 'node:test';
import assert from 'node:assert/strict';
import { detectScheduleAndWeatherAlerts } from '../src/utils/alertDetector';
import { initialTripData } from '../src/data/mockData';
import { TripData } from '../src/types/travel';

test('detectScheduleAndWeatherAlerts detects rain alert when weather rain probability >= 40%', () => {
  const trip: TripData = {
    ...initialTripData,
    days: [],
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

test('rain percentage parsing does not turn decimal probabilities into false high-risk alerts', () => {
  const trip: TripData = {
    ...initialTripData,
    days: [],
    weather: {
      ...initialTripData.weather,
      description: '',
      rainProb: '10.5%',
      stopForecasts: [],
    },
    alerts: [],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  assert.equal(alerts.some((alert) => alert.category === 'weather'), false);
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

test('alert scan sorts activities by time and removes stale generated schedule warnings', () => {
  const trip: TripData = {
    ...initialTripData,
    id: 'trip-alert-order',
    days: [
      {
        dayIndex: 1,
        dateLabel: 'T2 12',
        dayName: 'T2',
        dateNum: 12,
        fullDate: 'Thứ Hai, 12 tháng 10',
        hasWarning: false,
        pendingCount: 0,
        confirmedCount: 2,
        activities: [
          {
            id: 'act-later',
            timeStart: '09:00',
            timeEnd: '10:00',
            title: 'Hoạt động sau',
            location: 'Điểm B',
            type: 'sightseeing',
            details: '',
            status: 'Đã xác nhận',
          },
          {
            id: 'act-earlier',
            timeStart: '08:00',
            timeEnd: '09:30',
            title: 'Hoạt động trước',
            location: 'Điểm A',
            type: 'sightseeing',
            details: '',
            status: 'Đã xác nhận',
          },
        ],
      },
    ],
    alerts: [
      {
        id: 'alert-buffer-1-old',
        title: 'Cảnh báo đệm cũ',
        timeAgo: 'Ngày 1',
        description: 'Cảnh báo lịch trình đã hết hiệu lực.',
        severity: 'warning',
        category: 'traffic',
      },
    ],
  };

  const alerts = detectScheduleAndWeatherAlerts(trip);
  assert.ok(alerts.some((alert) => alert.id === 'alert-overlap-1-act-earlier-act-later'));
  assert.equal(alerts.some((alert) => alert.id === 'alert-buffer-1-old'), false);
});

test('detectScheduleAndWeatherAlerts detects category and total budget overruns & near-limit warnings', async () => {
  const { computeBudgetMetrics, syncBudgetAlertsIntoTrip } = await import('../src/utils/budgetAlerts');
  const trip: TripData = {
    ...initialTripData,
    id: 'trip-budget-test',
    budgetTotal: 10_000_000,
    customCategoryAllocations: {
      transport: 3_000_000,
      hotel: 3_000_000,
      meal: 2_000_000,
      sightseeing: 1_000_000,
      contingency: 1_000_000,
    },
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
            id: 'act-meal-1',
            timeStart: '12:00',
            timeEnd: '13:00',
            title: 'Ăn trưa hải sản',
            location: 'Đà Nẵng',
            type: 'meal',
            details: '',
            status: 'Đã xác nhận',
            cost: 2_500_000, // Vượt hạn mức meal (2M) -> +500.000
          },
          {
            id: 'act-transport-1',
            timeStart: '08:00',
            timeEnd: '10:00',
            title: 'Thuê xe',
            location: 'Đà Nẵng',
            type: 'transport',
            details: '',
            status: 'Đã xác nhận',
            cost: 2_600_000, // 87% hạn mức transport (3M) -> Sắp chạm mức
          },
        ],
      },
    ],
    invoices: [
      {
        id: 'inv-hotel-1',
        title: 'Khách sạn 3 đêm',
        category: 'hotel',
        amount: 5_500_000, // Vượt hotel (3M) + đẩy tổng lên 10.6M > 10M
        date: '2026-10-12',
      },
    ],
    alerts: [],
  };

  const metrics = computeBudgetMetrics(trip);
  assert.equal(metrics.spentBudget, 10_600_000);
  assert.equal(metrics.isOverTotalBudget, true);
  assert.equal(metrics.overBudgetAmount, 600_000);
  assert.equal(metrics.rawPercentUsed, 106);

  const mealCat = metrics.categories.find((c) => c.id === 'meal');
  assert.equal(mealCat?.level, 'over');
  assert.equal(mealCat?.overAmount, 500_000);
  assert.equal(mealCat?.status, 'Vượt hạn mức');

  const transportCat = metrics.categories.find((c) => c.id === 'transport');
  assert.equal(transportCat?.level, 'near');
  assert.equal(transportCat?.status, 'Sắp chạm mức');

  const alerts = detectScheduleAndWeatherAlerts(trip);
  const totalOverAlert = alerts.find((a) => a.id === 'alert-budget-total-over-trip-budget-test');
  const mealOverAlert = alerts.find((a) => a.id === 'alert-budget-cat-over-trip-budget-test-meal');
  const transportNearAlert = alerts.find((a) => a.id === 'alert-budget-cat-near-trip-budget-test-transport');

  assert.ok(totalOverAlert, 'Should generate total budget overrun alert');
  assert.equal(totalOverAlert?.category, 'budget');
  assert.equal(totalOverAlert?.severity, 'error');
  assert.ok(mealOverAlert, 'Should generate meal category overrun alert');
  assert.ok(transportNearAlert, 'Should generate transport near-limit warning');
  assert.equal(transportNearAlert?.severity, 'warning');

  // Khi tăng tổng ngân sách lên đủ lớn, cảnh báo vượt tổng cũ phải tự động được dọn sạch
  const raisedBudgetTrip = { ...trip, budgetTotal: 20_000_000, alerts };
  const synced = syncBudgetAlertsIntoTrip(raisedBudgetTrip);
  assert.equal(
    synced.trip.alerts.some((a) => a.id === 'alert-budget-total-over-trip-budget-test'),
    false,
    'Resolved total budget overrun alert should be cleared automatically',
  );
});

test('sanitizeTripForGuest strips internal budget alerts while keeping weather and schedule alerts', async () => {
  const { sanitizeTripForGuest } = await import('../src/utils/tripJoinHelpers');
  const trip: TripData = {
    ...initialTripData,
    joinCode: 'ABC123',
    alerts: [
      {
        id: 'alert-budget-total-over-1',
        title: 'Vượt tổng ngân sách +500.000 ₫',
        timeAgo: '105%',
        description: 'Nội bộ',
        severity: 'error',
        category: 'budget',
      },
      {
        id: 'alert-weather-1',
        title: 'Dự báo mưa dông',
        timeAgo: 'Vừa cập nhật',
        description: 'Mang áo mưa',
        severity: 'warning',
        category: 'weather',
      },
    ],
  };

  const guestTrip = sanitizeTripForGuest(trip);
  assert.equal(guestTrip.alerts.length, 1);
  assert.equal(guestTrip.alerts[0].id, 'alert-weather-1');
});

