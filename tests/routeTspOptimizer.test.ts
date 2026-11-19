import assert from 'node:assert/strict';
import test from 'node:test';
import {
  optimizeDayActivitiesByRoute,
  optimizeStopSequenceTSP,
  optimizeTripByRouteTSP,
} from '../src/utils/route/routeTspOptimizer';
import {
  autoArrangeDay,
  autoArrangeEntireTrip,
  detectDayScheduleConflicts,
} from '../src/utils/schedule/scheduleAutoArranger';
import { normalizeTripData } from '../src/utils/trip/normalizeTripData';
import type { Activity, DaySchedule, TripData } from '../src/types/travel';

test('optimizeStopSequenceTSP reorders zig-zag stops with Nearest Neighbor + 2-opt and reports km saved', () => {
  // Lộ trình bị đi vòng chéo: Đà Nẵng -> Hội An -> Ngũ Hành Sơn -> Bà Nà Hills
  // Đúng thứ tự tối ưu từ Đà Nẵng nên đi qua Ngũ Hành Sơn -> Hội An (hoặc đi Bà Nà trước) để giảm tổng km đáng kể
  const stops = [
    { id: 'dn', name: 'Trung tâm Đà Nẵng', lat: 16.0544, lng: 108.2022, locked: true },
    { id: 'ha', name: 'Phố cổ Hội An', lat: 15.8801, lng: 108.338 },
    { id: 'bn', name: 'Bà Nà Hills', lat: 15.9977, lng: 107.9964 },
    { id: 'nhs', name: 'Ngũ Hành Sơn', lat: 16.0025, lng: 108.2631 },
  ];

  const res = optimizeStopSequenceTSP(stops);
  assert.equal(res.changedOrder, true);
  assert.equal(res.orderedIds[0], 'dn'); // Giữ nguyên điểm xuất phát
  assert.ok(res.optimizedKm < res.originalKm);
  assert.ok(res.savedKm > 5);
  assert.ok(res.savedPercent > 5);
});

test('optimizeStopSequenceTSP respects leading completed/locked stops', () => {
  const stops = [
    { id: 's1', name: 'Điểm 1 (Đã qua)', lat: 16.0544, lng: 108.2022, locked: true },
    { id: 's2', name: 'Điểm 2 (Đang đi)', lat: 15.8801, lng: 108.338, locked: true },
    { id: 's3', name: 'Điểm 3 (Xa)', lat: 16.4637, lng: 107.5909 }, // Huế
    { id: 's4', name: 'Điểm 4 (Gần Hội An)', lat: 16.0025, lng: 108.2631 }, // Ngũ Hành Sơn
  ];

  const res = optimizeStopSequenceTSP(stops);
  assert.equal(res.orderedIds[0], 's1');
  assert.equal(res.orderedIds[1], 's2');
  // Từ Điểm 2 (Hội An), Điểm 4 (Ngũ Hành Sơn) gần hơn Huế (Điểm 3) rất nhiều
  assert.deepEqual(res.orderedIds, ['s1', 's2', 's4', 's3']);
  assert.ok(res.savedKm > 20);
});

test('optimizeDayActivitiesByRoute & autoArrangeDay reorder stops cleanly without time overlaps', () => {
  const activities: Activity[] = [
    {
      id: 'a1',
      timeStart: '08:00',
      timeEnd: '09:00',
      title: 'Khởi hành Đà Nẵng',
      location: 'Đà Nẵng',
      status: 'Đã xác nhận',
      type: 'transport',
      details: 'Tập trung đoàn',
      coordinates: { lat: 16.0544, lng: 108.2022 },
    },
    {
      id: 'a2',
      timeStart: '09:30',
      timeEnd: '11:30',
      title: 'Phố cổ Hội An',
      location: 'Hội An',
      status: 'Đã xác nhận',
      type: 'sightseeing',
      details: 'Đi xa trước',
      coordinates: { lat: 15.8801, lng: 108.338 },
    },
    {
      id: 'a3',
      timeStart: '12:00',
      timeEnd: '13:30',
      title: 'Bà Nà Hills',
      location: 'Bà Nà Hills',
      status: 'Đã xác nhận',
      type: 'sightseeing',
      details: 'Quay ngược lại phía tây',
      coordinates: { lat: 15.9977, lng: 107.9964 },
    },
    {
      id: 'a4',
      timeStart: '14:00',
      timeEnd: '15:30',
      title: 'Ngũ Hành Sơn',
      location: 'Ngũ Hành Sơn',
      status: 'Đã xác nhận',
      type: 'sightseeing',
      details: 'Lại quay xuống phía đông nam',
      coordinates: { lat: 16.0025, lng: 108.2631 },
    },
    {
      id: 'a5',
      timeStart: '16:00',
      timeEnd: '17:00',
      title: 'Họp tổng kết',
      location: 'Phòng họp tự do',
      status: 'Đã xác nhận',
      type: 'briefing',
      details: 'Hoạt động không gắn tọa độ',
    },
  ];

  const day: DaySchedule = {
    dayIndex: 1,
    dateLabel: 'T2 01',
    dayName: 'T2',
    dateNum: 1,
    fullDate: 'Ngày 1',
    activities,
    confirmedCount: 5,
    pendingCount: 0,
  };

  const arranged = autoArrangeDay(day, 20, { optimizeRouteOrder: true });
  assert.ok(arranged.routeOptimization);
  assert.equal(arranged.routeOptimization.changedOrder, true);
  assert.ok(arranged.routeOptimization.savedKm > 5);
  assert.equal(arranged.updatedDay.activities.length, 5);
  // Hoạt động không tọa độ vẫn được bảo toàn
  assert.ok(arranged.updatedDay.activities.some((a) => a.id === 'a5'));
  // Không có xung đột giờ nào sau khi tái sắp xếp
  assert.equal(detectDayScheduleConflicts(arranged.updatedDay.activities, 20).length, 0);

  const direct = optimizeDayActivitiesByRoute(day, { defaultBufferMinutes: 20 });
  assert.equal(direct.orderedStopNames[0], 'Đà Nẵng');
  assert.ok(direct.savedPercent > 5);
});

test('optimizeTripByRouteTSP & autoArrangeEntireTrip update waypoints and reduce trip totalKm', () => {
  const trip: TripData = {
    id: 'trip-tsp-1',
    code: 'TSP-01',
    title: 'Tour Đà Nẵng - Hội An',
    status: 'Chuẩn bị',
    dates: '01–02 THG 12, 2026',
    origin: 'ĐN',
    originFull: 'Đà Nẵng',
    destination: 'HA',
    destinationFull: 'Hội An',
    destinationsCount: 4,
    totalKm: 150,
    vehicle: 'Xe 16 chỗ',
    currentDay: 1,
    totalDays: 1,
    totalActivities: 4,
    confirmedActivities: 4,
    pendingActivities: 0,
    budgetTotal: 10000000,
    budgetUsed: 0,
    budgetRemaining: 10000000,
    budgetUsedPercent: 0,
    membersOnline: 1,
    membersTotal: 1,
    membersStatus: '1/1',
    weather: { temp: 28, description: 'Nắng', rainProb: '10%', rainProbTime: '12:00' },
    telematics: { from: 'Đà Nẵng', to: 'Hội An', vehicleType: 'Xe 16 chỗ', driver: 'Tài xế A', passengerCount: 1 },
    waypoints: [],
    alerts: [],
    aiSuggestions: [],
    aiSavingsEstimate: '0 ₫',
    aiConfidence: '',
    members: [],
    days: [
      {
        dayIndex: 1,
        dateLabel: 'T2 01',
        dayName: 'T2',
        dateNum: 1,
        fullDate: 'Ngày 1',
        confirmedCount: 4,
        pendingCount: 0,
        activities: [
          {
            id: 't1',
            timeStart: '08:00',
            timeEnd: '09:00',
            title: 'Đón khách Đà Nẵng',
            location: 'Đà Nẵng',
            status: 'Đã xác nhận',
            type: 'transport',
            details: '',
            coordinates: { lat: 16.0544, lng: 108.2022 },
          },
          {
            id: 't2',
            timeStart: '09:30',
            timeEnd: '11:00',
            title: 'Thăm Hội An',
            location: 'Hội An',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            details: '',
            coordinates: { lat: 15.8801, lng: 108.338 },
          },
          {
            id: 't3',
            timeStart: '11:30',
            timeEnd: '13:30',
            title: 'Thăm Bà Nà',
            location: 'Bà Nà Hills',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            details: '',
            coordinates: { lat: 15.9977, lng: 107.9964 },
          },
          {
            id: 't4',
            timeStart: '14:00',
            timeEnd: '15:30',
            title: 'Thăm Ngũ Hành Sơn',
            location: 'Ngũ Hành Sơn',
            status: 'Đã xác nhận',
            type: 'sightseeing',
            details: '',
            coordinates: { lat: 16.0025, lng: 108.2631 },
          },
        ],
      },
    ],
  };

  const directTrip = optimizeTripByRouteTSP(trip);
  assert.equal(directTrip.changedDaysCount, 1);
  assert.ok(directTrip.savedKm > 5);
  assert.ok(directTrip.updatedTrip.waypoints.length >= 3);
  assert.ok(directTrip.updatedTrip.totalKm < 150);

  const arrangedTrip = autoArrangeEntireTrip(trip, { optimizeRouteOrder: true });
  assert.ok(arrangedTrip.routeOptimization);
  assert.equal(arrangedTrip.routeOptimization.changedOrder, true);
  assert.ok(arrangedTrip.routeOptimization.savedKm > 5);
  assert.ok(arrangedTrip.totalAdjustmentsCount > 0);
});

test('optimizeDayActivitiesByRoute resolves time overlaps even when TSP order stays unchanged and preserves custom waypoints', () => {
  const day: DaySchedule = {
    dayIndex: 1,
    dateLabel: 'T2 01',
    dayName: 'T2',
    dateNum: 1,
    fullDate: 'Ngày 1',
    confirmedCount: 2,
    pendingCount: 0,
    activities: [
      {
        id: 'o1',
        timeStart: '08:00',
        timeEnd: '10:00',
        title: 'Điểm 1',
        location: 'Đà Nẵng',
        status: 'Đã xác nhận',
        type: 'sightseeing',
        details: '',
        coordinates: { lat: 16.0544, lng: 108.2022 },
      },
      {
        id: 'o2',
        timeStart: '09:30',
        timeEnd: '11:00',
        title: 'Điểm 2',
        location: 'Hội An',
        status: 'Đã xác nhận',
        type: 'sightseeing',
        details: '',
        coordinates: { lat: 15.8801, lng: 108.338 },
      },
    ],
  };

  const dayRes = optimizeDayActivitiesByRoute(day, { defaultBufferMinutes: 20 });
  assert.equal(dayRes.changedOrder, false);
  assert.equal(detectDayScheduleConflicts(dayRes.updatedDay.activities, 20).length, 0);

  const tripWithCustomWp: TripData = {
    ...autoArrangeEntireTrip({
      id: 'trip-custom-wp',
      code: 'CW-1',
      title: 'Test Custom WP',
      status: 'Chuẩn bị',
      dates: '01 THG 12, 2026',
      origin: 'ĐN',
      originFull: 'Đà Nẵng',
      destination: 'HA',
      destinationFull: 'Hội An',
      destinationsCount: 2,
      totalKm: 30,
      vehicle: 'Xe 16 chỗ',
      currentDay: 1,
      totalDays: 1,
      totalActivities: 2,
      confirmedActivities: 2,
      pendingActivities: 0,
      budgetTotal: 5000000,
      budgetUsed: 0,
      budgetRemaining: 5000000,
      budgetUsedPercent: 0,
      membersOnline: 0,
      membersTotal: 0,
      membersStatus: '0/0',
      weather: { temp: 28, description: 'Nắng', rainProb: '0%', rainProbTime: '12:00' },
      telematics: { from: 'Đà Nẵng', to: 'Hội An', vehicleType: 'Xe 16 chỗ', driver: 'A', passengerCount: 0 },
      waypoints: [
        {
          id: 'wp-custom-1',
          code: '09',
          name: 'Điểm Admin thêm riêng',
          status: 'pending',
          lat: 16.01,
          lng: 108.22,
          xPercent: 50,
          yPercent: 50,
          openHours: '08:00 - 17:00',
          ticketPrice: '50.000 ₫',
          isCustom: true,
        },
      ],
      alerts: [],
      aiSuggestions: [],
      aiSavingsEstimate: '0 ₫',
      aiConfidence: '',
      members: [],
      days: [day],
    }, { optimizeRouteOrder: true }).updatedTrip,
  };

  assert.ok(tripWithCustomWp.waypoints.some((w) => w.id === 'wp-custom-1' && w.isCustom));
  const renormalized = normalizeTripData(tripWithCustomWp);
  assert.ok(renormalized.waypoints.some((w) => w.id === 'wp-custom-1' && w.isCustom));
});

test('optimizeStopSequenceTSP keeps interleaved locked stops anchored and optimizes surrounding segments', () => {
  const stops = [
    { id: 's0', name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, locked: true },
    { id: 's1', name: 'Hội An', lat: 15.8801, lng: 108.338, locked: false },
    { id: 's2-locked', name: 'Điểm cố định giữa ngày', lat: 16.0025, lng: 108.2631, locked: true },
    { id: 's3', name: 'Huế', lat: 16.4637, lng: 107.5909, locked: false },
    { id: 's4', name: 'Bà Nà Hills', lat: 15.9977, lng: 107.9964, locked: false },
  ];

  const res = optimizeStopSequenceTSP(stops);
  assert.equal(res.orderedIds[0], 's0');
  assert.equal(res.orderedIds[2], 's2-locked');
  assert.deepEqual(res.orderedIds, ['s0', 's1', 's2-locked', 's4', 's3']);
});

