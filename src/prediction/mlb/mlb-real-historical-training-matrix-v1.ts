import {
  buildMLBLeakageSafeTrainingMatrix,
  type MLBTrainingMatrix,
  type MLBTrainingMatrixIssue,
} from './mlb-training-matrix-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from './mlb-real-pregame-winner-feature-manifest-v1';

export function buildMLBRealHistoricalTrainingMatrixV1(
  dataset: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBTrainingMatrix;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBTrainingMatrixIssue[];
    }> {
  return buildMLBLeakageSafeTrainingMatrix(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    dataset,
  );
}
