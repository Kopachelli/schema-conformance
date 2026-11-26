// Audit a schema converter the way an SDK maintainer would in CI:
// run the shared corpus through your converter and see exactly which
// constraints it drops.
//
// Run:  npm install && npm run build && node examples/profile-converter.mjs
import { profileConverter, runCorpus } from 'schema-conformance';

// A deliberately naive "converter" that strips everything except type —
// the kind of loss that ships silently through SDK/provider pipelines.
const naiveConverter = (schema) => {
  const clone = JSON.parse(JSON.stringify(schema));
  const strip = (node) => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (['minItems', 'maxItems', 'minLength', 'maxLength', 'pattern',
             'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
             'multipleOf', 'enum', 'const', 'uniqueItems',
             'additionalProperties', 'required'].includes(k)) {
          delete node[k];
        } else {
          node[k] = strip(node[k]);
        }
      }
    }
    return node;
  };
  return strip(clone);
};

console.log('--- corpus self-check (checker sanity) ---');
for (const r of runCorpus()) {
  console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
}

console.log('\n--- profiling naiveConverter ---');
for (const r of profileConverter(naiveConverter)) {
  const codes = r.diagnostics.map((d) => `${d.code}@${d.path}`).join(', ') || 'clean';
  console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name}: ${codes}`);
  if (r.counterExample) console.log(`      counterexample: ${JSON.stringify(r.counterExample.value)}`);
}
