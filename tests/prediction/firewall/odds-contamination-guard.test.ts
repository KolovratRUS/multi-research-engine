import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertNoOddsContamination,
  isProhibitedOddsKey,
  type OddsContaminationViolation,
} from '@/prediction/firewall/odds-contamination-guard';

function extractPaths(error: Error): string[] {
  const lines = error.message.split('\n');
  return lines
    .filter((line) => line.startsWith('path='))
    .map((line) => line.slice(5).split('; ')[0]);
}

function extractCodes(error: Error): string[] {
  const lines = error.message.split('\n');
  return lines
    .filter((line) => line.startsWith('path='))
    .map((line) => {
      const codePart = line.split('; code=')[1];
      return codePart ? codePart.split('; ')[0] : '';
    })
    .filter((code) => code !== '');
}

function moduleSources(source: string): string[] {
  const matches = source.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  );
  return Array.from(matches).map((match) => match[1]);
}

describe('odds-contamination-guard', () => {
  it('rejects prohibited keys at root and nested levels with deterministic paths', () => {
    const value = {
      sportsbook: 'legacy',
      research: {
        marketImpliedProbability: 0.55,
      },
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const error = new Error('');
    try {
      assertNoOddsContamination(value);
    } catch (thrown) {
      error.message = thrown instanceof Error ? thrown.message : String(thrown);
    }

    expect(extractPaths(error)).toEqual([
      '$.research.marketImpliedProbability',
      '$.sportsbook',
    ]);
    expect(extractCodes(error)).toEqual([
      'PROHIBITED_ODDS_KEY',
      'PROHIBITED_ODDS_KEY',
    ]);
  });

  it('normalizes case/separator variants consistently', () => {
    const value = {
      SportsBook: 'legacy',
      'primary_bookmaker': 'legacy',
      'decimal-odds': 100,
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const error = new Error('');
    try {
      assertNoOddsContamination(value);
    } catch (thrown) {
      error.message = thrown instanceof Error ? thrown.message : String(thrown);
    }

    expect(extractPaths(error)).toEqual([
      '$.SportsBook',
      '$.decimal-odds',
      '$.primary_bookmaker',
    ]);
    expect(extractCodes(error)).toEqual([
      'PROHIBITED_ODDS_KEY',
      'PROHIBITED_ODDS_KEY',
      'PROHIBITED_ODDS_KEY',
    ]);
  });

  it('rejects prohibited data inside arrays and deeply nested objects without mutation', () => {
    const original = {
      modelOutput: [
        { meta: { payout: 'fixed' } },
        { meta: { edge: 0.1 } },
      ],
    };

    expect(() => assertNoOddsContamination(original)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    expect(original).toEqual({
      modelOutput: [
        { meta: { payout: 'fixed' } },
        { meta: { edge: 0.1 } },
      ],
    });

    const cyclicObject = { a: 1 } as Record<string, unknown>;
    cyclicObject.self = cyclicObject;
    expect(() => assertNoOddsContamination(cyclicObject)).not.toThrow();

    const cyclicArray: unknown[] = [];
    cyclicArray.push(cyclicArray);
    expect(() => assertNoOddsContamination(cyclicArray)).not.toThrow();

    const sharedUnsafe = { marketImpliedProbability: 0.55 };
    const shared = { x: sharedUnsafe, y: sharedUnsafe };
    expect(() => assertNoOddsContamination(shared)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const sharedError = new Error('');
    try {
      assertNoOddsContamination(shared);
    } catch (thrown) {
      sharedError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }

    expect(extractPaths(sharedError).sort()).toEqual([
      '$.x.marketImpliedProbability',
      '$.y.marketImpliedProbability',
    ]);
  });

  it('rejects sportsbook, bookmaker and primary-bookmaker variants', () => {
    const value = {
      rootSportsbook: true,
      bookmakerName: 'X',
      primaryBookmaker: 'Y',
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
  });

  it('rejects price, pricing, betting price, payout and potential payout fields', () => {
    const value = {
      price: 101,
      pricing: 'open',
      bettingPrice: 105,
      payout: '$10',
      potentialPayout: '$20',
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
  });

  it('rejects implied probability and market-implied probability but accepts model probability names', () => {
    const value = {
      impliedProbability: 0.55,
      marketImpliedProbability: 0.52,
      modelProbability: 0.57,
      calibratedProbability: 0.58,
      homeWinProbability: 0.6,
      awayWinProbability: 0.4,
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
  });

  it('rejects expected value, value edge and edge fields', () => {
    const value = {
      expectedValue: 0,
      valueEdge: 0.1,
      edge: 0.05,
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
  });

  it('rejects Kelly and Kelly-fraction variants', () => {
    const value = {
      kelly: 0.01,
      kellyFraction: 0.02,
    };

    expect(() => assertNoOddsContamination(value)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
  });

  it('accepts safe model-generated probability fields', () => {
    const value = {
      modelProbability: 0.6,
      calibratedProbability: 0.58,
      homeWinProbability: 0.61,
      awayWinProbability: 0.39,
    };

    expect(() => assertNoOddsContamination(value)).not.toThrow();
  });

  it('asserts exact static import allowlist and covers array custom properties, symbols, and accessors', () => {
    const value = {
      gamePk: 12345,
      teamId: 'LAD',
      venueId: 'LA03',
      starterStatus: 'AVAILABLE',
      researchPayload: {
        recentForm: 'clean',
      },
    };

    expect(() => assertNoOddsContamination(value)).not.toThrow();

    const customArray: unknown[] = [];
    Object.defineProperty(customArray, 'marketOdds', {
      enumerable: false,
      value: 2.1,
    });
    expect(() => assertNoOddsContamination(customArray)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const arrayError = new Error('');
    try {
      assertNoOddsContamination(customArray);
    } catch (thrown) {
      arrayError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(extractPaths(arrayError)).toEqual(['$.marketOdds']);

    const symbol = Symbol('hidden');
    const symbolArray: unknown[] = [];
    Object.defineProperty(symbolArray, symbol, {
      enumerable: false,
      value: {
        sportsbook: 'legacy',
      },
    });
    expect(() => assertNoOddsContamination(symbolArray)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const symbolError = new Error('');
    try {
      assertNoOddsContamination(symbolArray);
    } catch (thrown) {
      symbolError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(extractPaths(symbolError)).toEqual([
      `$[${String(symbol)}].sportsbook`,
    ]);

    const accessorArray: unknown[] = [];
    let accessed = false;
    Object.defineProperty(accessorArray, 'price', {
      enumerable: false,
      get() {
        accessed = true;
        return 1.5;
      },
    });
    expect(() => assertNoOddsContamination(accessorArray)).toThrow(
      'ODDS_CONTAMINATION detected',
    );
    expect(accessed).toBe(false);

    const accessorError = new Error('');
    try {
      assertNoOddsContamination(accessorArray);
    } catch (thrown) {
      accessorError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(extractPaths(accessorError)).toEqual(['$.price']);

    const numericAccessorArray: unknown[] = [];
    let numericGetterExecuted = false;
    Object.defineProperty(numericAccessorArray, '0', {
      enumerable: true,
      get() {
        numericGetterExecuted = true;
        return {
          sportsbook: 'legacy',
        };
      },
    });
    expect(() => assertNoOddsContamination(numericAccessorArray)).toThrow();
    expect(numericGetterExecuted).toBe(false);

    const safeAccessorObject: Record<string, unknown> = {};
    Object.defineProperty(safeAccessorObject, 'safeAccessor', {
      enumerable: true,
      get() {
        throw new Error('must not invoke');
      },
    });
    expect(() => assertNoOddsContamination(safeAccessorObject)).toThrow(
      'UNINSPECTABLE_ACCESSOR_PROPERTY',
    );

    const safeAccessorError = new Error('');
    try {
      assertNoOddsContamination(safeAccessorObject);
    } catch (thrown) {
      safeAccessorError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(extractPaths(safeAccessorError)).toEqual(['$.safeAccessor']);

    const safeThenProhibited: Record<string, unknown> = {};
    Object.defineProperty(safeThenProhibited, 'safeAccessor', {
      enumerable: true,
      get() {
        throw new Error('must not invoke');
      },
    });
    safeThenProhibited.marketOdds = 2.1;
    expect(() => assertNoOddsContamination(safeThenProhibited)).toThrow(
      'ODDS_CONTAMINATION detected',
    );

    const safeThenProhibitedError = new Error('');
    try {
      assertNoOddsContamination(safeThenProhibited);
    } catch (thrown) {
      safeThenProhibitedError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(extractPaths(safeThenProhibitedError)).toEqual(['$.marketOdds']);

    const multipleAccessors: Record<string, unknown> = {};
    Object.defineProperty(multipleAccessors, 'bSafe', {
      enumerable: true,
      get() {
        return 'safe';
      },
    });
    Object.defineProperty(multipleAccessors, 'aField', {
      enumerable: true,
      get() {
        return 'safe';
      },
    });

    const multipleError = new Error('');
    try {
      assertNoOddsContamination(multipleAccessors);
    } catch (thrown) {
      multipleError.message = thrown instanceof Error ? thrown.message : String(thrown);
    }
    expect(() => assertNoOddsContamination(multipleAccessors)).toThrow(
      'UNINSPECTABLE_ACCESSOR_PROPERTY',
    );
    expect(extractPaths(multipleError)).toEqual([
      '$.aField',
      '$.bSafe',
    ]);

    const setterOnlyArray: unknown[] = [];
    let setterExecuted = false;
    Object.defineProperty(setterOnlyArray, 'safeField', {
      enumerable: false,
      set(_value: unknown) {
        setterExecuted = true;
      },
    });
    expect(() => assertNoOddsContamination(setterOnlyArray)).toThrow(
      'UNINSPECTABLE_ACCESSOR_PROPERTY',
    );
    expect(setterExecuted).toBe(false);

    const setterOnlyObject: Record<string, unknown> = {};
    let objectSetterExecuted = false;
    Object.defineProperty(setterOnlyObject, 'safeField', {
      enumerable: false,
      set(_value: unknown) {
        objectSetterExecuted = true;
      },
    });
    expect(() => assertNoOddsContamination(setterOnlyObject)).toThrow(
      'UNINSPECTABLE_ACCESSOR_PROPERTY',
    );
    expect(objectSetterExecuted).toBe(false);

    const firewallSource = readFileSync(
      new URL('../../../src/prediction/firewall/odds-contamination-guard.ts', import.meta.url).pathname,
      'utf8',
    );
    const contractSource = readFileSync(
      new URL('../../../src/prediction/mlb/mlb-prediction-contract.ts', import.meta.url).pathname,
      'utf8',
    );

    const firewallImports = moduleSources(firewallSource);
    const contractImports = moduleSources(contractSource);

    expect(firewallImports).toEqual([]);
    expect(contractImports).toEqual(['../firewall/odds-contamination-guard']);

    const exportedNames = Array.from(
      firewallSource.matchAll(
        /\bexport\s+(?:type|function|class|const)\s+([A-Za-z0-9_]+)/g,
      ),
    ).map((match) => match[1]);

    expect(exportedNames).toEqual([
      'OddsContaminationViolation',
      'isProhibitedOddsKey',
      'assertNoOddsContamination',
    ]);

    expect(firewallSource).not.toMatch(
      /export\s+class\s+UninspectableAccessorPropertyError/,
    );
  });
});