import test from 'node:test';
import assert from 'node:assert/strict';
import { lateFee, currentLateFee, suggestedLateFee, dueText, reputation } from '../lib/deals.ts';

const due = '2026-11-14T12:00:00Z';

test('no late fee on time or exactly at the deadline', () => {
  assert.equal(lateFee(due, '2026-11-14T11:00:00Z', 20), 0);
  assert.equal(lateFee(due, due, 20), 0);
});

test('part of a day rounds up, like the rental price does', () => {
  assert.equal(lateFee(due, '2026-11-14T12:01:00Z', 20), 20);
  assert.equal(lateFee(due, '2026-11-15T12:00:00Z', 20), 20);
  assert.equal(lateFee(due, '2026-11-15T12:00:01Z', 20), 40);
  assert.equal(lateFee(due, '2026-11-15T18:00:00Z', 20), 40);
  assert.equal(lateFee(due, '2026-11-17T12:00:00Z', 20), 60);
});

test('a missing deadline or a zero fee never charges', () => {
  assert.equal(lateFee(null, '2026-12-01T00:00:00Z', 20), 0);
  assert.equal(lateFee(due, '2026-12-01T00:00:00Z', 0), 0);
});

test('a returned rental shows the frozen fee, an open one keeps accruing', () => {
  const open = { status: 'agreed' as const, return_by: due, late_fee_per_day: 20, late_fee_final: null };
  assert.equal(currentLateFee(open, new Date('2026-11-16T13:00:00Z')), 60);
  const done = { ...open, status: 'completed' as const, late_fee_final: 40 };
  assert.equal(currentLateFee(done, new Date('2026-12-30T00:00:00Z')), 40);
  assert.equal(currentLateFee({ ...open, status: 'cancelled' }, new Date('2026-12-30T00:00:00Z')), 0);
});

test('suggested late fee is one day of the rate', () => {
  assert.equal(suggestedLateFee(150, 1), 150);
  assert.equal(suggestedLateFee(700, 7), 100);
  assert.equal(suggestedLateFee(3000, 30), 100);
});

test('due text reads naturally either side of the deadline', () => {
  assert.equal(dueText(due, new Date('2026-11-14T07:00:00Z')), 'due in 5h');
  assert.equal(dueText(due, new Date('2026-11-12T12:00:00Z')), 'due in 2 days');
  assert.equal(dueText(due, new Date('2026-11-14T15:00:00Z')), 'overdue by 3h');
  assert.equal(dueText(due, new Date('2026-11-15T13:00:00Z')), 'overdue by 1 day');
});

test('reputation: percent positive ignores neutrals, newcomers show no score', () => {
  assert.equal(reputation(null).text, 'No exchanges yet');
  assert.equal(reputation({ positive: 24, neutral: 2, negative: 1, completed: 27 }).text, '96% positive · 27 exchanges');
  assert.equal(reputation({ positive: 0, neutral: 1, negative: 0, completed: 1 }).text, '1 exchange');
  assert.equal(reputation({ positive: 1, neutral: 0, negative: 0, completed: 1 }).percent, 100);
});
