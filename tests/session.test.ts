import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSessionPhase,
  minutesSinceMidnightEt,
  isInOpeningRange,
  isRthBar,
} from '../lib/session';

describe('session America/New_York', () => {
  it('classifies PRE/RTH/AH/CLOSED', () => {
    // 2026-10-23 is a Friday; use fixed offsets via Date with ET ISO
    assert.equal(getSessionPhase(new Date('2026-10-23T08:00:00-04:00')), 'PRE');
    assert.equal(getSessionPhase(new Date('2026-10-23T10:00:00-04:00')), 'RTH');
    assert.equal(getSessionPhase(new Date('2026-10-23T17:00:00-04:00')), 'AH');
    assert.equal(getSessionPhase(new Date('2026-10-23T22:00:00-04:00')), 'CLOSED');
  });

  it('opening range half-open [09:30, 09:35)', () => {
    assert.equal(isInOpeningRange('2026-10-23T09:30:00-04:00', 5), true);
    assert.equal(isInOpeningRange('2026-10-23T09:34:00-04:00', 5), true);
    assert.equal(isInOpeningRange('2026-10-23T09:35:00-04:00', 5), false);
    assert.equal(isInOpeningRange('2026-10-23T09:00:00-04:00', 5), false);
  });

  it('RTH bars only 09:30–16:00', () => {
    assert.equal(isRthBar('2026-10-23T09:30:00-04:00'), true);
    assert.equal(isRthBar('2026-10-23T09:00:00-04:00'), false);
    assert.equal(isRthBar('2026-10-23T16:00:00-04:00'), false);
  });

  it('minutesSinceMidnightEt is stable', () => {
    assert.equal(minutesSinceMidnightEt(new Date('2026-10-23T09:30:00-04:00')), 9 * 60 + 30);
  });
});
