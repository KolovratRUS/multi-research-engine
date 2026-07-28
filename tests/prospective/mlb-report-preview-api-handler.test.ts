import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
  MLB_REPORT_PREVIEW_API_HANDLER_NAME,
  handleMLBReportPreviewApiRequest,
  assertMLBReportPreviewApiHandlerSuccess,
  type MLBReportPreviewApiHandlerRequest,
  type MLBReportPreviewApiHandlerResponse,
  type MLBReportPreviewApiHandlerSuccess,
  type MLBReportPreviewApiHandlerFailure,
} from '@/prospective/mlb/report-preview-api-handler';
import type { MLBResearchRenderedReport } from '@/prospective/mlb/research-report-renderer';

const goldenPath = join(
  __dirname,
  'fixtures',
  'manual-schedule',
  'valid-mlb-report-preview-local-cli-output-v1.json',
);
const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<string, unknown>;
const reportPreview = golden.reportPreview as MLBResearchRenderedReport;

describe('MLBReportPreviewApiHandler', () => {
  const baseRequest: MLBReportPreviewApiHandlerRequest = {
    reportPreview,
  };

  it('exports correct constants', () => {
    expect(MLB_REPORT_PREVIEW_API_HANDLER_VERSION).toBe(
      'mlb-report-preview-api-handler-v1',
    );
    expect(MLB_REPORT_PREVIEW_API_HANDLER_NAME).toBe(
      'MLB_REPORT_PREVIEW_API_HANDLER',
    );
  });

  it('returns successful handler response from golden reportPreview', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect(response.ok).toBe(true);
    expect(response.handlerVersion).toBe(MLB_REPORT_PREVIEW_API_HANDLER_VERSION);
    expect(response.handlerName).toBe(MLB_REPORT_PREVIEW_API_HANDLER_NAME);
  });

  it('success response contains Phase 6B contract response', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    const success = response as MLBReportPreviewApiHandlerSuccess;
    expect(success.apiResponse.ok).toBe(true);
    expect(success.apiResponse.reportPreview).toBeDefined();
  });

  it('copies requestId when supplied', () => {
    const response = handleMLBReportPreviewApiRequest({
      ...baseRequest,
      requestId: 'request-123',
    });
    expect((response as MLBReportPreviewApiHandlerSuccess).requestId).toBe('request-123');
  });

  it('sets requestId to null when missing/non-string', () => {
    const missing = handleMLBReportPreviewApiRequest(baseRequest);
    expect((missing as MLBReportPreviewApiHandlerSuccess).requestId).toBeNull();

    const nonString = handleMLBReportPreviewApiRequest({
      ...baseRequest,
      requestId: 123 as any,
    });
    expect((nonString as MLBReportPreviewApiHandlerSuccess).requestId).toBeNull();
  });

  it('defaults source to local-report-preview', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect((response as MLBReportPreviewApiHandlerSuccess).metadata.source).toBe('local-report-preview');
    expect((response as MLBReportPreviewApiHandlerSuccess).apiResponse.metadata.source).toBe('local-research-package');
  });

  it('preserves deterministic true and null generatedAt from golden', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect((response as MLBReportPreviewApiHandlerSuccess).metadata.deterministic).toBe(true);
    expect((response as MLBReportPreviewApiHandlerSuccess).metadata.generatedAt).toBeNull();
    expect((response as MLBReportPreviewApiHandlerSuccess).apiResponse.metadata.generatedAt).toBeNull();
  });

  it('does not mutate input reportPreview', () => {
    const input = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    handleMLBReportPreviewApiRequest({ reportPreview: input });
    expect(input).toEqual(reportPreview);
  });

  it('produces deep-equal responses across repeated calls', () => {
    const first = handleMLBReportPreviewApiRequest(baseRequest);
    const second = handleMLBReportPreviewApiRequest(baseRequest);
    expect(first).toEqual(second);
  });

  it('returns ok false with structured error when reportPreview is missing', () => {
    const response = handleMLBReportPreviewApiRequest({});
    expect(response.ok).toBe(false);
    expect(response.handlerVersion).toBe(MLB_REPORT_PREVIEW_API_HANDLER_VERSION);
    expect(response.handlerName).toBe(MLB_REPORT_PREVIEW_API_HANDLER_NAME);
    expect(response.requestId).toBeNull();
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('MISSING_REPORT_PREVIEW');
    expect((response as MLBReportPreviewApiHandlerFailure).error.message).toBe('reportPreview is required on request.');
    expect(response.metadata.deterministic).toBe(true);
  });

  it('returns ok false using contract validation errors for invalid input', () => {
    const invalid = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    (invalid as unknown as Record<string, unknown>).modelProbability = 0.5;
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: invalid,
    });
    expect(response.ok).toBe(false);
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('PROHIBITED_FIELD');
  });

  it('rejects prohibited modelProbability input in strict mode', () => {
    const invalid = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    (invalid as unknown as Record<string, unknown>).modelProbability = 0.5;
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: invalid,
      strict: true,
    });
    expect(response.ok).toBe(false);
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('PROHIBITED_FIELD');
  });

  it('rejects prohibited finalScore/outcome/completedGameState input', () => {
    const invalid = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    const record = invalid as unknown as Record<string, unknown>;
    record.finalScore = 5;
    record.outcome = 'home';
    record.completedGameState = 'Final';
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: invalid,
    });
    expect(response.ok).toBe(false);
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('PROHIBITED_FIELD');
    expect((response as MLBReportPreviewApiHandlerFailure).error.path).toBe('reportPreview');
  });

  it('rejects unsafe recommendation phrase input', () => {
    const invalid = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    (invalid as unknown as Record<string, unknown>).safetyNotes = ['This is the best bet for today.'];
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: invalid,
    });
    expect(response.ok).toBe(false);
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('PROHIBITED_VALUE_TEXT');
  });

  it('allows known negative renderer safety phrase', () => {
    const safe = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    (safe as unknown as Record<string, unknown>).safetyNotes = [
      'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
    ];
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: safe,
    });
    expect(response.ok).toBe(true);
    expect((response as MLBReportPreviewApiHandlerSuccess).apiResponse.ok).toBe(true);
  });

  it('strict false still never allows prohibited raw fields', () => {
    const invalid = JSON.parse(JSON.stringify(reportPreview)) as MLBResearchRenderedReport;
    (invalid as unknown as Record<string, unknown>).finalScore = 5;
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: invalid,
      strict: false,
    });
    expect(response.ok).toBe(false);
    expect((response as MLBReportPreviewApiHandlerFailure).error.code).toBe('PROHIBITED_FIELD');
  });

  it('assertion helper accepts success response', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect(() => assertMLBReportPreviewApiHandlerSuccess(response)).not.toThrow();
  });

  it('assertion helper rejects failure with concise message', () => {
    const response = handleMLBReportPreviewApiRequest({});
    expect(() => assertMLBReportPreviewApiHandlerSuccess(response)).toThrow(
      'MLB_REPORT_PREVIEW_API_HANDLER response failed: MISSING_REPORT_PREVIEW — reportPreview is required on request.',
    );
  });

  it('does not call current time', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect((response as MLBReportPreviewApiHandlerSuccess).metadata.generatedAt).toBeNull();
  });

  it('does not read/write files or invoke CLI', () => {
    const response = handleMLBReportPreviewApiRequest(baseRequest);
    expect(response.ok).toBe(true);
    expect((response as MLBReportPreviewApiHandlerSuccess).apiResponse.reportPreview).toBeDefined();
  });
});
