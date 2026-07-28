import type {
  MLBResearchRenderedReport,
} from './research-report-renderer';
import { MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS } from './research-report-renderer';

export const MLB_REPORT_PREVIEW_API_CONTRACT_VERSION = 'mlb-report-preview-api-contract-v1';
export const MLB_REPORT_PREVIEW_API_CONTRACT_NAME = 'MLB_REPORT_PREVIEW_API_CONTRACT';

export type DataQualityLabel =
  | 'insufficient'
  | 'partial'
  | 'usable'
  | 'not-evaluated';
export type ConfidenceLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ResearchStrengthLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ModuleAvailabilityStatus = 'available' | 'not-requested' | 'unavailable';
export type SourceMode = 'local-research-package';

export interface MLBReportPreviewApiSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface MLBReportPreviewApiGameCard {
  readonly heading: string;
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly moduleSummary: string;
  readonly dataQualitySummary: string;
  readonly confidenceSummary: string;
  readonly researchStrengthSummary: string;
  readonly warningSummary: string;
  readonly scheduleContextSummary: string;
  readonly teamQualityContextSummary: string;
}

export interface MLBReportPreviewApiGameDetail {
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

export interface MLBReportPreviewApiSafetyEnvelope {
  readonly localOnly: true;
  readonly reportPreviewOnly: true;
  readonly rawResearchPackageAllowed: false;
  readonly rawHistoricalFixturesAllowed: false;
  readonly liveDataAllowed: false;
  readonly bettingDataAllowed: false;
  readonly rawOutcomesAllowed: false;
  readonly pitcherEvidenceAllowed: false;
  readonly actualStartersAllowed: false;
  readonly probabilityClaimsAllowed: false;
}

export interface MLBReportPreviewApiReportPreviewMetadata {
  readonly contractVersion: typeof MLB_REPORT_PREVIEW_API_CONTRACT_VERSION;
  readonly rendererVersion: string;
  readonly adapterVersion: string;
  readonly generatedAt: string | null;
  readonly source: SourceMode;
  readonly deterministic: true;
}

export interface MLBReportPreviewApiReportPreview {
  readonly rendererVersion: string;
  readonly rendererName: string;
  readonly adapterVersion: string;
  readonly title: string;
  readonly sections: readonly MLBReportPreviewApiSection[];
  readonly gameCards: readonly MLBReportPreviewApiGameCard[];
  readonly gameDetails: readonly MLBReportPreviewApiGameDetail[];
  readonly safetyNotes: readonly string[];
  readonly metadata: MLBReportPreviewApiReportPreviewMetadata;
}

export interface MLBReportPreviewApiResponse {
  readonly contractVersion: typeof MLB_REPORT_PREVIEW_API_CONTRACT_VERSION;
  readonly contractName: typeof MLB_REPORT_PREVIEW_API_CONTRACT_NAME;
  readonly ok: true;
  readonly reportPreview: MLBReportPreviewApiReportPreview;
  readonly safety: MLBReportPreviewApiSafetyEnvelope;
  readonly metadata: MLBReportPreviewApiReportPreviewMetadata;
}

export interface MLBReportPreviewApiValidationResult {
  readonly ok: boolean;
  readonly errors: readonly MLBReportPreviewApiValidationError[];
}

export interface MLBReportPreviewApiValidationError {
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

const KNOWN_SAFE_STRING_EXACT_MATCHES = new Set<string>([
  'Local-only display; no live data included.',
  'No betting advice or recommendation language is rendered.',
  'Research labels are only descriptive evidence descriptors.',
  'Missing modules are shown as not-requested or unavailable.',
  'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
  'Report rendering is local-only and descriptive.',
  'No betting advice or recommendation language is included.',
  'Deterministic: true. Source: local-research-package. Generated at: null.',
]);

const RESTRICTED_VALUE_SUBSTRINGS = new Set<string>([
  'best bet',
  'projected score',
  'should win',
  'likely winner',
  'chance to win',
  'odds',
  'sportsbook',
  'market',
  'price',
  'edge',
  'roi',
  'impliedprobability',
  'probability',
  'winner',
  'favorite',
  'underdog',
  'pitcher',
  'modelprobability',
  'predictedwinner',
  'pick',
  'winchance',
  'powerrating',
  'teamrank',
  'standingsposition',
  'finalscore',
  'outcome',
  'completedgamestate',
  'finalstatus',
  'actualstartingpitchers',
]);

const MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS = new Set([
  ...MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS,
  'package',
  'researchPackageVersion',
  'researchRunId',
  'sourceConstructionRunId',
  'sourceConstructionLockId',
  'researchedAt',
  'sourceConstructedAt',
  'sourceLockedAt',
  'inputConstructionPackage',
  'inputSnapshot',
  'constructionVersion',
  'lockVersion',
  'evidence',
  'constructionMessages',
  'constructionWarnings',
]);

function collectProhibitedKeyMatches(value: unknown): string[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const matches: string[] = [];
  for (const field of MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS) {
    if (serialized.includes(`"${field}"`)) {
      matches.push(field);
    }
  }
  return matches;
}

function collectBadStrings(value: unknown, bad: string[] = []): string[] {
  if (typeof value === 'string') {
    if (!KNOWN_SAFE_STRING_EXACT_MATCHES.has(value)) {
      const lower = value.toLowerCase();
      for (const term of RESTRICTED_VALUE_SUBSTRINGS) {
        if (lower.includes(term)) {
          return [...bad, value.slice(0, 80)];
        }
      }
    }
    return bad;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const next = collectBadStrings(item, bad);
      if (next.length) return next;
    }
    return bad;
  }
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      const next = collectBadStrings(child, bad);
      if (next.length) return next;
    }
  }
  return bad;
}

export function validateMLBReportPreviewApiResponse(
  value: unknown,
): MLBReportPreviewApiValidationResult {
  const errors: MLBReportPreviewApiValidationError[] = [];

  if (typeof value !== 'object' || value === null) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_TYPE', message: 'Expected object for API response.' }],
    };
  }

  const obj = value as Record<string, unknown>;

  if (obj.contractVersion !== MLB_REPORT_PREVIEW_API_CONTRACT_VERSION) {
    errors.push({
      code: 'WRONG_CONTRACT_VERSION',
      path: 'contractVersion',
      message: `Expected ${MLB_REPORT_PREVIEW_API_CONTRACT_VERSION}.`,
    });
  }

  if (obj.contractName !== MLB_REPORT_PREVIEW_API_CONTRACT_NAME) {
    errors.push({
      code: 'WRONG_CONTRACT_NAME',
      path: 'contractName',
      message: `Expected ${MLB_REPORT_PREVIEW_API_CONTRACT_NAME}.`,
    });
  }

  if (obj.ok !== true) {
    errors.push({ code: 'NOT_OK', message: 'Response ok flag must be true.' });
  }

  const reportPreview = obj.reportPreview;
  if (typeof reportPreview !== 'object' || reportPreview === null) {
    errors.push({
      code: 'MISSING_REPORT_PREVIEW',
      path: 'reportPreview',
      message: 'reportPreview is required.',
    });
  } else {
    const rp = reportPreview as Record<string, unknown>;

    const requiredKeys: readonly (keyof MLBReportPreviewApiReportPreview)[] = [
      'rendererVersion',
      'rendererName',
      'adapterVersion',
      'title',
      'sections',
      'gameCards',
      'gameDetails',
      'safetyNotes',
      'metadata',
    ];
    for (const key of requiredKeys) {
      if (!(key in rp)) {
        errors.push({
          code: 'MISSING_REPORT_PREVIEW_KEY',
          path: `reportPreview.${String(key)}`,
          message: `Missing required reportPreview key: ${String(key)}.`,
        });
      }
    }

    if (typeof rp.metadata === 'object' && rp.metadata !== null) {
      const meta = rp.metadata as Record<string, unknown>;
      if (meta.deterministic !== true) {
        errors.push({
          code: 'INVALID_DETERMINISTIC',
          path: 'reportPreview.metadata.deterministic',
          message: 'reportPreview metadata deterministic must be true.',
        });
      }
      if (meta.source !== 'local-research-package') {
        errors.push({
          code: 'INVALID_SOURCE',
          path: 'reportPreview.metadata.source',
          message: 'reportPreview metadata source must be local-research-package.',
        });
      }
      if (meta.generatedAt !== null) {
        errors.push({
          code: 'INVALID_GENERATED_AT',
          path: 'reportPreview.metadata.generatedAt',
          message: 'reportPreview metadata generatedAt must be null.',
        });
      }
    }

    const sections = rp.sections;
    const gameCards = rp.gameCards;
    const gameDetails = rp.gameDetails;
    if (!Array.isArray(sections) || sections.length === 0) {
      errors.push({
        code: 'INVALID_SECTIONS',
        path: 'reportPreview.sections',
        message: 'sections must be a non-empty array.',
      });
    }
    if (!Array.isArray(gameCards)) {
      errors.push({
        code: 'INVALID_GAME_CARDS',
        path: 'reportPreview.gameCards',
        message: 'gameCards must be an array.',
      });
    }
    if (!Array.isArray(gameDetails)) {
      errors.push({
        code: 'INVALID_GAME_DETAILS',
        path: 'reportPreview.gameDetails',
        message: 'gameDetails must be an array.',
      });
    }
    if (Array.isArray(gameCards) && Array.isArray(gameDetails) && gameCards.length !== gameDetails.length) {
      errors.push({
        code: 'GAME_CARD_DETAIL_COUNT_MISMATCH',
        message: 'gameCards and gameDetails must have the same length.',
      });
    }

    const prohibitedFields = collectProhibitedKeyMatches(reportPreview);
    if (prohibitedFields.length) {
      for (const field of prohibitedFields) {
        errors.push({
          code: 'PROHIBITED_FIELD',
          path: 'reportPreview',
          message: `Response must not contain field: ${field}.`,
        });
      }
    }

    const badStrings = collectBadStrings(reportPreview);
    if (badStrings.length) {
      errors.push({
        code: 'PROHIBITED_VALUE_TEXT',
        message: `Disallowed restricted term found in reportPreview string: ${badStrings[0]}`,
      });
    }

    const topLevelBadStrings = collectBadStrings({
      contractVersion: obj.contractVersion,
      contractName: obj.contractName,
      ok: obj.ok,
      safety: obj.safety,
      metadata: obj.metadata,
    });
    if (topLevelBadStrings.length) {
      errors.push({
        code: 'PROHIBITED_VALUE_TEXT',
        message: `Disallowed restricted term found outside reportPreview: ${topLevelBadStrings[0]}`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertMLBReportPreviewApiResponse(value: unknown): asserts value is MLBReportPreviewApiResponse {
  const result = validateMLBReportPreviewApiResponse(value);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `MLB_REPORT_PREVIEW_API_CONTRACT validation failed: ${first.code} — ${first.message}`,
    );
  }
}

export function buildMLBReportPreviewApiResponseFromRenderedReport(
  rendered: MLBResearchRenderedReport,
): MLBReportPreviewApiResponse {
  const reportPreview: MLBReportPreviewApiReportPreview = {
    rendererVersion: rendered.rendererVersion,
    rendererName: rendered.rendererName,
    adapterVersion: rendered.adapterVersion,
    title: rendered.title,
    sections: rendered.sections,
    gameCards: rendered.gameCards,
    gameDetails: rendered.gameDetails,
    safetyNotes: rendered.safetyNotes,
    metadata: {
      contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
      rendererVersion: rendered.metadata.rendererVersion,
      adapterVersion: rendered.metadata.adapterVersion,
      generatedAt: rendered.metadata.generatedAt,
      source: rendered.metadata.source,
      deterministic: rendered.metadata.deterministic,
    },
  };

  return {
    contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
    contractName: MLB_REPORT_PREVIEW_API_CONTRACT_NAME,
    ok: true,
    reportPreview,
    safety: {
      localOnly: true,
      reportPreviewOnly: true,
      rawResearchPackageAllowed: false,
      rawHistoricalFixturesAllowed: false,
      liveDataAllowed: false,
      bettingDataAllowed: false,
      rawOutcomesAllowed: false,
      pitcherEvidenceAllowed: false,
      actualStartersAllowed: false,
      probabilityClaimsAllowed: false,
    },
    metadata: {
      contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
      rendererVersion: rendered.metadata.rendererVersion,
      adapterVersion: rendered.metadata.adapterVersion,
      generatedAt: rendered.metadata.generatedAt,
      source: rendered.metadata.source,
      deterministic: rendered.metadata.deterministic,
    },
  };
}
