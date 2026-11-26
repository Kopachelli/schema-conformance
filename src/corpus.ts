import type { CorpusCase, Schema } from './types.js';

const obj = (properties: Record<string, Schema>, required: string[] = [], extra: Record<string, unknown> = {}): Schema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});

/**
 * Shared conformance corpus. Each case pairs an original tool schema
 * with a converted form and the diagnostics the comparison must
 * produce. Maintainers run runCorpus() in CI as a smoke test, and
 * profileConverter() to audit their own converters.
 */
export const CORPUS: CorpusCase[] = [
  {
    name: 'array-maxItems-dropped',
    description: 'Converter drops maxItems from an array schema.',
    original: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    converted: { type: 'array', items: { type: 'string' } },
    expect: ['constraint-dropped'],
  },
  {
    name: 'string-pattern-dropped',
    description: 'Converter drops the pattern constraint.',
    original: { type: 'string', pattern: '^[a-z]+$' },
    converted: { type: 'string' },
    expect: ['constraint-dropped'],
  },
  {
    name: 'enum-narrowed',
    description: 'Converter narrows an enum from three values to two.',
    original: { type: 'string', enum: ['red', 'green', 'blue'] },
    converted: { type: 'string', enum: ['red', 'green'] },
    expect: ['constraint-changed'],
  },
  {
    name: 'additionalProperties-weakened',
    description: 'additionalProperties: false becomes unconstrained.',
    original: obj({ a: { type: 'string' } }, ['a'], { additionalProperties: false }),
    converted: obj({ a: { type: 'string' } }, ['a']),
    expect: ['constraint-dropped'],
  },
  {
    name: 'required-added',
    description: 'Converter adds a required property the original did not require.',
    original: obj({ a: { type: 'string' }, b: { type: 'number' } }, ['a']),
    converted: obj({ a: { type: 'string' }, b: { type: 'number' } }, ['a', 'b']),
    expect: ['constraint-changed'],
  },
  {
    name: 'minimum-dropped',
    description: 'Numeric lower bound is lost.',
    original: { type: 'number', minimum: 0, maximum: 100 },
    converted: { type: 'number', maximum: 100 },
    expect: ['constraint-dropped'],
  },
  {
    name: 'property-schema-dropped',
    description: 'A property definition is removed entirely.',
    original: obj(
      { keep: { type: 'string' }, drop: { type: 'integer', minimum: 1 } },
      ['keep'],
    ),
    converted: obj({ keep: { type: 'string' } }, ['keep']),
    expect: ['property-dropped'],
  },
  {
    name: 'nested-items-constraint-lost',
    description: 'Constraint inside items schema is lost one level down.',
    original: {
      type: 'object',
      properties: {
        scores: { type: 'array', items: { type: 'number', minimum: 0, maximum: 10 } },
      },
      required: ['scores'],
    },
    converted: {
      type: 'object',
      properties: {
        scores: { type: 'array', items: { type: 'number' } },
      },
      required: ['scores'],
    },
    expect: ['constraint-dropped'],
  },
  {
    name: 'clean-passthrough',
    description: 'Identity conversion must produce zero diagnostics.',
    original: obj(
      {
        name: { type: 'string', minLength: 1, maxLength: 50 },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        score: { type: 'number', minimum: 0, maximum: 1 },
      },
      ['name'],
      { additionalProperties: false },
    ),
    converted: obj(
      {
        name: { type: 'string', minLength: 1, maxLength: 50 },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        score: { type: 'number', minimum: 0, maximum: 1 },
      },
      ['name'],
      { additionalProperties: false },
    ),
    expect: [],
  },
];
