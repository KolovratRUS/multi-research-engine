import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  handleMLBReportPreviewApiRequest,
  assertMLBReportPreviewApiHandlerSuccess,
} from '@/prospective/mlb/report-preview-api-handler';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
} from '@/prospective/mlb/report-preview-api-contract';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  type MLBReportPreviewUIViewModel,
  buildMLBReportPreviewUIViewModelFromHandlerSuccess,
  validateMLBReportPreviewUIViewModel,
  assertMLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import type { MLBResearchRenderedReport } from '@/prospective/mlb/research-report-renderer';

const goldenPath = join(
  __dirname,
  'fixtures',
  'manual-schedule',
  'valid-mlb-report-preview-local-cli-output-v1.json',
);
const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<string, unknown>;
const reportPreview = golden.reportPreview as MLBResearchRenderedReport;

function buildHandlerSuccess() {
  const response = handleMLBReportPreviewApiRequest({ reportPreview });
  assertMLBReportPreviewApiHandlerSuccess(response);
  return response;
}

describe('MLBReportPreviewUIViewModel', () => {
  it('exports correct constants', () => {
    expect(MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION).toBe(
      'mlb-report-preview-ui-view-model-v1',
    );
    expect(MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME).toBe(
      'MLB_REPORT_PREVIEW_UI_VIEW_MODEL',
    );
  });

  it('builds view model from handler success', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.viewModelVersion).toBe(MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION);
    expect(viewModel.viewModelName).toBe(MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME);
  });

  it('validates successfully', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const result = validateMLBReportPreviewUIViewModel(viewModel);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
    }
  });

  it('assertion accepts valid view model', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(() => assertMLBReportPreviewUIViewModel(viewModel)).not.toThrow();
  });

  it('generatedAt null becomes Local deterministic preview', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.header.generatedAtLabel).toBe('Local deterministic preview');
  });

  it('sourceLabel is Local report preview', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.header.sourceLabel).toBe('Local report preview');
  });

  it('title/subtitle are safe', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.title).toBe(reportPreview.title);
    expect(viewModel.header.subtitle).toBe('Research preview');
  });

  it('sections/cards/details copied into safe shape', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.sections.length).toBe(reportPreview.sections.length);
    expect(viewModel.gameCards.length).toBe(reportPreview.gameCards.length);
    expect(viewModel.gameDetails.length).toBe(reportPreview.gameDetails.length);
  });

  it('gameCards/gameDetails counts match', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.gameCards.length).toBe(viewModel.gameDetails.length);
  });

  it('does not mutate input', () => {
    const success = buildHandlerSuccess();
    const successCopy = JSON.parse(JSON.stringify(success));
    const viewModel1 = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const viewModel2 = buildMLBReportPreviewUIViewModelFromHandlerSuccess(
      successCopy as any,
    );
    expect(viewModel1).toEqual(viewModel2);
  });

  it('repeated build deep-equal', () => {
    const success = buildHandlerSuccess();
    const first = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const second = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(first).toEqual(second);
  });

  it('builder rejects handler failure input', () => {
    const failureSuccess = {
      ok: false as const,
      handlerVersion: 'mlb-report-preview-api-handler-v1',
      handlerName: 'MLB_REPORT_PREVIEW_API_HANDLER',
      requestId: null,
      error: { code: 'MISSING_REPORT_PREVIEW', message: 'missing' },
      metadata: {
        handlerVersion: 'mlb-report-preview-api-handler-v1',
        contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
        rendererVersion: 'missing',
        adapterVersion: 'missing',
        generatedAt: null,
        source: 'local-report-preview' as const,
        deterministic: true as const,
      },
    };
    expect(() =>
      buildMLBReportPreviewUIViewModelFromHandlerSuccess(failureSuccess as any),
    ).toThrow('MLB_REPORT_PREVIEW_UI_VIEW_MODEL requires successful handler response.');
  });

  it('validation rejects handler failure view model', () => {
    const bad = {
      ok: false as const,
      viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
      viewModelName: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
      title: 'fallback',
      header: {
        title: 'fallback',
        subtitle: 'Research preview' as const,
        generatedAtLabel: 'Local deterministic preview',
        sourceLabel: 'Local report preview' as const,
      },
      safetyBanner: { heading: 'Limitations' as const, notes: [] },
      sections: [],
      gameCards: [],
      gameDetails: [],
      moduleAvailability: { heading: 'Module Availability', modules: [] },
      warnings: [],
      metadata: {
        viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
        handlerVersion: 'mlb-report-preview-api-handler-v1',
        contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
        rendererVersion: 'missing',
        adapterVersion: 'missing',
        generatedAt: null,
        source: 'local-report-preview' as const,
        deterministic: true as const,
      },
    };
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'HANDLER_FAILURE')).toBe(true);
    }
  });

  it('rejects missing sections', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = { ...viewModel, sections: [] };
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'EMPTY_SECTIONS')).toBe(true);
    }
  });

  it('rejects mismatched gameCards/gameDetails', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      gameDetails: [...viewModel.gameDetails, viewModel.gameDetails[0]],
    };
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'GAME_CARD_DETAIL_COUNT_MISMATCH')).toBe(
        true,
      );
    }
  });

  it('rejects modelProbability', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = { ...viewModel, modelProbability: 0.5 } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_FIELD')).toBe(true);
    }
  });

  it('rejects pick/predictedWinner/winChance', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      pick: 'A',
      predictedWinner: 'A',
      winChance: 0.9,
    } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((e) => e.code === 'PROHIBITED_FIELD').length).toBe(3);
    }
  });

  it('rejects finalScore/outcome/completedGameState/finalStatus', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      finalScore: 5,
      outcome: 'home',
      completedGameState: 'Final',
      finalStatus: 'completed',
    } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((e) => e.code === 'PROHIBITED_FIELD').length).toBe(4);
    }
  });

  it('rejects actualStartingPitchers', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = { ...viewModel, actualStartingPitchers: [] } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_FIELD')).toBe(true);
    }
  });

  it('rejects odds/sportsbook/market/price/edge/ROI', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      odds: 100,
      sportsbook: 'book',
      market: 'h2h',
      price: 100,
      edge: 0.05,
      ROI: 0.1,
    } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((e) => e.code === 'PROHIBITED_FIELD').length).toBe(6);
    }
  });

  it('rejects unsafe strings like best bet', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      title: 'This is the best bet for today.',
    };
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
    }
  });

  it('rejects should win, likely winner, win probability, market edge, sportsbook price', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const cases = [
      { title: 'Team A should win' },
      { title: 'Likely winner' },
      { title: 'Win probability is 60%' },
      { title: 'Market edge' },
      { title: 'Sportsbook price' },
    ];
    for (const bad of cases) {
      const result = validateMLBReportPreviewUIViewModel({ ...viewModel, ...bad });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
      }
    }
  });

  it('rejects raw research package fields', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      package: {},
      researchPackageVersion: 'v1',
      researchRunId: 'run-1',
      sourceConstructionRunId: 'run-1',
      sourceConstructionLockId: 'lock-1',
      inputConstructionPackage: {},
      inputSnapshot: {},
      evidence: {},
      constructionWarnings: [],
    } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((e) => e.code === 'PROHIBITED_FIELD').length).toBeGreaterThanOrEqual(7);
    }
  });

  it('rejects raw historical fixture fields', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      evidence: {},
      inputSnapshot: {},
      constructionVersion: 'v1',
      lockVersion: 'v1',
    } as Record<string, unknown>;
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((e) => e.code === 'PROHIBITED_FIELD').length).toBe(4);
    }
  });

  it('rejects source live', () => {
    const success = buildHandlerSuccess();
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const bad = {
      ...viewModel,
      metadata: { ...viewModel.metadata, source: 'live' as const },
    };
    const result = validateMLBReportPreviewUIViewModel(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_SOURCE')).toBe(true);
    }
  });

  it('does not call current time', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.metadata.generatedAt).toBeNull();
  });

  it('does not read/write files or invoke CLI from builder', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    expect(viewModel.viewModelVersion).toBeDefined();
    expect(viewModel.sections.length).toBeGreaterThan(0);
  });

  it('view model has no prohibited key names', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const serialized = JSON.stringify(viewModel);
    const forbiddenKeys = [
      'modelProbability',
      'predictedWinner',
      'pick',
      'winChance',
      'powerRating',
      'teamRank',
      'standingsPosition',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'odds',
      'sportsbook',
      'market',
      'price',
      'edge',
      'ROI',
      'impliedProbability',
      'probability',
      'winner',
      'favorite',
      'underdog',
      'package',
      'researchPackageVersion',
      'researchRunId',
      'sourceConstructionRunId',
      'sourceConstructionLockId',
      'inputConstructionPackage',
      'inputSnapshot',
      'evidence',
      'constructionWarnings',
      'constructionVersion',
      'lockVersion',
    ];
    for (const key of forbiddenKeys) {
      expect(serialized.includes(`"${key}"`)).toBe(false);
    }
  });

  it('view model has no unsafe phrases', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const result = validateMLBReportPreviewUIViewModel(viewModel);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
    }
  });

  it('view model does not include raw handler failure errors as recommendation copy', () => {
    const success = buildHandlerSuccess();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const serialized = JSON.stringify(viewModel);
    expect(serialized.includes('MISSING_REPORT_PREVIEW')).toBe(false);
    expect(serialized.includes('PROHIBITED_FIELD')).toBe(false);
  });
});
