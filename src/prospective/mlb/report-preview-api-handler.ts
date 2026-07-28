import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
  MLB_REPORT_PREVIEW_API_CONTRACT_NAME,
  MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS,
  type MLBReportPreviewApiResponse,
  type MLBReportPreviewApiValidationError,
  validateMLBReportPreviewApiResponse,
  assertMLBReportPreviewApiResponse,
  buildMLBReportPreviewApiResponseFromRenderedReport,
  collectBadStrings,
} from './report-preview-api-contract';
import type { MLBResearchRenderedReport } from './research-report-renderer';

export const MLB_REPORT_PREVIEW_API_HANDLER_VERSION =
  'mlb-report-preview-api-handler-v1';
export const MLB_REPORT_PREVIEW_API_HANDLER_NAME =
  'MLB_REPORT_PREVIEW_API_HANDLER';

export interface MLBReportPreviewApiHandlerMetadata {
  readonly handlerVersion: typeof MLB_REPORT_PREVIEW_API_HANDLER_VERSION;
  readonly contractVersion: typeof MLB_REPORT_PREVIEW_API_CONTRACT_VERSION;
  readonly rendererVersion: string;
  readonly adapterVersion: string;
  readonly generatedAt: string | null;
  readonly source: 'local-report-preview';
  readonly deterministic: true;
}

export interface MLBReportPreviewApiHandlerError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface MLBReportPreviewApiHandlerSuccess {
  readonly ok: true;
  readonly handlerVersion: typeof MLB_REPORT_PREVIEW_API_HANDLER_VERSION;
  readonly handlerName: typeof MLB_REPORT_PREVIEW_API_HANDLER_NAME;
  readonly requestId: string | null;
  readonly apiResponse: MLBReportPreviewApiResponse;
  readonly metadata: MLBReportPreviewApiHandlerMetadata;
}

export interface MLBReportPreviewApiHandlerFailure {
  readonly ok: false;
  readonly handlerVersion: typeof MLB_REPORT_PREVIEW_API_HANDLER_VERSION;
  readonly handlerName: typeof MLB_REPORT_PREVIEW_API_HANDLER_NAME;
  readonly requestId: string | null;
  readonly error: MLBReportPreviewApiHandlerError;
  readonly metadata: MLBReportPreviewApiHandlerMetadata;
}

export interface MLBReportPreviewApiHandlerRequest {
  readonly reportPreview?: MLBResearchRenderedReport;
  readonly requestId?: string | null;
  readonly source?: 'local-report-preview';
  readonly strict?: boolean;
}

export type MLBReportPreviewApiHandlerResponse =
  | MLBReportPreviewApiHandlerSuccess
  | MLBReportPreviewApiHandlerFailure;

function normalizeRequestId(
  value: MLBReportPreviewApiHandlerRequest['requestId'],
): string | null {
  return typeof value === 'string' ? value : null;
}

function buildHandlerMetadata(
  rendered: MLBResearchRenderedReport,
): MLBReportPreviewApiHandlerMetadata {
  return {
    handlerVersion: MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
    contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
    rendererVersion: rendered.metadata.rendererVersion,
    adapterVersion: rendered.metadata.adapterVersion,
    generatedAt: rendered.metadata.generatedAt,
    source: 'local-report-preview',
    deterministic: true,
  };
}

function buildSuccessResponse(
  request: MLBReportPreviewApiHandlerRequest,
  rendered: MLBResearchRenderedReport,
): MLBReportPreviewApiHandlerSuccess {
  const apiResponse = buildMLBReportPreviewApiResponseFromRenderedReport(
    rendered,
  );
  return {
    ok: true,
    handlerVersion: MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
    handlerName: MLB_REPORT_PREVIEW_API_HANDLER_NAME,
    requestId: normalizeRequestId(request.requestId),
    apiResponse,
    metadata: buildHandlerMetadata(rendered),
  };
}

function buildFailureResponse(
  request: MLBReportPreviewApiHandlerRequest,
  error: MLBReportPreviewApiHandlerError,
  generatedAt: string | null = null,
): MLBReportPreviewApiHandlerFailure {
  return {
    ok: false,
    handlerVersion: MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
    handlerName: MLB_REPORT_PREVIEW_API_HANDLER_NAME,
    requestId: normalizeRequestId(request.requestId),
    error,
    metadata: {
      handlerVersion: MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
      contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
      rendererVersion: MLB_REPORT_PREVIEW_API_HANDLER_VERSION,
      adapterVersion: 'missing',
      generatedAt,
      source: 'local-report-preview',
      deterministic: true,
    },
  };
}

export function handleMLBReportPreviewApiRequest(
  request: MLBReportPreviewApiHandlerRequest,
): MLBReportPreviewApiHandlerResponse {
  if (typeof request !== 'object' || request === null) {
    return buildFailureResponse({} as MLBReportPreviewApiHandlerRequest, {
      code: 'INVALID_REQUEST',
      message: 'request must be an object.',
    });
  }

  if (request.source && request.source !== 'local-report-preview') {
    return buildFailureResponse(request, {
      code: 'INVALID_SOURCE',
      message: `handler source must be 'local-report-preview'.`,
    });
  }

  const reportPreview = request.reportPreview;

  if (!reportPreview) {
    return buildFailureResponse(request, {
      code: 'MISSING_REPORT_PREVIEW',
      message: 'reportPreview is required on request.',
    });
  }

  const prohibitedFields = MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS;
  const serialized = JSON.stringify(reportPreview);
  for (const field of prohibitedFields) {
    if (serialized.includes(`"${field}"`)) {
      return buildFailureResponse(request, {
        code: 'PROHIBITED_FIELD',
        message: `Response must not contain field: ${field}.`,
        path: 'reportPreview',
      });
    }
  }

  const badStrings = collectBadStrings(reportPreview);
  if (badStrings.length) {
    return buildFailureResponse(request, {
      code: 'PROHIBITED_VALUE_TEXT',
      message: `Disallowed restricted term found in reportPreview string: ${badStrings[0]}`,
    });
  }

  const apiResponse = buildMLBReportPreviewApiResponseFromRenderedReport(
    reportPreview,
  );
  const validation = validateMLBReportPreviewApiResponse(apiResponse);
  if (!validation.ok) {
    const first = validation.errors[0];
    return buildFailureResponse(request, {
      code: first.code,
      message: first.message,
      path: first.path,
    });
  }

  return buildSuccessResponse(request, reportPreview);
}

export function assertMLBReportPreviewApiHandlerSuccess(
  response: MLBReportPreviewApiHandlerResponse,
): asserts response is MLBReportPreviewApiHandlerSuccess {
  if (response.ok === false) {
    const error = response.error;
    throw new Error(
      `MLB_REPORT_PREVIEW_API_HANDLER response failed: ${error.code} — ${error.message}`,
    );
  }
}
