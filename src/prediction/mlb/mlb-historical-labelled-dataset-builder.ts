import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBHistoricalLabelledDataset,
  type MLBHistoricalLabelledDataset,
  type MLBHistoricalDatasetValidationIssue,
  type MLBHistoricalSplitPolicy,
  type MLBHistoricalDatasetSplit,
} from './mlb-historical-labelled-dataset-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';
import type { CanonicalHistoricalOutcome } from '@/lib/backtesting/mlb/live-history/types';

export const MLB_HISTORICAL_LABELLED_DATASET_BUILDER_CONTRACT_VERSION =
  'mlb-historical-labelled-dataset-builder-v1' as const;

export type MLBHistoricalLabelledDatasetBuilderInput = Readonly<{
  readonly datasetId: string;
  readonly createdAt: string;
  readonly splitPolicy: MLBHistoricalSplitPolicy;
  readonly entries: ReadonlyArray<{
    readonly split: MLBHistoricalDatasetSplit;
    readonly snapshot: MLBCanonicalPregameSnapshot;
    readonly outcome: CanonicalHistoricalOutcome;
    readonly labelSource: {
      readonly sourceName: string;
      readonly sourceRecordId: string;
      readonly fetchedAt: string;
    };
    readonly reconstructedAt: string;
  }>;
}>;

export type MLBHistoricalLabelledDatasetBuilderResult =
  | Readonly<{
      ok: true;
      value: MLBHistoricalLabelledDataset;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBHistoricalDatasetValidationIssue[];
    }>;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function pushIssue(
  issues: MLBHistoricalDatasetValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function parseTimestampToMs(
  value: unknown,
  path: string,
  label: string,
): number | MLBHistoricalDatasetValidationIssue {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    value !== value.trim()
  ) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be an RFC-3339 timestamp` };
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be a finite timestamp` };
  }
  return ms;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

const SPLIT_ORDERS: Record<MLBHistoricalDatasetSplit, number> = {
  TRAIN: 0,
  VALIDATION: 1,
  TEST: 2,
};

function compareExampleOrder(
  a: {
    readonly split: MLBHistoricalDatasetSplit;
    readonly officialDate: string;
    readonly gameId: string;
    readonly snapshotId: string;
    readonly exampleId: string;
  },
  b: typeof a,
): number {
  const splitDiff = SPLIT_ORDERS[a.split] - SPLIT_ORDERS[b.split];
  if (splitDiff !== 0) return splitDiff;
  const dateDiff = a.officialDate < b.officialDate ? -1 : a.officialDate === b.officialDate ? 0 : 1;
  if (dateDiff !== 0) return dateDiff;
  const gameIdDiff = a.gameId < b.gameId ? -1 : a.gameId === b.gameId ? 0 : 1;
  if (gameIdDiff !== 0) return gameIdDiff;
  const snapshotIdDiff = a.snapshotId < b.snapshotId ? -1 : a.snapshotId === b.snapshotId ? 0 : 1;
  if (snapshotIdDiff !== 0) return snapshotIdDiff;
  const exampleIdDiff = a.exampleId < b.exampleId ? -1 : a.exampleId === b.exampleId ? 0 : 1;
  if (exampleIdDiff !== 0) return exampleIdDiff;
  return 0;
}

function buildExampleId(
  snapshot: MLBCanonicalPregameSnapshot,
  split: MLBHistoricalDatasetSplit,
): string {
  return `${snapshot.game.gameId}:${split}:${snapshot.snapshotId}:dataset-example-v1`;
}

interface PreparedExample {
  readonly exampleId: string;
  readonly split: MLBHistoricalDatasetSplit;
  readonly snapshot: MLBCanonicalPregameSnapshot;
  readonly reconstruction: {
    readonly mode: 'POINT_IN_TIME_AS_OF_CUTOFF';
    readonly cutoffAt: string;
    readonly reconstructedAt: string;
  };
  readonly label: {
    readonly status: 'OFFICIAL_FINAL';
    readonly target: 'OFFICIAL_FINAL_GAME_WINNER';
    readonly homeRuns: number;
    readonly awayRuns: number;
    readonly winnerTeamId: string;
    readonly finalizedAt: string;
    readonly source: {
      readonly sourceName: string;
      readonly sourceRecordId: string;
      readonly fetchedAt: string;
    };
  };
}

function validateEntry(
  entry: MLBHistoricalLabelledDatasetBuilderInput['entries'][number],
  index: number,
  datasetCreatedAtMs: number | undefined,
  seenGameIds: Set<string>,
  issues: MLBHistoricalDatasetValidationIssue[],
): PreparedExample | undefined {
  const entryPath = `$.entries[${index}]`;
  const snapshotPath = `${entryPath}.snapshot`;
  const outcomePath = `${entryPath}.outcome`;
  const labelPath = `${entryPath}.label`;
  const sourcePath = `${labelPath}.source`;
  const reconPath = `${entryPath}.reconstruction`;

  const snapshotValidation = validateMLBCanonicalPregameSnapshot(entry.snapshot);
  if (!snapshotValidation.ok) {
    const first = snapshotValidation.issues[0];
    pushIssue(
      issues,
      'SNAPSHOT_INVALID',
      snapshotPath,
      `Snapshot invalid: ${first?.code ?? 'INVALID'} at ${first?.path ?? snapshotPath}`,
    );
    return undefined;
  }

  const snapshot = snapshotValidation.value;
  const gameId = snapshot.game.gameId;

  if (gameId !== String(entry.outcome.gamePk)) {
    pushIssue(issues, 'SNAPSHOT_INVALID', snapshotPath, `Snapshot game identity mismatch for game ${gameId}`);
    return undefined;
  }

  if (seenGameIds.has(gameId)) {
    pushIssue(issues, 'DUPLICATE_GAME', `${snapshotPath}.game.gameId`, `Duplicate gameId: ${gameId}`);
    return undefined;
  }
  seenGameIds.add(gameId);

  if (entry.outcome.status !== 'FINAL') {
    pushIssue(issues, 'INVALID_LITERAL', `${outcomePath}.status`, `Outcome status must be FINAL for game ${gameId}`);
    return undefined;
  }

  const homeScore = entry.outcome.homeScore;
  const awayScore = entry.outcome.awayScore;
  const winner = entry.outcome.winner;
  const completedAt = entry.outcome.completedAt;

  if (homeScore === null || awayScore === null) {
    pushIssue(issues, 'MISSING_FIELD', `${outcomePath}.homeScore`, `Final scores are required for game ${gameId}`);
    return undefined;
  }

  if (!Number.isSafeInteger(homeScore) || homeScore < 0) {
    pushIssue(issues, 'INVALID_INTEGER', `${outcomePath}.homeScore`, `homeScore must be a non-negative safe integer for game ${gameId}`);
  }

  if (!Number.isSafeInteger(awayScore) || awayScore < 0) {
    pushIssue(issues, 'INVALID_INTEGER', `${outcomePath}.awayScore`, `awayScore must be a non-negative safe integer for game ${gameId}`);
  }

  if (homeScore === awayScore) {
    pushIssue(issues, 'INVALID_FINAL_LABEL', `${outcomePath}.homeScore`, `Official-final scores must not be tied for game ${gameId}`);
  } else if (homeScore > awayScore) {
    if (winner !== 'HOME') {
      pushIssue(issues, 'FINAL_SCORE_MISMATCH', `${outcomePath}.winnerTeamId`, `winnerTeamId must equal homeTeamId when homeRuns exceed awayRuns for game ${gameId}`);
    }
  } else if (awayScore > homeScore) {
    if (winner !== 'AWAY') {
      pushIssue(issues, 'FINAL_SCORE_MISMATCH', `${outcomePath}.winnerTeamId`, `winnerTeamId must equal awayTeamId when awayRuns exceed homeRuns for game ${gameId}`);
    }
  }

  if (winner !== 'HOME' && winner !== 'AWAY') {
    pushIssue(issues, 'MISSING_FIELD', `${outcomePath}.winner`, `Winner is required for game ${gameId}`);
  }

  if (completedAt === null) {
    pushIssue(issues, 'MISSING_FIELD', `${outcomePath}.completedAt`, `completedAt is required for game ${gameId}`);
    return undefined;
  }

  const finalizedAt = toIsoString(completedAt);
  const finalizedAtMs = Date.parse(finalizedAt);
  const scheduledStartAtMs = Date.parse(snapshot.game.scheduledStartAt);
  const dataCutoffAtMs = Date.parse(snapshot.dataCutoffAt);

  if (Number.isFinite(finalizedAtMs) && Number.isFinite(scheduledStartAtMs) && !(finalizedAtMs > scheduledStartAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${labelPath}.finalizedAt`, `finalizedAt must be later than scheduledStartAt for game ${gameId}`);
  }

  if (Number.isFinite(finalizedAtMs) && Number.isFinite(dataCutoffAtMs) && !(finalizedAtMs > dataCutoffAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${labelPath}.finalizedAt`, `finalizedAt must be later than dataCutoffAt for game ${gameId}`);
  }

  const fetchedAt = entry.labelSource.fetchedAt;
  const fetchedAtMs = Date.parse(fetchedAt);
  if (Number.isFinite(fetchedAtMs) && Number.isFinite(finalizedAtMs) && !(fetchedAtMs >= finalizedAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${sourcePath}.fetchedAt`, `source.fetchedAt must not be earlier than finalizedAt for game ${gameId}`);
  }
  const hasValidCreatedAt = datasetCreatedAtMs !== undefined && Number.isFinite(datasetCreatedAtMs);
  if (hasValidCreatedAt && Number.isFinite(fetchedAtMs) && !(fetchedAtMs <= datasetCreatedAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${sourcePath}.fetchedAt`, `source.fetchedAt must not be later than dataset createdAt for game ${gameId}`);
  }

  const reconstructedAt = entry.reconstructedAt;
  const reconstructedAtMs = Date.parse(reconstructedAt);
  const capturedAtMs = Date.parse(snapshot.capturedAt);
  if (Number.isFinite(reconstructedAtMs) && Number.isFinite(capturedAtMs) && !(reconstructedAtMs >= capturedAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${reconPath}.reconstructedAt`, `reconstructedAt must be >= snapshot.capturedAt for game ${gameId}`);
  }
  if (hasValidCreatedAt && Number.isFinite(reconstructedAtMs) && !(reconstructedAtMs <= datasetCreatedAtMs)) {
    pushIssue(issues, 'INVALID_TIME_ORDER', `${reconPath}.reconstructedAt`, `reconstructedAt must be <= dataset createdAt for game ${gameId}`);
  }

  const winnerTeamId =
    winner === 'HOME'
      ? snapshot.game.homeTeamId
      : winner === 'AWAY'
        ? snapshot.game.awayTeamId
        : snapshot.game.homeTeamId;

  return {
    exampleId: buildExampleId(snapshot, entry.split),
    split: entry.split,
    snapshot,
    reconstruction: {
      mode: 'POINT_IN_TIME_AS_OF_CUTOFF',
      cutoffAt: snapshot.dataCutoffAt,
      reconstructedAt,
    },
    label: {
      status: 'OFFICIAL_FINAL',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      homeRuns: homeScore,
      awayRuns: awayScore,
      winnerTeamId,
      finalizedAt,
      source: {
        sourceName: entry.labelSource.sourceName,
        sourceRecordId: entry.labelSource.sourceRecordId,
        fetchedAt,
      },
    },
  };
}

export function buildMLBHistoricalLabelledDataset(
  input: MLBHistoricalLabelledDatasetBuilderInput,
): MLBHistoricalLabelledDatasetBuilderResult {
  const issues: MLBHistoricalDatasetValidationIssue[] = [];

  if (!isStrictNonEmptyTrimmedString(input.datasetId)) {
    pushIssue(issues, 'INVALID_STRING', '$.datasetId', 'datasetId must be a valid identifier');
  }

  const createdAtMs = parseTimestampToMs(input.createdAt, '$.createdAt', 'createdAt');
  if (typeof createdAtMs === 'object') {
    issues.push(createdAtMs);
  }

  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    pushIssue(issues, 'MISSING_FIELD', '$.entries', 'entries must be a non-empty array');
    return { ok: false, issues };
  }

  const seenGameIds = new Set<string>();
  const prepared = new Array<PreparedExample>(input.entries.length);

  for (let i = 0; i < input.entries.length; i++) {
    const entry = input.entries[i];
    const preparedExample = validateEntry(entry, i, createdAtMs as number | undefined, seenGameIds, issues);
    if (preparedExample) {
      prepared[i] = preparedExample;
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const sorted = prepared
    .slice()
    .sort((a, b) =>
      compareExampleOrder(
        {
          split: a.split,
          officialDate: a.snapshot.game.officialDate,
          gameId: a.snapshot.game.gameId,
          snapshotId: a.snapshot.snapshotId,
          exampleId: a.exampleId,
        },
        {
          split: b.split,
          officialDate: b.snapshot.game.officialDate,
          gameId: b.snapshot.game.gameId,
          snapshotId: b.snapshot.snapshotId,
          exampleId: b.exampleId,
        },
      ),
    );

  const examples = sorted.map((preparedExample) => ({
    exampleId: preparedExample.exampleId,
    split: preparedExample.split,
    snapshot: preparedExample.snapshot,
    reconstruction: preparedExample.reconstruction,
    label: preparedExample.label,
  }));

  const dataset = {
    contractVersion: 'mlb-historical-labelled-dataset-v1',
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    datasetId: input.datasetId,
    createdAt: input.createdAt,
    splitPolicy: input.splitPolicy,
    examples,
  };

  try {
    assertNoOddsContamination(dataset);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushIssue(issues, 'ODDS_CONTAMINATION', `$${firewallPath.replace(/^\./, '')}`, `Dataset contains prohibited field at ${firewallPath}`);
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushIssue(issues, 'INVALID_JSON_VALUE', `$${accessorPath.replace(/^\./, '')}`, 'Dataset contains an accessor property');
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const validation = validateMLBHistoricalLabelledDataset(dataset);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  return { ok: true, value: validation.value };
}
