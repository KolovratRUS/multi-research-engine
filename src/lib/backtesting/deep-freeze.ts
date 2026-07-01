export function deepFreeze<T>(value: T): Readonly<T> {
  if (value instanceof Date || typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    Object.freeze(value);
    for (let i = 0; i < value.length; i++) {
      deepFreeze(value[i]);
    }
    return value as Readonly<T>;
  }
  Object.freeze(value);
  const names = Object.getOwnPropertyNames(value);
  for (const name of names) {
    deepFreeze((value as Record<string, unknown>)[name]);
  }
  return value as Readonly<T>;
}

export function deepClone(value: unknown): unknown {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  if (value && typeof value === 'object') {
    const cloned: Record<string, unknown> = {};
    const source = value as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      cloned[key] = deepClone(source[key]);
    }
    return cloned;
  }
  return value;
}