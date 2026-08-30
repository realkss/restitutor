// Convention detection (census §6, product-design §6): document-level first,
// every conclusion carrying its evidence, and the output is a SET of
// candidates — never a single guess (census §6.2). Detection here is
// FILTERING of the convention registry by what the document actually shows:
//
//   - a DECLARATION sentence ("we use geometrized units, G = c = 1")
//     intersects the candidates with the conventions it names;
//   - a VISIBLE constant in an equation excludes the conventions that set it
//     to 1 — a paper that prints ħ is not working in ħ = 1;
//   - ABSENCE of a constant is never evidence (the equation may simply not
//     involve it — census §6.6's anti-fingerprint discipline);
//   - homograph-prone single letters (c, G, e) are recorded as WEAK evidence
//     and never exclude anything on their own: c is also a sound speed, G is
//     also the Einstein tensor's letter, e is also Euler's number.
//
// No evidence → every candidate survives, and saying so IS the honest answer.
// Cluster-B honesty (census §6.2) falls out for free: a vacuum-only GR page
// yields no evidence separating the G-normalization family, so those keys
// stay together in one undivided set.
import { CONST_DIM, CONVENTIONS, DimQ, Frac, solveRestoration } from "./convention"
import { RENDERING } from "./rendering"

export type Strength = "strong" | "weak-homograph"

export type Evidence =
  | {
      kind: "declaration"
      label: string
      /** The matched text with a little surrounding context. */
      excerpt: string
      implies: string[]
    }
  | {
      kind: "visible-constant"
      constant: string
      strength: Strength
      /** Empty for weak evidence — recorded, never acted on. */
      excludes: string[]
      /** How many of the supplied equations show it. */
      count: number
    }

export type DetectionReport = {
  /**
   * narrowed: evidence constrained the candidates. insufficient: nothing
   * constraining was found (weak evidence may still be listed). conflict:
   * the evidence excludes every candidate — declared units and visible
   * constants disagree, which is itself a finding about the document.
   */
  kind: "narrowed" | "insufficient" | "conflict"
  /** Candidate sets the evidence cannot separate further (v1: one span, one set). */
  sets: string[][]
  evidence: Evidence[]
}

const ALL_KEYS = Object.keys(CONVENTIONS)

/**
 * Does this convention generate the constant — under ANY normalization?
 * Deliberately looser than the riders' constant-identity rule: a rider asks
 * "does the solve supply exactly K" (8πG ≠ G there), but a paper working in
 * 8πG = 1 prints neither G nor 8πG, so for VISIBILITY evidence any absorbed
 * normalization of the constant counts.
 */
export function generatesConstant(convKey: string, tex: string, dim: DimQ): boolean {
  const s = solveRestoration(CONVENTIONS[convKey], dim)
  return (
    s.kind === "unique" &&
    s.exponents.length === 1 &&
    s.exponents[0].power.eq(Frac.of(1)) &&
    s.exponents[0].generator.tex === tex
  )
}

/**
 * The STRICT reading a declaration demands: "G = c = 1" means G itself is a
 * generator with no absorbed numeric part — 8πG = 1 is a DIFFERENT statement
 * and must not ride along (the loose rule above is for visibility only).
 */
export function absorbsExactly(convKey: string, tex: string, dim: DimQ): boolean {
  const s = solveRestoration(CONVENTIONS[convKey], dim)
  return (
    s.kind === "unique" &&
    s.exponents.length === 1 &&
    s.exponents[0].power.eq(Frac.of(1)) &&
    s.exponents[0].generator.tex === tex &&
    s.exponents[0].generator.numericFactor === "1"
  )
}

const absorbing = (...consts: [string, DimQ][]) =>
  ALL_KEYS.filter((k) => consts.every(([tex, dim]) => absorbsExactly(k, tex, dim)))

const rendered = (...tables: string[]) => ALL_KEYS.filter((k) => tables.includes(RENDERING[k]))

// ---------------------------------------------------------------------------
// Declaration sentences (census §6.5): conservative patterns, each with its
// implied candidate set. Implications are DERIVED from the convention data
// wherever possible (absorbing/rendered), so a new convention row joins the
// right implication automatically.
// ---------------------------------------------------------------------------
type DeclarationRule = { label: string; pattern: RegExp; implies: () => string[] }

export const DECLARATION_RULES: DeclarationRule[] = [
  {
    label: "geometrized units (G = c = 1)",
    pattern: /geometri[sz]ed\s+units|\bG\s*=\s*c\s*=\s*1\b|\bc\s*=\s*G\s*=\s*1\b/i,
    implies: () => absorbing(["c", CONST_DIM.c], ["G", CONST_DIM.G]),
  },
  {
    label: "natural units (ħ = c = 1)",
    pattern: /\\?hbar\s*=\s*c\s*=\s*1|ħ\s*=\s*c\s*=\s*1|\bc\s*=\s*\\?hbar\s*=\s*1|natural\s+units/i,
    implies: () => absorbing(["\\hbar", CONST_DIM.hbar], ["c", CONST_DIM.c]),
  },
  {
    label: "Boltzmann constant set to one",
    pattern: /k_?\{?B\}?\s*=\s*1|Boltzmann[^.]{0,40}=\s*1/i,
    implies: () => absorbing(["k_B", CONST_DIM.kB]),
  },
  {
    label: "atomic (Hartree) units",
    pattern: /atomic\s+units|Hartree\s+(?:atomic\s+)?units/i,
    implies: () => ["hartree", "hartree-gaussian", "dirac-atomic", "effective-au"],
  },
  {
    label: "Rydberg units",
    pattern: /Rydberg\s+(?:atomic\s+)?units/i,
    implies: () => ["rydberg"],
  },
  {
    label: "Gaussian (CGS) units",
    pattern: /Gaussian\s+units|CGS-?Gaussian/i,
    // hartree-gaussian carries no rider table (α-ambiguity) but is still a
    // Gaussian-rendered convention for detection purposes.
    implies: () => [...rendered("gaussian"), "hartree-gaussian"],
  },
  {
    label: "Heaviside–Lorentz units",
    pattern: /Heaviside\s*[-–]?\s*Lorentz/i,
    implies: () => rendered("heaviside-lorentz"),
  },
  {
    label: "SI (MKSA) units",
    pattern: /\bSI\s+units\b|\bMKSA\b/,
    implies: () => rendered("si"),
  },
  {
    label: "reduced Planck units (8πG = 1)",
    pattern: /8\s*\\?pi\s*G\s*=\s*1|reduced\s+Planck/i,
    implies: () => ["reduced-planck"],
  },
  {
    label: "Planck units",
    pattern: /Planck\s+units/i,
    implies: () => ["planck-gaussian", "planck-hl", "reduced-planck"],
  },
  {
    label: "string units (α′ = 1)",
    pattern: /string\s+units|\\alpha'\s*=\s*1|α'\s*=\s*1/i,
    implies: () => ["string-alpha-prime", "string-ls-2pi"],
  },
]

// ---------------------------------------------------------------------------
// Visible constants in equations. Strong tokens are unmistakable glyphs or
// phrases; weak tokens are homograph-prone letters, recorded but inert.
// ---------------------------------------------------------------------------
type ConstantToken = {
  constant: string
  tex: string
  dim: DimQ
  pattern: RegExp
  strength: Strength
}

export const CONSTANT_TOKENS: ConstantToken[] = [
  { constant: "\\hbar", tex: "\\hbar", dim: CONST_DIM.hbar, pattern: /\\hbar\b/, strength: "strong" },
  {
    constant: "\\varepsilon_0",
    tex: "\\varepsilon_0",
    dim: CONST_DIM.eps0,
    pattern: /\\(?:var)?epsilon_\{?0\}?/,
    strength: "strong",
  },
  { constant: "\\mu_0", tex: "\\mu_0", dim: CONST_DIM.mu0, pattern: /\\mu_\{?0\}?/, strength: "strong" },
  {
    constant: "k_B",
    tex: "k_B",
    dim: CONST_DIM.kB,
    pattern: /k_\{?B\}?|k_\{\\mathrm\{B\}\}/,
    strength: "strong",
  },
  {
    // The phrase "8πG" (or G over powers of c) is unmistakably Newton's
    // constant; a bare G is left to the weak token below.
    constant: "G (as 8\\pi G or G/c^n)",
    tex: "G",
    dim: CONST_DIM.G,
    pattern: /8\s*\\pi\s*G\b|\bG\s*(?:\/|\\over\b)\s*c|\\frac\{\s*(?:8\s*\\pi\s*)?G[^}]*\}\{\s*c/,
    strength: "strong",
  },
  {
    constant: "G",
    tex: "G",
    dim: CONST_DIM.G,
    pattern: /(?<![\\A-Za-z])G(?![A-Za-z_])/,
    strength: "weak-homograph",
  },
  {
    constant: "c",
    tex: "c",
    dim: CONST_DIM.c,
    pattern: /c\^|(?<![\\A-Za-z])c(?![A-Za-z])/,
    strength: "weak-homograph",
  },
  {
    constant: "e",
    tex: "e",
    dim: CONST_DIM.e,
    pattern: /(?<![\\A-Za-z])e(?![A-Za-z])/,
    strength: "weak-homograph",
  },
]

export type DetectionInput = {
  /** Prose to scan for declaration sentences (page text, abstract, …). */
  text?: string
  /** Equations (TeX) to scan for visible constants. */
  equations?: string[]
}

export function inferConventions(
  input: DetectionInput,
  opts: { candidates?: string[] } = {},
): DetectionReport {
  const start = opts.candidates ?? ALL_KEYS
  let survivors = new Set(start)
  const evidence: Evidence[] = []
  let constrained = false

  const text = input.text ?? ""
  for (const rule of DECLARATION_RULES) {
    const m = rule.pattern.exec(text)
    if (!m) continue
    const at = m.index
    const excerpt = text
      .slice(Math.max(0, at - 40), at + m[0].length + 40)
      .replace(/\s+/g, " ")
      .trim()
    const implies = rule.implies()
    evidence.push({ kind: "declaration", label: rule.label, excerpt, implies })
    survivors = new Set([...survivors].filter((k) => implies.includes(k)))
    constrained = true
  }

  const equations = input.equations ?? []
  for (const token of CONSTANT_TOKENS) {
    const count = equations.filter((eq) => token.pattern.test(eq)).length
    if (count === 0) continue
    if (token.strength === "weak-homograph") {
      evidence.push({
        kind: "visible-constant",
        constant: token.constant,
        strength: token.strength,
        excludes: [],
        count,
      })
      continue
    }
    const excludes = [...survivors].filter((k) => generatesConstant(k, token.tex, token.dim))
    evidence.push({
      kind: "visible-constant",
      constant: token.constant,
      strength: token.strength,
      excludes,
      count,
    })
    for (const k of excludes) survivors.delete(k)
    constrained = true
  }

  if (!constrained) return { kind: "insufficient", sets: [start], evidence }
  if (survivors.size === 0) return { kind: "conflict", sets: [], evidence }
  return { kind: "narrowed", sets: [[...survivors].sort()], evidence }
}
