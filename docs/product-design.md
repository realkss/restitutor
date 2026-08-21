# Units Engine — Product Design

Companion to `unit-systems-census.md` (the domain spec). The census says *what conventions exist and how they behave*; this document says *what we are building, in what order, and how the pieces fit*. Drafted 2026-08-20 from the design conversation; owner decisions flagged at the end.

## 1. Vision

A reading companion for physics literature: select an equation in a paper and get (a) translation between unit systems and conventions, (b) restoration or stripping of constants, (c) dimensional lint with honest confidence, (d) identification of the paper's convention state. Long term it runs as a browser tool over HTML math and PDFs. It is also a future-public portfolio project: the engine is extracted from the hypomnemata units floater into its own repo (private now, publishable later), because the site repo can never go public.

**Identity of the product — carried over from the floater and non-negotiable:** *lookup, never inference*, and *decline loudly with the offending symbols named*. Everything below layers acquisition and detection around that deterministic core; nothing ever guesses silently.

## 2. Staging

Each stage is independently useful and independently showable; no stage bets the project on the one after it.

1. **Paste-box web app** — TeX in, translation/lint out, with the convention picker and the numeric converter. (This is also the site roadmap's "standalone units page," so stage 1 ships value to hypomnemata immediately.)
2. **HTML-math browser extension** — content script over arXiv HTML/ar5iv, Wikipedia, MathJax/KaTeX pages. Deterministic TeX access via MathML `alttext`/annotations — the same trick the site's floater already uses. No OCR anywhere.
3. **PDF support via arXiv source matching** — ship our own pdf.js-based viewer (Chrome's native PDF viewer is closed to extensions); fetch the paper's LaTeX source from arXiv; align rendered equations to source equations (equation numbers, ordering, fuzzy glyph match).
4. **OCR fallback for arbitrary PDFs** (Mathpix API or open models). The dimensional checker doubles as the OCR validator: an inconsistent parse is flagged as "either the paper or my reading is wrong — here is my reading." This is the stage where ambitious versions of this product die; it is deliberately last and optional.

## 3. Architecture

```
packages/core        — the engine: AST layer (KaTeX-parser based, dependency-injected),
                       dimensional solve, generator/convention machinery, rider tables,
                       sign-convention layer, identity-tag layer, lint rules, decline vocabulary
packages/profiles/*  — symbol tables as data ("gr" first = today's GR_REGISTRY;
                       later: qft-natural, cosmology, atomic, condensed-matter, ...)
packages/convert     — the numeric converter graph (separate structure; shared constants
                       tables with CODATA-vintage tags; reciprocal edge E = hc/λ with medium tag)
benchmarks/          — the census-mined seed + curated executable tests (census §10 taxonomy)
docs/                — the census, this document, decision log
apps/ / adapters/    — stage 1 web app; the site floater becomes a thin consumer;
                       extension and viewer land here later
```

The census's fourteen data-model verdicts (§2 there) are binding on `core`: generator records with `kind`/`role` and symbolic restoration; the rank check with named Π-groups; riders activated by the generator-span rule; the dimensionless-conventions registry; composable convention switches with span-scoped state; the sign-convention axis with the Euclidean tag; the identity-metadata tag vector; the unit-contract equation detector; the refuse classes with named reasons; residual-rank honesty.

## 4. API sketch

```ts
restore(tex, {symbols, convention, target, direction})  // strip or restore; symbolic when
                                                        // generators lack numeric values
check(tex, {symbols, convention})
  -> consistent | violations[] | declined(symbols[], reason)   // reason from the fixed
                                                               // decline vocabulary
inferConventions(input /* equation, span, or document */, {candidates})
  -> { sets: Convention[][], evidence[] }   // SETS, never a single guess (census §6.2);
                                            // vacuum-only GR input refuses to choose
validateConvention(generators)
  -> wellPosed | overDetermined({impliedGroup}) | partial({residualRank})
convert(value, fromUnit, toUnit, {tags})    // graph walk; refuses across differing
                                            // identity tags without an explicit conversion
```

## 5. Symbol acquisition (the registry problem)

Layered, with provenance recorded per resolution:

1. **Domain profiles** — shipped symbol tables per literature (the census's system rows say which profile a convention implies).
2. **Document mining** — notation sections, "where m is the mass" glosses, and the declaration-sentence extractors (census §6.5: regex-locate → parse to (symbol, defining expression, dimension) triples → dimension-check each triple before committing).
3. **Ask-and-cache** — decline with named unknowns; the reader answers once per document; answers cached per paper.
4. **LLM-assisted (optional, later)** — a model may *propose* readings; the dimensional solver *disposes*. Proposals never bypass the check, and provenance marks them as proposed. The deterministic core is the error barrier between ML and user-facing claims.

## 6. Detection pipeline

Document-level first (aggregate fingerprints — far better posed than per-equation), then span-scoped overrides (Jackson-3e-style hybrids, chapter-level α′ switches), then per-equation refinement. Output is always a set with evidence; ambiguity below threshold triggers ask-and-confirm. Anti-fingerprints (census §6.6) ship as tests, not just documentation.

## 7. Extraction mechanics (repo birth)

- `git filter-repo` over the engine + test paths of the hypomnemata repo; all touching commits verified Keeper-authored, so history survives pseudonymously. Commit messages reviewed for site internals before any future public flip.
- Private repo under `realkss`; local `user.name = Keeper` as in the site repo.
- The site keeps a **vendored copy** of the engine file(s) with a byte-diff sync check (CF Pages cannot cleanly consume a second private repo on the free tier); the standalone repo is the source of record from day one.
- KaTeX pinned to the **same exact version** in both repos — the 0.16.47 genfrac regression is the standing lesson that patch bumps break AST consumers while all TeX still renders.
- The floater's UI (`unitsFloater.inline.ts`) and the latex transformer stay in the site; only the DOM-free engine, registry (→ `profiles/gr`), and tests move.

## 8. Testing

Census §10 governs: the five benchmark classes, the mined 404-item seed (`benchmarks-seed.json`), and the two hand-written obligations (class-A signature/fermion pairs, class-D property tests). The floater's existing 70 engine tests migrate with the engine. CI note: GitHub Actions on a private repo has been blocked by the $0 billing budget before — tests must stay runnable with a plain local `npx tsx --test`, CI treated as optional sugar.

## 9. Open owner decisions

| # | Decision | Options / notes |
|---|---|---|
| 1 | Repo name | e.g. `units-engine`, `restitutor`, something Latin in the site's register — owner's call |
| 2 | License now vs at public flip | MIT/Apache-2 from day one (simplest) vs no-license-until-flip (maximal control) |
| 3 | Convention data versioning | schema version + CODATA vintage tags on constants; whether registry edits bump a data version consumers can pin |
| 4 | Numeric converter in stage 1? | cheap and demo-friendly; adds the constants-table maintenance duty |
| 5 | Stage-4 OCR vendor | Mathpix (paid, best) vs pix2tex/Texify (open); can be deferred for years |
| 6 | Package metadata if ever published | npm author identity = Keeper; package name availability check before the flip |
