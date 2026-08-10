import {
  extractMLBLeakageSafeFeatureVector,
} from './mlb-feature-vector-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from './mlb-real-pregame-winner-feature-manifest-v1';
import type { MLBCanonicalPregameSnapshot } from './mlb-pregame-snapshot-contract';

export function extractMLBRealPregameWinnerFeatureVectorV1(
  snapshot: MLBCanonicalPregameSnapshot,
) {
  return extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot,
  );
}
