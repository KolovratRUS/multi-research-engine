/* -------------------------------------------------------------------------- */
/*  Functional tests for the MLB Shadow Preparation Identity contract (P5F-C4)  */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';

import {
  MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
  MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER,
  validateMLBShadowPreparationIdentityRecord,
  canonicalSerializeMLBShadowPreparationIdentityRecord,
  parseMLBShadowPreparationIdentityRecord,
  type MLBShadowPreparationIdentityRecord,
} from '@/prediction/mlb/mlb-shadow-preparation-identity-contract';

/* -------------------------------------------------------------------------- */
/*  Valid-record helper                                                        */
/* -------------------------------------------------------------------------- */

function buildValidRecord(
  overrides: Record<string, unknown> = {},
): MLBShadowPreparationIdentityRecord {
  return {
    contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
    preparationRequestId: 'prep-001',
    gamePk: 714000,
    shadowRecordId: 'shadow-001',
    ...overrides,
  } as MLBShadowPreparationIdentityRecord;
}

/* -------------------------------------------------------------------------- */
describe('mlb-shadow-preparation-identity-contract', () => {
  /* 1. contract version constant */
  it('1. contract version is mlb-shadow-preparation-identity-v1', () => {
    expect(MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION).toBe(
      'mlb-shadow-preparation-identity-v1',
    );
  });

  /* 2. field order is exactly the four canonical fields */
  it('2. field order is exactly [contractVersion, preparationRequestId, gamePk, shadowRecordId]', () => {
    expect(MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER).toEqual([
      'contractVersion',
      'preparationRequestId',
      'gamePk',
      'shadowRecordId',
    ]);
    expect(MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER).toHaveLength(4);
    expect(Object.isFrozen(MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER)).toBe(true);
  });

  /* 3. valid record passes validation */
  it('3. valid record passes validation', () => {
    const record = buildValidRecord();
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(
        MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
      );
      expect(result.value.preparationRequestId).toBe('prep-001');
      expect(result.value.gamePk).toBe(714000);
      expect(result.value.shadowRecordId).toBe('shadow-001');
    }
  });

  /* 4. validated record is frozen */
  it('4. validated record is frozen', () => {
    const result = validateMLBShadowPreparationIdentityRecord(buildValidRecord());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  /* 5. null input returns NOT_OBJECT */
  it('5. null input returns NOT_OBJECT', () => {
    const result = validateMLBShadowPreparationIdentityRecord(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe('NOT_OBJECT');
    }
  });

  /* 6. array input returns NOT_OBJECT */
  it('6. array input returns NOT_OBJECT', () => {
    const result = validateMLBShadowPreparationIdentityRecord([1, 2, 3]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('NOT_OBJECT');
    }
  });

  /* 7. string input returns NOT_OBJECT */
  it('7. string input returns NOT_OBJECT', () => {
    const result = validateMLBShadowPreparationIdentityRecord('not-an-object');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('NOT_OBJECT');
    }
  });

  /* 8. object with class prototype returns NOT_OBJECT */
  it('8. object with class prototype returns NOT_OBJECT', () => {
    class Fake {}
    const result = validateMLBShadowPreparationIdentityRecord(new Fake());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('NOT_OBJECT');
    }
  });

  /* 9. record with null prototype is accepted */
  it('9. object with null prototype is accepted', () => {
    const record = Object.create(null);
    record['contractVersion'] = MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION;
    record['preparationRequestId'] = 'prep-001';
    record['gamePk'] = 714000;
    record['shadowRecordId'] = 'shadow-001';
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(true);
  });

  /* 10. excess field returns EXCESS_FIELD */
  it('10. excess field returns EXCESS_FIELD', () => {
    const record = buildValidRecord({ extraField: 'leaked' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'EXCESS_FIELD')).toBe(true);
    }
  });

  /* 11. missing required field returns MISSING_FIELD */
  it('11. missing required field returns MISSING_FIELD', () => {
    const { shadowRecordId, ...incomplete } = buildValidRecord();
    void shadowRecordId;
    const result = validateMLBShadowPreparationIdentityRecord(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'MISSING_FIELD')).toBe(true);
      expect(result.issues.some((i) => i.path === '$.shadowRecordId')).toBe(true);
    }
  });

  /* 12. accessor property returns ACCESSOR_PROPERTY */
  it('12. accessor property returns ACCESSOR_PROPERTY', () => {
    const obj: Record<string, unknown> = {
      contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
      preparationRequestId: 'prep-001',
      gamePk: 714000,
      shadowRecordId: 'shadow-001',
    };
    Object.defineProperty(obj, 'gamePk', {
      get() {
        return 714000;
      },
      enumerable: true,
      configurable: true,
    });
    const result = validateMLBShadowPreparationIdentityRecord(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
    }
  });

  /* 13. symbol-keyed property returns ACCESSOR_PROPERTY */
  it('13. symbol-keyed property returns ACCESSOR_PROPERTY', () => {
    const sym = Symbol('extra');
    const record: Record<PropertyKey, unknown> = {
      ...buildValidRecord(),
      [sym]: 'something',
    };
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
    }
  });

  /* 14. wrong contractVersion returns CONTRACT_VERSION_MISMATCH */
  it('14. wrong contractVersion returns CONTRACT_VERSION_MISMATCH', () => {
    const record = buildValidRecord({
      contractVersion: 'mlb-shadow-preparation-identity-v2',
    });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.code === 'CONTRACT_VERSION_MISMATCH'),
      ).toBe(true);
    }
  });

  /* 15. non-string contractVersion returns CONTRACT_VERSION_MISMATCH */
  it('15. non-string contractVersion returns CONTRACT_VERSION_MISMATCH', () => {
    const record = buildValidRecord({ contractVersion: 123 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.code === 'CONTRACT_VERSION_MISMATCH'),
      ).toBe(true);
    }
  });

  /* 16. empty preparationRequestId returns PREPARATION_REQUEST_ID_INVALID */
  it('16. empty preparationRequestId returns PREPARATION_REQUEST_ID_INVALID', () => {
    const record = buildValidRecord({ preparationRequestId: '' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.code === 'PREPARATION_REQUEST_ID_INVALID',
        ),
      ).toBe(true);
    }
  });

  /* 17. whitespace preparationRequestId returns PREPARATION_REQUEST_ID_INVALID */
  it('17. whitespace preparationRequestId returns PREPARATION_REQUEST_ID_INVALID', () => {
    const record = buildValidRecord({ preparationRequestId: '  space-padded  ' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.code === 'PREPARATION_REQUEST_ID_INVALID',
        ),
      ).toBe(true);
    }
  });

  /* 18. control-character preparationRequestId returns PREPARATION_REQUEST_ID_INVALID */
  it('18. control char preparationRequestId returns PREPARATION_REQUEST_ID_INVALID', () => {
    const record = buildValidRecord({ preparationRequestId: 'prep\x00evil' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.code === 'PREPARATION_REQUEST_ID_INVALID',
        ),
      ).toBe(true);
    }
  });

  /* 19. non-string preparationRequestId returns PREPARATION_REQUEST_ID_INVALID */
  it('19. non-string preparationRequestId returns PREPARATION_REQUEST_ID_INVALID', () => {
    const record = buildValidRecord({ preparationRequestId: 12345 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.code === 'PREPARATION_REQUEST_ID_INVALID',
        ),
      ).toBe(true);
    }
  });

  /* 20. gamePk = 0 returns GAME_PK_INVALID */
  it('20. gamePk zero returns GAME_PK_INVALID', () => {
    const record = buildValidRecord({ gamePk: 0 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'GAME_PK_INVALID')).toBe(true);
    }
  });

  /* 21. negative gamePk returns GAME_PK_INVALID */
  it('21. negative gamePk returns GAME_PK_INVALID', () => {
    const record = buildValidRecord({ gamePk: -1 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'GAME_PK_INVALID')).toBe(true);
    }
  });

  /* 22. non-integer gamePk returns GAME_PK_INVALID */
  it('22. non-integer gamePk returns GAME_PK_INVALID', () => {
    const record = buildValidRecord({ gamePk: 714000.5 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'GAME_PK_INVALID')).toBe(true);
    }
  });

  /* 23. string gamePk returns GAME_PK_INVALID */
  it('23. string gamePk returns GAME_PK_INVALID', () => {
    const record = buildValidRecord({ gamePk: '714000' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'GAME_PK_INVALID')).toBe(true);
    }
  });

  /* 24. Number.MAX_SAFE_INTEGER + 1 gamePk returns GAME_PK_INVALID */
  it('24. out-of-safe-integer range gamePk returns GAME_PK_INVALID', () => {
    const record = buildValidRecord({ gamePk: Number.MAX_SAFE_INTEGER + 2 });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'GAME_PK_INVALID')).toBe(true);
    }
  });

  /* 25. empty shadowRecordId returns SHADOW_RECORD_ID_INVALID */
  it('25. empty shadowRecordId returns SHADOW_RECORD_ID_INVALID', () => {
    const record = buildValidRecord({ shadowRecordId: '' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.code === 'SHADOW_RECORD_ID_INVALID'),
      ).toBe(true);
    }
  });

  /* 26. control-character shadowRecordId returns SHADOW_RECORD_ID_INVALID */
  it('26. control char shadowRecordId returns SHADOW_RECORD_ID_INVALID', () => {
    const record = buildValidRecord({ shadowRecordId: 'sr\x01bad' });
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.code === 'SHADOW_RECORD_ID_INVALID'),
      ).toBe(true);
    }
  });

  /* 27. canonical serialization produces compact JSON with exact key order */
  it('27. canonical serialization produces compact JSON with exact key order', () => {
    const record = buildValidRecord();
    const canonical =
      canonicalSerializeMLBShadowPreparationIdentityRecord(record);
    const expected = JSON.stringify({
      contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
      preparationRequestId: 'prep-001',
      gamePk: 714000,
      shadowRecordId: 'shadow-001',
    });
    expect(canonical).toBe(expected);
    // No whitespace
    expect(canonical).not.toMatch(/\s/);
    // No trailing newline
    expect(canonical.endsWith('\n')).toBe(false);
    // Keys in exact order
    expect(canonical.indexOf('"contractVersion"')).toBeLessThan(
      canonical.indexOf('"preparationRequestId"'),
    );
    expect(canonical.indexOf('"preparationRequestId"')).toBeLessThan(
      canonical.indexOf('"gamePk"'),
    );
    expect(canonical.indexOf('"gamePk"')).toBeLessThan(
      canonical.indexOf('"shadowRecordId"'),
    );
  });

  /* 28. canonical serialization is stable across calls */
  it('28. canonical serialization is stable across calls', () => {
    const record = buildValidRecord();
    const a = canonicalSerializeMLBShadowPreparationIdentityRecord(record);
    const b = canonicalSerializeMLBShadowPreparationIdentityRecord(record);
    expect(a).toBe(b);
  });

  /* 29. parse valid JSON string returns validated record */
  it('29. parse valid JSON string returns validated record', () => {
    const json = JSON.stringify({
      contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
      preparationRequestId: 'prep-001',
      gamePk: 714000,
      shadowRecordId: 'shadow-001',
    });
    const result = parseMLBShadowPreparationIdentityRecord(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.preparationRequestId).toBe('prep-001');
      expect(result.value.gamePk).toBe(714000);
      expect(result.value.shadowRecordId).toBe('shadow-001');
    }
  });

  /* 30. parse invalid JSON returns MALFORMED_JSON */
  it('30. parse invalid JSON returns MALFORMED_JSON', () => {
    const result = parseMLBShadowPreparationIdentityRecord('{not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MALFORMED_JSON');
    }
  });

  /* 31. parse malformed JSON (truncated) returns MALFORMED_JSON */
  it('31. parse truncated JSON returns MALFORMED_JSON', () => {
    const result = parseMLBShadowPreparationIdentityRecord('{"contractVersion":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MALFORMED_JSON');
    }
  });

  /* 32. parse valid JSON with wrong contractVersion returns CONTRACT_VERSION_MISMATCH */
  it('32. parse valid JSON with wrong contractVersion returns CONTRACT_VERSION_MISMATCH', () => {
    const json = JSON.stringify({
      contractVersion: 'wrong-version',
      preparationRequestId: 'prep-001',
      gamePk: 714000,
      shadowRecordId: 'shadow-001',
    });
    const result = parseMLBShadowPreparationIdentityRecord(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.code === 'CONTRACT_VERSION_MISMATCH',
        ),
      ).toBe(true);
    }
  });

  /* 33. parse empty string returns MALFORMED_JSON */
  it('33. parse empty string returns MALFORMED_JSON', () => {
    const result = parseMLBShadowPreparationIdentityRecord('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MALFORMED_JSON');
    }
  });

  /* 34. parse does not throw on deeply nested invalid input */
  it('34. parse does not throw on deeply nested invalid input', () => {
    expect(() =>
      parseMLBShadowPreparationIdentityRecord('{"a":'.repeat(1000) + '1}'),
    ).not.toThrow();
    const result = parseMLBShadowPreparationIdentityRecord(
      '{"a":'.repeat(1000) + '1}',
    );
    expect(result.ok).toBe(false);
  });

  /* 35. canonical serialization with field order in record does not change output */
  it('35. canonical serialization ignores input key order', () => {
    const record1: MLBShadowPreparationIdentityRecord = buildValidRecord();
    // Build an object with keys in reverse order but same values
    const reversed: Record<string, unknown> = {
      shadowRecordId: 'shadow-001',
      gamePk: 714000,
      preparationRequestId: 'prep-001',
      contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
    };
    const result = validateMLBShadowPreparationIdentityRecord(reversed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const canonical =
        canonicalSerializeMLBShadowPreparationIdentityRecord(result.value);
      const expected =
        canonicalSerializeMLBShadowPreparationIdentityRecord(record1);
      expect(canonical).toBe(expected);
    }
  });

  /* 36. issues array is frozen on validation failure */
  it('36. issues array is frozen on validation failure', () => {
    const result = validateMLBShadowPreparationIdentityRecord(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.isFrozen(result.issues)).toBe(true);
    }
  });

  /* 37. multiple validation issues are accumulated */
  it('37. multiple validation issues are accumulated', () => {
    const record = {
      contractVersion: 'wrong',
      gamePk: -1,
      preparationRequestId: '',
      shadowRecordId: '',
      extraField: true,
    };
    const result = validateMLBShadowPreparationIdentityRecord(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(1);
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain('CONTRACT_VERSION_MISMATCH');
      expect(codes).toContain('PREPARATION_REQUEST_ID_INVALID');
      expect(codes).toContain('GAME_PK_INVALID');
      expect(codes).toContain('SHADOW_RECORD_ID_INVALID');
      expect(codes).toContain('EXCESS_FIELD');
    }
  });
});
