# Legacy compatibility deprecation plan (archived)

## Status (updated April 8, 2026)

This plan is now **largely completed** by the CPQ-only cutover + Run 2 cleanup.

Removed from runtime code:
- `/api/matrix*`
- `/api/builder-push`
- `/api/countries`
- `/api/setup-options`
- `lib/matrix-service.ts`

Retained as transitional only:
- `/api/cpq/generate` GET with `run_id` (`cpq_import_runs` diagnostics path).

Retained as historical schema objects (not runtime-used in repo code):
- `products`, `countries`, `availability`, `setup_options`, `sku_rules`.

## Why this file remains

This document is preserved as historical planning context for the retirement sequence that was executed.
Use `ARCHITECTURE.md`, `DATABASE.md`, and `PROCESSDATA.md` for current-state truth.
