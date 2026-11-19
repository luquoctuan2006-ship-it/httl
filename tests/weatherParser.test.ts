import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTripData } from '../src/utils/trip/normalizeTripData';
import {
  buildTripWeatherFromOpenMeteo,
  getWeatherDescription,
  parseOpenMeteoPoint,
} from '../src/utils/route/weatherParser';

test('getWeatherDescription never hardcodes unrelated mountain passes for thunderstorm codes', () => {
  const desc = getWeatherDescription(95);
  assert.ok(!desc.includes('Hải Vân'), `Unexpected hardcoded pass name in: ${desc}`);
  assert.equal(desc, 'Dông sét / Mưa bão mạnh');
});

test('parseOpenMeteoPoint never invents 15% rain probability or hardcoded 15:00 - 17:00 window', () => {
  const noHourlyProb = parseOpenMeteoPoint({
    current: {
      temperature_2m: 29.6,
      weather_code: 0,
      relative_humidity_2m: 72,
      wind_speed_10m: 11.4,
      // precipitation_probability omitted
    },
  });
  assert.ok(noHourlyProb);
  assert.equal(noHourlyProb.temp, 30);
  assert.equal(noHourlyProb.rainProb, '');
  assert.equal(noHourlyProb.rainProbTime, '');

  const zeroProb = parseOpenMeteoPoint({
    current: {
      temperature_2m: 27,
      weather_code: 1,
      precipitation_probability: 0,
    },
    hourly: {
      time: ['2026-11-15T08:00', '2026-11-15T09:00'],
      precipitation_probability: [0, 0],
    },
  });
  assert.ok(zeroProb);
  assert.equal(zeroProb.rainProb, '0%');
  assert.equal(zeroProb.rainProbTime, '');
});

test('parseOpenMeteoPoint computes real peak rain probability and time window from hourly arrays', () => {
  const rainy = parseOpenMeteoPoint({
    current: {
      temperature_2m: 25.2,
      weather_code: 63,
      precipitation_probability: 40,
      relative_humidity_2m: 88,
      wind_speed_10m: 16,
    },
    hourly: {
      time: [
        '2026-11-15T12:00',
        '2026-11-15T13:00',
        '2026-11-15T14:00',
        '2026-11-15T15:00',
      ],
      precipitation_probability: [20, 75, 75, 30],
    },
  });

  assert.ok(rainy);
  assert.equal(rainy.temp, 25);
  assert.equal(rainy.rainProb, '75%');
  assert.equal(rainy.rainProbTime, '13:00 - 14:00');
});

test('buildTripWeatherFromOpenMeteo builds multi-stop forecasts and normalizeTripData preserves them', () => {
  const targets = [
    { stopId: 'wp-1', stopName: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
    { stopId: 'wp-2', stopName: 'Huế', lat: 16.4637, lng: 107.5909 },
  ];

  const payload = [
    {
      current: {
        temperature_2m: 31,
        weather_code: 1,
        relative_humidity_2m: 68,
        wind_speed_10m: 12,
        precipitation_probability: 10,
      },
      hourly: {
        time: ['2026-11-15T10:00'],
        precipitation_probability: [10],
      },
    },
    {
      current: {
        temperature_2m: 26,
        weather_code: 80,
        relative_humidity_2m: 85,
        wind_speed_10m: 19,
        precipitation_probability: 65,
      },
      hourly: {
        time: ['2026-11-15T16:00', '2026-11-15T17:00'],
        precipitation_probability: [65, 65],
      },
    },
  ];

  const weather = buildTripWeatherFromOpenMeteo(payload, targets, '10:30');
  assert.ok(weather);
  assert.equal(weather.temp, 31);
  assert.equal(weather.stopForecasts?.length, 2);
  assert.equal(weather.stopForecasts?.[1].stopName, 'Huế');
  assert.equal(weather.stopForecasts?.[1].rainProb, '65%');
  assert.equal(weather.stopForecasts?.[1].rainProbTime, '16:00 - 17:00');

  const normalized = normalizeTripData({
    id: 'trip-weather-test',
    weather,
  });
  assert.equal(normalized.weather.stopForecasts?.length, 2);
  assert.equal(normalized.weather.stopForecasts?.[1].stopId, 'wp-2');
});

test('selectEffectiveWeather ignores stale trip liveState and yields when external saved trip.weather changes', async () => {
  const { getWeatherSignature, selectEffectiveWeather } = await import(
    '../src/components/dashboard/live-route-map/weatherControlHelpers'
  );

  const tripAInitialWeather = {
    temp: 25,
    description: 'Nhiều mây',
    rainProb: '20%',
    rainProbTime: '',
  };
  const tripALiveWeather = {
    temp: 30,
    description: 'Ít mây, trời trong',
    rainProb: '10%',
    rainProbTime: '',
    isLive: true,
    lastFetched: '10:00',
  };
  const tripBWeather = {
    temp: 19,
    description: 'Có sương mù nhẹ',
    rainProb: '55%',
    rainProbTime: '14:00',
  };

  const baseTripAWeatherSig = getWeatherSignature(tripAInitialWeather);
  const liveStateForTripA = {
    tripId: 'trip-A',
    coordsSignature: 'wp-1@16.054,108.202',
    baseTripWeatherSig: baseTripAWeatherSig,
    weather: tripALiveWeather,
  };

  // Same trip & unchanged base saved weather -> shows live auto-fetched weather
  assert.deepEqual(
    selectEffectiveWeather('trip-A', 'wp-1@16.054,108.202', tripAInitialWeather, liveStateForTripA),
    tripALiveWeather,
  );

  // Switched rapidly to trip-B -> never leaks trip-A's live weather
  assert.deepEqual(
    selectEffectiveWeather('trip-B', 'wp-9@21.028,105.854', tripBWeather, liveStateForTripA),
    tripBWeather,
  );

  // Another collaborator / server scan saves newer weather on trip-A -> yields to saved weather
  const newerSavedOnTripA = {
    temp: 24,
    description: 'Mưa rào',
    rainProb: '80%',
    rainProbTime: '15:00',
    isLive: true,
    lastFetched: '10:05',
  };
  assert.deepEqual(
    selectEffectiveWeather('trip-A', 'wp-1@16.054,108.202', newerSavedOnTripA, liveStateForTripA),
    newerSavedOnTripA,
  );
});

