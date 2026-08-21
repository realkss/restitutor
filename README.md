# restitutor

A deterministic engine that restores, strips, and checks physical constants in equations — translating between unit conventions (geometrized, SI, CGS-Gaussian, Heaviside–Lorentz, natural units) and flagging dimensional inconsistency, with a contract it never breaks:

**Lookup, never inference.** Every symbol resolves through a registry; the missing powers of the constants are the *unique* solution of a dimensional linear system (no combination cᵃGᵇ is dimensionless, so uniqueness is a theorem, not a heuristic). Anything unknown, unsupported, or inconsistent **declines loudly** with the offending symbols named. It never guesses silently.

## Status

Working engine with a general-relativity profile and its test suite (`npm test`), extracted with full history from the private site where it runs in production as an equation-translation floater. The next phase — generator-parameterized conventions, per-symbol riders under the span rule, the sign-convention axis, identity-metadata tags — is specified in `docs/` and not yet implemented.

## Layout

- `src/unitsEngine.ts` — the DOM-free engine plus the GR registry. KaTeX is dependency-injected by the caller; this file imports nothing.
- `src/unitsEngine.test.ts` — the test suite (`npx tsx --test`).
- `docs/unit-systems-census.md` — the five-round adjudicated census of unit systems and conventions: the domain spec this engine grows into. Its evidence base lives in `docs/data/`, including `benchmarks-seed.json` (the mined test corpus) and `kernel_test.py` (the executed prototype of the census machinery, 15/15).
- `docs/product-design.md` — architecture, staging, API, and the open owner decisions.
- `scripts/check-site-sync.mjs` — verifies the site's vendored copy is byte-identical to `src/`. This repository is the source of record.

## Toolchain notes

KaTeX is pinned **exactly** (`0.16.47`). The engine consumes KaTeX parse trees, and a patch-level bump has broken AST consumers before while every equation still rendered — treat any KaTeX version change as an engine change, run the suite, and keep the site's vendored KaTeX on the same pin.

## License

None granted. All rights reserved while the repository is private; a license will be chosen at public release.
