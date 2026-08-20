import {
  computeMLBInnerDevelopmentTrainArtifactSHA256,
  serializeMLBInnerDevelopmentTrainArtifact,
  validateMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifactIssue,
} from './mlb-inner-development-train-artifact';

export type MLBInnerDevelopmentTrainArtifactReader = (
  sourcePath: string,
) => Promise<Uint8Array>;

export type MLBInnerDevelopmentTrainArtifactSourceConfig = Readonly<{
  sourcePath: string;
  expectedArtifactSha256: string;
}>;

export type MLBInnerDevelopmentTrainArtifactProviderIssue = Readonly<{
  code:
    | 'INVALID_SOURCE_CONFIGURATION'
    | 'TRAIN_ARTIFACT_LOAD_FAILED'
    | 'TRAIN_ARTIFACT_HASH_MISMATCH'
    | 'TRAIN_ARTIFACT_UTF8_DECODE_FAILED'
    | 'TRAIN_ARTIFACT_JSON_PARSE_FAILED'
    | 'TRAIN_ARTIFACT_CONTRACT_INVALID'
    | 'TRAIN_ARTIFACT_NON_CANONICAL_BYTES'
    | 'INVARIANT_VIOLATION';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentTrainArtifactProviderResult =
  | Readonly<{
      ok: true;
      artifact: MLBInnerDevelopmentTrainArtifact;
      verifiedSha256: string;
      byteLength: number;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBInnerDevelopmentTrainArtifactProviderIssue[];
    }>;

const HEXADECIMAL_PATTERN = /^[0-9a-f]{64}$/;
const ALLOWED_CONFIG_FIELDS = new Set([
  'sourcePath',
  'expectedArtifactSha256',
]);

function pushProviderIssue(
  issues: MLBInnerDevelopmentTrainArtifactProviderIssue[],
  code: MLBInnerDevelopmentTrainArtifactProviderIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message } as MLBInnerDevelopmentTrainArtifactProviderIssue);
}

function sortProviderIssues(
  issues: MLBInnerDevelopmentTrainArtifactProviderIssue[],
): readonly MLBInnerDevelopmentTrainArtifactProviderIssue[] {
  return issues.sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return a.path.localeCompare(b.path);
  });
}

function getOwnDataPropertyNames(value: object): string[] {
  const names: string[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'string') {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && descriptor.value !== undefined && !descriptor.get && !descriptor.set) {
        names.push(key);
      }
    }
  }
  return names;
}

function safeGetPrototypeOf(value: unknown): unknown {
  try {
    return Object.getPrototypeOf(value as object);
  } catch {
    return new Error('getPrototypeOf trapped');
  }
}

function safeOwnKeys(value: object): unknown {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return new Error('ownKeys trapped');
  }
}

function safeGetOwnPropertyDescriptor(
  value: object,
  key: PropertyKey,
): unknown {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return new Error('getOwnPropertyDescriptor trapped');
  }
}

function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = safeGetPrototypeOf(value);
  if (proto instanceof Error) return false;
  return proto === null || proto === Object.prototype;
}

function validateSourceConfig(
  rawConfig: unknown,
): MLBInnerDevelopmentTrainArtifactProviderIssue[] {
  const issues: MLBInnerDevelopmentTrainArtifactProviderIssue[] = [];

  if (!isPlainObject(rawConfig)) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$',
      'Source configuration must be a plain object',
    );
    return issues;
  }

  const ownKeysResult = safeOwnKeys(rawConfig as object);
  if (ownKeysResult instanceof Error) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$',
      'Source configuration reflection failed',
    );
    return issues;
  }

  const ownKeys = ownKeysResult as PropertyKey[];
  const allowedKeys = new Set<PropertyKey>(['sourcePath', 'expectedArtifactSha256']);
  for (const key of ownKeys) {
    if (!allowedKeys.has(key)) {
      pushProviderIssue(
        issues,
        'INVALID_SOURCE_CONFIGURATION',
        typeof key === 'symbol' ? '$[symbol]' : `$.${String(key)}`,
        `Unknown configuration field: ${String(key)}`,
      );
    }
  }

  const sourcePathDescriptorResult = safeGetOwnPropertyDescriptor(rawConfig as object, 'sourcePath');
  if (sourcePathDescriptorResult instanceof Error) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$.sourcePath',
      'Source configuration reflection failed',
    );
    return issues;
  }

  const sourcePathDescriptor = sourcePathDescriptorResult as PropertyDescriptor | undefined;
  if (!sourcePathDescriptor || sourcePathDescriptor.get || sourcePathDescriptor.set) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$.sourcePath',
      'sourcePath must be an own data property',
    );
  } else {
    const sourcePath = sourcePathDescriptor.value;
    if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
      pushProviderIssue(
        issues,
        'INVALID_SOURCE_CONFIGURATION',
        '$.sourcePath',
        'sourcePath must be a non-empty string',
      );
    }
  }

  const expectedShaDescriptorResult = safeGetOwnPropertyDescriptor(rawConfig as object, 'expectedArtifactSha256');
  if (expectedShaDescriptorResult instanceof Error) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$.expectedArtifactSha256',
      'Source configuration reflection failed',
    );
    return issues;
  }

  const expectedShaDescriptor = expectedShaDescriptorResult as PropertyDescriptor | undefined;
  if (!expectedShaDescriptor || expectedShaDescriptor.get || expectedShaDescriptor.set) {
    pushProviderIssue(
      issues,
      'INVALID_SOURCE_CONFIGURATION',
      '$.expectedArtifactSha256',
      'expectedArtifactSha256 must be an own data property',
    );
  } else {
    const expectedArtifactSha256 = expectedShaDescriptor.value;
    if (
      typeof expectedArtifactSha256 !== 'string' ||
      !HEXADECIMAL_PATTERN.test(expectedArtifactSha256)
    ) {
      pushProviderIssue(
        issues,
        'INVALID_SOURCE_CONFIGURATION',
        '$.expectedArtifactSha256',
        'expectedArtifactSha256 must be exactly 64 lowercase hexadecimal characters',
      );
    }
  }

  return issues;
}

export async function loadMLBInnerDevelopmentTrainArtifact(
  rawConfig: unknown,
  reader: unknown,
): Promise<MLBInnerDevelopmentTrainArtifactProviderResult> {
  const configIssues = validateSourceConfig(rawConfig);
  if (configIssues.length > 0) {
    return { ok: false, issues: sortProviderIssues(configIssues) };
  }

  const config = rawConfig as MLBInnerDevelopmentTrainArtifactSourceConfig;

  if (typeof reader !== 'function') {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'INVARIANT_VIOLATION',
          path: '$',
          message: 'Reader must be a function',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  let loadedBytes: Uint8Array;
  try {
    loadedBytes = await reader(config.sourcePath);
  } catch (error) {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'TRAIN_ARTIFACT_LOAD_FAILED',
          path: '$',
          message: 'Reader failed to load artifact bytes',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  if (!(loadedBytes instanceof Uint8Array)) {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'INVARIANT_VIOLATION',
          path: '$',
          message: 'Reader must return Uint8Array',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  const actualSha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(loadedBytes);
  if (actualSha256 !== config.expectedArtifactSha256) {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'TRAIN_ARTIFACT_HASH_MISMATCH',
          path: '$',
          message: 'Loaded artifact SHA-256 does not match expected trusted hash',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  let text: string;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(loadedBytes);
  } catch {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'TRAIN_ARTIFACT_UTF8_DECODE_FAILED',
          path: '$',
          message: 'Loaded bytes are not valid UTF-8',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'TRAIN_ARTIFACT_JSON_PARSE_FAILED',
          path: '$',
          message: 'Loaded artifact is not valid JSON',
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  const validationResult = validateMLBInnerDevelopmentTrainArtifact(parsed);
  if (!validationResult.ok) {
    return {
      ok: false,
      issues: sortProviderIssues(
        validationResult.issues.map(
          (issue) =>
            ({
              code: 'TRAIN_ARTIFACT_CONTRACT_INVALID',
              path: issue.path,
              message: `${issue.code}: ${issue.message}`,
            } as MLBInnerDevelopmentTrainArtifactProviderIssue),
        ),
      ),
    };
  }

  const canonicalText = serializeMLBInnerDevelopmentTrainArtifact(validationResult.value);
  const canonicalBytes = new TextEncoder().encode(canonicalText);

  if (loadedBytes.length !== canonicalBytes.length) {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'TRAIN_ARTIFACT_NON_CANONICAL_BYTES',
          path: '$',
          message: `Loaded byte length ${loadedBytes.length} does not match canonical byte length ${canonicalBytes.length}`,
        } as MLBInnerDevelopmentTrainArtifactProviderIssue,
      ]),
    };
  }

  for (let index = 0; index < loadedBytes.length; index += 1) {
    if (loadedBytes[index] !== canonicalBytes[index]) {
      return {
        ok: false,
        issues: sortProviderIssues([
          {
            code: 'TRAIN_ARTIFACT_NON_CANONICAL_BYTES',
            path: '$',
            message: `Byte mismatch at offset ${index}`,
          } as MLBInnerDevelopmentTrainArtifactProviderIssue,
        ]),
      };
    }
  }

  return {
    ok: true,
    artifact: validationResult.value,
    verifiedSha256: actualSha256,
    byteLength: loadedBytes.length,
  };
}
