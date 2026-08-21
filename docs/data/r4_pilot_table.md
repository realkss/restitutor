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

#### Round-4 structural findings (for §2.14)

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
