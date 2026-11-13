import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalQuote, overlaps } from '../lib/rental.ts';

test('a three-day rental keeps fee and deposit apart', () => {
  assert.deepEqual(rentalQuote(200, 'day', '2026-10-21', '2026-10-24', 500), {
    days: 3,
    units: 3,
    fee: 600,
    deposit: 500,
    total: 1100,
  });
});

test('partial periods round up; a month is 30 days and a semester 120', () => {
  assert.equal(rentalQuote(100, 'week', '2026-10-21', '2026-10-29').units, 2);
  assert.equal(rentalQuote(100, 'month', '2026-10-01', '2026-10-31').units, 1);
  assert.equal(rentalQuote(100, 'semester', '2026-10-01', '2027-01-30').units, 2);
});

test('rejects missing, reversed, zero-length and invalid terms', () => {
  const bad: [number, any, string, string][] = [
    [1, 'day', '', ''],
    [1, 'day', '2026-10-24', '2026-10-21'],
    [1, 'day', '2026-10-21', '2026-10-21'],
    [0, 'day', '2026-10-21', '2026-10-22'],
    [10, 'year', '2026-10-21', '2026-10-22'],
  ];
  for (const args of bad) assert.throws(() => rentalQuote(...args));
});

test('overlap catches nested bookings and allows a same-day handover', () => {
  assert.ok(overlaps('2026-10-21', '2026-10-25', '2026-10-22', '2026-10-23'));
  assert.ok(overlaps('2026-10-22', '2026-10-23', '2026-10-21', '2026-10-25'));
  assert.equal(overlaps('2026-10-21', '2026-10-25', '2026-10-25', '2026-10-27'), false);
});
