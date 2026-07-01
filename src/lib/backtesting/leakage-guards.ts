import { HistoricalCutoff } from './types';

export function assertNotFutureLeakage(
  sourceTimestamp: Date,
  eventStartTime: Date,
  label: string,
): void {
  if (Number.isNaN(sourceTimestamp.getTime())) {
    throw new Error(`Invalid source timestamp for ${label}: source is not a valid Date`);
  }
  if (Number.isNaN(eventStartTime.getTime())) {
    throw new Error(`Invalid event timestamp for ${label}: event is not a valid Date`);
  }
  if (sourceTimestamp >= eventStartTime) {
    throw new Error(
      `Temporal leakage detected for ${label}: sourceTimestamp=${sourceTimestamp.toISOString()} is at or after eventStartTime=${eventStartTime.toISOString()}`,
    );
  }
}

export function assertBeforeCutoff(timestamp: Date, cutoff: Date): void {
  if (timestamp >= cutoff) {
    throw new Error(
      `Timestamp ${timestamp.toISOString()} is not before cutoff ${cutoff.toISOString()}`,
    );
  }
}

export function assertAsOfDate(asOf: Date, cutoff: Date): void {
  assertBeforeCutoff(asOf, cutoff);
}

export function assertAvailableByCutoff(timestamp: Date, cutoff: Date): void {
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Invalid source timestamp: source is not a valid Date');
  }
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error('Invalid cutoff: cutoff is not a valid Date');
  }
  if (timestamp > cutoff) {
    throw new Error(
      `Timestamp ${timestamp.toISOString()} is after cutoff ${cutoff.toISOString()}`,
    );
  }
}

export function assertCompletedBeforeCutoff(timestamp: Date, cutoff: Date): void {
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Invalid event timestamp: event is not a valid Date');
  }
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error('Invalid cutoff: cutoff is not a valid Date');
  }
  if (timestamp >= cutoff) {
    throw new Error(
      `Event timestamp ${timestamp.toISOString()} is at or after cutoff ${cutoff.toISOString()}`,
    );
  }
}

export function assertHistoricalOnly(mode: string): void {
  if (mode !== 'fixture' && mode !== 'live') {
    throw new Error(`Unsupported historical mode: ${mode}`);
  }
}
