import type { Diagnostic, Schema } from './types.js';

/** Keywords that carry constraints we compare. */
const CONSTRAINT_KEYWORDS = new Set([
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minProperties',
  'maxProperties',
]);

/** Annotation/metadata keywords ignored entirely. */
const IGNORED_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
  'format',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stableString(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableString).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableString(o[k])}`)
    .join(',')}}`;
}

function eq(a: unknown, b: unknown): boolean {
  return stableString(a) === stableString(b);
}

function childPath(base: string, key: string): string {
  return `${base}.${key}`;
}

function checkNode(
  original: Schema,
  converted: unknown,
  path: string,
  out: Diagnostic[],
): void {
  if (!isObject(converted)) {
    out.push({
      code: 'structure-changed',
      path,
      message: `Schema node became ${converted === null ? 'null' : typeof converted} instead of an object.`,
    });
    return;
  }

  for (const [keyword, origValue] of Object.entries(original)) {
    if (IGNORED_KEYWORDS.has(keyword)) continue;

    if (keyword === 'properties' && isObject(origValue)) {
      const convProps = isObject(converted.properties) ? converted.properties : null;
      for (const [prop, propSchema] of Object.entries(origValue)) {
        if (!convProps || !(prop in convProps)) {
          out.push({
            code: 'property-dropped',
            path: childPath(path === '$' ? '$.properties' : `${path}.properties`, prop),
            message: `Property "${prop}" was dropped during conversion.`,
            keyword: 'properties',
          });
        } else {
          checkNode(propSchema as Schema, convProps[prop], childPath(childPath(path, 'properties'), prop), out);
        }
      }
      continue;
    }

    if (keyword === 'items') {
      if (Array.isArray(origValue)) {
        // Tuple form.
        const convItems = converted.items;
        if (!Array.isArray(convItems) || convItems.length !== origValue.length) {
          out.push({
            code: 'constraint-changed',
            path: childPath(path, 'items'),
            message: 'Tuple items changed shape during conversion.',
            keyword: 'items',
          });
        } else {
          origValue.forEach((sub, i) =>
            checkNode(sub as Schema, convItems[i], `${childPath(path, 'items')}[${i}]`, out),
          );
        }
      } else if (isObject(origValue)) {
        checkNode(origValue, converted.items, childPath(path, 'items'), out);
      }
      continue;
    }

    if (!CONSTRAINT_KEYWORDS.has(keyword)) continue;

    const convValue = converted[keyword];
    const equal =
      keyword === 'required' && Array.isArray(origValue) && Array.isArray(convValue)
        ? eq([...(origValue as string[])].sort(), [...(convValue as string[])].sort())
        : eq(origValue, convValue);
    if (convValue === undefined) {
      out.push({
        code: 'constraint-dropped',
        path: childPath(path, keyword),
        message: `Constraint "${keyword}" was dropped during conversion.`,
        keyword,
      });
    } else if (!equal) {
      out.push({
        code: 'constraint-changed',
        path: childPath(path, keyword),
        message: `Constraint "${keyword}" changed during conversion.`,
        keyword,
      });
    }
  }
}

/**
 * Compare an original tool schema against its converted form and report
 * every constraint that was dropped or altered. Directional: it detects
 * losses relative to `original`; constraints a converter *adds* are not
 * reported (except where they alter a compared keyword).
 *
 * This is a diagnostic aid, not a proof: two schemas can produce the
 * same diagnostics and still differ on keywords outside the supported set.
 */
export function checkConversion(original: Schema, converted: Schema): Diagnostic[] {
  const out: Diagnostic[] = [];
  checkNode(original, converted, '$', out);
  return out;
}
