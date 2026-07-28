import type {
  MLBReportPreviewUIViewModel,
  MLBReportPreviewUIHeader,
  MLBReportPreviewUISafetyBanner,
  MLBReportPreviewUISection,
  MLBReportPreviewUIGameCard,
  MLBReportPreviewUIGameDetail,
  MLBReportPreviewUIWarning,
  MLBReportPreviewUIMetadata,
} from './report-preview-ui-view-model';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  assertMLBReportPreviewUIViewModel,
} from './report-preview-ui-view-model';

export const MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME =
  'MLB_REPORT_PREVIEW_UI_PRESENTATION';
export const MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION =
  'mlb-report-preview-ui-presentation-v1';

export interface MLBReportPreviewUIHeaderPresentation
  extends MLBReportPreviewUIHeader {}

export interface MLBReportPreviewUIMetadataPresentation {
  readonly handlerVersion: string;
  readonly contractVersion: string;
  readonly rendererVersion: string;
  readonly adapterVersion: string;
  readonly deterministic: true;
  readonly source: 'local-report-preview';
  readonly generatedAt: string | null;
}

export interface MLBReportPreviewUISectionPresentation {
  readonly heading: string;
  readonly body: readonly string[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUISectionListPresentation {
  readonly sections: readonly MLBReportPreviewUISectionPresentation[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIGameCardPresentation {
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

export interface MLBReportPreviewUIGameCardListPresentation {
  readonly gameCards: readonly MLBReportPreviewUIGameCardPresentation[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIGameDetailPresentation {
  readonly gameId: string;
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

export interface MLBReportPreviewUIGameDetailListPresentation {
  readonly gameDetails: readonly MLBReportPreviewUIGameDetailPresentation[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIWarningPresentation {
  readonly code: string;
  readonly message: string;
}

export interface MLBReportPreviewUIWarningsPresentation {
  readonly warnings: readonly MLBReportPreviewUIWarningPresentation[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUILimitationsPresentation {
  readonly heading: 'Limitations';
  readonly notes: readonly string[];
}

export interface MLBReportPreviewUIPresentation {
  readonly name: typeof MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME;
  readonly version: typeof MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION;
  readonly title: string;
  readonly header: MLBReportPreviewUIHeaderPresentation;
  readonly metadata: MLBReportPreviewUIMetadataPresentation;
  readonly sections: MLBReportPreviewUISectionListPresentation;
  readonly gameCards: MLBReportPreviewUIGameCardListPresentation;
  readonly gameDetails: MLBReportPreviewUIGameDetailListPresentation;
  readonly warnings: MLBReportPreviewUIWarningsPresentation;
  readonly limitations: MLBReportPreviewUILimitationsPresentation;
}

export const EMPTY_SECTION_BODY: readonly string[] = [
  'No content available for this section.',
];

export const EMPTY_SECTIONS: MLBReportPreviewUISectionListPresentation = {
  sections: [],
  emptyState: 'No sections available.',
};

export const EMPTY_GAME_CARDS: MLBReportPreviewUIGameCardListPresentation = {
  gameCards: [],
  emptyState: 'No game cards available.',
};

export const EMPTY_GAME_DETAILS: MLBReportPreviewUIGameDetailListPresentation = {
  gameDetails: [],
  emptyState: 'No game details available.',
};

export const EMPTY_WARNINGS: MLBReportPreviewUIWarningsPresentation = {
  warnings: [],
  emptyState: null,
};

export const EMPTY_LIMITATIONS_NOTES: readonly string[] = [
  'No limitations recorded.',
];

const PRESENTATION_FORBIDDEN_KEYS = new Set<string>([
  'apiResponse',
  'reportPreview',
  'contractName',
  'ok',
  'error',
  'researchPackage',
  'historicalFixtures',
  'raw',
  'payload',
  'viewModel',
  'sourceModel',
]);

function collectProhibitedKeyMatches(
  value: unknown,
): string[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const matches: string[] = [];
  for (const field of PRESENTATION_FORBIDDEN_KEYS) {
    if (serialized.includes(`"${field}"`)) {
      matches.push(field);
    }
  }
  return Array.from(new Set(matches));
}

export interface MLBReportPreviewUIPresentationValidationError {
  readonly code: string;
  readonly message: string;
}

export function validateMLBReportPreviewUIPresentation(
  value: unknown,
):
  | { readonly ok: true; readonly errors: readonly [] }
  | {
      readonly ok: false;
      readonly errors: readonly MLBReportPreviewUIPresentationValidationError[];
    } {
  const errors: MLBReportPreviewUIPresentationValidationError[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        { code: 'INVALID_TYPE', message: 'Expected object for UI presentation.' },
      ],
    };
  }

  const obj = value as Record<string, unknown>;

  if (obj.name !== MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME) {
    errors.push({
      code: 'WRONG_NAME',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME}.`,
    });
  }

  if (obj.version !== MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION) {
    errors.push({
      code: 'WRONG_VERSION',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION}.`,
    });
  }

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    errors.push({ code: 'MISSING_TITLE', message: 'title is required.' });
  }

  const header = obj.header as Record<string, unknown> | undefined;
  if (!header || typeof header !== 'object') {
    errors.push({ code: 'MISSING_HEADER', message: 'header is required.' });
  } else {
    if (typeof header.title !== 'string' || header.title.length === 0) {
      errors.push({ code: 'MISSING_HEADER_TITLE', message: 'header.title is required.' });
    }
    if (typeof header.subtitle !== 'string' || header.subtitle.length === 0) {
      errors.push({ code: 'MISSING_HEADER_SUBTITLE', message: 'header.subtitle is required.' });
    }
    if (typeof header.generatedAtLabel !== 'string' || header.generatedAtLabel.length === 0) {
      errors.push({
        code: 'MISSING_HEADER_GENERATED_AT_LABEL',
        message: 'header.generatedAtLabel is required.',
      });
    }
    if (typeof header.sourceLabel !== 'string' || header.sourceLabel.length === 0) {
      errors.push({
        code: 'MISSING_HEADER_SOURCE_LABEL',
        message: 'header.sourceLabel is required.',
      });
    }
  }

  const metadata = obj.metadata as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata !== 'object') {
    errors.push({ code: 'MISSING_METADATA', message: 'metadata is required.' });
  } else {
    if (typeof metadata.handlerVersion !== 'string' || metadata.handlerVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_HANDLER_VERSION',
        message: 'metadata.handlerVersion is required.',
      });
    }
    if (typeof metadata.contractVersion !== 'string' || metadata.contractVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_CONTRACT_VERSION',
        message: 'metadata.contractVersion is required.',
      });
    }
    if (typeof metadata.rendererVersion !== 'string' || metadata.rendererVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_RENDERER_VERSION',
        message: 'metadata.rendererVersion is required.',
      });
    }
    if (typeof metadata.adapterVersion !== 'string' || metadata.adapterVersion.length === 0) {
      errors.push({
        code: 'MISSING_METADATA_ADAPTER_VERSION',
        message: 'metadata.adapterVersion is required.',
      });
    }
    if (metadata.generatedAt !== null && typeof metadata.generatedAt !== 'string') {
      errors.push({
        code: 'INVALID_METADATA_GENERATED_AT',
        message: 'metadata.generatedAt must be string or null.',
      });
    }
    if (metadata.source !== 'local-report-preview') {
      errors.push({
        code: 'INVALID_SOURCE',
        message: 'metadata.source must be local-report-preview.',
      });
    }
    if (metadata.deterministic !== true) {
      errors.push({
        code: 'INVALID_DETERMINISTIC',
        message: 'metadata.deterministic must be true.',
      });
    }
  }

  const sections = obj.sections as Record<string, unknown> | undefined;
  if (!sections || typeof sections !== 'object') {
    errors.push({ code: 'MISSING_SECTIONS', message: 'sections is required.' });
  } else if (!Array.isArray(sections.sections)) {
    errors.push({ code: 'INVALID_SECTIONS', message: 'sections.sections must be an array.' });
  } else if (sections.emptyState !== null && typeof sections.emptyState !== 'string') {
    errors.push({
      code: 'INVALID_SECTIONS_EMPTY_STATE',
      message: 'sections.emptyState must be a string or null.',
    });
  } else {
    for (let i = 0; i < sections.sections.length; i++) {
      const s = sections.sections[i] as Record<string, unknown> | undefined;
      if (!s || typeof s !== 'object') {
        errors.push({
          code: 'INVALID_SECTION_ENTRY',
          message: 'section entry must be an object.',
        });
      } else {
        if (typeof s.heading !== 'string' || s.heading.length === 0) {
          errors.push({ code: 'MISSING_SECTION_HEADING', message: 'section.heading is required.' });
        }
        if (!Array.isArray(s.body)) {
          errors.push({ code: 'INVALID_SECTION_BODY', message: 'section.body must be an array.' });
        }
        if (s.emptyState !== null && typeof s.emptyState !== 'string') {
          errors.push({
            code: 'INVALID_SECTION_EMPTY_STATE',
            message: 'section.emptyState must be a string or null.',
          });
        }
      }
    }
  }

  const gameCards = obj.gameCards as Record<string, unknown> | undefined;
  if (!gameCards || typeof gameCards !== 'object') {
    errors.push({ code: 'MISSING_GAME_CARDS', message: 'gameCards is required.' });
  } else if (!Array.isArray(gameCards.gameCards)) {
    errors.push({ code: 'INVALID_GAME_CARDS', message: 'gameCards.gameCards must be an array.' });
  } else if (gameCards.emptyState !== null && typeof gameCards.emptyState !== 'string') {
    errors.push({
      code: 'INVALID_GAME_CARDS_EMPTY_STATE',
      message: 'gameCards.emptyState must be a string or null.',
    });
  } else {
    for (let i = 0; i < gameCards.gameCards.length; i++) {
      const card = gameCards.gameCards[i] as Record<string, unknown> | undefined;
      if (!card || typeof card !== 'object') {
        errors.push({
          code: 'INVALID_GAME_CARD_ENTRY',
          message: 'game card entry must be an object.',
        });
      } else {
        if (typeof card.gameId !== 'string' || card.gameId.length === 0) {
          errors.push({ code: 'MISSING_GAME_ID', message: 'gameId is required.' });
        }
      }
    }
  }

  const gameDetails = obj.gameDetails as Record<string, unknown> | undefined;
  if (!gameDetails || typeof gameDetails !== 'object') {
    errors.push({ code: 'MISSING_GAME_DETAILS', message: 'gameDetails is required.' });
  } else if (!Array.isArray(gameDetails.gameDetails)) {
    errors.push({
      code: 'INVALID_GAME_DETAILS',
      message: 'gameDetails.gameDetails must be an array.',
    });
  } else if (gameDetails.emptyState !== null && typeof gameDetails.emptyState !== 'string') {
    errors.push({
      code: 'INVALID_GAME_DETAILS_EMPTY_STATE',
      message: 'gameDetails.emptyState must be a string or null.',
    });
  } else {
    for (let i = 0; i < gameDetails.gameDetails.length; i++) {
      const detail = gameDetails.gameDetails[i] as Record<string, unknown> | undefined;
      if (!detail || typeof detail !== 'object') {
        errors.push({
          code: 'INVALID_GAME_DETAIL_ENTRY',
          message: 'game detail entry must be an object.',
        });
      } else {
        if (typeof detail.heading !== 'string' || detail.heading.length === 0) {
          errors.push({
            code: 'MISSING_GAME_DETAIL_HEADING',
            message: 'gameDetails[].heading is required.',
          });
        }
      }
    }
  }

  if (
    Array.isArray(gameCards?.gameCards) &&
    Array.isArray(gameDetails?.gameDetails) &&
    gameCards.gameCards.length !== gameDetails.gameDetails.length
  ) {
    errors.push({
      code: 'GAME_CARD_DETAIL_COUNT_MISMATCH',
      message: 'gameCards and gameDetails must have the same length.',
    });
  }

  const warnings = obj.warnings as Record<string, unknown> | undefined;
  if (!warnings || typeof warnings !== 'object') {
    errors.push({ code: 'MISSING_WARNINGS', message: 'warnings is required.' });
  } else if (!Array.isArray(warnings.warnings)) {
    errors.push({ code: 'INVALID_WARNINGS', message: 'warnings.warnings must be an array.' });
  } else if (warnings.emptyState !== null && typeof warnings.emptyState !== 'string') {
    errors.push({
      code: 'INVALID_WARNINGS_EMPTY_STATE',
      message: 'warnings.emptyState must be a string or null.',
    });
  } else {
    for (let i = 0; i < warnings.warnings.length; i++) {
      const w = warnings.warnings[i] as Record<string, unknown> | undefined;
      if (!w || typeof w !== 'object') {
        errors.push({
          code: 'INVALID_WARNING_ENTRY',
          message: 'warning entry must be an object.',
        });
      } else {
        if (typeof w.code !== 'string' || w.code.length === 0) {
          errors.push({ code: 'MISSING_WARNING_CODE', message: 'warning.code is required.' });
        }
        if (typeof w.message !== 'string' || w.message.length === 0) {
          errors.push({ code: 'MISSING_WARNING_MESSAGE', message: 'warning.message is required.' });
        }
      }
    }
  }

  const limitations = obj.limitations as Record<string, unknown> | undefined;
  if (!limitations || typeof limitations !== 'object') {
    errors.push({ code: 'MISSING_LIMITATIONS', message: 'limitations is required.' });
  } else {
    if (limitations.heading !== 'Limitations') {
      errors.push({
        code: 'WRONG_LIMITATIONS_HEADING',
        message: 'limitations.heading must be "Limitations".',
      });
    }
    if (!Array.isArray(limitations.notes)) {
      errors.push({ code: 'INVALID_LIMITATIONS_NOTES', message: 'limitations.notes must be an array.' });
    }
  }

  const prohibitedKeys = collectProhibitedKeyMatches(value);
  for (const key of prohibitedKeys) {
    errors.push({
      code: 'PROHIBITED_FIELD',
      message: `Response must not contain field: ${key}.`,
    });
  }

  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  return { ok: true as const, errors: [] };
}

export function assertMLBReportPreviewUIPresentation(
  value: unknown,
): asserts value is MLBReportPreviewUIPresentation {
  const result = validateMLBReportPreviewUIPresentation(value);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `MLB_REPORT_PREVIEW_UI_PRESENTATION validation failed: ${first.code} — ${first.message}`,
    );
  }
}

function mapHeader(header: MLBReportPreviewUIHeader): MLBReportPreviewUIHeaderPresentation {
  return {
    title: header.title,
    subtitle: header.subtitle,
    generatedAtLabel: header.generatedAtLabel,
    sourceLabel: header.sourceLabel,
  };
}

function mapMetadata(metadata: MLBReportPreviewUIMetadata): MLBReportPreviewUIMetadataPresentation {
  return {
    handlerVersion: metadata.handlerVersion,
    contractVersion: metadata.contractVersion,
    rendererVersion: metadata.rendererVersion,
    adapterVersion: metadata.adapterVersion,
    deterministic: true as const,
    source: 'local-report-preview',
    generatedAt: metadata.generatedAt,
  };
}

const EMPTY_SECTION_BODY_TEXT = 'No content available for this section.';

function mapSection(section: MLBReportPreviewUISection): MLBReportPreviewUISectionPresentation {
  if (section.body.length === 0) {
    return {
      heading: section.heading,
      body: EMPTY_SECTION_BODY,
      emptyState: EMPTY_SECTION_BODY_TEXT,
    };
  }
  return {
    heading: section.heading,
    body: section.body,
    emptyState: null,
  };
}

function mapCard(card: MLBReportPreviewUIGameCard): MLBReportPreviewUIGameCardPresentation {
  return {
    gameId: card.gameId,
    heading: card.heading,
    officialDate: card.officialDate,
    scheduledStartTime: card.scheduledStartTime,
    moduleSummary: card.moduleSummary,
    dataQualityLabel: card.dataQualityLabel,
    confidenceLabel: card.confidenceLabel,
    researchStrengthLabel: card.researchStrengthLabel,
    warningSummary: card.warningSummary,
    scheduleContextSummary: card.scheduleContextSummary,
    teamQualityContextSummary: card.teamQualityContextSummary,
  };
}

function mapDetail(
  detail: MLBReportPreviewUIGameDetail,
  card: MLBReportPreviewUIGameCard,
): MLBReportPreviewUIGameDetailPresentation {
  return {
    gameId: card.gameId,
    heading: detail.heading,
    availableResearchModules: detail.availableResearchModules,
    teamRecentFormSummary: detail.teamRecentFormSummary,
    scheduleContextSummary: detail.scheduleContextSummary,
    teamQualityContextSummary: detail.teamQualityContextSummary,
    warnings: detail.warnings,
    dataQualityExplanation: detail.dataQualityExplanation,
    evidenceLimitations: detail.evidenceLimitations,
    technicalMetadataSummary: detail.technicalMetadataSummary,
  };
}

export function buildMLBReportPreviewUIPresentation(
  viewModel: MLBReportPreviewUIViewModel,
): MLBReportPreviewUIPresentation {
  assertMLBReportPreviewUIViewModel(viewModel);

  const sections: MLBReportPreviewUISectionListPresentation = {
    sections: viewModel.sections.map(mapSection),
    emptyState: viewModel.sections.length === 0 ? 'No sections available.' : null,
  };

  const gameCards: MLBReportPreviewUIGameCardListPresentation = {
    gameCards: viewModel.gameCards.map(mapCard),
    emptyState: viewModel.gameCards.length === 0 ? 'No game cards available.' : null,
  };

  const gameDetails: MLBReportPreviewUIGameDetailListPresentation = {
    gameDetails: viewModel.gameDetails.map((detail, index) =>
      mapDetail(detail, viewModel.gameCards[index]),
    ),
    emptyState: viewModel.gameDetails.length === 0 ? 'No game details available.' : null,
  };

  const warnings: MLBReportPreviewUIWarningsPresentation = {
    warnings: viewModel.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
    })),
    emptyState: null,
  };

  const limitations: MLBReportPreviewUILimitationsPresentation = {
    heading: 'Limitations',
    notes: viewModel.safetyBanner.notes,
  };

  return {
    name: MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
    version: MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
    title: viewModel.title,
    header: mapHeader(viewModel.header),
    metadata: mapMetadata(viewModel.metadata),
    sections,
    gameCards,
    gameDetails,
    warnings,
    limitations,
  };
}
