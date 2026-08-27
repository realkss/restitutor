# restitutor

A deterministic engine that restores, strips, and checks physical constants in equations — translating between unit conventions (geometrized, SI, CGS-Gaussian, Heaviside–Lorentz, natural units) and flagging dimensional inconsistency, with a contract it never breaks:

**Lookup, never inference.** Every symbol resolves through a registry; the missing powers of the constants are the *unique* solution of a dimensional linear system (no combination cᵃGᵇ is dimensionless, so uniqueness is a theorem, not a heuristic). Anything unknown, unsupported, or inconsistent **declines loudly** with the offending symbols named. It never guesses silently.

## Status

Working engine with a general-relativity profile, extracted with full history from the private site where it runs in production as an equation-translation floater. The census §2 machinery is fully coded beside it and adversarially reviewed: the generator-parameterized convention layer (36 conventions as data over exact rational dimension vectors, `validateConvention` with named implied groups, the restoration solve), per-symbol riders under the constant-identity span rule, the sign-convention axis, the identity-metadata tag lint, the numeric converter graph with its medium-tag discipline, and the unit-contract detector. The suite (`npm test`) covers all of it. Still ahead, specified in `docs/`: the stage-2 HTML extension that reads real pages, refuse-class detectors, fermion γ-rider tables, and ict (v2).

## Layout

- `src/unitsEngine.ts` — the DOM-free engine plus the GR registry. KaTeX is dependency-injected by the caller; this file imports nothing.
- `src/*.test.ts` — the test suites (`npm test`).
- `src/convention.ts` — the generator-parameterized convention layer (census §2): conventions, validation, the restoration solve, and the rider tables under the span rule.
- `src/signs.ts`, `src/identity.ts` — the sign-convention axis (signature translation, Levi-Civita typing) and the open identity-metadata tag vector with its combinability lint.
- `src/converter.ts`, `src/contract.ts` — the numeric equivalence graph (SI-2019 exact constants, one reciprocal edge with a mandatory medium tag) and the unit-contract prefactor detector.
- `src/bridge.ts`, `src/profiles.ts` — the engine↔convention-layer bridge and the corpus-driven profile mounting point.
- `app/` — the stage-1 paste box over the production engine. Build it with `npm run build:app` (bundles into the gitignored `app/dist/`, staging KaTeX's stylesheet and fonts locally — no runtime CDN requests), then serve `app/` statically.
- `extension/` — the stage-2 browser extension (Manifest V3): a content script that finds math whose TeX the page itself carries — `<math alttext>` (LaTeXML: ar5iv, arXiv HTML, Wikipedia), KaTeX's `x-tex` annotation, MathJax v2's `math/tex` script — and translates it on click in an in-page panel, with the extraction provenance shown. No OCR, no network, no guessing. `npm run build:ext` produces the load-unpacked directory `extension/dist/`; `app/fixtures/stage2.html` exercises the same script in a plain tab.
- `docs/unit-systems-census.md` — the five-round adjudicated census of unit systems and conventions: the domain spec this engine grows into. Its evidence base lives in `docs/data/`, including `benchmarks-seed.json` (the mined test corpus) and `kernel_test.py` (the executed prototype of the census machinery, 15/15).
- `docs/product-design.md` — architecture, staging, API, and the open owner decisions.
- `scripts/check-site-sync.mjs` — verifies the site's vendored copy is identical to `src/` up to line endings and BOM (`npm run sync-check`; point it elsewhere with `SITE_PATH=<dir>`). This repository is the source of record.

## Toolchain notes

KaTeX is pinned **exactly** (`0.16.47`). The engine consumes KaTeX parse trees, and a patch-level bump has broken AST consumers before while every equation still rendered — treat any KaTeX version change as an engine change, run the suite, and keep the site's vendored KaTeX on the same pin.

## License

MIT — see [LICENSE](LICENSE).
