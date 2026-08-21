// The generator-parameterized convention layer — the census's core machinery
// (docs/unit-systems-census.md §2), ported from the executed round-5 kernel
// prototype (docs/data/kernel_test.py, 15/15).
//
// This module is deliberately independent of src/unitsEngine.ts: that file is
// the production floater engine, vendored byte-identical by the site, and it
// stays stable. The convention layer is where the census's data model lives;
// the engine grows into it rather than being rewritten under the site's feet.
//
// Exact arithmetic throughout: dimension exponents are rationals (halves from
// \sqrt, thirds from cube roots occur in the wild), and rank decisions must
// never ride on floating-point noise.

// ---------------------------------------------------------------------------
// Rationals
// ---------------------------------------------------------------------------

export class Frac {
  readonly n: bigint
  readonly d: bigint

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n)
    let dd = BigInt(d)
    if (dd === 0n) throw new Error("zero denominator")
    if (dd < 0n) {
      nn = -nn
      dd = -dd
    }
    const g = Frac.gcd(nn < 0n ? -nn : nn, dd)
    this.n = g === 0n ? 0n : nn / g
    this.d = g === 0n ? 1n : dd / g
  }

  private static gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) [a, b] = [b, a % b]
    return a
  }

  static of(n: number, d = 1): Frac {
    return new Frac(BigInt(n), BigInt(d))
  }

  add(o: Frac): Frac {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d)
  }
  sub(o: Frac): Frac {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d)
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d)
  }
  div(o: Frac): Frac {
    if (o.n === 0n) throw new Error("division by zero")
    return new Frac(this.n * o.d, this.d * o.n)
  }
  neg(): Frac {
    return new Frac(-this.n, this.d)
  }
  isZero(): boolean {
    return this.n === 0n
  }
  eq(o: Frac): boolean {
    return this.n === o.n && this.d === o.d
  }
  toString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`
  }
}

const F0 = Frac.of(0)
const F1 = Frac.of(1)

// ---------------------------------------------------------------------------
// Dimension vectors over (M, L, T, Θ, I)
// ---------------------------------------------------------------------------

export const BASE_DIMS = ["M", "L", "T", "Θ", "I"] as const
export type DimQ = [Frac, Frac, Frac, Frac, Frac]

/** Convenience constructor from plain numbers (halves etc. via [n, d] pairs). */
export function dimQ(...parts: (number | [number, number])[]): DimQ {
  if (parts.length > 5) throw new Error(`dimQ: ${parts.length} components over a 5-dimension basis`)
  const out = parts.map((p) => (Array.isArray(p) ? Frac.of(p[0], p[1]) : Frac.of(p)))
  while (out.length < 5) out.push(F0)
  return out as DimQ
}

export function dimIsZero(d: DimQ): boolean {
  return d.every((x) => x.isZero())
}

// ---------------------------------------------------------------------------
// Generators and conventions (census §2.2)
// ---------------------------------------------------------------------------

export type GeneratorKind =
  | "fundamental_constant"
  | "theory_scale"
  | "solution_parameter"
  | "regulator"
  | "reference_model"

export type Generator = {
  /** TeX of the BARE constant, e.g. "G", "\\hbar", "\\varepsilon_0" — the absorbed combination lives in `emits`. */
  tex: string
  dim: DimQ
  /**
   * Dimensionless factor absorbed with it ("8\\pi" when the combination set to 1
   * is 8πG). Invisible to the solve by theorem; it is data, never derived.
   */
  numericFactor: string
  /** Exact TeX a restoration should emit, e.g. "(8\\pi G)". */
  emits: string
  kind: GeneratorKind
  /** Census §2.2: absorbed (set to 1) vs inserted (non-coherent engineering systems force it ≠ 1). */
  role: "absorbed" | "inserted"
  /** Optional numeric value for round-tripping; absent for theory scales published without one. */
  value?: string
}

export type Convention = {
  name: string
  generators: Generator[]
  /** Optional: declares that a dependent generator pair is licensed by an exact symmetry (census §2.3). */
  symmetryOverride?: string
}

// ---------------------------------------------------------------------------
// Exact linear algebra: rank, row-nullspace, restoration solve
// ---------------------------------------------------------------------------

function rankAndNullspace(rows: DimQ[]): { rank: number; nullspace: Frac[][] } {
  const n = rows.length
  // Augment each row with identity to track the combination coefficients.
  const aug: Frac[][] = rows.map((r, i) => [
    ...r,
    ...Array.from({ length: n }, (_, j) => (i === j ? F1 : F0)),
  ])
  let rank = 0
  for (let col = 0; col < 5; col++) {
    let piv = -1
    for (let r = rank; r < n; r++)
      if (!aug[r][col].isZero()) {
        piv = r
        break
      }
    if (piv < 0) continue
    ;[aug[rank], aug[piv]] = [aug[piv], aug[rank]]
    const pv = aug[rank][col]
    aug[rank] = aug[rank].map((x) => x.div(pv))
    for (let r = 0; r < n; r++) {
      if (r !== rank && !aug[r][col].isZero()) {
        const f = aug[r][col]
        aug[r] = aug[r].map((x, k) => x.sub(f.mul(aug[rank][k])))
      }
    }
    rank++
  }
  return { rank, nullspace: aug.slice(rank).map((row) => row.slice(5)) }
}

export type ValidationResult =
  | {
      /** Generators independent and every base dimension fixed (residual rank 0). */
      kind: "well-posed"
      generatorCount: number
      rank: number
      residualRank: number
    }
  | {
      /** Census §2.3's third outcome: independent generators, but residual dimensional
       * freedom survives (ħ = c = 1 with lengths still in fm). Common and legitimate;
       * residualRank says how much checking remains possible. */
      kind: "partial"
      generatorCount: number
      rank: number
      residualRank: number
    }
  | {
      kind: "over-determined"
      generatorCount: number
      rank: number
      residualRank: number
      /**
       * The dimensionless combinations silently asserted equal to 1 — physical
       * restrictions disguised as unit choices, NAMED (census §2.3): "L·U·ν^-1 = 1" ⇒ Re = 1.
       */
      impliedGroups: string[]
      /** Present when the convention declares the dependence is licensed by an exact symmetry. */
      symmetryOverride?: string
    }

export function validateConvention(conv: Convention): ValidationResult {
  for (const gen of conv.generators) {
    if (dimIsZero(gen.dim))
      throw new Error(
        `dimensionless generator "${gen.tex}": not a unit choice — route it to the N axis or the dimensionless-conventions registry (census §2.1, §2.5)`,
      )
  }
  const rows = conv.generators.map((g) => g.dim)
  const { rank, nullspace } = rankAndNullspace(rows)
  const n = rows.length
  const residualRank = 5 - rank
  if (n <= rank)
    return {
      kind: residualRank === 0 ? "well-posed" : "partial",
      generatorCount: n,
      rank,
      residualRank,
    }
  const impliedGroups = nullspace.map((vec) => {
    const parts: string[] = []
    vec.forEach((a, i) => {
      if (!a.isZero()) {
        const sym = conv.generators[i].emits
        parts.push(a.eq(F1) ? sym : `${sym}^{${a.toString()}}`)
      }
    })
    return parts.join(" \\cdot ") + " = 1"
  })
  return {
    kind: "over-determined",
    generatorCount: n,
    rank,
    residualRank,
    impliedGroups,
    symmetryOverride: conv.symmetryOverride,
  }
}

export type RestorationSolve =
  | { kind: "unique"; exponents: { generator: Generator; power: Frac }[] }
  | {
      /** No power combination of the generators has the target dimension — the census's
       * decline-with-hint case (a Gaussian B under a 4πε₀-only set lands here). */
      kind: "inconsistent"
    }
  | { kind: "non-unique" }

/** Solve Σ xⱼ·dim(gⱼ) = target exactly. Uniqueness is the census's theorem when it holds. */
export function solveRestoration(conv: Convention, target: DimQ): RestorationSolve {
  const gens = conv.generators
  const n = gens.length
  // 5 equations (one per base dimension), n unknowns, augmented with the target.
  const A: Frac[][] = Array.from({ length: 5 }, (_, i) => [
    ...gens.map((g) => g.dim[i]),
    target[i],
  ])
  let rank = 0
  const pivots: number[] = []
  for (let col = 0; col < n; col++) {
    let piv = -1
    for (let r = rank; r < 5; r++)
      if (!A[r][col].isZero()) {
        piv = r
        break
      }
    if (piv < 0) continue
    ;[A[rank], A[piv]] = [A[piv], A[rank]]
    const pv = A[rank][col]
    A[rank] = A[rank].map((x) => x.div(pv))
    for (let r = 0; r < 5; r++) {
      if (r !== rank && !A[r][col].isZero()) {
        const f = A[r][col]
        A[r] = A[r].map((x, k) => x.sub(f.mul(A[rank][k])))
      }
    }
    pivots.push(col)
    rank++
  }
  for (let r = rank; r < 5; r++) if (!A[r][n].isZero()) return { kind: "inconsistent" }
  if (rank < n) return { kind: "non-unique" }
  const exponents = pivots.map((col, i) => ({ generator: gens[col], power: A[i][n] }))
  return { kind: "unique", exponents: exponents.filter((e) => !e.power.isZero()) }
}

// ---------------------------------------------------------------------------
// Canonical constant dimensions (SI basis) and the first encoded conventions —
// the start of the census §3 v1 encoding. Each generator's numericFactor is
// the dimensionless part the solve can never see (census §2.5).
// ---------------------------------------------------------------------------

export const CONST_DIM = {
  c: dimQ(0, 1, -1, 0, 0),
  G: dimQ(-1, 3, -2, 0, 0),
  hbar: dimQ(1, 2, -1, 0, 0),
  kB: dimQ(1, 2, -2, -1, 0),
  eps0: dimQ(-1, -3, 4, 0, 2),
  mu0: dimQ(1, 1, -2, 0, -2),
  e: dimQ(0, 0, 1, 0, 1),
  me: dimQ(1, 0, 0, 0, 0),
} as const

const g = (
  tex: string,
  dim: DimQ,
  numericFactor: string,
  emits: string,
  kind: GeneratorKind = "fundamental_constant",
): Generator => ({ tex, dim, numericFactor, emits, kind, role: "absorbed" })

// ---------------------------------------------------------------------------
// Riders under the span rule (census §2.4)
//
// A rider is a per-symbol definitional rescaling relative to the plain quotient
// (Gaussian B = c · B_SI-quotient). Whether it must be APPLIED depends on the
// active generator set: a dimensionful factor already in the span of the
// restored generators is supplied by the solve itself (light wave: E = cB falls
// out when c is restored), so the rider activates only when its factor lies
// OUTSIDE the span. Dimensionless factors (the 4π of unrationalization) are
// never in any span — they always apply.
// ---------------------------------------------------------------------------

export type Rider = {
  /** The symbol whose definition is rescaled, e.g. "B", "H", "M", "D", "A". */
  symbol: string
  /** TeX of the factor, e.g. "c" or "4\\pi". */
  factorTex: string
  /** Dimension of the factor; null for a dimensionless factor (always active). */
  factorDim: DimQ | null
  /** multiply: symbol = factor × quotient value; divide: symbol = quotient value / factor. */
  direction: "multiply" | "divide"
}

/**
 * The span rule, with the round-5 refinement: a rider suppresses only when its
 * factor CONSTANT is itself generated (set to 1) by the convention — not merely
 * when its dimension is reachable. Dimension-reachability is insufficient:
 * Hartree's {ħ, m_e, e, 4πε₀} spans velocity as e²/(4πε₀ħ) = αc, so the solve
 * would "supply" a constant smaller than c by exactly α (c = 137.036 in-system,
 * census §5 #9) and every magnetic quantity would silently drop that α.
 * Suppression therefore requires the solve to return exactly the factor itself:
 * one exponent, power 1, on a generator whose bare constant is the factor with
 * no absorbed numeric part.
 */
export function riderActive(conv: Convention, rider: Rider): boolean {
  if (rider.factorDim === null) return true
  const s = solveRestoration(conv, rider.factorDim)
  if (s.kind !== "unique") return true
  return !(
    s.exponents.length === 1 &&
    s.exponents[0].power.eq(Frac.of(1)) &&
    s.exponents[0].generator.tex === rider.factorTex &&
    s.exponents[0].generator.numericFactor === "1"
  )
}

export function activeRiders(conv: Convention, riders: Rider[]): Rider[] {
  return riders.filter((r) => riderActive(conv, r))
}

const cDim = (): DimQ => dimQ(0, 1, -1, 0, 0)
const cRider = (symbol: string, direction: "multiply" | "divide"): Rider => ({
  symbol,
  factorTex: "c",
  factorDim: cDim(),
  direction,
})
const fourPiRider = (symbol: string, direction: "multiply" | "divide"): Rider => ({
  symbol,
  factorTex: "4\\pi",
  factorDim: null,
  direction,
})

/**
 * The census's 2×2 classification of classical E&M (census §2.4):
 * c-rider ("symmetric B"): B → cB, A → cA, H → H/c, M → M/c — Gaussian, Heaviside–Lorentz.
 * 4π-rider (unrationalized): D → 4πD, H → 4πH — Gaussian, ESU, EMU.
 * H carries both; M carries only the c-rider. SI = neither.
 */
export const EM_RIDERS: Record<string, Rider[]> = {
  si: [],
  "heaviside-lorentz": [cRider("B", "multiply"), cRider("A", "multiply"), cRider("H", "divide"), cRider("M", "divide")],
  esu: [fourPiRider("D", "multiply"), fourPiRider("H", "multiply")],
  emu: [fourPiRider("D", "multiply"), fourPiRider("H", "multiply")],
  gaussian: [
    cRider("B", "multiply"),
    cRider("A", "multiply"),
    cRider("H", "divide"),
    cRider("M", "divide"),
    fourPiRider("D", "multiply"),
    fourPiRider("H", "multiply"),
  ],
}

export const CONVENTIONS: Record<string, Convention> = {
  "geometrized": {
    name: "Geometrized (G = c = 1)",
    generators: [g("c", CONST_DIM.c, "1", "c"), g("G", CONST_DIM.G, "1", "G")],
  },
  "geometrized-gaussian": {
    name: "Geometrized-Gaussian (G = c = 4πε₀ = 1)",
    generators: [
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)"),
    ],
  },
  "hep-hl-kb": {
    name: "HEP natural units (ħ = c = ε₀ = k_B = 1, Heaviside–Lorentz)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("\\varepsilon_0", CONST_DIM.eps0, "1", "\\varepsilon_0"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
    ],
  },
  "reduced-planck": {
    name: "Reduced Planck (ħ = c = k_B = 8πG = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
      g("G", CONST_DIM.G, "8\\pi", "(8\\pi G)"),
    ],
  },
  "kolb-turner": {
    name: "Kolb–Turner (ħ = c = k_B = 1, G = m_Pl⁻² kept)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
    ],
  },
  "planck-gaussian": {
    name: "Planck units, Gaussian flavour (ħ = c = G = k_B = 4πε₀ = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
      g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)"),
    ],
  },
  "hartree": {
    name: "Hartree atomic units (ħ = m_e = e = 4πε₀ = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("m_e", CONST_DIM.me, "1", "m_e"),
      g("e", CONST_DIM.e, "1", "e"),
      g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)"),
    ],
  },
  "rydberg": {
    name: "Rydberg atomic units (ħ = 2m_e = e²/2 = 4πε₀ = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("m_e", CONST_DIM.me, "2", "(2m_e)"),
      g("e", CONST_DIM.e, "1/\\sqrt{2}", "(e/\\sqrt{2})"),
      g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)"),
    ],
  },

  // --- classical E&M family (census §3, si-cgs-em; riders in EM_RIDERS) ---
  "si": { name: "SI (2019): the zero-generator baseline", generators: [] },
  "gaussian": {
    name: "CGS-Gaussian (4πε₀ = 1 + the c- and 4π-riders)",
    generators: [g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)")],
  },
  "esu": {
    name: "CGS-ESU (4πε₀ = 1, unrationalized, no c-rider)",
    generators: [g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)")],
  },
  "emu": {
    name: "CGS-EMU (μ₀/4π = 1, unrationalized)",
    generators: [g("\\mu_0", CONST_DIM.mu0, "1/(4\\pi)", "(\\mu_0/4\\pi)")],
  },
  "heaviside-lorentz": {
    name: "Heaviside–Lorentz (ε₀ = 1, rationalized, c-rider)",
    generators: [g("\\varepsilon_0", CONST_DIM.eps0, "1", "\\varepsilon_0")],
  },

  // --- natural-unit family (census §3, hep-natural) ---
  "c-only": {
    name: "Relativist's units (c = 1 only)",
    generators: [g("c", CONST_DIM.c, "1", "c")],
  },
  "hep-hl": {
    name: "HEP natural units (ħ = c = ε₀ = 1, Heaviside–Lorentz; k_B not set)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("\\varepsilon_0", CONST_DIM.eps0, "1", "\\varepsilon_0"),
    ],
  },
  "gaussian-natural": {
    name: "Gaussian natural units (ħ = c = 4πε₀ = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("\\varepsilon_0", CONST_DIM.eps0, "4\\pi", "(4\\pi\\varepsilon_0)"),
    ],
  },
  "planck-hl": {
    name: "Planck units, Heaviside–Lorentz flavour (ħ = c = G = k_B = ε₀ = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
      g("\\varepsilon_0", CONST_DIM.eps0, "1", "\\varepsilon_0"),
    ],
  },
  "classical-kappa": {
    name: "Classical κ = 1 (8πG = c = 1, ħ not set)",
    generators: [
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "8\\pi", "(8\\pi G)"),
    ],
  },
  "sixteen-pi-g": {
    name: "Holographic/SUGRA (16πG = 1, with ħ = c = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "16\\pi", "(16\\pi G)"),
    ],
  },
  "string-alpha-prime": {
    name: "String units (α′ = 1, with ħ = c = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("\\alpha'", dimQ(0, 2, 0, 0, 0), "1", "\\alpha'", "theory_scale"),
    ],
  },
  "string-ls-2pi": {
    name: "String length units (ℓ_s = 2π√α′ = 1 — the pheno 2π convention)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("\\alpha'", dimQ(0, 2, 0, 0, 0), "(2\\pi)^2", "(2\\pi)^2\\alpha'", "theory_scale"),
    ],
  },
  "lattice": {
    name: "Lattice units (a = 1, with ħ = c = 1; Euclidean by default — tag, never continue)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("c", CONST_DIM.c, "1", "c"),
      g("a", dimQ(0, 1, 0, 0, 0), "1", "a", "regulator"),
    ],
  },

  // --- GR / astrophysics (census §3, gr-cosmo-astro) ---
  "bh-scale": {
    name: "Black-hole scale units (G = c = M = 1)",
    generators: [
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      g("M", dimQ(1, 0, 0, 0, 0), "1", "M", "solution_parameter"),
    ],
  },
  "nr-code": {
    name: "Numerical-relativity code units (G = c = M_⊙ = 1)",
    generators: [
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      // value is GM_⊙ in m³ s⁻² (IAU 2015 B3 nominal) — census T9: GM is primary,
      // M_⊙ alone is limited by G to ~2×10⁻⁵. Kind: an IAU defining constant,
      // not a model prediction (reference_model is reserved for those, C95).
      { tex: "M_\\odot", dim: dimQ(1, 0, 0, 0, 0), numericFactor: "1", emits: "M_\\odot", kind: "fundamental_constant", role: "absorbed", value: "1.3271244e20" },
    ],
  },
  "geometrized-hl": {
    name: "Geometrized Heaviside–Lorentz (G = c = ε₀ = 1)",
    generators: [
      g("c", CONST_DIM.c, "1", "c"),
      g("G", CONST_DIM.G, "1", "G"),
      g("\\varepsilon_0", CONST_DIM.eps0, "1", "\\varepsilon_0"),
    ],
  },

  // --- atomic / statistical (census §3, atomic-cm) ---
  "dirac-atomic": {
    name: "Relativistic (Dirac) atomic units (ħ = m_e = c = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("m_e", CONST_DIM.me, "1", "m_e"),
      g("c", CONST_DIM.c, "1", "c"),
    ],
  },
  "kb-only": {
    name: "Temperature as energy (k_B = 1)",
    generators: [g("k_B", CONST_DIM.kB, "1", "k_B")],
  },

  // --- nondimensionalization presets (census §3; per-paper scales) ---
  "lj-reduced": {
    name: "Lennard-Jones reduced units (σ = ε = m = k_B = 1)",
    generators: [
      g("\\sigma", dimQ(0, 1, 0, 0, 0), "1", "\\sigma", "theory_scale"),
      g("\\varepsilon", dimQ(1, 2, -2, 0, 0), "1", "\\varepsilon", "theory_scale"),
      g("m", dimQ(1, 0, 0, 0, 0), "1", "m", "theory_scale"),
      g("k_B", CONST_DIM.kB, "1", "k_B"),
    ],
  },
  "chaos-mw": {
    name: "Hamiltonian/chaos units (m = ω = 1; third scale per paper)",
    generators: [
      g("m", dimQ(1, 0, 0, 0, 0), "1", "m", "solution_parameter"),
      // The census row carries the radian-collapse fork on ω (registry #10):
      // period-normalized papers absorb 2π here. The fork is data, not a default.
      g("\\omega", dimQ(0, 0, -1, 0, 0), "1 \\text{ or } 2\\pi", "\\omega", "solution_parameter"),
    ],
  },
  "trap-units": {
    name: "Harmonic-trap units (ħ = m = ω = 1)",
    generators: [
      g("\\hbar", CONST_DIM.hbar, "1", "\\hbar"),
      g("m", dimQ(1, 0, 0, 0, 0), "1", "m", "solution_parameter"),
      g("\\omega", dimQ(0, 0, -1, 0, 0), "1", "\\omega", "solution_parameter"),
    ],
  },
  "ns-inertial": {
    name: "Navier–Stokes inertial scaling (L = U = ρ = 1)",
    generators: [
      g("L", dimQ(0, 1, 0, 0, 0), "1", "L", "solution_parameter"),
      g("U", dimQ(0, 1, -1, 0, 0), "1", "U", "solution_parameter"),
      g("\\rho", dimQ(1, -3, 0, 0, 0), "1", "\\rho", "solution_parameter"),
    ],
  },
}
