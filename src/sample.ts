import { validate } from './validate.js';
import type { Schema } from './types.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strRep(s: string): string {
  return JSON.stringify(s.length > 40 ? s.slice(0, 40) + '…' : s);
}

/**
 * Generate a bounded set of probe values for a schema: boundary values
 * derived from its constraints plus a few generic ones. Deterministic.
 * Used to find counterexamples after conversion.
 */
export function sample(schema: Schema | boolean, max = 64): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    const k = strRep(JSON.stringify(v) ?? 'undefined');
    if (!seen.has(k) && out.length < max) {
      seen.add(k);
      out.push(v);
    }
  };
  collect(schema, push);
  // Keep only values the original schema accepts — probes may violate
  // unconstrained parts; filtering keeps counterexample search honest.
  return out.filter((v) => validate(v, schema));
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function collect(schema: Schema | boolean, push: (v: unknown) => void): void {
  if (schema === true) {
    push(null); push(true); push(false); push(0); push(''); push('a'); push('123'); push([]); push({});
    return;
  }
  if (schema === false || !isObject(schema)) return;

  const t = schema.type;
  const types = Array.isArray(t) ? t.map(String) : typeof t === 'string' ? [t] : [];
  const wants = (name: string) => types.length === 0 || types.includes(name);
  // Scalar probes guided by constraints.
  if (wants('string')) {
    const minLen = num(schema.minLength) ?? 0;
    const maxLen = num(schema.maxLength);
    push('');
    push('a');
    push('abc');
    push('123');
    push('A'.repeat(Math.min(minLen, 200)));
    if (maxLen !== undefined) push('b'.repeat(Math.min(maxLen, 200)));
    if (minLen > 0) push('x'.repeat(Math.min(minLen + 1, 200)));
  }
  if (wants('number') || wants('integer')) {
    const min = num(schema.minimum);
    const max = num(schema.maximum);
    const exclMin = typeof schema.exclusiveMinimum === 'number' ? schema.exclusiveMinimum : undefined;
    const exclMax = typeof schema.exclusiveMaximum === 'number' ? schema.exclusiveMaximum : undefined;
    const lo = exclMin ?? min;
    const hi = exclMax ?? max;
    for (const v of [0, 1, -1, 2.5, -2.5, lo, hi, lo !== undefined ? lo + 1 : undefined, hi !== undefined ? hi - 1 : undefined]) {
      if (v === undefined) continue;
      if (wants('integer') && !Number.isInteger(v)) {
        push(Math.trunc(v));
      } else {
        push(v);
      }
    }
    if (typeof schema.multipleOf === 'number') {
      push(schema.multipleOf);
      push(schema.multipleOf * 2);
    }
  }
  if (wants('boolean')) {
    push(true); push(false);
  }
  if (wants('null')) push(null);

  if (wants('array')) {
    const minItems = num(schema.minItems) ?? 0;
    const maxItems = num(schema.maxItems);
    const itemSchema = isObject(schema.items) ? (schema.items as Schema) : true;
    const itemProbes = sample(itemSchema, 8);
    const mk = (n: number, fill: unknown) => Array.from({ length: n }, () => fill);
    push([]);
    if (itemProbes.length > 0) {
      push([itemProbes[0]]);
      push(mk(Math.max(minItems, 1), itemProbes[0]));
      if (maxItems !== undefined) push(mk(Math.min(maxItems, 10), itemProbes[0]));
    }
    if (minItems > 1 && itemProbes.length > 0) {
      push(mk(minItems, itemProbes[0]));
      if (itemProbes.length > 1) push(mk(minItems, itemProbes[1 % itemProbes.length]));
    }
  }

  if (wants('object')) {
    const props = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === 'string') : [];
    push({});

    const base: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const probes = sample(props[key] as Schema, 4);
      if (probes.length > 0) base[key] = probes[0];
    }
    push({ ...base });

    // Required-only variant: drop optional props.
    const reqOnly: Record<string, unknown> = {};
    for (const key of required) {
      if (key in props) {
        const probes = sample(props[key] as Schema, 4);
        if (probes.length > 0) reqOnly[key] = probes[0];
      } else {
        reqOnly[key] = null;
      }
    }
    push(reqOnly);

    // Extra property to probe additionalProperties.
    push({ ...base, __extra_probe: 'x' });
    push({ ...reqOnly, __extra_probe: 1 });
  }

  // enum/const probes: exact values are already valid candidates.
  if (Array.isArray(schema.enum)) {
    for (const e of schema.enum.slice(0, 16)) push(e);
  }
  if ('const' in schema) push(schema.const);
}
