// Geometrized-units → SI translation engine for the units floater.
//
// Translation is lookup, never inference: every symbol must resolve through the
// hub registry below, and the missing powers of c and G are then the *unique*
// solution of a linear system over [mass, length, time, temperature, current]
// (no combination c^a G^b is dimensionless, so uniqueness is a theorem, not a
// heuristic). Anything the registry cannot vouch for — an unknown symbol, an
// unsupported construct, an inconsistent dimension — declines loudly instead
// of guessing.
//
// The KaTeX module is passed in by the caller (the floater lazy-loads it from
// the CDN; tests import the npm package), so this file stays DOM-free.

// ---------------------------------------------------------------------------
// Dimensions: integer twelfths of the exponents of [M, L, T, Θ, I].
// Twelfths keep every arithmetic step exact for the powers that actually occur
// (integers, halves from \sqrt, thirds from cube roots).
// ---------------------------------------------------------------------------

export type Dim = [number, number, number, number, number]

const D12 = 12
const ZERO: Dim = [0, 0, 0, 0, 0]

function dim(m: number, l: number, t: number, th = 0, i = 0): Dim {
  return [m * D12, l * D12, t * D12, th * D12, i * D12]
}

function dimAdd(a: Dim, b: Dim): Dim {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]]
}

function dimSub(a: Dim, b: Dim): Dim {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3], a[4] - b[4]]
}

function dimScale(d: Dim, p: number, q: number): Dim {
  return d.map((x) => {
    const scaled = x * p
    if (scaled % q !== 0) {
      throw new Unsupported("a fractional power whose dimension the engine cannot represent")
    }
    return scaled / q
  }) as Dim
}

function dimIsZero(d: Dim): boolean {
  return d.every((x) => x === 0)
}

class Unsupported extends Error {
  constructor(public reason: string) {
    super(reason)
  }
}

// ---------------------------------------------------------------------------
// Hub registry
// ---------------------------------------------------------------------------

export type RegEntry = { dim: Dim; gloss: string; si: string }

export type HubRegistry = {
  id: string
  name: string
  slugPattern: RegExp
  /** Path (below the language segment) of the conventions page this registry encodes. */
  conventionsPath: string
  /** Languages in which the conventions page actually exists (others fall back to the first). */
  conventionsLangs: string[]
  /** Standalone symbols: `M`, `\kappa`, ... */
  bare: Record<string, RegEntry>
  /** Symbols whose subscript is part of their identity: `T_H`, `k_B`, `r_s`, ... */
  exact: Record<string, RegEntry>
  /** Tensor bases whose sub/superscripts are indices: `R_{ab}`, `T_{\mu\nu}`, ... */
  indexed: Record<string, RegEntry>
  /** Coordinate readings that override `bare` under a `d` prefix (dz is a length even though bare z is a redshift). */
  differential: Record<string, RegEntry>
}

const NUM: RegEntry = { dim: ZERO, gloss: "pure number", si: "1" }

// The GR hub registry is "00. Conventions and Notation" encoded as data:
// geometrized units G = c = 1 with ħ and k_B kept explicit, mostly-plus
// signature, Wald curvature conventions, and coordinates carrying dimension
// length (x⁰ = ct) so that indexed tensors have index-independent dimensions.
const GR_REGISTRY: HubRegistry = {
  id: "relativity-and-gravitation",
  name: "Relativity and Gravitation",
  slugPattern: /(?:^|\/)Topics\/Physics\/Relativity-and-Gravitation(?:\/|$)/,
  conventionsPath: "Topics/Physics/Relativity-and-Gravitation/00.-Conventions-and-Notation",
  conventionsLangs: ["en", "ko"],
  bare: {
    "\\pi": NUM,
    i: { dim: ZERO, gloss: "imaginary unit", si: "1" },
    e: { dim: ZERO, gloss: "Euler's number / eccentricity", si: "1" },
    "\\infty": NUM,
    c: { dim: dim(0, 1, -1), gloss: "speed of light", si: "m s⁻¹" },
    G: { dim: dim(-1, 3, -2), gloss: "Newton's constant", si: "m³ kg⁻¹ s⁻²" },
    "\\hbar": { dim: dim(1, 2, -1), gloss: "reduced Planck constant (kept explicit)", si: "J s" },
    M: { dim: dim(1, 0, 0), gloss: "mass", si: "kg" },
    m: { dim: dim(1, 0, 0), gloss: "mass", si: "kg" },
    r: { dim: dim(0, 1, 0), gloss: "radial coordinate", si: "m" },
    s: { dim: dim(0, 1, 0), gloss: "interval / arc length", si: "m" },
    x: { dim: dim(0, 1, 0), gloss: "Cartesian coordinate", si: "m" },
    y: { dim: dim(0, 1, 0), gloss: "Cartesian coordinate", si: "m" },
    z: { dim: ZERO, gloss: "redshift (bare z; dz reads as a coordinate)", si: "1" },
    b: { dim: dim(0, 1, 0), gloss: "impact parameter", si: "m" },
    R: {
      dim: dim(0, -2, 0),
      gloss: "Ricci scalar (this hub reads bare R as curvature)",
      si: "m⁻²",
    },
    t: { dim: dim(0, 0, 1), gloss: "coordinate time", si: "s" },
    "\\tau": { dim: dim(0, 0, 1), gloss: "proper time", si: "s" },
    "\\eta": {
      dim: dim(0, 0, 1),
      gloss: "conformal time (indexed η is the Minkowski metric)",
      si: "s",
    },
    "\\theta": { dim: ZERO, gloss: "polar angle", si: "rad" },
    "\\phi": { dim: ZERO, gloss: "azimuthal angle", si: "rad" },
    "\\varphi": { dim: ZERO, gloss: "azimuthal angle", si: "rad" },
    "\\Omega": { dim: ZERO, gloss: "solid angle / density parameter", si: "1" },
    "\\alpha": { dim: ZERO, gloss: "lapse function", si: "1" },
    v: { dim: dim(0, 1, -1), gloss: "velocity", si: "m s⁻¹" },
    "\\omega": { dim: dim(0, 0, -1), gloss: "angular frequency", si: "s⁻¹" },
    "\\nu": { dim: dim(0, 0, -1), gloss: "frequency", si: "s⁻¹" },
    "\\lambda": {
      dim: dim(0, 1, 0),
      gloss: "wavelength (registry choice; an affine parameter would differ)",
      si: "m",
    },
    k: { dim: dim(0, -1, 0), gloss: "wavenumber", si: "m⁻¹" },
    E: { dim: dim(1, 2, -2), gloss: "energy", si: "J" },
    p: { dim: dim(1, 1, -1), gloss: "momentum", si: "kg m s⁻¹" },
    L: { dim: dim(1, 2, -1), gloss: "angular momentum", si: "kg m² s⁻¹" },
    J: { dim: dim(1, 2, -1), gloss: "angular momentum", si: "kg m² s⁻¹" },
    a: {
      dim: dim(0, 1, 0),
      gloss:
        "Kerr spin parameter a = J/Mc (registry choice; a cosmological scale factor would read differently)",
      si: "m",
    },
    H: { dim: dim(0, 0, -1), gloss: "Hubble parameter", si: "s⁻¹" },
    T: { dim: dim(0, 0, 0, 1), gloss: "temperature", si: "K" },
    S: { dim: dim(1, 2, -2, -1), gloss: "entropy", si: "J K⁻¹" },
    A: { dim: dim(0, 2, 0), gloss: "area", si: "m²" },
    V: { dim: dim(0, 3, 0), gloss: "volume", si: "m³" },
    "\\rho": {
      dim: dim(1, -3, 0),
      gloss: "mass density (registry choice; an energy density differs by c²)",
      si: "kg m⁻³",
    },
    P: { dim: dim(1, -1, -2), gloss: "pressure", si: "Pa" },
    "\\Phi": { dim: dim(0, 2, -2), gloss: "Newtonian potential", si: "m² s⁻²" },
    "\\Psi": { dim: dim(0, 2, -2), gloss: "Bardeen potential", si: "m² s⁻²" },
    "\\kappa": {
      dim: dim(0, 1, -2),
      gloss: "surface gravity, read as an acceleration — the reading fixed by T_H = ħκ/2πk_Bc",
      si: "m s⁻²",
    },
    "\\Lambda": { dim: dim(0, -2, 0), gloss: "cosmological constant", si: "m⁻²" },
    "\\Sigma": { dim: dim(0, 2, 0), gloss: "Kerr metric function Σ = r² + a²cos²θ", si: "m²" },
    "\\Delta": { dim: dim(0, 2, 0), gloss: "Kerr metric function Δ = r² − 2Mr + a²", si: "m²" },
    "\\nabla": { dim: dim(0, -1, 0), gloss: "derivative operator", si: "m⁻¹" },
    "\\Box": { dim: dim(0, -2, 0), gloss: "d'Alembertian", si: "m⁻²" },
    K: { dim: dim(0, -1, 0), gloss: "extrinsic curvature", si: "m⁻¹" },
    // ADDED 2026-08-17 — PENDING CEO MERGE REVIEW.
    // Reading verified against "00. Conventions and Notation" §6, which writes
    // the volume form as ε_{abcd} = √(−g)[abcd]: bare g there is the metric
    // determinant. §3 raises and lowers with g_{ab}, and this registry already
    // reads the indexed metric as dimensionless (x⁰ = ct), so its determinant —
    // a product of four such components — is dimensionless too.
    g: {
      dim: ZERO,
      gloss: "metric determinant det g_{ab} (dimensionless, as the metric is with x⁰ = ct)",
      si: "1",
    },
  },
  exact: {
    k_B: { dim: dim(1, 2, -2, -1), gloss: "Boltzmann constant (kept explicit)", si: "J K⁻¹" },
    T_H: { dim: dim(0, 0, 0, 1), gloss: "Hawking temperature", si: "K" },
    r_s: { dim: dim(0, 1, 0), gloss: "Schwarzschild radius", si: "m" },
    "\\ell_P": { dim: dim(0, 1, 0), gloss: "Planck length", si: "m" },
    t_P: { dim: dim(0, 0, 1), gloss: "Planck time", si: "s" },
    m_P: { dim: dim(1, 0, 0), gloss: "Planck mass", si: "kg" },
    "M_\\odot": { dim: dim(1, 0, 0), gloss: "solar mass", si: "kg" },
    H_0: { dim: dim(0, 0, -1), gloss: "Hubble constant", si: "s⁻¹" },
    "\\rho_c": { dim: dim(1, -3, 0), gloss: "critical density", si: "kg m⁻³" },
    "\\Omega_m": NUM,
    "\\Omega_r": NUM,
    "\\Omega_k": NUM,
    "\\Omega_\\Lambda": NUM,
    // Registry decisions still open (deliberately absent, so they decline):
    //   \ell  — specific angular momentum L/m (m² s⁻¹) or a length?
    //   Q     — charge needs a fourth constant (1/4πε₀) wired into the solver.
  },
  indexed: {
    g: { dim: ZERO, gloss: "metric (dimensionless with x⁰ = ct)", si: "1" },
    "\\eta": { dim: ZERO, gloss: "Minkowski metric", si: "1" },
    "\\delta": { dim: ZERO, gloss: "Kronecker delta", si: "1" },
    "\\epsilon": { dim: ZERO, gloss: "Levi-Civita tensor", si: "1" },
    "\\varepsilon": { dim: ZERO, gloss: "Levi-Civita tensor", si: "1" },
    R: { dim: dim(0, -2, 0), gloss: "Riemann / Ricci curvature", si: "m⁻²" },
    G: { dim: dim(0, -2, 0), gloss: "Einstein tensor", si: "m⁻²" },
    T: { dim: dim(1, -1, -2), gloss: "stress–energy tensor (as an energy density)", si: "J m⁻³" },
    "\\Gamma": { dim: dim(0, -1, 0), gloss: "Christoffel symbol", si: "m⁻¹" },
    "\\partial": { dim: dim(0, -1, 0), gloss: "coordinate derivative", si: "m⁻¹" },
    "\\nabla": { dim: dim(0, -1, 0), gloss: "covariant derivative", si: "m⁻¹" },
    u: { dim: ZERO, gloss: "four-velocity, normalized g_{ab}u^au^b = −1", si: "1" },
    x: { dim: dim(0, 1, 0), gloss: "coordinate (x⁰ = ct)", si: "m" },
    p: { dim: dim(1, 1, -1), gloss: "four-momentum (p⁰ = E/c)", si: "kg m s⁻¹" },
    k: { dim: dim(0, -1, 0), gloss: "wave vector", si: "m⁻¹" },
    h: { dim: ZERO, gloss: "metric perturbation", si: "1" },
    K: { dim: dim(0, -1, 0), gloss: "extrinsic curvature", si: "m⁻¹" },
    "\\beta": { dim: ZERO, gloss: "shift vector", si: "1" },
    "\\Lambda": { dim: ZERO, gloss: "Lorentz transformation", si: "1" },
    // ADDED 2026-08-17 — PENDING CEO MERGE REVIEW.
    // Reading verified against "00. Conventions and Notation" §5, where ω_c is
    // the generic dual vector the Riemann tensor is defined to act on:
    // (∇_a∇_b − ∇_b∇_a)ω_c = R_{abc}{}^{d} ω_d. That definition is homogeneous
    // in ω, so it fixes no dimension for it; dimensionless is the same neutral
    // reading this registry already gives u, h and the shift vector. Bare ω is
    // untouched and stays an angular frequency.
    "\\omega": {
      dim: ZERO,
      gloss: "one-form / dual vector (indexed ω; bare ω is an angular frequency)",
      si: "1",
    },
  },
  differential: {
    s: { dim: dim(0, 1, 0), gloss: "line element", si: "m" },
    t: { dim: dim(0, 0, 1), gloss: "coordinate time", si: "s" },
    "\\tau": { dim: dim(0, 0, 1), gloss: "proper time", si: "s" },
    "\\eta": { dim: dim(0, 0, 1), gloss: "conformal time", si: "s" },
    r: { dim: dim(0, 1, 0), gloss: "radial coordinate", si: "m" },
    x: { dim: dim(0, 1, 0), gloss: "coordinate", si: "m" },
    y: { dim: dim(0, 1, 0), gloss: "coordinate", si: "m" },
    z: { dim: dim(0, 1, 0), gloss: "coordinate (a length under d, unlike bare z)", si: "m" },
    "\\theta": { dim: ZERO, gloss: "polar angle", si: "rad" },
    "\\phi": { dim: ZERO, gloss: "azimuthal angle", si: "rad" },
    "\\varphi": { dim: ZERO, gloss: "azimuthal angle", si: "rad" },
    "\\Omega": { dim: ZERO, gloss: "solid angle", si: "sr" },
    A: { dim: dim(0, 2, 0), gloss: "area element", si: "m²" },
    V: { dim: dim(0, 3, 0), gloss: "volume element", si: "m³" },
    "\\lambda": { dim: dim(0, 1, 0), gloss: "wavelength", si: "m" },
  },
}

const REGISTRIES: HubRegistry[] = [GR_REGISTRY]

export function findRegistryForSlug(slug: string): HubRegistry | null {
  return REGISTRIES.find((reg) => reg.slugPattern.test(slug)) ?? null
}

/**
 * Unique c^a G^b with the given dimension, as twelfths, or an explanation of
 * why none exists. Uniqueness: M fixes b, then L fixes a, and T/Θ/I must agree.
 */
function solveCG(d: Dim): { a: number; b: number } | string {
  if (d[3] !== 0) {
    return "temperature dimensions that do not balance — this hub keeps k_B explicit and only reinserts c and G"
  }
  if (d[4] !== 0) {
    return "charge dimensions that do not balance — electromagnetic restoration (1/4πε₀) is not wired in yet"
  }
  const b = -d[0]
  const a = d[1] - 3 * b
  if (-a - 2 * b !== d[2]) {
    return "a term admitting no c–G completion under the registry's readings of its symbols"
  }
  return { a, b }
}

// ---------------------------------------------------------------------------
// Target unit systems
// ---------------------------------------------------------------------------

/**
 * Where the translation lands. The three named systems share the same c/G
 * structure for gravitational content (they diverge only once electromagnetic
 * symbols enter, via the 4π/ε₀ conventions), but label units differently.
 * `geometrized` is orthogonal: it strips c and G (after verifying each term's
 * constants are consistent) instead of restoring them.
 */
export type UnitSystem = "hl" | "si" | "gaussian"
export type TargetSpec = { system: UnitSystem; geometrized: boolean }

export const DEFAULT_TARGET: TargetSpec = { system: "hl", geometrized: false }

export const SYSTEM_LABELS: Record<UnitSystem, string> = {
  hl: "Heaviside–Lorentz",
  si: "SI",
  gaussian: "Gaussian (CGS)",
}

// ---------------------------------------------------------------------------
// KaTeX parse-tree analysis
// ---------------------------------------------------------------------------

export type LegendEntry = { tex: string; gloss: string; unit: string }

export type TranslationResult =
  | {
      kind: "translated"
      originalTex: string
      restoredTex: string
      changed: boolean
      targetUnitTex: string
      legend: LegendEntry[]
    }
  | { kind: "no-anchor"; legend: LegendEntry[] }
  | { kind: "declined"; reasons: string[]; unknown: string[]; legend: LegendEntry[] }

type LegendRecord = { tex: string; gloss: string; si: string; dim: Dim }

type Ctx = {
  input: string
  reg: HubRegistry
  legend: Map<string, LegendRecord>
  unknown: Map<string, string>
  /** Set whenever the emitted equation differs from the source (insertion or strip). */
  mutated: boolean
  /** Geometrized target: verify consistency but strip c/G factors instead of inserting. */
  strip: boolean
  /**
   * Masked re-emission: suppress every insertion and every strip, so the emitters
   * reproduce the source equation and nothing else. What comes out is compared
   * against the source, which is how a mutating translation gets the same
   * verbatim backstop a no-op one has always had.
   */
  mask: boolean
}

/** Constants are inserted (or stripped) only in a live emission, never in a masked one. */
function emitsConstants(ctx: Ctx): boolean {
  return !ctx.mask
}

type FactorKind = "num" | "glue" | "sym" | "diff" | "frac" | "sqrt" | "group" | "func" | "rider"

type Factor = {
  kind: FactorKind
  dim: Dim
  emit: () => string
  /** Multi-term sums need \left(\right) when a constant lands beside them. */
  isBareSum?: boolean
  /**
   * A bare power of c or G, in twelfths. An inserted power of the same constant
   * folds into this one rather than being set beside it.
   */
  constant?: { tex: "c" | "G"; e12: number }
  frac?: { cmd: string; num: Factor[]; den: Factor[] }
  sqrt?: { bodyTerm: TermInfo | null }
}

type TermInfo = {
  sign: string
  factors: Factor[]
  /** Factor index of a source-level "/" separator, or -1. Factors after it divide. */
  slashIdx: number
  dim: Dim
  pureNumeral: boolean
  /** A literal 0 — dimension-transparent: it neither anchors nor takes constants. */
  isZero: boolean
  /**
   * A literal 1 standing alone. On a bare side of a relation this is a
   * convention marker ("… = 1"), not a quantity, so it takes no constants —
   * `G = c = 1` must not restore to `… = 1G`. Inside a sum the 1 is an ordinary
   * dimensionless term and still pins the sum to dimensionless.
   */
  isUnitLiteral: boolean
  src: string
}

/** Join TeX fragments, guarding control words from swallowing a following letter (`\Lambda`+`g` → `\Lambda g`). */
function joinTex(parts: string[]): string {
  let out = ""
  for (const part of parts) {
    if (part.length === 0) continue
    if (/\\[a-zA-Z]+$/.test(out) && /^[a-zA-Z]/.test(part)) out += " "
    out += part
  }
  return out
}

const SKIP_TYPES = new Set(["kern", "spacing", "mspace"])
const WRAPPER_TYPES = new Set(["styling", "sizing", "color", "mclass", "vcenter"])
const TRANSPARENT_ACCENTS = new Set([
  "\\bar",
  "\\hat",
  "\\tilde",
  "\\vec",
  "\\check",
  "\\breve",
  "\\overline",
])
const FUNC_OPS = new Set([
  "\\sin",
  "\\cos",
  "\\tan",
  "\\cot",
  "\\sec",
  "\\csc",
  "\\sinh",
  "\\cosh",
  "\\tanh",
  "\\coth",
  "\\arcsin",
  "\\arccos",
  "\\arctan",
  "\\ln",
  "\\log",
  "\\exp",
])
const SUPPORTED_RELS = new Set([
  "=",
  "\\approx",
  "\\simeq",
  "\\equiv",
  "\\neq",
  "\\ne",
  "<",
  ">",
  "\\le",
  "\\leq",
  "\\ge",
  "\\geq",
  "\\ll",
  "\\gg",
  "\\sim",
])
const LATIN_INDICES = new Set("abcdefghijk".split(""))
/**
 * CEO RULING 2026-08-17 — coordinate labels count as index tokens.
 *
 * A named coordinate standing in a subscript is an index like any other: it says
 * *which* component, not *how much* of anything, and carries no dimension. The
 * conventions page's §3 index table names only the abstract Latin, component
 * Greek and spatial i–k families, so this is an addition to it rather than a
 * reading of it — hence the ruling.
 *
 * The set is the one the corpus actually uses. Walking all 56 display equations
 * for subscript tokens the engine rejected turns up exactly four coordinates —
 * t (×3), r (×2), \theta (×2) and \phi (×3), every one of them on \partial —
 * alongside tokens that are emphatically *not* coordinates and are deliberately
 * left out: the identity subscripts B and H (k_B, T_H, \Omega_H), the Weyl index
 * 4 (\psi_4), and the mode and frequency labels \ell, m, \omega and \Omega. Only
 * \varphi is here without corpus evidence, because the registry already carries
 * it as \phi's alternate spelling in both `bare` and `differential`.
 *
 * Confined to subscript position on purpose. A superscript is also the power
 * position, and `classifySup` cannot see whose exponent it is reading: admitting
 * coordinates there turns `e^{i\phi}` into a lookup of a nonexistent indexed `e`,
 * which would replace a truthful dimensional decline with a false claim that the
 * dictionary is missing an entry.
 */
const COORDINATE_LABELS = new Set(["t", "r", "\\theta", "\\phi", "\\varphi"])
const GREEK_INDICES = new Set([
  "\\mu",
  "\\nu",
  "\\rho",
  "\\sigma",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\lambda",
  "\\kappa",
  "\\tau",
  "\\epsilon",
  "\\varepsilon",
  "\\iota",
])
const DIGIT_INDICES = new Set(["0", "1", "2", "3"])

function spanOf(node: unknown): [number, number] | null {
  let s = Infinity
  let e = -Infinity
  const visit = (n: any): void => {
    if (n == null || typeof n !== "object") return
    if (Array.isArray(n)) {
      for (const child of n) visit(child)
      return
    }
    if (n.loc && typeof n.loc.start === "number" && typeof n.loc.end === "number") {
      s = Math.min(s, n.loc.start)
      e = Math.max(e, n.loc.end)
    }
    for (const key of ["body", "numer", "denom", "base", "sup", "sub", "index"]) {
      if (key in n) visit(n[key])
    }
  }
  visit(node)
  return e >= s ? [s, e] : null
}

// A TeX control word absorbs the whitespace that terminates it, and KaTeX's loc
// spans include it — `\Sigma ` and `\Sigma\n  ` and `\Sigma` are the same symbol
// but three different slices, which showed up as three legend rows and as raw
// newlines inside decline sentences. Every slice is trimmed at the source.
function srcOf(node: unknown, ctx: Ctx): string {
  const span = spanOf(node)
  if (!span) throw new Unsupported("a fragment whose source position could not be recovered")
  return ctx.input.slice(span[0], span[1]).trim()
}

function srcOfNodes(nodes: unknown[], ctx: Ctx): string {
  const span = spanOf(nodes)
  if (!span) return ""
  return ctx.input.slice(span[0], span[1]).trim()
}

function unwrap(node: any): any {
  let cur = node
  for (;;) {
    if (cur == null) return cur
    if (WRAPPER_TYPES.has(cur.type)) {
      const body = Array.isArray(cur.body) ? cur.body : [cur.body]
      const meaningful = body.filter((n: any) => n && !SKIP_TYPES.has(n.type))
      if (meaningful.length === 1) {
        cur = meaningful[0]
        continue
      }
      return { type: "ordgroup", body: meaningful, loc: cur.loc }
    }
    if (cur.type === "font") {
      cur = cur.body
      continue
    }
    return cur
  }
}

const FRAC_CMDS = new Set(["\\frac", "\\tfrac", "\\dfrac", "\\cfrac"])

/** The innermost `styling` wrapper on the way down to `unwrap(node)`, if any. */
function stylingWrapperOf(node: any): any {
  let cur = node
  let styling: any = null
  for (;;) {
    if (cur == null) return styling
    if (WRAPPER_TYPES.has(cur.type)) {
      if (cur.type === "styling") styling = cur
      const body = (Array.isArray(cur.body) ? cur.body : [cur.body]).filter(
        (n: any) => n && !SKIP_TYPES.has(n.type),
      )
      if (body.length !== 1) return styling
      cur = body[0]
      continue
    }
    if (cur.type === "font") {
      cur = cur.body
      continue
    }
    return styling
  }
}

/**
 * The fraction command as it was written. genfrac nodes carry no span of their
 * own, and since KaTeX 0.16.22 they carry no `size` field either: \tfrac,
 * \dfrac and \cfrac now parse as a `styling` wrapper around a plain genfrac,
 * and `unwrap` discards wrappers. So the command is read from the source text
 * immediately before the numerator, with the wrapper's style as the fallback
 * for fractions whose numerator has no recoverable position.
 */
function fracCmdOf(rawNode: any, genfrac: any, ctx: Ctx): string {
  const span = spanOf(genfrac.numer)
  if (span) {
    const written = /\\([a-zA-Z]+)\s*$/.exec(ctx.input.slice(0, span[0]))
    if (written && FRAC_CMDS.has(`\\${written[1]}`)) return `\\${written[1]}`
  }
  if (genfrac.continued === true) return "\\cfrac"
  const style = stylingWrapperOf(rawNode)?.style
  if (style === "text") return "\\tfrac"
  if (style === "display") return "\\dfrac"
  return "\\frac"
}

function nodeListOf(node: any): any[] {
  if (node == null) return []
  const u = unwrap(node)
  if (u == null) return []
  if (u.type === "ordgroup") return u.body
  return [u]
}

/**
 * Delimiters KaTeX hands over as ordinary symbols rather than open/close atoms,
 * so they reach symbol resolution and would otherwise be reported as unknown
 * dictionary entries.
 */
const BARE_DELIMITERS = new Set(["|", "\\|", "\\vert", "\\Vert"])

/** Every delimiter pair the engine can group, keyed by the opener's atom text. */
const CLOSE_FOR: Record<string, string> = {
  "(": ")",
  "[": "]",
  "\\{": "\\}",
  "\\lbrack": "\\rbrack",
  "\\lbrace": "\\rbrace",
  "\\langle": "\\rangle",
  "\\lVert": "\\rVert",
  "\\lvert": "\\rvert",
  "\\lceil": "\\rceil",
  "\\lfloor": "\\rfloor",
  "\\lgroup": "\\rgroup",
  "\\lmoustache": "\\rmoustache",
}

/** Group flat ( … ) / [ … ] runs into synthetic nodes so sums inside plain parens don't split terms. */
function groupDelims(nodes: any[]): any[] {
  const out: any[] = []
  const stack: any[][] = [out]
  const openers: string[] = []

  /** Pop the open group matching `closeAtom` and return the finished synthetic node. */
  const closeGroup = (closeAtom: any): any => {
    if (openers.length === 0 || openers[openers.length - 1] !== closeAtom.text) {
      // Saying "unbalanced delimiters" is a claim about the reader's equation,
      // and it is usually false: a Dirac ket |0\rangle is balanced, but its
      // opener is a bare | that KaTeX hands over as an ordinary symbol rather
      // than an open-family atom, so the engine has nothing to pair. Report
      // what the engine actually found instead.
      throw new Unsupported(
        openers.length === 0
          ? `the closing delimiter “${closeAtom.text}” with no opener the engine recognizes`
          : `the closing delimiter “${closeAtom.text}” where “${openers[openers.length - 1]}” was open`,
      )
    }
    openers.pop()
    stack.pop()
    const parent = stack[stack.length - 1]
    const group = parent[parent.length - 1]
    if (group.loc && closeAtom.loc) {
      group.loc = { start: group.loc.start, end: closeAtom.loc.end }
    }
    return group
  }

  for (const raw of nodes) {
    const n = raw
    const fam = n?.family
    if (n?.type === "atom" && fam === "open" && CLOSE_FOR[n.text]) {
      const group: any = {
        type: "__group",
        body: [] as any[],
        open: n.text,
        close: CLOSE_FOR[n.text],
        loc: n.loc,
      }
      stack[stack.length - 1].push(group)
      stack.push(group.body)
      openers.push(CLOSE_FOR[n.text])
      continue
    }
    if (n?.type === "atom" && fam === "close") {
      closeGroup(n)
      continue
    }
    // A closing delimiter that carries a script is swallowed as the *base* of a
    // supsub — `(1+v)^2` puts `)` under the supsub — so the close atom never
    // reaches this level on its own. Close the group here and re-attach the
    // script to the finished group, or the opener would sit on the stack for
    // ever and the row would be reported as unbalanced.
    if (n?.type === "supsub") {
      const scriptedClose = unwrap(n.base)
      if (scriptedClose?.type === "atom" && scriptedClose.family === "close") {
        const group = closeGroup(scriptedClose)
        const parent = stack[stack.length - 1]
        parent[parent.length - 1] = { ...n, base: group }
        continue
      }
    }
    stack[stack.length - 1].push(n)
  }
  if (openers.length > 0) throw new Unsupported("unbalanced delimiters")
  return out
}

function textOf(node: any): string | null {
  const u = unwrap(node)
  if (u && (u.type === "mathord" || u.type === "textord")) return u.text
  return null
}

function isIndexToken(node: any, coordinates = false): boolean {
  const u = unwrap(node)
  if (!u) return false
  if (u.type === "atom" && (u.family === "open" || u.family === "close" || u.family === "punct")) {
    return u.family !== "punct" // commas in indices (derivative notation) are handled as unsupported elsewhere
  }
  if (SKIP_TYPES.has(u.type)) return true
  const text = textOf(u)
  if (text == null) return false
  if (LATIN_INDICES.has(text) || GREEK_INDICES.has(text) || DIGIT_INDICES.has(text)) return true
  return coordinates && COORDINATE_LABELS.has(text)
}

/**
 * ADDED 2026-08-17 — PENDING CEO MERGE REVIEW.
 * Labels a floating `{}` rider may carry beyond the index letters. `s` is the
 * spin weight in the dominant Teukolsky notation ({}_sR, {}_sS, {}_sA_{\ell m});
 * it is a label on the symbol, not a factor, and carries no dimension. It is
 * deliberately confined to the rider path — `s` stays out of LATIN_INDICES and
 * out of the dictionary, so bare s remains the registry's arc length and a
 * subscript s (r_s) keeps resolving as part of a symbol's identity.
 */
const RIDER_LABELS = new Set(["s"])

function allRiderTokens(nodes: any[]): boolean {
  const meaningful = nodes.filter((n) => {
    const u = unwrap(n)
    return u && !SKIP_TYPES.has(u.type)
  })
  if (meaningful.length === 0) return false
  return meaningful.every((n) => isIndexToken(n) || RIDER_LABELS.has(textOf(n) ?? ""))
}

/**
 * `coordinates` admits the named coordinate labels (CEO ruling 2026-08-17). It is
 * passed only from subscript position; the superscript caller is also the power
 * caller and must keep reading `\phi` in `e^{i\phi}` as part of an exponent.
 */
function allIndexTokens(nodes: any[], coordinates = false): boolean {
  const meaningful = nodes.filter((n) => {
    const u = unwrap(n)
    return u && !SKIP_TYPES.has(u.type)
  })
  if (meaningful.length === 0) return false
  if (
    meaningful.some((n) => {
      const u = unwrap(n)
      return u.type === "atom" && u.family === "punct"
    })
  ) {
    throw new Unsupported("comma/semicolon derivative indices, which are not supported yet")
  }
  return meaningful.every((n) => isIndexToken(n, coordinates))
}

/** Parse a superscript as a rational power, or classify it. */
function classifySup(sup: any): { p: number; q: number } | "index" | "prime" | "expr" {
  const nodes = nodeListOf(sup).filter((n) => !SKIP_TYPES.has(n.type))
  if (nodes.length === 0) return "expr"
  if (nodes.some((n) => textOf(n) === "\\prime")) return "prime"
  let sign = 1
  let rest = nodes
  const first = unwrap(nodes[0])
  if (first?.type === "atom" && first.family === "bin" && first.text === "-") {
    sign = -1
    rest = nodes.slice(1)
  }
  if (rest.length === 1) {
    const u = unwrap(rest[0])
    if (u?.type === "genfrac") {
      const p = intOf(nodeListOf(u.numer))
      const q = intOf(nodeListOf(u.denom))
      if (p != null && q != null && q !== 0) return { p: sign * p, q }
    }
  }
  // Unsigned all-digit superscripts of the component-index shape are indices,
  // not powers: T^{00}, u^0, x^0. Only a single digit 1–3 stays a power (r²).
  if (sign === 1) {
    const digitStr = digitsOf(rest)
    if (digitStr != null && (digitStr === "0" || /^[0-3]{2,}$/.test(digitStr))) {
      return "index"
    }
  }
  const whole = intOf(rest)
  if (whole != null) return { p: sign * whole, q: 1 }
  try {
    if (allIndexTokens(nodes)) return "index"
  } catch {
    // fall through to "expr"
  }
  return "expr"
}

function digitsOf(nodes: any[]): string | null {
  let digits = ""
  for (const n of nodes) {
    const text = textOf(n)
    if (text == null || !/^[0-9]$/.test(text)) return null
    digits += text
  }
  return digits.length > 0 ? digits : null
}

function intOf(nodes: any[]): number | null {
  const digits = digitsOf(nodes)
  return digits == null ? null : Number(digits)
}

function subKeyText(sub: any, ctx: Ctx): string {
  return srcOf(sub, ctx).replace(/[{}\s]/g, "")
}

function resolveSymbol(
  baseText: string,
  displayTex: string,
  ctx: Ctx,
  opts: { sub?: any; indices?: boolean; differential?: boolean } = {},
): Dim {
  const reg = ctx.reg
  let entry: RegEntry | undefined
  let key = baseText
  if (opts.sub != null) {
    // Order is load-bearing: a subscript that spells an identity (r_s, T_H, k_B)
    // is resolved as that identity before the subscript is ever read as an index.
    const exactKey = `${baseText}_${subKeyText(opts.sub, ctx)}`
    entry = reg.exact[exactKey]
    key = exactKey
    if (!entry && allIndexTokens(nodeListOf(opts.sub), true)) {
      entry = reg.indexed[baseText]
      key = `${baseText} (indexed)`
    }
  } else if (opts.indices) {
    entry = reg.indexed[baseText]
    key = `${baseText} (indexed)`
  } else {
    if (opts.differential) {
      entry = reg.differential[baseText]
      key = `d${baseText}`
    }
    if (!entry) {
      entry = reg.bare[baseText]
      key = opts.differential ? `d${baseText}` : baseText
    }
  }
  if (!entry) {
    ctx.unknown.set(key, displayTex)
    return ZERO
  }
  // Key the legend by what the reader would see, so the same symbol reached
  // through different routes (bare r and the r inside dr) shows one row.
  const legendKey = `${displayTex}|${entry.gloss}`
  if (!ctx.legend.has(legendKey)) {
    ctx.legend.set(legendKey, { tex: displayTex, gloss: entry.gloss, si: entry.si, dim: entry.dim })
  }
  return entry.dim
}

// ---------------------------------------------------------------------------
// Products and sums
// ---------------------------------------------------------------------------

function isPlusMinus(node: any): "+" | "-" | null {
  if (node?.type === "atom" && node.family === "bin" && (node.text === "+" || node.text === "-")) {
    return node.text
  }
  return null
}

type SumMode = { anchor: "internal" } | { anchor: "forced"; target: Dim } | { anchor: "none" }

type SumInfo = {
  terms: TermInfo[]
  ops: string[]
  /** Dimension of the sum after internal/forced restoration (target), or of its single term. */
  dim: Dim
  emit: () => string
  multiTerm: boolean
}

/** KaTeX's aligned handler injects an empty ordgroup after every `&` — a spacing shim, not content. */
function isEmptyOrdgroup(n: any): boolean {
  return n?.type === "ordgroup" && Array.isArray(n.body) && n.body.length === 0
}

/** Fold a unary sign into the preceding binary operator: `a - -b` reads `a + b`. */
function foldedOp(op: string, sign: string): string {
  if (sign !== "-") return op
  return op === "-" ? "+" : "-"
}

/**
 * The dimension a sum's terms must share, chosen from its own content: a
 * non-zero pure numeral pins it to dimensionless; otherwise the first
 * non-zero term anchors. Literal zeros carry any dimension and never anchor.
 */
function sumAnchor(terms: TermInfo[]): Dim | null {
  const live = terms.filter((t) => !t.isZero)
  if (live.length === 0) return null
  return live.some((t) => t.pureNumeral) ? ZERO : live[0].dim
}

function termInsertion(t: TermInfo, target: Dim, ctx: Ctx): { a: number; b: number } | null {
  if (t.isZero) return null
  const need = dimSub(target, t.dim)
  if (dimIsZero(need)) return null
  // A term that is nothing but powers of c and G is a constant, not a quantity.
  // Restoring it would rewrite one constant into another — `G = c = 1` came out
  // as `G = G = 1`, which states something false about c. A relation whose sides
  // are the constants themselves declares the unit convention; it carries no
  // physical content for the restoration to complete, so it declines.
  if (isPureConstant(t)) {
    throw new Unsupported(
      "a relation between the constants themselves — a declaration of the unit convention rather than a physical relation to restore",
    )
  }
  const solved = solveCG(need)
  if (typeof solved === "string") {
    throw new Unsupported(`${solved} (term “${termQuote(t, ctx)}”)`)
  }
  // Geometrized target: consistency is verified (above), but no constants are
  // inserted — the ones present get stripped at emission instead.
  if (ctx.strip) return null
  ctx.mutated = true
  return solved
}

/**
 * The term as it reads, for quoting inside a decline sentence. Slicing the
 * source over a term containing loc-less nodes drops their heads — a \frac term
 * quoted itself as `{M}{r}\mathrm{d}r` — so the quote is rebuilt through the
 * emit path, with insertions masked so it reads as the reader wrote it.
 */
function termQuote(t: TermInfo, ctx: Ctx): string {
  const previous = ctx.mask
  ctx.mask = true
  try {
    return emitTerm(t)
  } catch {
    return t.src
  } finally {
    ctx.mask = previous
  }
}

/** A term built only from powers of c and G — a constant, with nothing to restore. */
function isPureConstant(t: TermInfo): boolean {
  const meaningful = t.factors.filter((f) => f.kind !== "glue")
  return meaningful.length > 0 && meaningful.every((f) => f.constant != null)
}

function emitSum(
  terms: TermInfo[],
  ops: string[],
  insertions: ({ a: number; b: number } | null)[],
  ctx: Ctx,
): string {
  return terms
    .map((t, idx) => {
      const ins = emitsConstants(ctx) ? insertions[idx] : null
      const body = ins ? emitTermWith(t, ins.a, ins.b) : emitTerm(t)
      const lead = idx === 0 ? (t.sign === "-" ? "-" : "") : ` ${foldedOp(ops[idx - 1], t.sign)} `
      return lead + body
    })
    .join("")
}

function parseSum(nodes: any[], ctx: Ctx, mode: SumMode): SumInfo {
  const grouped = groupDelims(nodes)
  const termNodeLists: any[][] = []
  const ops: string[] = []
  const signs: string[] = []
  let current: any[] = []
  let pendingSign = ""
  for (const n of grouped) {
    if (isEmptyOrdgroup(n)) continue
    if (current.length === 0 && n != null && SKIP_TYPES.has(n.type)) continue
    const pm = isPlusMinus(n)
    if (pm != null && current.length === 0) {
      if (pm === "-") pendingSign = pendingSign === "-" ? "+" : "-"
      continue
    }
    if (pm != null) {
      termNodeLists.push(current)
      signs.push(pendingSign)
      ops.push(pm)
      current = []
      pendingSign = ""
      continue
    }
    if (n?.type === "atom" && n.family === "bin" && (n.text === "\\pm" || n.text === "\\mp")) {
      throw new Unsupported("a \\pm or \\mp branch, which is not supported")
    }
    current.push(n)
  }
  if (current.length === 0 && termNodeLists.length === 0) {
    throw new Unsupported("an empty expression")
  }
  if (current.length === 0) throw new Unsupported("an expression that ends in an operator")
  termNodeLists.push(current)
  signs.push(pendingSign)

  const terms = termNodeLists.map((list, idx) => analyzeTerm(list, signs[idx], ctx))

  const multiTerm = terms.length > 1
  let insertions: ({ a: number; b: number } | null)[] = terms.map(() => null)
  let target: Dim
  if (mode.anchor === "forced" || (multiTerm && mode.anchor === "internal")) {
    target = mode.anchor === "forced" ? mode.target : (sumAnchor(terms) ?? ZERO)
    insertions = terms.map((t) => termInsertion(t, target, ctx))
  } else {
    target = terms[0].dim
  }

  const emit = () => emitSum(terms, ops, insertions, ctx)

  return { terms, ops, dim: target, emit, multiTerm }
}

function analyzeTerm(nodes: any[], sign: string, ctx: Ctx): TermInfo {
  const factors: Factor[] = []
  let slashIdx = -1
  let i = 0
  const push = (f: Factor) => factors.push(f)

  while (i < nodes.length) {
    const raw = nodes[i]
    const n = unwrap(raw)
    if (n == null) {
      i += 1
      continue
    }
    if (SKIP_TYPES.has(n.type)) {
      const text = safeSrc(raw, ctx)
      push({ kind: "glue", dim: ZERO, emit: () => text })
      i += 1
      continue
    }
    if (n.type === "atom" && n.family === "bin" && (n.text === "\\cdot" || n.text === "\\times")) {
      const text = safeSrc(raw, ctx)
      push({ kind: "glue", dim: ZERO, emit: () => text })
      i += 1
      continue
    }
    if (n.type === "textord" && n.text === "/") {
      if (slashIdx >= 0) throw new Unsupported("multiple “/” divisions in one term")
      slashIdx = factors.length
      // The separator is a real factor so plain re-emission keeps the division.
      push({ kind: "glue", dim: ZERO, emit: () => "/" })
      i += 1
      continue
    }
    if (n.type === "atom" && n.family === "punct") {
      throw new Unsupported("lists or multiple statements — select a single equation")
    }

    // Digit runs → one numeral factor.
    const digit = textOf(n)
    if (digit != null && /^[0-9.]$/.test(digit)) {
      let text = digit
      let end = i + 1
      while (end < nodes.length) {
        const t = textOf(unwrap(nodes[end]))
        if (t != null && /^[0-9.]$/.test(t)) {
          text += t
          end += 1
        } else break
      }
      const frozen = text
      push({ kind: "num", dim: ZERO, emit: () => frozen })
      i = end
      continue
    }

    // d / ∂ prefixes.
    const prefix = derivativePrefix(n)
    if (prefix) {
      const operand = i + 1 < nodes.length ? nodes[i + 1] : null
      if (operand == null) {
        // Not always an operator-form derivative: a trailing `d` in an index
        // list (\epsilon_{abcd} = \sqrt{-g}\;[abcd]) lands here too, and telling
        // that reader to "select the applied form" explains nothing.
        throw new Unsupported(
          prefix === "d"
            ? "a trailing “d” with nothing after it, which the engine reads as a derivative rather than as an index letter"
            : "an operator-form derivative (a bare ∂) — select the applied form instead",
        )
      }
      const merged = analyzeDifferential(prefix, raw, operand, ctx)
      push(merged)
      i += 2
      continue
    }

    // Function heads consume the rest of the product up to the next function head.
    if (isFuncHead(n)) {
      let end = i + 1
      while (end < nodes.length && !isFuncHead(unwrap(nodes[end]))) end += 1
      const argNodes = nodes.slice(i + 1, end)
      if (argNodes.length === 0) throw new Unsupported("a function with no argument")
      push(analyzeFunction(raw, argNodes, ctx))
      i = end
      continue
    }

    push(analyzeFactor(raw, ctx))
    i += 1
  }

  const numDim = factors.slice(0, slashIdx < 0 ? factors.length : slashIdx)
  const denDim = slashIdx < 0 ? [] : factors.slice(slashIdx + 1)
  let total = ZERO
  for (const f of numDim) total = dimAdd(total, f.dim)
  for (const f of denDim) total = dimSub(total, f.dim)

  const pureNumeral =
    factors.some((f) => f.kind === "num") &&
    factors.every((f) => f.kind === "num" || f.kind === "glue")

  const numeralsAre = (value: number) =>
    pureNumeral &&
    slashIdx < 0 &&
    factors
      .filter((f) => f.kind === "num")
      .every((f) => {
        const parsed = Number.parseFloat(f.emit())
        return Number.isFinite(parsed) && parsed === value
      })

  return {
    sign,
    factors,
    slashIdx,
    dim: total,
    pureNumeral,
    isZero: numeralsAre(0),
    isUnitLiteral: sign !== "-" && numeralsAre(1),
    src: srcOfNodes(nodes, ctx),
  }
}

function safeSrc(node: any, ctx: Ctx): string {
  try {
    return srcOf(node, ctx)
  } catch {
    return ""
  }
}

/**
 * Source text of a node, rebuilding the font wrappers that carry no span of
 * their own. `spanOf` descends past a font node to the letter inside it, so
 * slicing `\mathrm{d}` returns `d` and the wrapper is lost; analyzeFactor and
 * baseTexOf already reconstruct, and differentials now do too.
 */
function wrappedTexOf(raw: any, ctx: Ctx): string {
  const peeled = peelStyles(raw)
  if (peeled?.type === "font") return `\\${peeled.font}{${wrappedTexOf(peeled.body, ctx)}}`
  if (peeled?.type === "supsub" && peeled.sub == null && peeled.sup != null) {
    const base = peelStyles(peeled.base)
    if (base?.type === "font") {
      return `${wrappedTexOf(peeled.base, ctx)}^{${scriptSrc(peeled.sup, ctx)}}`
    }
  }
  return safeSrc(raw, ctx)
}

function derivativePrefix(n: any): "d" | "partial" | null {
  if (n?.type === "mathord" && n.text === "d") return "d"
  if (n?.type === "mathord" && n.text === "\\partial") return "partial"
  if (n?.type === "supsub") {
    const base = unwrap(n.base)
    // d²x / ∂²φ — the power is derivative-order bookkeeping, not a dimension.
    if (base?.type === "mathord" && (base.text === "d" || base.text === "\\partial")) {
      const sup = classifySup(n.sup)
      if (n.sub == null && typeof sup === "object") {
        return base.text === "d" ? "d" : "partial"
      }
    }
  }
  return null
}

function analyzeDifferential(
  prefix: "d" | "partial",
  prefixNode: any,
  operandNode: any,
  ctx: Ctx,
): Factor {
  const opU = unwrap(operandNode)
  // Reconstructed, never sliced: a font node carries no span of its own, so
  // slicing `\mathrm{d}` yields the bare `d` inside it and the upright head is
  // silently deleted — `-c^2\mathrm{d}t^2` shipped as `-c^{2}dt^2`.
  const wholeSrc = () => joinTex([wrappedTexOf(prefixNode, ctx), wrappedTexOf(operandNode, ctx)])
  const prefixHasOrder = unwrap(prefixNode)?.type === "supsub"

  let operandDim: Dim
  if (opU?.type === "supsub") {
    const base = unwrap(opU.base)
    const baseText = textOf(base)
    if (baseText == null) throw new Unsupported(`an unsupported differential “${wholeSrc()}”`)
    const sup = opU.sup != null ? classifySup(opU.sup) : null
    if (opU.sub != null) {
      operandDim = resolveSymbol(baseText, srcOf(opU, ctx), ctx, {
        sub: opU.sub,
        differential: prefix === "d",
      })
      // dx_1^2 = (dx_1)² — the numeric power scales the differential too.
      if (typeof sup === "object" && sup != null && !prefixHasOrder) {
        operandDim = dimScale(operandDim, sup.p, sup.q)
      }
    } else if (sup === "index") {
      operandDim = resolveSymbol(baseText, srcOf(opU, ctx), ctx, {
        indices: true,
        differential: prefix === "d",
      })
    } else if (typeof sup === "object" && sup != null) {
      // dt² = (dt)²; but under an ordered prefix (d²x) the power stays bookkeeping.
      const baseDim = resolveSymbol(baseText, srcOf(base, ctx), ctx, {
        differential: prefix === "d",
      })
      operandDim = prefixHasOrder ? baseDim : dimScale(baseDim, sup.p, sup.q)
    } else {
      throw new Unsupported(`an unsupported differential “${wholeSrc()}”`)
    }
  } else {
    const baseText = textOf(opU)
    if (baseText != null) {
      operandDim = resolveSymbol(baseText, srcOf(opU, ctx), ctx, {
        differential: prefix === "d",
      })
    } else if (opU?.type === "leftright" || opU?.type === "__group") {
      operandDim = analyzeFactor(operandNode, ctx).dim
    } else {
      throw new Unsupported(`an unsupported differential “${wholeSrc()}”`)
    }
  }

  const text = wholeSrc()
  return { kind: "diff", dim: operandDim, emit: () => text }
}

function isFuncHead(n: any): boolean {
  if (n?.type === "op") {
    if (n.name && FUNC_OPS.has(n.name)) return true
    return false
  }
  if (n?.type === "supsub") {
    const base = unwrap(n.base)
    return base?.type === "op" && base.name && FUNC_OPS.has(base.name)
  }
  return false
}

function analyzeFunction(headNode: any, argNodes: any[], ctx: Ctx): Factor {
  // KaTeX op nodes carry no source location, so the head is reconstructed
  // from the node's own name — never sliced from the source.
  const head = unwrap(headNode)
  const opNode = head?.type === "supsub" ? unwrap(head.base) : head
  const opName: string = opNode?.name ?? ""
  if (!opName) throw new Unsupported("a function the engine cannot name")
  let headTex = opName
  if (head?.type === "supsub") {
    const sup = classifySup(head.sup)
    if (head.sub != null || typeof sup !== "object") {
      throw new Unsupported("a decorated function the engine cannot read")
    }
    headTex += `^{${scriptSrc(head.sup, ctx)}}`
  }
  const argSum = parseSum(argNodes, ctx, { anchor: "forced", target: ZERO })
  const emit = () => {
    const rebuilt = argSum.emit()
    if (argSum.multiTerm) return joinTex([headTex, `\\left(${rebuilt}\\right)`])
    return joinTex([headTex, rebuilt])
  }
  return { kind: "func", dim: ZERO, emit }
}

/**
 * The content of a braced argument (an accent's or \overline's), analyzed
 * without the ordgroup emitter's own braces — going through analyzeFactor
 * doubled them, so `\overline{r}` came back as `\overline{{r}}`.
 */
function bracedArg(node: any, ctx: Ctx): { dim: Dim; emit: () => string } {
  const inner = parseSum(nodeListOf(node), ctx, { anchor: "internal" })
  return { dim: inner.dim, emit: () => inner.emit() }
}

/** Peel style wrappers only (not font) — font must survive into the emission. */
function peelStyles(node: any): any {
  let cur = node
  for (;;) {
    if (cur != null && WRAPPER_TYPES.has(cur.type)) {
      const body = (Array.isArray(cur.body) ? cur.body : [cur.body]).filter(
        (x: any) => x && !SKIP_TYPES.has(x.type),
      )
      if (body.length === 1) {
        cur = body[0]
        continue
      }
    }
    return cur
  }
}

function analyzeFactor(rawNode: any, ctx: Ctx): Factor {
  const peeled = peelStyles(rawNode)
  if (peeled?.type === "font") {
    // \mathbf{p}, \mathrm{d}… — read through the wrapper, but keep it in the output.
    const inner = analyzeFactor(peeled.body, ctx)
    const fontCmd = `\\${peeled.font}`
    return { kind: inner.kind, dim: inner.dim, emit: () => `${fontCmd}{${inner.emit()}}` }
  }

  const n = unwrap(rawNode)
  if (n == null) throw new Unsupported("an empty construct")

  switch (n.type) {
    case "mathord":
    case "textord": {
      const text = n.text as string
      // A bare vertical bar is a delimiter, not a symbol: it has no dimension to
      // look up, and which of a pair opens and which closes is not decidable
      // from the token alone (|v| versus \langle a|b \rangle). Saying so is a
      // truthful decline; calling it a dictionary miss is a category error.
      if (BARE_DELIMITERS.has(text)) {
        throw new Unsupported(
          `the delimiter “${text}”, which the engine cannot pair with its partner`,
        )
      }
      if (text === "\\pi" || text === "i" || text === "e" || text === "\\infty") {
        const src = srcOf(n, ctx)
        return { kind: "num", dim: ZERO, emit: () => src }
      }
      const src = srcOf(n, ctx)
      const d = resolveSymbol(text, src, ctx, {})
      if (text === "c" || text === "G") {
        // Geometrized target: the constant is set to 1 and vanishes.
        return {
          kind: "sym",
          dim: d,
          constant: { tex: text, e12: D12 },
          emit: () => {
            if (!ctx.strip || !emitsConstants(ctx)) return src
            ctx.mutated = true
            return ""
          },
        }
      }
      return { kind: "sym", dim: d, emit: () => src }
    }
    case "supsub":
      return analyzeSupsub(n, ctx)
    case "genfrac": {
      if (n.hasBarLine === false) throw new Unsupported("a binomial-style construct")
      const cmd = fracCmdOf(rawNode, n, ctx)
      const numSum = parseSum(nodeListOf(n.numer), ctx, { anchor: "internal" })
      const denSum = parseSum(nodeListOf(n.denom), ctx, { anchor: "internal" })
      const numFactors = sumAsFactorList(numSum)
      const denFactors = sumAsFactorList(denSum)
      const d = dimSub(numSum.dim, denSum.dim)
      const frac = { cmd, num: numFactors, den: denFactors }
      const emit = () => {
        // Stripped constants may empty a side: \frac{c^4}{4GM} → \frac{1}{4M},
        // \frac{v}{c} → v.
        const numTex = joinTex(frac.num.map((f) => f.emit())) || "1"
        const denTex = joinTex(frac.den.map((f) => f.emit()))
        if (denTex === "") return numTex
        return `${cmd}{${numTex}}{${denTex}}`
      }
      return { kind: "frac", dim: d, emit, frac }
    }
    case "sqrt": {
      const inner = parseSum(nodeListOf(n.body), ctx, { anchor: "internal" })
      let q = 2
      if (n.index != null) {
        const idx = intOf(nodeListOf(n.index))
        if (idx == null || idx === 0) throw new Unsupported("a root with a non-numeric index")
        q = idx
      }
      const d = dimScale(inner.dim, 1, q)
      const bodyTerm = !inner.multiTerm && q === 2 ? inner.terms[0] : null
      const emit = () => {
        const body = inner.emit()
        return q === 2 ? `\\sqrt{${body}}` : `\\sqrt[${q}]{${body}}`
      }
      return { kind: "sqrt", dim: d, emit, sqrt: { bodyTerm } }
    }
    case "leftright":
    case "__group": {
      const body = n.body
      if (containsRel(body)) throw new Unsupported("a relation nested inside a group")
      const inner = parseSum(body, ctx, { anchor: "internal" })
      const open = n.type === "leftright" ? `\\left${n.left}` : n.open
      const close = n.type === "leftright" ? `\\right${n.right}` : n.close
      // Control-word delimiters (\langle, \lbrace, \lVert …) would otherwise
      // swallow the following letter: `\langle`+`v` must not become `\langlev`.
      const emit = () => joinTex([open, inner.emit(), close])
      return { kind: "group", dim: inner.dim, emit, isBareSum: false }
    }
    case "accent": {
      // Accent nodes carry no source location — reconstruct label{base}.
      const label = n.label as string
      const base = unwrap(n.base)
      if (label === "\\dot" || label === "\\ddot") {
        const baseText = textOf(base)
        if (baseText == null) {
          throw new Unsupported("a time derivative of a compound expression")
        }
        const baseSrc = srcOf(base, ctx)
        const display = `${label}{${baseSrc}}`
        const baseDim = resolveSymbol(baseText, display, ctx, {})
        const order = label === "\\ddot" ? 2 : 1
        const d = dimSub(baseDim, dim(0, 0, order))
        return { kind: "sym", dim: d, emit: () => display }
      }
      if (TRANSPARENT_ACCENTS.has(label)) {
        const inner = bracedArg(n.base, ctx)
        return { kind: "sym", dim: inner.dim, emit: () => `${label}{${inner.emit()}}` }
      }
      throw new Unsupported(`the unsupported accent “${label}”`)
    }
    case "overline": {
      const inner = bracedArg(n.body, ctx)
      return { kind: "sym", dim: inner.dim, emit: () => `\\overline{${inner.emit()}}` }
    }
    case "op": {
      const name = n.name ?? ""
      if (FUNC_OPS.has(name)) throw new Unsupported("a function with no argument")
      throw new Unsupported(
        `“${name || srcOf(n, ctx)}” — integrals, sums, and limits change dimensions with their measure and are not supported yet`,
      )
    }
    case "operatorname":
      throw new Unsupported("an \\operatorname construct, which is not supported")
    case "text":
      throw new Unsupported("\\text content inside the equation")
    case "ordgroup": {
      const inner = parseSum(n.body, ctx, { anchor: "internal" })
      const emit = () => `{${inner.emit()}}`
      return { kind: "group", dim: inner.dim, emit, isBareSum: inner.multiTerm }
    }
    case "atom":
      throw new Unsupported(`the symbol “${n.text}” in this position`)
    default:
      throw new Unsupported(`the construct “${n.type}”, which is not supported yet`)
  }
}

/** Source of a sub/superscript with its outer brace pair (if any) removed. */
function scriptSrc(node: any, ctx: Ctx): string {
  const src = srcOf(node, ctx).trim()
  if (src.startsWith("{") && src.endsWith("}")) {
    let depth = 0
    for (let idx = 0; idx < src.length; idx += 1) {
      if (src[idx] === "{") depth += 1
      else if (src[idx] === "}") {
        depth -= 1
        if (depth === 0 && idx < src.length - 1) return src // outer pair closes early
      }
    }
    return src.slice(1, -1).trim()
  }
  return src
}

/** Reconstruct `base_{sub}^{sup}` from parts — supsub/font nodes carry no reliable own span. */
function supsubTex(baseTex: string, n: any, ctx: Ctx): string {
  let out = baseTex
  if (n.sub != null) out += `_{${scriptSrc(n.sub, ctx)}}`
  if (n.sup != null) out += `^{${scriptSrc(n.sup, ctx)}}`
  return out
}

/** Emission for a supsub base: plain symbols slice their span; font wraps reconstruct. */
function baseTexOf(rawBase: any, ctx: Ctx): string | null {
  const peeled = peelStyles(rawBase)
  if (peeled?.type === "font") {
    const inner = baseTexOf(peeled.body, ctx)
    return inner == null ? null : `\\${peeled.font}{${inner}}`
  }
  const u = unwrap(rawBase)
  if (u && (u.type === "mathord" || u.type === "textord")) return srcOf(u, ctx)
  return null
}

function analyzeSupsub(n: any, ctx: Ctx): Factor {
  const base = unwrap(n.base)
  const sup = n.sup != null ? classifySup(n.sup) : null
  if (sup === "prime") throw new Unsupported("a primed symbol, which is not in the dictionary")

  // A decorated big operator (\int_0^\infty, \sum_{i}) is an integral or a sum
  // wearing limits, not an unreadable script: let the op say so itself.
  if (base?.type === "op" && !(base.name && FUNC_OPS.has(base.name))) {
    analyzeFactor(n.base, ctx)
  }

  // {}^{d} / {}_{\mu\nu} index riders (as in R_{abc}{}^{d} or \Gamma^{\rho}{}_{\mu\nu}).
  if (base == null || (base.type === "ordgroup" && base.body.length === 0)) {
    const supIsIndex = n.sup == null || sup === "index" || allRiderTokens(nodeListOf(n.sup))
    const subIsIndex = n.sub == null || allRiderTokens(nodeListOf(n.sub))
    if ((n.sup != null || n.sub != null) && supIsIndex && subIsIndex) {
      const tex = supsubTex("{}", n, ctx)
      return { kind: "rider", dim: ZERO, emit: () => tex }
    }
    throw new Unsupported("a floating super/subscript")
  }

  const baseText = base != null ? textOf(base) : null
  const baseTex = baseTexOf(n.base, ctx)
  const wholeTex = baseTex != null ? supsubTex(baseTex, n, ctx) : null

  // Symbol with a subscript: identity, indices, or unknown.
  if (baseText != null && wholeTex != null && n.sub != null) {
    const d = resolveSymbol(baseText, wholeTex, ctx, { sub: n.sub })
    if (sup == null || sup === "index") return { kind: "sym", dim: d, emit: () => wholeTex }
    if (typeof sup === "object") {
      return { kind: "sym", dim: dimScale(d, sup.p, sup.q), emit: () => wholeTex }
    }
    throw new Unsupported(`an exponent on “${wholeTex}” that could not be read`)
  }

  // Pure superscript.
  if (baseText != null && wholeTex != null && sup != null) {
    if (sup === "index") {
      const d = resolveSymbol(baseText, wholeTex, ctx, { indices: true })
      return { kind: "sym", dim: d, emit: () => wholeTex }
    }
    if (typeof sup === "object") {
      const isConst = baseText === "\\pi" || baseText === "i" || baseText === "e"
      const d = isConst ? ZERO : resolveSymbol(baseText, baseTex!, ctx, {})
      const scaled = dimScale(d, sup.p, sup.q)
      if (baseText === "c" || baseText === "G") {
        const e12 = (D12 * sup.p) / sup.q
        return {
          kind: "sym",
          dim: scaled,
          constant: Number.isInteger(e12) ? { tex: baseText, e12 } : undefined,
          emit: () => {
            if (!ctx.strip || !emitsConstants(ctx)) return wholeTex
            ctx.mutated = true
            return ""
          },
        }
      }
      return { kind: isConst ? "num" : "sym", dim: scaled, emit: () => wholeTex }
    }
    // Expression exponent: legal only on a dimensionless base; the exponent is
    // itself a geometrized expression restored against a dimensionless target.
    const baseDim =
      baseText === "e" || baseText === "\\pi" || baseText === "i"
        ? ZERO
        : resolveSymbol(baseText, baseTex!, ctx, {})
    if (!dimIsZero(baseDim)) {
      throw new Unsupported(`a symbolic exponent on the dimensional base “${baseTex}”`)
    }
    const expSum = parseSum(nodeListOf(n.sup), ctx, { anchor: "forced", target: ZERO })
    const frozenBase = baseTex!
    const emit = () => `${frozenBase}^{${expSum.emit()}}`
    return { kind: "sym", dim: ZERO, emit }
  }

  // Compound base (group, frac, sqrt, accent) carrying a numeric power and/or
  // index scripts: emission is rebuilt from the analyzed base so inner
  // restorations and delimiters survive.
  if (base != null) {
    const subIsIndex = n.sub == null || allIndexTokens(nodeListOf(n.sub), true)
    const supIsReadable = sup == null || sup === "index" || typeof sup === "object"
    if (subIsIndex && supIsReadable) {
      const inner = analyzeFactor(n.base, ctx)
      const scaled =
        typeof sup === "object" && sup != null ? dimScale(inner.dim, sup.p, sup.q) : inner.dim
      const scripts =
        (n.sub != null ? `_{${scriptSrc(n.sub, ctx)}}` : "") +
        (n.sup != null ? `^{${scriptSrc(n.sup, ctx)}}` : "")
      return { kind: "group", dim: scaled, emit: () => `${inner.emit()}${scripts}` }
    }
  }

  throw new Unsupported("a super/subscript construct the engine could not read")
}

function sumAsFactorList(sum: SumInfo): Factor[] {
  // A single slash-free term flattens; anything else stays one opaque unit so
  // its internal structure (division, +/-) survives re-emission.
  if (!sum.multiTerm && sum.terms[0].slashIdx < 0 && sum.terms[0].sign !== "-") {
    return sum.terms[0].factors
  }
  return [
    {
      kind: "group",
      dim: sum.dim,
      emit: () => sum.emit(),
      isBareSum: true,
    },
  ]
}

function containsRel(nodes: any[]): boolean {
  return nodes.some((n) => n?.type === "atom" && n.family === "rel")
}

// ---------------------------------------------------------------------------
// Constant insertion and emission
// ---------------------------------------------------------------------------

function formatExp(tex: string, e12: number): string {
  if (e12 === 0) return ""
  if (e12 === D12) return tex
  if (e12 % D12 === 0) return `${tex}^{${e12 / D12}}`
  let p = e12
  let q = D12
  for (const f of [2, 2, 3]) {
    while (p % f === 0 && q % f === 0) {
      p /= f
      q /= f
    }
  }
  return `${tex}^{${p}/${q}}`
}

function emitTerm(t: TermInfo): string {
  // Stripped constants may leave a side of a "/" (or the whole term) empty.
  if (t.slashIdx >= 0) {
    const num = joinTex(t.factors.slice(0, t.slashIdx).map((f) => f.emit()))
    const den = joinTex(t.factors.slice(t.slashIdx + 1).map((f) => f.emit()))
    if (den === "") return num === "" ? "1" : num
    if (num === "") return `1/${den}`
    return `${num}/${den}`
  }
  return joinTex(t.factors.map((f) => f.emit())) || "1"
}

/**
 * Emit a factor list with constants inserted where physics culture expects
 * them: G lands just after the leading numeral cluster (`8\pi G T_{ab}`),
 * c lands at the tail but before any trailing differentials (`c^{2}dt^{2}`,
 * `2\pi k_B c`). Both insertion positions are computed on the factor list
 * first, so neither insertion shifts the other.
 */
function partsWith(factors: Factor[], gTex: string, cTex: string): string[] {
  const parts = factors.map((f) => (f.isBareSum ? `\\left(${f.emit()}\\right)` : f.emit()))
  let headPos = 0
  for (let idx = 0; idx < factors.length; idx += 1) {
    const kind = factors[idx].kind
    if (kind === "num") headPos = idx + 1
    else if (kind === "glue") continue
    else break
  }
  let tailPos = factors.length
  for (let idx = factors.length - 1; idx >= 0; idx -= 1) {
    const kind = factors[idx].kind
    if (kind === "diff" || kind === "glue") tailPos = idx
    else break
  }
  if (cTex) parts.splice(tailPos, 0, cTex)
  if (gTex) parts.splice(headPos, 0, gTex)
  return parts
}

/** Rebuild a term with c^(a/12) G^(b/12) inserted in the culturally expected slots. */
function emitTermWith(t: TermInfo, a12: number, b12: number): string {
  if (a12 === 0 && b12 === 0) return emitTerm(t)

  // Half-integer powers read best inside a square root when there is one.
  if ((a12 % D12 !== 0 || b12 % D12 !== 0) && t.slashIdx < 0) {
    const sqrtIdx = t.factors.findIndex((f) => f.kind === "sqrt" && f.sqrt?.bodyTerm)
    if (sqrtIdx >= 0 && t.factors.filter((f) => f.kind === "sqrt").length === 1) {
      const sqrtFactor = t.factors[sqrtIdx]
      const inner = emitTermWith(sqrtFactor.sqrt!.bodyTerm!, a12 * 2, b12 * 2)
      const parts = t.factors.map((f, idx) => (idx === sqrtIdx ? `\\sqrt{${inner}}` : f.emit()))
      return joinTex(parts)
    }
  }

  const cNum = a12 > 0 ? formatExp("c", a12) : ""
  const cDen = a12 < 0 ? formatExp("c", -a12) : ""
  const gNum = b12 > 0 ? formatExp("G", b12) : ""
  const gDen = b12 < 0 ? formatExp("G", -b12) : ""

  // A source-level “x/y” term keeps its slash form (the separator factor at
  // slashIdx is skipped and re-emitted between the halves).
  if (t.slashIdx >= 0) {
    const numF = t.factors.slice(0, t.slashIdx)
    const denF = t.factors.slice(t.slashIdx + 1)
    const numParts = partsWith(numF, gNum, cNum)
    const denParts = partsWith(denF, gDen, cDen)
    return `${joinTex(numParts)}/${joinTex(denParts)}`
  }

  // A term led by a fraction absorbs the constants into that fraction.
  const fracIdx = t.factors.findIndex((f) => f.kind === "frac")
  if (fracIdx >= 0 && t.factors[fracIdx].frac) {
    const frac = t.factors[fracIdx].frac!
    let numParts = partsWith(frac.num, gNum, cNum)
    const denParts = partsWith(frac.den, gDen, cDen)
    // Drop a now-redundant bare 1 numerator: \frac{1·c⁴}{…} → \frac{c⁴}{…}.
    if (
      (gNum || cNum) &&
      frac.num.length === 1 &&
      frac.num[0].kind === "num" &&
      frac.num[0].emit() === "1"
    ) {
      numParts = numParts.filter((p) => p !== "1")
    }
    const fracTex = `${frac.cmd}{${joinTex(numParts)}}{${joinTex(denParts)}}`
    return joinTex(t.factors.map((f, idx) => (idx === fracIdx ? fracTex : f.emit())))
  }

  // Plain product: an inserted constant first folds into a power of the same
  // constant the term already carries, then joins the product; negatives wrap
  // the result in a fraction.
  const merged = mergeConstants(t.factors, a12, b12)
  const numParts = partsWith(
    merged.factors,
    merged.b12 > 0 ? formatExp("G", merged.b12) : "",
    merged.a12 > 0 ? formatExp("c", merged.a12) : "",
  )
  const numerator = joinTex(numParts) || "1"
  const mergedDen =
    (merged.b12 < 0 ? formatExp("G", -merged.b12) : "") +
    (merged.a12 < 0 ? formatExp("c", -merged.a12) : "")
  if (mergedDen === "") return numerator
  return `\\frac{${numerator}}{${mergedDen}}`
}

/**
 * Fold an inserted power of c or G into a power of the same constant already in
 * the term. Without this, `c` needing a c⁻¹ emitted `\frac{Gc}{c}` instead of
 * `G`, and `mc` needing another c emitted `mcc` instead of `mc^{2}`.
 */
function mergeConstants(
  factors: Factor[],
  a12: number,
  b12: number,
): { factors: Factor[]; a12: number; b12: number } {
  if (!factors.some((f) => f.constant)) return { factors, a12, b12 }
  let a = a12
  let b = b12
  const rest: Factor[] = []
  for (const f of factors) {
    if (f.constant?.tex === "c") a += f.constant.e12
    else if (f.constant?.tex === "G") b += f.constant.e12
    else rest.push(f)
  }
  return { factors: rest, a12: a, b12: b }
}

// ---------------------------------------------------------------------------
// Relations, rows, and the top-level entry point
// ---------------------------------------------------------------------------

/** Base units of the target for [M, L, T, Θ, I]; H-L and Gaussian share the CGS mechanical base. */
function baseUnitsOf(system: UnitSystem): [string, string, string, string, string] {
  return system === "si" ? ["kg", "m", "s", "K", "A"] : ["g", "cm", "s", "K", "A"]
}

/** KaTeX form of the dimension `d` in the target — for the "both sides carry …" banner. */
function unitTexOf(d: Dim, spec: TargetSpec): string {
  const [uM, uL, uT, uTh, uI] = baseUnitsOf(spec.system)
  let units: Array<[string, number]>
  if (spec.geometrized) {
    // With G = c = 1, mass and time both measure in length; k_B keeps kelvin explicit.
    units = [
      [`\\mathrm{${uL}}`, d[0] + d[1] + d[2]],
      ["\\mathrm{K}", d[3]],
      [`\\mathrm{${uI}}`, d[4]],
    ]
  } else {
    units = [
      [`\\mathrm{${uM}}`, d[0]],
      [`\\mathrm{${uL}}`, d[1]],
      [`\\mathrm{${uT}}`, d[2]],
      [`\\mathrm{${uTh}}`, d[3]],
      [`\\mathrm{${uI}}`, d[4]],
    ]
  }
  const parts = units.filter(([, e]) => e !== 0)
  if (parts.length === 0) return "\\text{dimensionless}"
  return parts.map(([u, e]) => formatExp(u, e)).join("\\,")
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
}

function unicodeExp(unit: string, e12: number): string {
  if (e12 === 0) return ""
  if (e12 === D12) return unit
  if (e12 % D12 === 0) {
    const sup = String(e12 / D12)
      .split("")
      .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
      .join("")
    return `${unit}${sup}`
  }
  return `${unit}^(${e12}/12)`
}

/** Plain-text unit label for a legend row, in the target system. */
function legendUnitOf(record: LegendRecord, spec: TargetSpec): string {
  if (spec.system === "si" && !spec.geometrized) return record.si
  const d = record.dim
  const [uM, uL, uT, uTh, uI] = baseUnitsOf(spec.system)
  const units: Array<[string, number]> = spec.geometrized
    ? [
        [uL, d[0] + d[1] + d[2]],
        ["K", d[3]],
        [uI, d[4]],
      ]
    : [
        [uM, d[0]],
        [uL, d[1]],
        [uT, d[2]],
        [uTh, d[3]],
        [uI, d[4]],
      ]
  const parts = units.filter(([, e]) => e !== 0).map(([u, e]) => unicodeExp(u, e))
  return parts.length === 0 ? "1" : parts.join(" ")
}

/** Emission is a closure so the same analyzed row can be re-emitted with insertions masked. */
type RowResult = {
  emitSides: () => string[]
  rels: string[]
  /** Whether an alignment tab stood immediately before rels[i] in the source. */
  tabAtRel: boolean[]
  target: Dim
  hadRel: boolean
}

function rowTexOf(row: RowResult): string {
  const sideTexts = row.emitSides()
  let tex = sideTexts[0]
  for (let idx = 0; idx < row.rels.length; idx += 1) {
    const tab = row.tabAtRel[idx] ? "&" : ""
    tex += `${tex.length > 0 ? " " : ""}${tab}${row.rels[idx]} ${sideTexts[idx + 1]}`
  }
  return tex
}

function translateRow(nodes: any[], ctx: Ctx, carriedTarget: Dim | null): RowResult {
  const grouped = groupDelims(nodes)

  const sides: any[][] = []
  const rels: string[] = []
  const tabAtRel: boolean[] = []
  let current: any[] = []
  let pendingTab = false
  for (const n of grouped) {
    if (n?.type === "__tab") {
      pendingTab = true
      continue
    }
    if (n?.type === "atom" && n.family === "rel") {
      if (!SUPPORTED_RELS.has(n.text)) {
        throw new Unsupported(
          n.text === "\\propto"
            ? "a proportionality — constants are absorbed in ∝, so restoring them is not meaningful"
            : `the unsupported relation “${n.text}”`,
        )
      }
      sides.push(current)
      rels.push((safeSrc(n, ctx) || n.text).trim())
      tabAtRel.push(pendingTab)
      pendingTab = false
      current = []
      continue
    }
    // Spacing shims sit between the tab and the relation without ending the column.
    if (!isEmptyOrdgroup(n) && !(n != null && SKIP_TYPES.has(n.type)) && pendingTab) {
      throw new Unsupported(
        "a column break that does not introduce a relation — the engine aligns equations, not free-form columns",
      )
    }
    current.push(n)
  }
  if (pendingTab) {
    throw new Unsupported("a row that ends on an alignment tab")
  }
  sides.push(current)

  if (rels.length === 0) {
    // No relation: analyze for the legend, but there is nothing to anchor.
    parseSum(grouped, ctx, { anchor: "none" })
    const src = srcOfNodes(nodes, ctx)
    return { emitSides: () => [src], rels: [], tabAtRel: [], target: ZERO, hadRel: false }
  }

  const sums = sides.map((side) =>
    side.length === 0 || side.every((n) => isEmptyOrdgroup(n) || SKIP_TYPES.has(n?.type))
      ? null
      : parseSum(side, ctx, { anchor: "none" }),
  )

  // Anchor on the first side that has a non-zero term (literal zeros carry any
  // dimension); a row that opens at "=" inherits the previous row's target.
  let target: Dim | null = null
  for (const sum of sums) {
    if (sum == null) continue
    const anchor = sumAnchor(sum.terms)
    if (anchor != null) {
      target = anchor
      break
    }
  }
  if (target == null) target = carriedTarget
  if (target == null && sums.some((s) => s == null)) {
    throw new Unsupported("a row that begins at “=” with nothing before it to anchor it")
  }
  if (target == null) target = ZERO // every term a literal zero: identity

  // Insertions are solved once, during analysis; emission can then be replayed.
  // A side that is nothing but a literal 1 is a convention marker rather than a
  // quantity, so it stays a bare 1 (the same transparency a literal 0 has had).
  const resolvedTarget = target
  const insertionsPerSide = sums.map((sum) => {
    if (sum == null) return []
    if (!sum.multiTerm && sum.terms[0].isUnitLiteral) return [null]
    return sum.terms.map((t) => termInsertion(t, resolvedTarget, ctx))
  })
  const emitSides = () =>
    sums.map((sum, idx) =>
      sum == null ? "" : emitSum(sum.terms, sum.ops, insertionsPerSide[idx], ctx),
    )

  return { emitSides, rels, tabAtRel, target: resolvedTarget, hadRel: true }
}

/**
 * Trailing sentence punctuation, token-wise. Display equations routinely end
 * in “\,.”, “\qquad”, or a bare period — the sentence's punctuation, not the
 * equation's. Two guards: a trailing “.” can be a NULL DELIMITER
 * (\right. / \Big.), where stripping it unbalances the math; and a matched
 * “\<char>” is only a control token when its backslash is an escape — the run
 * of backslashes ending there must have odd total length (in “x \\ ” the
 * matched backslash is the tail of a row separator).
 * Exported: the stage-2 extractor uses this same stripper, so the two layers
 * cannot disagree about what a delimiter dot is.
 */
export function stripTrailingPunctuation(tex: string): string {
  let t = tex.replace(/\s+$/, "")
  for (;;) {
    let m = t.match(/(\\(?:quad|qquad)|\\[,;:! ]|[.,;:~]|\s)$/)
    if (!m) return t
    if (m[0].startsWith("\\")) {
      const runBefore = (t.slice(0, t.length - m[0].length).match(/\\*$/) ?? [""])[0].length
      if ((runBefore + 1) % 2 === 0) {
        m = t.match(/([.,;:~]|\s)$/)
        if (!m) return t
      }
    }
    if (m[0] === "." && /\\(?:[Bb]igg?[lrm]?|right|left)\s*$/.test(t.slice(0, -1))) return t
    t = t.slice(0, t.length - m[0].length)
  }
}

// A leading styling directive (\textstyle on hand-compressed sums, Wikipedia's
// {\displaystyle …} wrapper arriving unstripped) parses into a single node
// that hides the relation from the row splitter, so the decline blames “=”.
// It is inert typography — peel it from the STRING, before ctx.input is
// fixed, so the masked-replay backstop compares consistently. Only the
// four-member style family is peeled; \small, \color and friends stay
// declined (unmeasured in the served corpus — widen only with evidence).
const STYLE_PREFIX = /^\\(?:display|text|scriptscript|script)style\b\s*/
const STYLE_GROUP = /^\{\s*\\(?:display|text|scriptscript|script)style\b([\s\S]*)\}$/
function stripStyleWrapper(tex: string): string {
  let t = tex.trim()
  for (;;) {
    if (STYLE_PREFIX.test(t)) {
      t = t.replace(STYLE_PREFIX, "").trim()
      continue
    }
    const m = t.match(STYLE_GROUP)
    if (m && outerBracesArePartners(t)) {
      t = m[1].trim()
      continue
    }
    return t
  }
}

/** True when the string's first "{" closes exactly at its final character. */
function outerBracesArePartners(t: string): boolean {
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === "\\") {
      i++
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i === t.length - 1
    }
  }
  return false
}

export type DimensionResult =
  | { kind: "dim"; dim: Dim; legend: LegendEntry[] }
  | { kind: "declined"; reasons: string[]; unknown: string[] }

/**
 * The dimension of a bare expression under the registry's readings — the
 * definitions path of census §6.5: "κ = 8πG/c⁴" gives κ the dimension of
 * 8πG/c⁴. Nothing is restored here: every term of a sum must already carry
 * one dimension, an unknown symbol declines, and a relation is refused (an
 * expression is wanted, not an equation).
 */
export function dimensionOf(
  rawTex: string,
  katex: { __parse: (tex: string, options?: Record<string, unknown>) => any[] },
  reg: HubRegistry,
): DimensionResult {
  let tex = rawTex
  for (;;) {
    const next = stripStyleWrapper(stripTrailingPunctuation(tex))
    if (next === tex) break
    tex = next
  }
  const ctx: Ctx = { input: tex, reg, legend: new Map(), unknown: new Map(), mutated: false, strip: false, mask: false }
  const legendOut = () =>
    Array.from(ctx.legend.values()).map((record) => ({
      tex: record.tex,
      gloss: record.gloss,
      unit: legendUnitOf(record, DEFAULT_TARGET),
    }))
  try {
    const nodes = katex.__parse(tex, { strict: false, trust: false, displayMode: true })
    if (groupDelims(nodes).some((n) => n?.type === "atom" && n.family === "rel")) {
      throw new Unsupported("a relation — an expression is wanted here, not an equation")
    }
    const sum = parseSum(nodes, ctx, { anchor: "none" })
    if (ctx.unknown.size > 0) {
      return { kind: "declined", reasons: [], unknown: Array.from(ctx.unknown.values()) }
    }
    const target = sumAnchor(sum.terms) ?? ZERO
    for (const t of sum.terms) {
      if (t.isZero || t.pureNumeral) continue
      if (!dimIsZero(dimSub(t.dim, target))) {
        throw new Unsupported("terms of different dimension — nothing is restored to reconcile a definition")
      }
    }
    return { kind: "dim", dim: target, legend: legendOut() }
  } catch (error) {
    const reason = error instanceof Unsupported ? error.reason : "TeX that KaTeX could not parse"
    return { kind: "declined", reasons: [reason], unknown: Array.from(ctx.unknown.values()) }
  }
}

export function translateTex(
  rawTex: string,
  katex: { __parse: (tex: string, options?: Record<string, unknown>) => any[] },
  reg: HubRegistry,
  spec: TargetSpec = DEFAULT_TARGET,
): TranslationResult {
  // Punctuation and style wrappers can nest (“{\displaystyle x = y .}”), so
  // normalize to a fixpoint; both transforms are idempotent and shrinking.
  let tex = rawTex
  for (;;) {
    const next = stripStyleWrapper(stripTrailingPunctuation(tex))
    if (next === tex) break
    tex = next
  }
  const ctx: Ctx = {
    input: tex,
    reg,
    legend: new Map(),
    unknown: new Map(),
    mutated: false,
    strip: spec.geometrized,
    mask: false,
  }

  // The floater only ever fires on a .katex-display, so every equation it sees
  // was parsed in display mode. Parsing it any other way here would reject the
  // five environments KaTeX gates on display mode (align, gather, split,
  // alignat, \tag) as unparseable TeX.
  const parse = (source: string) =>
    katex.__parse(source, { strict: false, trust: false, displayMode: true })

  const legendOut = () =>
    Array.from(ctx.legend.values()).map((record) => ({
      tex: record.tex,
      gloss: record.gloss,
      unit: legendUnitOf(record, spec),
    }))

  const finish = (
    make: () => { restoredTex: string; targetUnitTex: string; changed: boolean } | "no-anchor",
  ): TranslationResult => {
    try {
      const outcome = make()
      if (ctx.unknown.size > 0) {
        return {
          kind: "declined",
          reasons: [],
          unknown: Array.from(ctx.unknown.values()),
          legend: legendOut(),
        }
      }
      if (outcome === "no-anchor") {
        return { kind: "no-anchor", legend: legendOut() }
      }
      return {
        kind: "translated",
        originalTex: tex,
        restoredTex: outcome.restoredTex,
        changed: outcome.changed,
        targetUnitTex: outcome.targetUnitTex,
        legend: legendOut(),
      }
    } catch (error) {
      const reason = error instanceof Unsupported ? error.reason : "TeX that KaTeX could not parse"
      return {
        kind: "declined",
        reasons: [reason],
        unknown: Array.from(ctx.unknown.values()),
        legend: legendOut(),
      }
    }
  }

  // For comparing a rebuilt equation against its source: whitespace, braces, and
  // pure-spacing commands are typographically inert. Adjacent signs are folded on
  // both sides, because the emitter folds them too (`a - -b` re-emits as `a + b`).
  const cmpNorm = (s: string) => {
    let out = s.replace(/\\qquad|\\quad|\\[,;!:]/g, "").replace(/[\s{}]/g, "")
    for (;;) {
      const folded = out
        .replace(/--/g, "+")
        .replace(/\+-|-\+/g, "-")
        .replace(/\+\+/g, "+")
      if (folded === out) return out
      out = folded
    }
  }

  // Backstops for the reassembly itself: the rebuilt TeX must parse, and the
  // same reassembly replayed with every insertion and strip masked out must be
  // the source equation verbatim (up to inert typography). The masked replay is
  // what extends the check to *mutating* translations — without it, any part of
  // the equation the emitters quietly rewrote rode out on the back of a
  // legitimate constant insertion. Any divergence declines rather than shipping
  // a mangle.
  const checkRebuilt = (restoredTex: string, rebuild: () => string) => {
    try {
      parse(restoredTex)
    } catch {
      throw new Unsupported(
        "an internal reassembly fault — the rebuilt equation did not parse (nothing was shown rather than something wrong)",
      )
    }
    ctx.mask = true
    let masked: string
    try {
      masked = rebuild()
    } finally {
      ctx.mask = false
    }
    if (cmpNorm(masked) !== cmpNorm(tex)) {
      throw new Unsupported(
        "an internal reassembly fault — the rebuilt equation diverged from the source (nothing was shown rather than something wrong)",
      )
    }
  }

  return finish(() => {
    let nodes: any[]
    try {
      nodes = parse(tex)
    } catch {
      throw new Unsupported("TeX that KaTeX could not parse")
    }

    const meaningful = nodes.filter((n) => n && !SKIP_TYPES.has(n.type))
    const arrayNode =
      meaningful.length === 1 && meaningful[0].type === "array" ? meaningful[0] : null

    if (arrayNode != null) {
      // The array node carries no environment name, so it is read off the
      // source: rewriting every environment to `aligned` silently turned an
      // array{cc} into something else. An environment outside this list has a
      // row model the engine does not share (cases, matrix), and falls back to
      // `aligned` — where the verbatim backstop catches it and declines.
      const ROW_ENVS = new Set([
        "aligned",
        "align",
        "align*",
        "alignat",
        "alignat*",
        "gathered",
        "gather",
        "gather*",
        "split",
        "array",
        "darray",
      ])
      const opener = /^\s*\\begin\{([a-zA-Z]+\*?)\}(\{[^{}]*\})?/.exec(tex)
      const closes =
        opener != null && new RegExp(`\\\\end\\{${opener[1].replace("*", "\\*")}\\}\\s*$`).test(tex)
      const envName = closes && ROW_ENVS.has(opener![1]) ? opener![1] : "aligned"
      const envArg = closes && ROW_ENVS.has(opener![1]) ? (opener![2] ?? "") : ""

      // Cell boundaries are the alignment tabs; flattening the row away loses
      // every tab past the first. A marker keeps them in the node stream.
      const rows: any[][] = arrayNode.body.map((row: any[]) =>
        row.flatMap((cell: any, idx: number) =>
          idx === 0 ? nodeListOf(cell) : [{ type: "__tab" }, ...nodeListOf(cell)],
        ),
      )
      let carried: Dim | null = null
      let anyRel = false
      const results: RowResult[] = []
      const gaps: string[] = []
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
        const row = rows[rowIdx]
        if (row.length === 0 || row.every((n) => isEmptyOrdgroup(n) || n?.type === "__tab"))
          continue
        const res = translateRow(row, ctx, carried)
        if (res.hadRel) {
          carried = res.target
          anyRel = true
        } else if (anyRel) {
          throw new Unsupported("a continuation row without its own relation")
        }
        results.push(res)
        // Row spacing is content: `\\[6pt]` must not become a bare `\\`.
        const gap = arrayNode.rowGaps?.[rowIdx]
        gaps.push(gap ? `[${gap.number}${gap.unit}]` : "")
      }
      if (!anyRel) return "no-anchor"
      const rebuild = () => {
        const body = results
          .map(
            (res, idx) => rowTexOf(res) + (idx < results.length - 1 ? ` \\\\${gaps[idx]}\n` : ""),
          )
          .join("")
        return `\\begin{${envName}}${envArg}\n${body}\n\\end{${envName}}`
      }
      const restored = rebuild()
      checkRebuilt(restored, rebuild)
      return {
        restoredTex: restored,
        targetUnitTex: unitTexOf(carried ?? ZERO, spec),
        changed: ctx.mutated,
      }
    }

    const res = translateRow(nodes, ctx, null)
    if (!res.hadRel) return "no-anchor"
    const rebuild = () => rowTexOf(res)
    const restored = rebuild()
    checkRebuilt(restored, rebuild)
    return {
      restoredTex: restored,
      targetUnitTex: unitTexOf(res.target, spec),
      changed: ctx.mutated,
    }
  })
}
