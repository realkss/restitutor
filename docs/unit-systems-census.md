# Unit-System Census

**Purpose.** Establish the closure of the convention table for the units-translation engine *before* its public API freezes: enumerate every unit system and normalization convention the tool could plausibly meet in physics literature, express each in the generator formalism, and record where that formalism holds, needs extension, or must refuse.

**Provenance.** 2026-08-20, three adjudicated rounds. **Round 1** (run `wf_b2ef7d99`, 12 agents): 113 system entries across six families; 90 verifier corrections raised, all accepted; 52 omission claims, 43 accepted, 9 rejected as cross-family duplicates. **Round 2** (user-prompted): the sign-convention axis and the imaginary metric (§2.12). **Round 3** (run `wf_a8e7a020`, 14 agents): seven reader-lens critics + verifiers; 69 claimed gaps → 65 accepted (47 confirmed, 10 corrected, 8 re-slotted), 4 rejected as duplicates; structural synthesis in §2.13, rows in the §5 round-3 table. Raw structured data lives in `data/`. **Round 4 (adjudicated and folded in):** the 43-finding coherence review; the 12-paper empirical pilot (`wf_cee35635`); five new reader lenses + a verified backlog enumeration (`wf_99edf84d`); claims verification (`wf_65878598`). 232 verified claims → 207 accepted (§9); structural synthesis in §2.14; rows in the §5 round-4 tables and the §3 backlog additions.

---

## 1. Verdict

The generator-table formalism **survives contact with the full literature**, but only with a specific set of extensions. Without them it is unsound, not merely incomplete. **Where the value actually sits** (round-4 pilot): in theory-side HEP and neutrino phenomenology the generator table is nearly vacuous — {ħ, c}, residual rank 1 — and nearly all the risk lives in §2.5, §2.13(a) and §2.12. The census outcome in one paragraph:

Of 113 enumerated systems, after the adjudication patches: **22 are pure quotients** (a generator set fully specifies them), **48 need per-symbol riders** on top of the quotient (several of which collapse to pure quotients under the §2.4 span rule), **28 need user/mined custom generators** (per-paper nondimensionalization — a first-class product surface, not an edge case), **10 are numeric-only** (display-unit choices routed to the converter), **4 are unsupported** by any multiplicative formalism (the tool must detect and refuse these by name), and **1 is a document-hybrid**. Tier split: 47 v1, 55 v2, 11 out of scope.

The single most consequential design facts found:

1. **Riders are relative to the generator set** (§2.4). Whether "Gaussian B carries a hidden c" is a rider *depends on whether c is being restored*. This collapses the rider table from per-system to per-symbol-family.
2. **Dimensionless normalization factors are a third data class — open-ended, not closed** (§2.5). The 8π in 8πG, the 4π placements, the √2 in v = 246 vs 174 GeV — provably invisible to any dimensional method, and open-ended: SMEFT alone gives O(10²) pairwise dimensionless factors across four live bases, against 91 registry rows.
3. **Conventions compose; they are not a flat list** (§2.6). Real papers stack independent switches (mechanical generators × EM rendering × k_B × per-amount × display units). The API must model modifiers, not an enum of systems.
4. **A rank check on the generator matrix is mandatory** (§2.3). Published papers declare ill-posed unit systems ("t = 1 and J = 1"; {ħ, k_B, a, e} with no energy scale). `validateConvention()` must detect rank deficiency and over-determination, and *name* the dimensionless group an over-determined declaration silently sets to 1.
5. **A spacetime-dimension parameter is the largest single schema gap.** In dim reg, [φ] = (d−2)/2 with d = 4−2ε; in strings/holography D = 5, 10, 11 with [G_D] = mass^(2−D). A fixed 5-tuple emits false failures on essentially every loop calculation and every holography paper. Exponents must be allowed to be symbolic in d.
6. **Residual rank must be reported honestly.** ħ = c = k_B = ε₀ = 1 leaves rank 1 (the mass dimension — still a real check); adding G or α′ or a leaves rank 0, where "dimensionally consistent" is vacuous and the tool's value is restoration only.
7. **Identity is a separate axis from dimension** (§2.13(a), round 3): same symbol, same dimension, different quantity — a typed tag vector {kind, scheme, frame, averaging, medium, vintage, …}, not a unit choice.

---

## 2. The data model that survived

### 2.1 Dimension basis

Exponent tuple over **(M, L, T, Θ, I)**, extended by an optional **N** (amount of substance) and an optional **A** (plane angle, off by default). Rationale:

- Θ enters only via k_B; I only via charge. Both are silently killed by standard HEP conventions — a model tracking only (M, L, T) mishandles every thermal and electromagnetic equation.
- **N is required**, not optional-in-practice: under a 5-tuple, 1 kcal/mol and 1 kcal are indistinguishable — a silent factor of 6.022×10²³, the largest available error in the chemistry literature. N_A is the generator that collapses N. "Per atom" / "per formula unit" divisors are integer cell counts, a separate slot again.
- **A** exists for the optional angle-dimension lint mode (Quincey-style). Under it, ħ (J·s·rad⁻¹) and the action (J·s) separate, and the entire ν-vs-ω / h-vs-ħ / Hz-ambiguity class becomes checkable — but A-mode is **unsound on natural↔laboratory bridges** unless ħc is a distinguished rad-free bridge constant: ħ³c³ρ_a/Λ⁴ picks up rad⁻³ and a correct energy fails. Default off; the radian convention (1 rad = 1) is what all ordinary literature assumes.
- Luminous intensity (cd) stays out: photometry is declared out of scope (refuse, §7).
- **Half-integer exponents are load-bearing** (Gaussian charge M^½L^{3/2}T⁻¹; lattice fermions a^{3/2}; the √(4πε₀)-class conversion factors). The existing twelfths representation is ample.

### 2.2 Generator record

```
{ tex, dimension, numeric_factor, emits,
  kind:  fundamental_constant | theory_scale | solution_parameter | regulator,
  role:  absorbed | inserted,
  value: optional }
```

- `numeric_factor`/`emits` carry the dimensionless part (8π in 8πG = 1): **they are the entire information content** distinguishing half the systems in this census.
- `kind` matters because restoration behavior differs: a lattice spacing `a` or an AdS radius `L` has a known dimension but *no universal value* — restoration must emit symbols, with numeric values an optional overlay. Roughly half of the nondimensionalization family is published without numeric scale values at all (scale-free simulations).
- `role: inserted` covers non-coherent engineering systems (F = ma/g_c with g_c = 32.174), which *add* a constant that coherent systems set to 1 — the mirror image of absorption. Out of scope for translation, but the schema slot prevents misclassification.

### 2.3 Rank bookkeeping (`validateConvention`)

Three outcomes, all observed in real literature:

- **Well-posed**: generator count = rank = number of active dimensions. Unique restoration.
- **Over-determined**: more declarations than rank. "L = U = ν = 1" secretly asserts Re = 1; "a = ħ = t = v_F = 1" is a rank violation in Dirac-material papers. Over-determination is an **error only when the null-space group is asserted equal to 1** ({L, U, ν} ⇒ Re = 1) and **correct when it survives as a named residue** (§2.10) — every §3 nondimensionalization over-declares precisely so that named Π-groups survive (1004.0279: six over rank 4, residues ε = ρ₀/a₀ ≪ 1 and β₀). Name it and report which case. (One legitimate exception found: ideal GRMHD's two same-dimension mass scales, consistent only because the equations have an exact density-scaling symmetry. The check needs an explicit override flag for symmetry-exploiting declarations.)
- **Partial**: fewer generators than dimensions (ħ = c = 1 with lengths still in fm). Common, legitimate; residual dimensional freedom survives, and the residual rank determines how much checking remains possible.

Two published ill-posed declarations the check must catch: {ħ, k_B, a, e} (rank 4 over 5 — no energy scale; the paper's own "t = 1" in the next sentence is the missing generator) and {t, J} as independent generators (identical dimension vectors; "t = J = 1" is the physical statement J/t = 1).

### 2.4 Riders are relative to the generator set

The acid test resolved cleanly. Setting 4πε₀ = 1 in SI yields **ESU's** Maxwell sector, not Gaussian's; Gaussian is that quotient **plus B → cB** (and A → cA, H → H/c, M → M/c). The quotient alone can never deliver [E] = [B] — they differ by exactly one power of velocity. So plain Gaussian genuinely needs a per-symbol rider table.

**But the rider is only real when its factor lies outside the span of the restored generators.** In geometrized-Gaussian (G = c = 4πε₀ = 1), c is itself being restored, and the dimensional solve supplies the c on B automatically (restore |E| = |B| for a light wave: the unique solution is E = cB). The engineering consequence: **store riders once per symbol family, tagged with their factor; activate a rider only when its factor is not generated by the active generator set.** Not E&M-specific: with the matter sector inside the ½ multiplying R and M̄_pl^(−2) = 8πG = 1, the implied φ → φ/M̄_pl rider never activates. This is why twin rows across families carry different recorded classes below — the recorded class is the enumerator's verdict against the SI base; the *effective* class follows this rule.

The whole classical E&M family reduces to a 2×2 rider classification on one generator choice:

- **c-rider** (B → cB, A → cA, H → H/c, M → M/c): present in Gaussian and Heaviside–Lorentz, absent in SI/ESU/EMU. Note M takes the c-rider but *not* the 4π-rider, while H takes both.
- **4π-rider** (unrationalized: D → 4πD, H → 4πH, so ∇·D = 4πρ): present in Gaussian/ESU/EMU/unrationalized-MKS, absent in SI and Heaviside–Lorentz.

SI = (no, no) · HL = (yes, no) · ESU/EMU = (no, yes) · Gaussian = (yes, yes). The ESU/EMU/Gaussian triangle is powers of c only: q, ρ, J, I, P, D: ESU = Gaussian = c·EMU; E, φ: ESU = Gaussian = EMU/c; B, A: EMU = Gaussian = c·ESU; H, M: EMU = Gaussian = ESU/c.

A useful failure signature: attempting to restore a Gaussian Faraday law with only the 4πε₀ generator makes the linear system *inconsistent* (no power of a (−1,−3,4,0,2) constant is a velocity). An unsolvable restoration in this family almost always means "hidden c on B" — surface that hint in the decline message.

**Round-5 execution refinement (from implementing this rule):** suppression requires the factor CONSTANT to be generated, not merely its dimension to be reachable. Hartree's {ħ, m_e, e, 4πε₀} spans velocity as e²/(4πε₀ħ) = αc — the solve would "supply" a constant smaller than c by exactly α (c = 137.036 in-system, §5 #9), silently dropping the α the magnetic-ambiguity warning (§6.4) exists for. Implementable criterion: the restoration of the factor's dimension must return exactly one exponent, power 1, on a generator whose bare constant is the factor with numeric factor 1. Dimension-span alone never suppresses.

### 2.5 The dimensionless-conventions registry

A third data class beside generators and riders: **dimensionless definitional forks** that no dimensional method can ever recover, ranked in §5 (the round-1/2 registry; the round-3 table extends it unranked). They are the product's crown jewels precisely because they are theorems of invisibility: the 8π/16π/32π gravity ladder, the EM 4π placements, √8π in the Planck mass, 2π in the string length, the Hartree/Rydberg factor 2, h vs ħ, the Higgs vev √2, the g-absorbed gauge normalization. Open-ended — 91 entries after three rounds and ~56 more from twelve pilot papers; a growing per-subfield asset with a long tail, not a closed class. Each carries its detection fingerprint.

### 2.6 Conventions compose

Model a paper's convention state as **independent, composable switches**, not one label from a flat enum:

`mechanical generators ⊗ EM rendering (SI | Gaussian | HL | ESU | EMU) ⊗ gauge-coupling placement (g inserted vs g absorbed into the field: L = −F²/4g², D = ∂ + [B_μ, ·]) ⊗ thermal (k_B) ⊗ per-amount (N_A) ⊗ display-unit map ⊗ sign conventions`

Evidence: every natural-unit system in the census appears in Gaussian and HL flavours; a quantum-chemistry paper computes in Hartree a.u. and reports kcal/mol, debye, Å³, and kelvin in one table; "we set ħ = k_B = a = t = 1" is four independent switches in one sentence. Metric signature and curvature-sign conventions co-vary with schools but are *not* unit choices — keep them an orthogonal field (they matter as much for reading equations, and they wreck naive fingerprinting if conflated). **Every switch takes three values, not two** (round 4): determined, undetermined, and **absent** — not instantiated by the document at all; a defaulted signature tag on a paper with no metric is a fabrication.

### 2.7 Convention state is span-scoped

Jackson 3rd ed. is SI for ch. 1–10 and Gaussian for ch. 11–16. String textbooks switch α′ conventions at chapter boundaries. Neutron-star papers use Fermi units in the EOS section and geometrized units in the TOV section. **Convention assignment must attach to a text span (ideally per equation), never to a document.** A new `document_hybrid` class marks known section-switching sources.

### 2.8 Numeric-only systems

Imperial, FPS, MTS, gravitational-metric, and friends absorb *nothing*: every equation is character-for-character the SI equation, and translation is one scale factor per base dimension. New class `numeric_only`: they belong to the numeric converter subsystem, and an empty generator array is **the finding, not a data gap** — but it must be distinguishable from "not yet filled in", hence the explicit class.

### 2.9 The numeric converter is a graph, not a solve

Spectroscopic equivalences (eV ↔ cm⁻¹ ↔ K ↔ Hz ↔ nm) are conversion-factor edges through ħ, c, k_B — including one **reciprocal** edge (E = hc/λ), which no linear exponent solve produces. {hc, h, ħ, k_B} is not an independent generator set (h and ħ share a dimension vector). Separate data structure, shared constants table.

### 2.10 Residues are physics

The surviving dimensionless groups of a nondimensionalization (Re, Pr, Ra, Ma, β, U/t, s = V₀/E_R, m_i/m_e …) must **never be restored**. Correct engine output for a per-paper convention: {generator list} + {named Buckingham-Π basis of the null space}, against a curated residue registry (name, definition, field), seeded (round 4) with the plasma set (ρ* = ρ/a, k_⊥ρ_i, species-resolved β) and the relativistic-accretion set (φ_MAD, σ, β, H/R, Q^(i), α_SS, Ṁ/Ṁ_Edd, Be = −u_t). Deliberately unphysical residues (reduced mass ratios 25/64/100, reduced speed of light) must never be "corrected" to physical values.

### 2.11 Refuse-and-warn classes

Outside the multiplicative group entirely — detect by name and refuse with a specific message, never approximate: **logarithmic** (magnitudes, dB, dex, pH), **affine — refuse branch only** (°C, °F, psig; per-paper origins like the Boussinesq θ-offset are tag-and-restrict, §2.13(f)), **Möbius** (API gravity = 141.5/SG − 131.5), **similarity variables** (Blasius η, Sedov–Taylor ξ — the "unit" depends on an independent variable), **coordinate-absorbed** (optical depth dτ = −κρ ds), **field-dependent rescalings** (string-frame ↔ Einstein-frame Weyl transformations), **non-invertible replacements** (lattice links U_μ = exp(iagA_μ)), **no dimensional preimage** (standard map, logistic map — rank 0, nothing to restore, say so), **hidden-quantity hybrids** (Jy/beam, K km/s, mag/arcsec² — a beam solid angle or line width hiding in the unit), and **variant-Gaussian** (breaks q = I·t itself: statcoulomb charge with abampere current, q/I a length — the (M,L,T,Θ,I) basis presupposes what it abandons).

### 2.12 Sign conventions and the imaginary metric *(amended in adjudication round 2)*

Metric signature is a convention axis of the same rank as the unit system, and the reader must be able to **choose a target** — the census benchmarks declare (−,+,+,+) for internal consistency, but each benchmark carries a signature *tag*, and the tool treats signature as a preference, never a standard.

**Real-signature translation is mechanical in the bosonic sector.** Under η → −η every full contraction carries exactly one inverse metric, so a term flips by (−1)^(number of contractions): (∂φ)² flips, m²φ² and F_μν F^μν (two metrics each) do not — exactly the known relocation of signs between mostly-minus and mostly-plus Lagrangians. This contraction-parity rule runs on the same AST machinery as constant restoration. The **fermionic sector does not come free**: γ-matrix conventions absorb factors of i between signatures ({γ^μ, γ^ν} = 2η^μν changes side), so the Dirac sector needs a rider table of the same shape as the E&M c-riders.

**The round-2 sign-convention record** (orthogonal to units, co-varying by school; extended by §2.13(d)): {signature, Riemann sign, Ricci-contraction sign (**detector, round 4**: the *sign* of R in the printed action against the declared signature — §6.1's ladder reads prefactor magnitude only), the Levi-Civita slot typed by **index position**, stored as (value, position) — ε^{0123} = −ε_{0123} in 4D Lorentzian under either signature, so a declared ε_{0123} = +1 in an upper-index slot inverts every dual tensor and CP-odd coefficient, charge sign in D_μ = ∂_μ ∓ ieA_μ, Fourier e^(∓iωt)} — MTW's [S1,S2,S3] triple, extended. Detection: p² = ±m², an explicit η = diag(…) **or a printed FRW/ADM line element** (in inflation/CMB the only declaration made), **the kinetic-term parity test** (−¼X² has two contractions, |Dφ|² one: same relative sign ⇒ mostly-plus, opposite ⇒ mostly-minus), the d'Alembertian sign, the T⁰⁰ form, plus school priors (particle theory mostly-minus, GR mostly-plus).

**The imaginary metric has two referents that must never be conflated:**

1. **Notational ict** (x⁴ = ict with Euclidean δ_μν index gymnastics — Minkowski 1908, Pauli, Sommerfeld, much pre-1960 literature; the convention MTW's "Farewell to ict" box formally retired). Translatable in principle via per-component riders carrying the i's (A₄ = iφ, F₄ₖ = iEₖ) — the same structure as the Gaussian rider table. Real old papers exist; bounded work; **v2**.
2. **Euclidean field theory by Wick rotation** (τ = it: lattice QFT's e^(−S_E), Matsubara thermal sums, instantons, Euclidean gravity). *Not* notation — an analytically continued formulation. **Detect and tag, never "translate" back to Minkowski**: that is analytic continuation, physics rather than bookkeeping (refuse-class, §7). Consequence for scoping: the lattice a = 1 rows are v1 and that literature is Euclidean by default, so the **Euclidean tag ships in v1** even though ict translation waits for v2.

Dimensional analysis is signature-blind, so none of this touches the restoration solve — it is a parallel lint/translation layer sharing the AST and the span-scoped convention state (§2.7).

### 2.13 Round 3: the identity-metadata layer and five other structures *(reader-lens sweep, adjudicated)*

A seven-lens adversarial sweep (QFT phenomenology, GW/detectors, optics/EE, mathematical GR, quantum chemistry, condensed matter, metrology-history) hunted for convention axes beyond rounds 1–2. Sixty-five findings survived adjudication (§9); they organize into six structures:

**(a) The identity-metadata layer — the unifying discovery.** Six of the seven lenses converged on the same failure shape: *same symbol, same dimension, different quantity.* A running coupling needs a (scheme, μ, n_f, loop-order) tag — m_b is 4.78 GeV (pole) or 4.18 (m̄_b(m̄_b)) or 2.79 (m̄_b(m_H)), a factor 2.9 in Γ(H→bb̄). A GW strain needs an averaging-state tag (sky/polarization/inclination: ⟨F₊²+F×²⟩ = 2/5) and a frame tag (source vs detector, (1+z) up to ~20). A kelvin needs a kind tag (K_RJ vs K_CMB vs T_A: ×0.577 at 150 GHz). A DOS needs its denominator (per spin/valley/formula-unit: ×4–12 compounded). An attenuation constant needs field- vs power-referencing (×2, and one paper mixes both). A wavelength needs a medium tag (air vs vacuum: 2.77×10⁻⁴, orders of magnitude above line-list precision). A symbol needs era/domain gating (mK = millikayser or millikelvin; μ = micron or prefix; γ, λ, b are triply ambiguous). A quoted value needs vintage (ITS-90 vs IPTS-68: 0.25 K at the gold point) and uncertainty-semantics provenance (probable error = 0.6745σ; k = 2; PDG scale factors). **Schema: a typed tag vector {kind, scheme, scale, frame, averaging, reference-basis, medium, gauge/branch, vintage, uncertainty-semantics, **calibration-stipulation**} attached to symbols and numbers — the last a stipulated, contested input, neither measurement nor epoch (lattice r₀ ≡ 0.5 fm against 0.49 and 0.472); lint: flag any physical-unit number downstream of one; the lint is "never combine values whose tags differ — convert or refuse."** This layer absorbs two round-3 seed groups (MS vs MS̄ → scheme tags; constants-vintage → vintage tags) and the quantity-kind seed itself.

**(b) Unit-contract (plug-in) equations — a new detect-and-tag class, v1.** Pheno master formulas are *deliberately* dimensionally inhomogeneous, with a conversion constant baked into a bare decimal: Δm²[eV²]L[km]/E[GeV] with 1.267 = 1/(4ħc); p[GeV/c] = 0.29979 B[T] R[m]; (ħc)² = 0.3894 GeV²·mbarn. A linter must not flag them; a restorer must not restore on top (a second ħc corrupts the oscillation phase by ~10⁹). They are fully invertible once the bracketed unit contract is read — so: detect via bracketed units + bare decimal prefactor, **verify the prefactor equals a rational times powers of (ħ, c, e) in the stated contract**, tag, and suppress both lint and restoration. **Recall repair (round 4):** markup is unstable inside one document (1.267 bare, 2.48 parenthesised, 7.56×10⁻⁵ [eV²] bracketed), so key also on the bare decimal against a curated constant table.

**(c) Modulo-quantum quantities — a new lint semantics.** Berry/Zak phases (mod 2π), the modern-theory-of-polarization P (mod eR/Ω — the quantum, 105 μC/cm² for a perovskite, *exceeds* typical spontaneous polarizations), Wannier centers, θ-angles. Equality and comparison only make sense modulo the quantum, with a branch tag.

**(d) Sign-axis extensions.** The round-2 axis gains: the hypersurface sub-axis (extrinsic-curvature sign × normal orientation — with the diagnostic that K-*quadratic* terms are invariant, so the error survives half a paper before biting; calibrate from K = ∓3H in FLRW); the stress-tensor-from-variation triple (sign, δg^μν vs δg_μν, the factor 2); the geometers' positive Laplacian Δ = −∇²; symplectic/Poisson sign; spinor-ε conventions (only odd-ε bilinears flip: ψχ masses and Yukawas, never ψσ^μχ̄); optical handedness/Stokes-V (IEEE vs optics vs IAU — a Z₂×Z₂ with the time convention of which only the product is physical); spinor-helicity bracket phases.

**(e) Parameterized symbol families.** Beam sizes (w at 1/e² vs 1/e vs σ vs FWHM, radius vs diameter: ×4 in intensity), pulse durations (T₀ vs FWHM with shape factors 1.763/1.665: ×3.1 in T₀²-quantities), resonator rates (loaded/unloaded Q, κ as FWHM vs HWHM, g vs 2g splitting, C = g² vs 4g²/κγ). Schema: a symbol family + parameterization tag + exact conversion table, resolved from the printed defining expression.

**(f) Declaration-layer extensions.** Lattice-sum scoping (⟨ij⟩+h.c. vs Σ_{i,δ}: t doubles, W = 8t vs 16t — with a bandwidth cross-check lint); EPR parameters quoted in field units resolved by lifting the paper's own fitted g as a custom generator; suppressed standard-state divisors inside transcendental functions (a dimensionful log argument is a *convention*, not an error — and fitted intercepts co-transform: ln A shifts by 47.85 when a bimolecular rate changes units). **Scope it (round 4): suppress the *argument* of the transcendental, then still dimension-check the term it sits in** — Eq. (9) of 1908.11170 adds a pure number to a quantity in hertz inside an exponential. Plus one refinement from a rejected duplicate: **split the affine class** into refuse (fixed nonlinear scales) and tag-and-restrict (per-paper origins: differences convertible, absolute values not).

One verified **non-gap** worth recording: formal grading parameters (ħ-, c⁻²-, α′-order counting in expansions) need no machinery — per-term restoration *reconstructs* the grading, and terms already carrying their explicit power solve to residual exponent zero.

### 2.14 Round 4: empirical contact *(twelve-paper pilot + five-lens top-up, adjudicated)*

The census's first contact with real papers: twelve equation-dense arXiv papers processed as the engine would process them (GRMHD 1904.04923, inflation astro-ph/0210603, lattice 1006.4518, SMEFT 1008.4884, LIGO 1908.11170, HAYSTAC 1706.08388, DFT+U cond-mat/0405160, polaritonic CC 2005.04477, Kerr solitons 1508.04989, AstroGK 1004.0279, NV-center 1107.3868, PMNS 1710.00715), plus the five reader lenses earlier rounds lacked (nuclear, neutrino, quantum information, thermo/stat-mech, acoustics). Verified outcome: 232 claims — 163 pilot clusters (102 confirmed, 47 corrected, 14 defended), 51 lens gaps (37/6/7, 1 unadjudicated), 18 backlog rows — folded in as 36 surgical corrections through this document, the §5 round-4 tables, and the §3 backlog additions.

Aggregate empirical facts worth pinning: symbol resolution across 555 sampled symbols ran **54% domain-profile / 35% paper-mining / 10% ask-the-user** (the acquisition-tier architecture holds); the §6.5 declaration cues had **zero recall on two heavily-cited papers** (hence §6.5b); and the registry-closure claim died (§2.5 as amended) — each subfield contributes its own open tail of forks.

Structural findings (cluster ids refer to the round-4 dedup archive `pv_dedup.json`, held in the private census workshop):
- **Intra-document quantity-symbol homographs** — One glyph carries two to five quantities inside one paper: astro-ph/0210603 uses η for conformal time, the slow-roll parameter and the iε contour. Row 407's resolver is era-gated and scoped to unit symbols. (C01)
- **The identity tag vector must be declared open** — §1 item 7 prints it with an ellipsis, §2.13(a) closed. Most proposed slots are instances of existing axes (xc functional is *scheme*, LNRF tetrad is *frame*), so declare it extensible with per-field vocabularies. (C04)
- **Silent hat-dropping** — §6.5(iii) makes "we drop the hats" the switch, and 1004.0279 drops them with no marker, so a correct normalized equation is flagged inhomogeneous. Fallback: a per-equation homogeneity vote plus a same-symbol-two-states report. (C09)
- **Two more symbol-resolution outcomes** — A *needs a cited paper* tier, normal for Part-I/II series, and a **decline** class for load-bearing undefined symbols. In 1508.04989 κ_c, F_p, A_eff, ξ₀ and α_in each appear once and are defined nowhere. (C10)
- **Per-paper dimensionless rescalings** — §2.2 covers per-paper *dimensionful* scales, §2.5 *global* dimensionless factors; the fourth quadrant is invisible to dimensional analysis yet invertible once mined. Extend `numeric_factor` to symbolic residues (ε = ρ₀/a₀ on every first-order quantity). (C12)
- **Intra-paper algebraic cross-check lint** — 1508.04989 derives μ_th = √((κ/D₂)(…)) then prints √(D₂/κ) as its specialization, inverted by ≈ 10². Both sides are dimensionless, so the missing rule is "specialize the previous equation and compare". (C14)
- **Deferred-obligation fork state** — 1008.4884 declines SSB, so v = 246 vs 174 and the Yukawa √2 never instantiate although every consumer meets them. Correct output is a deferred-obligation marker on Γ_{e,u,d}, not "undetermined". (C20)
- **Typo-vs-convention adjudication** — 1706.08388 drops k_B for one display and restores it two sentences later. The ruling (erratum) is derivable from the defining equation, but the rule is unwritten and §2.7's granularity is sections. (C21)
- **Attributing a dimensionless factor inside a product** — 1706.08388's Eq. (6) prints 2π/μ₀, where the 2π belongs to ω = 2πν. The registry can say a 2π is present but not which convention owns it, and ownership decides whether it survives translation. (C22)
- **Repair-proposal output shape** — On a *true* positive there is no schema for the k minimal repairs: the printed L_Edd = 4πGMc/σ_T has exactly two standard ones (insert m_p, or read σ_T as an opacity). The census specifies detection and refusal only. (C23)
- **Multi-implementation nesting** — §2.7 models one author switching at a section boundary, not N implementations of one convention each with its own numerics. 1904.04923 carries nine code-specific layers: floors, coordinate maps, σ ceilings, Lorentz caps. (C24)
- **An `imported_artifact` span class** — A waveform generated in G = c = M = 1 code units and reported only as "scaled to M = 74.6 M_⊙" carries a convention never named. Data-product imports are the norm in GW, cosmology and lattice, each with its own unstated span. (C25)
- **An opaque instrument-scale generator** — ADC counts have no place in (M, L, T, Θ, I), yet 1908.11170's h(t) = (1/L)[𝒞⁻¹d_err + 𝒜d_ctrl] needs count/m and m/count. Add a per-paper generator of *unknown* dimension whose only law is that it cancels. (C33)
- **A display-normalization layer** — §2.6 has a display-*unit* map but no slot for results quoted in units of a *derived quantity*: 1004.0279 integrates in a₀/v_th0 and reports frequencies in ω_A = k_∥v_A. It defeats an extractor that has correctly read the code declaration. (C76)
- **Fiducial-model reference units** — Ratios to a theory benchmark ("2.3 × g_γ^KSVZ", "× the neutrino floor") need a `reference_model` kind beside {fundamental_constant, theory_scale, solution_parameter, regulator}. Cluster D does not cover a unit whose value is a prediction. (C95)
- **Identity tags must attach to operators** — 1004.0279 uses the gyro-average at fixed gyrocentre ⟨·⟩_{R_s} and at fixed particle position ⟨·⟩_r in one equation block, separated only by a subscript. Extend the vector to operators: averaging basepoint, ensemble vs flux-surface, notation forks. (C141)
- **Dimension as a bound variable** — Group-theoretic papers tabulate operators (o_{a,A₁}, Ô_{p,q}) for a *generic* tensor operator, dimensioned only at a later substitution. This needs dimension *unification*, with the whole vector free rather than one exponent symbolic in d. (C147)
- **Absence is not absorption** — §6.4's anti-heuristic runs in the presence direction only, and the complement converts silence into a generator set. Test whether any printed equation *would* have carried ħ, c, e or ε₀ under SI — in cond-mat/0405160 none would have. (C154)
- **Second-quantized fingerprints** — Every discriminator in registry #9 and §6.4's list is first-quantized (−½∇², Z/r, c = 137), and a coupled-cluster paper prints none. The corpus needs h_pq/g_pqrs structure, basis-family names (cc-pVXZ, def2-, 6-31G) and program identity. (C156)
- **A code-identity → convention table** — §9 records one such fact in passing ("Elk is a Hartree-unit code") and §6.5 cue (vi) lists generic keywords. Nothing covers e^T, Psi4, Dalton, ORCA, Molpro, CFOUR or Gaussian, yet on 2005.04477 code identity is the only evidence for m_e = e = 1. (C157)
- **Truncation provenance, not a regulator slot** — A single-mode cavity truncation never enters the dimension algebra, so it cannot live on §2.2's `kind: regulator`. A restored quantity is meaningful only alongside the truncation and level of theory that produced it — an identity-layer obligation. (C162)

---

## 3. Master table

Class legend — **quotient**: generator set fully specifies the system. **quotient + riders**: needs per-symbol rescalings against the SI base *as recorded* (may collapse to quotient under the §2.4 span rule). Twin rows across families may show either the recorded or the effective verdict — the Adjudication note says which — and §1's tallies count table rows, twins included. **custom generators**: per-paper scales, symbolic restoration. **numeric-only**: unit-magnitude rescaling of SI, converter not translator. **document-hybrid**: per-section convention state. **unsupported**: refuse and explain. The Adjudication column records corrections applied after adversarial verification.

### SI and the CGS electromagnetic family

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| SI (2019 revision) | `(none)` | quotient | **v1** |  |
| MKSA / pre-2019 SI (Giorgi rationalized system) | `(none)` | quotient | **v1** |  |
| Unrationalized MKS (pre-1950 Giorgi; Kennelly-type MKS) | `(none)` | quotient + riders | **v2** | renamed "Unrationalized MKS (pre-1948 alternative)"; Giorgi/Kennelly attributions retracted |
| SI with the Kennelly (magnetic-polarization) convention | `(none)` | quotient + riders | **v2** |  |
| CGS-Gaussian | `4\pi\varepsilon_0` | quotient + riders | **v1** |  |
| CGS-ESU (electrostatic units) | `4\pi\varepsilon_0` | quotient + riders | **v1** |  |
| CGS-EMU (electromagnetic units) | `1/(4\pi)·\mu_0/(4\pi)` | quotient + riders | **v1** |  |
| Heaviside–Lorentz | `\varepsilon_0` | quotient + riders | **v1** |  |
| Variant-Gaussian (hybrid "rogue" convention) | `4\pi\varepsilon_0; 1/(4\pi)·\mu_0/(4\pi)` | unsupported | **v2** |  |
| Practical/mixed CGS of experimental magnetism ("the emu system" as used in materials science) | `4\pi\varepsilon_0` | quotient + riders | **v2** |  |
| Jackson 3rd edition hybrid (document-level convention) | `(none)` | document-hybrid | **v1** | was generators_only + empty set — self-contradictory |
| Gaussian-geometrized (Gaussian with G = c = 1) | `4\pi\varepsilon_0; c; G` | quotient + riders | **v1** | recorded verdict; effective = quotient by the §2.4 span rule (c is restored) — twin of the GR-family row |
| Heaviside–Lorentz natural units (ħ = c = 1, rationalized) | `\varepsilon_0; \hbar; c` | quotient + riders | **v1** |  |
| QES practical system (quadrant–eleventhgram–second) | `1/(4\pi)·\mu_0/(4\pi)` | quotient + riders | **out_of_scope** | carried 4π riders while tagged generators_only |
| International electrical units (1893/1908–1948) | `(none)` | quotient + riders | **out_of_scope** |  |
| Gauss's absolute magnetic system (1832) | `1/(4\pi)·\mu_0/(4\pi)` | unsupported | **out_of_scope** |  |
| Weber's absolute electrodynamic system | `(none)` | unsupported | **out_of_scope** |  |

### Natural units — HEP, QFT, strings

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| HEP natural units (ħ = c = 1) with Heaviside–Lorentz electromagnetism | `\hbar; c; \varepsilon_0` | quotient + riders | **v1** | same generator set as the E&M-family "Heaviside–Lorentz natural units" row — counted twice in row tallies (§3 legend) |
| HEP natural units with Boltzmann constant (ħ = c = k_B = 1, Heaviside–Lorentz) | `\hbar; c; k_B; \varepsilon_0` | quotient + riders | **v1** |  |
| Gaussian natural units (ħ = c = 4πε₀ = 1) | `\hbar; c; 4\pi·\varepsilon_0` | quotient + riders | **v1** |  |
| Hybrid: ħ = c = 1 with SI/laboratory electromagnetism retained (ε₀ NOT set) | `\hbar; c` | quotient + riders | **v2** |  |
| CODATA/NIST natural units (ħ = c = m_e = 1) | `\hbar; c; m_e; 1 (Heaviside–Lorentz flavour) or 4\pi (Gaussian flavour) — paper-dependent·\varepsilon_0` | quotient + riders | **v2** | extra-c rider listed; alias "relativistic units" removed (collides with c=1-only row) |
| Relativistic units (c = 1 only; ħ retained) | `c` | quotient + riders | **v2** | benchmarks rewritten ε₀-explicit; rider listed |
| Planck units, Gaussian flavour (ħ = c = G = k_B = 4πε₀ = 1) | `\hbar; c; G; k_B; 4\pi·\varepsilon_0` | quotient + riders | **v1** |  |
| Planck units, Heaviside–Lorentz flavour (ħ = c = G = k_B = ε₀ = 1) | `\hbar; c; G; k_B; \varepsilon_0` | quotient + riders | **v2** |  |
| Reduced Planck units (ħ = c = k_B = 1, 8πG = 1, M̄_pl = 1) | `\hbar; c; k_B; 8\pi·G; \varepsilon_0` | quotient + riders | **v1** |  |
| Holographic/SUGRA gravitational units (16πG = 1, equivalently 2κ² = 1) | `\hbar; c; 16\pi·G` | quotient + riders | **v1** |  |
| String units α' = 1 (with ħ = c = 1) | `\hbar; c; \alpha'` | quotient | **v1** |  |
| String length units ℓ_s = 1 with α' = ℓ_s² | `\hbar; c; \alpha'` | quotient | **v1** |  |
| String length units ℓ_s = 1 with ℓ_s = 2π√α' (2π convention) | `\hbar; c; (2\pi)^2·\alpha'` | quotient | **v1** |  |
| Worldsheet-convenience convention α' = 2 (closed string) | `\hbar; c; \tfrac12·\alpha'` | quotient | **v2** |  |
| Worldsheet-convenience convention α' = 1/2 (open string) | `\hbar; c; 2·\alpha'` | quotient | **v2** |  |
| Eleven-dimensional Planck / M-theory units (ℓ_p = 1, or 2κ₁₁² = 1) | `\hbar; c; \ell_p^{(11)}` | quotient | **v2** |  |
| AdS radius units (L = 1), usually with 16πG = 1 | `\hbar; c; L_{\rm AdS}; 16\pi\ (\text{when } 16\pi G = 1 \text{ is also imposed})·G` | custom generators | **v2** |  |
| Lattice units (a = 1) on top of ħ = c = 1 | `\hbar; c; a\ (\text{lattice spacing})` | custom generators | **v1** |  |
| Stoney units (c = G = e²/4πε₀ = 1; ħ ≠ 1) | `c; G; \dfrac{e^2}{4\pi\varepsilon_0}` | quotient | **out_of_scope** |  |

### General relativity, cosmology, dynamical astronomy

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Geometrized units (G = c = 1) | `c; G` | quotient | **v1** |  |
| Geometrized-Gaussian units (G = c = 4\pi\varepsilon_0 = 1) | `c; G; 4\pi\varepsilon_0` | quotient | **v1** | c is a generator here → the c-rider is supplied by the quotient (riders are relative to the generator set); effective verdict shown |
| Geometrized Heaviside-Lorentz units (G = c = \varepsilon_0 = 1) | `c; G; \varepsilon_0` | quotient | **v2** | same relativity-of-riders argument; effective verdict shown |
| Black-hole scale units (G = c = M = 1; 'in units of M') | `c; G; M` | custom generators | **v1** |  |
| Numerical-relativity code units (G = c = M_\odot = 1) | `c; G; M_\odot` | quotient | **v2** | twin of the nondimensionalization-family row (recorded there as custom generators, v1) |
| GRMHD code units (G = c = 1, M = 1, \sqrt{4\pi} absorbed into B) | `c; G; M_{\rm BH}; \varepsilon_0` | quotient + riders | **v2** | EM generator corrected to ε₀ (Heaviside–Lorentz), not 4πε₀ — cell fixed |
| c = 1 only (relativist's / special-relativity units) | `c` | quotient | **v1** |  |
| Reduced-Planck cosmology units (\hbar = c = k_B = 8\pi G = 1) | `c; \hbar; 8\pi G; k_B` | quotient | **v1** |  |
| Classical \kappa = 1 units (8\pi G = c = 1, \hbar not set) | `c; 8\pi G` | quotient | **v1** |  |
| Planck units (G = c = \hbar = k_B = 1) | `c; G; \hbar; k_B` | quotient | **v1** | EM-flavour ambiguity is variant selection, not a rescaling |
| \kappa kept symbolic (Einstein's gravitational constant as a named combination) | `(none)` | custom generators | **v1** |  |
| Gaussian-CGS relativistic astrophysics (all constants explicit; Landau-Lifshitz style) | `4\pi\varepsilon_0` | quotient + riders | **v2** |  |
| Observational cosmology hybrid units (km s^{-1} Mpc^{-1}, Mpc, M_\odot, K, eV) | `(none)` | numeric-only | **v1** | display units (Cluster D): zero generators, nothing to restore |
| Little-h units (h^{-1} Mpc, h^{-1} M_\odot, h^2 densities) | `(none)` | quotient + riders | **v1** |  |
| Comoving / scale-factor normalization conventions | `(none)` | quotient + riders | **v1** |  |
| Hubble units (H_0 = 1, or H = 1 during inflation) | `c; H_0` | custom generators | **v2** |  |
| Hénon units (N-body units): G = M = 1, E = -1/4 | `G; M_{\rm tot}; 4·\|E_{\rm tot}\|` | quotient | **v2** | twin of the nondim-family Hénon row; the two numeric_factor conventions (4·|E| vs −1/4·E) must be reconciled at encoding |
| Model-scale units (G = M = a = 1; Plummer/King/NFW model units) | `G; M; a` | quotient | **v2** |  |
| Galactic-dynamics units (kpc, M_\odot, km s^{-1} or Myr) | `(none)` | numeric-only | **v2** | display units (Cluster D) |
| galpy / AGAMA normalized units (R_0 = v_c = 1) | `R_0; v_c(R_0); G` | custom generators | **v2** |  |
| Gaussian celestial-mechanics units (au, day, M_\odot; Gaussian gravitational constant k) | `(none)` | numeric-only | **v2** | display units (Cluster D); the k-constant content is a numeric-epoch tag |
| Astrodynamics canonical units (\mu = 1 DU^3/TU^2) | `GM_{\rm central}; \mathrm{DU}; M_{\rm central}` | custom generators | **v2** |  |
| Ephemeris units and the TDB/TCB time-scale rescaling | `(none)` | quotient + riders | **v2** |  |
| Astronomical magnitudes (logarithmic scale) | `(none)` | unsupported | **out_of_scope** |  |
| Radio and millimetre flux units (Jansky family) | `(none)` | numeric-only | **v2** | display units (Cluster D); Jy/beam stays refuse-class (§7) |
| Stellar and solar reference units (M_\odot, R_\odot, L_\odot; IAU nominal values) | `(none)` | numeric-only | **v2** | display units (Cluster D); store GM_⊙ as primary (T9) |

### Atomic, molecular, condensed matter, spectroscopy

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Hartree atomic units (SI-based rendering, 4πε₀ = 1) | `\hbar; m_e; e; 4\pi·\varepsilon_0` | quotient | **v1** |  |
| Hartree atomic units (Gaussian/cgs-based rendering) | `\hbar; m_e; e` | quotient + riders | **v1** |  |
| Rydberg atomic units | `\hbar; 2·m_e; 1/\sqrt{2}·e; 4\pi·\varepsilon_0` | quotient | **v1** | SI rendering is a pure 4-generator quotient; magnetic riders belong to the Gaussian rendering |
| Relativistic (Dirac) atomic units — ħ = m_e = c = 1 | `\hbar; m_e; c` | quotient + riders | **v2** | carries the Gaussian/HL fork in its rescaling list |
| Effective (excitonic / material) atomic units — m* = 1, ε absorbed | `\hbar; 1 (Hartree-like) or 2 (Rydberg-like)·m^{*}; 1 (Hartree-like) or 1/2 (Rydberg-like)·e^2/(4\pi\varepsilon_0\varepsilon_r)` | custom generators | **v1** |  |
| Quantum-chemistry molar energy conventions (kcal mol⁻¹, kJ mol⁻¹, eV) | `N_A` | custom generators | **v1** |  |
| k_B = 1 (temperature as energy) | `k_B` | quotient | **v1** |  |
| Spectroscopists' energy equivalences (cm⁻¹, GHz, K, eV, nm) | `hc; h; 1/(2\pi)·\hbar; k_B` | numeric-only | **v1** | converter-graph edge set, not an independent generator basis (§2.9): h and ħ share a dimension vector |
| Molecular-constant conventions (rotational and vibrational spectroscopy) | `hc; h` | quotient + riders | **v2** |  |
| Condensed-matter theory units (ħ = k_B = 1, lattice constant a = 1) | `\hbar; k_B; a\ (\text{lattice constant}); e` | custom generators | **v2** | rank-deficient as declared ({ħ,k_B,a,e} fixes no energy scale) — records the published declaration, not a valid generator set (§2.3) |
| Model-Hamiltonian units (t = 1, J = 1, U/t) | `t\ (\text{hopping integral}); 1, 2, \text{ or } -1\ \text{depending on the Hamiltonian convention (see rescalings)}·J\ (\text{exchange coupling}); \hbar` | custom generators | **v2** | rank-deficient as declared: t and J share a dimension vector, so "t = 1, J = 1" is the physics claim J/t = 1 (§2.3) |
| CGS-emu / Gaussian magnetism (gauss, oersted, emu) | `1 (unrationalized: the 4\pi is written explicitly in the field equations, not absorbed)·\mu_0` | quotient + riders | **v1** |  |
| SI magnetism — Sommerfeld vs Kennelly conventions | `(none)` | quotient + riders | **v1** |  |
| cgs-esu molecular electric property units (debye, Å³ polarizability, buckingham) | `(none)` | quotient + riders | **v1** |  |
| Solid-state and DFT practical units (eV, Å, meV/atom, GPa, r.l.u.) | `(none)` | numeric-only | **v1** | practical lookup dialects, not a generator system; table BOTH dialects — VASP (eV, Å, meV/atom, GPa), Quantum-ESPRESSO (Ry, bohr, Mbar) and abinit (Ha, bohr — a Hartree code, not a Rydberg one; the 2026-09-02 code-identity table caught the earlier conflation) (C42, C153) |
| Molecular-dynamics simulation unit sets (LAMMPS real/metal/electron, GROMACS, AMBER, reduced LJ) | `\varepsilon\ (\text{LJ well depth}); \sigma\ (\text{LJ diameter}); m\ (\text{particle mass}); k_B` | custom generators | **v2** | the `units electron` variant is refuse-class (§7); the other sets are lookup-table custom generators |
| Magnetic-resonance units (NMR/EPR: ppm, Hz, gauss, MHz/T) | `(none)` | quotient + riders | **v2** | h is not a generator: A_⊥/h, P/h and d/h are explicit divisors while ħ stands unabsorbed, and h = 1 would force ħ = 1/2π. The H/h rendering is a per-symbol **span-scoped display rider** over {D, E, A, P, d, λ, f, a, χ} |
| Historical X-ray and spectroscopic length units (X unit, kX, ångström star; air vs vacuum wavelengths) | `(none)` | numeric-only | **v2** | reclassified from unsupported: the kX scale and the air/vacuum medium tag are convertible (§5 round-3) |

### Historical and engineering (boundary family)

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Foot–pound–second, absolute (poundal) system | `(none)` | numeric-only | **out_of_scope** | new class: pure unit-magnitude rescaling — nothing to restore |
| British Gravitational / foot–slug–second system (and its inch-based variant) | `(none)` | numeric-only | **out_of_scope** | same |
| English Engineering system (lbm + lbf with g_c) | `32.174049 — NOT absorbed; this is the value the constant is SET TO and it is written explicitly in every dynamical equation. The schema has no field for an inserted (rather than absorbed) constant.·g_c; 778.169 ft·lbf/Btu_IT — the mechanical equivalent of heat, again inserted rather than absorbed; appears as 1/J in pre-SI first-law statements. Optional: only present when the thermal subsystem (Btu) is in use.·J` | custom generators | **out_of_scope** | kernel audit (round 5): the recorded dimension tuples use the force-extended 6-basis, which a 5-basis parser reads as degenerate — `role: inserted` systems need an extended-basis flag in the schema |
| Gravitational metric (technical) system — MKpS/MKfS, and its non-coherent kg+kgf engineering variant | `9.80665 kg·m/(kgf·s²) — inserted, not absorbed; present ONLY in the non-coherent variant that uses kg for mass and kgf for force simultaneously. The coherent MKpS system (kp + hyl) has NO generators at all.·g_c` | custom generators | **out_of_scope** |  |
| Metre–tonne–second (MTS) system | `(none)` | numeric-only | **out_of_scope** | same; rutherford–MTS fingerprint retracted (invented) |
| Practical electrical units (1881 BAAS/Paris Congress) and the QES absolute system | `(none)` | quotient + riders | **v2** | benchmarks are unrationalized EMU forms; generators must carry the 4π and c² |
| International electrical units (1893 Chicago / 1908 London, in force to 1 Jan 1948) | `(none)` | quotient + riders | **v2** |  |
| Conventional electrical units of 1990 (V₉₀, Ω₉₀) | `(none)` | quotient + riders | **v2** |  |

### Per-paper nondimensionalization

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Inertial (convective) scaling of the incompressible Navier–Stokes equations | `L; U; \rho` | custom generators | **v1** |  |
| Viscous (diffusive/Stokes) scaling of the incompressible Navier–Stokes equations | `L; \nu; \rho` | custom generators | **v2** |  |
| Compressible / aerodynamic (Mach) nondimensionalization | `L; \rho_\infty; a_\infty \ \text{or}\ U_\infty; R \ (\text{gas constant, when }T\text{ is nondimensionalized})` | quotient + riders | **v2** |  |
| Boussinesq free-fall (buoyancy) scaling | `H; U_f=\sqrt{g\alpha\Delta T H}; \Delta T; \rho_0` | quotient + riders | **v2** | affine θ-offset flagged; was needs_custom_generators |
| Boussinesq diffusive (thermal) scaling | `H; \kappa; \Delta T; \rho_0` | custom generators | **v2** |  |
| Periodic-box spectral units | `2\pi \ \text{or}\ 1·L_\text{box}; u_\text{rms}\ \text{or}\ \varepsilon^{1/3}L^{1/3}; \rho_0` | custom generators | **v2** |  |
| MHD Alfvénic code units | `L_0; \rho_0; B_0; 1 \ (\text{SI-rooted})\ \text{or}\ 4\pi \ (\text{Gaussian-rooted})·\mu_0` | quotient + riders | **v2** |  |
| Gyrokinetic normalization, GENE / c_s family | `L_\text{ref}\ (=R_0\ \text{or}\ a); c_\text{ref}=\sqrt{T_\text{ref}/m_\text{ref}}; T_\text{ref}\ (\text{energy units},\ k_B=1); m_\text{ref}; n_\text{ref}; e; B_\text{ref}` | quotient + riders | **v2** |  |
| Gyrokinetic normalization, GS2 / stella / AstroGK family | `a\ (\text{minor radius / reference length}); \sqrt{2}·v_{t,r}=\sqrt{2T_r/m_r}; T_r; m_r; n_r; B_r` | quotient + riders | **v2** | kernel audit (round 5): recorded 6-generator set has rank 4 — same-dimension reference scales; this is the C34 direction-split-length issue in executable form; needs the anisotropy/symmetry flag at encoding |
| PIC / kinetic-plasma normalized units | `\omega_{pe}=\sqrt{n_0e^2/(\varepsilon_0m_e)}; c; m_e; e; n_0` | custom generators | **v2** | kernel audit (round 5): recorded 5-generator set has rank 4 — tuples need reconciliation at encoding |
| Numerical-relativity code units (G = c = M = 1) | `G; c; M\ (\text{total ADM mass, or }M_\odot)` | custom generators | **v1** |  |
| Astrophysical simulation code-unit triples (G ≠ 1) | `[L]\ (\text{e.g. } \mathrm{kpc}/h); [M]\ (\text{e.g. } 10^{10}M_\odot/h); [V]\ (\text{e.g. } \mathrm{km\,s^{-1}})` | custom generators | **v2** |  |
| GRMHD code units (G = c = M = 1 plus an independent density/accretion scale) | `G; c; M_\text{BH}; \mathcal{M}_\text{unit}\ (\text{mass/density scale of the accreting plasma})` | quotient + riders | **v2** | √4π reconciled with the GR-family twin: record it **once**, as the B → B/√4π rider, the EM generator ε₀ (HL) carrying no numeric factor. ℳ_unit has two branches: **assigned** (legitimate by the density-rescaling symmetry) and **scale-free** (no ℳ_unit — the density scale is *missing*, and density-weighted restoration must refuse) |
| Shearing-box / accretion-disk units (Ω = 1) | `1\ \text{or}\ 2\pi·\Omega\ (\text{orbital angular frequency}); 1\ (\text{sometimes}\ \sqrt{2}\ \text{for the isothermal-vs-adiabatic }c_s)·c_s\ \text{or}\ H=c_s/\Omega; \rho_0\ (\text{midplane density})` | custom generators | **v2** |  |
| Hénon (N-body standard) units | `G; M\ (\text{total cluster mass}); -1/4·E\ (\text{total energy})` | custom generators | **v2** |  |
| Lennard-Jones reduced (molecular-dynamics) units | `\sigma\ (\text{LJ length}); \varepsilon\ (\text{LJ well depth}); m; k_B` | custom generators | **v1** | twin of the atomic-cm MD-unit-sets row (v2 there); v1 here governs |
| Soft-matter / coarse-grained reduced units with electrostatics | `\sigma\ \text{or}\ r_c\ (\text{bead diameter / DPD cutoff}); k_BT; m; 4\pi\varepsilon_0\varepsilon_r\ (\text{absorbed into }\ell_B)` | quotient + riders | **v2** |  |
| Hamiltonian and classical-chaos conventions (m = ω = 1, Lyapunov-time rescaling) | `m; 1\ \text{or}\ 2\pi·\omega\ (\text{a chosen mode frequency, orbital frequency, or }\lambda_\text{max}); E\ \text{or}\ \hbar\ \text{or}\ L\ (\text{third scale, problem-dependent})` | custom generators | **v1** |  |
| Lattice-model condensed-matter units (a = ħ = t = 1) | `a\ (\text{lattice constant}); \hbar; t\ \text{or}\ J\ (\text{hopping or exchange energy}); k_B; e\ (\text{when a flux or field is present})` | quotient + riders | **v1** |  |
| Harmonic-trap units (BEC / Gross–Pitaevskii) | `\hbar; m; \omega_\perp\ \text{or}\ \omega_\text{ho}=(\omega_x\omega_y\omega_z)^{1/3}` | quotient + riders | **v1** |  |
| Optical-lattice recoil units | `\hbar; k_L=2\pi/\lambda; 1/2·E_R=\hbar^2k_L^2/(2m)` | quotient + riders | **v2** |  |
| Cavity-QED / circuit-QED and open-system conventions | `\hbar; g\ \text{or}\ \kappa\ \text{or}\ \omega_c\ (\text{one chosen rate set to }1)` | quotient + riders | **v2** |  |
| Fermi units (ħ = k_F = 1, with m or E_F set to 1) | `\hbar; k_F; m\ \text{or}\ E_F\ (\text{third generator; only one may be chosen})` | quotient + riders | **v2** |  |
| Soliton / NLS normalization (nonlinear fiber optics) | `T_0\ (\text{pulse duration}); L_D=T_0^2/\|\beta_2\|; P_0\ (\text{peak power})` | custom generators | **v2** |  |
| Dimensionless-generator declarations (little-h units, "units where Re = 1", α = 1) | `h\ (H_0 = 100h\ \mathrm{km\,s^{-1}Mpc^{-1}}); \mathrm{Mpc}; M_\odot` | custom generators | **v2** | reclassified from unsupported: little-h has its own v1 row; dimensionless declarations route to the rank check, which names the implied Π-group (§2.3) |


#### Backlog additions — natural units / GR / historical

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Kolb–Turner units (ħ = c = k_B = 1; G retained as m_Pl⁻², m_Pl unreduced) | `\hbar; c; k_B\ (G\ \text{kept as } m_{\rm Pl}^{-2},\ m_{\rm Pl}\ \text{unreduced})` | quotient | **v1** | backlog round 4, verified; residual rank 1 (mass) against rank 0 for Planck and reduced-Planck; discriminator is the 8π in H² = 8πρ/3m_Pl² |
| GADGET / AREPO / GIZMO cosmological code units (G = 43007.1 internal) | `[L] = h^{-1}\mathrm{kpc}; [M] = 10^{10}h^{-1}M_\odot; [V] = \mathrm{km\,s^{-1}}` | custom generators | **v2** | backlog round 4, verified; twin of the nondim code-unit-triple row; 43007.1 pins G_cgs = 6.672×10⁻⁸ (CODATA-2022 gives 43021.9) |
| Schrödinger units (ħ = G = e²/4πε₀ = 1 ⇒ c = 1/α = 137.036) | `\hbar; G; \dfrac{e^2}{4\pi\varepsilon_0}` | quotient | **v2** | backlog round 4, verified; rank 3, well-posed; c = 137.036 is *derived* — never read it as a generator (§6.4's 137-set becomes a quintet) |
| Physical atomic-mass scale (¹⁶O ≡ 16), pre-1961 | `(none)` | numeric-only | **v2** | backlog round 4, verified; 1 u = 1.00031794 amu_phys (+317.94 ppm); the §5 N_A fingerprint is weak — the tell is ¹⁶O = 16.000000 with ¹²C ≠ 12 |
| Chemical atomic-mass scale (natural oxygen ≡ 16), pre-1961 | `(none)` | numeric-only | **v2** | backlog round 4, verified; unified/chemical = 1.0000429; the one factor that is not a constant of nature — store it with an oxygen-composition tag |
| Pre-1990 as-maintained national electrical units (V_NBS, V₆₉, Ω_NBS) | `(none)` | quotient + riders | **v2** | backlog round 4, verified; twin of the 1990 conventional-units row; V₉₀/V_NBS = 1 + 9.264×10⁻⁶, the ohm +1.69×10⁻⁶ — record the direction |
| Legal ohm of 1884 (Paris International Conference of Electricians) | `(none)` | numeric-only | **v2** | backlog round 4, verified; −0.28222% against the international ohm and −0.23336% against the absolute — store both; never alias (§7) |
| Weber's electrodynamic charge and current units (q_ed = q_EMU/√2) | `(none)` | numeric-only | **v2** | backlog round 4, verified; a magnitudes-only converter carved from the unsupported Weber row; fingerprint c_W = √2c = 4.2397×10⁸ m/s (§6.6) |

#### Backlog additions — nondimensionalization presets

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Rotating-frame (GFD) scaling — Rossby, Ekman, Burger | `L; H; 1\ \text{or}\ 2·\Omega\ (\text{declared as } f\ \text{or as }\Omega); U; \rho_0` | custom generators | **v2** | backlog round 4, verified; Ro and Ek each carry an exact ×2 fork and Bu a square-root fork; all three are residues (§2.10) |
| Geodynamo scalings and the Elsasser magnetic-field normalizations | `D; 1\ \text{or}\ 2·\Omega; \rho_0; \eta; 1\ \text{or}\ 4\pi·\mu_0; \sqrt{\rho\mu_0\eta\Omega}\ \text{or}\ \sqrt{\rho\mu_0}U·B_0` | quotient + riders | **v2** | backlog round 4, verified; mirrors the MHD Alfvénic √(4π); Ra* = RaE²/Pr is 10⁻¹² at E = 10⁻⁶, so Ra = 10¹⁰ and Ra* = 10⁻² are one run |
| Kolmogorov (dissipation-range) units — η, u_η, τ_η | `\nu; \varepsilon; \rho` | custom generators | **v2** | backlog round 4, verified; rank 3, well-posed — ν = ε = ρ = 1 is exactly η = u_η = τ_η = 1, Re_η = 1 identically; k_maxη is a resolution criterion |
| Lattice-Boltzmann units (δx = δt = 1, c_s² = 1/3, ν = (τ−½)c_s²) | `\delta x; \delta t; \rho_0` | custom generators | **v2** | backlog round 4, verified; rank 3, well-posed; dropping the −½ is ×2–6 in ν and Re; "c = 1" here is the lattice speed, a §6.4 homograph |
| CR3BP canonical (synodic) units — G(m₁+m₂) = a = n = 1, residue μ | `G(m_1+m_2); a\ (\mathrm{DU}); n^{-1}\ (\mathrm{TU})` | custom generators | **v2** | backlog round 4, verified; merges with the astrodynamics canonical row (§8); μ is a residue (§2.10); Jacobi carries a ×2 and a ±½μ(1−μ) fork |
| Lane–Emden polytrope scaling (θ, ξ, α) | `\alpha = \big[(n+1)K\rho_c^{1/n-1}/4\pi G\big]^{1/2}; \rho_c; G` | custom generators | **v2** | backlog round 4, verified; [K] = M^(−1/n)L^((2n+3)/n)T⁻², so the generator's *dimension* depends on n — lift n before the solve |
| Gross–Pitaevskii healing-length units (ξ = ħ/√(2mgn) vs ħ/√(mgn)) | `\hbar; m; \tfrac12\ \text{or}\ 1·mgn` | quotient + riders | **v1** | backlog round 4, verified; a genuine √2 fork; the Laplacian coefficient (1 vs ½) discriminates and the dark-soliton width is ħ/√(mgn) always |
| Fourier–diffusion scaling (Fo, Bi, Pe, Sc) | `L_c\ (V/A_s,\ R,\ \text{or}\ D_h); \alpha\ \text{or}\ D; \Delta T; \rho c_p` | quotient + riders | **v2** | backlog round 4, verified; the θ offset is affine — tag-and-restrict (§2.13(f)); the L_c fork is ×3 in Bi and ×9 in Fo for a sphere |
| Combustion/flame units (δ_L, s_L, Ze, Da, Ka) | `\delta_L\ (\delta_L^0\ \text{or}\ \delta_D); s_L; \rho_u\ \text{or}\ \rho_b; \Delta T` | custom generators | **v2** | backlog round 4, verified; rank 4 with Θ; the generator *values* are definition-dependent — resolve δ_L from its printed expression (§2.13(e)) |
| Hybrid-code ion-scale units (d_i, Ω_ci⁻¹, v_A, B₀, n₀, m_i) | `m_i; e; B_0; n_0; 1\ \text{or}\ 4\pi·\mu_0` | quotient + riders | **v2** | backlog round 4, verified; d_i, Ω_ci⁻¹, v_A are not independent (d_iΩ_ci = v_A); the absence of c is a Darwin rank reduction, not c = 1 |

---

## 4. v1 scope, consolidated

The 47 v1 rows plus adjudicated additions, grouped by what actually gets built:

**Classical E&M six-pack** (one generator choice + the 2×2 rider table): SI(2019), MKSA, CGS-Gaussian, CGS-ESU, CGS-EMU, Heaviside–Lorentz — plus the Jackson-3e document-hybrid handling and the Gaussian-geometrized / HL-natural composites.

**Natural units**: HEP ħ=c=1 (HL flavour), +k_B, Gaussian-natural, Planck (Gaussian flavour), reduced-Planck 8πG=1, classical κ=1, 16πG=1 holographic, **Kolb–Turner** (ħ=c=k_B=1 with G = 1/m_Pl² kept, m_Pl unreduced — *added by adjudication*: it is the other half of the √8π trap, and the census had only tabulated one side), string α′=1 and both ℓ_s=1 conventions, lattice a=1.

**GR / cosmology**: geometrized G=c=1, geometrized-Gaussian, c=1-only, black-hole-scale G=c=M=1, reduced-Planck cosmology, Planck units (G=c=ħ=k_B=1), κ-symbolic (alias table with dimension-driven disambiguation — the one place dimension checking *disambiguates* rather than validates), observational-cosmology hybrid, little-h (per-symbol exponent map: lengths −1, masses −1, densities +2, number densities +3, P(k) −3, luminosities −2, surface densities +1, magnitudes **−5 log h** — an additive offset applied only inside the h-rescaling; magnitudes themselves remain refuse-class), comoving/scale-factor conventions.

**Atomic / CM / spectroscopy**: Hartree a.u. (both renderings — 4-generator integer-exponent SI form ≡ 3-generator half-integer Gaussian form, same physics), Rydberg a.u., effective/excitonic a.u., quantum-chemistry molar conventions (the N axis), k_B=1, spectroscopic energy equivalences (converter graph), CGS-emu magnetism, SI magnetism (Sommerfeld vs Kennelly), cgs-esu molecular properties, solid-state eV–Å practical units.

**Nondimensionalization engine** (custom generators: symbolic restoration, rank check, residue extraction, basis reduction) with v1 presets: NS inertial scaling, Lennard-Jones reduced units, Hamiltonian/chaos m=ω=1, NR code units G=c=M=1, lattice a=ħ=t=1, harmonic-trap units.

**Conventions layer**: the radian convention + 2π riders (h/ħ, ν/ω, ν̃/k — the single most instantiated invisible convention in physics), and the v1 entries of the §5 registry.

---

## 5. Dimensionless-conventions registry (ranked by damage)

| # | Fork | Magnitude | Detection |
|---|---|---|---|
| 1 | EM rationalization: α = e²/4π (HL) vs α = e² (Gaussian) | e = 0.3028 vs 0.0854; L = −F²/4 vs −F²/16π | α-form or F²-coefficient; products eA_μ, eF_μν are invariant — if only covariant derivatives appear, report **undetermined**, never default |
| 2 | Gravity ladder: G=1 vs 8πG=1 vs 16πG=1 | 8π–32π in every matter coupling | R-coefficient **and** entropy coefficient jointly unique: (1/16π, A/4), (1/2, 2πA), (1, 4πA) |
| 3 | M_Pl = G^(−1/2) vs M̄_Pl = (8πG)^(−1/2) | √8π = 5.013 in mass, 8π in mass² | never guess from the symbol — read the Einstein–Hilbert coefficient; inflation ⇒ usually reduced, BH/extra-dim ⇒ usually unreduced |
| 4 | String length: ℓ_s = √α′ vs 2π√α′ | κ₁₀² shifts by (2π)⁸ ≈ 2.43×10⁶; CY volumes by (2π)⁶ ≈ 6.15×10⁴ | T = 1/2π vs 2π; M_s = 1 vs 2π |
| 5 | Worldsheet α′ = 2 (closed) / 1/2 (open) | factors of 2 in every mass formula; M² = 2(N−1) at α′=2 vs 4(N−1) at α′=1 | can switch at chapter boundaries — span-scoped state |
| 6 | Graviton normalization κ² = 8πG vs 32πG | factor 4 in amplitudes | community: SUGRA/cosmology vs amplitude literature; both write "κ = 1" |
| 7 | Higgs vev v = 246 vs 174 GeV (v/√2) | √2 on every Yukawa, 2 on dim-6 coefficients | m_W = gv/2 vs gv/√2 — *added by adjudication*; arguably the most frequently hit fork in SM/EFT phenomenology |
| 8 | g-absorbed gauge field: L = −F²/4g², D = ∂ − iA | every power of g relocated | kinetic-term coefficient — *added by adjudication*; ubiquitous in lattice, SUSY, holography, large-N |
| 9 | Hartree vs Rydberg a.u. | factor 2 in energy/time/velocity/mass/charge/pressure; **agree** on length and momentum | H = −½∇² − Z/r vs −∇² − 2Z/r; c = 137.036 vs 274.072; a.u. pressure 29421 vs 14711 GPa |
| 10 | h vs ħ, ν vs ω, ν̃ vs k (the radian collapse) | 2π, four times over | "g/2π = 100 MHz"-style declarations; angular-frequency lint under the A dimension |
| 11 | Flux quantum h/e vs h/2e | factor 2 (Cooper pairs or not) | superconductivity context |
| 12 | Heisenberg model: ±J, 2J, Σ_⟨ij⟩ vs ½Σ_{i≠j}; s=±1 Ising vs S=±½ | up to factor 4 and a sign (T_c: 2.269 vs 0.567) | Hamiltonian as written; never trust "the Heisenberg model" |
| 13 | r_g = GM/c² vs 2GM/c² | factor 2; ISCO at 6 r_g vs 3 r_g | GR literature vs accretion/X-ray-binary literature |
| 14 | ADD/RS fundamental scale M_D | (2π)ⁿ and 8π between three standard definitions | which normalization the collider bound was quoted in — *added by adjudication* |
| 15 | TDB vs TCB seconds and au | L_B = 1.550519768×10⁻⁸ | ephemeris time-scale declaration |
| 16 | Scale-factor a₀ = 1 vs k ∈ {0,±1} | changes the *dimension* of k, comoving coordinates, conformal time | FRW metric as written |
| 17 | χ_SI = 4πχ_cgs; ΣN = 1 vs 4π | 4π, twice | susceptibility/demagnetizing context |
| 18 | Debye–Waller B = 8π²⟨u²⟩ | 8π² | crystallography B vs ⟨u²⟩ |
| 19 | Thermochemical standard state 1 atm vs 1 bar vs 1 M | RT ln 24.46 = 1.89 kcal/mol on every ΔG° | post-1982 IUPAC boundary; solution-phase reference |
| 20 | Decadic vs Napierian absorption; OD base | ln 10 = 2.303 | spectroscopy convention statement |
| 21 | Graphene v_F: 3ta_cc/2ħ vs √3ta/2ħ | √3 (bond length vs lattice constant as declared "a") | which length the paper's a means — a model instance of the general "which scale is a" hazard |

Every entry is a place where a dimension check passes and the number is wrong. The registry, not the solver, is what catches them.

**Fork verdicts (round-4 amendment).** {determined, undetermined, refuse} is one value short: add **present but provably inert**, carrying a required *cancellation witness*. 1706.08388 supplies its own; 1904.04923 is the structural case (fixed Kerr background, no Einstein equation). Without a witness, degrade to *undetermined*.

### Round-3 additions (reader-lens sweep, adjudicated — see §2.13 for the structural synthesis)

Slot legend: *registry* = dimensionless-fork row; *identity* = tag in the §2.13(a) metadata layer; *rider* = per-symbol rescaling table; *sign-axis* = §2.12/§2.13(d) fork; *converter* = numeric-graph edge; *family* = parameterized symbol family; *declaration* = per-paper declaration layer; *structure* = new structural class; *lint* = a validation rule, no data row.

| Fork | Magnitude | Detection | Slot | Tier |
|---|---|---|---|---|
| QFT state normalization ⟨p\|p′⟩ = 2E(2π)³δ³ vs (2π)³δ³ vs box *(exclusion seed)* | [M] = mass^(4−n) shifts by mass^(1/2) per leg | printed normalization line; measure d³p/(2π)³2E | rider + identity | v1 |
| Fourier triple: sign, 2π placement, ν vs ω (ν/ω leg: see #10) *(exclusion seed)* | 2π's | transform as printed | registry | v1 |
| PSD one- vs two-sided; per-Hz vs per-(rad/s) *(exclusion seed)* | ×2; 2π | the inner-product integral's limits and prefactor (2∫₀^∞ … df ⇒ one-sided); **not** √S_n usage, Hz^(−1/2) either way, and "one-sided" is often absent | registry | v1 |
| Analytic-signal ½ vs Re; engineering j = −i *(exclusion seed)* | ×2 chain into I and χ⁽ⁿ⁾; sign of ε″ | ½Ẽe^(−iωt)+c.c.; ε′−jε″ | registry | v1 |
| Interaction normalizations: λφ⁴/4!, Yukawa √2, χ⁽ⁿ⁾ degeneracy, ¼FF̃, Voigt γ = 2ε (Yukawa √2 leg: see #7) *(exclusion seed)* | ×24, √2, ×2–6, ×4, ×2 | the printed term | registry | v1 |
| Forms p!; Levi-Civita symbol vs density; Hodge sign *(exclusion seed)* | ×p!; weight ±1 | F = ½F_μν dx∧dx | registry + sign-axis | v2 |
| Affine parameter λ = τ/m; dimensionless coordinates *(exclusion seed)* | dimension reassignment | p^μ = dx^μ/dλ | registry | v2 |
| Wigner–Eckart reduced-element convention *(exclusion seed)* | √(2j+1) | ⟨j‖T‖j′⟩ definition | registry | v2 |
| PDFs/FFs: xf(x) vs f(x); F₂ vs 2xF₁; W_i vs F_i | ×x (10³ at x = 10⁻³); ×2x; dimensionful | axis labels "xg(x)"; sum rules; LHAPDF xfxQ2 | registry | v1 |
| Running quantities: (scheme, μ, n_f, loop) identity | m_b 4.78/4.18/2.79 GeV → ×2.9 in Γ(H→bb̄); Λ^(4)/Λ^(5) +38% | m̄(μ) decorations; "pole/MS̄/1S"; μ_R discussion | identity | v1 |
| sin²θ_W: on-shell / MS̄ / effective leptonic | 0.2232 / 0.23122 / 0.23155 → ×2 in A_FB | definition line; the numeric value itself | registry | v1 |
| Hypercharge Y vs Y/2; GUT √(5/3) on g₁; trace normalization | ×2; ×1.291; √2 | Q = T³+Y vs +Y/2; β-coefficients 41/10 vs 41/6 | registry | v1 |
| Unit-contract master formulas (1.267, 0.29979, 0.3894) | double-restore ~10⁹ | bracketed units + bare decimal; prefactor verifier | structure | v1 |
| Breit–Wigner fixed vs running width | M_Z definition shift 34.1 MeV (16σ) | isΓ/M in denominator; "running width" | registry | v2 |
| Majorana vs Dirac DM: ½ in ⟨σv⟩; 8π vs 16π flux | ×2 (2.2 vs 4.4×10⁻²⁶ cm³/s) | "self-conjugate"; ½ mass term | registry | v2 |
| Units embedding a coupling: e·cm, "in units of e", μ_B/μ_N | ×0.3028 per power of e | 'e' inside a unit string | rider | v2 |
| Spinor-helicity bracket phases | (−1)ⁿ on MHV objects | ⟨ij⟩[ji] = ±2k_i·k_j | sign-axis | v2 |
| GW averaging state (sky/pol/inclination) | ⟨F₊²+F×²⟩ = 2/5; ×2.5 amplitude | "sky-averaged"/"optimal"; D_eff | identity | v1 |
| Strain response: ΔL/L differential vs δL/L per arm | ×2 (×4 in S_h) | ½ in detector tensor; "DARM" | registry | v1 |
| Source vs detector frame (masses, frequencies) | (1+z) up to ~20 | "redshifted"; D_L pairing | identity | v1 |
| Axion: g_γ vs C_aγγ; f_a vs f_PQ/N | ×2; ×N (1, 3, 6) | **primary: the printed bridge** g_aγγ = g_γ α m_a/(πΛ²) with the quoted g_γ^KSVZ; 1.92 and E/N occur zero times | registry | v1 |
| Sensitivity-curve chart quantities h_c / √(fS) / √S | Hz^(1/2) shifts (solve catches); residual chart ambiguity | axis units | converter | v1 |
| PTA amplitude: yr³ absorbed or explicit | A carries yr^(3/2) or is dimensionless | (A²/12π²)(f/f_yr)^(−γ)·yr³ | registry | v2 |
| Hellings–Downs normalization (Γ(0⁺) = ½ vs 1) | ×2; note Γ(π) = **+¼** (not −¼) | printed Γ(0) | registry | v2 |
| T_sys bookkeeping: ½-photon vacuum term; N_A vs T_amp | up to ×2 (×4 in scan rate) | **primary: back-compute the printed occupancy** — at the stated hν/k_B and T compare 1/(e^x−1) with n+½ (x = 2.173: 0.128 vs 0.628 = the quoted 0.63); the tokens do not occur | registry | v2 |
| Kelvin kinds: K_RJ / K_CMB / T_A | ×0.577 @150 GHz, ×0.325 @220 GHz | band + kind tokens | identity + converter | v2 |
| Resonator rates: Q_L vs Q₀; κ FWHM/HWHM; g vs 2g; C = g² vs 4g²/κγ | ×(1+β); ×2; ×2; ×4 | β coupling; "splitting = 2g" | family | v2 |
| Beam-size parameterization (1/e², 1/e, σ, FWHM; radius/diameter; z_R vs b) | ×2–4 in intensity | printed exponent exp(−2r²/w²) | family | v1 |
| Pulse-duration parameterization (T₀ vs FWHM; sech²/Gaussian) | ×3.11 in T₀² quantities | 1.7627; 1.665; deconvolution 1.543 | family | v1 |
| Handedness / Stokes V (IEEE vs optics vs IAU) | sign (Z₂×Z₂ with time convention) | "as seen by observer…"; V = I_L−I_R vs I_R−I_L | sign-axis | v1 |
| n₂ symbol family: m²/W vs esu vs γ [1/(W·km)] | n₂[m²/W] = 4.19×10⁻⁷ n₂[esu]/n₀ | unit of the printed coefficient | converter | v1 |
| Spectral/dispersion basis: per-λ/ν/ω; D ↔ β₂ | non-constant Jacobian c/λ² (×3.7 across range) | ps/(nm·km) vs ps²/km | identity + converter | v1 |
| Field- vs power-referenced α, g; the neper | ×2; 8.686 vs 4.343 dB/Np | exp(−2αz); γ = α+jβ context | identity | v1 |
| Rabi Ω vs Ω/2 | ×2 (×4 in drive power) | ħΩ/2 in H; sin²(Ωt/2) | registry | v2 |
| Phase noise ℒ(f) = ½S_φ | 3.01 dB; ν₀²/f² edges to S_y, S_x | dBc/Hz; IEEE 1139 | registry | v2 |
| Kurokawa power waves vs pseudo-waves | ~10% only at complex Z₀ | Z₀* in the definition | registry | out_of_scope |
| Hypersurface axis: K sign × normal orientation | sign on K-linear terms (GHY, π^ij); K-quadratic invariant | K_{ab} = −∇_a n_b line; K = ∓3H calibrator | sign-axis | v1 |
| Stress tensor from metric variation (sign, δg^μν vs δg_μν, ±2) | sign flip; ×2 | definitional-line parity vs signature | sign-axis | v1 |
| Geometers' positive Laplacian Δ = −∇² | sign | e^(−tΔ); positive spectrum | sign-axis | v1 |
| Curvature normalizations: H trace vs average; R = 2K (2d); sphere R = n(n−1)/a² | ×n; ×2; ×n(n−1) | Gauss–Bonnet prefactor as calibrator | registry | v1 |
| Symplectic/Poisson sign; phase-space charge sign | sign (effective t → −t) | {q,p} = ±δ; δL = Eδφ + dθ | sign-axis | v2 |
| Topological-density normalizations (1/8π² tr F∧F …) | ×2; powers of 2π | **integrality lint**: asserted integers calibrate the convention | registry | v2 |
| Two-component spinor ε conventions | sign on odd-ε bilinears only (ψχ, Yukawas) | ψχ = −ψ_αχ^α staircase | sign-axis | v2 |
| Killing normalization beyond asymptotic flatness (AdS/dS/planar) | ×λ on κ, T_H, M_Komar | horizon-generator normalization line | registry | v2 |
| Einstein B-coefficient basis (ρ_ν/ρ_ω/ρ_ν̃/J̄_ν) | up to ~1.5×10¹⁰ between two "B₂₁" values | which A–B relation is printed; B's units | rider | v1 |
| Two-electron integral notation: Mulliken vs Dirac vs antisymmetrized | J ↔ K swap; hidden difference of terms | bracket glyph + bar count — and where none is printed (g_pqrs, the Helgaker/Koch CC school) the operator's index pairing: e_pqrs pairs p–q and r–s, hence Mulliken | structure (notation) | v1 |
| Multipole moment: Buckingham ½-traceless Θ vs primitive vs unhalved | ×2; sign changes; 1 B = 3.336×10⁻⁴⁰ C·m² | ½(3rr − r²δ) kernel; "buckingham" | registry + converter | v1 |
| Response tensors α, β, γ: (4πε₀)^((n+1)/2) rider; α as volume | half-integer rider exponent | Å³; "×10⁻³⁰ esu"; ε₀-free defining relation | rider | v1 |
| Standard-state divisor inside ln/exp; intercept co-transform | ln A shifts by 47.85 (cm³/molec/s → L/mol/s) | dimensionful log argument + Arrhenius/Antoine family | lint + identity | v1 |
| Bath spectral density: π/2 in J(ω); λ vs 2λ (Stokes) | ×π/2; ×2 | printed J({c_k}) definition | registry | v1 |
| TST symmetry numbers vs path degeneracy | ×4 typical double count | σ inside Q_rot AND a separate L‡ | registry + lint | v2 |
| Rate-law stoichiometry (rate of reaction vs species loss) | ×2 for self-reactions | "2A →" + the printed ODE | registry | v2 |
| Anharmonic x_ij sum conventions | diagonal x_ii doubles between Σ_{i≤j} and ½ΣΣ | which sum is printed | registry | v2 |
| HITRAN isotopologue-abundance weighting | ×90–3219 for minor isotopologues | cm⁻¹/(molec·cm⁻²) + 296 K + HITRAN cite | converter | v2 |
| Bloch-sum phase gauge (convention I vs II) | Berry connection shifts by τ — up to one polarization quantum | H(k+G) = H(k) vs V(G)H(k)V^† | structure (gauge) | v1 |
| Modulo-quantum quantities (P, Zak/Berry, Wannier centers, θ) | quantum eR/Ω ≳ the quantity itself | "modern theory of polarization"; "branch"; "mod 2π" | structure (lint) | v1 |
| DOS/γ denominators: per spin/valley/f.u. | ×4–12 compounded | axis labels; γ = (π²/3)k_B²N cross-check | identity | v1 |
| Hubbard U schemes: Dudarev U_eff vs Liechtenstein (U, J); Kanamori U′ = U−2J | 1.5–3 eV, gap-scale | LDAUTYPE; J quoted but absent from equations | registry | v1 |
| Superconducting gap: Δ vs 2Δ; form-factor normalization | ×2 | ratio to k_BT_c: 3.53 vs 1.76 | registry | v1 |
| Scattering rates: amplitude vs probability; HWHM/FWHM; Z; τ_qp vs τ_tr | ×2 ×2; Z = 10⁻³–0.5; ×10–100 | "transport lifetime"; Z co-occurrence | registry | v1 |
| Lattice-sum scoping and h.c. double count | ×2 in t (W = 8t vs 16t) | ⟨ij⟩+h.c. vs Σ_{i,δ}; bandwidth lint | declaration + lint | v1 |
| S(q,ω) vs χ″: 1/π; Bose placement; absolute units | π; ×2; (γr₀/2)² = 72.65 mb/μ_B² | units of χ″; "detailed balance" | registry | v2 |
| Homograph unit symbols (mK, K, μ, mμ, μμF, γ, λ, b) | ×1.4388 (kayser/kelvin); ×10⁶ (micron/micro) | year + subfield-gated symbol resolver | identity | v1 |
| Air vs vacuum wavelength (medium tag on the reciprocal edge) | 2.77×10⁻⁴ (1.38 Å at 5000 Å; 5.5 cm⁻¹) | λ > 2000 Å + "in air"; λσ = 1.000277×10⁸ self-check | identity + converter | v1 |
| Pre-1961 amu scales (physical/chemical/unified) | 3.18×10⁻⁴ / 4.3×10⁻⁵ | "amu" + year; N_A = 6.0249 vs 6.0225×10²³ | converter | v2 |
| kX/Siegbahn X-ray scale (+ its own vintage) | 2.077×10⁻³, drifting 4×10⁻⁵ | kX tokens; λ(Cu Kα₁) = 1.5374 vs 1.5406 Å | converter | v2 |
| Temperature-scale vintages (IPTS-27/48/68 → ITS-90) | 0.25 K at the gold point | scale tags; the gold-point value quoted | identity (vintage) | v2 |
| Legacy multi-definition units (cal, Btu, at vs atm, pre-1964 litre) | 0.14–0.5%; 2.8×10⁻⁵ | bare tokens + era/discipline | converter | v2 |
| Uncertainty-statement semantics (PE, k = 2, PDG S) | ÷2, ÷3, ×1.4826 on re-rendered ± | "probable error"; "k ="; "S =" | identity (provenance) | v2 |
| EPR parameters in field units (needs the paper's g) | ×g_eff/2.0023, up to ~×9 | A/D/E in G or mT + tabulated g | declaration (custom generator) | v2 |


#### Round-4 rows from the empirical pilot

Slots and tiers as in the §5 round-3 table. One row per verified untabled fork of the twelve-paper pilot (`wf_cee35635`) plus the row-shaped misses; corrected claims are tabled where a verifier ruled a claim overstated.

| Fork | Magnitude | Detection | Slot | Tier |
|---|---|---|---|---|
| **GR / accretion (gr-astro)** | | | | |
| MAD flux φ_max ≈ 15 (√4π in B) vs ≈ 50 (Gaussian) · C85 | √4π: 15 → 53.2 | "in our system of units" | registry | v1 |
| σ = b²/ρ vs b²/ρh; β := 2p/B² vs 8πp/B²; Ṁ_Edd = L_Edd/0.1c² vs /c² vs /η(a)c²; l := u_φu^t vs −u_φu_t · C86 | h = 1+4p/ρ moves the reported σ = 1 jet boundary; ×4π; ×10; sign | each defining line; a bare "0.1" is an unlabelled efficiency | registry + identity | v2 |
| Density floors as an implicit scale: 10⁻⁵r^(−3/2) vs 10⁻⁴r^(−3/2) vs 10⁻⁵r^(−2) · C87 | meaningful only against an undeclared ρ_max = 1; floors and C = 0.2 break the ρ-rescaling symmetry | a bare decimal × power of r, in the numerics section | declaration | v2 |
| Scale-free ideal GRMHD: no ℳ_unit, the density scale *missing* · C80 | ρ_code = 1 → 1.46×10⁻² g/cm³ vs ~10⁻¹⁸ for M87*, reported well-posed | no ℳ_unit, no cgs conversion, output Ṁ-normalized | lint + declaration | v1 |
| **GW detectors and haloscopes (detector)** | | | | |
| q = m₂/m₁ ≤ 1 vs m₁/m₂ ≥ 1; η vs q; χ = cS/Gm² vs Kerr a = S/mc · C89 | identity swap of m₁, m₂ (0.819 vs 1.221); χ vs a changes dimension | the defining expression — usually absent | identity + registry | v1 |
| Band-χ² raw vs reduced χ²/ν vs n-band; an unnamed wavelet normalization · C90 | ×n, ×ν; cross-pipeline | the statistic's denominator | registry + identity | v2 |
| SNR kind: matched-filter ρ, re-weighted ρ̂, optimal √(h\|h) · C91 | distinct numbers, all dimensionless | "optimal", "re-weighted" | identity | v1 |
| Channel polarity — the sign of a calibrated data channel · C92 | a sign | "confirm the sign of h(t)" | sign-axis | v2 |
| Halo model: ρ_a = 0.45 vs 0.30 GeV/cm³; v_c = 220 (mode) vs 232 vs 238 km/s · C93 | ×1.5 in power, ×1.22 on limits, applied retroactively | the haloscope-vs-WIMP split; which moment v_c names | family + identity | v1 |
| Galactic-rest vs lab frame for the DM velocity distribution · C94 | 25% on a published limit | solar motion in the lineshape | identity | v1 |
| Noise reference plane: input- vs output- vs cavity-referred quanta · C96 | 0.6 dB, invisible to the Y-factor | "referred to the receiver input" | identity | v2 |
| Exclusion-limit confidence: 90% vs 95%; c₁c₂ read as the net CL · C97 | Φ⁻¹(0.95) = 1.645 | the stated CL; scan/rescan composition | identity (provenance) | v2 |
| Equivalent noise bandwidth / window convention · C98 | 1.0 rect, 1.5 Hann, 1.363 Hamming | the stated window | registry | v2 |
| **HEP, lattice, cosmology (hep-cosmo)** | | | | |
| Λ = 77.6 MeV (χPT) vs 75.6 (lattice), Λ⁴ ≡ χ(T=0) · C99 | 11% in signal power | the citation behind Λ | identity | v2 |
| Operator basis: Warsaw vs BW vs SILH vs HISZ; EOM-reduced vs Green's; skipped rationals, T^A vs λ^A, Fierz ×(−2) · C100 | O(10²) pairwise dimensionless factors for SMEFT alone | the basis declaration and normalization-change list | identity + registry | v1 |
| EFT expansion: C/Λⁿ vs c_i in mass⁻² vs C/v² vs −C/Λ² vs Λ ≡ 1 TeV implicit · C101 | Λ², a sign, "C = 0.3" meaning 0.3 TeV⁻² | the ΣC/Λⁿ Q line | registry | v1 |
| Higgs sector: ½λ(φ†φ)² vs λ(φ†φ)²; +m² vs −μ² · C102 | ×2 in λ (m_h² = 2λv² vs λv²) | the printed potential | registry | v1 |
| σ^{μν} = (i/2)[γ,γ] vs ½[γ,γ] vs (i/4)[γ,γ]; C = iγ²γ⁰ + spinor phase · C103 | ×2 and an i on 9 of 59 operators; sign on B-violating terms | usually undefined — invert γ_μγ_ν = g_{μν} − iσ_{μν} | rider + identity | v1 |
| SU(2) ε₁₂ = ±1; hermitian-derivative relative sign; anticommuting Fierz · C104 | sign on every up-type Yukawa; a wrong derivative sign changes the *basis dimension* | the ε and D↔ definitions | sign-axis + registry | v2 |
| NDA loop counting C_k ~ O(1/16π²) · C105 | **not a fork** — nothing takes two values | tree- vs loop-generated is physics | identity | out_of_scope |
| Lie algebra: [T,T] = ifT vs fT (anti-hermitian); tr = ±½δ vs ±δ · C107 | sign on every f-contraction and tr{TT} | a notation appendix | sign-axis + registry | v2 |
| Lattice scale: t₀ (t²⟨E⟩ = 0.3) vs w₀ vs r₀ (r²F = 1.65) vs r₁ (1.0) · C108 | O(1) between quantities all called "the scale" | the stipulated defining equation | registry | v1 |
| Discretization tags: clover vs plaquette E; Wilson vs Symanzik flow; fermion action · C109 | same continuum limit, different finite-a number | the stated definition of E | identity | v2 |
| n_s = 2(η−3ε) vs 1 + 2η − 6ε · C113 | exactly 1.0; n_t = −2ε is the same in both, so no uniform rule repairs it | the ⟨ζζ⟩ ~ k^(−3+n_s) line | registry | v1 |
| ⟨ζζ⟩(2π)³δ³ vs P_ζ vs Δ²_ζ = k³P/2π²; full vs bare δ³ vs primed · C114 | 2π²/k³ to A_s; (2π)³ = 248 per primed comparison | is the δ³ printed | registry + rider | v1 |
| f_NL: ζ = ζ_g ∓ (3/5)f_NL ζ_g²; base Φ vs ζ vs R · C115 | Maldacena and Planck carry **opposite signs for the same physics** | the quadratic definition and its base | sign-axis + registry | v1 |
| ζ vs R vs Φ vs ψ map (ζ = −(5/3)Φ; ζ_here = −ζ_there) · C116 | a sign and 5/3 | the paper's own Bardeen comparison | sign-axis + converter | v1 |
| Curvature perturbation: e^{2ρ}[(1+2ζ)δ+γ] vs e^{2ρ+2ζ}ĥ; δ+γ+½γγ vs exp(γ) · C117 | agree at first order, differ where f_NL lives — invisible to dimension *and* to linear checks | the metric ansatz, per section | registry + structure | v1 |
| Slow-roll basis: potential ε_V, η_V vs Hubble ε_H, η_H · C118 | differ at second order — the order of the result | "~" not "=" joining them | identity | v1 |
| Cosmological gauge: comoving, spatially flat, longitudinal, synchronous, uniform-density + conversion map · C119 | the convention axis of the subfield; {gauge/branch} is empty of it | the printed gauge condition | identity (gauge) | v1 |
| Perturbative nonlinear field redefinition (ζ = ζ_c + ½(φ̈/φ̇ρ̇)ζ_c² + …) · C120 | outside the multiplicative group; the authors note it changes their answer | a quadratic redefinition line | structure | v2 |
| Tensor sector: ε^sε^{s′} = 2δ vs δ; graviton prefactor ⅛ vs ¼ vs ½ · C121 | factor 2 into every tensor correlator and into r | the polarization normalization; the γ̇² prefactor | registry | v2 |
| √g written for a Lorentzian metric · C122 | **not a fork** | AST lint: it means √\|det g\| | lint | v2 |
| Matter sector: V_CC [M]; a = 2√2G_F n_e E [M²]; A [1]; n_res [M³] · C125 | one effect, four names, three dimensions | the solve separates them, a resolver cannot | family | v2 |
| Two-flavour H origin subtraction: zeroed (2,2) vs traceless ∓Δm²cos2θ/4E · C126 | ×2 on the diagonal, none off it | the printed matrix | registry | v2 |
| Protons on target (POT) as a bare count · C127 | no SI preimage; kton·year has one | "POT" beside physical quantities | converter | v2 |
| Δm²_ji ≡ m²_j − m²_i vs Δm²_ij; field ΣU_{αi}ν_i vs state ΣU*_{αi} · C128 | a global sign, invisible under sin², live on mass ordering; U vs U* inverts the CP phase | the index convention; state vs field | sign-axis | v1 |
| **Optics and plasma (optics-plasma)** | | | | |
| Lugiato–Lefever preset {κ/2, √(2g/κ), √(8g/κ³), 2/κ, D₂/κ}, residues (ζ₀, f, d₂, η, F) · C129 | the Coen/Erkintalo and Chembo sets must map onto it | the normalization block | declaration (preset) | v1 |
| Field amplitude: \|A\|² = photon number vs power vs energy vs \|E\|² vs √W · C130 | changes the field symbol's **dimension**; ħω₀ and a mode volume in the conversion | the normalization sentence | identity + rider | v1 |
| Propagation-coordinate role: which variable is "fast", which "slow" · C131 | both carry T, so the swap is invisible | fiber loops and WGM map oppositely | identity + structure | v2 |
| Dispersion expansion with vs without 1/j!; D_j ↔ β_j, phase vs group index · C132 | ×2 in D₂, ×6 in D₃; n vs n₀ is 1–3% | the ω_μ expansion | registry + converter | v2 |
| η = κ_ex/κ (critical at ½) vs K = κ_ex/κ_i (critical at 1); coupling branch · C133 | ×2 in threshold power; the branch is non-invertible | the printed critical-coupling value | family + structure | v2 |
| Mode volume: quartic-overlap V_m vs V_eff vs A_eff · C134 | consistent only if V_eff = 2πc A_eff/(n₀D₁), never stated | which V sits in g, which in Δt_min | family | v2 |
| Detuning sign ζ₀ = 2(ω₀−ω_p)/κ vs δ = ω_p−ω₀ · C135 | flips the regime, soliton-supporting or not; plus a factor 2 | the detuning definition | sign-axis | v2 |
| Threshold polysemy: α_{0,th} = 1 vs α_{in,min} = 2/√3 · C136 | two numbers behind one word | which statement "threshold" carries | identity | v2 |
| Alfvén speed B/√(μ₀n_im_i) vs B/√(μ₀Σn_sm_s) vs B/√(4πρ) · C137 | 0.03% for hydrogen, √2 for pairs, order-unity with impurities | the printed definition | registry | v2 |
| Collision frequency √2π vs Braginskii/NRL 4√π/3; ν vs ν_ii vs ν_D vs ν_∥ · C138 | 3√(2π)/4 = 1.880 — and ν is a user input | the printed prefactor | registry | v2 |
| Distribution normalization ∫f dv = n vs 1; π^{3/2} contingent on v_th = √(2T/m) · C139 | ∫f = n vs 1 is visible (L⁻³); the v_th √2 is not | the Maxwellian and the v_th line | rider + registry | v2 |
| Signed vs unsigned cyclotron frequency \|q_s\|B/m_s vs q₀B/m₀ · C140 | sign of the Catto shift, gyration and drifts | one table carries both | sign-axis | v2 |
| **Atomic, molecular, condensed matter (cm-chem)** | | | | |
| Zero-field splitting: bare D S_z² vs traceless; D vs (3/2)D_zz; ±(S_x²−S_y²) · C142 | 3/2, 2, a sign; bare-vs-traceless is a constant offset only | the printed ZFS term | registry | v2 |
| Hyperfine 4πδ(r) vs (8π/3)(μ₀/4π); P = q_zQ_z/4Z_N vs χ = e²qQ/h · C143 | 3/2 on the contact term into A_∥ = f + 2a; 3–4 between two things printed "P" | the contact prefactor; the quadrupole line | registry + converter | v2 |
| Sign provenance: "(±)2.32", "(+)2.10" — adopted, not measured · C144 | combining adopted with measured is forbidden | parentheses around a leading sign | identity (provenance) | v2 |
| Zeeman and response signs: +(μ_B/ħ)Σ(l+g_e s)·B; χ = dn/dα vs −δn/δV · C145 | a sign; U = (χ₀⁻¹ − χ⁻¹) > 0 only as printed | the two defining lines | sign-axis | v2 |
| Compound display units Hz·cm/V; local-field index power n vs n³ vs ((n²+2)/3)² · C146 | the Stark exchange unit; a factor of several at n = 2.418 | "d/h = 17 Hz cm/V" | converter + registry | v2 |
| DFT+U identity forks on U: projector basis, xc functional, double counting, geometry, supercell, screening · C148 | FeO 4.6 → 7.8 eV (×1.70) on the projector alone; La₂CuO₄ 6.8 → 7.7 on the sphere radius | "no unique or rigorous way to define occupation" | identity | v1 |
| Bloch normalization: per-cell vs per-crystal; ultrasoft ⟨ψ\|S\|ψ⟩ = 1 · C149 | changes every occupation number and reported U | stated in prose only | rider + identity | v2 |
| Plane-wave cutoff: one symbol for wavefunction and density cutoffs; Ry vs Ha vs eV · C150 | 4× norm-conserving, 8–12× ultrasoft | the paired values; the code | identity + converter | v2 |
| Magnetic moment: integration volume, 2S vs g·S, per-ion vs per-cell · C151 | a 1.7-vs-1.9 μ_B comparison is ill-posed without it | μ_B with no integration sphere | identity | v2 |
| Light–matter gauge: length/PZW vs velocity; the dipole self-energy · C155 | consequential in any truncated space | ½(λ·d)² present or absent | identity (gauge) | v1 |
| Cluster operator T₂ = ½Σ t E E vs ¼Σ t^{ab}_{ij}; E_pq with no 1/√2 · C158 | ×2 on every doubles amplitude | the printed T₂ and E_pq | registry | v2 |
| Cavity coupling family {λ, γ, g, λ/√(2ω)} · C159 | λ = γ√(2ω): λ = 0.05 at ω = 4.84 eV **is** γ = 0.084 vs a neighbouring 0.07 | match bilinear and self-energy terms | family | v1 |
| Nuclear-dipole partitioning d_pq = ⟨p\|d_e + d_nuc/N_e\|q⟩; direction, origin · C160 | dipole integrals become molecule- and N_e-dependent; "6.87 D" has no direction | the d_pq definition | rider + identity | v2 |
| Photon basis: bare Fock vs coherent-state displaced, both written H · C161 | different photon-number operators, different "photonic character" | the displacement z₀ | identity (frame) | v2 |
| Level of theory {method, basis, geometry, frozen core, CBS} · C163 | four bases and four methods, four numbers, one symbol | the methods sentence | identity | v1 |
| **Cross-cutting schema (schema)** | | | | |
| Quantity-symbol = unit-symbol collision: "a₀ (a.u.)" · C02 | row 407 resolves *unit*-symbol homographs only | a column head whose quantity and unit are one glyph | identity | v2 |

#### Round-4 rows from the five new reader lenses

Slots as §5 round-3, plus *refuse-class* (§2.11/§7). *(corrected)* = amended claim or re-slot.

| Fork | Magnitude | Detection | Slot | Tier |
|---|---|---|---|---|
| **Nuclear** | | | | |
| Scattering length: k cot δ₀ = ∓1/a; a_pp Coulomb-modified vs subtracted | ∓23.74 fm sign inversion; a_pp −7.81 vs −17.3 fm (×2.22), above the CSB effect it measures | printed ERE line; r₀ = +2.75 fm is sign-invariant; +1/a is pre-1960 | registry | v1 |
| Atomic vs nuclear mass vs mass excess (the Zm_e − B_e in every Q) | 13.25 MeV (⁵⁶Fe), ≈46 (²³⁸U) against B/A = 8.79; exactly 2m_ec² = 1.02200 MeV on β⁺/EC | 'mass excess'/Δ/keV; AME/NUBASE/ENSDF ⇒ atomic | identity | v1 |
| Nuclear-matter E/A: rest-mass reference (m_n / u / excluded); the n₀ fork | 8.0713 MeV/baryon on E/A = −16.0; ε = +147.7 vs −2.56 MeV/fm³ (sign flip); n₀ 0.16 vs 0.17 = 6.25% | CompOSE ⇒ m_n; E/A near 930–940 ⇒ rest mass in | identity | v1 |
| B(EL) direction: B(E2)↑ ≠ B(E2)↓ by (2J_f+1)/(2J_i+1) | exactly 5 for 0⁺↔2⁺₁, 1.8 for 2⁺→4⁺; √5 = 2.24 into β₂ | ↑/↓ or the ordering printed; Coulex ⇒ ↑, DSAM/RDDS ⇒ ↓; NNDC/Raman ⇒ ↑ | registry | v1 |
| Weisskopf units — an A-, L- and E/M-keyed "dimensionless" unit *(corrected)* | W.u.(E2) = 5.940×10⁻⁶A^(4/3) e²b², ×6.35 from A = 40 to 160; W.u.(M1) = 1.790 μ_N², A-free — the scaling follows R^(2L), not an E/M split | 'W.u.'/'s.p.u.'; ENSDF RI/BEL | converter | v1 |
| g_A: sign of λ = g_A/g_V; quenching; g_A absorbed into M⁰ᵛ *(corrected)* | sign inversion on g_A-linear terms; 1.269 → 1.0 is 2.593 in T₁/₂(0ν), 1.610 in ⟨m_ββ⟩; absorption 0.620 | printed sign of λ, or λ vs g_A; 'g_A^eff' | sign-axis + registry | v1 |
| Beam energy: √s_NN vs √s; kinetic vs total; the asymmetric per-nucleon divisor | ×A (Au+Au 200 GeV ⇔ 39.4 TeV); 1.94 at 1 GeV/u; p+Pb 1.577 vs 4.00 TeV/nucleon, Δy = 0.465 | subscript NN; 'AGeV', 'MeV/u'; an asymmetric pair ⇒ refuse one integer divisor | identity | v1 |
| Isospin: T_z = (N−Z)/2 (nuclear) vs T₃(p) = +½ (particle) *(corrected)* | sign on all T_z-odd objects (IMME b, isovector currents, mirror CG); T_z-even invariant | the printed T_z definition; T_z of a named neutron-rich nuclide | sign-axis | v1 |
| Chiral-EFT regulator: the scheme tag needs a functional field, not a scalar scale | c_D spans ~an order of magnitude and changes sign across regulator families; s = λ⁻⁴, so 10% in λ is 52% in s | the printed regulator (exponent n, p vs r); λ in fm⁻¹ vs s in fm⁴ | structure + converter | v2 |
| R-matrix: formal vs observed; the channel radius inside every reduced width | θ² ∝ a_c⁻²: γ_W² = 20.90 MeV·fm²/a_c² (α+¹²C) ⇒ 0.836 at 5.0 fm vs 0.4947 at 6.5, ×1.69 | an 'a_c = … fm' line; lint a θ² with no a_c | declaration | v2 |
| Shell-model TBME: normalized vs unnormalized; interaction mass scaling | 2 for a = b, c = d; √2 for one identical pair; 1 otherwise — pairing only; (18/40)^0.3 = 0.787 | the .int header's trailing '18 0.3'; NuShellX/KSHELL/ANTOINE/USDB | declaration | v2 |
| Spectroscopic Q_s vs intrinsic Q₀ — same symbol, same unit, opposite sign | −2/7 for the 2⁺ of a K = 0 band: sign inversion, ×3.5, plus a prolate/oblate misread in β₂ | 'spectroscopic'/'intrinsic'; a negative Q for a known-prolate 2⁺ | identity | v2 |
| **Neutrino** | | | | |
| Δm² labels ₃₁ / ₃₂ / ₃ℓ / ee / μμ / atm, plus the ordering sign | 2.95% between ₃₁ and ₃₂; ee 0.90% below; μμ 2.39% below and δ-dependent — not a fixed relabel; ×(−1) between orderings | the subscript token; a footnote 'ℓ = 1 for NO, 2 for IO' | identity | v1 |
| Mixing amplitude: sin²2θ vs sin²θ vs \|U_αi\|²; the θ₂₃ octant *(corrected)* | sin²2θ₁₃ = 0.0851 ↔ 0.02174 (×3.91); sin²2θ₂₃ = 0.9787 ↔ 0.573 **or** 0.427 (×1.34 plus the octant flip) | token form; the magnitude prior decides — 0.085 is sin²2θ, 0.022 is sin²θ | family | v1 |
| δ_CP is parameterization-dependent; J is the only convention-free carrier *(corrected)* | sin δ flips under δ → −δ (∓0.669 at 222°/138°); corrected J = 0.02234, not 0.0215 | the sign of the exponent on the printed (1,3) element; the Jarlskog or A_CP sign | sign-axis | v1 |
| Majorana-phase halving: e^(iα₂₁/2) vs e^(iα₂) in the diagonal phase matrix | factor 2 in the phase; IO at m₃ = 0: m_ββ 48.35 vs 18.35 meV (×2.635); a mis-halved 'α = π' gives 36.57 | count the ½ in the printed exponent; symbol names correlate but never decide | registry | v1 |
| 0νββ: where g_A⁴ lives between G⁰ᵛ and \|M⁰ᵛ\|², and which g_A is baked in | double-counting or omitting g_A⁴ is 2.601 in rate, 1.613 in m_ββ; the 1.269 vs 1.25 vintage 1.062 / 3.1% | an explicit g_A⁴ between G and M ⇒ G is g_A-free; else the table's own statement | registry (placement leg only) | v1 |
| 0νββ: the r₀ making M⁰ᵛ dimensionless must match M's and G's source | (1.2/1.1)² = 1.190 in rate, 9.1% in m_ββ; with a g_A mismatch 3.10; the tabulations bundle r₀ with g_A | grep both sources for r₀ = 1.1 or 1.2 fm; emit only on disagreement | registry | v2 |
| 0νββ exposure and background: compound vs isotope mass; keV vs ROI | ×3.596 for TeO₂ vs ¹³⁰Te (CUORE 372.5 ⇒ 103.6 kg·yr); ≈1.14 for 87% Ge, so no constant exists | the unit string never carries the basis — lift formula, enrichment and A from the prose | declaration | v1 |
| Three eV-dimension mass observables (m_β, m_ββ, Σm_ν), no invertible map | NO at m₁ = 0: Σ = 58.7, m_β = 8.86, m_ββ = 1.46–3.71 meV; Σ/m_ββ up to 40 | KATRIN ⇒ m_β, NME ⇒ m_ββ, CMB/BAO ⇒ Σ; the deliverable is the refused inverse map | identity | v1 |
| Unit-contract prefactors whose constant basis exceeds (ħ, c, e) | A = 2√2G_Fn_eE = 1.5265×10⁻⁴ Y_e ρ[g/cm³]E[GeV] eV²; the Y_e = 0.5 is a hidden composition convention | the §2.13(b) surface, with the basis extended to {G_F, N_A, m_e, m_p, k_B} and a free Y_e | structure | v1 |
| Cross-section basis: per nucleon / neutron / nucleus / molecule | ×12, ×16, ×40 per nucleus (C, O, Ar); ×2.00, ×2.25, ×1.82 per neutron; ×13 for CH; flux-averaging is not constant | 'per nucleon', 'cm²/GeV/nucleon'; lift the target formula and neutron count | declaration | v2 |
| Half-life vs mean lifetime, T₁/₂ vs τ = T₁/₂/ln 2 *(corrected)* | 1.4427 — 44.3% on the time constant, 20.1% on any mass or coupling from it; nothing scales as rate² | symbol form; N₀e^(−t/τ) vs N₀2^(−t/T₁/₂); a printed ln 2 in the limit step | registry | v2 |
| The Solar Neutrino Unit: a hidden 10⁻³⁶ and a per-target-atom denominator *(corrected)* | prefactor 10³⁶; corrected — Cl and Ga rates are **not** comparable, 2.56 vs 65–74 SNU (×26), the Ga threshold admitting pp | 'SNU' with ³⁷Cl/⁷¹Ga/Homestake/SAGE; the SNU↔flux edge is refused | converter | v2 |
| **Quantum information** | | | | |
| Entropy/information log base (bits vs nats vs dits) as a unit, not a factor | 1 nat = 1.442695 bits; 1 bit = k_B ln 2 = 9.5699×10⁻²⁴ J/K; Landauer 17.92 meV at 300 K | the base printed on the log (many write bare 'log'); bits/nats/ebits/dits | structure (unit axis) | v1 |
| Fidelity F vs F² (Uhlmann/Nielsen–Chuang vs Jozsa/Wilde) | infidelities differ by exactly 2 near unity — '99.9%' is 1.0 or 2.0×10⁻³ | the outer square in the printed definition; d_B² = 2(1−F) vs 2(1−√F) | registry | v1 |
| Power reparameterizations of dimensionless figures of merit *(corrected)* | 0.9 ↔ 0.81, 0.6 ↔ 0.36; complement off by 2 near unity. Corrected: linear entropy is a plain d/(d−1) factor — two instances, not three | two defining expressions for one name differing by an outer square; only the print decides | structure | v1 |
| Trace-norm ½ conventions: trace distance, negativity, diamond distance | exactly ×2 each and independent across the three — a chained diamond → trace → failure argument can be off by 4 | the printed definition and the stated maximum (1 vs 2); E_N = 1 ebit beside N = 0.5 | registry | v1 |
| Average vs entanglement/process fidelity vs the RB decay p *(corrected)* | 1 − F_avg = (d/(d+1))(1 − F_e): ×3/2 at d = 2, ×5/4 at d = 4; r = (1−p)(d−1)/d, so 1−p overstates by 2 or 4/3 | the printed (dF+1)/(d+1); whether r or 1−p is reported | family | v1 |
| Depolarizing channel: uniform-mixing p vs per-Pauli p | exactly 4/3 for a qubit, 15/16 for two; a '1% threshold' is 0.75% in the other convention | 'p I/d' vs '(p/3)Σ_P PρP'; Qiskit uniform, Cirq/PennyLane per-Pauli | registry | v1 |
| Noise-model / denominator tag on error rates and thresholds | one symbol p_th: ~10.3% (code capacity) vs ~2.9% (phenomenological) vs ~0.5–1% (circuit-level) | 'code capacity'/'phenomenological'/'circuit-level'/'SI1000'; decoder name | identity | v1 |
| CV quadrature normalization: ħ = 1 vs ħ = 2, vacuum variance ½ vs 1 | ×2 on every covariance entry; PPT ν̃ ≥ ½ vs ≥ 1; Duan 2 vs 4; the squeezing ½ gives e^(−2r) vs e^(−4r) | an explicit 'we set ħ = 2'; the PPT bound calibrates best | registry | v1 |
| Channel representations: Choi, χ, PTM, vectorization stacking | ×d on Choi/χ-derived fidelities; stacking is not a magnitude but a different map | the trace of the printed Choi/χ (1 vs d); PTM R₀₀ = 1 as a TP calibrator | registry | v2 |
| Bell-inequality normalization: CHSH S vs S/2 vs the CH form *(corrected)* | ×2 between S and S/2 (Tsirelson 2.8284 vs 1.4142). Corrected: the CH/Eberhard leg is affine, S = 4·CH + 2 | the printed classical bound and quantum maximum — the stated bound calibrates | registry (S/2); affine tag-and-restrict (CH) | v2 |
| Quantum Fisher information vs the Bures/Fubini–Study metric (factor 4) | ×4 on F_Q, hence ×2 on every precision bound | the explicit 4 in the pure-state formula; 1/√(νF) vs 1/(2√(νg)); GHZ F_Q = N² | registry | v2 |
| **Thermodynamics / statistical mechanics** | | | | |
| Thermodynamic sign block: the first-law work sign and its siblings *(corrected)* | exact flip on W, η, W_ext, W_diss; RT ln 2 = 1.729 kJ/mol quoted ±; every tabulated E° (Zn²⁺/Zn ∓0.76 V) | the printed first law; dU = TdS − pdV is identical either way — only a named W shows it | sign-axis | v1 |
| Stochastic-calculus prescription (Itô / Stratonovich / Hänggi–Klimontovich) | p_ss ∝ D(x)^(α−1): uniform, D^(−1/2), D^(−1) — a 3× diffusivity spread gives densities 1 : 1.73 : 3 | the ∘ on the noise integral; a drift term in ∂_xD — its presence IS the prescription | structure | v1 |
| Inclusive (Jarzynski) vs exclusive (Bochkov–Kuzovlev) work *(corrected)* | ⟨e^(−βW)⟩ = e^(−βΔF) vs = 1 — the bias is the whole ΔF, 25–250 kJ/mol at 300 K. Corrected: real row, schema argument fails | 'inclusive'/'exclusive'; whether the coupling potential sits inside the printed H | identity | v2 |
| Entropy log base against the k_B = 1 generator (see the quantum-info row) | k_B ln 2 = 9.5699×10⁻²⁴ J/K; R ln 2 = 5.763 vs 8.314; Landauer 17.92 vs k_BT = 25.85 meV — 31% in work | log₂/lg/'bits'/'shannon'; an explicit ln 2 in the paper's own Landauer bound | registry | v1 |
| Master-equation rate matrix: w_ij as i→j vs j→i, and the generator sign *(corrected)* | an inversion, not a factor: 10 and 1 s⁻¹ give a ratio 10 or 0.1; ΔG = ∓5.74 kJ/mol flips sign | which index sums to zero; ṗ = Wp vs ṗᵀ = pᵀQ | structure (notation) + sign-axis | v2 |
| Chemical potential: which μ (total / excess / intrinsic) and which zero *(unadjudicated)* | μ − μ_ex = k_BT ln(ρΛ³): −7.72 k_BT = −1.53 kcal/mol for liquid argon at 100 K; electronic zeros 4–6 eV | 'excess'/'Widom insertion'/'residual'; is E_F stated vs VBM, vacuum or code zero | identity | v1 |
| Free-energy profiles: which measure (Jacobian/metric correction) | 2k_BT ln(r₂/r₁) = 6.01 kJ/mol from 3 to 10 Å, coordinate-dependent — it moves barriers; (r₂/r₁)² = 11× in K_eq | does the profile plateau at large separation or trend logarithmically | identity | v2 |
| Partition-function combinatorics: the 1/N! Gibbs factor | F shifts by −k_BT ln N!, μ by −k_BT ln N: 907 and 11.49 kJ/mol at N = 100; Lothe–Pound ~10¹⁷ in nucleation rate | ln(V/N) vs ln V in the printed ideal-gas free energy; h^(3N) is a separate §2.13(f) case | registry | v2 |
| **Acoustics / engineering** | | | | |
| The level record: dB is a dimensioned, reference-tagged quantity, not a log scalar | unbounded — one airgun table prints 224 dB (peak SPL re 1 μPa) and 183 dB (SEL re 1 μPa²·s) | 're'/'ref.' plus a dimensioned quantity; dBA/dBi/dBm/dBu/dBV/dBc | structure | v1 |
| Level-reference registry by medium, era and discipline (20 μPa / 1 μPa / 1 μbar; ISO 1683; dBu–dBV) | 100.0 dB exactly (μbar → μPa); 26.02 dB (20 μPa → 1 μPa); 61.5 dB air↔water; 10 dB sound power | 're 0.0002 dyn/cm²', 're 1 pW'; dBm with a stated or unstated Ω | converter | v1 |
| Amplitude statistic (rms / 0-peak / peak-to-peak / average) as a mandatory tag | sinusoid: peak/rms = √2 (3.010 dB), pk-pk/rms = 2√2 (9.031 dB) — one or two ISO 20816 severity zones | rms/0-pk/pk-pk/'crest factor'; a bare mm/s must warn, never default | registry | v1 |
| Proportional-bandwidth spectra: band level vs spectral density | 10 log₁₀(0.2316 f_c) = 13.65 / 23.65 / 33.65 dB at 100 Hz / 1 kHz / 10 kHz — a 20 dB tilt; octave 28.5 dB at 1 kHz | '1/3-octave', 'CPB', 'spectrum level' vs 'band level'; 'dB re 1 μPa²/Hz'; ENBW | identity | v1 |
| Exchange rate and criterion level: a declared exponent in the dose functional | 8 h at 95 dB(A): OSHA (q = 5, L_c = 90) gives 4.00 h and 200%; ISO/NIOSH (q = 3, 85) gives 0.794 h and 1008% — ×5.04 | 'exchange rate', q = 3 vs q = 5; the 16.61 in TWA, exactly 5/log₁₀2 | refuse-class | v2 |
| Procedurally-defined units: one token across standard editions (phon, sone, T30, LUFS) | phon: pre-2003 (Robinson–Dadson) contours differ by 10–15 dB below ~500 Hz, roughly ×2 in sone; ISO 532-1 vs ECMA-418-2 | sone, phon, LUFS, STI, T20/T30, R_w, NC/NR without a standard-with-year citation | refuse-class | v2 |
| dB HL / dB SL / dB nHL: zeros that are a transducer table or a fitted threshold | TDH-39 on IEC 60318-1: 0 dB HL = 7.5 dB SPL at 1 kHz but 45.0 at 125 Hz; transducer ~2–12 dB; dB SL >60 dB | 'dB HL'/'dB SL'/'RETSPL'; TDH-39/49, ER-3A, DD45 | converter | v2 |
| Sabine vs Eyring absorption — a dimensionless fork whose measured branch exceeds 1 | α_E = 1 − e^(−α_S): 0.80 ⇒ 0.551 (T60 ×0.497); a published ISO 354 α_s = 1.15 ⇒ 0.683, overstating absorption 1.68× | 'ISO 354', 'Norris–Eyring', ISO 11654 α_w; α > 1 ⇒ tag, never clip | registry | v2 |

#### Round-4 catch-up rows (restored from the drafters' size cut)

| Fork | Magnitude | Detection | Slot | Tier |
|---|---|---|---|---|
| Symmetry-weight lint: grade terms by ALL declared scaling symmetries, dimensional analysis as one instance — the only non-vacuous check at residual rank 0 · C31 | catches ρ→λρ weight errors where dimensions are silent | declared-symmetry list in methods | structure (lint) | v2 |
| Empirical/instrumental normalizers: measurement ÷ measurement (baseline, filter output) as the working nondimensionalization of experimental papers · C32 | filter parameters (SG d = 4, W = 500) change the quantity | processing-pipeline prose | structure | v2 |
| Direction-split lengths: k̂_⊥ = k_⊥ρ₀ vs k̂_∥ = k_∥a₀ — two independent length units resolved by direction w.r.t. B₀ · C34 | ε = ρ₀/a₀ ≪ 1 between them | gyrokinetic normalization tables | structure | v2 |
| Leap-second time scales (GPS/UTC/TAI): additive, event-count offsets — neither multiplicative epoch nor refuse-class · C37 | 18 s and growing, stepwise | time-scale token + epoch | identity (vintage) + converter | v2 |
| l-conditional coefficient lint: J = (F² + F⁴)/14 is the l = 2 closed form, printed unrestricted and applied to 4f · C152 | wrong shell → wrong J | shell context vs printed closed form | lint | v2 |

---

## 6. Detection

### 6.1 The Einstein-prefactor ladder (highest-value single token)

```
G_μν = (8πG/c⁴) T_μν   → no generators (SI/CGS; T an energy density)
G_μν = (8πG/c²) T_μν   → no generators (T a MASS density — Einstein 1916; his G_im is the RICCI tensor)
G_μν = 8πG T_μν        → c = 1 only
G_μν = 8π T_μν         → Cluster A (geometrized family)
G_μν = T_μν            → 8πG = c = 1
G_μν = κ T_μν          → κ symbolic — bind per paper; κ has three literature expansions
                          of DIFFERENT dimension (8πG/c⁴, 8πG/c², 8πG), so the declared
                          units of T₀₀ disambiguate it dimensionally
Action prefactor: c⁴/16πG (SI, d⁴x = dtd³x) · c³/16πG (d⁴x = c dt d³x) · 1/16πG (c=1) · 1/16π (Cluster A) · ½ or M̄²/2 (reduced Planck) · 1 (16πG=1)
```

### 6.2 Indistinguishability clusters — classifiers must return sets

**Conflicting fingerprints (round-4 amendment).** The mirror of an indistinguishability cluster is two fingerprints firing *incompatibly* on different spans: 1004.0279 is SI in the main text and Gaussian-CGS in an inherited Appendix-B collision frequency (ν/(4πε₀)² is exactly s⁻¹). Output {span → rendering} plus a conflict flag, never a document-level winner.

- **Cluster A** (always identical gravity equations): geometrized, geometrized-Gaussian/HL (gravity sector), BH-scale, NR code units, GRMHD (gravity sector), Planck. Separators are never equation form: numbers quoted (1.4766 km vs 4.9255 μs vs 1), explicit M, charge normalization (Q²/r² vs Q²/4πr²), ħ, and — the fixed-background (Cowling) analogue of the §6.1 ladder — the **horizon/ISCO numerics**: r_h = M(1+√(1−a²)) and the Kerr ISCO pin the r_g convention and the spin normalization jointly (a = 0.9375 ⇒ 1.348 M, 2.044 M). **Corrected by adjudication**: the cluster's shared signature is the *classical* items only — T_H = 1/8πM and S = A/4 hold only for Planck units; elsewhere T_H = ħ/8πM, S = A/4ℓ_P², so the thermodynamic forms are *discriminators*, not shared forms.
- **Cluster B** (identical in vacuum — the worst case): Cluster A ∪ {8πG=c=1, κ=1}. Schwarzschild, Kerr, geodesics, QNMs, Regge–Wheeler/Teukolsky are identical between G=1 and 8πG=1. **Refuse to choose whenever no source term of the gravitational field equations appears anywhere** — not vacuum-vs-matter: 1904.04923 is full of matter yet prints no Einstein equation. Where the fork is inert and the length unit independently fixed, report *inert* rather than over-refusing — the restored SI forms differ by 8π in every downstream matter coupling.
- **Cluster C** (Newtonian G=1 systems): Hénon, model/Plummer, galpy/AGAMA, canonical astrodynamics. The third normalization lives in prose, not equations; separators are quoted numbers (t_cr = 2√2, Plummer 3π/16, TU = 806.81 s).
- **Cluster D** (zero-generator display units): kpc/M_⊙/Jy/erg choices. Classify as display units: nothing to *restore*, but not nothing to *do* — an empty generator set still leaves converter work (GeV/cm³ → J/m³, dB → a ratio, quanta → hν, μeV → Hz) routed to §2.9.

### 6.3 Classical E&M discriminators

| System | Coulomb | Gauss | Ampère |
|---|---|---|---|
| SI | 1/(4πε₀) | ∇·D = ρ | ∇×H = J + Ḋ |
| Heaviside–Lorentz | 1/(4π) | ∇·D = ρ | ∇×H = (1/c)(J + Ḋ) |
| Gaussian | 1 | ∇·D = 4πρ | ∇×H = (4π/c)J + (1/c)Ḋ |
| ESU | 1 | ∇·D = 4πρ | ∇×H = 4πJ + Ḋ |
| EMU | c² | ∇·D = 4πρ | ∇×H = 4πJ + Ḋ |

EMU's Coulomb law with an explicit c² is the single most diagnostic equation in the family. ESU vs Gaussian are *identical* in every electric-sector equation — only the magnetic sector (the c-rider) separates them, and a magnitude tell: B values in ESU run ~3×10¹⁰ smaller than in gauss (the ESU B unit is c_cgs gauss — absurdly *small numbers*, not large, are the fingerprint).

**Coverage caveat (round 4):** §6.1's ladder and this table return nothing on whole literatures — no Einstein equation in fixed-background GRMHD, no charge or current in ideal MHD, no Coulomb law or F² in NV/EPR and cavity optics. Fall back to §6.4's tokens plus the positive-SI assertion.

### 6.4 Natural-units heuristics and anti-heuristics

- Presence of ħ or c in one equation does **not** disprove natural units — authors restore constants in final numeric formulas. Classify from the body.
- "Natural units" is polysemous: c=1 only (nuclear/astro), ħ=c=k_B=ε₀=1 (hep-ph), full Planck (quantum gravity). The phrase alone classifies nothing.
- "GeV/c²" in a ħ=c=1 paper is typographic courtesy, not evidence c ≠ 1.
- Strong tokens worth hard-coding: α = e²/4π → HL · −F²/16π or ∂F = 4πJ → Gaussian · G_μν = T_μν → 8πG=1 · S = A/4 (with ħ=1) → G=1 · S = 4πA → 16πG=1 · the Einstein–Hilbert **prefactor**, never the bracket: ∫√−g(R−2Λ) is 16πG=1 but ½∫√−g(R−2Λ) is 8πG=1, so keying on R−2(…) is wrong by 2 in G · T = 1/2πα′ + g_s → string · am_π or β = 6/g₀² → lattice · **c = 137 → atomic or Schrödinger units (G a generator ⇒ Schrödinger); ħ = 137 → Stoney; Bohr radius = 137 → CODATA n.u.** (four systems, routinely confused).
- **Constants-explicit SI is positively assertible**, not the residue of nothing firing: μ₀/4π or ε₀ in a printed coupling, a Zeeman term with **no 1/c**, e²(B×r)²/8m_e with **no 1/c²**. Report "SI, asserted" distinctly from "no fingerprints fired".
- **Positive natural-units fingerprints** (round 4): an equation equating a mass to an inverse length or time (am_π, t₀m²) asserts ħ = c = 1 in the body; an explicit restoration-bridge sentence ("multiply by (ħc)ⁿ to convert") asserts the same while display units stay SI.
- Lab-SI symbols (T, V/m, K, GHz) co-occurring with GeV masses → the ħ=c=1-with-SI-E&M *hybrid* **only when ħ and c are absent from the body equations**; an explicit ħ^a c^b bridge factor instead fingerprints **plain SI with HEP display units**, where the old rule double-restores (ħc)³. The true hybrid has higher residual rank than standard HEP units (stronger checks available, not weaker). Bridges: 1 T = 195.3528 eV², 1 V/m = 6.5163×10⁻⁷ eV².
- Magnetic atomic units are ambiguous by exactly α between SI-based (ħ/ea₀² = 2.3505×10⁵ T) and Gaussian-based (e/a₀² = 1715.26 T); the only textual discriminator is the 1/c in the Zeeman term. "In atomic units, B = 0.1" with no Hamiltonian is **unresolvable — warn, never convert**. The **electric analogue** is equally live: with λ = √(1/(ε₀ε_r V)) and nothing fixing ε₀ = 1 or 1/4π, the readings differ by √(4π) = 3.545 in λ, 4π in a mode volume.

### 6.5 Declaration-sentence extraction (per-paper conventions)

Highest-precision cues, in order: (i) a two-column normalization table in the methods section (machine-extractable, strongest signal); (ii) declarative templates — `we (work|shall work) in units (in )?(which|where)`, `we set ([^.]{1,80}) = 1`, `(lengths|times|energies|velocities) are (measured|given|expressed) in units of`, `normali[sz]ed (to|by)`, `(reduced|code|internal|natural|dimensionless) units`; (iii) decorated-variable legends — `(hats?|tildes?|asterisks?) denote (dimensionless|normali[sz]ed)` … `we drop the (hats|tildes)` (everything after that marker is in-system); (iv) named dimensionless groups as bare PDE coefficients; (v) restoration appendices — `to convert to (physical|cgs|SI) units`; (vi) code keywords (`units lj`, `UnitLength_in_cm`, `M_unit`, `Ω = 1`). Two-stage extractor: regex-locate the declaration paragraph → parse into (symbol, defining expression, dimension) triples → **dimension-check each defining expression against its claimed role** and surface mismatches before committing the convention.

### 6.5b Convention recovery with no declaration *(round 4)*

Three outcomes, not two: declaration parsed; **conventions block found, unit axes absent**; no declaration. Widen the surface first — captions, footnotes, parameter-table headers (`A_⊥/h (MHz)`), the parenthetical template with no governing verb ("in the standard convention ħ = c = 1"), and a noun list past lengths/times/energies/velocities to frequencies, detunings, rates, amplitudes, powers, fields. Guard cue (i): a normalization table's left column holds symbols with *defining expressions*; one whose row labels are methods or materials is a results table, and reading it as cue (i) emits a false generator on a paper with an empty generator set.

When every cue is empty, recover from equation form, ranked: (1) inner-product limits and prefactor → PSD sidedness; (2) Fourier kernel phase → the Fourier triple; (3) strain-definition caption → ΔL/L vs δL/L; (4) explicit F₊/F× → averaging state; (5) "detector-frame" → frame tag. Failing all, emit **negative evidence**, never a default.

### 6.6 Anti-fingerprints retired by adjudication

Fingerprints that would misfire, removed from the data: α_s = g² as a Gaussian tell (α_s ≡ g²/4π universally, fixed independently of EM rationalization); the rutherford as an MTS unit (a 1946 US NBS proposal, no MTS connection); "absurdly large B values" for ESU (inverted); m_P = G^(−1/2) as a c=1-only tell (requires ħ=1; with c=1 only, m_P = √(ħ/G)); the α′=2 mass-formula contrast "M² = 2(N+Ñ−2) rather than 4(N−1)" (those are identical at level matching); Weber's constant "3.107×10⁸ m/s" (that figure is c_W/√2 ≈ c — the trap is the other direction, c_W ≈ 4.4×10⁸ m/s); Hellings–Downs curves "reaching −0.25 (or −0.5) at 180°" (Γ(π) = +¼, doubled +½; the curve's minimum is ≈ −0.15 near 82°); and the **spherical-harmonic addition-theorem 4π** of Slater-integral expansions — a bare 4π inside a Coulomb matrix element, invariant under EM rationalization, which lives in F^k.

---

## 7. Boundaries — the refuse list

Detect by name, refuse with a specific message, never approximate: the §2.11 structural classes, plus **Euclidean↔Minkowski analytic continuation** (a Wick-rotated source is a different formulation, not a notation — tag it Euclidean per §2.12, never continue it), plus these concrete instances: photometric quantities (V(λ), K_cd weighting); gray vs sievert (w_R weighting — same dimension, different quantity); Jy/beam, K km/s, mag/arcsec² (hidden solid angle / line width); the full Edlén/Ciddor air-index transform when T, p, humidity are unstated (the standard-air medium tag itself is a v1 converter edge — §5 round-3); Watson A- vs S-reduced Hamiltonians; Hückel α/β (fitted, non-transferable); variant-Gaussian (detect via 4πj with j in abA/cm², Lorentz force *keeps* its 1/c — warn, never translate); LAMMPS "units electron" (hybrid inconsistent on three axes: time fs vs a.u., mass amu vs m_e, velocity bohr per 1.03275 fs — detection must never rest on two axes agreeing).

**Numeric-epoch tags** (not translation, but numeric-mode correctness): pre-1948 electrical papers mean *international* units (mean-international Ω 1.00049, V 1.00034, A 0.99985, W 1.00019; **US branch differs**: A 0.999835, W 1.000165); 1990–2019 precision papers may mean conventional units (K_J-90/R_K-90, ~10⁻⁷); the 1884 *legal ohm* is a distinct unit 0.25% off (never alias it to the international ohm); torr ≠ mmHg at 1.4×10⁻⁷; US survey foot vs international foot at 2×10⁻⁶ (deprecated 2022); cal_th = 4.184 J vs cal_IT = 4.1868 J vs cal_15; Btu variants at 6.7×10⁻⁴; μ₀ = 10⁻⁷ marks unrationalized MKS — riders: D, H, ε ×4π and **μ ÷4π** (check: με must stay 1/c²).

---

## 8. Additions backlog (adjudicated omissions, accepted but not yet enumerated as full rows)

**System rows to add**: Kolb–Turner units (v1 — see §4); GADGET/AREPO/GIZMO code units (kpc/h, 10¹⁰ M_⊙/h, km/s; G = 43007.1 internal; compounds with little-h inside the mass unit — the most widely distributed code units in cosmology); Schrödinger units (ħ = G = e²/4πε₀ = 1, c = 137 — completes the "which constant equals 137" quartet); atomic mass-unit scales (u/Da vs pre-1961 physical and chemical amu scales, ~3×10⁻⁴); pre-1990 as-maintained national electrical units (V₆₉ etc.); the 1884 legal ohm as its own row; Weber's electrodynamic charge (q_ed = q_EMU/√2 — what makes the √2 trap actionable); MKSQ/MKSΩ as aliases on the MKSA row (Stratton, Sommerfeld).

**Nondimensionalization presets to add**: rotating/GFD scaling (Ro, Ek, Bu); geodynamo/Elsasser B-scalings; Kolmogorov dissipation units; lattice-Boltzmann units (never restore lattice Ma); CR3BP canonical units (merge with astrodynamics row); Lane–Emden polytrope scaling; GPE healing-length units (ξ = ħ/√(2mgn) vs ħ/√(mgn) — a genuine √2 fork); Fourier/diffusion scaling (Fo, Bi, Pe, Sc); combustion/flame units; reaction–diffusion and mathematical-biology scalings; hybrid-code ion-scale units (d_i, Ω_ci⁻¹, v_A); radiative-transfer optical depth and self-similar variables (already refuse-classed in §2.11 — need only named rows).

**Converter-graph entries to add**: cross sections (a₀² = 28.0028 Mb, πa₀² = 87.974 Mb, barn); line-intensity conventions (f vs gf; the decadic/Napierian fingerprint already sits at §5 #20 — only the converter row is needed); EFG→NQCC bridge (χ[MHz] = 234.9647 Q[b] q[a.u.]); hyperpolarizability a.u.↔esu (β: 8.639×10⁻³³, γ: 5.037×10⁻⁴⁰, α: 0.1481847 Å³); horsepower/nautical-mile/volume variants (numeric-only, mostly out of scope but cheap).

**Not added** (rejected as duplicates): see §9.

---

## 9. Adjudication log

**Corrections: 90 raised, 90 accepted** (16 si-cgs-em, 13 hep-natural, 18 gr-cosmo-astro, 12 atomic-cm, 14 historical-engineering, 17 nondimensionalization). The standing expectation that ~⅓ of adversarial findings get rejected did not apply here, for a structural reason worth recording: the verifiers were instructed to report only *corrections to existing claims* (never redesigns or new content), they recomputed arithmetic independently, and every spot-checked claim held. The rejection rate landed on the omission claims instead (9/52).

Material corrections by class:

- **Arithmetic in "verified" numbers** (the most dangerous class — all flagged as computed in-session by enumerators): (2π)⁸ = 2.43×10⁶ not 6.1×10⁶; q_P(HL) = 5.2908×10⁻¹⁹ C; 1 V/m = 6.5163×10⁻⁷ eV²; GM_⊙/c³ = 4.9255 μs; √G/c² = 2.8745×10⁻²⁵ cm/esu; ħ = 8π ℓ_P² = 6.57×10⁻⁶⁹ m² in κ=1 units; TU_Earth = 806.811 s; e/√2 = 1.132911×10⁻¹⁹ C; G = 2.4004×10⁻⁴³ a.u.; nuclear saturation ≈ 4.4×10⁻⁴ in NR code units; Hénon-units c ~ 10⁴–10⁵.
- **Sign/direction inversions**: little-h absolute magnitudes are −5 log h (propagated into two rows and a trap list); μ_unrat = μ₀/4π not ×4π; ESU B-magnitude fingerprint inverted; Dirac-atomic unit-size vs value-mapping direction; Weber's-constant warning inverted.
- **Physics fixes**: the (+,−,−,−)/(−,+,+,+) mismatch in the EM stress tensor (propagated across five rows — the census's benchmark forms now declare a (−,+,+,+) signature tag); Cluster A's thermodynamic signature restricted to ħ=1; geometrized-Gaussian curved Dirac equation missing q/ħ; PIC pair-Coulomb carries the 1/(4πn₀d_e³) plasma-parameter residue; Kogut–Susskind Gauss law needs left/right link fields (U(1) form only as written); gyrokinetic quasineutrality needs the (1−Γ₀) polarization; recovery temperature is a factor 1 + r(γ−1)M²/2; adiabatic/isothermal c_s differ by √γ not √2; graphene v_F = √3/2 in lattice-constant units.
- **Schema-consistency fixes** (17 rows repatched — see master-table Adjudication column): the relativity-of-riders rulings, `document_hybrid` and `numeric_only` as new classes, two ill-posed generator sets caught, spectroscopic ħ-row factor convention, "relativistic units" alias collision resolved.
- **Attribution/history fixes**: Giorgi's system was rationalized from the outset (1901, "Unita razionali") — the unrationalized MKS row renamed; Kennelly-as-unrationalized retracted (his attested usage is the magnetic-polarization convention, which has its own row); henry 1893 / joule+watt 1889, not 1881; Elk is a Hartree-unit code (never Rydberg); Heitler uses Heaviside units; Panofsky–Phillips 2nd ed. is SI; rutherford–MTS link retracted as invented.

**Omission claims: 52 raised — 40 accepted (§8 lists the 25 highest-value; the rest are merge-notes), 12 rejected as cross-family duplicates**: Hartree, Rydberg, Gaussian-natural, HL-geometrized, geometrized-ħ≠1, k_B=1, 16πG=1/AdS-L=1, lattice-gauge a=1, cold-atom recoil units, plain-SI-GR, Gaussian-k astronomical units, MD real/metal code units — each already enumerated in another family (the fan-out's per-family blindness — resolved at the claim level; row-level twins are retained by design per the §3 legend).

**Round 3 (reader-lens sweep, run `wf_a8e7a020`, 14 agents):** seven critics reading the census as different specialists claimed 69 gaps; verifiers confirmed 47, corrected 10 as overstated, re-slotted 8 as wrong-treatment, and rejected 4 as duplicates (the exclusion seeding held — only 4/69 resubmissions). Adjudication accepted every verifier ruling after spot-checks. Notable corrections folded in: Hellings–Downs Γ(π) = **+¼**, not −¼ (a fingerprint that would never have fired); the PTA amplitude fork is yr³-absorption, not "dimensionless vs s³"; spinor-ε flips hit only odd-ε bilinears; TDB brightness-temperature band values fixed (0.325 at 220 GHz); anharmonic double-counting attaches to *diagonal* x_ii; the Killing-normalization fork exists only beyond asymptotic flatness; uncertainty semantics never corrupt a conversion (relative uncertainty is preserved) — they bite on re-rendering and combining. Rejected-duplicate residues harvested: the affine-class split (refuse vs tag-and-restrict), double-count lint rules, and kind-conditioned token expansion for undimensioned unit strings ('emu'). One verified non-gap recorded in §2.13. Structural synthesis in §2.13; row-level additions in the §5 round-3 table.


**Round 4 (empirical pilot `wf_cee35635` + five-lens top-up `wf_99edf84d` + claims verification `wf_65878598` + two drafting agents; ~45 agents):** 232 verified claims, 207 accepted. Pilot: 163 deduplicated clusters from 12 papers — 102 confirmed, 47 accepted as corrected, 8 not_real, 2 pilot-misread, 4 duplicates; a further ~15 census_error claims were dissolved by their verifiers (core did not survive; recorded in `data/`, not applied). Lens gaps: 51 — 37 confirmed, 6 corrected, 7 re-slotted (both truncation-flagged re-slots re-checked against full verdicts: g_A → three rows with the sign leg on the sign axis; RB fidelity → family with the repaired r = 1.0×10⁻³ / 1−p = 2.0×10⁻³ / 1−F_e = 1.5×10⁻³ example), 1 unadjudicated (chemical-potential identity — marked). Backlog: 18/18 rows confirmed into §3. Headline retraction: the registry-closure claim (C11) — §1 and §2.5 rewritten. Ten drafter-size-cut items restored (C31/C32/C34/C37/C42+C153/C78/C79/C111/C152) as catch-up rows and fixes. Session-limit lore: the top-up's verify stage died twice (usage reset, then connection loss) and completed on the third cached resume.

**Round-5 data errata and rule refinement** — see §2.4's execution refinement note.

**Data errata (round 5, found by the encoding):** the `gr-cosmo-astro` enum records ε₀ as (−1,−3,4,2,0) — Θ and I transposed — on the geometrized-Gaussian, geometrized-HL, GRMHD and Landau–Lifshitz rows. The correct SI-basis vector is (−1,−3,4,0,2); the encodings use the correct one and the enum is left as-is with this note.

**Known process gaps**: the historical-engineering enumerator described 24 systems in its notes but delivered only 8 rows (its notes' sections 16–24 — radian convention, affine/logarithmic classes — were reconstructed into §2 and §7 of this census from the notes plus verifier corrections). Sourcing weakness in the nondimensionalization family (several correct entries cite only the Buckingham-π overview); re-source when those rows are encoded.

---

## 10. Benchmark corpus and regression tests

### 10.1 Corpus taxonomy (round-3 amendment)

The corpus is not one kind of object. Five classes, each testing a different engine claim:

- **A. Translation pairs** — the same physical statement in two conventions, *both sides hand-verified*. The per-system benchmark forms are the unit-system instances (Coulomb's law across 90 systems *is* a pair set). Signature demands its own: the parity rule cannot be validated by benchmarks that carry only one signature tag with the other side "derivable" — a transform needs ground truth at both ends. Core signature set (~12 pairs, hand-verified): scalar/Maxwell/Dirac Lagrangians, the Klein–Gordon operator, EM and Hilbert stress tensors, geodesic equation, mass-shell, propagator denominators. **The fermionic pairs are mandatory hand-work** (γ-conventions are riders, not parity-derivable). Plus one notational-ict pair (F₄ₖ = iEₖ ↔ real metric) and identity-tag conversion pairs with numbers (m_b pole ↔ MS̄).
- **B. Detection benchmarks** — snippet → expected classification, with *negatives as first-class citizens*: the retired anti-fingerprints (§6.6) are the false-positive suite, and cluster inputs (a vacuum Schwarzschild metric) must yield the *set* answer, never a single label.
- **C. Refusal benchmarks** — inputs that must decline with the right named reason: a Euclidean lattice action (tag, refuse continuation), {t, J} and {ħ, k_B, a, e} declarations (rank failure with the named Π-group), a modulo-quantum comparison without a branch, a magnitude arithmetic, a variant-Gaussian Maxwell set.
- **D. Invariance and property tests** — cheap breadth where pair enumeration doesn't scale: flip∘flip = identity on random ASTs; the parity rule reproduces every class-A signature pair; K-quadratic terms invariant under the hypersurface sign flip; eA_μ invariant across EM rationalization; dimensionless residues (β, Re) numerically identical across systems; α′/ħ/c⁻²-graded terms solve to residual exponent zero.
- **E. Numeric regressions** — every arithmetic correction from three rounds of adjudication, verbatim: these are precisely the errors a wrong implementation (or a wrong table entry) actually produces, adversarially generated for free.

**Seed corpus shipped**: `benchmarks-seed.json` — mined from the census data: 220 in-system equation forms over the 90 rows that carry benchmark forms (class A targets), 69 fork examples with both variants written out (classes A/B), 108 claim→correction pairs (class E and B-negatives; includes the 18 corrected/re-slotted round-3 items, whose verdicts are themselves test content), 7 anti-fingerprints (class B negatives). Each item carries provenance into `data/*.json` and needs curation into an executable test at extraction time; the hand-authored class-A signature/fermion core and class-D property tests are the two pieces that cannot be mined and must be written.

### 10.2 Signature tagging

All tensor benchmarks in the mined seed declare signature **(−,+,+,+)** (five rows originally mixed signatures) — as a per-benchmark *tag*, not a corpus standard: per §2.12 the mostly-minus forms are derivable by the contraction-parity rule, signature is a reader preference, and the derivability claim is itself under test via the class-A pair core and the class-D property suite.

### 10.3 Named regression tests (tagged by §10.1 class)

1. **[E]** 1 T = 10⁴ G via B_G = √(4π/μ₀)B_SI — **must include the kg·m→g·cm base conversion** (skipping it errs by ~3.16, and the factors are dimensionful).
2. **[A]** H = B − 4πM rider composition (H takes both riders, M only the c-rider).
3. **[A]** GRMHD's EM generator is ε₀ (HL), not 4πε₀ — b²/2 magnetic pressure with no 4π.
4. **[D]** μ_unrat·ε_unrat = 1/c² after the unrationalized-MKS riders.
5. **[C]** Gaussian Faraday restoration under a 4πε₀-only generator set fails *inconsistent* (not wrong-answer) and hints at the hidden c.
6. **[B]** Vacuum-only GR input yields the Cluster B *set* answer, not a G=1 default.
7. **[E]** E = hc/λ goes through the converter graph's reciprocal edge, never the linear solve.

### 10.4 First execution (round 5)

A ~100-line prototype kernel (exact rational arithmetic; `data/kernel_test.py`) implemented the census's core machinery — dimension vectors, the restoration solve, `validateConvention` with named null-space groups, the span rule — and ran two batteries. **Named regressions: 15/15 pass**, including {t, J} → "J/t = 1" named, {L, U, ν} → the Re group named, the full residual-rank ladder, light-wave E = cB restoring c¹ under the span rule and declining *inconsistent* under a 4πε₀-only set, {hc, h, ħ, k_B} caught as rank 3, and 1 T = 10⁴ G to 12 digits with the base-conversion trap reproducing exactly 3162.3 when skipped. **Data audit: 256/256 recorded generator dimension tuples machine-parse (100%)**; rank-checking all systems found 6 dependent sets correctly self-flagged in their own rows and **3 needing encoding attention** (noted in their Adjudication cells): the force-extended-basis gap on `role: inserted` systems, the GS2 anisotropic-length dependence (C34 rediscovered from data by the kernel), and one PIC tuple reconciliation.

**Data**: `data/<family>.enum.json` (raw enumerations, uncorrected — read with §9), `data/<family>.verdict.json` (adversarial verdicts), `data/master_rows.tsv` (pre-adjudication row dump). The corrected view of record is this document.
