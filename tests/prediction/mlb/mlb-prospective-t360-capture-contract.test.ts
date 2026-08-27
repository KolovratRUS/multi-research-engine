import { describe, expect, it } from 'vitest';
import {
  computeScientificCutoffAt,
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

describe('mlb-prospective-t360-capture-contract', () => {
  describe('computeScientificCutoffAt', () => {
    it('computes exact scheduledStartAt - 360 minutes', () => {
      const result = computeScientificCutoffAt('2026-07-15T12:00:00Z');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-07-15T06:00:00.000Z');
      }
    });

    it('subtracts exactly 360 minutes across midnight', () => {
      const result = computeScientificCutoffAt('2026-07-16T01:30:00Z');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-07-15T19:30:00.000Z');
      }
    });

    it('subtracts exactly 360 minutes across month boundary', () => {
      const result = computeScientificCutoffAt('2026-08-01T02:00:00Z');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-07-31T20:00:00.000Z');
      }
    });

    it('subtracts exactly 360 minutes across year boundary', () => {
      const result = computeScientificCutoffAt('2027-01-01T03:00:00Z');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-12-31T21:00:00.000Z');
      }
    });

    it('accepts UTC offset timestamps', () => {
      const result = computeScientificCutoffAt('2026-07-15T12:00:00+05:00');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-07-15T01:00:00.000Z');
      }
    });

    it('rejects empty and whitespace-only strings', () => {
      expect(computeScientificCutoffAt('').ok).toBe(false);
      expect(computeScientificCutoffAt('  ').ok).toBe(false);
    });

    it('rejects invalid timestamp strings', () => {
      expect(computeScientificCutoffAt('not-a-timestamp').ok).toBe(false);
      expect(computeScientificCutoffAt('2026-07-15').ok).toBe(false);
      expect(computeScientificCutoffAt('2026-07-15T12:00:00').ok).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(computeScientificCutoffAt(null).ok).toBe(false);
      expect(computeScientificCutoffAt(123).ok).toBe(false);
    });

    it('returns deterministic ISO string', () => {
      const a = computeScientificCutoffAt('2026-07-15T12:00:00Z');
      const b = computeScientificCutoffAt('2026-07-15T12:00:00Z');
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.scientificCutoffAt).toBe(b.scientificCutoffAt);
        expect(a.scientificCutoffAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });

    it('does not accept caller override for minutes', () => {
      const result = computeScientificCutoffAt('2026-07-15T12:00:00Z');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scientificCutoffAt).toBe('2026-07-15T06:00:00.000Z');
      }
    });

    it('returns structured failure for invalid input', () => {
      const result = computeScientificCutoffAt('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.contractVersion).toBe(MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION);
        expect(result.compatibilityLayerId).toBe(MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1);
        expect(result.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
        expect(result.failureCode).toBe('INVALID_CAPTURE_REQUEST');
        expect(typeof result.message).toBe('string');
      }
    });
  });

  describe('exported constants', () => {
    it('binds to the committed protocol ID', () => {
      expect(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID).toBe('mlb-v1-candidate-003-prospective-holdout-v1');
    });

    it('exports the correct contract version', () => {
      expect(MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION).toBe('mlb-prospective-t360-capture-v1');
    });

    it('exports the compatibility layer identity', () => {
      expect(MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1).toBe('mlb-v1-candidate-003-t360-capture-compatibility-v1');
    });
  });
});
