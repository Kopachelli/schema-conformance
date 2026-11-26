# Maintainer outreach drafts

Ready-to-post pitches for SDK/gateway maintainers. Post as a GitHub issue or
discussion — adjust the bracketed bits per target. Tone: offer a tool, not a
request.

---

## Draft 1 — vercel/ai (AI SDK)

**Title:** Tool-schema conformance corpus for provider conversions

Hi — we've been hitting the recurring problem where tool JSON Schemas lose
constraints (`minItems`, `maxLength`, `pattern`, numeric bounds, `required`)
as they pass through schema libraries → provider serializers → wire format.
Issue #25517 is one recent instance.

We built `schema-conformance` (npm, zero deps): a shared corpus of
original→converted schema pairs plus `checkConversion()` diagnostics and
`findCounterexample()` probe generation. `profileConverter(yourConverter)`
runs the corpus against any converter function in CI.

Would the AI SDK team be interested in running `profileConverter` against the
Google/provider schema paths in your test suite? Happy to open a PR adding it
as a devDependency if useful — or just steal the corpus ideas.

Repo: https://github.com/Kopachelli/schema-conformance

---

## Draft 2 — modelcontextprotocol/typescript-sdk

**Title:** Conformance tests for tool-schema handling across the SDK surface

The MCP ecosystem keeps running into schema-fidelity questions: what a client
declares vs. what a server/provider actually enforces. We packaged a small
corpus + checker (`schema-conformance` on npm) that flags dropped/changed
constraints with JSON paths and generates concrete counterexample values.

If the SDK team ever wants a shared regression suite for schema
serialization/deserialization across protocol versions, this might save
everyone a bespoke test suite. `runCorpus()` self-checks the corpus;
`profileConverter()` audits any conversion function.

Repo: https://github.com/Kopachelli/schema-conformance — MIT, zero deps.

---

## Draft 3 — generic (gateway / tool-library maintainers)

**Title:** Does your schema converter silently drop constraints?

`checkConversion(original, converted)` walks a JSON Schema and reports every
constraint that was dropped or altered — `maxItems`, `pattern`, `enum`,
`required`, `additionalProperties`, numeric bounds — with JSON paths.
`findCounterexample` produces a concrete value proving acceptance drift.

5-minute CI check:

```ts
import { profileConverter } from 'schema-conformance';
const results = profileConverter((s) => myZodToProviderSchema(s));
assert(results.every((r) => r.passed), 'schema conversion lost constraints');
```

npm: `schema-conformance` · repo: github.com/Kopachelli/schema-conformance
