import type { Schema } from './types.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number' && Number.isInteger(v)) return 'integer';
  return typeof v;
}

function typeMatches(v: unknown, t: string): boolean {
  switch (t) {
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'string':
      return typeof v === 'string';
    case 'boolean':
      return typeof v === 'boolean';
    case 'object':
      return isObject(v);
    case 'array':
      return Array.isArray(v);
    case 'null':
      return v === null;
    default:
      return true; // unknown type keyword: don't reject
  }
}

function checkString(v: string, s: Schema): boolean {
  const len = Array.from(v).length;
  if (typeof s.minLength === 'number' && len < s.minLength) return false;
  if (typeof s.maxLength === 'number' && len > s.maxLength) return false;
  if (typeof s.pattern === 'string') {
    try {
      if (!new RegExp(s.pattern).test(v)) return false;
    } catch {
      /* invalid regex in schema: ignore */
    }
  }
  return true;
}

function checkNumber(v: number, s: Schema): boolean {
  const min = typeof s.minimum === 'number' ? s.minimum : undefined;
  const max = typeof s.maximum === 'number' ? s.maximum : undefined;
  const exclMin =
    typeof s.exclusiveMinimum === 'number'
      ? s.exclusiveMinimum
      : s.exclusiveMinimum === true && min !== undefined
        ? min
        : undefined;
  const exclMax =
    typeof s.exclusiveMaximum === 'number'
      ? s.exclusiveMaximum
      : s.exclusiveMaximum === true && max !== undefined
        ? max
        : undefined;
  if (exclMin !== undefined && !(v > exclMin)) return false;
  if (exclMax !== undefined && !(v < exclMax)) return false;
  if (min !== undefined && exclMin === undefined && v < min) return false;
  if (max !== undefined && exclMax === undefined && v > max) return false;
  if (typeof s.multipleOf === 'number' && s.multipleOf !== 0) {
    const q = v / s.multipleOf;
    if (Math.abs(q - Math.round(q)) > 1e-9) return false;
  }
  return true;
}

function checkArray(v: unknown[], s: Schema): boolean {
  if (typeof s.minItems === 'number' && v.length < s.minItems) return false;
  if (typeof s.maxItems === 'number' && v.length > s.maxItems) return false;
  if (s.uniqueItems === true) {
    for (let i = 0; i < v.length; i++) {
      for (let j = i + 1; j < v.length; j++) {
        if (deepEqual(v[i], v[j])) return false;
      }
    }
  }
  if (isObject(s.items) || typeof s.items === 'boolean') {
    return v.every((item) => validate(item, s.items as Schema));
  }
  return true;
}

function checkObject(v: Record<string, unknown>, s: Schema): boolean {
  const keys = Object.keys(v);
  if (typeof s.minProperties === 'number' && keys.length < s.minProperties) return false;
  if (typeof s.maxProperties === 'number' && keys.length > s.maxProperties) return false;
  if (Array.isArray(s.required)) {
    for (const r of s.required) {
      if (typeof r === 'string' && !(r in v)) return false;
    }
  }
  const props = isObject(s.properties) ? s.properties : {};
  for (const [k, val] of Object.entries(v)) {
    if (k in props) {
      if (!validate(val, props[k] as Schema)) return false;
    } else if (s.additionalProperties === false) {
      return false;
    } else if (isObject(s.additionalProperties) || typeof s.additionalProperties === 'boolean') {
      if (!validate(val, s.additionalProperties as Schema)) return false;
    }
  }
  return true;
}

/**
 * Validate a value against the supported subset of JSON Schema:
 * type, enum, const, required, properties, additionalProperties, items,
 * min/maxItems, uniqueItems, min/maxLength, pattern, minimum/maximum,
 * exclusiveMinimum/Maximum (both draft forms), multipleOf,
 * min/maxProperties. Boolean schemas are honored. Unknown keywords are
 * ignored. Returns a boolean, not an error list.
 */
export function validate(value: unknown, schema: Schema | boolean): boolean {
  if (schema === true) return true;
  if (schema === false) return false;
  if (!isObject(schema)) return true;

  if ('const' in schema && !deepEqual(value, schema.const)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => deepEqual(e, value))) return false;

  const t = schema.type;
  const types = Array.isArray(t) ? t : typeof t === 'string' ? [t] : [];
  if (types.length > 0 && !types.some((tt) => typeMatches(value, String(tt)))) return false;

  const vt = typeOf(value);
  if (vt === 'string' && checkString(value as string, schema) === false) return false;
  if ((vt === 'number' || vt === 'integer') && checkNumber(value as number, schema) === false) return false;
  if (vt === 'array' && checkArray(value as unknown[], schema) === false) return false;
  if (vt === 'object' && checkObject(value as Record<string, unknown>, schema) === false) return false;

  return true;
}
