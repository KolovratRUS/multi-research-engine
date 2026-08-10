import {
  MLBFeatureManifest,
  MLBFeatureExtractionIssue,
  MLBFeatureDefinition,
  MLBFeatureValueKind,
  MLBFeatureMissingPolicy,
  MLBFeaturePathSegment,
  validateMLBFeatureManifest,
  MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
} from './mlb-feature-vector-contract';
import { createHash } from 'node:crypto';

type FeatureFingerprint = Readonly<{
  featureId: string;
  sectionId: string;
  payloadPath: readonly MLBFeaturePathSegment[];
  valueKind: MLBFeatureValueKind;
  missingPolicy: MLBFeatureMissingPolicy;
  defaultValue: number | null;
}>;

type ManifestFingerprintPayload = Readonly<{
  contractVersion: typeof MLB_FEATURE_MANIFEST_CONTRACT_VERSION;
  manifestId: string;
  features: readonly FeatureFingerprint[];
}>;

const FINGERPRINT_ROOT_ORDER = [
  'contractVersion',
  'manifestId',
  'features',
] as const;

const FINGERPRINT_FEATURE_ORDER = [
  'featureId',
  'sectionId',
  'payloadPath',
  'valueKind',
  'missingPolicy',
  'defaultValue',
] as const;

function sortObjectByKeys(
  value: Record<string, unknown>,
  orderedKeys: readonly string[],
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      sorted[key] = value[key];
    }
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!Object.prototype.hasOwnProperty.call(sorted, key)) {
      sorted[key] = value[key];
    }
  }
  return sorted;
}

function buildFingerprintPayload(
  manifest: MLBFeatureManifest,
): ManifestFingerprintPayload {
  return {
    contractVersion: manifest.contractVersion,
    manifestId: manifest.manifestId,
    features: manifest.features.map((feature) => ({
      featureId: feature.featureId,
      sectionId: feature.sectionId,
      payloadPath: feature.payloadPath,
      valueKind: feature.valueKind,
      missingPolicy: feature.missingPolicy,
      defaultValue: feature.defaultValue,
    })),
  };
}

export function serializeMLBFeatureManifestFingerprintPayload(
  payload: ManifestFingerprintPayload,
): string {
  const root = sortObjectByKeys(
    {
      contractVersion: payload.contractVersion,
      manifestId: payload.manifestId,
      features: payload.features.map((feature) =>
        sortObjectByKeys(
          {
            featureId: feature.featureId,
            sectionId: feature.sectionId,
            payloadPath: feature.payloadPath,
            valueKind: feature.valueKind,
            missingPolicy: feature.missingPolicy,
            defaultValue: feature.defaultValue,
          },
          FINGERPRINT_FEATURE_ORDER,
        ),
      ),
    },
    FINGERPRINT_ROOT_ORDER,
  );
  return JSON.stringify(root);
}

function fingerprintManifest(manifest: MLBFeatureManifest): string {
  const payload = buildFingerprintPayload(manifest);
  const canonical = serializeMLBFeatureManifestFingerprintPayload(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function computeMLBFeatureManifestFingerprint(
  manifest: unknown,
):
  | Readonly<{ ok: true; fingerprint: string }>
  | Readonly<{ ok: false; issues: readonly MLBFeatureExtractionIssue[] }> {
  const validation = validateMLBFeatureManifest(manifest);
  if (!validation.ok) {
    return validation;
  }
  return { ok: true, fingerprint: fingerprintManifest(validation.value) };
}

export function areMLBFeatureManifestsCompatible(
  expected: unknown,
  actual: unknown,
): boolean {
  const expectedValidation = validateMLBFeatureManifest(expected);
  if (!expectedValidation.ok) {
    return false;
  }
  const actualValidation = validateMLBFeatureManifest(actual);
  if (!actualValidation.ok) {
    return false;
  }
  return (
    fingerprintManifest(expectedValidation.value) ===
    fingerprintManifest(actualValidation.value)
  );
}

const MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1: MLBFeatureManifest =
  Object.freeze({
    contractVersion: MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    features: Object.freeze([
      {
        featureId: 'awayBullpenExtraInningGames',
        sectionId: 'section-away-bullpen',
        payloadPath: ['recentWorkload', 'extraInningGames'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'awayBullpenGamesInPrevious3Days',
        sectionId: 'section-away-bullpen',
        payloadPath: ['recentWorkload', 'gamesInPrevious3Days'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'awayRunsAllowedPerGame',
        sectionId: 'section-away-batting',
        payloadPath: ['seasonStats', 'runsAllowedPerGame'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'awayRunsScoredPerGame',
        sectionId: 'section-away-batting',
        payloadPath: ['seasonStats', 'runsScoredPerGame'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'awayStarterAvailable',
        sectionId: 'section-away-starter',
        payloadPath: ['availability'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'awayWinRate',
        sectionId: 'section-away-batting',
        payloadPath: ['seasonStats', 'winRate'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0.5,
      } as MLBFeatureDefinition,
      {
        featureId: 'doubleHeaderGameNumber',
        sectionId: 'section-game-context',
        payloadPath: ['doubleHeaderGameNumber'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeBullpenExtraInningGames',
        sectionId: 'section-home-bullpen',
        payloadPath: ['recentWorkload', 'extraInningGames'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeBullpenGamesInPrevious3Days',
        sectionId: 'section-home-bullpen',
        payloadPath: ['recentWorkload', 'gamesInPrevious3Days'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeRunsAllowedPerGame',
        sectionId: 'section-home-batting',
        payloadPath: ['seasonStats', 'runsAllowedPerGame'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeRunsScoredPerGame',
        sectionId: 'section-home-batting',
        payloadPath: ['seasonStats', 'runsScoredPerGame'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeStarterAvailable',
        sectionId: 'section-home-starter',
        payloadPath: ['availability'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      } as MLBFeatureDefinition,
      {
        featureId: 'homeWinRate',
        sectionId: 'section-home-batting',
        payloadPath: ['seasonStats', 'winRate'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0.5,
      } as MLBFeatureDefinition,
      {
        featureId: 'scheduledInnings',
        sectionId: 'section-game-context',
        payloadPath: ['scheduledInnings'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 9,
      } as MLBFeatureDefinition,
    ]),
  });

export const MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT =
  fingerprintManifest(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1);

export {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
};
