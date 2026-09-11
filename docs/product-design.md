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

One package; the layering below is enforced by what imports what, not by directories. (The original sketch of a `packages/*` monorepo was superseded when stage 2 landed in the same tree; the layers it named are these.)

```
src/unitsEngine.ts       — the engine: KaTeX-AST reading, the dimensional solve, the decline
                           vocabulary, and the GR registry. Imports NOTHING; KaTeX is injected.
                           Frozen: the site vendors it byte-identical (scripts/check-site-sync.mjs).
src/convention.ts        — census §2 as data: 36 conventions as generator records over exact
src/rendering.ts           rational dimension vectors, validation with named implied groups, the
                           restoration solve, riders under the span rule, the rendering partition.
src/signs.ts             — the sign-convention axis and the identity-metadata tag vector.
src/identity.ts
src/converter.ts         — the numeric equivalence graph and the unit-contract detector.
src/contract.ts
src/detect.ts            — census §6: document- and span-level convention detection over
src/forks.ts               normalized prose and equations; §5/§6.5b fork recovery; the §6.5
src/mine.ts                declaration miner; the refusal of named mathematical objects.
src/gate.ts
src/bridge.ts            — engine ↔ convention layer, and the TRUST BOUNDARY (registryTrusts):
                           every reading a page contributes passes this one gate (§3.1).
src/profiles.ts          — corpus-driven symbol tables mounted as profiles (GR today).
src/tables.generated.ts  — generated from docs/data/*.json by `npm run gen:tables`; never edited.
app/                     — stage 1, the paste box.
extension/               — stage 2, the Manifest V3 content script and its panel.
docs/                    — the census, this document, the store listing, the privacy policy;
                           docs/data/ the evidence base the runtime tables are generated from.
```

### 3.1 The evidence boundary

Everything a page contributes to a translation arrives as a *reading*: a symbol, a noun from the glossary, the verbatim sentence, and, where the text gave one, a defining expression. Today the readings come from two deterministic sources: the declaration miner (templates over sentences, §6.5) and the definitions path (a printed expression whose dimension the engine itself computes). Each enters the registry through one gate in `src/bridge.ts`. Declarations pass `registryTrusts`, which admits only a reading whose dimension the text has pinned down: any caveat (an ambiguous noun, an E&M quantity with no named system, a dimension that depends on the spatial dimension or the coordinate convention) keeps the reading on the Symbols card, where the caveat is shown, and out of the registry. The gate is an allowlist: a caveat added to the miner later is refused until the gate admits it by name. Definitions pass `usableDefinitions`, which admits only an expression built from the engine's constants and from symbols the page defined the same way earlier: a relation among the page's variables ("x = ±t" on a c = 1 page) holds in the page's convention, not in SI, and the dimension it would hand the left side is the wrong one.

This is the seam for anything that reads context later — a reader's confirmation in the panel, a retrieval scout that shows the sentences mentioning an unknown symbol, or a language model proposing what a sentence declares. Such a source is a *recall* device and nothing more: it may point at a sentence, it may name a glossary noun, it may not assert a dimension, and its output takes exactly the shape a template match takes and passes exactly the same gate. The dimension always comes from the glossary or from the engine's own computation, never from the source of the reading; the sentence must exist verbatim on the page; the engine, the registry, and the gate import nothing from any such layer, and a test pins that. Whether such a layer is worth building is an empirical question the decline reasons answer: an unknown symbol the page defines in words the templates missed is the case it would rescue; a term admitting no completion over the ambient constants is not, and no reader helps there.

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

(Historical: how the repository was born, 2026-08-20. It went public under `realkss` on 2026-08-27; the gate that decision passed is recorded under §9.)

- `git filter-repo` over the engine + test paths of the hypomnemata repo; all touching commits verified Keeper-authored, so history survives pseudonymously. Commit messages reviewed for site internals before the public flip.
- Repo under `realkss`, private at birth; local `user.name = Keeper` as in the site repo.
- The site keeps a **vendored copy** of the engine file(s) with a byte-diff sync check (CF Pages cannot cleanly consume a second private repo on the free tier); the standalone repo is the source of record from day one.
- KaTeX pinned to the **same exact version** in both repos — the 0.16.47 genfrac regression is the standing lesson that patch bumps break AST consumers while all TeX still renders.
- The floater's UI (`unitsFloater.inline.ts`) and the latex transformer stay in the site; only the DOM-free engine, registry (→ `profiles/gr`), and tests move.

## 8. Testing

Census §10 governs: the five benchmark classes, the mined 404-item seed (`benchmarks-seed.json`), and the two hand-written obligations (class-A signature/fermion pairs, class-D property tests). The floater's existing 70 engine tests migrate with the engine. CI: `.github/workflows/ci.yml` runs the suite, regenerates the runtime tables and fails on drift, and builds both surfaces on every push (the repository is public, so Actions minutes are free); the suite must nonetheless stay runnable with a plain local `npx tsx --test`, since a private fork loses the minutes.

**The browser boundary.** The extension's page reading (`extension/src/page.ts`: spans, the miner's surface, the page's readings) takes the document as an argument and uses the standard DOM only, so `extension/src/page.real.test.ts` runs it in node, with linkedom, over the two Wikipedia captures in `test/fixtures/wikipedia/` and pins what the browser shows on those pages: carrier counts, the display-first pool, Parsoid sections as spans, the declared and defined symbols, the verdict set, the contradiction on the Arabic page, and the translations under the page's registry. The captures are CC BY-SA and carry their own license note; the ar5iv and arXiv captures used in development are the authors' and stay out of the repository. `scripts/verify-live.py` is the browser-side counterpart: headless Edge with `extension/dist` loaded, driven over the DevTools protocol, dumps the rendered panel on a live page (Chrome 137+ ignores `--load-extension` on branded builds, which is why it is Edge).

## 9. Open owner decisions

| # | Decision | Options / notes |
|---|---|---|
| 1 | Repo name | **DECIDED (2026-08-20): `restitutor`** — Latin, the restorer; fits the site's register |
| 2 | License now vs at public flip | **DECIDED (2026-08-27, at the flip): MIT**, copyright holder = Keeper |
| 3 | Convention data versioning | schema version + CODATA vintage tags on constants; whether registry edits bump a data version consumers can pin |
| 4 | Numeric converter in stage 1? | **DECIDED (2026-08-21): yes, shipped** — the equivalence graph with the mandatory medium tag; SI-2019 exact constants carry a vintage tag |
| 5 | Stage-4 OCR vendor | Mathpix (paid, best) vs pix2tex/Texify (open); can be deferred for years |
| 6 | Package metadata if ever published | npm author identity = Keeper; package name availability check before the flip |
| 7 | Public-flip timing | **SUPERSEDED same day (2026-08-27): the owner chose to flip immediately** — public under `realkss`, ahead of stage 2. The gate below was executed at the flip; its per-item outcomes are recorded inline. |

### The public-flip gate (2026-08-27)

The flip is a one-way door: once public, the full history is forkable and cached by archive crawlers, so everything here must be resolved *before* the flip — a later scrub removes nothing.

1. **Identity (owner decision).** **DECIDED (2026-08-27): Keeper is a soft brand — flip in place under `realkss`, link accepted.** (The alternative, recorded for the record: a real separation would have required a history-rewritten copy under a Keeper-owned account, since this file's §7 named the account in 14 revisions and `scripts/check-site-sync.mjs` carried a local path in 15.)
2. **License (owner decision, §9 #2).** **DECIDED (2026-08-27): MIT.**
3. **README current** at the flip (status paragraph tracks the shipped surface). Done 2026-08-27.
4. **Docs sweep** — first full sweep 2026-08-27 (12 agents, all 33 `docs/` + README files end to end; 63 raw findings adjudicated). Result: the public spine — README, the census itself, `benchmarks-seed.json`, `kernel_test.py`, the enum/verdict/sweep files apart from the three named below — is clean: no PII beyond the §7 line item 1 covers, no path leaks (the one hardcoded local path, in `check-site-sync.mjs`, was scrubbed the same day), and every table-shaped block is either US-government public domain (NIST CODATA, NBS SP 696) or facts in this project's own arrangement. The quote concentration sat in three round-4/5 **evidence archives** — `fold_pilot.json`, `pv_dedup.json`, `si-cgs-em.verdict.json` — carrying ~14 attributed scholarly quotations of 24–54 words. **DECIDED (2026-08-27): pruned from the public repository — removed from all history at the flip** (`git filter-repo --invert-paths`; a tip-only removal would have left them fetchable from public history). They remain archived in the private census workshop, byte-identical; they were never paraphrased in place, since they are verification records where the verbatim quote is the evidence. Internal `wf_*` run IDs stay: they are deliberate provenance of the multi-agent process.
5. **Package/name check** (§9 #6) if npm publication accompanies the flip.
