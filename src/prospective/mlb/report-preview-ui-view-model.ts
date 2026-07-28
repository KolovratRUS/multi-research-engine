import type {
  MLBReportPreviewApiHandlerSuccess,
  MLBReportPreviewApiHandlerFailure,
} from './report-preview-api-handler';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS,
  collectProhibitedKeyMatches,
  collectBadStrings,
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
} from './report-preview-api-contract';

export const MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION =
  'mlb-report-preview-ui-view-model-v1';
export const MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME =
  'MLB_REPORT_PREVIEW_UI_VIEW_MODEL';

export type MLBReportPreviewUIViewModelValidationResult =
  | {
      readonly ok: true;
      readonly errors: readonly [];
    }
  | {
      readonly ok: false;
      readonly errors: readonly MLBReportPreviewUIViewModelValidationError[];
    };

export interface MLBReportPreviewUIViewModelValidationError {
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

export interface MLBReportPreviewUIHeader {
  readonly title: string;
  readonly subtitle: 'Research preview';
  readonly generatedAtLabel: 'Local deterministic preview' | string;
  readonly sourceLabel: 'Local report preview';
}

export interface MLBReportPreviewUISafetyBanner {
  readonly heading: 'Limitations';
  readonly notes: readonly string[];
}

export interface MLBReportPreviewUISection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface MLBReportPreviewUIGameCard {
  readonly gameId: string;
  readonly heading: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly moduleSummary: string;
  readonly dataQualityLabel: string;
  readonly confidenceLabel: string;
  readonly researchStrengthLabel: string;
  readonly warningSummary: string;
  readonly scheduleContextSummary: string;
  readonly teamQualityContextSummary: string;
}

export interface MLBReportPreviewUIGameDetail {
  readonly heading: string;
  readonly availableResearchModules: string;
  readonly teamRecentFormSummary: string;
  readonly scheduleContextSummary: string;
  readonly teamQualityContextSummary: string;
  readonly warnings: string;
  readonly dataQualityExplanation: string;
  readonly evidenceLimitations: string;
  readonly technicalMetadataSummary: string;
}

export interface MLBReportPreviewUIModuleAvailability {
  readonly heading: string;
  readonly modules: readonly string[];
}

export interface MLBReportPreviewUIWarning {
  readonly code: string;
  readonly message: string;
}

export interface MLBReportPreviewUIMetadata {
  readonly viewModelVersion: typeof MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION;
  readonly handlerVersion: string;
  readonly contractVersion: typeof MLB_REPORT_PREVIEW_API_CONTRACT_VERSION;
  readonly rendererVersion: string;
  readonly adapterVersion: string;
  readonly generatedAt: string | null;
  readonly source: 'local-report-preview';
  readonly deterministic: true;
}

export interface MLBReportPreviewUIViewModel {
  readonly viewModelVersion: typeof MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION;
  readonly viewModelName: typeof MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME;
  readonly title: string;
  readonly header: MLBReportPreviewUIHeader;
  readonly safetyBanner: MLBReportPreviewUISafetyBanner;
  readonly sections: readonly MLBReportPreviewUISection[];
  readonly gameCards: readonly MLBReportPreviewUIGameCard[];
  readonly gameDetails: readonly MLBReportPreviewUIGameDetail[];
  readonly moduleAvailability: MLBReportPreviewUIModuleAvailability;
  readonly warnings: readonly MLBReportPreviewUIWarning[];
  readonly metadata: MLBReportPreviewUIMetadata;
}

const VIEW_MODEL_FORBIDDEN_KEYS = new Set<string>([
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
]);

const VIEW_MODEL_UNSAFE_SUBSTRINGS = new Set<string>([
  'best bet',
  'projected score',
  'should win',
  'likely winner',
  'chance to win',
  'win probability',
  'market edge',
  'sportsbook price',
  'power ranking',
  'team ranking',
  'favorite',
  'favourite',
  'underdog',
  'roi',
]);

function checkProhibitedKeys(
  value: unknown,
  path = 'viewModel',
): MLBReportPreviewUIViewModelValidationError[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const matches: string[] = [];
  for (const field of VIEW_MODEL_FORBIDDEN_KEYS) {
    if (serialized.includes(`"${field}"`)) {
      matches.push(field);
    }
  }
  return Array.from(new Set(matches)).map((key) => ({
    code: 'PROHIBITED_FIELD',
    path,
    message: `Response must not contain field: ${key}.`,
  }));
}

function buildUnsafePattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

function checkUnsafeStrings(
  value: unknown,
  path = 'viewModel',
): MLBReportPreviewUIViewModelValidationError[] {
  const serialized = JSON.stringify(value);
  const hits: string[] = [];
  const lower = serialized.toLowerCase();
  for (const term of VIEW_MODEL_UNSAFE_SUBSTRINGS) {
    if (buildUnsafePattern(term).test(lower)) {
      hits.push(term);
    }
  }

  if (hits.length === 0) {
    return [];
  }
  return [
    {
      code: 'PROHIBITED_VALUE_TEXT',
      path,
      message: `Disallowed restricted term found in view model: ${hits[0]}`,
    },
  ];
}

function validateViewModelShape(
  value: unknown,
): MLBReportPreviewUIViewModelValidationError[] {
  const errors: MLBReportPreviewUIViewModelValidationError[] = [];

  if (typeof value !== 'object' || value === null) {
    return [{ code: 'INVALID_TYPE', message: 'Expected object for UI view model.' }];
  }

  const obj = value as Record<string, unknown>;

  if (obj.viewModelVersion !== MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION) {
    errors.push({
      code: 'WRONG_VIEW_MODEL_VERSION',
      path: 'viewModelVersion',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION}.`,
    });
  }

  if (obj.viewModelName !== MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME) {
    errors.push({
      code: 'WRONG_VIEW_MODEL_NAME',
      path: 'viewModelName',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME}.`,
    });
  }

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    errors.push({
      code: 'MISSING_TITLE',
      path: 'title',
      message: 'title is required.',
    });
  }

  const header = obj.header as Record<string, unknown> | undefined;
  if (!header || typeof header !== 'object') {
    errors.push({
      code: 'MISSING_HEADER',
      path: 'header',
      message: 'header is required.',
    });
  } else {
    if (typeof header.title !== 'string' || header.title.length === 0) {
      errors.push({
        code: 'MISSING_HEADER_TITLE',
        path: 'header.title',
        message: 'header.title is required.',
      });
    }
    if (header.subtitle !== 'Research preview') {
      errors.push({
        code: 'WRONG_SUBTITLE',
        path: 'header.subtitle',
        message: 'header.subtitle must be "Research preview".',
      });
    }
    if (
      header.sourceLabel !== 'Local report preview'
    ) {
      errors.push({
        code: 'WRONG_SOURCE_LABEL',
        path: 'header.sourceLabel',
        message: 'header.sourceLabel must be "Local report preview".',
      });
    }
  }

  const safetyBanner = obj.safetyBanner as Record<string, unknown> | undefined;
  if (!safetyBanner || typeof safetyBanner !== 'object') {
    errors.push({
      code: 'MISSING_SAFETY_BANNER',
      path: 'safetyBanner',
      message: 'safetyBanner is required.',
    });
  } else {
    if (safetyBanner.heading !== 'Limitations') {
      errors.push({
        code: 'WRONG_SAFETY_HEADING',
        path: 'safetyBanner.heading',
        message: 'safetyBanner.heading must be "Limitations".',
      });
    }
    if (!Array.isArray(safetyBanner.notes)) {
      errors.push({
        code: 'INVALID_SAFETY_NOTES',
        path: 'safetyBanner.notes',
        message: 'safetyBanner.notes must be an array.',
      });
    }
  }

  if (!Array.isArray(obj.sections)) {
    errors.push({
      code: 'INVALID_SECTIONS',
      path: 'sections',
      message: 'sections must be an array.',
    });
  } else if (obj.sections.length === 0) {
    errors.push({
      code: 'EMPTY_SECTIONS',
      path: 'sections',
      message: 'sections must not be empty.',
    });
  }

  if (!Array.isArray(obj.gameCards)) {
    errors.push({
      code: 'INVALID_GAME_CARDS',
      path: 'gameCards',
      message: 'gameCards must be an array.',
    });
  }

  if (!Array.isArray(obj.gameDetails)) {
    errors.push({
      code: 'INVALID_GAME_DETAILS',
      path: 'gameDetails',
      message: 'gameDetails must be an array.',
    });
  }

  if (
    Array.isArray(obj.gameCards) &&
    Array.isArray(obj.gameDetails) &&
    obj.gameCards.length !== obj.gameDetails.length
  ) {
    errors.push({
      code: 'GAME_CARD_DETAIL_COUNT_MISMATCH',
      message: 'gameCards and gameDetails must have the same length.',
    });
  }

  if (Array.isArray(obj.sections)) {
    for (let i = 0; i < obj.sections.length; i++) {
      const section = obj.sections[i] as Record<string, unknown> | undefined;
      if (!section || typeof section !== 'object') {
        errors.push({
          code: 'INVALID_SECTION_ENTRY',
          path: `sections[${i}]`,
          message: 'section entry must be an object.',
        });
      } else {
        if (typeof section.heading !== 'string' || section.heading.length === 0) {
          errors.push({
            code: 'MISSING_SECTION_HEADING',
            path: `sections[${i}].heading`,
            message: 'section.heading is required.',
          });
        }
        if (!Array.isArray(section.body)) {
          errors.push({
            code: 'INVALID_SECTION_BODY',
            path: `sections[${i}].body`,
            message: 'section.body must be an array.',
          });
        }
      }
    }
  }

  if (Array.isArray(obj.gameCards)) {
    for (let i = 0; i < obj.gameCards.length; i++) {
      const card = obj.gameCards[i] as Record<string, unknown> | undefined;
      if (!card || typeof card !== 'object') {
        errors.push({
          code: 'INVALID_GAME_CARD_ENTRY',
          path: `gameCards[${i}]`,
          message: 'game card entry must be an object.',
        });
      } else {
        if (typeof card.gameId !== 'string' || card.gameId.length === 0) {
          errors.push({
            code: 'MISSING_GAME_CARD_GAME_ID',
            path: `gameCards[${i}].gameId`,
            message: 'gameCards[].gameId is required.',
          });
        }
        if (typeof card.officialDate !== 'string' || card.officialDate.length === 0) {
          errors.push({
            code: 'INVALID_GAME_CARD_OFFICIAL_DATE',
            path: `gameCards[${i}].officialDate`,
            message: 'gameCards[].officialDate is required.',
          });
        }
        if (typeof card.scheduledStartTime !== 'string' || card.scheduledStartTime.length === 0) {
          errors.push({
            code: 'INVALID_GAME_CARD_SCHEDULED_START',
            path: `gameCards[${i}].scheduledStartTime`,
            message: 'gameCards[].scheduledStartTime is required.',
          });
        }
      }
    }
  }

  if (Array.isArray(obj.gameDetails)) {
    for (let i = 0; i < obj.gameDetails.length; i++) {
      const detail = obj.gameDetails[i] as Record<string, unknown> | undefined;
      if (!detail || typeof detail !== 'object') {
        errors.push({
          code: 'INVALID_GAME_DETAIL_ENTRY',
          path: `gameDetails[${i}]`,
          message: 'game detail entry must be an object.',
        });
      } else {
        if (typeof detail.heading !== 'string' || detail.heading.length === 0) {
          errors.push({
            code: 'MISSING_GAME_DETAIL_HEADING',
            path: `gameDetails[${i}].heading`,
            message: 'gameDetails[].heading is required.',
          });
        }
      }
    }
  }

  if (Array.isArray(obj.warnings)) {
    for (let i = 0; i < obj.warnings.length; i++) {
      const warning = obj.warnings[i] as Record<string, unknown> | undefined;
      if (!warning || typeof warning !== 'object') {
        errors.push({
          code: 'INVALID_WARNING_ENTRY',
          path: `warnings[${i}]`,
          message: 'warning entry must be an object.',
        });
      } else {
        if (typeof warning.code !== 'string' || warning.code.length === 0) {
          errors.push({
            code: 'MISSING_WARNING_CODE',
            path: `warnings[${i}].code`,
            message: 'warning.code is required.',
          });
        }
        if (typeof warning.message !== 'string' || warning.message.length === 0) {
          errors.push({
            code: 'MISSING_WARNING_MESSAGE',
            path: `warnings[${i}].message`,
            message: 'warning.message is required.',
          });
        }
      }
    }
  } else if (obj.warnings !== undefined) {
    errors.push({
      code: 'INVALID_WARNINGS',
      path: 'warnings',
      message: 'warnings must be an array.',
    });
  }

  const metadata = obj.metadata as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata !== 'object') {
    errors.push({
      code: 'MISSING_METADATA',
      path: 'metadata',
      message: 'metadata is required.',
    });
  } else {
    if (metadata.source !== 'local-report-preview') {
      errors.push({
        code: 'INVALID_SOURCE',
        path: 'metadata.source',
        message: 'metadata.source must be local-report-preview.',
      });
    }
    if (metadata.deterministic !== true) {
      errors.push({
        code: 'INVALID_DETERMINISTIC',
        path: 'metadata.deterministic',
        message: 'metadata.deterministic must be true.',
      });
    }
    if (typeof metadata.handlerVersion !== 'string' || metadata.handlerVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_HANDLER_VERSION',
        path: 'metadata.handlerVersion',
        message: 'metadata.handlerVersion is required.',
      });
    }
    if (typeof metadata.contractVersion !== 'string' || metadata.contractVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_CONTRACT_VERSION',
        path: 'metadata.contractVersion',
        message: 'metadata.contractVersion is required.',
      });
    }
    if (typeof metadata.rendererVersion !== 'string' || metadata.rendererVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_RENDERER_VERSION',
        path: 'metadata.rendererVersion',
        message: 'metadata.rendererVersion is required.',
      });
    }
    if (typeof metadata.adapterVersion !== 'string' || metadata.adapterVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_ADAPTER_VERSION',
        path: 'metadata.adapterVersion',
        message: 'metadata.adapterVersion is required.',
      });
    }
    if (typeof metadata.generatedAt !== 'string' && metadata.generatedAt !== null) {
      errors.push({
        code: 'MISSING_METADATA_GENERATED_AT',
        path: 'metadata.generatedAt',
        message: 'metadata.generatedAt is required.',
      });
    }
  }

  return errors;
}

export function validateMLBReportPreviewUIViewModel(
  value: unknown,
): MLBReportPreviewUIViewModelValidationResult {
  const errors: MLBReportPreviewUIViewModelValidationError[] = [];

  if (typeof value !== 'object' || value === null) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_TYPE', message: 'Expected object for UI view model.' }],
    };
  }

  const obj = value as Record<string, unknown>;

  if (obj.ok === false) {
    errors.push({
      code: 'HANDLER_FAILURE',
      path: 'ok',
      message: 'UI view model must not be built from handler failure response.',
    });
  }

  errors.push(...checkProhibitedKeys(value));
  errors.push(...checkUnsafeStrings(value));
  errors.push(...validateViewModelShape(value));

  if (errors.length > 0) {
    return {
      ok: false as const,
      errors: errors,
    };
  }

  return {
    ok: true as const,
    errors: [],
  };
}

export function assertMLBReportPreviewUIViewModel(
  value: unknown,
): asserts value is MLBReportPreviewUIViewModel {
  const result = validateMLBReportPreviewUIViewModel(value);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `MLB_REPORT_PREVIEW_UI_VIEW_MODEL validation failed: ${first.code} — ${first.message}`,
    );
  }
}

function buildModuleAvailability(
  reportPreview: Record<string, unknown>,
): MLBReportPreviewUIModuleAvailability {
  const modules = (reportPreview.researchModules ?? []) as Array<Record<string, unknown>>;
  const available = modules
    .filter((m) => m.status === 'completed')
    .map((m) => m.moduleName as string);

  return {
    heading: 'Module Availability',
    modules: available,
  };
}

function buildWarnings(
  reportPreview: Record<string, unknown>,
): MLBReportPreviewUIWarning[] {
  const warnings: MLBReportPreviewUIWarning[] = [];

  const researchWarnings = (reportPreview.researchWarnings ?? []) as string[];
  for (const warning of researchWarnings) {
    warnings.push({ code: warning, message: warning });
  }

  const gameWarnings = new Set<string>();
  const gameCards = (reportPreview.gameCards ?? []) as Array<Record<string, unknown>>;
  for (const card of gameCards) {
    const warningSummary = card.warningSummary as string | undefined;
    if (warningSummary) {
      for (const part of warningSummary.split('; ')) {
        if (part) {
          gameWarnings.add(part);
        }
      }
    }
  }

  for (const warning of gameWarnings) {
    if (!researchWarnings.includes(warning)) {
      warnings.push({ code: warning, message: warning });
    }
  }

  return warnings;
}

export function buildMLBReportPreviewUIViewModelFromHandlerSuccess(
  success: MLBReportPreviewApiHandlerSuccess,
): MLBReportPreviewUIViewModel {
  if (success.ok !== true) {
    throw new Error(
      'MLB_REPORT_PREVIEW_UI_VIEW_MODEL requires successful handler response.',
    );
  }

  const { apiResponse } = success;
  const reportPreview = apiResponse.reportPreview;
  const reportPreviewRecord = reportPreview as unknown as Record<string, unknown>;
  const metadata = reportPreview.metadata as unknown as Record<string, unknown>;

  const header: MLBReportPreviewUIHeader = {
    title: reportPreview.title,
    subtitle: 'Research preview',
    generatedAtLabel:
      metadata.generatedAt === null
        ? 'Local deterministic preview'
        : String(metadata.generatedAt ?? 'Local deterministic preview'),
    sourceLabel: 'Local report preview',
  };

  const safetyNotes = (reportPreview.safetyNotes ?? []) as string[];
  const requiredSafeNote =
    'No live schedule, odds, pitcher, or market data is included.';
  const notes = safetyNotes.includes(requiredSafeNote)
    ? safetyNotes
    : [requiredSafeNote, ...safetyNotes];

  const safetyBanner: MLBReportPreviewUISafetyBanner = {
    heading: 'Limitations',
    notes,
  };

  const sections: MLBReportPreviewUISection[] = (reportPreview.sections ?? []).map(
    (section) => ({
      heading: section.heading,
      body: section.body,
    }),
  );

  const gameCards: MLBReportPreviewUIGameCard[] = (reportPreview.gameCards ?? []).map(
    (card) => ({
      gameId: card.gameId,
      heading: card.heading,
      officialDate: card.officialDate,
      scheduledStartTime: card.scheduledStartTime,
      moduleSummary: card.moduleSummary,
      dataQualityLabel: card.dataQualitySummary,
      confidenceLabel: card.confidenceSummary,
      researchStrengthLabel: card.researchStrengthSummary,
      warningSummary: card.warningSummary,
      scheduleContextSummary: card.scheduleContextSummary,
      teamQualityContextSummary: card.teamQualityContextSummary,
    }),
  );

  const gameDetails: MLBReportPreviewUIGameDetail[] = (reportPreview.gameDetails ?? []).map(
    (detail) => ({
      heading: detail.heading,
      availableResearchModules: detail.availableResearchModules,
      teamRecentFormSummary: detail.teamRecentFormSummary,
      scheduleContextSummary: detail.scheduleContextSummary,
      teamQualityContextSummary: detail.teamQualityContextSummary,
      warnings: detail.warnings,
      dataQualityExplanation: detail.dataQualityExplanation,
      evidenceLimitations: detail.evidenceLimitations,
      technicalMetadataSummary: detail.technicalMetadataSummary,
    }),
  );

  const moduleAvailability = buildModuleAvailability(reportPreviewRecord);
  const warnings = buildWarnings(reportPreviewRecord);

  const viewModel: MLBReportPreviewUIViewModel = {
    viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
    viewModelName: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
    title: reportPreview.title,
    header,
    safetyBanner,
    sections,
    gameCards,
    gameDetails,
    moduleAvailability,
    warnings,
    metadata: {
      viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
      handlerVersion: success.metadata.handlerVersion,
      contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
      rendererVersion: reportPreview.metadata.rendererVersion,
      adapterVersion: reportPreview.metadata.adapterVersion,
      generatedAt: success.metadata.generatedAt,
      source: 'local-report-preview',
      deterministic: true,
    },
  };

  return viewModel;
}
