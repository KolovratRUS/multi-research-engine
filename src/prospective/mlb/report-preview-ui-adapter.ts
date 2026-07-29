import type {
  MLBReportPreviewUIPresentation,
  MLBReportPreviewUISectionPresentation,
  MLBReportPreviewUIGameCardPresentation,
  MLBReportPreviewUIGameDetailPresentation,
  MLBReportPreviewUIWarningPresentation,
} from './report-preview-ui-components';
import {
  MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
  MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
  assertMLBReportPreviewUIPresentation,
  EMPTY_SECTION_BODY,
  EMPTY_GAME_CARDS,
  EMPTY_GAME_DETAILS,
  EMPTY_WARNINGS,
} from './report-preview-ui-components';

export const MLB_REPORT_PREVIEW_UI_ADAPTER_NAME =
  'MLB_REPORT_PREVIEW_UI_ADAPTER';
export const MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION =
  'mlb-report-preview-ui-adapter-v1';

export const MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER = [
  'header',
  'metadata',
  'section-list',
  'game-card-list',
  'game-detail-list',
  'warnings',
  'limitations',
] as const;

export interface MLBReportPreviewUIAdapterHeaderNode {
  readonly kind: 'header';
  readonly title: string;
  readonly subtitle: string;
  readonly generatedAtLabel: string;
  readonly sourceLabel: string;
}

export interface MLBReportPreviewUIAdapterMetadataNode {
  readonly kind: 'metadata';
  readonly handlerVersion: string;
  readonly contractVersion: string;
  readonly rendererVersion: string;
  readonly adapterVersion: string;
  readonly deterministic: true;
  readonly source: 'local-report-preview';
  readonly generatedAt: string | null;
}

export interface MLBReportPreviewUIAdapterSectionListNode {
  readonly kind: 'section-list';
  readonly sections: readonly MLBReportPreviewUIAdapterSectionNode[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterSectionNode {
  readonly kind: 'section';
  readonly heading: string;
  readonly body: readonly string[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterGameCardListNode {
  readonly kind: 'game-card-list';
  readonly gameCards: readonly MLBReportPreviewUIAdapterGameCardNode[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterGameCardNode {
  readonly kind: 'game-card';
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

export interface MLBReportPreviewUIAdapterGameDetailListNode {
  readonly kind: 'game-detail-list';
  readonly gameDetails: readonly MLBReportPreviewUIAdapterGameDetailNode[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterGameDetailNode {
  readonly kind: 'game-detail';
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

export interface MLBReportPreviewUIAdapterWarningsNode {
  readonly kind: 'warnings';
  readonly warnings: readonly MLBReportPreviewUIAdapterWarningNode[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterWarningNode {
  readonly kind: 'warning';
  readonly code: string;
  readonly message: string;
}

export interface MLBReportPreviewUIAdapterLimitationsNode {
  readonly kind: 'limitations';
  readonly heading: 'Limitations';
  readonly notes: readonly string[];
}

export type MLBReportPreviewUIAdapterNode =
  | MLBReportPreviewUIAdapterHeaderNode
  | MLBReportPreviewUIAdapterMetadataNode
  | MLBReportPreviewUIAdapterSectionListNode
  | MLBReportPreviewUIAdapterGameCardListNode
  | MLBReportPreviewUIAdapterGameDetailListNode
  | MLBReportPreviewUIAdapterWarningsNode
  | MLBReportPreviewUIAdapterLimitationsNode;

export interface MLBReportPreviewUIAdapterDocument {
  readonly name: typeof MLB_REPORT_PREVIEW_UI_ADAPTER_NAME;
  readonly version: typeof MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION;
  readonly title: string;
  readonly nodes: readonly MLBReportPreviewUIAdapterNode[];
}

type AdapterNodeKind = (typeof MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER)[number];

const ADAPTER_FORBIDDEN_KEYS = new Set<string>([
  'apiResponse',
  'reportPreview',
  'viewModel',
  'presentation',
  'payload',
  'raw',
  'handlerResponse',
  'researchPackage',
  'historicalFixtures',
  'sourceModel',
  'className',
  'style',
  'dangerouslySetInnerHTML',
  'innerHTML',
  'onClick',
  'onPress',
  'onMouseOver',
  'onTouchStart',
  'href',
  'jsx',
  'tsx',
  'html',
  'css',
  'type',
  'props',
]);

function collectProhibitedKeyMatches(value: unknown): string[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const matches: string[] = [];
  for (const field of ADAPTER_FORBIDDEN_KEYS) {
    if (serialized.includes(`"${field}"`)) {
      matches.push(field);
    }
  }
  return Array.from(new Set(matches));
}

function mapHeader(
  header: MLBReportPreviewUIPresentation['header'],
): MLBReportPreviewUIAdapterHeaderNode {
  return {
    kind: 'header',
    title: header.title,
    subtitle: header.subtitle,
    generatedAtLabel: header.generatedAtLabel,
    sourceLabel: header.sourceLabel,
  };
}

function mapMetadata(
  metadata: MLBReportPreviewUIPresentation['metadata'],
): MLBReportPreviewUIAdapterMetadataNode {
  return {
    kind: 'metadata',
    handlerVersion: metadata.handlerVersion,
    contractVersion: metadata.contractVersion,
    rendererVersion: metadata.rendererVersion,
    adapterVersion: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
    deterministic: true,
    source: 'local-report-preview',
    generatedAt: metadata.generatedAt,
  };
}

function mapSection(
  section: MLBReportPreviewUISectionPresentation,
): MLBReportPreviewUIAdapterSectionNode {
  return {
    kind: 'section',
    heading: section.heading,
    body: section.body,
    emptyState: section.emptyState,
  };
}

function mapCard(
  card: MLBReportPreviewUIGameCardPresentation,
): MLBReportPreviewUIAdapterGameCardNode {
  return {
    kind: 'game-card',
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
  detail: MLBReportPreviewUIGameDetailPresentation,
  gameId: string,
): MLBReportPreviewUIAdapterGameDetailNode {
  return {
    kind: 'game-detail',
    gameId,
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

function mapWarning(
  warning: MLBReportPreviewUIWarningPresentation,
): MLBReportPreviewUIAdapterWarningNode {
  return {
    kind: 'warning',
    code: warning.code,
    message: warning.message,
  };
}

function mapLimitations(
  limitations: MLBReportPreviewUIPresentation['limitations'],
): MLBReportPreviewUIAdapterLimitationsNode {
  return {
    kind: 'limitations',
    heading: limitations.heading,
    notes: limitations.notes,
  };
}

export function buildMLBReportPreviewUIAdapterDocument(
  presentation: MLBReportPreviewUIPresentation,
): MLBReportPreviewUIAdapterDocument {
  assertMLBReportPreviewUIPresentation(presentation);

  const nodes: MLBReportPreviewUIAdapterNode[] = [];

  nodes.push(mapHeader(presentation.header));
  nodes.push(mapMetadata(presentation.metadata));

  nodes.push({
    kind: 'section-list',
    sections: presentation.sections.sections.map(mapSection),
    emptyState: presentation.sections.emptyState,
  } as MLBReportPreviewUIAdapterSectionListNode);

  nodes.push({
    kind: 'game-card-list',
    gameCards: presentation.gameCards.gameCards.map(mapCard),
    emptyState: presentation.gameCards.emptyState,
  } as MLBReportPreviewUIAdapterGameCardListNode);

  nodes.push({
    kind: 'game-detail-list',
    gameDetails: presentation.gameDetails.gameDetails.map((detail, index) =>
      mapDetail(detail, presentation.gameCards.gameCards[index]?.gameId ?? ''),
    ),
    emptyState: presentation.gameDetails.emptyState,
  } as MLBReportPreviewUIAdapterGameDetailListNode);

  nodes.push({
    kind: 'warnings',
    warnings: presentation.warnings.warnings.map(mapWarning),
    emptyState: presentation.warnings.emptyState,
  } as MLBReportPreviewUIAdapterWarningsNode);

  nodes.push(mapLimitations(presentation.limitations));

  return {
    name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
    version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
    title: presentation.title,
    nodes,
  };
}

export interface MLBReportPreviewUIAdapterDocumentValidationError {
  readonly code: string;
  readonly message: string;
}

export function validateMLBReportPreviewUIAdapterDocument(
  value: unknown,
):
  | { readonly ok: true; readonly errors: readonly [] }
  | {
      readonly ok: false;
      readonly errors: readonly MLBReportPreviewUIAdapterDocumentValidationError[];
    } {
  const errors: MLBReportPreviewUIAdapterDocumentValidationError[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        { code: 'INVALID_TYPE', message: 'Expected object for adapter document.' },
      ],
    };
  }

  const obj = value as Record<string, unknown>;

  if (obj.name !== MLB_REPORT_PREVIEW_UI_ADAPTER_NAME) {
    errors.push({
      code: 'WRONG_NAME',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_ADAPTER_NAME}.`,
    });
  }

  if (obj.version !== MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION) {
    errors.push({
      code: 'WRONG_VERSION',
      message: `Expected ${MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION}.`,
    });
  }

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    errors.push({ code: 'MISSING_TITLE', message: 'title is required.' });
  }

  if (!Array.isArray(obj.nodes)) {
    errors.push({ code: 'MISSING_NODES', message: 'nodes must be an array.' });
  } else {
    if (obj.nodes.length !== MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER.length) {
      errors.push({
        code: 'WRONG_NODE_COUNT',
        message: `Expected exactly ${MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER.length} root nodes.`,
      });
    }

    const seen = new Set<AdapterNodeKind>();
    let sawSectionList = false;

    for (let i = 0; i < obj.nodes.length; i++) {
      const node = obj.nodes[i] as Record<string, unknown> | undefined;
      if (!node || typeof node !== 'object') {
        errors.push({
          code: 'INVALID_NODE',
          message: `nodes[${i}] must be an object.`,
        });
        continue;
      }

      const kind = node.kind;
      if (typeof kind !== 'string') {
        errors.push({
          code: 'INVALID_NODE_KIND',
          message: `nodes[${i}].kind must be a string.`,
        });
        continue;
      }

      const expectedKind = MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER[i];
      if (kind !== expectedKind) {
        errors.push({
          code: 'WRONG_NODE_ORDER',
          message: `nodes[${i}] expected ${expectedKind}, got ${kind}.`,
        });
      }

      if (seen.has(kind as AdapterNodeKind)) {
        errors.push({
          code: 'DUPLICATE_ROOT_KIND',
          message: `nodes[${i}] duplicates kind ${kind}.`,
        });
      }
      seen.add(kind as AdapterNodeKind);

      switch (kind) {
        case 'header': {
          if (
            typeof node.title !== 'string' ||
            typeof node.subtitle !== 'string' ||
            typeof node.generatedAtLabel !== 'string' ||
            typeof node.sourceLabel !== 'string'
          ) {
            errors.push({
              code: 'INVALID_HEADER_NODE',
              message: `nodes[${i}] header requires string title, subtitle, generatedAtLabel, sourceLabel.`,
            });
          }
          break;
        }
        case 'metadata': {
          if (
            typeof node.handlerVersion !== 'string' ||
            typeof node.contractVersion !== 'string' ||
            typeof node.rendererVersion !== 'string' ||
            typeof node.adapterVersion !== 'string' ||
            node.deterministic !== true ||
            node.source !== 'local-report-preview' ||
            (node.generatedAt !== null && typeof node.generatedAt !== 'string')
          ) {
            errors.push({
              code: 'INVALID_METADATA_NODE',
              message: `nodes[${i}] metadata requires handlerVersion, contractVersion, rendererVersion, adapterVersion, deterministic:true, source:'local-report-preview', generatedAt:string|null.`,
            });
          }
          break;
        }
        case 'section-list': {
          sawSectionList = true;
          if (
            typeof node.emptyState !== 'string' &&
            node.emptyState !== null ||
            !Array.isArray(node.sections)
          ) {
            errors.push({
              code: 'INVALID_SECTION_LIST_NODE',
              message: `nodes[${i}] section-list requires sections array and emptyState:string|null.`,
            });
          } else {
            for (let s = 0; s < node.sections.length; s++) {
              const section = node.sections[s] as Record<string, unknown> | undefined;
              if (
                !section ||
                typeof section !== 'object' ||
                section.kind !== 'section' ||
                typeof section.heading !== 'string' ||
                !Array.isArray(section.body) ||
                (section.emptyState !== null && typeof section.emptyState !== 'string')
              ) {
                errors.push({
                  code: 'INVALID_SECTION_NODE',
                  message: `nodes[${i}].sections[${s}] requires string heading, body array, emptyState:string|null.`,
                });
              } else {
                for (let b = 0; b < section.body.length; b++) {
                  if (typeof section.body[b] !== 'string') {
                    errors.push({
                      code: 'INVALID_SECTION_BODY',
                      message: `nodes[${i}].sections[${s}].body[${b}] must be a string.`,
                    });
                  }
                }
              }
            }
          }
          break;
        }
        case 'game-card-list': {
          if (
            typeof node.emptyState !== 'string' &&
            node.emptyState !== null ||
            !Array.isArray(node.gameCards)
          ) {
            errors.push({
              code: 'INVALID_GAME_CARD_LIST_NODE',
              message: `nodes[${i}] game-card-list requires gameCards array and emptyState:string|null.`,
            });
          } else {
            for (let c = 0; c < node.gameCards.length; c++) {
              const card = node.gameCards[c] as Record<string, unknown> | undefined;
              if (
                !card ||
                typeof card !== 'object' ||
                card.kind !== 'game-card' ||
                typeof card.gameId !== 'string' ||
                typeof card.heading !== 'string' ||
                typeof card.officialDate !== 'string' ||
                typeof card.scheduledStartTime !== 'string' ||
                typeof card.moduleSummary !== 'string' ||
                typeof card.dataQualityLabel !== 'string' ||
                typeof card.confidenceLabel !== 'string' ||
                typeof card.researchStrengthLabel !== 'string' ||
                typeof card.warningSummary !== 'string' ||
                typeof card.scheduleContextSummary !== 'string' ||
                typeof card.teamQualityContextSummary !== 'string'
              ) {
                errors.push({
                  code: 'INVALID_GAME_CARD_NODE',
                  message: `nodes[${i}].gameCards[${c}] requires string fields.`,
                });
              }
            }
          }
          break;
        }
        case 'game-detail-list': {
          if (
            typeof node.emptyState !== 'string' &&
            node.emptyState !== null ||
            !Array.isArray(node.gameDetails)
          ) {
            errors.push({
              code: 'INVALID_GAME_DETAIL_LIST_NODE',
              message: `nodes[${i}] game-detail-list requires gameDetails array and emptyState:string|null.`,
            });
          } else {
            for (let d = 0; d < node.gameDetails.length; d++) {
              const detail = node.gameDetails[d] as Record<string, unknown> | undefined;
              if (
                !detail ||
                typeof detail !== 'object' ||
                detail.kind !== 'game-detail' ||
                typeof detail.gameId !== 'string' ||
                typeof detail.heading !== 'string' ||
                typeof detail.availableResearchModules !== 'string' ||
                typeof detail.teamRecentFormSummary !== 'string' ||
                typeof detail.scheduleContextSummary !== 'string' ||
                typeof detail.teamQualityContextSummary !== 'string' ||
                typeof detail.warnings !== 'string' ||
                typeof detail.dataQualityExplanation !== 'string' ||
                typeof detail.evidenceLimitations !== 'string' ||
                typeof detail.technicalMetadataSummary !== 'string'
              ) {
                errors.push({
                  code: 'INVALID_GAME_DETAIL_NODE',
                  message: `nodes[${i}].gameDetails[${d}] requires string fields.`,
                });
              }
            }
          }
          break;
        }
        case 'warnings': {
          if (
            typeof node.emptyState !== 'string' &&
            node.emptyState !== null ||
            !Array.isArray(node.warnings)
          ) {
            errors.push({
              code: 'INVALID_WARNINGS_NODE',
              message: `nodes[${i}] warnings requires warnings array and emptyState:string|null.`,
            });
          } else {
            for (let w = 0; w < node.warnings.length; w++) {
              const warning = node.warnings[w] as Record<string, unknown> | undefined;
              if (
                !warning ||
                typeof warning !== 'object' ||
                warning.kind !== 'warning' ||
                typeof warning.code !== 'string' ||
                typeof warning.message !== 'string'
              ) {
                errors.push({
                  code: 'INVALID_WARNING_NODE',
                  message: `nodes[${i}].warnings[${w}] requires string code and message.`,
                });
              }
            }
          }
          break;
        }
        case 'limitations': {
          if (
            node.heading !== 'Limitations' ||
            !Array.isArray(node.notes)
          ) {
            errors.push({
              code: 'INVALID_LIMITATIONS_NODE',
              message: `nodes[${i}] limitations requires heading:'Limitations' and notes array.`,
            });
          } else {
            for (let n = 0; n < node.notes.length; n++) {
              if (typeof node.notes[n] !== 'string') {
                errors.push({
                  code: 'INVALID_LIMITATIONS_NOTE',
                  message: `nodes[${i}].notes[${n}] must be a string.`,
                });
              }
            }
          }
          break;
        }
        default: {
          errors.push({
            code: 'UNKNOWN_ROOT_NODE_KIND',
            message: `nodes[${i}] has unknown root kind: ${String(kind)}.`,
          });
        }
      }
    }

    if (!seen.has('header')) {
      errors.push({ code: 'MISSING_HEADER_NODE', message: 'nodes must contain a header node.' });
    }
    if (!seen.has('metadata')) {
      errors.push({ code: 'MISSING_METADATA_NODE', message: 'nodes must contain a metadata node.' });
    }
    if (!sawSectionList) {
      errors.push({
        code: 'MISSING_SECTION_LIST_NODE',
        message: 'nodes must contain a section-list node.',
      });
    }
    if (!seen.has('game-card-list')) {
      errors.push({ code: 'MISSING_GAME_CARD_LIST_NODE', message: 'nodes must contain a game-card-list node.' });
    }
    if (!seen.has('game-detail-list')) {
      errors.push({ code: 'MISSING_GAME_DETAIL_LIST_NODE', message: 'nodes must contain a game-detail-list node.' });
    }
    if (!seen.has('warnings')) {
      errors.push({ code: 'MISSING_WARNINGS_NODE', message: 'nodes must contain a warnings node.' });
    }
    if (!seen.has('limitations')) {
      errors.push({
        code: 'MISSING_LIMITATIONS_NODE',
        message: 'nodes must contain a limitations node.',
      });
    }
  }

  const prohibitedKeys = collectProhibitedKeyMatches(value);
  for (const key of prohibitedKeys) {
    errors.push({
      code: 'PROHIBITED_FIELD',
      message: `Adapter document must not contain field: ${key}.`,
    });
  }

  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  return { ok: true as const, errors: [] };
}

export function assertMLBReportPreviewUIAdapterDocument(
  value: unknown,
): asserts value is MLBReportPreviewUIAdapterDocument {
  const result = validateMLBReportPreviewUIAdapterDocument(value);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `MLB_REPORT_PREVIEW_UI_ADAPTER validation failed: ${first.code} — ${first.message}`,
    );
  }
}
