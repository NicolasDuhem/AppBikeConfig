# Contributing

## Data/process documentation contract (required)

If your change alters runtime data behavior, you must update both:

- `DATABASE.md` (schema/data knowledge)
- `PROCESSDATA.md` (process/data-flow knowledge)

This includes API query changes, table/column usage changes, migrations, feature-flag path changes, and any new/removed writes.

## Transitional telemetry contract

If you add or modify a transitional (non-primary) path, ensure telemetry and audit traces are explicit so retirement decisions remain evidence-based.

## Suggested local checks

```bash
npm run test
npm run analyze:db-usage
npm run check:doc-governance
```


## Legacy path expansion guardrail

- New behavior must be implemented on canonical CPQ paths unless explicitly scoped as deprecation preparation work.
- Run `npm run check:legacy-coupling` to detect newly introduced legacy references in your diff.
