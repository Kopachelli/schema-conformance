import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkConversion,
  findCounterexample,
  profileConverter,
  runCorpus,
  validate,
  CORPUS,
} from '../dist/esm/index.js';

test('corpus self-check: every case produces its expected diagnostics', () => {
  const results = runCorpus();
  const failed = results.filter((r) => !r.passed);
  assert.deepEqual(
    failed.map((f) => ({ name: f.name, codes: f.diagnostics.map((d) => `${d.code}@${d.path}`) })),
    [],
  );
});

test('identity converter profiles clean on the corpus', () => {
  const results = profileConverter((s) => s);
  assert.ok(results.every((r) => r.passed));
});

test('lossy converter is flagged with counterexamples', () => {
  const results = profileConverter((s) => {
    const clone = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete clone.maxItems;
    delete clone.pattern;
    delete clone.minimum;
    delete clone.maximum;
    delete clone.maxLength;
    delete clone.minLength;
    if (clone.type === 'object' && clone.properties && typeof clone.properties === 'object') {
      delete (clone.properties as Record<string, unknown>).drop;
      delete clone.additionalProperties;
    }
    return clone;
  });
  const failed = results.filter((r) => !r.passed);
  assert.ok(failed.length > 0, 'expected the lossy converter to fail somewhere');
  // The clean-passthrough case should fail too (its constraints get stripped).
  assert.ok(failed.some((r) => r.name === 'clean-passthrough'));
});

test('checkConversion reports dropped and changed constraints with paths', () => {
  const diags = checkConversion(
    { type: 'object', properties: { n: { type: 'integer', minimum: 5 } }, required: ['n'] },
    { type: 'object', properties: { n: { type: 'integer' } } },
  );
  assert.ok(diags.some((d) => d.code === 'constraint-dropped' && d.path === '$.properties.n.minimum'));
  assert.ok(diags.some((d) => d.code === 'constraint-changed' && d.path === '$.required') === false);
});

test('findCounterexample proves acceptance drift on narrowing', () => {
  // Widening (dropped constraints) is caught statically by checkConversion;
  // counterexamples prove the opposite drift: values the original
  // accepted that the conversion now rejects.
  const original = { type: 'string' };
  const converted = { type: 'string', maxLength: 2 };
  const ce = findCounterexample(original, converted);
  assert.ok(ce !== null);
  assert.equal(validate(ce.value, original), true);
  assert.equal(validate(ce.value, converted), false);
});

test('findCounterexample returns null for equivalent schemas', () => {
  const s = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] };
  assert.equal(findCounterexample(s, JSON.parse(JSON.stringify(s))), null);
});

test('validate covers the supported keyword subset', () => {
  assert.equal(validate(5, { type: 'integer', minimum: 0, maximum: 10 }), true);
  assert.equal(validate(5.5, { type: 'integer' }), false);
  assert.equal(validate('abc', { type: 'string', pattern: '^[a-z]+$' }), true);
  assert.equal(validate('ABC', { type: 'string', pattern: '^[a-z]+$' }), false);
  assert.equal(validate([1, 2], { type: 'array', minItems: 3 }), false);
  assert.equal(validate({ a: 1, b: 2 }, { type: 'object', additionalProperties: false, properties: { a: { type: 'number' } } }), false);
  assert.equal(validate({ a: 'x' }, { enum: [{ a: 'x' }] }), true);
  assert.equal(validate('x', { const: 'y' }), false);
  assert.equal(validate(7, { type: 'number', exclusiveMinimum: 10 }), false);
});

test('corpus contains the expected number of cases', () => {
  assert.ok(CORPUS.length >= 8);
});
