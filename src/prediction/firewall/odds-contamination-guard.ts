export type OddsContaminationViolation = Readonly<{
  code: 'PROHIBITED_ODDS_KEY' | 'PROHIBITED_ODDS_STRING_VALUE';
  path: string;
  value: string;
}>;

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor {
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function rawValue(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }
  if (input === null) {
    return 'null';
  }
  return '';
}

class UninspectableAccessorPropertyError extends Error {
  constructor(paths: string[]) {
    const sorted = paths.slice().sort();
    const pathLines = sorted.map((path) => `path=${path}`).join('\n');
    super(`UNINSPECTABLE_ACCESSOR_PROPERTY\n${pathLines}\n`);
    this.name = 'UninspectableAccessorPropertyError';
  }
}

const NORMALIZED_PROHIBITED_KEYS = new Set<string>([
  'odds',
  'decimalodds',
  'fractionalodds',
  'americanodds',
  'combinedodds',
  'marketodds',
  'sportsbook',
  'bookmaker',
  'primarybookmaker',
  'bettingprice',
  'price',
  'pricing',
  'payout',
  'potentialpayout',
  'impliedprobability',
  'marketimpliedprobability',
  'marketprobability',
  'marketmovement',
  'linemovement',
  'expectedvalue',
  'valueedge',
  'edge',
  'kelly',
  'kellyfraction',
  'roi',
  'yield',
  'profit',
  'profitloss',
  'oddssampleid',
  'pricedcandidateid',
  'marketavailable',
]);

const NORMALIZED_BOUNDARY_ONLY_PROHIBITED_KEYS = new Set<string>([
  'line',
  'market',
  'value',
]);

const PROHIBITED_STRING_VALUES = new Set<string>([
  'sportsbook',
  'bookmaker',
  'decimal odds',
  'fractional odds',
  'american odds',
  'market odds',
  'betting price',
  'market-implied probability',
  'market implied probability',
  'market movement',
  'line movement',
  'expected value',
  'kelly',
  'payout',
  'potential payout',
]);

const NORMALIZED_PROHIBITED_STRING_VALUES = new Set<string>(
  Array.from(PROHIBITED_STRING_VALUES).map((value) => normalizeValue(value)),
);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

export function isProhibitedOddsKey(key: string): boolean {
  return NORMALIZED_PROHIBITED_KEYS.has(normalizeKey(key));
}

export function isProhibitedOddsBoundaryKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);

  if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
    return true;
  }

  return NORMALIZED_BOUNDARY_ONLY_PROHIBITED_KEYS.has(normalizedKey);
}

function appendViolation(
  violations: OddsContaminationViolation[],
  path: string,
  code: OddsContaminationViolation['code'],
  raw: string,
): void {
  violations.push({
    code,
    path,
    value: raw,
  });
}

function sortViolations(
  violations: OddsContaminationViolation[],
): OddsContaminationViolation[] {
  return violations.slice().sort((a, b) => {
    if (a.path < b.path) {
      return -1;
    }
    if (a.path > b.path) {
      return 1;
    }
    if (a.code < b.code) {
      return -1;
    }
    if (a.code > b.code) {
      return 1;
    }
    return 0;
  });
}

function appendAccessorPath(accessorPaths: string[], path: string): void {
  accessorPaths.push(path);
}

function sortAccessorPaths(paths: string[]): string[] {
  const unique = Array.from(new Set(paths));
  unique.sort();
  return unique;
}

function scanObject(
  violations: OddsContaminationViolation[],
  accessorPaths: string[],
  visited: WeakSet<object>,
  value: Record<string | symbol, unknown>,
  path: string,
): void {
  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    const nextPath = `${path}.${key}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (isDataDescriptor(descriptor)) {
      if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
        appendViolation(
          violations,
          nextPath,
          'PROHIBITED_ODDS_KEY',
          rawValue(descriptor.value),
        );
      }
      scanValue(violations, accessorPaths, visited, descriptor.value, nextPath);
      continue;
    }

    if (descriptor) {
      if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
        appendViolation(violations, nextPath, 'PROHIBITED_ODDS_KEY', '');
      }
      appendAccessorPath(accessorPaths, nextPath);
    }
  }

  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    const nextPath = `${path}[${String(symbol)}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, symbol);

    if (isDataDescriptor(descriptor)) {
      scanValue(violations, accessorPaths, visited, descriptor.value, nextPath);
      continue;
    }

    if (descriptor) {
      appendAccessorPath(accessorPaths, nextPath);
    }
  }
}

function scanArray(
  violations: OddsContaminationViolation[],
  accessorPaths: string[],
  visited: WeakSet<object>,
  value: unknown[],
  path: string,
): void {
  const ownKeys = Object.getOwnPropertyNames(value);
  for (const key of ownKeys) {
    if (key === 'length') {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const normalizedKey = normalizeKey(key);

    if (/^\d+$/.test(key)) {
      const nextPath = `${path}[${key}]`;

      if (isDataDescriptor(descriptor)) {
        scanValue(violations, accessorPaths, visited, descriptor.value, nextPath);
        continue;
      }

      if (descriptor) {
        if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
          appendViolation(violations, nextPath, 'PROHIBITED_ODDS_KEY', '');
        }
        appendAccessorPath(accessorPaths, nextPath);
      }
      continue;
    }

    const nextPath = `${path}.${key}`;

    if (isDataDescriptor(descriptor)) {
      if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
        appendViolation(
          violations,
          nextPath,
          'PROHIBITED_ODDS_KEY',
          rawValue(descriptor.value),
        );
      }
      scanValue(
        violations,
        accessorPaths,
        visited,
        descriptor.value,
        nextPath,
      );
      continue;
    }

    if (descriptor) {
      if (NORMALIZED_PROHIBITED_KEYS.has(normalizedKey)) {
        appendViolation(violations, nextPath, 'PROHIBITED_ODDS_KEY', '');
      }
      appendAccessorPath(accessorPaths, nextPath);
    }
  }

  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    const nextPath = `${path}[${String(symbol)}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, symbol);

    if (isDataDescriptor(descriptor)) {
      scanValue(violations, accessorPaths, visited, descriptor.value, nextPath);
      continue;
    }

    if (descriptor) {
      appendAccessorPath(accessorPaths, nextPath);
    }
  }
}

function scanValue(
  violations: OddsContaminationViolation[],
  accessorPaths: string[],
  visited: WeakSet<object>,
  value: unknown,
  path: string,
): void {
  if (typeof value === 'string') {
    const normalizedValue = normalizeValue(value);
    if (NORMALIZED_PROHIBITED_STRING_VALUES.has(normalizedValue)) {
      appendViolation(violations, path, 'PROHIBITED_ODDS_STRING_VALUE', value);
    }
    return;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return;
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);
    try {
      scanArray(violations, accessorPaths, visited, value, path);
    } finally {
      visited.delete(value);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (visited.has(value)) {
    return;
  }

  visited.add(value);
  try {
    scanObject(violations, accessorPaths, visited, value, path);
  } finally {
    visited.delete(value);
  }
}

export function assertNoOddsContamination(value: unknown): void {
  const violations: OddsContaminationViolation[] = [];
  const accessorPaths: string[] = [];
  const visited = new WeakSet<object>();

  scanValue(violations, accessorPaths, visited, value, '$');

  if (violations.length > 0) {
    const sorted = sortViolations(violations);
    const lines = sorted.map(
      (violation) =>
        `path=${violation.path}; code=${violation.code}; value=${violation.value}`,
    );

    throw new Error(
      `ODDS_CONTAMINATION detected\n${lines.join('\n')}\n`,
    );
  }

  if (accessorPaths.length > 0) {
    const uniqueSorted = sortAccessorPaths(accessorPaths);
    throw new UninspectableAccessorPropertyError(uniqueSorted);
  }
}