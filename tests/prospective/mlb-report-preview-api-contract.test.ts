import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
  MLB_REPORT_PREVIEW_API_CONTRACT_NAME,
  buildMLBReportPreviewApiResponseFromRenderedReport,
  assertMLBReportPreviewApiResponse,
  validateMLBReportPreviewApiResponse,
  type MLBReportPreviewApiReportPreview,
  type MLBReportPreviewApiValidationError,
} from '@/prospective/mlb/report-preview-api-contract';
import type { MLBResearchRenderedReport } from '@/prospective/mlb/research-report-renderer';

const goldenPath = join(
  __dirname,
  'fixtures',
  'manual-schedule',
  'valid-mlb-report-preview-local-cli-output-v1.json',
);
const golden = JSON.parse(
  readFileSync(goldenPath, 'utf8'),
) as Record<string, unknown>;
const goldenReportPreview = golden.reportPreview as MLBResearchRenderedReport;

describe('MLBReportPreviewApiContract', () => {
  it('exports correct constants', () => {
    expect(MLB_REPORT_PREVIEW_API_CONTRACT_VERSION).toBe(
      'mlb-report-preview-api-contract-v1',
    );
    expect(MLB_REPORT_PREVIEW_API_CONTRACT_NAME).toBe(
      'MLB_REPORT_PREVIEW_API_CONTRACT',
    );
  });

  it('builds valid API response from reportPreview golden', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(api.ok).toBe(true);
    expect(api.contractVersion).toBe(MLB_REPORT_PREVIEW_API_CONTRACT_VERSION);
    expect(api.contractName).toBe(MLB_REPORT_PREVIEW_API_CONTRACT_NAME);
    expect(api.reportPreview).toBeDefined();
    expect(api.safety.localOnly).toBe(true);
    expect(api.safety.reportPreviewOnly).toBe(true);
    expect(api.safety.rawResearchPackageAllowed).toBe(false);
    expect(api.safety.rawHistoricalFixturesAllowed).toBe(false);
    expect(api.safety.liveDataAllowed).toBe(false);
    expect(api.safety.bettingDataAllowed).toBe(false);
    expect(api.safety.rawOutcomesAllowed).toBe(false);
    expect(api.safety.pitcherEvidenceAllowed).toBe(false);
    expect(api.safety.actualStartersAllowed).toBe(false);
    expect(api.safety.probabilityClaimsAllowed).toBe(false);
  });

  it('validates API response successfully', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const result = validateMLBReportPreviewApiResponse(api);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('assertion helper does not throw for valid response', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(() => assertMLBReportPreviewApiResponse(api)).not.toThrow();
  });

  it('metadata generatedAt remains null from golden', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(api.metadata.generatedAt).toBeNull();
    expect(api.reportPreview.metadata.generatedAt).toBeNull();
  });

  it('source remains local-research-package', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(api.metadata.source).toBe('local-research-package');
    expect(api.reportPreview.metadata.source).toBe('local-research-package');
  });

  it('deterministic true preserved', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(api.metadata.deterministic).toBe(true);
    expect(api.reportPreview.metadata.deterministic).toBe(true);
  });

  it('rejects missing reportPreview', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = { ...api, reportPreview: undefined };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) =>
        error.code === 'MISSING_REPORT_PREVIEW',
      ),
    ).toBe(true);
  });

  it('rejects wrong contractVersion', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = { ...api, contractVersion: 'bad' };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'WRONG_CONTRACT_VERSION'),
    ).toBe(true);
  });

  it('rejects non-local source', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        metadata: { ...api.reportPreview.metadata, source: 'live' },
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'INVALID_SOURCE')).toBe(
      true,
    );
  });

  it('rejects deterministic false', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        metadata: {
          ...api.reportPreview.metadata,
          deterministic: false,
        },
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'INVALID_DETERMINISTIC'),
    ).toBe(true);
  });

  it('rejects generatedAt auto/current timestamp', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        metadata: {
          ...api.reportPreview.metadata,
          generatedAt: '2026-07-27T22:00:00Z',
        },
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'INVALID_GENERATED_AT'),
    ).toBe(true);
  });

  it('rejects mismatched gameCards/gameDetails counts', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        gameCards: [
          ...api.reportPreview.gameCards,
          { ...api.reportPreview.gameCards[0] },
        ],
        gameDetails: api.reportPreview.gameDetails,
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (error: MLBReportPreviewApiValidationError) => error.code === 'GAME_CARD_DETAIL_COUNT_MISMATCH',
      ),
    ).toBe(true);
  });

  it('rejects prohibited raw outcome keys', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        finalScore: 5,
        outcome: 'home',
        completedGameState: 'Final',
        finalStatus: 'completed',
        actualStartingPitchers: [],
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'PROHIBITED_FIELD'),
    ).toBe(true);
  });

  it('rejects modelProbability', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        modelProbability: 0.5,
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'PROHIBITED_FIELD'),
    ).toBe(true);
  });

  it('rejects predictedWinner/pick/winChance', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        predictedWinner: 'away',
        pick: 'away',
        winChance: 0.5,
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'PROHIBITED_FIELD'),
    ).toBe(true);
  });

  it('rejects unsafe recommendation phrases', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        gameCards: [
          {
            ...api.reportPreview.gameCards[0],
            moduleSummary: 'This is the best bet.',
          },
          ...api.reportPreview.gameCards.slice(1),
        ],
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'PROHIBITED_VALUE_TEXT'),
    ).toBe(true);
  });

  it('allows known negative safety phrase emitted by renderer/golden', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const withSafePhrase = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        gameDetails: [
          {
            ...api.reportPreview.gameDetails[0],
            evidenceLimitations:
              'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
          },
          api.reportPreview.gameDetails[1],
        ],
      },
    };
    const result = validateMLBReportPreviewApiResponse(withSafePhrase);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('does not mutate input rendered report', () => {
    const input = JSON.parse(
      JSON.stringify(goldenReportPreview),
    ) as MLBResearchRenderedReport;
    buildMLBReportPreviewApiResponseFromRenderedReport(input);
    expect(input).toEqual(goldenReportPreview);
  });

  it('repeated builder runs are deep-equal', () => {
    const first = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const second = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(first).toEqual(second);
  });

  it('does not call current time', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    expect(api.metadata.generatedAt).toBeNull();
    expect(api.reportPreview.metadata.generatedAt).toBeNull();
  });

  it('validates no raw researchPackage/raw historical fixture fields are present', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        package: {},
        inputConstructionPackage: {},
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) =>
        error.code === 'PROHIBITED_FIELD',
      ),
    ).toBe(true);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) =>
        error.path === 'reportPreview',
      ),
    ).toBe(true);
  });

  it('validates golden-derived response has no prohibited keys/unsafe phrases', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const result = validateMLBReportPreviewApiResponse(api);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing required reportPreview key', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        gameCards: undefined,
      },
    } as any;
    const result = validateMLBReportPreviewApiResponse(invalid);
    console.log('DEBUG result', result);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'INVALID_GAME_CARDS'),
    ).toBe(true);
  });

  it('rejects empty sections', () => {
    const api = buildMLBReportPreviewApiResponseFromRenderedReport(
      goldenReportPreview,
    );
    const invalid = {
      ...api,
      reportPreview: {
        ...api.reportPreview,
        sections: [],
      },
    };
    const result = validateMLBReportPreviewApiResponse(invalid);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error: MLBReportPreviewApiValidationError) => error.code === 'INVALID_SECTIONS'),
    ).toBe(true);
  });
});
