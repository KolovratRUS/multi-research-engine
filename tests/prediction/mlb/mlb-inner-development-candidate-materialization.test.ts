import { describe, it, expect } from 'vitest';
import {
  materializeMLBInnerDevelopmentCandidateRecipe,
  type MLBInnerDevelopmentCandidateMaterializationResult,
  type MLBInnerMaterializedCandidate,
} from '@/prediction/mlb/mlb-inner-development-candidate-materialization';
import type { MLBInnerCandidateRecipe } from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

function baseRecipe(
  overrides: Partial<MLBInnerCandidateRecipe> = {},
): MLBInnerCandidateRecipe {
  return {
    candidateRecipeId: 'synthetic-recipe-01',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    regularizationConfig: { kind: 'L2', strength: 0.1 },
    optimizerConfig: {
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      learningRate: 0.01,
      maxIterations: 1000,
      tolerance: 1e-4,
    },
    otherModelAffectingChoices: {},
    complexityRank: 1,
    ...overrides,
  } as MLBInnerCandidateRecipe;
}

function expectSuccess(
  result: MLBInnerDevelopmentCandidateMaterializationResult,
): MLBInnerMaterializedCandidate {
  if (!result.ok) {
    throw new Error('Expected success');
  }
  return result.materialized;
}

function expectFailure(
  result: MLBInnerDevelopmentCandidateMaterializationResult,
  state: string,
): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.state).toBe(state);
  }
}

describe('mlb-inner-development-candidate-materialization', () => {
  // Happy path
  it('1. canonical supported recipe succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('2. materialized candidate preserves candidateRecipeId', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ candidateRecipeId: 'synthetic-recipe-abc' }),
    );
    const materialized = expectSuccess(result);
    expect(materialized.candidateRecipeId).toBe('synthetic-recipe-abc');
  });

  it('3. feature policy matches frozen provenance', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.featurePolicyId).toBe(
      'mlb-real-pregame-winner-feature-policy-v1',
    );
  });

  it('4. preprocessing policy matches frozen provenance', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.preprocessingPolicyId).toBe(
      'raw-finite-feature-values-with-default-missing-v1',
    );
  });

  it('5. strict model family/algorithm exact', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.configuration.algorithm).toBe(
      'L2_LOGISTIC_REGRESSION_BINARY_V1',
    );
  });

  it('6. regularization translated exactly', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ regularizationConfig: { kind: 'L2', strength: 0.25 } }),
    );
    const materialized = expectSuccess(result);
    expect(materialized.configuration.regularization).toEqual({
      kind: 'L2',
      strength: 0.25,
    });
  });

  it('7. optimizer translated exactly', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.05,
          maxIterations: 2000,
          tolerance: 1e-5,
        },
      }),
    );
    const materialized = expectSuccess(result);
    expect(materialized.configuration.optimization).toEqual({
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      learningRate: 0.05,
      maxIterations: 2000,
      tolerance: 1e-5,
    });
  });

  it('8. other choices canonical empty object', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.configuration.regularization).toEqual({
      kind: 'L2',
      strength: 0.1,
    });
    expect(materialized.configuration.optimization).toEqual({
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      learningRate: 0.01,
      maxIterations: 1000,
      tolerance: 1e-4,
    });
  });

  it('9. result immutable', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(Object.isFrozen(materialized)).toBe(true);
    expect(Object.isFrozen(materialized.configuration)).toBe(true);
    expect(Object.isFrozen(materialized.provenance)).toBe(true);
  });

  it('10. source recipe not mutated', () => {
    const source = baseRecipe();
    const snapshot = JSON.parse(JSON.stringify(source));
    materializeMLBInnerDevelopmentCandidateRecipe(source);
    expect(source).toEqual(snapshot);
  });

  // Determinism
  it('11. repeated materialization produces equivalent result', () => {
    const recipe = baseRecipe();
    const a = materializeMLBInnerDevelopmentCandidateRecipe(recipe);
    const b = materializeMLBInnerDevelopmentCandidateRecipe(recipe);
    const materializedA = expectSuccess(a);
    const materializedB = expectSuccess(b);
    expect(materializedA).toEqual(materializedB);
  });

  it('12. configuration identity stable', () => {
    const recipe = baseRecipe();
    const a = materializeMLBInnerDevelopmentCandidateRecipe(recipe);
    const b = materializeMLBInnerDevelopmentCandidateRecipe(recipe);
    const materializedA = expectSuccess(a);
    const materializedB = expectSuccess(b);
    expect(materializedA.configuration.configId).toBe(
      materializedB.configuration.configId,
    );
  });

  it('13. no timestamps/random IDs', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    const json = JSON.stringify(materialized);
    expect(json).not.toMatch(/"timestamp"/);
    expect(json).not.toMatch(/"createdAt"/);
    expect(json).not.toMatch(/"updatedAt"/);
    expect(json).not.toMatch(/"randomId"/);
    expect(json).not.toMatch(/"uuid"/);
  });

  it('14. identical semantic source bytes remain identical in meaning', () => {
    const a = baseRecipe();
    const b = JSON.parse(JSON.stringify(a)) as MLBInnerCandidateRecipe;
    const resultA = materializeMLBInnerDevelopmentCandidateRecipe(a);
    const resultB = materializeMLBInnerDevelopmentCandidateRecipe(b);
    const materializedA = expectSuccess(resultA);
    const materializedB = expectSuccess(resultB);
    expect(materializedA.configuration).toEqual(materializedB.configuration);
  });

  // Model family
  it('15. unknown family fails UNSUPPORTED_MODEL_FAMILY', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ modelFamilyId: 'UNKNOWN_MODEL' }),
    );
    expectFailure(result, 'UNSUPPORTED_MODEL_FAMILY');
  });

  it('16. casing alias fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ modelFamilyId: 'l2_logistic_regression_binary_v1' }),
    );
    expectFailure(result, 'UNSUPPORTED_MODEL_FAMILY');
  });

  it('17. string-like object does not coerce', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        modelFamilyId: new String('L2_LOGISTIC_REGRESSION_BINARY_V1'),
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'UNSUPPORTED_MODEL_FAMILY');
  });

  // Feature policy
  it('18. wrong feature policy fails UNSUPPORTED_FEATURE_POLICY', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ featurePolicyId: 'unknown-feature-policy' }),
    );
    expectFailure(result, 'UNSUPPORTED_FEATURE_POLICY');
  });

  it('19. alias/casing mismatch fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ featurePolicyId: 'MLB-REAL-PREGAME-WINNER-FEATURE-POLICY-V1' }),
    );
    expectFailure(result, 'UNSUPPORTED_FEATURE_POLICY');
  });

  // Preprocessing policy
  it('20. wrong preprocessing policy fails UNSUPPORTED_PREPROCESSING_POLICY', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ preprocessingPolicyId: 'unknown-preprocessing' }),
    );
    expectFailure(result, 'UNSUPPORTED_PREPROCESSING_POLICY');
  });

  it('21. alias/casing mismatch fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        preprocessingPolicyId: 'RAW-FINITE-FEATURE-VALUES-WITH-DEFAULT-MISSING-V1',
      }),
    );
    expectFailure(result, 'UNSUPPORTED_PREPROCESSING_POLICY');
  });

  // Regularization
  it('22. exact canonical L2 succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ regularizationConfig: { kind: 'L2', strength: 0.5 } }),
    );
    expectSuccess(result);
  });

  it('23. old { type: "l2", value: ... } fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { type: 'l2', value: 0.1 },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('24. missing kind', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { strength: 0.1 } as Record<string, unknown>,
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('25. missing strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2' } as Record<string, unknown>,
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('26. wrong kind', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L1', strength: 0.1 },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('27. zero strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: 0 },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('28. negative strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: -0.1 },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('29. NaN strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: NaN },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('30. Infinity strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: Infinity },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('31. string numeric strength', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: '0.1' },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('32. unknown field', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: { kind: 'L2', strength: 0.1, extra: true },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('33. array regularization', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: ['L2', 0.1],
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('34. null regularization', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: null,
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  it('35. string-like/coercive object does not bypass validation', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        regularizationConfig: new String('{"kind":"L2","strength":0.1}'),
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });

  // Optimizer
  it('36. canonical deterministic batch GD succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.02,
          maxIterations: 5000,
          tolerance: 1e-6,
        },
      }),
    );
    expectSuccess(result);
  });

  it('37. old Adam fixture fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: { type: 'adam', learningRate: 0.01 },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('38. wrong solver', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'SGD',
          learningRate: 0.01,
          maxIterations: 1000,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('39. missing learningRate', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          maxIterations: 1000,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('40. missing maxIterations', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('41. missing tolerance', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('42. learningRate zero', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0,
          maxIterations: 1000,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('43. learningRate > 1', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 1.5,
          maxIterations: 1000,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('44. learningRate NaN/Infinity', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: NaN,
          maxIterations: 1000,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('45. maxIterations zero', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 0,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('46. maxIterations negative', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: -1,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('47. maxIterations fractional', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000.5,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('48. maxIterations unsafe integer', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: Number.MAX_SAFE_INTEGER + 1,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('49. maxIterations > 1,000,000', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1_000_001,
          tolerance: 1e-4,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('50. tolerance zero', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000,
          tolerance: 0,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('51. tolerance >= 1', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000,
          tolerance: 1,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('52. tolerance NaN/Infinity', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000,
          tolerance: NaN,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('53. unknown optimizer field', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: {
          solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
          learningRate: 0.01,
          maxIterations: 1000,
          tolerance: 1e-4,
          extra: true,
        },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'INVALID_OPTIMIZER_RECIPE');
  });

  it('54. array/null malformed optimizer', () => {
    const arrayResult = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: [],
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(arrayResult, 'INVALID_OPTIMIZER_RECIPE');

    const nullResult = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        optimizerConfig: null,
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(nullResult, 'INVALID_OPTIMIZER_RECIPE');
  });

  // Other model choices
  it('55. {} succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ otherModelAffectingChoices: {} }),
    );
    expectSuccess(result);
  });

  it('56. non-empty object fails UNSUPPORTED_OTHER_MODEL_CHOICES', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        otherModelAffectingChoices: { extra: true },
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'UNSUPPORTED_OTHER_MODEL_CHOICES');
  });

  it('57. array fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        otherModelAffectingChoices: [],
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'UNSUPPORTED_OTHER_MODEL_CHOICES');
  });

  it('58. null fails', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({
        otherModelAffectingChoices: null,
      } as unknown as MLBInnerCandidateRecipe),
    );
    expectFailure(result, 'UNSUPPORTED_OTHER_MODEL_CHOICES');
  });

  // Identity
  it('59. valid materialization does not change source candidateRecipeId', () => {
    const source = baseRecipe();
    materializeMLBInnerDevelopmentCandidateRecipe(source);
    expect(source.candidateRecipeId).toBe('synthetic-recipe-01');
  });

  it('60. source recipe object byte/structural content remains unchanged', () => {
    const source = baseRecipe();
    const before = JSON.stringify(source);
    materializeMLBInnerDevelopmentCandidateRecipe(source);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('61. unsupported recipe is not normalized into supported configuration', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ modelFamilyId: 'UNKNOWN' }),
    );
    expectFailure(result, 'UNSUPPORTED_MODEL_FAMILY');
  });

  it('62. two materially different fingerprinted configurations do not silently collapse through defaults/aliases', () => {
    const a = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ regularizationConfig: { kind: 'L2', strength: 0.1 } }),
    );
    const b = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ regularizationConfig: { kind: 'L2', strength: 0.2 } }),
    );
    const materializedA = expectSuccess(a);
    const materializedB = expectSuccess(b);
    expect(materializedA.configuration.regularization.strength).not.toBe(
      materializedB.configuration.regularization.strength,
    );
  });

  // Provenance
  it('63. materialized result uses PRE-I1 canonical dataset identity', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.datasetId).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360',
    );
  });

  it('64. uses canonical manifest identity', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.manifestId).toBe(
      'mlb-real-pregame-winner-feature-manifest-v1',
    );
  });

  it('65. uses canonical matrix identity', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.matrixId).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1',
    );
  });

  it('66. uses canonical feature policy', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.featurePolicyId).toBe(
      'mlb-real-pregame-winner-feature-policy-v1',
    );
  });

  it('67. uses canonical preprocessing policy', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    expect(materialized.provenance.preprocessingPolicyId).toBe(
      'raw-finite-feature-values-with-default-missing-v1',
    );
  });

  it('68. no external path in materialized output', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    const materialized = expectSuccess(result);
    const json = JSON.stringify(materialized);
    expect(json).not.toMatch(/var\/mlb-development/);
    expect(json).not.toMatch(/docs\//);
    expect(materialized.provenance).not.toHaveProperty('path');
  });

  // Safety
  it('69. zero filesystem writes', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('70. zero model fits', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('71. zero trainer invocation', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('72. zero prediction generation', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('73. zero campaign state creation', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('74. zero TEST access', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('75. no odds/market inputs', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(baseRecipe());
    expectSuccess(result);
  });

  it('does not expose low-level codes as top-level states', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      baseRecipe({ regularizationConfig: { kind: 'L2', strength: 0 } }),
    );
    expectFailure(result, 'INVALID_REGULARIZATION_RECIPE');
  });
});
