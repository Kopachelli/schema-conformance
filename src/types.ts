/** A JSON-Schema-ish object. We intentionally accept `unknown`-ish shapes. */
export type Schema = Record<string, unknown>;

export type DiagnosticCode =
  | 'constraint-dropped'
  | 'constraint-changed'
  | 'property-dropped'
  | 'structure-changed';

export interface Diagnostic {
  code: DiagnosticCode;
  /** JSON path of the offending node, e.g. `$.properties.items.maxItems`. */
  path: string;
  message: string;
  keyword?: string;
}

export interface CounterExample {
  /** A value accepted by `original` but rejected by `converted`. */
  value: unknown;
}

export interface CorpusCase {
  name: string;
  description?: string;
  original: Schema;
  /** The converted form this case expects the checker to evaluate. */
  converted: Schema;
  /** Expected diagnostic codes, in any order. Empty array = clean conversion. */
  expect: DiagnosticCode[];
}

export interface ProfileResult {
  name: string;
  passed: boolean;
  diagnostics: Diagnostic[];
  counterExample?: CounterExample | null;
}
