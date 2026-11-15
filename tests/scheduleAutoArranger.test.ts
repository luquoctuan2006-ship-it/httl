/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDayScheduleConflicts,
  autoArrangeDayActivities,
  autoArrangeEntireTrip,
} from '../src/utils/scheduleAutoArranger';
import { Activity, TripData } from '../src/types/travel';

describe('scheduleAutoArranger - Lập lịch tự động & Tối ưu thời gian', () => {
  it('phát hiện chính xác xung đột chồng chéo thời gian giữa hai hoạt động', () => {
    const activities: Activity[] = [
      {
        id: 'act-1',
        timeStart: '08:30',
        timeEnd: '10:30',
        title: 'Tham quan Ngũ Hành Sơn',
        location: 'Ngũ Hành Sơn',
        status: 'Đã xác nhận',
        type: 'sightseeing',
        details: 'Khám phá động Huyền Không',
      },
      {
        id: 'act-2',
        timeStart: '10:00', // Trùng lấn 30 phút với act-1
        timeEnd: '12:00',
        title: 'Bảo tàng Điêu khắc Chăm',
        location: 'Hải Châu, Đà Nẵng',
        status: 'Đã xác nhận',
        type: 'sightseeing',
        details: 'Chiêm ngưỡng bảo vật quốc gia',
      },
    ];

    const conflicts = detectDayScheduleConflicts(activities);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].type, 'overlap');
    assert.ok(conflicts[0].message.includes('Chồng chéo thời gian'));
  });

  it('tự động sắp xếp lại giờ liền mạch, loại bỏ chồng chéo và chèn đệm di chuyển', () => {
    const activities: Activity[] = [
      {
        id: 'act-1',
        timeStart: '08:30',
        timeEnd: '10:30',
        title: 'Tham quan Ngũ Hành Sơn',
        location: 'Ngũ Hành Sơn',
        status: 'Đã xác nhận',
        type: 'sightseeing',
        details: 'Khám phá động Huyền Không',
      },
      {
        id: 'act-2',
        timeStart: '10:00', // Trùng lấn
        timeEnd: '11:30',
        title: 'Ăn trưa đặc sản Mì Quảng',
        location: 'Hải Châu, Đà Nẵng',
        status: 'Đã xác nhận',
        type: 'meal',
        details: 'Ăn trưa',
      },
    ];

    const result = autoArrangeDayActivities(activities, { defaultBufferMinutes: 20 });
    assert.equal(result.reorderedActivities.length, 2);

    // Act 1 giữ nguyên 08:30 - 10:30
    assert.equal(result.reorderedActivities[0].timeStart, '08:30');
    assert.equal(result.reorderedActivities[0].timeEnd, '10:30');

    // Act 2 phải được dời sau 10:30 + 20 phút di chuyển = 10:50 hoặc trưa (11:30)
    const act2StartMins =
      parseInt(result.reorderedActivities[1].timeStart.split(':')[0], 10) * 60 +
      parseInt(result.reorderedActivities[1].timeStart.split(':')[1], 10);
    assert.ok(act2StartMins >= 10 * 60 + 50);

    // Không còn xung đột chồng chéo sau khi tự động sắp xếp
    const conflictsAfter = detectDayScheduleConflicts(result.reorderedActivities, 20);
    assert.equal(conflictsAfter.length, 0);
  });

  it('xử lý hoạt động có giờ kết thúc sớm hơn giờ bắt đầu (lỗi nhập liệu)', () => {
    const activities: Activity[] = [
      {
        id: 'act-bad',
        timeStart: '14:00',
        timeEnd: '13:00', // Lỗi
        title: 'Check-in khách sạn',
        location: 'Khách sạn Mỹ Khê',
        status: 'Đã xác nhận',
        type: 'hotel',
        details: 'Nhận phòng',
      },
    ];

    const conflicts = detectDayScheduleConflicts(activities);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].type, 'inverted');

    const result = autoArrangeDayActivities(activities);
    assert.equal(result.adjustments.length, 1);
    // Giờ kết thúc mới phải lớn hơn giờ bắt đầu
    const [startH, startM] = result.reorderedActivities[0].timeStart.split(':').map(Number);
    const [endH, endM] = result.reorderedActivities[0].timeEnd.split(':').map(Number);
    assert.ok(endH * 60 + endM > startH * 60 + startM);
  });

  it('autoArrangeDay và autoArrangeEntireTrip cập nhật mượt mà dữ liệu chuyến đi', () => {
    const mockTrip: TripData = {
      id: 'trip-test',
      code: 'TEST-01',
      title: 'Tour thử nghiệm',
      status: 'Đang vận hành',
      dates: '01–03 THG 11, 2026',
      origin: 'ĐN',
      originFull: 'Đà Nẵng',
      destination: 'HUE',
      destinationFull: 'Huế',
      destinationsCount: 2,
      totalKm: 100,
      vehicle: 'Xe 16 chỗ',
      currentDay: 1,
      totalDays: 1,
      totalActivities: 2,
      confirmedActivities: 2,
      pendingActivities: 0,
      budgetTotal: 10000000,
      budgetUsed: 2000000,
      budgetRemaining: 8000000,
      budgetUsedPercent: 20,
      membersOnline: 2,
      membersTotal: 2,
      membersStatus: '2/2 đã điểm danh',
      weather: { temp: 28, description: 'Nắng', rainProb: '10%', rainProbTime: '12:00' },
      telematics: { from: 'ĐN', to: 'HUE', vehicleType: 'Xe 16 chỗ', driver: 'Tài xế A', passengerCount: 2 },
      waypoints: [],
      alerts: [],
      aiSuggestions: [],
      aiSavingsEstimate: '0đ',
      aiConfidence: '95%',
      members: [],
      days: [
        {
          dayIndex: 1,
          dateLabel: 'T2 01',
          dayName: 'T2',
          dateNum: 1,
          fullDate: 'Thứ Hai, 01 tháng 11',
          confirmedCount: 2,
          pendingCount: 0,
          activities: [
            {
              id: 'a1',
              timeStart: '08:00',
              timeEnd: '10:00',
              title: 'Điểm 1',
              location: 'Vị trí A',
              status: 'Đã xác nhận',
              type: 'sightseeing',
              details: '',
            },
            {
              id: 'a2',
              timeStart: '09:30', // Trùng
              timeEnd: '11:00',
              title: 'Điểm 2',
              location: 'Vị trí B',
              status: 'Đã xác nhận',
              type: 'sightseeing',
              details: '',
            },
          ],
        },
      ],
    };

    const res = autoArrangeEntireTrip(mockTrip);
    assert.ok(res.totalAdjustmentsCount >= 1);
    assert.equal(res.updatedTrip.days[0].activities.length, 2);
    // Hai hoạt động không còn trùng nhau
    const a1End = res.updatedTrip.days[0].activities[0].timeEnd;
    const a2Start = res.updatedTrip.days[0].activities[1].timeStart;
    assert.ok(a2Start >= a1End);
  });
});
