# schema-conformance

Shared conformance corpus and diagnostic engine for **AI tool-schema conversions**.

> *"Does this tool definition still mean the same thing after passing through a schema library, SDK, gateway, and model provider?"*

Provider and gateway pipelines silently drop JSON Schema constraints — array bounds, numeric ranges, string patterns — between the application's contract and the request actually sent. This package gives SDK maintainers a shared corpus and a checker to catch that drift in CI.

## Usage

```ts
import { checkConversion, findCounterexample, profileConverter, runCorpus } from 'schema-conformance';

// Audit one conversion.
const diagnostics = checkConversion(originalSchema, convertedSchema);
// → [{ code: 'constraint-dropped', path: '$.properties.tags.maxItems', ... }]

// Prove acceptance drift with a concrete value.
const ce = findCounterexample(originalSchema, convertedSchema);

// Self-check the corpus + checker (smoke test for this package).
runCorpus();

// Profile your own converter against the corpus in CI.
const results = profileConverter((schema) => myConverter(schema));
// results[i].passed === false means a supported constraint was lost.
```

## What it checks

`checkConversion(original, converted)` walks the original schema and reports, with JSON paths:

- `constraint-dropped` — a constraint keyword vanished (`maxItems`, `pattern`, `minimum`, `enum`, `additionalProperties: false`, …)
- `constraint-changed` — a constraint's value differs (`enum` narrowed, `type` widened, `required` altered)
- `property-dropped` — a `properties` entry disappeared
- `structure-changed` — a schema node became a non-object

Supported keywords: `type`, `enum`, `const`, `required`, `properties`, `additionalProperties`, `items` (schema and tuple forms), `minItems`/`maxItems`, `uniqueItems`, `minLength`/`maxLength`, `pattern`, `minimum`/`maximum`, `exclusiveMinimum`/`exclusiveMaximum` (both draft forms), `multipleOf`, `minProperties`/`maxProperties`. Annotation keywords (`title`, `description`, `format`, `$schema`, …) are ignored.

`validate(value, schema)` implements the matching validation subset, and `findCounterexample` uses bounded probe generation (`sample`) to produce a concrete value the original accepted but the conversion rejects — evidence, not just a diff.

## Guarantees and limits

- Directional: it detects losses **relative to the original**. Constraints a converter adds are not reported (they surface via `findCounterexample` instead).
- It covers the keyword subset above — not full JSON Schema. Unknown keywords are ignored on both sides.
- `findCounterexample` is bounded sampling: `null` means "no counterexample found", not "schemas are equivalent".
- Intended as a **development dependency**: run it in converter/SDK test suites, not on production request paths.

## Development

```sh
npm install
npm test
```

Zero runtime dependencies. Works in Node and browsers (pure TypeScript).
