import { checkConversion } from './check.js';
import { CORPUS } from './corpus.js';
import { sample } from './sample.js';
import { validate } from './validate.js';
import type { CorpusCase, CounterExample, Diagnostic, ProfileResult, Schema } from './types.js';

export { checkConversion } from './check.js';
export { validate } from './validate.js';
export { sample } from './sample.js';
export { CORPUS } from './corpus.js';
export type {
  CorpusCase,
  CounterExample,
  Diagnostic,
  DiagnosticCode,
  ProfileResult,
  Schema,
} from './types.js';

function sameCodes(a: Diagnostic[], b: string[]): boolean {
  const got = [...new Set(a.map((d) => d.code))].sort();
  const want = [...new Set(b)].sort();
  return got.length === want.length && got.every((c, i) => c === want[i]);
}

/**
 * Find a value accepted by `original` but rejected by `converted`,
 * proving acceptance behavior drifted. Returns null when no counterexample
 * is found within the sample budget (not a proof of equivalence).
 */
export function findCounterexample(
  original: Schema,
  converted: Schema,
  maxSamples = 256,
): CounterExample | null {
  for (const v of sample(original, maxSamples)) {
    if (validate(v, original) && !validate(v, converted)) {
      return { value: v };
    }
  }
  return null;
}

/**
 * Self-check: run checkConversion over the stored corpus pairs and
 * verify the diagnostics match each case's expectations. Use in CI to
 * catch regressions in the checker itself.
 */
export function runCorpus(cases: CorpusCase[] = CORPUS): ProfileResult[] {
  return cases.map((c) => {
    const diagnostics = checkConversion(c.original, c.converted);
    return {
      name: c.name,
      passed: sameCodes(diagnostics, c.expect),
      diagnostics,
      counterExample: c.expect.length === 0 ? null : findCounterexample(c.original, c.converted),
    };
  });
}

/**
 * Profile a converter function against the corpus. For each case the
 * converter transforms `original`; we report the diagnostics and a
 * counterexample when one exists. `passed` is true only when the
 * conversion produced no diagnostics — i.e. no supported constraint
 * was lost or altered.
 */
export function profileConverter(
  convert: (original: Schema) => Schema,
  cases: CorpusCase[] = CORPUS,
): ProfileResult[] {
  return cases.map((c) => {
    const converted = convert(c.original);
    const diagnostics = checkConversion(c.original, converted);
    return {
      name: c.name,
      passed: diagnostics.length === 0,
      diagnostics,
      counterExample: findCounterexample(c.original, converted),
    };
  });
}
