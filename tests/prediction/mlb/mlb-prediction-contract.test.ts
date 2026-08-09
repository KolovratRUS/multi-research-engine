import { describe, expect, it } from 'vitest';
import {
  validateMLBPredictionInputContract,
  validateMLBPredictionDraftContract,
  type MLBPredictionContractValidationIssue,
} from '@/prediction/mlb/mlb-prediction-contract';

const FROZEN_TIMESTAMP = '2026-07-15T12:00:00Z';

const SCHEDULED_START = '2026-07-15T12:00:00Z';
const CAPTURED_AT = '2026-07-15T10:00:00Z';
const DATA_CUTOFF = '2026-07-15T10:00:00Z';
const SOURCE_UPDATED_AT = '2026-07-15T09:00:00Z';
const DRAFT_GENERATED_AT = '2026-07-15T11:00:00Z';

function buildValidInput(overrides: Record<string, unknown> = {}): unknown {
  return {
    contractVersion: 'mlb-prediction-input-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    game: {
      gameId: 'game-1',
      scheduledStartAt: SCHEDULED_START,
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
    },
    snapshot: {
      snapshotId: 'snapshot-1',
      capturedAt: CAPTURED_AT,
      dataCutoffAt: DATA_CUTOFF,
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      dataCompleteness: 'COMPLETE',
    },
    availability: {
      homeStartingPitcher: 'AVAILABLE',
      awayStartingPitcher: 'UNAVAILABLE',
    },
    researchPayload: {
      recentForm: 'clean',
    },
    ...overrides,
  };
}

function buildValidDraft(overrides: Record<string, unknown> = {}): unknown {
  return {
    contractVersion: 'mlb-prediction-draft-v1',
    draftId: 'draft-1',
    input: buildValidInput(),
    generatedAt: DRAFT_GENERATED_AT,
    selectionStatus: 'PENDING_MODEL',
    noSelectionReason: null,
    ...overrides,
  };
}

describe('mlb-prediction-contract', () => {
  it('accepts one safe pregame MLB game and preserves exact supplied values', () => {
    const input = buildValidInput() as Parameters<typeof validateMLBPredictionInputContract>[0];

    const result = validateMLBPredictionInputContract(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(input);
    }
  });

  it('accepts a valid PENDING_MODEL draft with no winner/probability/multi/stake fields', () => {
    const draft = buildValidDraft() as Parameters<typeof validateMLBPredictionDraftContract>[0];

    expect(() => validateMLBPredictionDraftContract(draft)).not.toThrow();

    const result = validateMLBPredictionDraftContract(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(draft);
    }
  });

  it('accepts only OFFICIAL_FINAL_GAME_WINNER and rejects regulation-only, totals, run-line, and live targets', () => {
    expect(validateMLBPredictionInputContract(buildValidInput({ target: 'REGULATION_ONLY' })).ok).toBe(false);
    expect(validateMLBPredictionInputContract(buildValidInput({ target: 'TOTALS' })).ok).toBe(false);
    expect(validateMLBPredictionInputContract(buildValidInput({ target: 'RUN_LINE' })).ok).toBe(false);
    expect(validateMLBPredictionInputContract(buildValidInput({ target: 'LIVE_GAME' })).ok).toBe(false);
  });

  it('accepts valid timestamp ordering and rejects cutoff/capture/start violations and missing timezone or padding', () => {
    const validInput = buildValidInput({
      snapshot: {
        snapshotId: 'snapshot-valid',
        capturedAt: '2026-07-15T12:00:00Z',
        dataCutoffAt: '2026-07-15T11:00:00Z',
        sourceUpdatedAt: '2026-07-15T10:00:00Z',
        dataCompleteness: 'COMPLETE',
      },
      game: {
        gameId: 'game-valid',
        scheduledStartAt: '2026-07-15T13:00:00Z',
        homeTeamId: 'home-valid',
        awayTeamId: 'away-valid',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(validInput).ok).toBe(true);

    expect(validateMLBPredictionInputContract(buildValidInput({
      snapshot: {
        snapshotId: 'snapshot-bad',
        capturedAt: '2026-07-15T12:00:00Z',
        dataCutoffAt: '2026-07-15T13:00:00Z',
        sourceUpdatedAt: null,
        dataCompleteness: 'COMPLETE',
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      snapshot: {
        snapshotId: 'snapshot-bad',
        capturedAt: '2026-07-15T12:00:00Z',
        dataCutoffAt: '2026-07-15T11:00:00Z',
        sourceUpdatedAt: null,
        dataCompleteness: 'COMPLETE',
      },
      game: {
        gameId: 'game-bad',
        scheduledStartAt: '2026-07-15T11:59:00Z',
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: ' 2026-07-15T10:00:00Z',
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: '2026-07-15T10:00:00Z ',
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: '2026-07-15',
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    })).ok).toBe(false);

    const mixedValid = buildValidInput({
      snapshot: {
        snapshotId: 'snapshot-mixed-valid',
        capturedAt: '2026-07-15T12:00:00-05:00',
        dataCutoffAt: '2026-07-15T11:00:00-05:00',
        sourceUpdatedAt: '2026-07-15T10:00:00+02:00',
        dataCompleteness: 'COMPLETE',
      },
      game: {
        gameId: 'game-mixed-valid',
        scheduledStartAt: '2026-07-15T18:00:00Z',
        homeTeamId: 'home-mixed-valid',
        awayTeamId: 'away-mixed-valid',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(mixedValid).ok).toBe(true);

    expect(validateMLBPredictionInputContract(buildValidInput({
      snapshot: {
        snapshotId: 'snapshot-offset-bad',
        capturedAt: '2026-07-16T01:00:00-08:00',
        dataCutoffAt: '2026-07-16T00:00:00-08:00',
        sourceUpdatedAt: null,
        dataCompleteness: 'COMPLETE',
      },
      game: {
        gameId: 'game-offset-bad',
        scheduledStartAt: '2026-07-16T02:00:00Z',
        homeTeamId: 'home-offset-bad',
        awayTeamId: 'away-offset-bad',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    })).ok).toBe(false);
  });

  it('rejects identical team IDs and empty identifiers', () => {
    const result = validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'same',
        awayTeamId: 'same',
        venueId: null,
        neutralSite: false,
        doubleheader: null,
      },
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DUPLICATE_TEAM' }),
        ]),
      );
    }
  });

  it('accepts true/false/null neutralSite and rejects missing, non-boolean, and unknown homeAdvantage', () => {
    const validTrue = buildValidInput({
      game: {
        gameId: 'game-valid',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-valid',
        awayTeamId: 'away-valid',
        venueId: null,
        neutralSite: true,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(validTrue).ok).toBe(true);

    const validFalse = buildValidInput({
      game: {
        gameId: 'game-valid',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-valid',
        awayTeamId: 'away-valid',
        venueId: null,
        neutralSite: false,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(validFalse).ok).toBe(true);

    const validNull = buildValidInput({
      game: {
        gameId: 'game-valid',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-valid',
        awayTeamId: 'away-valid',
        venueId: null,
        neutralSite: null,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(validNull).ok).toBe(true);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: 'yes',
        doubleheader: null,
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        homeAdvantage: false,
        doubleheader: null,
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        doubleheader: null,
      },
    })).ok).toBe(false);
  });

  it('accepts null and valid game 1/2 doubleheaders and rejects unsupported numbers, missing IDs, and unknown fields', () => {
    const valid = buildValidInput({
      game: {
        gameId: 'game-valid',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-valid',
        awayTeamId: 'away-valid',
        venueId: null,
        neutralSite: false,
        doubleheader: null,
      },
    });

    expect(validateMLBPredictionInputContract(valid).ok).toBe(true);

    const validDoubleheader = buildValidInput({
      game: {
        gameId: 'game-dh',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-dh',
        awayTeamId: 'away-dh',
        venueId: null,
        neutralSite: false,
        doubleheader: {
          doubleheaderId: 'dh-1',
          gameNumber: 2,
        },
      },
    });

    expect(validateMLBPredictionInputContract(validDoubleheader).ok).toBe(true);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: false,
        doubleheader: {
          doubleheaderId: 'dh-bad',
          gameNumber: 3,
        },
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: false,
        doubleheader: {
          doubleheaderId: '',
          gameNumber: 1,
        },
      },
    })).ok).toBe(false);

    expect(validateMLBPredictionInputContract(buildValidInput({
      game: {
        gameId: 'game-bad',
        scheduledStartAt: FROZEN_TIMESTAMP,
        homeTeamId: 'home-bad',
        awayTeamId: 'away-bad',
        venueId: null,
        neutralSite: false,
        doubleheader: {
          doubleheaderId: 'dh-bad',
          gameNumber: 1,
          extra: true,
        },
      },
    })).ok).toBe(false);
  });

  it('accepts all four availability states and rejects arbitrary state strings', () => {
    const valid = buildValidInput({
      availability: {
        homeStartingPitcher: 'AVAILABLE',
        awayStartingPitcher: 'UNAVAILABLE',
      },
    });

    expect(validateMLBPredictionInputContract(valid).ok).toBe(true);

    const unconfirmed = buildValidInput({
      availability: {
        homeStartingPitcher: 'UNCONFIRMED',
        awayStartingPitcher: 'CHANGED_AFTER_SNAPSHOT',
      },
    });

    expect(validateMLBPredictionInputContract(unconfirmed).ok).toBe(true);

    expect(validateMLBPredictionInputContract(buildValidInput({
      availability: {
        homeStartingPitcher: 'READY',
        awayStartingPitcher: 'UNAVAILABLE',
      },
    })).ok).toBe(false);
  });

  it('validates PENDING_MODEL, NO_SELECTION, and MODEL_ERROR with matching noSelectionReason rules', () => {
    const pending = buildValidDraft({
      selectionStatus: 'PENDING_MODEL',
      noSelectionReason: null,
    });

    expect(validateMLBPredictionDraftContract(pending).ok).toBe(true);

    const noSelection = buildValidDraft({
      selectionStatus: 'NO_SELECTION',
      noSelectionReason: 'Waiting for starter confirmation',
    });

    expect(validateMLBPredictionDraftContract(noSelection).ok).toBe(true);

    const modelError = buildValidDraft({
      selectionStatus: 'MODEL_ERROR',
      noSelectionReason: 'Snapshot incomplete',
    });

    expect(validateMLBPredictionDraftContract(modelError).ok).toBe(true);

    expect(validateMLBPredictionDraftContract(buildValidDraft({
      selectionStatus: 'PENDING_MODEL',
      noSelectionReason: 'Should be null',
    })).ok).toBe(false);

    expect(validateMLBPredictionDraftContract(buildValidDraft({
      selectionStatus: 'NO_SELECTION',
      noSelectionReason: null,
    })).ok).toBe(false);
  });

  it('rejects null, arrays, class instances, unknown fields, prohibited odds, and non-JSON-like researchPayload values', () => {
    class CustomPayload {}

    const nullResult = validateMLBPredictionInputContract(null);
    expect(nullResult.ok).toBe(false);
    if (!nullResult.ok) {
      expect(nullResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NOT_PLAIN_OBJECT' }),
        ]),
      );
    }

    const arrayResult = validateMLBPredictionInputContract([]);
    expect(arrayResult.ok).toBe(false);
    if (!arrayResult.ok) {
      expect(arrayResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NOT_PLAIN_OBJECT' }),
        ]),
      );
    }

    const classResult = validateMLBPredictionInputContract(new CustomPayload());
    expect(classResult.ok).toBe(false);
    if (!classResult.ok) {
      expect(classResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NOT_PLAIN_OBJECT' }),
        ]),
      );
    }

    const unknownFieldResult = validateMLBPredictionInputContract(
      buildValidInput({
        unknownField: true,
        researchPayload: {
          known: 'safe',
          odds: 'unsafe',
        },
      }),
    );

    expect(unknownFieldResult.ok).toBe(false);
    const unknownFieldIssues = unknownFieldResult.ok ? [] : unknownFieldResult.issues;
    expect(unknownFieldIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD' }),
        expect.objectContaining({ code: 'ODDS_CONTAMINATION' }),
      ]),
    );

    const paths = unknownFieldIssues
      .map((issue: MLBPredictionContractValidationIssue) => issue.path)
      .sort();
    expect(paths).toEqual([
      '$.researchPayload.odds',
      '$.unknownField',
    ]);

    const symbolKey = Symbol('contractSymbol');
    const baseInput = buildValidInput() as Record<string, unknown>;
    const symbolResult = validateMLBPredictionInputContract({
      ...baseInput,
      [symbolKey]: 'hidden',
    });
    expect(symbolResult.ok).toBe(false);
    if (!symbolResult.ok) {
      expect(symbolResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'UNKNOWN_FIELD' }),
        ]),
      );
    }

    const payloadSymbolResult = validateMLBPredictionInputContract(
      buildValidInput({
        researchPayload: {
          known: 'safe',
          [Symbol('payloadSymbol')]: 'hidden',
        },
      }),
    );
    expect(payloadSymbolResult.ok).toBe(false);
    if (!payloadSymbolResult.ok) {
      expect(payloadSymbolResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'UNKNOWN_FIELD' }),
        ]),
      );
    }

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { confidence: NaN },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { upper: Infinity },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { lower: -Infinity },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { timestamp: new Date() },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { meta: new Map() },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { items: new Set() },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { pattern: /unsafe/ },
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: { custom: new CustomPayload() },
        }),
      ).ok,
    ).toBe(false);

    const accessorPayload: Record<string, unknown> = {};
    let accessed = false;
    Object.defineProperty(accessorPayload, 'price', {
      enumerable: true,
      get() {
        accessed = true;
        return 1.5;
      },
    });
    expect(
      validateMLBPredictionInputContract(
        buildValidInput({
          researchPayload: accessorPayload,
        }),
      ).ok,
    ).toBe(false);
    expect(accessed).toBe(false);

    const setterOnlyPayload: Record<string, unknown> = {};
    let setterExecuted = false;
    Object.defineProperty(setterOnlyPayload, 'safeField', {
      enumerable: false,
      set(_value: unknown) {
        setterExecuted = true;
      },
    });
    const setterResult = validateMLBPredictionInputContract(
      buildValidInput({
        researchPayload: setterOnlyPayload,
      }),
    );
    expect(setterResult.ok).toBe(false);
    if (!setterResult.ok) {
      expect(setterResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_RESEARCH_PAYLOAD_VALUE' }),
        ]),
      );
    }
    expect(setterExecuted).toBe(false);

    const arraySetterPayload: unknown[] = [];
    let arraySetterExecuted = false;
    Object.defineProperty(arraySetterPayload, 'safeField', {
      enumerable: false,
      set(_value: unknown) {
        arraySetterExecuted = true;
      },
    });
    const arraySetterResult = validateMLBPredictionInputContract(
      buildValidInput({
        researchPayload: {
          items: arraySetterPayload,
        },
      }),
    );
    expect(arraySetterResult.ok).toBe(false);
    if (!arraySetterResult.ok) {
      expect(arraySetterResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_RESEARCH_PAYLOAD_VALUE' }),
        ]),
      );
    }
    expect(arraySetterExecuted).toBe(false);

    const cyclic: Record<string, unknown> = { nested: 'safe' };
    cyclic.self = cyclic;
    const cyclicResult = validateMLBPredictionInputContract(
      buildValidInput({
        researchPayload: cyclic,
      }),
    );
    expect(cyclicResult.ok).toBe(false);
    if (!cyclicResult.ok) {
      expect(cyclicResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_RESEARCH_PAYLOAD_VALUE' }),
        ]),
      );
    }

    const numericGetterArray: unknown[] = [];
    let numericGetterExecuted = false;
    Object.defineProperty(numericGetterArray, '0', {
      enumerable: true,
      get() {
        numericGetterExecuted = true;
        return {
          sportsbook: 'legacy',
        };
      },
    });
    const numericGetterResult = validateMLBPredictionInputContract(
      buildValidInput({
        researchPayload: {
          items: numericGetterArray,
        },
      }),
    );
    expect(numericGetterResult.ok).toBe(false);
    if (!numericGetterResult.ok) {
      expect(numericGetterResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_RESEARCH_PAYLOAD_VALUE' }),
        ]),
      );
    }
    expect(numericGetterExecuted).toBe(false);
  });
});
