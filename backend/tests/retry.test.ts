import { describe, it, expect } from 'vitest';
import { computeRetryDelay } from '../src/services/jobService';

describe('Retry delay computation', () => {
  it('computes fixed delay', () => {
    expect(computeRetryDelay('FIXED', 1, 30, 30)).toBe(30);
    expect(computeRetryDelay('FIXED', 3, 30, 30)).toBe(30);
  });

  it('computes linear backoff', () => {
    expect(computeRetryDelay('LINEAR', 1, 10, 100)).toBe(10);
    expect(computeRetryDelay('LINEAR', 3, 10, 100)).toBe(30);
  });

  it('computes exponential backoff', () => {
    expect(computeRetryDelay('EXPONENTIAL', 1, 5, 3600)).toBe(5);
    expect(computeRetryDelay('EXPONENTIAL', 2, 5, 3600)).toBe(10);
    expect(computeRetryDelay('EXPONENTIAL', 3, 5, 3600)).toBe(20);
  });

  it('caps delay at maxDelaySeconds', () => {
    expect(computeRetryDelay('EXPONENTIAL', 10, 5, 60)).toBe(60);
    expect(computeRetryDelay('LINEAR', 100, 10, 50)).toBe(50);
  });
});
