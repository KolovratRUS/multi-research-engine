import { TextEncoder } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
  buildMLBInnerDevelopmentTrainArtifact,
  computeMLBInnerDevelopmentTrainArtifactSHA256,
  hashMLBInnerDevelopmentTrainArtifact,
  serializeMLBInnerDevelopmentTrainArtifact,
  validateMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
  type MLBOuterTrainRow,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  type MLBInnerDevelopmentTrainArtifactProviderIssue,
  type MLBInnerDevelopmentTrainArtifactProviderResult,
  type MLBInnerDevelopmentTrainArtifactReader,
  type MLBInnerDevelopmentTrainArtifactSourceConfig,
  loadMLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-provider';

interface ReaderCallRecorder {
  calls: { sourcePath: string }[];
}

function createReader(
  bytes: Uint8Array,
  throwSync?: Error,
  rejectValue?: unknown,
): [MLBInnerDevelopmentTrainArtifactReader, ReaderCallRecorder] {
  const recorder: ReaderCallRecorder = { calls: [] };

  const reader: MLBInnerDevelopmentTrainArtifactReader = async (sourcePath) => {
    recorder.calls.push({ sourcePath });

    if (throwSync) {
      throw throwSync;
    }
    if (rejectValue instanceof Error) {
      throw rejectValue;
    }
    if (typeof rejectValue === 'string') {
      throw new Error(rejectValue);
    }
    if (typeof rejectValue === 'object' && rejectValue !== null) {
      throw new Error('rejected');
    }

    return bytes;
  };

  return [reader, recorder];
}

function buildSyntheticArtifact(): MLBInnerDevelopmentTrainArtifact {
  const rows = buildSyntheticTrainRows(301);
  const rowCollection = {
    contractVersion: MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0' as const,
    matrixId: 'mlb-training-matrix-v1',
    manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    datasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360',
    rowCount: 301,
    homeWinCount: 150,
    awayWinCount: 151,
    rows,
  };

  return buildMLBInnerDevelopmentTrainArtifact(rowCollection);
}

function buildSyntheticTrainRows(count: number): MLBOuterTrainRow[] {
  const rows: MLBOuterTrainRow[] = [];
  let exampleCounter = 1;

  for (let day = 1; day <= 23; day++) {
    const officialDate = `2026-04-${String(day).padStart(2, '0')}`;
    for (let game = 1; game <= 14; game++) {
      if (rows.length >= count) break;
      const gameId = `synth-${officialDate}-${String(game).padStart(3, '0')}`;
      const snapshotId = `snap-${officialDate}-${String(game).padStart(3, '0')}`;
      const exampleId = `example-${String(exampleCounter).padStart(3, '0')}`;
      exampleCounter += 1;

      const values = Array.from({ length: 5 }, (_, idx) => ({
        featureId: `feat-${idx + 1}`,
        value: idx % 2 === 0 ? 1 : 0,
        wasMissing: false,
      }));

      rows.push({
        exampleId,
        split: 'TRAIN',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
          snapshotId,
          gameId,
          officialDate,
          dataCutoffAt: '2026-04-23T23:59:59.999Z',
          values,
        },
        targetValue: game % 2 === 0 ? 1 : 0,
      });
    }
  }

  return rows;
}

function canonicalBytesForArtifact(
  artifact: MLBInnerDevelopmentTrainArtifact,
): Uint8Array {
  const text = serializeMLBInnerDevelopmentTrainArtifact(artifact);
  return new TextEncoder().encode(text);
}

function failureCode(
  result: MLBInnerDevelopmentTrainArtifactProviderResult,
): string | undefined {
  return result.ok ? undefined : result.issues[0]?.code;
}

describe('mlb-inner-development-train-artifact-provider', () => {
  // Source configuration
  it('1: canonical source config accepted', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/synthetic/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
  });

  it('2: empty sourcePath rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '', expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('3: non-string sourcePath rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: 123 as unknown as string, expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('4: string-like sourcePath object rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const stringLike = Object.create(String.prototype);
    (stringLike as unknown as Record<string, unknown>).valueOf = () => 'synthetic';
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: stringLike as unknown as string, expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('5: malformed expected SHA rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: 'not-a-real-sha' },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('6: uppercase SHA rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: 'A'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('7: whitespace-padded SHA rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: `${'a'.repeat(64)} ` },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('8: string-like SHA object rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const stringLike = Object.create(String.prototype);
    (stringLike as unknown as Record<string, unknown>).valueOf = () => 'a'.repeat(64);
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: stringLike as unknown as string },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  // Config hardening
  it('9: null config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(null as unknown as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('10: undefined config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(undefined as unknown as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('11: array config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact([] as unknown as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('12: primitive string config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact('/any/path.json' as unknown as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('13: number config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact(42 as unknown as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('14: custom-prototype config rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const customPrototype = { sourcePath: '/any/path.json', expectedArtifactSha256: 'a'.repeat(64) };
    const config = Object.create(customPrototype);
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('15: inherited sourcePath only rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const parent = { sourcePath: '/any/path.json' };
    const config = Object.create(parent);
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('16: inherited expectedArtifactSha256 only rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const parent = { expectedArtifactSha256: 'a'.repeat(64) };
    const config = Object.create(parent);
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('17: sourcePath getter not invoked', async () => {
    let getterCalled = false;
    const [reader] = createReader(new Uint8Array());
    const config = {
      get sourcePath() {
        getterCalled = true;
        return '/any/path.json';
      },
      expectedArtifactSha256: 'a'.repeat(64),
    };
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
    expect(getterCalled).toBe(false);
  });

  it('18: expectedArtifactSha256 getter not invoked', async () => {
    let getterCalled = false;
    const [reader] = createReader(new Uint8Array());
    const config = {
      sourcePath: '/any/path.json',
      get expectedArtifactSha256() {
        getterCalled = true;
        return 'a'.repeat(64);
      },
    };
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
    expect(getterCalled).toBe(false);
  });

  it('19: missing sourcePath rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact({ expectedArtifactSha256: 'a'.repeat(64) } as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('20: missing expectedArtifactSha256 rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact({ sourcePath: '/any/path.json' } as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('21: unknown field rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const result = await loadMLBInnerDevelopmentTrainArtifact({
      sourcePath: '/any/path.json',
      expectedArtifactSha256: 'a'.repeat(64),
      unknownField: 'rejected',
    } as object, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('22: unknown undefined field rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const config = {
      sourcePath: '/synthetic/train.json',
      expectedArtifactSha256: 'a'.repeat(64),
      unknownField: undefined,
    };
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('23: symbol key rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const symbol = Symbol('unexpected');
    const config = {
      sourcePath: '/synthetic/train.json',
      expectedArtifactSha256: 'a'.repeat(64),
      [symbol]: 'unexpected',
    };
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('24: non-enumerable unknown field rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const config = {
      sourcePath: '/synthetic/train.json',
      expectedArtifactSha256: 'a'.repeat(64),
    };
    Object.defineProperty(config, 'hiddenUnexpected', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 'unexpected',
    });
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('25: unknown accessor field rejected without invocation', async () => {
    const [reader] = createReader(new Uint8Array());
    let getterCalls = 0;
    const config = {
      sourcePath: '/synthetic/train.json',
      expectedArtifactSha256: 'a'.repeat(64),
    };
    Object.defineProperty(config, 'unexpectedGetter', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'unexpected';
      },
    });
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
    expect(getterCalls).toBe(0);
  });

  it('26: null-prototype canonical config accepted', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const config = Object.create(null);
    (config as Record<string, unknown>).sourcePath = '/synthetic/train.json';
    (config as Record<string, unknown>).expectedArtifactSha256 = expectedSha256;

    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(true);
  });

  it('27: throwing getPrototypeOf proxy rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const config = new Proxy({}, {
      getPrototypeOf() {
        throw new Error('synthetic getPrototypeOf trap');
      },
    });
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('28: throwing ownKeys proxy rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const config = new Proxy({}, {
      ownKeys() {
        throw new Error('synthetic ownKeys trap');
      },
    });
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  it('29: throwing getOwnPropertyDescriptor proxy rejected', async () => {
    const [reader] = createReader(new Uint8Array());
    const config = new Proxy({}, {
      ownKeys() {
        return ['sourcePath', 'expectedArtifactSha256'];
      },
      getOwnPropertyDescriptor() {
        throw new Error('synthetic getOwnPropertyDescriptor trap');
      },
    });
    const result = await loadMLBInnerDevelopmentTrainArtifact(config, reader);
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVALID_SOURCE_CONFIGURATION');
  });

  // Reader
  it('9: reader called with exact sourcePath', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader, recorder] = createReader(bytes);

    await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/exact/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]?.sourcePath).toBe('/exact/path.json');
  });

  it('10: reader called exactly once', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader, recorder] = createReader(bytes);

    await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(recorder.calls).toHaveLength(1);
  });

  it('11: synchronous throw -> LOAD_FAILED', async () => {
    const [reader] = createReader(new Uint8Array(), new Error('fs error'));
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_LOAD_FAILED');
  });

  it('12: rejected Promise -> LOAD_FAILED', async () => {
    const [reader] = createReader(new Uint8Array(), new Error('rejected'));
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_LOAD_FAILED');
  });

  it('13: non-byte reader result fails closed', async () => {
    const reader: MLBInnerDevelopmentTrainArtifactReader = async () => {
      return 'not-bytes' as unknown as Uint8Array;
    };
    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: 'a'.repeat(64) },
      reader,
    );
    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('INVARIANT_VIOLATION');
  });

  // Hash
  it('14: canonical exact bytes + matching SHA pass hash stage', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedSha256).toBe(expectedSha256);
    }
  });

  it('15: changed byte -> HASH_MISMATCH', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const mutated = new Uint8Array(bytes);
    mutated[0] ^= 0xff;
    const [reader] = createReader(mutated);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
  });

  it('16: changed trailing newline -> HASH_MISMATCH', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const altered = new Uint8Array([...bytes]);
    altered[altered.length - 1] = 0x00;
    const [reader] = createReader(altered);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
  });

  it('17: CRLF variant -> HASH_MISMATCH', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const crlf = new Uint8Array(bytes.length + 1);
    let offset = 0;
    for (let index = 0; index < bytes.length; index += 1) {
      if (bytes[index] === 0x0a && index > 0 && bytes[index - 1] !== 0x0d) {
        crlf[offset] = 0x0d;
        offset += 1;
      }
      crlf[offset] = bytes[index];
      offset += 1;
    }
    const [reader] = createReader(crlf.slice(0, offset));

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
  });

  it('18: hash mismatch stops before parse/validation success', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const badSha256 = 'a'.repeat(64);
    const [reader, recorder] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: badSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
    expect(recorder.calls).toHaveLength(1);
  });

  it('19: correct-looking filename cannot bypass hash mismatch', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const actualSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      {
        sourcePath: `/any/${actualSha256}.json`,
        expectedArtifactSha256: 'a'.repeat(64),
      },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
  });

  // UTF-8
  it('20: malformed UTF-8 rejected', async () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_UTF8_DECODE_FAILED');
  });

  // JSON
  it('22: valid canonical JSON parses', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
  });

  it('23: malformed JSON -> JSON_PARSE_FAILED', async () => {
    const malformed = new TextEncoder().encode('{"artifactContractVersion":');
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(malformed);
    const [reader] = createReader(malformed);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_JSON_PARSE_FAILED');
  });

  it('24: valid JSON primitive -> CONTRACT_INVALID', async () => {
    const primitive = new TextEncoder().encode('"not-an-artifact"');
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(primitive);
    const [reader] = createReader(primitive);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('25: valid JSON array -> CONTRACT_INVALID', async () => {
    const array = new TextEncoder().encode('[1, 2, 3]');
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(array);
    const [reader] = createReader(array);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  // Artifact validation failures
  it('26: wrong artifact contract version -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, artifactContractVersion: 'wrong-version' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('27: wrong artifact ID -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, artifactId: 'wrong-id' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('28: wrong dataset ID -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, sourceDatasetId: 'wrong-dataset' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('29: wrong manifest ID -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, featureManifestId: 'wrong-manifest' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('30: wrong feature policy -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, featurePolicyId: 'wrong-policy' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('31: wrong preprocessing policy -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, preprocessingPolicyId: 'wrong-preprocessing' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('32: wrong split -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, split: 'VALIDATION' } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('33: row count mismatch -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, rowCount: 123 } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('34: VALIDATION row -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = {
      ...artifact,
      rowCollection: {
        ...artifact.rowCollection,
        rows: artifact.rowCollection.rows.map((row, idx) =>
          idx === 0 ? { ...row, split: 'VALIDATION', exampleId: 'val-row' } : row,
        ),
      },
    } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('35: TEST row -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = {
      ...artifact,
      rowCollection: {
        ...artifact.rowCollection,
        rows: artifact.rowCollection.rows.map((row, idx) =>
          idx === 0 ? { ...row, split: 'TEST', exampleId: 'test-row' } : row,
        ),
      },
    } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('36: out-of-window row -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = {
      ...artifact,
      rowCollection: {
        ...artifact.rowCollection,
        rows: artifact.rowCollection.rows.map((row, idx) =>
          idx === 0 ? { ...row, vector: { ...row.vector, officialDate: '2026-05-01' } } : row,
        ),
      },
    } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  it('37: unknown artifactSha256 payload field -> CONTRACT_INVALID', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = { ...artifact, artifactSha256: 'a'.repeat(64) } as unknown as Record<string, unknown>;
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_CONTRACT_INVALID');
  });

  // Canonical bytes
  it('38: canonical bytes accepted', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
  });

  it('39: semantically equivalent one-line JSON rejected NON_CANONICAL_BYTES', async () => {
    const artifact = buildSyntheticArtifact();
    const compactText = JSON.stringify(artifact) + '\n';
    const compactBytes = new TextEncoder().encode(compactText);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(compactBytes);
    const [reader] = createReader(compactBytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('40: different indentation rejected', async () => {
    const artifact = buildSyntheticArtifact();
    const text = JSON.stringify(artifact, null, 4) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('41: reordered top-level keys rejected', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = {
      rowCollection: artifact.rowCollection,
      artifactId: artifact.artifactId,
      artifactContractVersion: artifact.artifactContractVersion,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
    };
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('42: reordered nested keys rejected', async () => {
    const artifact = buildSyntheticArtifact();
    const raw = {
      ...artifact,
      rowCollection: {
        ...artifact.rowCollection,
        rows: artifact.rowCollection.rows.map((row) => ({
          targetValue: row.targetValue,
          split: row.split,
          exampleId: row.exampleId,
          vector: {
            ...row.vector,
            values: row.vector.values.map((value) => ({
              wasMissing: value.wasMissing,
              featureId: value.featureId,
              value: value.value,
            })),
          },
        })),
      },
    };
    const text = JSON.stringify(raw, null, 2) + '\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('43: missing final newline rejected', async () => {
    const artifact = buildSyntheticArtifact();
    const text = JSON.stringify(artifact, null, 2);
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('44: extra trailing newline rejected', async () => {
    const artifact = buildSyntheticArtifact();
    const text = JSON.stringify(artifact, null, 2) + '\n\n';
    const bytes = new TextEncoder().encode(text);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('45: duplicate-key JSON document rejected by canonical bytes', async () => {
    const artifact = buildSyntheticArtifact();
    const canonicalText = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const duplicateKeyText = canonicalText.replace(
      /("artifactContractVersion": "[^"]*",)/,
      '$1\n  "artifactContractVersion": "mlb-inner-development-train-artifact-v1",',
    );
    const bytes = new TextEncoder().encode(duplicateKeyText);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_NON_CANONICAL_BYTES');
  });

  it('46: canonical reserialization equals exact loaded bytes on success', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(serializeMLBInnerDevelopmentTrainArtifact(result.artifact)).toBe(
        new TextDecoder().decode(bytes),
      );
    }
  });

  // Path non-identity
  it('47: path A + canonical bytes succeeds', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/path/a.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
  });

  it('48: path B + same canonical bytes succeeds', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/completely/different/path/b.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
  });

  it('49: resulting artifact/hash identical', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [readerA] = createReader(bytes);
    const [readerB] = createReader(bytes);

    const resultA = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/path/a.json', expectedArtifactSha256: expectedSha256 },
      readerA,
    );
    const resultB = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/path/b.json', expectedArtifactSha256: expectedSha256 },
      readerB,
    );

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(hashMLBInnerDevelopmentTrainArtifact(resultA.artifact)).toBe(
        hashMLBInnerDevelopmentTrainArtifact(resultB.artifact),
      );
      expect(resultA.artifact.artifactId).toBe(resultB.artifact.artifactId);
      expect(resultA.verifiedSha256).toBe(resultB.verifiedSha256);
    }
  });

  it('50: sourcePath absent from returned artifact', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.prototype.hasOwnProperty.call(result.artifact, 'sourcePath')).toBe(false);
    }
  });

  it('51: sourcePath does not alter expected/raw hash', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [readerA] = createReader(bytes);
    const [readerB] = createReader(bytes);

    const resultA = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/path/a.json', expectedArtifactSha256: expectedSha256 },
      readerA,
    );
    const resultB = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/path/b.json', expectedArtifactSha256: expectedSha256 },
      readerB,
    );

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.verifiedSha256).toBe(expectedSha256);
      expect(resultB.verifiedSha256).toBe(expectedSha256);
    }
  });

  it('52: misleading path does not bypass bad bytes', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const actualSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      {
        sourcePath: `/any/${actualSha256}.json`,
        expectedArtifactSha256: 'a'.repeat(64),
      },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(failureCode(result)).toBe('TRAIN_ARTIFACT_HASH_MISMATCH');
  });

  // Success
  it('53: verified SHA returned exactly if part of API', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedSha256).toBe(expectedSha256);
      expect(result.verifiedSha256).toHaveLength(64);
    }
  });

  it('54: verified SHA matches PRE-I3A helper', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: computeMLBInnerDevelopmentTrainArtifactSHA256(bytes) },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedSha256).toBe(computeMLBInnerDevelopmentTrainArtifactSHA256(bytes));
    }
  });

  it('54: success artifact deeply immutable', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.artifact)).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection)).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection.rows)).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection.rows[0])).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection.rows[0].vector)).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection.rows[0].vector.values)).toBe(true);
      expect(Object.isFrozen(result.artifact.rowCollection.rows[0].vector.values[0])).toBe(true);
    }
  });

  it('55: parsed mutable raw object not exposed', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const mutableProxy = result.artifact as unknown as Record<string, unknown>;
      expect(() => {
        (mutableProxy as unknown as Record<string, unknown>).dirty = true;
      }).toThrow();
    }
  });

  it('56: no raw file bytes returned unless API explicitly needs them', async () => {
    const artifact = buildSyntheticArtifact();
    const bytes = canonicalBytesForArtifact(artifact);
    const expectedSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    const [reader] = createReader(bytes);

    const result = await loadMLBInnerDevelopmentTrainArtifact(
      { sourcePath: '/any/path.json', expectedArtifactSha256: expectedSha256 },
      reader,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.byteLength).toBe(bytes.length);
    }
  });
});
