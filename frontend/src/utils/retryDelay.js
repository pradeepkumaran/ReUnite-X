export function retryDelay(attempt, baseMs = 1000, maxMs = 30000) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError('Retry attempt must be a positive integer.');
  }
  return Math.min(baseMs * (2 ** (attempt - 1)), maxMs);
}
