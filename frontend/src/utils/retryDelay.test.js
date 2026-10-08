import { describe, expect, it } from 'vitest';
import { retryDelay } from './retryDelay';

describe('retryDelay', () => {
  it('uses exponential delays and caps long retry waits', () => {
    expect([1, 2, 3, 4, 8].map(attempt => retryDelay(attempt)))
      .toEqual([1000, 2000, 4000, 8000, 30000]);
  });

  it('rejects invalid retry attempts', () => {
    expect(() => retryDelay(0)).toThrow(RangeError);
    expect(() => retryDelay(1.5)).toThrow(RangeError);
  });
});
