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
      /**
       * The unit both sides carry. For a line or an array of several
       * statements, the one unit when all of them carry it, otherwise each
       * statement's unit in order, joined by `;\ `.
       */
      targetUnitTex: string
      /** Each statement's unit, in order; present only when more than one statement was translated. */
      statementUnitTex?: string[]
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
  /**
   * The font command whose argument is being read, as written (`\bf`,
   * `\mathrm`), or null outside any font. A constant restored in there would be
   * set in that font — a bold c is a vector, an upright c no speed of light —
   * and every Latin letter under an upright font is upright too.
   */
  font: { tex: string; upright: boolean; node: any } | null
  /**
   * Every c or G the analysis has read as the constant, in reading order
   * (analyzeFactor, analyzeSupsub). An accent asks what its body added here
   * (analyzeAccentBody).
   */
  constantsRead: ("c" | "G")[]
  /**
   * Set during the pair of replays the numeral-fusion net reads
   * (numeralFusionNet), live and masked, and null otherwise. It holds the
   * identity each factor and each signed term is given there (netId), the
   * same in both replays, so the net compares what the output sets side by
   * side by which numeral and which factor it is, never by spelling.
   *
   * In these replays every power of c or G, written or restored, is emitted
   * as one opaque mark (netOpaque), and so, in a masked replay to a
   * geometrized target, is every factor the live strip drops whole. The
   * numerals in them are a constant's power, which a restoration changes, or
   * go with what a strip removes: none of them is a number the output sets
   * beside another. This is decided by what the analysis read, never by how a
   * power is spelled (`c^{\frac{10}{5}}`, `\left(\frac{G}{c^2}\right)^{10}`).
   */
  net: Map<object, string> | null
}

/** Constants are inserted (or stripped) only in a live emission, never in a masked one. */
function emitsConstants(ctx: Ctx): boolean {
  return !ctx.mask
}

/** Open and close an opaque mark in a net replay; neither is TeX, and no other emission holds one. */
const NET_OPEN = "\u0002"
const NET_CLOSE = "\u0003"

/**
 * The tags a net replay sets in its TeX (Ctx.net), each an identity closed by
 * NET_TAG_CLOSE; none is TeX, and no other emission holds one. NET_NUMERAL
 * opens a numeral factor's digits, NET_END closes any factor, and NET_SIGN
 * opens the sign written before a sum's first term.
 */
const NET_NUMERAL = "\u0004"
const NET_TAG_CLOSE = "\u0005"
const NET_END = "\u0006"
const NET_SIGN = "\u0007"
const NET_TAG = /[\u0004\u0006\u0007][^\u0005]*\u0005/g

/**
 * TeX the numeral-fusion net reads as one visible mark and does not read
 * into: a letter prints there, and the digits inside are not the author's
 * number (Ctx.net).
 */
function netOpaque(tex: string): string {
  return tex === "" ? tex : `${NET_OPEN}${tex}${NET_CLOSE}`
}

/** The identity a net replay gives a factor or a term, the same in the live replay and the masked one. */
function netId(net: Map<object, string>, thing: object): string {
  let id = net.get(thing)
  if (id == null) {
    id = String(net.size + 1)
    net.set(thing, id)
  }
  return id
}

/**
 * A factor's TeX as a product sets it. In a net replay, a numeral factor's
 * digits are tagged with its identity, and the end of every factor with the
 * factor's, so the net knows which numeral each digit is and which factor a
 * sign is set right after. Glue is no factor and is not tagged.
 */
function factorTex(f: Factor, tex: string, ctx: Ctx): string {
  if (ctx.net == null || f.kind === "glue") return tex
  const id = netId(ctx.net, f)
  const numeral = f.kind === "num" && /^[0-9.]/.test(tex) ? `${NET_NUMERAL}${id}${NET_TAG_CLOSE}` : ""
  return `${numeral}${tex}${NET_END}${id}${NET_TAG_CLOSE}`
}

/**
 * The 1 emission sets where nothing is left of a product: a strip emptied it,
 * or every constant in it folded into a restored power. In a net replay it is
 * tagged as made, for no numeral the author wrote is that one.
 */
function emptyProductTex(ctx: Ctx): string {
  return ctx.net == null ? "1" : `${NET_NUMERAL}made${NET_TAG_CLOSE}1`
}

/** A sum's leading sign as a term sets it, tagged in a net replay with the term's identity. */
function leadSignTex(t: TermInfo, ctx: Ctx): string {
  const sign = leadSign(t.sign)
  if (ctx.net == null || sign === "") return sign
  return `${NET_SIGN}${netId(ctx.net, t)}${NET_TAG_CLOSE}${sign}`
}

/**
 * Whether the live strip drops the factor whole, asked from inside a masked
 * replay, where nothing is stripped and `vanishes` would say no.
 */
function vanishesLive(f: Factor, ctx: Ctx): boolean {
  const masked = ctx.mask
  ctx.mask = false
  try {
    return f.vanishes?.() === true
  } finally {
    ctx.mask = masked
  }
}

/** A live emission to a geometrized target, where every c and G is set to one and vanishes. */
function stripsConstants(ctx: Ctx): boolean {
  return ctx.strip && emitsConstants(ctx)
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
  /**
   * A power of a constant that a unit system can set to one: c, G, ħ or k_B.
   * Wider than `constant`, which only c and G carry because only they are
   * ever inserted; a relation among these and numerals states a unit system
   * or a constant's value, and has nothing in it to restore.
   */
  unitConstant?: boolean
  /**
   * The factors a wrapping construct holds — a group's or a root's body, a
   * powered compound's base — so a test can look through the wrapping:
   * `{c} = 1` and `\sqrt{G} = 1` are declarations as much as `c = 1` is.
   */
  parts?: Factor[]
  /**
   * The wrapped sum has more than one term, or a term under a minus or branch
   * sign, which `parts` flattens away: `(-c) = 1` gives c the value −1, and
   * read through its parts alone it set c to one.
   */
  signedParts?: boolean
  /**
   * The factor ends in a function argument no delimiter closes (`\tanh\phi`,
   * and `{\tanh\phi}`, whose braces do not print). Whatever is set right after
   * it reads as more of that argument, so a constant never goes there.
   */
  openArgument?: boolean
  /**
   * Whether the factor emits nothing but stripped constants: a geometrized
   * target set every c and G in it to one (`c^{2}`, `\frac{c^{4}}{G}`, `{c}`,
   * `\frac{1}{c}`). Asked at emission time, since only a live strip empties
   * anything. A product drops such a factor whole, with the glue that only
   * served to separate it (see joinFactors), where emitting it on its own
   * would leave a `1` beside the factors that remain.
   */
  vanishes?: () => boolean
  /**
   * Whether the factor prints a numeral at its first or last edge, as a live
   * emission prints it: a digit run, raised or not (`3`, `10^{8}`), a brace
   * group that opens or closes on one, braces printing nothing, a fraction of
   * numerals (`\frac{1}{2}`), or a fraction whose emptied denominator leaves
   * its numerator to print. Two such edges with nothing printed between them
   * read as one number (keepNumeralsApart).
   */
  numeralEdge?: (side: "first" | "last") => boolean
  /**
   * On the glue a kern makes: the one command KaTeX gives the kern's width
   * (`\,`, `\quad`), or null when none does. A kern has no source span, so it
   * emits nothing, and this is what it is rebuilt as where it keeps two
   * numerals apart.
   */
  kern?: string | null
  frac?: { cmd: string; num: Factor[]; den: Factor[] }
  sqrt?: { bodyTerm: TermInfo | null }
}

type TermInfo = {
  /**
   * The sign written before the term's first factor, folded: "", "-", or "+",
   * or a branch sign "\pm" or "\mp", which is never folded with another.
   * A written "+" is kept rather than read as nothing, so the term re-emits as
   * the source spells it (`E = +m` came back as `E = m`, and the backstop
   * declined the divergence).
   */
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
/**
 * Relations restored across: each states an equality or a comparison of value,
 * and either holds only between like quantities. ≠ and the definition := are
 * not rel atoms of their own and are read in translateRow (see relTextOf).
 *
 * \sim, \lesssim and \gtrsim carry a caveat the owner holds open: in analysis
 * they can mean "≤ C·(…)" with the constant C absorbed, which is ∝'s problem.
 * They are restored like an equality all the same; `E \lesssim M` gives
 * `E \lesssim Mc^{2}`, as `E \sim M` always has.
 */
const SUPPORTED_RELS = new Set([
  "=",
  "\\approx",
  "\\simeq",
  "\\equiv",
  "\\doteq",
  "\\approxeq",
  "<",
  ">",
  "\\le",
  "\\leq",
  "\\leqq",
  "\\leqslant",
  "\\ge",
  "\\geq",
  "\\geqq",
  "\\geqslant",
  "\\ll",
  "\\gg",
  "\\sim",
  "\\lesssim",
  "\\gtrsim",
  "\\lessapprox",
  "\\gtrapprox",
])
/** Single arrows: a substitution (which may change dimension on purpose, k → k/|k|), a limit, or a map. */
const ARROWS = new Set([
  "\\to",
  "\\rightarrow",
  "\\longrightarrow",
  "\\leftarrow",
  "\\longleftarrow",
  "\\gets",
  "\\mapsto",
  "\\longmapsto",
])
/** A swap or a duality, never an equality. */
const EXCHANGES = new Set(["\\leftrightarrow", "\\longleftrightarrow", "\\rightleftarrows", "\\leftrightarrows"])
/** The branch signs: `a \pm b` abbreviates the pair of sums a + b and a − b. */
const BRANCH_OPS = new Set(["\\pm", "\\mp"])
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

/**
 * Whether a node's `loc` indexes the equation itself. KaTeX gives the tokens a
 * macro expands to a `loc` into the *macro body*: `~` becomes a `\nobreakspace`
 * spacing node located in the string "\nobreakspace", and `\cdots` an atom
 * located in "\@cdots". Slicing the equation with those offsets returns
 * whatever happens to sit there (`r = a~b` quoted its term as “ar = a~bb”, and
 * `T_{a\cdots b}` keyed itself as `T_{T_{a\cdots b}}`). Such a node contributes
 * no span; its located neighbours still do, and a fragment with none left
 * declines as unrecoverable instead of being sliced into garbage.
 */
function locIsOwn(loc: any, input: string): boolean {
  return (
    loc != null &&
    typeof loc.start === "number" &&
    typeof loc.end === "number" &&
    (loc.lexer == null || loc.lexer.input === input)
  )
}

function spanOf(node: unknown, input: string): [number, number] | null {
  let s = Infinity
  let e = -Infinity
  const visit = (n: any): void => {
    if (n == null || typeof n !== "object") return
    if (Array.isArray(n)) {
      for (const child of n) visit(child)
      return
    }
    if (locIsOwn(n.loc, input)) {
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
//
// Except where the whitespace *is* the token. A control space is a backslash
// followed by a space, tab or newline, and trimming it leaves a lone backslash
// that fuses with whatever is emitted next: `r\ \sqrt{r^{2}}` shipped as
// `r\\sqrt{r^{2}}`, a line break, and `x = r\,\ r/r` as `x = r\r/r`, KaTeX's
// ring accent. A slice that ends in an odd run of backslashes ended in a
// control space, so the space goes back on (an even run is a line break, `\\`).
function keepControlSpace(slice: string): string {
  const trimmed = slice.trim()
  const run = /\\+$/.exec(trimmed)?.[0].length ?? 0
  return run % 2 === 1 ? `${trimmed} ` : trimmed
}

function srcOf(node: unknown, ctx: Ctx): string {
  const span = spanOf(node, ctx.input)
  if (!span) throw new Unsupported("a fragment whose source position could not be recovered")
  return keepControlSpace(ctx.input.slice(span[0], span[1]))
}

function srcOfNodes(nodes: unknown[], ctx: Ctx): string {
  const span = spanOf(nodes, ctx.input)
  if (!span) return ""
  return keepControlSpace(ctx.input.slice(span[0], span[1]))
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
  const span = spanOf(genfrac.numer, ctx.input)
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
  // A font is content, not packaging: unwrapped, \tilde{\bm{\nabla}} and
  // \vec{\mathbf{p}} lost their fonts and came back as \tilde{\nabla} and \vec{p}.
  const styled = peelStyles(node)
  if (styled?.type === "font") return [styled]
  const u = unwrap(node)
  if (u == null) return []
  if (u.type === "ordgroup") return u.body
  return [u]
}

/**
 * Bars, by family. KaTeX hands them over as ordinary symbols rather than
 * open/close atoms, because a bar has no side of its own (pairBars decides
 * it). A single bar pairs only with a single bar, a double (a norm) only with
 * a double.
 */
const BAR_FAMILY: Record<string, "single" | "double"> = {
  "|": "single",
  "\\vert": "single",
  "\\|": "double",
  "\\Vert": "double",
}

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

/** The closing atoms the engine pairs: the values of CLOSE_FOR. */
const CLOSERS = new Set(Object.values(CLOSE_FOR))

/** \big … \Bigg, indexed by a delimsizing node's `size` − 1. */
const SIZED_CMDS = ["\\big", "\\Big", "\\bigg", "\\Bigg"]
/** The l/r/m suffix survives only as the node's mclass: `\bigl(` is mopen, `\big(` is mord. */
const SIZED_SUFFIX: Record<string, string> = { mopen: "l", mclose: "r", mrel: "m", mord: "" }

/**
 * ⟨a|, |b⟩ and ⟨a|H|b⟩ are states and amplitudes, not moduli or brackets. A
 * state's dimension is not fixed by the notation: a normalized state is
 * dimensionless, a position eigenket |x⟩ carries L^{-1/2}. Read as bars, the
 * ket `\left|0\right\rangle` shipped as a translation.
 */
const DIRAC_REASON =
  "Dirac bra–ket notation, whose states' dimensions depend on a normalization the dictionary does not record"

/** Every spelling of a vertical bar a `\left`/`\right` pair can carry. */
const VERT_DELIMS = new Set(["|", "\\vert", "\\lvert", "\\rvert", "\\|", "\\Vert", "\\lVert", "\\rVert"])

/**
 * Every spelling of an angle bracket a delimiter command can carry, keyed to
 * the glyph the pairing reads. KaTeX normalizes `\lang` to `\langle`, but
 * keeps `<`, `\lt` and `⟨` as written in a `\left`/`\right` pair and a sized
 * delimiter, where they typeset as angle brackets all the same. Tested
 * against `\langle` alone, the ket `\left|0\right>`, a spelling common in
 * older papers, shipped as a translation.
 */
const ANGLE_GLYPH: Record<string, string> = {
  "\\langle": "\\langle",
  "<": "\\langle",
  "\\lt": "\\langle",
  "⟨": "\\langle",
  "\\rangle": "\\rangle",
  ">": "\\rangle",
  "\\gt": "\\rangle",
  "⟩": "\\rangle",
}

type Delim =
  | { role: "open"; glyph: string; expects: string; tex: string }
  | { role: "close"; glyph: string; tex: string }
  | { role: "bar"; family: "single" | "double"; tex: string }

/**
 * A sized delimiter as written. Size is typography, but the node records it
 * only as fields and carries no source location, so its TeX is rebuilt from
 * them: `\bigl(` is size 1, mclass mopen, delim `(`. A spelling rebuilt
 * wrong is caught by the masked replay like any other emission.
 */
function sizedTexOf(n: any): string {
  return joinTex([`${SIZED_CMDS[n.size - 1]}${SIZED_SUFFIX[n.mclass]}`, n.delim])
}

/**
 * What a node is as a delimiter, or null. A sized delimiter opens exactly as
 * its glyph does and pairs with its partner in any size (`\big(` … `)`). A
 * sized bar given a side (`\bigl|` … `\bigr|`) is an opener and a closer
 * whose glyph names its bar family; the reader never sees that glyph, only
 * the written TeX. A sized angle bracket in any spelling (`\bigl<`,
 * `\bigr\gt`) is read as `\langle` or `\rangle`. A relation-class bar
 * (`\bigm|`) and a null delimiter (`\big.`) pair with nothing and are
 * declined by analyzeFactor.
 */
function delimOf(n: any): Delim | null {
  if (n?.type === "atom" && n.family === "open" && CLOSE_FOR[n.text]) {
    return { role: "open", glyph: n.text, expects: CLOSE_FOR[n.text], tex: n.text }
  }
  if (n?.type === "atom" && n.family === "close" && CLOSERS.has(n.text)) {
    return { role: "close", glyph: n.text, tex: n.text }
  }
  if ((n?.type === "textord" || n?.type === "mathord") && BAR_FAMILY[n.text]) {
    return { role: "bar", family: BAR_FAMILY[n.text], tex: n.text }
  }
  if (n?.type !== "delimsizing") return null
  const glyph: string = ANGLE_GLYPH[n.delim] ?? n.delim
  const family = BAR_FAMILY[glyph]
  if (n.mclass === "mopen" || n.mclass === "mord") {
    if (CLOSE_FOR[glyph]) return { role: "open", glyph, expects: CLOSE_FOR[glyph], tex: sizedTexOf(n) }
  }
  if (n.mclass === "mclose" || n.mclass === "mord") {
    if (CLOSERS.has(glyph)) return { role: "close", glyph, tex: sizedTexOf(n) }
  }
  if (family == null) return null
  if (n.mclass === "mord") return { role: "bar", family, tex: sizedTexOf(n) }
  if (n.mclass === "mopen") return { role: "open", glyph: `bar:${family}`, expects: `bar:${family}`, tex: sizedTexOf(n) }
  if (n.mclass === "mclose") return { role: "close", glyph: `bar:${family}`, tex: sizedTexOf(n) }
  return null
}

/** The bar family an opener's glyph fixes, if it is a bar with a side (`\lvert`, `\bigl|`). */
function barFamilyOfOpener(glyph: string): "single" | "double" | undefined {
  if (glyph === "\\lvert" || glyph === "bar:single") return "single"
  if (glyph === "\\lVert" || glyph === "bar:double") return "double"
  return undefined
}

const isVertGlyph = (glyph: string) =>
  glyph === "\\lvert" || glyph === "\\rvert" || glyph === "\\lVert" || glyph === "\\rVert" || glyph.startsWith("bar:")

/** A bar, bare or carrying a script on its closing side (`|z|^2` puts the second bar under a supsub). */
function barOf(n: any): { family: "single" | "double"; tex: string; scripted: boolean } | null {
  const d = delimOf(n)
  if (d?.role === "bar") return { family: d.family, tex: d.tex, scripted: false }
  if (n?.type === "supsub") {
    const b = delimOf(unwrap(n.base))
    if (b?.role === "bar") return { family: b.family, tex: b.tex, scripted: true }
  }
  return null
}

/**
 * Whether a list sets a bar anywhere a bra–ket could hide one: bare or sized
 * bars, `\mid`, `\middle|`, and bars inside braces, `\mathinner` (which
 * `\braket` builds) and style wrappers. `\langle{0|p|0}\rangle` hid its bars
 * in a brace group and translated as a bracket of moduli.
 */
function holdsBar(list: any[]): boolean {
  return list.some((x) => {
    if (x == null) return false
    if (barOf(x) != null || (x.type === "atom" && x.text === "\\mid")) return true
    if ((x.type === "delimsizing" || x.type === "middle") && BAR_FAMILY[x.delim]) return true
    if (x.type === "ordgroup" || WRAPPER_TYPES.has(x.type)) return holdsBar(Array.isArray(x.body) ? x.body : [x.body])
    return false
  })
}

function isMeaningfulNode(n: any): boolean {
  return n != null && !SKIP_TYPES.has(n.type) && !isEmptyOrdgroup(n)
}

/** The unpaired-bar decline. It claims no meaning: evaluation bars, conditionals and family mismatches all land here. */
function unpairedBarReason(tex: string): string {
  return `a bar “${tex}” the engine cannot pair as an absolute value`
}

/** Group flat ( … ) / [ … ] runs into synthetic nodes so sums inside plain parens don't split terms. */
function groupDelims(nodes: any[]): any[] {
  const out: any[] = []
  const stack: any[][] = [out]
  const openers: Extract<Delim, { role: "open" }>[] = []

  /** Pop the open group matching `close` and return the finished synthetic node. */
  const closeGroup = (close: Extract<Delim, { role: "close" }>, closeNode: any): any => {
    const top = openers[openers.length - 1]
    if (top == null || top.expects !== close.glyph) {
      // Saying "unbalanced delimiters" is a claim about the reader's equation,
      // and it is usually false: a ket |0⟩ or a bra ⟨a| is balanced, but its
      // bar is not a partner of an angle bracket. Report what the engine
      // actually found instead, quoting the delimiters as they were written.
      const angleAgainstBar =
        top != null &&
        ((top.glyph === "\\langle" && isVertGlyph(close.glyph)) || (isVertGlyph(top.glyph) && close.glyph === "\\rangle"))
      if (angleAgainstBar || (close.glyph === "\\rangle" && holdsBar(stack[stack.length - 1]))) {
        throw new Unsupported(DIRAC_REASON)
      }
      throw new Unsupported(
        top == null
          ? `the closing delimiter “${close.tex}” with no opener the engine recognizes`
          : `the closing delimiter “${close.tex}” where “${top.tex}” was open`,
      )
    }
    openers.pop()
    const body = stack.pop()!
    const parent = stack[stack.length - 1]
    const group = parent[parent.length - 1]
    // ⟨a|b⟩ and ⟨0|N|0⟩: bars inside angle brackets are bra–ket separators.
    if (top.glyph === "\\langle" && holdsBar(body)) throw new Unsupported(DIRAC_REASON)
    // The written closer, which is not always the opener's partner glyph as
    // spelled: `\big(` closes on `)`, `\bigr)` or `\Big)` alike.
    group.close = close.tex
    // The group spans opener to closer only when both are located in the same
    // text; a span stitched from two lexers would index neither, and dropping
    // the lexer would pass it off as the equation's own.
    if (group.loc && closeNode?.loc) {
      group.loc =
        group.loc.lexer === closeNode.loc.lexer
          ? { lexer: group.loc.lexer, start: group.loc.start, end: closeNode.loc.end }
          : null
    }
    return group
  }

  for (const n of nodes) {
    // `{[}` … `{]}` (LaTeXML's spelling): braces fence the delimiter off from
    // its partner, so the engine has nothing it could pair.
    if (n?.type === "ordgroup") {
      const inner = n.body.filter(isMeaningfulNode)
      const fenced = inner.length === 1 ? delimOf(inner[0]) : null
      if (fenced != null && fenced.role !== "bar") {
        throw new Unsupported(`a delimiter set apart in braces (“{${fenced.tex}}”), which the engine cannot pair`)
      }
    }
    const d = delimOf(n)
    if (d?.role === "open") {
      const group: any = {
        type: "__group",
        body: [] as any[],
        open: d.tex,
        close: null,
        bar: barFamilyOfOpener(d.glyph),
        loc: n.loc,
      }
      stack[stack.length - 1].push(group)
      stack.push(group.body)
      openers.push(d)
      continue
    }
    if (d?.role === "close") {
      closeGroup(d, n)
      continue
    }
    // KaTeX files the factorial and the question mark with the closing delimiters.
    if (n?.type === "atom" && n.family === "close") {
      throw new Unsupported(
        n.text === "!" ? "a factorial “!”, which is not supported yet" : `the symbol “${n.text}” in this position`,
      )
    }
    if (n?.type === "supsub") {
      const scripted = delimOf(unwrap(n.base))
      // A closing delimiter that carries a script is swallowed as the *base* of a
      // supsub — `(1+v)^2` puts `)` under the supsub — so the close atom never
      // reaches this level on its own. Close the group here and re-attach the
      // script to the finished group, or the opener would sit on the stack for
      // ever and the row would be reported as unbalanced.
      if (scripted?.role === "close") {
        const group = closeGroup(scripted, unwrap(n.base))
        const parent = stack[stack.length - 1]
        parent[parent.length - 1] = { ...n, base: group }
        continue
      }
      // A nuclide's prescript, `(^{12}C…)`, sets its script on the opener.
      if (scripted?.role === "open") {
        throw new Unsupported(`a script on the opening delimiter “${scripted.tex}”, which the engine cannot read`)
      }
    }
    stack[stack.length - 1].push(n)
  }
  if (openers.length > 0) {
    if (openers.some((o) => o.glyph === "\\langle") && stack.some(holdsBar)) throw new Unsupported(DIRAC_REASON)
    throw new Unsupported("unbalanced delimiters")
  }
  return pairBars(out)
}

/**
 * Pair the bare bars of one level. A bar carries no side of its own, so the
 * pairing is read from the only things that fix it: every bar opens or
 * closes; pairs are balanced, of one family, and hold something that does not
 * end on a binary operator; a bar at the start, or after an operator, a
 * relation, punctuation, an alignment tab, a slash or a function name
 * (`\ln|z|`) opens; a bar at the end, before a relation, punctuation or a tab,
 * or wearing a script, closes. When exactly one pairing satisfies that, the
 * notation admits no other reading and it is taken: |x| has the dimension of
 * x. None declines, and so do several, since the choice between them would be
 * a guess.
 */
function pairBars(level: any[]): any[] {
  const bars: number[] = []
  level.forEach((n, idx) => {
    if (barOf(n) != null) bars.push(idx)
  })
  if (bars.length === 0) return level
  const first = barOf(level[bars[0]])!
  // Old-style bra–kets set the angle brackets as the relations < and >:
  // `<1|p|1>` read |p| as a modulus between two comparisons.
  const isRel = (n: any, texts: string[]) => n?.type === "atom" && n.family === "rel" && texts.includes(n.text)
  const lt = level.findIndex((n) => isRel(n, ["<", "\\lt"]))
  const gt = level.map((n) => isRel(n, [">", "\\gt"])).lastIndexOf(true)
  if (lt >= 0 && bars.some((idx) => lt < idx && idx < gt)) throw new Unsupported(DIRAC_REASON)
  const ambiguous = `absolute-value bars “${first.tex}” whose pairing is ambiguous`
  // The search below is exponential in the bar count; no physics row comes near this.
  if (bars.length > 12) throw new Unsupported(ambiguous)

  const prevOf = (idx: number) => {
    for (let j = idx - 1; j >= 0; j -= 1) if (isMeaningfulNode(level[j])) return level[j]
    return null
  }
  const nextOf = (idx: number) => {
    for (let j = idx + 1; j < level.length; j += 1) if (isMeaningfulNode(level[j])) return level[j]
    return null
  }
  const isAtom = (n: any, families: string[]) => n?.type === "atom" && families.includes(n.family)
  const mustOpen = bars.map((idx) => {
    const prev = prevOf(idx)
    const afterFunction = prev?.type === "op" || (prev?.type === "supsub" && unwrap(prev.base)?.type === "op")
    // A slash divides by what follows it: in m/|v| the bar begins the divisor.
    const afterSlash = prev?.type === "textord" && prev.text === "/"
    return prev == null || prev.type === "__tab" || afterFunction || afterSlash || isAtom(prev, ["bin", "rel", "punct"])
  })
  const mustClose = bars.map((idx) => {
    const next = nextOf(idx)
    return barOf(level[idx])!.scripted || next == null || next.type === "__tab" || isAtom(next, ["rel", "punct"])
  })
  const contentOk = (openIdx: number, closeIdx: number) => {
    const inner = level.slice(openIdx + 1, closeIdx).filter(isMeaningfulNode)
    return inner.length > 0 && !isAtom(inner[inner.length - 1], ["bin"])
  }

  const solutions: ("O" | "C")[][] = []
  const roles: ("O" | "C")[] = []
  const open: number[] = []
  const walk = (k: number): void => {
    if (solutions.length > 1) return
    if (k === bars.length) {
      if (open.length === 0) solutions.push([...roles])
      return
    }
    const bar = barOf(level[bars[k]])!
    if (!mustClose[k]) {
      roles.push("O")
      open.push(k)
      walk(k + 1)
      open.pop()
      roles.pop()
    }
    const top = open[open.length - 1]
    if (!mustOpen[k] && top != null) {
      if (barOf(level[bars[top]])!.family === bar.family && contentOk(bars[top], bars[k])) {
        roles.push("C")
        open.pop()
        walk(k + 1)
        open.push(top)
        roles.pop()
      }
    }
  }
  walk(0)
  if (solutions.length === 0) throw new Unsupported(unpairedBarReason(first.tex))
  if (solutions.length > 1) throw new Unsupported(ambiguous)

  const roleAt = new Map<number, "O" | "C">()
  bars.forEach((idx, k) => roleAt.set(idx, solutions[0][k]))
  const out: any[] = []
  const lists: any[][] = [out]
  const groups: any[] = []
  level.forEach((n, idx) => {
    const role = roleAt.get(idx)
    const bar = barOf(n)
    if (role === "O" && bar != null) {
      const group: any = { type: "__group", body: [], open: bar.tex, close: null, bar: bar.family, loc: n.loc }
      lists[lists.length - 1].push(group)
      lists.push(group.body)
      groups.push(group)
      return
    }
    if (role === "C" && bar != null) {
      lists.pop()
      const group = groups.pop()
      group.close = bar.tex
      const closeNode = bar.scripted ? unwrap(n.base) : n
      // Located only when both bars are located in the same text (closeGroup).
      if (group.loc && closeNode.loc) {
        group.loc =
          group.loc.lexer === closeNode.loc.lexer
            ? { lexer: group.loc.lexer, start: group.loc.start, end: closeNode.loc.end }
            : null
      }
      const parent = lists[lists.length - 1]
      if (bar.scripted) parent[parent.length - 1] = { ...n, base: group }
      return
    }
    lists[lists.length - 1].push(n)
  })
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

function isSignToken(n: any): boolean {
  const u = unwrap(n)
  return u?.type === "atom" && u.family === "bin" && (u.text === "+" || u.text === "-" || BRANCH_OPS.has(u.text))
}

/**
 * Parse a superscript as a rational power, or classify it. A superscript that
 * is only signs, or that ends in one (`X^{+}`, `\sigma^{\pm}`, `X^{n+}`), is a
 * label — a light-cone index or a charge state. A sign there has no operand,
 * so it is never read as a power.
 */
function classifySup(sup: any): { p: number; q: number } | "index" | "prime" | "signLabel" | "expr" {
  const nodes = nodeListOf(sup).filter((n) => !SKIP_TYPES.has(n.type))
  if (nodes.length === 0) return "expr"
  if (nodes.some((n) => textOf(n) === "\\prime")) return "prime"
  if (isSignToken(nodes[nodes.length - 1])) return "signLabel"
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

/**
 * A digit carrying a superscript and no subscript: a numeral raised to a
 * power. KaTeX sets the script on the last token before it, so `10^{-7}`
 * parses as the digit 1 followed by the supsub 0^{-7}, and the engine looked
 * up "0" as an unknown symbol — `c = 3\times10^{8}` declined on it instead of
 * saying what it is, a numeric value for c. The supsub closes the digit run
 * it continues (or stands as a numeral of its own, `2^{10}`), and a numeral
 * to any power is dimensionless.
 */
function numeralPowerOf(node: any): any | null {
  const n = unwrap(node)
  if (n?.type !== "supsub" || n.sup == null || n.sub != null) return null
  const base = textOf(n.base)
  return base != null && /^[0-9]$/.test(base) ? n : null
}

/**
 * The exponent of a numeral power, when it is not a number: read as the
 * exponent of e is, an expression that must be dimensionless and is restored
 * against that (`10^{M/r}` needs G/c² as much as `e^{M/r}` does), so it is
 * rebuilt from its analysis. A number (`8`, `-34`, `\frac{1}{2}`) gives null
 * and the power is emitted as written.
 */
function symbolicExponentOf(power: any, ctx: Ctx): SumInfo | null {
  const nodes = nodeListOf(power.sup).filter((x) => !SKIP_TYPES.has(x.type))
  const first = unwrap(nodes[0])
  const signed = first?.type === "atom" && first.family === "bin" && (first.text === "-" || first.text === "+")
  const rest = signed ? nodes.slice(1) : nodes
  if (rest.length > 0 && rest.every((x) => /^[0-9.]$/.test(textOf(x) ?? ""))) return null
  const frac = rest.length === 1 ? unwrap(rest[0]) : null
  if (frac?.type === "genfrac" && intOf(nodeListOf(frac.numer)) != null && intOf(nodeListOf(frac.denom)) != null) {
    return null
  }
  return parseSum(nodeListOf(power.sup), ctx, { anchor: "forced", target: ZERO })
}

/** The value of a numeral factor written as a plain decimal, or null (a powered numeral, `10^{8}`, is not one). */
function plainNumeralValue(f: Factor): number | null {
  const tex = f.emit()
  return f.kind === "num" && /^[0-9.]+$/.test(tex) ? Number.parseFloat(tex) : null
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

/**
 * A node that sets nothing: spacing, or a group (braces, a style or a font)
 * holding nothing but spacing and such groups. `{}`, `{\,}` and `{{}}` are all
 * blank, and a script set on one is a script on nothing.
 */
function isBlankNode(n: any): boolean {
  if (n == null || SKIP_TYPES.has(n.type)) return true
  const cur = unwrap(n)
  return cur?.type === "ordgroup" && Array.isArray(cur.body) && cur.body.every(isBlankNode)
}

/** A script on nothing (`{}^{2}`, `{}_{0}`): a rider, or a script on whatever it is set beside. */
function isFloatingScript(n: any): boolean {
  return n?.type === "supsub" && isBlankNode(n.base)
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
  // as `G = G = 1`, which states something false about c. A relation made only
  // of constants never gets here (declarationGuard); this is a constant term
  // among quantities, `g_{00} \approx -c^2 - 2\Phi`, whose other terms the
  // registry reads with a dimension the constant does not have. That is a fact
  // about the readings, not about the author, and it fires for `a = b = c` too.
  if (isPureConstant(t)) {
    throw new Unsupported(
      `a term made only of c and G that the registry's readings of the other terms would require rewriting into another constant (term “${termQuote(t, ctx)}”)`,
    )
  }
  const solved = solveCG(need)
  if (typeof solved === "string") {
    throw new Unsupported(`${solved} (term “${termQuote(t, ctx)}”)`)
  }
  // Geometrized target: consistency is verified (above), but no constants are
  // inserted — the ones present get stripped at emission instead.
  if (ctx.strip) return null
  // Inside a font's argument the constant would be set in that font: `{\bf p +
  // m}` came back as `{\bf p + mc}c`, a bold c beside a bold p. Only a term's
  // outer constants can stand outside the font, so an inner one declines.
  if (ctx.font != null) {
    throw new Unsupported(
      `a constant to restore inside the font “${ctx.font.tex}”, where it would be set in that font and read as another symbol`,
    )
  }
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
  try {
    return maskedEmission(ctx, () => emitTerm(t, ctx))
  } catch {
    return t.src
  }
}

/** An emission replayed with every insertion and strip masked: the source as the reader wrote it. */
function maskedEmission<T>(ctx: Ctx, emit: () => T): T {
  const previous = ctx.mask
  ctx.mask = true
  try {
    return emit()
  } finally {
    ctx.mask = previous
  }
}

/** A term built only from powers of c and G — a constant, with nothing to restore. */
function isPureConstant(t: TermInfo): boolean {
  const meaningful = t.factors.filter((f) => f.kind !== "glue")
  return meaningful.length > 0 && meaningful.every((f) => f.constant != null)
}

/**
 * Every factor of every term of a sum, for a wrapping factor's `parts`, and
 * whether flattening them lost a second term or a sign.
 */
function partsOf(sum: SumInfo): Pick<Factor, "parts" | "signedParts"> {
  const signed = sum.multiTerm || sum.terms.some((t) => t.sign !== "" && t.sign !== "+")
  return { parts: sum.terms.flatMap((t) => t.factors), signedParts: signed || undefined }
}

/**
 * What a run of factors is built from, read through groups, fractions, roots
 * and powered compounds: "num" when only numerals, "unit" when only numerals
 * and at least one of the constants a unit system can set to one, null when
 * anything else is in it. `8\pi G`, `\frac{c^{4}}{G}` and `{c}` are "unit".
 */
function unitLeavesOf(factors: Factor[]): "num" | "unit" | null {
  let found: "num" | "unit" | null = null
  for (const f of factors) {
    if (f.kind === "glue") continue
    const own: "num" | "unit" | null =
      f.kind === "num"
        ? "num"
        : f.unitConstant === true
          ? "unit"
          : f.frac != null
            ? unitLeavesOf([...f.frac.num, ...f.frac.den])
            : f.parts != null
              ? unitLeavesOf(f.parts)
              : null
    if (own == null) return null
    if (found !== "unit") found = own
  }
  return found
}

/**
 * The relations a unit convention is declared with: an equality, an identity,
 * a definition. They are matched against what each relation is, not how it was
 * spelled: `\coloneqq` is the definition `:=`, and matched by its spelling,
 * `c \coloneqq 1` was called a comparison of c with a number.
 */
const DECLARING_RELS = new Set(["=", "\\equiv", ":="])

/** A wrapping factor anywhere in the run lost a second term or a sign when its parts were flattened. */
function wrapsSignedParts(factors: Factor[]): boolean {
  return factors.some(
    (f) =>
      f.signedParts === true ||
      (f.frac != null && wrapsSignedParts([...f.frac.num, ...f.frac.den])) ||
      (f.parts != null && wrapsSignedParts(f.parts)),
  )
}

/** No minus or branch sign before the term, and none inside it. */
function isUnsigned(t: TermInfo): boolean {
  return (t.sign === "" || t.sign === "+") && !wrapsSignedParts(t.factors)
}

/** The numeral 1 with no minus sign on it: the value a unit system gives a constant. */
function isPlainOne(t: TermInfo): boolean {
  const numerals = t.factors.filter((f) => f.kind !== "glue")
  return (
    isUnsigned(t) &&
    t.slashIdx < 0 &&
    numerals.length > 0 &&
    numerals.every((f) => plainNumeralValue(f) === 1)
  )
}

/**
 * A relation among the constants themselves has no quantity in it to restore,
 * and a restoration can only make it false: `c = 1` shipped in SI under the
 * banner "both sides carry m s⁻¹", and `c = -26` (a central charge the
 * registry reads as the speed of light) came out as `c = -26c`. When every
 * term of the row's sides is numerals and c, G, ħ or k_B (read through
 * groups, fractions and roots), and at least one of the constants is there,
 * the row declines before any insertion, on every target.
 *
 * The reason names what the row states, and only a notational fact decides
 * it. A row is a declaration of the unit convention only as a declaration is
 * written: every relation an equality, every side one unsigned product of the
 * constants or the numeral 1, and at least one side that 1 (`G = c = 1`,
 * `8\pi G = 1`, `\frac{c^4}{G} = 1`). Decided from the numerals alone, the
 * reason called `\hbar \ne 1` (ħ is not one), `c < 1` (the usual bound on a
 * central charge) and `c = -1` (no unit system sets c to −1) declarations,
 * while `c = -2` got the numeric-value reason. Any other row with a numeral in it
 * gives a constant a value in units it does not name (`c = 299792458`,
 * `c = -1`, `c^2 - 1 = 0`), or compares one with a number (`c < 1`), and
 * `c = -26` is not even about the speed of light. A row with no numeral
 * besides zero (`c > G`, `c - G = 0`) only relates the constants.
 */
function declarationGuard(sums: (SumInfo | null)[], relKinds: string[], ctx: Ctx): void {
  const sides = sums.filter((sum): sum is SumInfo => sum != null)
  const terms = sides.flatMap((sum) => sum.terms)
  const kinds = terms.map((t) => unitLeavesOf(t.factors))
  if (!kinds.includes("unit") || kinds.includes(null)) return
  const equalities = relKinds.every((rel) => DECLARING_RELS.has(rel))
  const declares =
    equalities &&
    sides.every(
      (sum) =>
        !sum.multiTerm &&
        (isPlainOne(sum.terms[0]) || (isUnsigned(sum.terms[0]) && unitLeavesOf(sum.terms[0].factors) === "unit")),
    ) &&
    sides.some((sum) => !sum.multiTerm && isPlainOne(sum.terms[0]))
  if (declares) {
    throw new Unsupported(
      "a relation between the constants themselves — a declaration of the unit convention rather than a physical relation to restore",
    )
  }
  if (!terms.some((t, idx) => kinds[idx] === "num" && !t.isZero)) {
    throw new Unsupported("a relation between the constants themselves, with no quantity in it to restore")
  }
  // A side made only of constants is quoted whole (`c + G = 1` gives a value
  // to c + G, not to c); otherwise the first constant term is.
  const side = sides.find((sum) => sum.terms.some((t) => unitLeavesOf(t.factors) === "unit")) as SumInfo
  const quote =
    side.multiTerm && side.terms.every((t) => unitLeavesOf(t.factors) === "unit")
      ? maskedEmission(ctx, () => emitSum(side.terms, side.ops, side.terms.map(() => null), ctx))
      : termQuote(terms[kinds.indexOf("unit")], ctx)
  throw new Unsupported(
    equalities
      ? `a numeric value for “${quote}”, in units the equation does not state`
      : `a comparison of “${quote}” with a number, in units the equation does not state`,
  )
}

/** A sum's leading sign as emitted. A branch sign is a control word, set apart: `\pm` + `M` reads `\pmM`. */
function leadSign(sign: string): string {
  return BRANCH_OPS.has(sign) ? `${sign} ` : sign
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
      const body = ins ? emitTermWith(t, ins.a, ins.b, ctx) : emitTerm(t, ctx)
      const lead = idx === 0 ? leadSignTex(t, ctx) : ` ${foldedOp(ops[idx - 1], t.sign)} `
      return lead + body
    })
    .join("")
}

/**
 * A sign written right after a product sign or a “/”, spacing aside: `r \cdot -r`
 * is r·(−r), the sign on the next factor. Splitting there left the product
 * sign closing one term and the sign opening the next, and `t = r \cdot -r`
 * shipped as `t = \frac{r\cdot}{c} - \frac{r}{c}`, where r·(−r) is m² against
 * a t in seconds. The engine reads no sign on a factor, so it declines.
 */
function productSignBeforeSignGuard(termNodes: any[], sign: string): void {
  for (let idx = termNodes.length - 1; idx >= 0; idx -= 1) {
    const n = unwrap(termNodes[idx])
    if (n == null || isEmptyOrdgroup(n) || SKIP_TYPES.has(n.type)) continue
    const product = n.type === "atom" && n.family === "bin" && (n.text === "\\cdot" || n.text === "\\times")
    if (product || (n.type === "textord" && n.text === "/")) {
      throw new Unsupported(
        `the sign “${sign}” right after “${n.text}”, a sign on a factor rather than between terms, which is not supported`,
      )
    }
    return
  }
}

/**
 * A sum's terms, split at its signs. `a \pm b` abbreviates the pair of sums
 * a + b and a − b, and each branch is a sum the sum rule governs. What a term
 * needs restored depends on its dimension, never on its sign, so both branches
 * take the same constants and one emission, keeping \pm, serves both; the same
 * holds for \mp and for a branch sign leading the first term. A sign written
 * beside a branch sign (`a \pm -b`, `-\pm a`) would have to be folded into it,
 * and no fold keeps both branches, so it declines.
 */
function parseSum(nodes: any[], ctx: Ctx, mode: SumMode, spacing: FactorSpacing | null = null): SumInfo {
  const grouped = groupDelims(nodes)
  const termNodeLists: any[][] = []
  const ops: string[] = []
  const signs: string[] = []
  let current: any[] = []
  let pendingSign = ""
  let sawSign = false
  let spacedSign = false
  for (const n of grouped) {
    if (isEmptyOrdgroup(n)) continue
    if (current.length === 0 && n != null && SKIP_TYPES.has(n.type)) continue
    const pm = isPlusMinus(n)
    const branch = n?.type === "atom" && n.family === "bin" && BRANCH_OPS.has(n.text) ? (n.text as string) : null
    if ((pm != null || branch != null) && current.length === 0) {
      sawSign = true
      const besideBranch =
        BRANCH_OPS.has(pendingSign) || (ops.length > 0 && BRANCH_OPS.has(ops[ops.length - 1]))
      if (besideBranch || (branch != null && (pendingSign !== "" || ops.length > 0))) {
        throw new Unsupported("a sign directly beside “\\pm” or “\\mp”, which the engine does not fold")
      }
      if (branch != null) pendingSign = branch
      else if (pm === "-") pendingSign = pendingSign === "-" ? "+" : "-"
      else if (pendingSign === "") pendingSign = "+"
      continue
    }
    if (pm != null || branch != null) {
      productSignBeforeSignGuard(current, (pm ?? branch) as string)
      if (spacing != null && spacedBeforeSign(current, spacing)) spacedSign = true
      termNodeLists.push(current)
      signs.push(pendingSign)
      ops.push((pm ?? branch) as string)
      current = []
      pendingSign = ""
      continue
    }
    current.push(n)
  }
  if (current.length === 0 && termNodeLists.length === 0) {
    throw new Unsupported(
      sawSign ? "signs with nothing to act on (a sign pattern such as a metric signature)" : "an empty expression",
    )
  }
  if (current.length === 0) throw new Unsupported("an expression that ends in an operator")
  termNodeLists.push(current)
  signs.push(pendingSign)

  const terms = termNodeLists.map((list, idx) => analyzeTerm(list, signs[idx], ctx, spacing))
  // Like the guard between factors, thrown once every term has been read.
  if (spacedSign) throw new Unsupported(SPACING_REASON)

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

/**
 * Explicit spacing between two factors of a term — the two-statements trap.
 *
 * Authors set two statements side by side with nothing but space between them:
 * `t = 0 \qquad r = 2M` means "t = 0, and r = 2M". The row splitter sees one
 * chain with two relations, and the space lands inside the middle side as glue
 * between the factors 0 and r, so the chain reads t = 0·r = 2M and gets
 * restored as t = \frac{0r}{c} = \frac{2GM}{c^{3}}. Nothing in the parse tree
 * says which reading the author meant; a run of `\;`, `~` or `\ ` does the same
 * job as `\qquad` for some authors, and a thin space between factors is
 * ordinary product typography for others. The engine therefore never picks:
 * where the two-statements reading is live, spacing between factors declines.
 *
 * It is live in two cases, and the side's terms are told which one holds:
 * - "any": the row holds more than one relation, so a second statement has
 *   somewhere to stand. Any positive space between two factors declines,
 *   `\,` included — `E = m\,c^2 = M` is the price of refusing to guess.
 * - "wide": any other row. A run of spacing totalling at least a quad is
 *   never product typography, so it declines too (`r = 2M \qquad (1)`, an
 *   equation label, would otherwise multiply the right side by (1)).
 * Only a row's own sides are guarded. Spacing inside a fraction, a root or a
 * bracket sits between delimiters that already make it one expression.
 * Spacing between a function head and its argument (`\sin\,\theta`) is inside
 * one factor, and zero-width break hints and negative kerns separate nothing.
 * The same two cases guard the spacing right before a sign that separates two
 * terms, where a second statement can open as well (spacedBeforeSign).
 */
type FactorSpacing = "wide" | "any"

const SPACING_REASON = "explicit spacing between two factors — two statements or one product? (select a single equation)"

/** Width in em at the text size, per KaTeX's unit table (1em = 10pt, 1ex = 0.431em, 1mu = 1/18em). */
const EM_PER_UNIT: Record<string, number> = {
  em: 1,
  ex: 0.431,
  mu: 1 / 18,
  pt: 0.1,
  px: 0.1 * (803 / 800),
  bp: 0.1 * (803 / 800),
  pc: 0.1 * 12,
  dd: 0.1 * (1238 / 1157),
  cc: 0.1 * (14856 / 1157),
  nd: 0.1 * (685 / 642),
  nc: 0.1 * (1370 / 107),
  sp: 0.1 / 65536,
  mm: 0.1 * (7227 / 2540),
  cm: 0.1 * (7227 / 254),
  in: 0.1 * 72.27,
}

/**
 * The width of one spacing node in em. An interword space (`\ `, `~`,
 * `\space`) counts as a third of an em, TeX's own interword width; a spacing
 * node whose width cannot be read counts as wide, so it can only decline.
 */
function skipEm(n: any): number {
  if (n.type === "kern") {
    const per = EM_PER_UNIT[n.dimension?.unit]
    const num = n.dimension?.number
    return per == null || typeof num !== "number" ? Number.POSITIVE_INFINITY : num * per
  }
  if (n.type === "spacing") {
    if (n.text === "\\nobreak" || n.text === "\\allowbreak") return 0
    return 1 / 3
  }
  return Number.POSITIVE_INFINITY
}

/** Whether a term's node list carries guarded spacing between two of its factors. */
function spacedBetweenFactors(nodes: any[], spacing: FactorSpacing): boolean {
  let seenFactor = false
  let afterHead = false
  let run = 0
  let spaced = false
  let wide = false
  for (const raw of nodes) {
    const n = unwrap(raw)
    if (n == null) continue
    if (SKIP_TYPES.has(n.type)) {
      if (!seenFactor || afterHead) continue
      const em = skipEm(n)
      run += em
      if (em > 0) spaced = true
      if (run >= 1 - 1e-9) wide = true
      continue
    }
    run = 0
    afterHead = false
    const glue =
      (n.type === "atom" && n.family === "bin" && (n.text === "\\cdot" || n.text === "\\times")) ||
      (n.type === "textord" && n.text === "/")
    if (glue) continue
    if (wide || (spacing === "any" && spaced)) return true
    seenFactor = true
    spaced = false
    wide = false
    afterHead = isFuncHead(n)
  }
  return false
}

/**
 * Whether the spacing that closes a term, right before the sign that ends it,
 * is guarded. A statement boundary can fall there as well as between two
 * factors: `t = 0 \qquad -r = 2M` is "t = 0, and −r = 2M", but the sign
 * splits the middle side into the terms 0 and −r, so no two factors had the
 * space between them and the chain shipped as t = 0 − r/c = 2GM/c³. The same
 * two cases hold: in a row with more than one relation any positive space
 * before a term-separating sign declines, and in any row a run of at least a
 * quad does. A thin space before a sign in a single-relation row
 * (`-c^2\,dt^2 \, + dx^2`) is sum typography and stays.
 */
function spacedBeforeSign(termNodes: any[], spacing: FactorSpacing): boolean {
  let run = 0
  let spaced = false
  for (let idx = termNodes.length - 1; idx >= 0; idx -= 1) {
    const n = unwrap(termNodes[idx])
    if (n == null || isEmptyOrdgroup(n)) continue
    if (!SKIP_TYPES.has(n.type)) break
    const em = skipEm(n)
    run += em
    if (em > 0) spaced = true
  }
  return run >= 1 - 1e-9 || (spacing === "any" && spaced)
}

function analyzeTerm(nodes: any[], sign: string, ctx: Ctx, spacing: FactorSpacing | null): TermInfo {
  const factors: Factor[] = []
  let slashIdx = -1
  let i = 0
  const push = (f: Factor) => factors.push(f)
  const spacedFactors = spacing != null && spacedBetweenFactors(nodes, spacing)

  while (i < nodes.length) {
    const raw = nodes[i]
    const n = unwrap(raw)
    if (n == null) {
      i += 1
      continue
    }
    if (SKIP_TYPES.has(n.type)) {
      const text = spacingTexOf(raw, ctx)
      const kern = n.type === "kern" ? kernCommandOf(n) : undefined
      push({ kind: "glue", dim: ZERO, emit: () => text, kern })
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
    // A row's own side meets only the bare commas translateLine leaves in its
    // statements, a list. Anywhere else a comma or a semicolon sits inside an
    // expression, and "select a single equation" would be untrue there.
    if (n.type === "atom" && n.family === "punct") {
      throw new Unsupported(
        spacing == null && isListPunct(n)
          ? "a comma or semicolon inside an expression (arguments, a tuple, or a list), which the engine does not read as a product"
          : LIST_REASON,
      )
    }

    // Digit runs → one numeral factor, with the power it is raised to.
    const digit = textOf(n)
    if ((digit != null && /^[0-9.]$/.test(digit)) || numeralPowerOf(n) != null) {
      let text = ""
      let end = i
      while (end < nodes.length) {
        const t = textOf(unwrap(nodes[end]))
        if (t != null && /^[0-9.]$/.test(t)) {
          text += t
          end += 1
        } else break
      }
      const power = end < nodes.length ? numeralPowerOf(nodes[end]) : null
      const frozen = text
      if (power == null) {
        push({ kind: "num", dim: ZERO, emit: () => frozen, numeralEdge: () => true })
      } else {
        const exponent = symbolicExponentOf(power, ctx)
        const written = frozen + srcOf(power, ctx)
        const base = frozen + srcOf(power.base, ctx)
        const emit = exponent == null ? () => written : () => `${base}^{${exponent.emit()}}`
        push({ kind: "num", dim: ZERO, emit, numeralEdge: () => true })
        end += 1
      }
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

    // A delimited group right after a function head is the whole argument:
    // `\cos(\theta)\,v^{2}` is v² cos θ, and `\sin(t)/M` is sin t over M. The
    // closing delimiter ends the argument; nothing written after it is read
    // into the function, and spacing written between the head and the group
    // is kept (headSpacingTex). Any other argument is the rest of the product,
    // up to the next function head: `\sin\omega t` is sin(ωt).
    if (isFuncHead(n)) {
      let next = i + 1
      while (next < nodes.length && SKIP_TYPES.has(unwrap(nodes[next])?.type)) next += 1
      floatingScriptAfterHeadGuard(raw, next < nodes.length ? nodes[next] : null, ctx)
      const delimited = next < nodes.length ? delimitedArgumentOf(nodes[next]) : null
      if (delimited != null) {
        push(analyzeDelimitedFunction(raw, nodes.slice(i + 1, next), delimited, ctx))
        i = next + 1
        continue
      }
      let end = i + 1
      while (end < nodes.length && !isFuncHead(unwrap(nodes[end]))) end += 1
      const argNodes = nodes.slice(i + 1, end)
      if (argNodes.length === 0) throw new Unsupported("a function with no argument")
      push(analyzeFunction(raw, argNodes, ctx))
      i = end
      continue
    }

    riderDigitGuard(nodes, i, ctx)
    push(analyzeFactor(raw, ctx))
    i += 1
  }

  // Thrown only once every factor has been read, so a truer reason (\text
  // content, an unsupported construct) is the one the reader sees.
  if (spacedFactors) throw new Unsupported(SPACING_REASON)
  keepNumeralsApart(factors, ctx)

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
      .every((f) => plainNumeralValue(f) === value)

  return {
    sign,
    factors,
    slashIdx,
    dim: total,
    pureNumeral,
    isZero: numeralsAre(0),
    // `v = \pm 1` states a value, not a convention: it is restored like `v = -1`.
    isUnitLiteral: sign !== "-" && !BRANCH_OPS.has(sign) && numeralsAre(1),
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
 * A spacing node emitted as it was written. `\ `, `\space`, `\nobreak` and a
 * spelled-out `\nobreakspace` carry their own span and are sliced. `~` does
 * not: it is KaTeX's macro for `\nobreakspace`, so its node is located in that
 * macro body, and a node located there with that text can only have been
 * written as `~` (KaTeX defines no other macro with that body). Kerns carry no
 * span at all and are dropped: the backstop's comparison ignores the ones it
 * can name (`\,`, `\;`, `\quad`, …), and any other (`\enspace`, `\hspace`)
 * leaves the rebuilt equation short of the source, so it declines. Between
 * two numerals a dropped kern fuses them, so there it is rebuilt instead
 * (keepNumeralsApart).
 */
function spacingTexOf(raw: any, ctx: Ctx): string {
  const own = safeSrc(raw, ctx)
  if (own) return own
  const n = unwrap(raw)
  const fromTilde =
    n?.type === "spacing" && n.text === "\\nobreakspace" && n.loc?.lexer?.input === "\\nobreakspace"
  return fromTilde ? "~" : ""
}

/**
 * Source text of a node, rebuilding the font wrappers that carry no span of
 * their own. `spanOf` descends past a font node to the letter inside it, so
 * slicing `\mathrm{d}` returns `d` and the wrapper is lost; analyzeFactor and
 * baseTexOf already reconstruct, and differentials now do too.
 */
function wrappedTexOf(raw: any, ctx: Ctx): string {
  const peeled = peelStyles(raw)
  if (peeled?.type === "font") return fontTexOf(peeled, wrappedTexOf(peeled.body, ctx), ctx)
  // A supsub slices faithfully, order and spelling kept, unless a part of it is
  // a font, which has no span to slice: then it is rebuilt from its parts.
  if (
    peeled?.type === "supsub" &&
    peeled.base != null &&
    [peeled.base, peeled.sub, peeled.sup].some((x) => x != null && peelStyles(x)?.type === "font")
  ) {
    return `${wrappedTexOf(peeled.base, ctx)}${scriptsTex(peeled, ctx)}`
  }
  return safeSrc(raw, ctx)
}

/**
 * KaTeX's name for a font, and every command that produces it. The font node
 * records only the name, so `{\rm e}` came back as `\mathrm{e}` and `{\bf B}`
 * as `\mathbf{B}`, and the backstop declined the divergence. The command is
 * read from the source immediately before the font's body, as fracCmdOf reads
 * \tfrac; the name is the fallback when the body has no position.
 */
const FONT_SPELLINGS: Record<string, string[]> = {
  mathrm: ["mathrm", "rm"],
  mathbf: ["mathbf", "bf"],
  mathit: ["mathit", "it"],
  mathcal: ["mathcal", "cal"],
  mathsf: ["mathsf", "sf"],
  mathtt: ["mathtt", "tt"],
  boldsymbol: ["boldsymbol", "bm"],
  mathbb: ["mathbb", "Bbb"],
  mathfrak: ["mathfrak", "frak"],
  mathscr: ["mathscr"],
  mathnormal: ["mathnormal"],
}

/** Old-style switches act on the rest of their group, so they are re-emitted inside braces of their own. */
const OLD_STYLE_SWITCHES = new Set(["rm", "bf", "it", "cal", "sf", "tt"])
const OLD_STYLE_GROUP = /^\{\\(?:rm|bf|it|cal|sf|tt) /

function fontCmdOf(font: any, ctx: Ctx): string {
  const span = spanOf(font.body, ctx.input)
  const written = span ? /\\([a-zA-Z]+)\s*\{?\s*$/.exec(ctx.input.slice(0, span[0])) : null
  return written && (FONT_SPELLINGS[font.font] ?? []).includes(written[1]) ? written[1] : font.font
}

function fontTexOf(font: any, bodyTex: string, ctx: Ctx): string {
  const cmd = fontCmdOf(font, ctx)
  // The body's own group braces are redundant inside the font's: \mathbf{{p + q}} → \mathbf{p + q}.
  const body = bodyTex.startsWith("{") && outerBracesArePartners(bodyTex) ? bodyTex.slice(1, -1) : bodyTex
  return OLD_STYLE_SWITCHES.has(cmd) ? `{\\${cmd} ${body}}` : `\\${cmd}{${body}}`
}

/**
 * Upright type is a statement about what a letter is. ISO 80000-2 sets
 * variables in italic and sets upright only what is not one: a unit (m, Hz,
 * GeV), a descriptive label (eff, weak), an operator (Tr, det) or a
 * mathematical constant. A run of upright letters is therefore one word, never
 * a product of one-letter symbols — `\omega = 2\pi\,\mathrm{Hz}` read as H·z,
 * and `E = \mathrm{cm}` as the speed of light times a mass — and a single
 * upright letter is no variable either: `r = 3\,\mathrm{m}` restored the metre
 * as a mass, to `\frac{3G\mathrm{m}}{c^{2}}`. Only the letters with an upright
 * reading of their own go on to be read: the differential d, Euler's e and the
 * imaginary i.
 *
 * Upright means \mathrm (and \rm) and the upright text commands. A run of
 * letters under any other font is one name or a product of symbols, and the
 * notation does not say which — `\mathit` exists to set multi-letter names,
 * while `\mathbf{AB}` can be a product of two matrices — so it declines too.
 * A single letter under another font is a symbol like any other (\mathbf{v},
 * \mathcal{L}).
 */
const UPRIGHT_FONTS = new Set(["mathrm"])
const UPRIGHT_TEXT_FONTS = new Set([
  "\\text",
  "\\textrm",
  "\\textup",
  "\\textnormal",
  "\\textbf",
  "\\textsf",
  "\\texttt",
])
const UPRIGHT_LETTERS_READ = new Set(["d", "e", "i"])
/** Words that make the equation prose rather than one statement. */
const PROSE_WORDS = new Set([
  "where",
  "for",
  "with",
  "and",
  "if",
  "at",
  "when",
  "or",
  "as",
  "on",
  "in",
  "else",
  "otherwise",
  "for all",
  "pour tout",
  "such that",
  "s.t",
  "i.e",
  "e.g",
  "since",
  "then",
])
/** Placeholders for a constant whose value, and so whose dimension, is left open. */
const PLACEHOLDER_WORDS = new Set(["const", "constant", "cst"])

type SpelledWord = { letters: string; quote: string }

/**
 * The word a font's or a \text's argument spells: Latin letters, with spacing
 * and sentence punctuation between or after them, and nothing else. Anything
 * else inside (a digit, a Greek letter, a script) gives null, and the argument
 * is read as it always was. The quote is the word as written.
 */
function spelledWordOf(nodes: any[], ctx: Ctx): SpelledWord | null {
  let letters = ""
  const located: any[] = []
  for (const n of nodes) {
    if (n == null) continue
    if (SKIP_TYPES.has(n.type)) {
      letters += " "
      continue
    }
    const isLetter = (n.type === "mathord" || n.type === "textord") && /^[A-Za-z]$/.test(n.text)
    const isPunct =
      (n.type === "textord" && /^[.,;:]$/.test(n.text)) || (n.type === "atom" && n.family === "punct")
    if (!isLetter && !isPunct) return null
    letters += n.text
    located.push(n)
  }
  // A comma or a semicolon with a letter after it separates a list; only a
  // period (i.e., const.) sits inside a word.
  if (!/[A-Za-z]/.test(letters) || /[,;:][^A-Za-z]*[A-Za-z]/.test(letters)) return null
  const word = letters.replace(/\s+/g, " ").trim()
  return { letters: word, quote: srcOfNodes(located, ctx) || word }
}

/** The prose and placeholder readings of a spelled word, which hold under any font. */
function proseOrPlaceholderReason(word: SpelledWord): string | null {
  const bare = word.letters.toLowerCase().replace(/^[\s.,;:]+|[\s.,;:]+$/g, "")
  if (PROSE_WORDS.has(bare)) return `prose (“${word.quote}”) inside the equation — select a single equation`
  if (PLACEHOLDER_WORDS.has(bare)) {
    return `an unspecified constant (“${word.quote}”), whose dimension the notation does not fix`
  }
  return null
}

/**
 * Why a spelled word cannot be read as symbols, or null when it can: a single
 * letter under a font that is not upright, or an upright d, e or i.
 */
function spelledWordReason(word: SpelledWord, upright: boolean, fontTex: string): string | null {
  const prose = proseOrPlaceholderReason(word)
  if (prose != null) return prose
  const letterCount = word.letters.replace(/[^A-Za-z]/g, "").length
  if (letterCount >= 2) {
    if (!upright) {
      return `the multi-letter name “${word.quote}” under “${fontTex}” — one name or a product of symbols, which the notation does not say`
    }
    return /\s/.test(word.letters) || /\s/.test(word.quote)
      ? `the upright words “${word.quote}” — units, labels or operators, not a product of symbols`
      : `the upright word “${word.quote}” — a unit, a label or an operator, not a product of symbols`
  }
  const letter = word.letters.replace(/[^A-Za-z]/g, "")
  if (upright && !UPRIGHT_LETTERS_READ.has(letter)) {
    return `the upright letter “${word.quote}” — a unit, a label or an operator, not a variable`
  }
  return null
}

/** The upright-letter decline for a letter read under an upright font, or nothing. */
function uprightLetterGuard(text: string, upright: boolean): void {
  if (upright && /^[A-Za-z]$/.test(text) && !UPRIGHT_LETTERS_READ.has(text)) {
    throw new Unsupported(`the upright letter “${text}” — a unit, a label or an operator, not a variable`)
  }
}

/**
 * Whether an upright font stands on the way down to `unwrap(node)`. The script
 * and differential paths read their letter through unwrap, which discards the
 * font, so they must ask before the letter is looked up: `d\mathrm{m}` shipped
 * as `c^{2}d\mathrm{m}`, the metre restored as a mass, while `\mathrm{m}c^2`
 * declined.
 */
function underUprightFont(node: any): boolean {
  let cur = node
  while (cur != null) {
    if (cur.type === "font") {
      if (UPRIGHT_FONTS.has(cur.font)) return true
      cur = cur.body
    } else if (WRAPPER_TYPES.has(cur.type)) {
      const body = (Array.isArray(cur.body) ? cur.body : [cur.body]).filter(
        (x: any) => x && !SKIP_TYPES.has(x.type),
      )
      if (body.length !== 1) return false
      cur = body[0]
    } else {
      return false
    }
  }
  return false
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
  const upright = ctx.font?.upright === true || underUprightFont(operandNode)
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
    uprightLetterGuard(baseText, upright || underUprightFont(opU.base))
    const sup = opU.sup != null ? classifySup(opU.sup) : null
    if (opU.sub != null) {
      const display = srcOf(opU, ctx)
      angularIndexGuard(baseText, opU, display, ctx)
      operandDim = resolveSymbol(baseText, display, ctx, {
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
      uprightLetterGuard(baseText, upright)
      operandDim = resolveSymbol(baseText, srcOf(opU, ctx), ctx, {
        differential: prefix === "d",
      })
    } else if (opU?.type === "leftright" || opU?.type === "__group") {
      // The group is emitted from its own analysis, so what was restored inside
      // it survives: sliced from the source, `ds = d(r - t)` came back verbatim
      // while reporting the c it had solved for `t`.
      const group = analyzeFactor(operandNode, ctx)
      const prefixTex = wrappedTexOf(prefixNode, ctx)
      return { kind: "diff", dim: group.dim, emit: () => joinTex([prefixTex, group.emit()]) }
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

function functionHeadTex(headNode: any, ctx: Ctx): string {
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
    headTex += scriptsTex(head, ctx)
  }
  return headTex
}

/**
 * A power of c or G standing at the very end of emitted TeX. The lookbehind
 * keeps the last letter of a control word (`\sec`) from counting as a c.
 */
const TRAILING_CONSTANT = /(?<!\\[a-zA-Z]*)[cG](?:\^\{[^{}]*\})?$/

/**
 * A function whose argument is the rest of the product (`\sin\omega t`). No
 * delimiter closes that argument, so a constant restored at its end would sit
 * where the reader cannot tell it from a factor outside the function:
 * `\sin 2(\sqrt{\Lambda}t)c` reads as much as c·sin(2√Λt) as sin(2√Λt·c). A
 * constant restored anywhere else in it (after the numerals, inside a
 * fraction or a root) is plainly inside and stays. The trailing one is found on
 * the emission itself, replayed with and without the restoration, because
 * only the emitter decides which slot a constant lands in.
 */
function analyzeFunction(headNode: any, argNodes: any[], ctx: Ctx): Factor {
  const headTex = functionHeadTex(headNode, ctx)
  const argSum = parseSum(argNodes, ctx, { anchor: "forced", target: ZERO })
  if (!argSum.multiTerm) {
    const live = argSum.emit()
    const written = maskedEmission(ctx, argSum.emit)
    const tail = TRAILING_CONSTANT.exec(live)?.[0]
    if (live !== written && tail != null && TRAILING_CONSTANT.exec(written)?.[0] !== tail) {
      throw new Unsupported(
        `restoring a constant at the end of the unparenthesized argument of “${headTex}”, where it would read as a factor outside the function, is not supported`,
      )
    }
  }
  const emit = () => {
    const rebuilt = argSum.emit()
    if (argSum.multiTerm) return joinTex([headTex, `\\left(${rebuilt}\\right)`])
    return joinTex([headTex, rebuilt])
  }
  return { kind: "func", dim: ZERO, emit, openArgument: !argSum.multiTerm }
}

/**
 * A script on nothing, set right after a function head (`\sin{}^{2}(M/t)`,
 * `\sin\,^{2}(M/t)`), with only spacing between them. It is the function's
 * power written apart from the head, or a script on the argument, and the
 * engine cannot say which. Read as the rider it would be after a tensor, it
 * opened the argument, and the constant restored at the argument's head took
 * it: `r\sin{}^{2}(M/t)` shipped as `r\sin\frac{G{}^{2}(M/t)}{c^{3}}`, with
 * the square on G. Braces around the script change none of this: the argument
 * opens on whatever its first group opens on, so `r\sin{{}^{2}}(M/t)` and
 * `r\sin{\,{}^{2}(M/t)}` shipped the same square on G, and the guard looks
 * through groups (and the base of a script on a group) to the first thing the
 * argument opens on.
 */
function floatingScriptAfterHeadGuard(headNode: any, next: any, ctx: Ctx): void {
  const script = argumentOpener(next)
  if (!isFloatingScript(script)) return
  // A prime on nothing (`\sin{}'`) is the primed-symbol decline's, which the
  // script meets when it is read; the prime KaTeX makes of `'` has no source
  // span to name it by here.
  if (script.sup != null && classifySup(script.sup) === "prime") return
  throw new Unsupported(
    `the floating script “${supsubTex("{}", script, ctx)}” after “${functionHeadTex(headNode, ctx)}” — the function's power or a script on its argument — which is not supported`,
  )
}

/**
 * The first node an argument opens on, looking through groups (their spacing
 * and empty groups skipped) and into the base of a script set on a group. A
 * script whose base is empty is itself the opener, and is returned.
 */
function argumentOpener(node: any): any {
  let cur = unwrap(node)
  for (;;) {
    if (cur?.type === "ordgroup") {
      const first = cur.body.find((x: any) => !isBlankNode(x))
      if (first == null) return cur
      cur = unwrap(first)
    } else if (cur?.type === "supsub" && !isBlankNode(cur.base)) {
      const base = unwrap(cur.base)
      if (base?.type !== "ordgroup") return cur
      cur = base
    } else {
      return cur
    }
  }
}

/**
 * The delimited group a function's argument is, when one follows the head:
 * `(…)`, `\left(…\right)`, or either carrying a script (`\ln(Z\alpha)^{-2}`).
 *
 * Bars are never an argument group. An evaluation bar, `\left. … \right|`, is
 * an instruction to evaluate what it closes (at a point, or between limits),
 * and read as the argument, `r\sin\left.M/t\right|` restored to
 * `r\sin\left.GM/tc^{3}\right|` as if it were sin(M/t). What it evaluates at
 * is not read, so it declines, named by its scripts: limits, a condition, or
 * a bare bar. A modulus or a norm, `\left| … \right|`, is a value the
 * function may take as its argument or not (sin|x|, or a factor beside it),
 * so it gets no argument-group reading and falls to the rule for an
 * unparenthesized argument, as does a `\left.` that closes on anything else.
 */
function delimitedArgumentOf(node: any): { group: any; scripted: any | null } | null {
  const u = unwrap(node)
  const delimited = (x: any) => x?.type === "__group" || x?.type === "leftright"
  const scripted = u?.type === "supsub" && delimited(unwrap(u.base)) ? u : null
  const group = scripted != null ? unwrap(scripted.base) : delimited(u) ? u : null
  if (group == null) return null
  if (group.type === "leftright" && group.left === "." && EVALUATION_BARS.has(group.right)) {
    throw new Unsupported(evaluationBarReason(scripted))
  }
  const opener = group.type === "leftright" ? group.left : group.open
  if (opener === "." || (group.type === "leftright" ? BAR_OPENERS.has(opener) : group.bar != null)) return null
  return { group, scripted }
}

/** Closers that make `\left.` an evaluation bar. */
const EVALUATION_BARS = new Set(["|", "\\vert", "\\rvert"])
/** `\left` openers of a modulus or a norm; a bar group records its family instead (groupDelims). */
const BAR_OPENERS = new Set(["|", "\\vert", "\\lvert", "\\|", "\\Vert", "\\lVert"])

/** Why an evaluation bar declines, named by what its scripts make it. */
function evaluationBarReason(scripted: any | null): string {
  if (scripted == null) return "an evaluation bar “\\left. … \\right|”, which is not supported yet"
  if (scripted.sub != null && containsRel(nodeListOf(scripted.sub))) {
    return "an evaluation condition in a subscript, which is not supported yet"
  }
  return "evaluation limits, which are not supported yet"
}

/**
 * Spacing a function head's delimited argument was set apart with, emitted as
 * written: skipped, `\sin\quad(M/t)` came back as `\sin(…)`, and `\sin\ (M/t)`
 * declined as a divergence. A spacing node slices its own source. A kern has
 * none, so it is rebuilt from its width as the one command KaTeX gives that
 * width (the backstop declines a kern written any other way, `\thinspace`,
 * whose rebuilt `\,` no longer matches the source); a width no command gives
 * declines here.
 */
const KERN_COMMANDS: Record<string, string> = {
  "3mu": "\\,",
  "4mu": "\\:",
  "5mu": "\\;",
  "-3mu": "\\!",
  "1em": "\\quad",
  "2em": "\\qquad",
}

/** The command KaTeX gives a kern's width, or null when no command does. */
function kernCommandOf(n: any): string | null {
  return KERN_COMMANDS[`${n.dimension?.number}${n.dimension?.unit}`] ?? null
}

function headSpacingTex(skips: any[], headTex: string, ctx: Ctx): string {
  return skips
    .map((raw) => {
      const n = unwrap(raw)
      const tex = n?.type === "kern" ? (kernCommandOf(n) ?? "") : spacingTexOf(raw, ctx)
      if (tex === "") {
        throw new Unsupported(
          `spacing between “${headTex}” and its argument that the engine cannot re-emit as written, which is not supported`,
        )
      }
      return tex
    })
    .join("")
}

/**
 * A function applied to a delimited argument. The argument is exactly the
 * group, so its terms are restored inside the author's delimiters and the
 * function is emitted as head, opener, restored content, closer:
 * `\sinh\left(\sqrt{\Lambda/3}\,t\right)` restores to `\sinh\left(\sqrt{…}tc\right)`,
 * where the constant used to land after `\right)` and multiply the sinh
 * instead. A power on the group (`\sin(x)^{2}`, sin x² or (sin x)²) asks the
 * same of the content either way: it must be dimensionless.
 */
function analyzeDelimitedFunction(
  headNode: any,
  skips: any[],
  arg: { group: any; scripted: any | null },
  ctx: Ctx,
): Factor {
  const headTex = functionHeadTex(headNode, ctx)
  const spacing = headSpacingTex(skips, headTex, ctx)
  const { group, scripted } = arg
  let scripts = ""
  if (scripted != null) {
    const sup = scripted.sup != null ? classifySup(scripted.sup) : null
    const subIsIndex = scripted.sub == null || allIndexTokens(nodeListOf(scripted.sub), true)
    const supIsReadable = sup == null || sup === "index" || typeof sup === "object"
    if (!subIsIndex || !supIsReadable) {
      throw new Unsupported("a super/subscript construct the engine could not read")
    }
    scripts = scriptsTex(scripted, ctx)
  }
  bracketBodyGuard(group.body)
  const inner = parseSum(group.body, ctx, { anchor: "forced", target: ZERO })
  const open = group.type === "leftright" ? `\\left${group.left}` : group.open
  const close = group.type === "leftright" ? `\\right${group.right}` : group.close
  const emit = () => joinTex([headTex, spacing, open, inner.emit(), close]) + scripts
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

/**
 * `{\textstyle\frac12}`: a style command the reader wrote inside a group. The
 * style is inert for dimensions but not for the emission, and unwrap discarded
 * it, so the group came back as `{\frac{1}{2}}` and the backstop declined.
 * KaTeX synthesizes the identical node shape for `{\tfrac12}`, so the two are
 * told apart by the source between the group's brace and its content: only a
 * written `\textstyle` (or display, script, scriptscript) that names the
 * node's own style is re-emitted.
 */
function explicitStyleOf(group: any, ctx: Ctx): { cmd: string; body: any[] } | null {
  const body = (group.body ?? []).filter((x: any) => x && !SKIP_TYPES.has(x.type))
  if (body.length !== 1 || body[0].type !== "styling") return null
  const inner = spanOf(body[0].body, ctx.input)
  const own = spanOf({ loc: group.loc }, ctx.input)
  if (!inner || !own) return null
  const written = /\\(display|text|script|scriptscript)style\b/.exec(ctx.input.slice(own[0], inner[0]))
  if (!written || written[1] !== body[0].style) return null
  return { cmd: `\\${written[1]}style`, body: body[0].body }
}

function analyzeFactor(rawNode: any, ctx: Ctx): Factor {
  const peeled = peelStyles(rawNode)
  if (peeled?.type === "font") {
    // \mathbf{p}, \mathrm{e}… — read through the wrapper, but keep it in the
    // output, spelled as written. A word under it is not read at all.
    const fontTex = `\\${fontCmdOf(peeled, ctx)}`
    const upright = UPRIGHT_FONTS.has(peeled.font)
    const word = spelledWordOf(nodeListOf(peeled.body), ctx)
    const reason = word == null ? null : spelledWordReason(word, upright, fontTex)
    if (reason != null) throw new Unsupported(reason)
    const outer = ctx.font
    ctx.font = { tex: fontTex, upright, node: peeled }
    let inner: Factor
    try {
      inner = analyzeFactor(peeled.body, ctx)
    } finally {
      ctx.font = outer
    }
    const font = peeled
    // A sum under a font is as bare as one under plain braces: a constant set
    // beside `{\bf p + q}` needs \left(\right), or it reads as p + qc. The
    // font is packaging for what it holds, so the declaration test looks
    // through it as through braces (`\mathit{c} = 1`), and it vanishes when
    // its content does.
    return {
      kind: inner.kind,
      dim: inner.dim,
      isBareSum: inner.isBareSum,
      openArgument: inner.openArgument,
      parts: [inner],
      vanishes: inner.vanishes,
      emit: () => fontTexOf(font, inner.emit(), ctx),
    }
  }

  const n = unwrap(rawNode)
  if (n == null) throw new Unsupported("an empty construct")

  switch (n.type) {
    case "mathord":
    case "textord": {
      const text = n.text as string
      // A bar reaches symbol resolution only by a path that never paired it
      // (pairBars pairs or declines every bar of a level it sees). A bar has
      // no dimension to look up; calling it a dictionary miss is a category
      // error.
      if (BAR_FAMILY[text]) throw new Unsupported(unpairedBarReason(text))
      uprightLetterGuard(text, ctx.font?.upright === true)
      constantFontGuard(text, ctx.font?.node ?? null, ctx)
      if (text === "\\pi" || text === "i" || text === "e" || text === "\\infty") {
        const src = srcOf(n, ctx)
        return { kind: "num", dim: ZERO, emit: () => src }
      }
      const src = srcOf(n, ctx)
      const d = resolveSymbol(text, src, ctx, {})
      if (text === "c" || text === "G") {
        ctx.constantsRead.push(text)
        // Geometrized target: the constant is set to 1 and vanishes.
        return {
          kind: "sym",
          dim: d,
          constant: { tex: text, e12: D12 },
          unitConstant: true,
          vanishes: () => stripsConstants(ctx),
          emit: () => {
            if (!stripsConstants(ctx)) return ctx.net != null ? netOpaque(src) : src
            ctx.mutated = true
            return ""
          },
        }
      }
      return { kind: "sym", dim: d, emit: () => src, unitConstant: text === "\\hbar" || undefined }
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
        const numTex = joinFactors(frac.num, ctx) || emptyProductTex(ctx)
        const denTex = joinFactors(frac.den, ctx)
        if (denTex === "") return numTex
        return `${cmd}{${numTex}}{${denTex}}`
      }
      // Emptied of its denominator, a fraction is its numerator, and a
      // numerator that is nothing, or the numeral 1, leaves nothing to set in
      // a product: `\frac{c^2}{G}` and `\frac{1}{c}` came back as a `1` beside
      // the other factors.
      const numIsOne = () => frac.num.length === 1 && frac.num[0].kind === "num" && frac.num[0].emit() === "1"
      const vanishes = () => productVanishes(frac.den) && (productVanishes(frac.num) || numIsOne())
      // A fraction of numerals is itself a numeral at both edges: set beside a
      // digit, `3\frac{1}{2}` reads as the mixed number 3½. Emptied of its
      // denominator, a fraction prints its numerator, whose edges are its own
      // (`\frac{2G}{c^2}` prints `2`). Both are asked as a live emission
      // prints them, so a strip that leaves `\frac{1}{2}` or a bare `2` behind
      // is seen.
      const numeralEdge = (side: "first" | "last") => {
        if (printsNothing(frac.den)) return productNumeralEdge(frac.num, side) ?? true
        return printsNumeralOnly(frac.num) && printsNumeralOnly(frac.den)
      }
      return { kind: "frac", dim: d, emit, frac, vanishes, numeralEdge }
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
      const vanishes = () => sumVanishes(inner)
      return { kind: "sqrt", dim: d, emit, sqrt: { bodyTerm }, vanishes, ...partsOf(inner) }
    }
    case "leftright":
    case "__group": {
      const body = n.body
      // \left|0\right\rangle and \left\langle\psi\right| are a ket and a bra,
      // in any spelling of the angle bracket (\left|0\right>); read as bars,
      // the ket shipped as a translation.
      if (
        n.type === "leftright" &&
        ((ANGLE_GLYPH[n.left] === "\\langle" && (VERT_DELIMS.has(n.right) || holdsBar(body))) ||
          (VERT_DELIMS.has(n.left) && ANGLE_GLYPH[n.right] === "\\rangle"))
      ) {
        throw new Unsupported(DIRAC_REASON)
      }
      bracketBodyGuard(body)
      const inner = parseSum(body, ctx, { anchor: "internal" })
      const tensor = isSingleBarGroup(n) ? barredTensorTex(body, ctx) : null
      if (tensor != null && !dimIsZero(inner.dim)) {
        throw new Unsupported(`bars around the tensor “${tensor}” — a modulus or a determinant, which differ in dimension`)
      }
      const open = n.type === "leftright" ? `\\left${n.left}` : n.open
      const close = n.type === "leftright" ? `\\right${n.right}` : n.close
      // Control-word delimiters (\langle, \lbrace, \lVert …) would otherwise
      // swallow the following letter: `\langle`+`v` must not become `\langlev`.
      const emit = () => joinTex([open, inner.emit(), close])
      const vanishes = () => sumVanishes(inner)
      // Null delimiters print nothing but a sliver of space, so `\left. … \right.`
      // is at its edges what its body is: a kern the author set between it and
      // a numeral is kept (`2\,\left.3\right.`), and a constant written there
      // is not folded away (keepNumeralsApart, separatesNumerals).
      const bare = n.type === "leftright" && n.left === "." && n.right === "."
      return {
        kind: "group",
        dim: inner.dim,
        emit,
        isBareSum: false,
        vanishes,
        numeralEdge: bare ? (side) => sumNumeralEdge(inner, side) : undefined,
        ...partsOf(inner),
      }
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
        return analyzeAccentBody(ctx, () => {
          // The dot's body is its one letter, read as the registry reads it:
          // a c or G there is read as the constant, as it is anywhere else.
          if (baseText === "c" || baseText === "G") ctx.constantsRead.push(baseText)
          const baseDim = resolveSymbol(baseText, display, ctx, {})
          const order = label === "\\ddot" ? 2 : 1
          const d = dimSub(baseDim, dim(0, 0, order))
          return { kind: "sym", dim: d, emit: () => display }
        })
      }
      if (TRANSPARENT_ACCENTS.has(label)) {
        return analyzeAccentBody(ctx, () => {
          const inner = bracedArg(n.base, ctx)
          return { kind: "sym", dim: inner.dim, emit: () => `${label}{${inner.emit()}}` }
        })
      }
      throw new Unsupported(`the unsupported accent “${label}”`)
    }
    case "overline":
      return analyzeAccentBody(ctx, () => {
        const inner = bracedArg(n.body, ctx)
        return { kind: "sym", dim: inner.dim, emit: () => `\\overline{${inner.emit()}}` }
      })
    case "op": {
      const name = n.name ?? ""
      if (FUNC_OPS.has(name)) throw new Unsupported("a function with no argument")
      throw new Unsupported(
        `“${name || srcOf(n, ctx)}” — integrals, sums, and limits change dimensions with their measure and are not supported yet`,
      )
    }
    case "operatorname":
      throw new Unsupported("an \\operatorname construct, which is not supported")
    case "text": {
      // Prose, a placeholder, or an upright word or letter says so; any other
      // \text (an italic word, math set inside the text) keeps the general reason.
      const word = spelledWordOf(n.body, ctx)
      const reason =
        word == null
          ? null
          : UPRIGHT_TEXT_FONTS.has(n.font)
            ? spelledWordReason(word, true, n.font)
            : proseOrPlaceholderReason(word)
      throw new Unsupported(reason ?? "\\text content inside the equation")
    }
    case "ordgroup": {
      const styled = explicitStyleOf(n, ctx)
      const inner = parseSum(styled ? styled.body : n.body, ctx, { anchor: "internal" })
      const emit = () => {
        const body = inner.emit()
        if (styled) return `{${styled.cmd} ${body}}`
        // `{\bf p}` is one group, which the font re-emits with braces of its own.
        if (OLD_STYLE_GROUP.test(body) && outerBracesArePartners(body)) return body
        return `{${body}}`
      }
      // Braces do not print, so a bare sum anywhere in the group is bare beside
      // it, and an unparenthesized argument at its end stays open after it.
      const isBareSum = inner.multiTerm || inner.terms[0].factors.some((f) => f.isBareSum === true)
      const live = inner.terms[0].factors.filter((f) => f.kind !== "glue")
      const openArgument = !inner.multiTerm && live[live.length - 1]?.openArgument === true
      const vanishes = () => sumVanishes(inner)
      const numeralEdge = (side: "first" | "last") => sumNumeralEdge(inner, side)
      return { kind: "group", dim: inner.dim, emit, isBareSum, openArgument, vanishes, numeralEdge, ...partsOf(inner) }
    }
    case "atom":
      throw new Unsupported(`the symbol “${n.text}” in this position`)
    case "delimsizing":
      // Whatever groupDelims did not pair: `\bigm|` (a relation-class bar),
      // `\big.`, a sized glyph that is no delimiter pair (`\big/`).
      throw new Unsupported(`the sized delimiter “${sizedTexOf(n)}”, which the engine cannot pair`)
    default:
      throw new Unsupported(`the construct “${constructName(n)}”, which is not supported yet`)
  }
}

/**
 * The construct as the reader wrote it, for a decline: KaTeX's node types
 * (enclose, horizBrace, xArrow, cr) name the parser's internals. A labelled
 * node carries its command. `\boxed` is the one exception: KaTeX builds it as
 * an `\fbox`, and the node keeps no location to read the written command
 * from, so the reason names `\fbox`.
 */
function constructName(n: any): string {
  if (typeof n.label === "string" && n.label.startsWith("\\")) return n.label
  if (n.type === "array") return "matrix or array environment"
  if (n.type === "cr") return "\\\\ line break outside an aligned environment"
  if (n.type === "hbox") return "\\hbox"
  return n.type
}

/** Single vertical bars on both sides: |x|, \lvert x\rvert, \bigl|x\bigr|, \left|x\right|. */
function isSingleBarGroup(n: any): boolean {
  if (n.type === "leftright") return ["|", "\\vert", "\\lvert"].includes(n.left) && ["|", "\\vert", "\\rvert"].includes(n.right)
  return n.bar === "single"
}

/**
 * The TeX of a lone tensor set between single bars, or null: an indexed
 * symbol with any staggered continuations (`T^{a}{}_{b}`) and two or more
 * index tokens across the run. |T_{ab}| is the modulus of a component or the
 * determinant of the matrix, whose dimensions differ unless the tensor is
 * dimensionless; counted over the first supsub alone, the mixed tensor
 * |T^{a}{}_{b}| passed as a modulus. Accents, fonts, styles and braces do not
 * change what stands between the bars, wherever the reader set them: on the
 * base (`\tilde T_{ab}`, `\mathbf{T}_{ab}`) or around the whole indexed
 * symbol (`\tilde{T_{ab}}`, `{\bf T_{ab}}`, `{T^{a}{}_{b}}`). Peeled from the
 * base alone, every wrapped spelling of the whole passed as a modulus.
 */
function barredTensorTex(body: any[], ctx: Ctx): string | null {
  const run = body.filter(isMeaningfulNode)
  const scripted = indexedRunOf(run)
  if (scripted == null) return null
  const indexCount = (script: any) => {
    if (script == null) return 0
    const tokens = nodeListOf(script).filter(isMeaningfulNode)
    return allIndexTokens(tokens, true) ? tokens.length : 0
  }
  const count = scripted.reduce((sum, s) => sum + indexCount(s.sub) + indexCount(s.sup), 0)
  if (count < 2) return null
  return joinTex(run.map((x) => decoratedTexOf(x, ctx)))
}

/**
 * The script-carrying nodes of a lone indexed symbol, innermost first, or
 * null when the run is not one: a supsub on a symbol, followed by staggered
 * continuations on blank bases. A base that is itself an indexed symbol under
 * its decorations is read the same way, so the staggering `{T^{\mu}}_{\nu}`,
 * a braced indexed symbol carrying a further script, counts its indices as
 * `T^{\mu}{}_{\nu}` does; read only through its outer supsub, whose base has
 * no text, the mixed tensor passed as a modulus.
 */
function indexedRunOf(nodes: any[]): any[] | null {
  const [head, ...riders] = nodes.flatMap(decoratedRunOf)
  if (head?.type !== "supsub") return null
  if (!riders.every((r) => r?.type === "supsub" && isBlankNode(r.base))) return null
  const inner = textOf(decoratedSymbolOf(head.base)) != null ? [] : indexedRunOf([head.base])
  return inner == null ? null : [...inner, head, ...riders]
}

/**
 * The TeX of an indexed symbol for a quotation, accents and overlines
 * rebuilt: neither node has a location, so a slice of `\tilde T_{ab}` quoted
 * `T_{ab}` and one of `\overline{T}_{ab}` quoted `{T}_{ab}`.
 */
function decoratedTexOf(raw: any, ctx: Ctx): string {
  const n = peelStyles(raw)
  const decorated = (cmd: string, arg: any) => {
    const body = decoratedTexOf(arg, ctx)
    return `${cmd}{${body.startsWith("{") && outerBracesArePartners(body) ? body.slice(1, -1) : body}}`
  }
  if (n?.type === "accent") return decorated(n.label, n.base)
  if (n?.type === "overline") return decorated("\\overline", n.body)
  if (n?.type === "supsub" && n.base != null) return `${decoratedTexOf(n.base, ctx)}${scriptsTex(n, ctx)}`
  return wrappedTexOf(raw, ctx)
}

/**
 * The nodes of a barred run under their decorations: a group the peeling
 * reaches with several children (`{T^{a}{}_{b}}`, `\tilde{T^{a}{}_{b}}`)
 * contributes each of them, so a staggered run reads the same braced or not.
 */
function decoratedRunOf(node: any): any[] {
  const cur = decoratedSymbolOf(node)
  return cur?.type === "ordgroup" ? cur.body.filter(isMeaningfulNode).flatMap(decoratedRunOf) : [cur]
}

/** The symbol under accents, overlines, fonts, styles and single-child braces. */
function decoratedSymbolOf(node: any): any {
  let cur = unwrap(node)
  for (;;) {
    if (cur?.type === "accent") {
      cur = unwrap(cur.base)
      continue
    }
    if (cur?.type === "overline") {
      cur = unwrap(cur.body)
      continue
    }
    if (cur?.type === "ordgroup") {
      const inner = cur.body.filter(isMeaningfulNode)
      if (inner.length === 1) {
        cur = unwrap(inner[0])
        continue
      }
    }
    return cur
  }
}

/** Source of a sub/superscript with its outer brace pair (if any) removed. */
function scriptSrc(node: any, ctx: Ctx): string {
  // A bare font script (`T_\mathrm{eff}`) has no span of its own; rebuild it.
  const styled = peelStyles(node)
  if (styled?.type === "font") return fontTexOf(styled, scriptSrc(styled.body, ctx), ctx)
  const src = srcOf(node, ctx)
  if (src.startsWith("{") && src.endsWith("}")) {
    let depth = 0
    for (let idx = 0; idx < src.length; idx += 1) {
      if (src[idx] === "{") depth += 1
      else if (src[idx] === "}") {
        depth -= 1
        if (depth === 0 && idx < src.length - 1) return src // outer pair closes early
      }
    }
    return keepControlSpace(src.slice(1, -1))
  }
  return src
}

/**
 * Whether the superscript was written before the subscript. `X^{a}_{b}` and
 * `X_{b}^{a}` typeset identically and KaTeX parses both to the same node, so
 * the order survives only in the scripts' spans. Superscript first is the
 * dominant spelling of mixed tensors (\Gamma^{\rho}_{\mu\nu}, \delta^{\mu}_{\nu},
 * T^{\alpha}_{\ \alpha}); rebuilding every one of them subscript first made the
 * reassembly backstop decline them all as divergent.
 */
function supWrittenFirst(n: any, ctx: Ctx): boolean {
  if (n.sub == null || n.sup == null) return false
  const sub = spanOf(n.sub, ctx.input)
  const sup = spanOf(n.sup, ctx.input)
  return sub != null && sup != null && sup[0] < sub[0]
}

/**
 * The scripts of a supsub, in the order they were written. A font written as
 * the whole script (`r_\mathrm{s}`) is set without a brace pair of its own,
 * as written: KaTeX parses `r_{\mathrm{s}}` to another node (a group around
 * the font), which the dictionary keys by another spelling, so the braced
 * rebuild read back as an unknown symbol instead of the Schwarzschild radius.
 */
function scriptsTex(n: any, ctx: Ctx): string {
  const script = (mark: string, node: any) =>
    node.type === "font" ? `${mark}${scriptSrc(node, ctx)}` : `${mark}{${scriptSrc(node, ctx)}}`
  const sub = n.sub != null ? script("_", n.sub) : ""
  const sup = n.sup != null ? script("^", n.sup) : ""
  return supWrittenFirst(n, ctx) ? sup + sub : sub + sup
}

/** Reconstruct `base_{sub}^{sup}` from parts — supsub/font nodes carry no reliable own span. */
function supsubTex(baseTex: string, n: any, ctx: Ctx): string {
  return baseTex + scriptsTex(n, ctx)
}

/** Emission for a supsub base: plain symbols slice their span; font wraps reconstruct. */
function baseTexOf(rawBase: any, ctx: Ctx): string | null {
  const peeled = peelStyles(rawBase)
  if (peeled?.type === "font") {
    const inner = baseTexOf(peeled.body, ctx)
    return inner == null ? null : fontTexOf(peeled, inner, ctx)
  }
  const u = unwrap(rawBase)
  if (u && (u.type === "mathord" || u.type === "textord")) return srcOf(u, ctx)
  return null
}

/**
 * The angular guard. The registry gives an indexed tensor one dimension for all
 * of its components, and that holds only because x⁰ = ct makes every coordinate
 * a length. θ and φ break the premise: Γ^r_{θθ} is a length and Γ^θ_{φφ} is
 * dimensionless, where the registry says m⁻¹ for both. The error is a pure power
 * of length, which no c–G insertion can absorb, so it can never place a wrong
 * constant; it does ship an unchanged translation under a wrong unit banner
 * (`\Gamma^{\mu}_{\theta\theta} = 0` as m⁻¹, `T^{0}_{\theta} = 0` as a pressure).
 *
 * The CEO ruling of 2026-08-17 admits θ and φ as subscript indices, and it
 * stands: a component with a subscript alone (g_{\theta\theta}, \partial_\phi)
 * still reads through it. A component that also carries a superscript was out
 * of reach while every superscript-first tensor declined as a reassembly fault;
 * emitting scripts in source order brings it in, and the ruling never covered
 * it. So an indexed reading with a superscript and θ or φ in either script
 * declines by name — in either script order, so the spelling never decides the
 * reading. An identity the registry spells out (an `exact` entry) is not an
 * indexed reading and is left alone, as is a subscript that is not an index
 * list, and a superscript that is neither a power nor an index list keeps its
 * own reason.
 *
 * A power on \partial or \nabla is a derivative order, not a component, and it
 * is the ruling's own case: the Teukolsky operator's \partial_\phi^2 is among the
 * equations the ruling was drawn from. It reads as the ruling reads it.
 */
const ANGULAR_LABELS = new Set(["\\theta", "\\phi", "\\varphi"])

function angularIndexGuard(baseText: string, n: any, displayTex: string, ctx: Ctx): void {
  if (n.sub == null || n.sup == null) return
  if (ctx.reg.exact[`${baseText}_${subKeyText(n.sub, ctx)}`] || !ctx.reg.indexed[baseText]) return
  const indexList = (nodes: any[]): boolean => {
    try {
      return allIndexTokens(nodes, true)
    } catch {
      return false
    }
  }
  const subNodes = nodeListOf(n.sub)
  const supNodes = nodeListOf(n.sup)
  if (!indexList(subNodes)) return
  const sup = classifySup(n.sup)
  if (typeof sup === "object") {
    if (baseText === "\\partial" || baseText === "\\nabla") return
  } else if (sup !== "index" && !indexList(supNodes)) return
  if ([...subNodes, ...supNodes].some((x) => ANGULAR_LABELS.has(textOf(x) ?? ""))) {
    throw new Unsupported(
      `an angular coordinate index on “${displayTex}” — components along θ and φ do not share the registry's length dimension`,
    )
  }
}

/**
 * A single digit raised on an indexed reading, beside an index subscript:
 * `\Gamma^{2}_{00}` is the component Γ²₀₀ as often as it is (Γ₀₀)². Read as a
 * power it shipped unchanged under a wrong banner (m⁻² for a Christoffel
 * symbol, m⁻⁴ for `R^{2}_{0}`), and reading it as an index was weighed and
 * dropped (R5c): the notation does not say which it is, so it declines, in
 * either script order. It applies wherever the subscript sends the lookup to
 * `indexed`, since that is where a component index can stand; an identity the
 * registry spells out (H_0^2) is a power, and a symbol with no index subscript
 * (r^2, M^2) has no component to name. A power on \partial or \nabla is a
 * derivative order, as the angular guard reads it. The digit 1 is left alone:
 * as a power it leaves the dimension the index reading gives, so both readings
 * ship the same translation (`\Gamma^{1}_{00} = \frac{GM}{r^{3}}(r - 2GM)`).
 */
function componentDigitGuard(
  baseText: string,
  n: any,
  sup: ReturnType<typeof classifySup> | null,
  displayTex: string,
  ctx: Ctx,
): void {
  if (!isDigitPower(n.sup, sup) || !componentLookup(baseText, n.sub, ctx)) return
  throw new Unsupported(`a digit superscript on “${displayTex}” — a component index or a power`)
}

/** A superscript that is a single digit 2–9 as written, where a power and a component index both read. */
function isDigitPower(supNode: any, sup: ReturnType<typeof classifySup> | null): boolean {
  if (typeof sup !== "object" || sup == null || sup.q !== 1 || sup.p < 2 || sup.p > 9) return false
  return digitsOf(nodeListOf(supNode).filter((x) => !SKIP_TYPES.has(x.type))) != null
}

/**
 * Whether a subscript sends the lookup of `baseText` to `indexed`, where a
 * component index can stand: an index list, on a base the registry indexes and
 * does not spell out with that subscript as an identity, and not \partial or
 * \nabla, whose power is a derivative order.
 */
function componentLookup(baseText: string, sub: any, ctx: Ctx): boolean {
  if (baseText === "\\partial" || baseText === "\\nabla" || !ctx.reg.indexed[baseText]) return false
  if (ctx.reg.exact[`${baseText}_${subKeyText(sub, ctx)}`]) return false
  try {
    return allIndexTokens(nodeListOf(sub), true)
  } catch {
    return false
  }
}

/**
 * The component-digit guard across a floating rider. `R^{2}{}_{323}` and
 * `R_{00}{}^{2}` stagger the indices as `R^{0}{}_{101}` does, with a digit 2–9
 * where a power can stand, and the rider path reads a `{}` script as an index
 * with no dimension: `R^{2}{}_{323} = 0` shipped as m⁻⁴, the Ricci scalar
 * squared beside an index, and `R_{00}{}^{2} = 0` as the component R₀₀, with
 * the digit read as an index. It is the notation componentDigitGuard declines,
 * spelled across two script nodes, and it declines with the same reason: a
 * digit power on an indexed base followed by a rider with an index subscript,
 * or an index subscript followed by a rider with a digit power. The digits 0
 * and 1 keep the index reading there as they do on one node.
 */
function riderDigitGuard(nodes: any[], at: number, ctx: Ctx): void {
  const n = bracedSupsub(unwrap(nodes[at]))
  if (n == null) return
  const baseText = textOf(n.base)
  if (baseText == null || baseText === "\\partial" || baseText === "\\nabla" || !ctx.reg.indexed[baseText]) return
  let next = at + 1
  while (next < nodes.length && SKIP_TYPES.has(unwrap(nodes[next])?.type)) next += 1
  const rider = next < nodes.length ? unwrap(nodes[next]) : null
  if (rider?.type !== "supsub" || !(rider.base == null || isEmptyOrdgroup(unwrap(rider.base)))) return
  const powerThenIndex =
    n.sup != null &&
    isDigitPower(n.sup, classifySup(n.sup)) &&
    rider.sub != null &&
    componentLookup(baseText, rider.sub, ctx)
  const indexThenPower =
    n.sub != null &&
    componentLookup(baseText, n.sub, ctx) &&
    rider.sup != null &&
    isDigitPower(rider.sup, classifySup(rider.sup))
  if (!powerThenIndex && !indexThenPower) return
  const displayTex = `${wrappedTexOf(nodes[at], ctx)}${supsubTex("{}", rider, ctx)}`
  throw new Unsupported(`a digit superscript on “${displayTex}” — a component index or a power`)
}

/**
 * A supsub with a base, bare or alone inside braces (`R^{2}`, `{R^{2}}`), or
 * null. unwrap keeps braces, so a braced stagger is looked into here.
 */
function bracedSupsub(node: any): any {
  const body = node?.type === "ordgroup" ? node.body.filter((x: any) => x && !SKIP_TYPES.has(x.type)) : [node]
  const inner = body.length === 1 ? unwrap(body[0]) : null
  return inner?.type === "supsub" && inner.base != null ? inner : null
}

/**
 * The component-digit guard across braces. `{R^{2}}_{0}` is the most common
 * spelling of a mixed-index component, staggered as `{R^{0}}_{101}` is, and
 * the compound-base path read the braced R^{2} as the Ricci scalar squared:
 * `{R^{2}}_{0} = 0` shipped under m⁻⁴, the banner the one-node guard exists to
 * stop, and `{R^{2}}_{00} = \frac{M^2}{r^6}` translated on that reading.
 * `{R_{00}}^{2}` is the mirror, read as the component R₀₀ squared. Both are
 * the notation componentDigitGuard declines, a digit 2–9 on one side of the
 * braces and an index subscript on the other, and they decline with its
 * reason; the digits 0 and 1 keep the component reading. A braced base
 * followed by a rider (`{R^{2}}{}_{0}`) is riderDigitGuard's, which looks
 * into the braces the same way.
 */
function bracedDigitGuard(n: any, group: any, ctx: Ctx): void {
  const base = bracedSupsub(group)
  if (base == null) return
  const baseText = textOf(unwrap(base.base))
  if (baseText == null) return
  const powerThenIndex =
    base.sup != null &&
    isDigitPower(base.sup, classifySup(base.sup)) &&
    n.sub != null &&
    componentLookup(baseText, n.sub, ctx)
  const indexThenPower =
    base.sub != null &&
    componentLookup(baseText, base.sub, ctx) &&
    n.sup != null &&
    isDigitPower(n.sup, classifySup(n.sup))
  if (!powerThenIndex && !indexThenPower) return
  const displayTex = `{${wrappedTexOf(base, ctx)}}${scriptsTex(n, ctx)}`
  throw new Unsupported(`a digit superscript on “${displayTex}” — a component index or a power`)
}

/**
 * Fonts in which a letter is still the italic variable. Any other font makes c
 * and G other symbols: a bold G is usually the Einstein tensor, a bold c a
 * vector, a calligraphic G a group. Read as the constants, `E = m{\bf c}^2`
 * stripped to `m{\bf 1}^{2}` and `{\bf c} = 1` shipped unchanged as a relation
 * of the speed of light. Upright type (\mathrm, \rm) has its own decline, the
 * upright-letter guard, which runs first.
 */
const ITALIC_FONTS = new Set(["mathit", "mathnormal"])
const FONT_ADJECTIVES: Record<string, string> = {
  mathbf: "bold",
  boldsymbol: "bold",
  mathcal: "calligraphic",
  mathbb: "blackboard-bold",
  mathsf: "sans-serif",
  mathtt: "typewriter",
  mathfrak: "Fraktur",
  mathscr: "script",
}

/** The decline for c or G read bare under a font that makes it another symbol. */
function constantFontGuard(text: string, font: any, ctx: Ctx): void {
  if ((text !== "c" && text !== "G") || font == null) return
  if (ITALIC_FONTS.has(font.font) || UPRIGHT_FONTS.has(font.font)) return
  const adjective = FONT_ADJECTIVES[font.font] ?? "restyled"
  throw new Unsupported(
    `the ${adjective} “${fontTexOf(font, text, ctx)}” — another symbol (a vector, a tensor or a label), not the constant ${text}`,
  )
}

/**
 * An accent's body analyzed, and declined when the analysis read a c or G in
 * it as the constant. An accent makes the letter another symbol, as a bold or
 * calligraphic font does (constantFontGuard): `\vec{c}` is a vector, `\bar{G}`
 * a mean or a label, `\hat{c}` a unit vector or an operator, `\dot{c}` a
 * dotted variable as often as the rate of change of the speed of light. Read
 * through the accent, the letter was the constant itself, and a geometrized
 * target set it to one under its accent: `\vec{c} M` shipped as `\vec{1}M`,
 * and `\hat{c} = 1` as `\hat{1} = 1`.
 *
 * The decision is the analysis's, not the body's shape. A guard that matched
 * the lone letter under the accent was passed, one review round after
 * another, by a shape one bracket or one symbol away that the analysis still
 * read as the constant: `\bar{((c))}`, `\bar{(c)^{2}}`, `\bar{[(c)]}` and
 * `\bar{c\cdot}` all shipped `\bar{1}M` at GEO. Whatever the body's spelling,
 * the analysis says whether it read the constant. An accent over an
 * expression the constant is part of declines too (`\bar{2c}`, whose strip
 * shipped `\bar{2}M`, and `\overline{mc^2}`): nothing written says whether
 * the c under the accent is the constant, and a constant restored or
 * stripped there changes the accented symbol.
 */
function analyzeAccentBody(ctx: Ctx, analyze: () => Factor): Factor {
  const before = ctx.constantsRead.length
  const accented = analyze()
  const constant = ctx.constantsRead[before]
  if (constant == null) return accented
  throw new Unsupported(
    `the accented “${maskedEmission(ctx, accented.emit)}” — another symbol (a vector, a mean, an operator or a label), not the constant ${constant}`,
  )
}

/**
 * The font nearest a letter on the way down to `unwrap(node)`, if any: unwrap
 * discards it, so a supsub base `\mathbf c` is otherwise read as a plain c.
 */
function innermostFontOf(node: any): any {
  let cur = node
  let font: any = null
  while (cur != null) {
    if (cur.type === "font") {
      font = cur
      cur = cur.body
    } else if (WRAPPER_TYPES.has(cur.type)) {
      const body = (Array.isArray(cur.body) ? cur.body : [cur.body]).filter(
        (x: any) => x && !SKIP_TYPES.has(x.type),
      )
      if (body.length !== 1) return font
      cur = body[0]
    } else {
      return font
    }
  }
  return font
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

  if (sup === "signLabel") {
    throw new Unsupported(
      "a sign standing as a superscript (a light-cone index or a charge label), which is neither a power nor a dictionary index",
    )
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
  // A scripted bar is a closing bar pairBars never saw, not a symbol.
  if (baseText != null && BAR_FAMILY[baseText]) throw new Unsupported(unpairedBarReason(baseText))
  // A script does not make an upright letter a variable: \mathrm{m}^{2} is a unit.
  if (baseText != null) {
    uprightLetterGuard(baseText, ctx.font?.upright === true || underUprightFont(n.base))
  }
  const baseTex = baseTexOf(n.base, ctx)
  const wholeTex = baseTex != null ? supsubTex(baseTex, n, ctx) : null

  // Symbol with a subscript: identity, indices, or unknown.
  if (baseText != null && wholeTex != null && n.sub != null) {
    angularIndexGuard(baseText, n, wholeTex, ctx)
    componentDigitGuard(baseText, n, sup, wholeTex, ctx)
    const d = resolveSymbol(baseText, wholeTex, ctx, { sub: n.sub })
    const unitConstant = `${baseText}_${subKeyText(n.sub, ctx)}` === "k_B" || undefined
    if (sup == null) return { kind: "sym", dim: d, emit: () => wholeTex, unitConstant }
    if (sup === "index") return { kind: "sym", dim: d, emit: () => wholeTex }
    if (typeof sup === "object") {
      return { kind: "sym", dim: dimScale(d, sup.p, sup.q), emit: () => wholeTex, unitConstant }
    }
    throw new Unsupported(`an exponent on “${wholeTex}” that could not be read`)
  }

  // Pure superscript.
  if (baseText != null && wholeTex != null && sup != null) {
    if (sup === "index") {
      const d = resolveSymbol(baseText, wholeTex, ctx, { indices: true })
      return { kind: "sym", dim: d, emit: () => wholeTex }
    }
    // Read bare, the base is the constant itself only in italic type.
    constantFontGuard(baseText, innermostFontOf(n.base) ?? ctx.font?.node ?? null, ctx)
    if (typeof sup === "object") {
      const isConst = baseText === "\\pi" || baseText === "i" || baseText === "e"
      const d = isConst ? ZERO : resolveSymbol(baseText, baseTex!, ctx, {})
      const scaled = dimScale(d, sup.p, sup.q)
      if (baseText === "c" || baseText === "G") {
        ctx.constantsRead.push(baseText)
        const e12 = (D12 * sup.p) / sup.q
        return {
          kind: "sym",
          dim: scaled,
          constant: Number.isInteger(e12) ? { tex: baseText, e12 } : undefined,
          unitConstant: true,
          vanishes: () => stripsConstants(ctx),
          emit: () => {
            if (!stripsConstants(ctx)) return ctx.net != null ? netOpaque(wholeTex) : wholeTex
            ctx.mutated = true
            return ""
          },
        }
      }
      const unitConstant = baseText === "\\hbar" || undefined
      return { kind: isConst ? "num" : "sym", dim: scaled, emit: () => wholeTex, unitConstant }
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
    bracedDigitGuard(n, base, ctx)
    const subIsIndex = n.sub == null || allIndexTokens(nodeListOf(n.sub), true)
    const supIsReadable = sup == null || sup === "index" || typeof sup === "object"
    if (subIsIndex && supIsReadable) {
      const inner = analyzeFactor(n.base, ctx)
      const scaled =
        typeof sup === "object" && sup != null ? dimScale(inner.dim, sup.p, sup.q) : inner.dim
      const scripts = scriptsTex(n, ctx)
      return {
        kind: "group",
        dim: scaled,
        openArgument: inner.openArgument,
        emit: () => `${inner.emit()}${scripts}`,
        // A script on nothing is nothing: `(c)^{2}` vanishes with its base.
        vanishes: inner.vanishes,
        // A numeral raised is a numeral at its edges (`10^{2}`), and so is a
        // compound one: the factor's edges are its base's.
        numeralEdge: (side) => inner.numeralEdge?.(side) === true,
        parts: [inner],
      }
    }
  }

  throw new Unsupported("a super/subscript construct the engine could not read")
}

function sumAsFactorList(sum: SumInfo): Factor[] {
  // A single slash-free term flattens; anything else stays one opaque unit so
  // its internal structure (division, +/-, a branch sign) survives re-emission.
  const sign = sum.terms[0].sign
  if (!sum.multiTerm && sum.terms[0].slashIdx < 0 && sign !== "-" && !BRANCH_OPS.has(sign)) {
    return sum.terms[0].factors
  }
  return [
    {
      kind: "group",
      dim: sum.dim,
      emit: () => sum.emit(),
      isBareSum: true,
      vanishes: () => sumVanishes(sum),
      ...partsOf(sum),
    },
  ]
}

function containsRel(nodes: any[]): boolean {
  return nodes.some((n) => relTextOf(n) != null)
}

/**
 * What brackets hold when they hold no quantity. Juxtaposition reads `f(x)` as
 * a product, so an argument list is never read, and the reason says what the
 * comma or the relation is rather than "select a single equation": that was
 * the wording 175 ledger statements got for a function-argument comma.
 */
function bracketBodyGuard(body: any[]): void {
  if (containsRel(body)) {
    throw new Unsupported(
      "a relation inside brackets (an evaluation point, a limit, a conditional, or an index swap), which is not a factor",
    )
  }
  if (groupDelims(body).some((n) => n?.type === "atom" && n.family === "punct" && (n.text === "," || n.text === ";"))) {
    throw new Unsupported(
      "a comma inside brackets (function arguments, a tuple, a commutator, or an inner product), which the engine does not read as a product",
    )
  }
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

/**
 * The emitted product of `factors`, or "" when nothing but glue survives.
 * Geometrized stripping can empty a product down to the spacing and product
 * signs written between its factors, and glue with nothing left to join is not
 * a factor: kept, it turned `r_s = \frac{2GM}{c^2\ }` into 2M over a
 * denominator of `\ `, and `v = c\cdot` into `v = \cdot`. Returning "" hands the
 * product to the caller's empty-side rule (a bare 1, or no denominator).
 *
 * A factor that vanishes takes with it the glue that only served to separate
 * it. Glue before the first surviving factor or after the last one separated
 * nothing but the vanished factors, so it goes: `E = m~\cdot~ c^2` had shipped
 * as `E = m~\cdot~`, and `-c^2\ dt^2` as `-\ dt^2`. Between two survivors one
 * run of glue stays, the first one written that holds any: two runs merged
 * where a factor vanished (`2\ G\ M` → `2\ \ M`) say twice what the author
 * said once (separatorAcross). Wherever nothing vanished, the glue is kept as
 * written.
 *
 * In a masked replay for the numeral-fusion net, a factor the live strip drops
 * whole is one opaque mark (Ctx.net): the numerals in it go with it, and what
 * it printed between its neighbors is gone from the live emission.
 */
function joinFactors(factors: Factor[], ctx: Ctx): string {
  // Every factor is emitted, the vanishing ones too: emission is where a strip
  // is recorded (ctx.mutated), and a translation whose strips all vanished
  // was reported unchanged and skipped the re-read backstop.
  const dropped = (f: Factor) => ctx.net != null && ctx.mask && ctx.strip && f.kind !== "glue" && vanishesLive(f, ctx)
  const parts: EmittedFactor[] = factors.map((f) => ({
    f,
    tex: factorTex(f, dropped(f) ? netOpaque(f.emit()) : f.emit(), ctx),
  }))
  const out: string[] = []
  // The glue runs since the last surviving factor, a new run opening wherever a factor vanished.
  let runs: EmittedFactor[][] = [[]]
  let last: EmittedFactor | null = null
  for (const part of parts) {
    if (part.f.kind === "glue") {
      runs[runs.length - 1].push(part)
      continue
    }
    if (part.f.vanishes?.() === true) {
      runs.push([])
      continue
    }
    if (runs.length === 1) out.push(...runs[0].map((glue) => glue.tex))
    else if (last != null) out.push(...separatorAcross(runs))
    out.push(part.tex)
    last = part
    runs = [[]]
  }
  if (last == null) return ""
  if (runs.length === 1) out.push(...runs[0].map((glue) => glue.tex))
  return joinTex(out)
}

type EmittedFactor = { f: Factor; tex: string }

/**
 * The glue that stays between two survivors where factors vanished between
 * them: the first run written that holds any, or none. Nothing kept from the
 * source keeps two numerals apart there: `\frac{GM}{5\,c^2\,5}` stripped to
 * `\frac{M}{55}`, where the value is M/25, and a kern kept between the two
 * fives would still read as 55, for a thin space is how digits are grouped.
 * The numeral-fusion net declines those rows (numeralFusionNet).
 */
function separatorAcross(runs: EmittedFactor[][]): string[] {
  const written = runs.find((run) => run.some((glue) => glue.tex !== ""))
  return written == null ? [] : written.map((glue) => glue.tex)
}

/** A factor that prints a numeral last, set before one that prints a numeral first. */
function numeralsMeet(left: Factor, right: Factor): boolean {
  return left.numeralEdge?.("last") === true && right.numeralEdge?.("first") === true
}

/** A kern's glue, emitting the command its width is written with; a kern no command gives declines. */
function rebuiltKern(glue: Factor): Factor {
  const tex = glue.kern
  if (tex == null) {
    throw new Unsupported("spacing between two numerals that the engine cannot re-emit as written, which is not supported")
  }
  return { ...glue, emit: () => tex }
}

/**
 * Kerns carry no source span and emission drops them (spacingTexOf), which is
 * inert between most factors and not between two numerals the author set
 * apart: `3\,10^{2}` came back as `310^{2}`, `2.5\,10^{-3}` as `2.510^{-3}`
 * and `3\,2` as `32`, and the backstop's comparison, which ignores the kern it
 * lost, passed them. Where nothing that prints stands between two factors
 * that meet as numerals as written, every kern between them is emitted,
 * rebuilt from its width as headSpacingTex rebuilds one. Numerals that meet
 * only once a strip has bared one of them (`3\,\frac{2G}{c^2}` prints `32`)
 * were never side by side in the source, and a kern kept between them would
 * not keep them apart, for a thin space is how digits are grouped: the
 * numeral-fusion net declines those rows (numeralFusionNet).
 */
function keepNumeralsApart(factors: Factor[], ctx: Ctx): void {
  let prev = -1
  for (let k = 0; k < factors.length; k += 1) {
    const f = factors[k]
    if (f.kind === "glue" || f.vanishes?.() === true) continue
    const left = prev >= 0 ? factors[prev] : null
    const between = factors.slice(prev + 1, k)
    if (
      left != null &&
      between.every((glue) => glue.kind === "glue" && glue.emit() === "") &&
      between.some((glue) => glue.kern !== undefined) &&
      maskedEmission(ctx, () => numeralsMeet(left, f))
    ) {
      for (let g = prev + 1; g < k; g += 1) {
        if (factors[g].kern !== undefined) factors[g] = rebuiltKern(factors[g])
      }
    }
    prev = k
  }
}

/**
 * Whether a sum, as a live emission prints it, opens or closes on a numeral.
 * A signed first term opens on its sign. A product whose every factor vanished
 * prints the 1 emitTerm leaves in its place (`{2 + c^2}` prints `2 + 1`), and
 * an emptied denominator prints nothing, so its term ends on the numerator.
 */
function sumNumeralEdge(sum: SumInfo, side: "first" | "last"): boolean {
  const term = side === "first" ? sum.terms[0] : sum.terms[sum.terms.length - 1]
  if (side === "first" && term.sign !== "") return false
  if (term.slashIdx < 0) return productNumeralEdge(term.factors, side) ?? true
  const num = term.factors.slice(0, term.slashIdx)
  const den = term.factors.slice(term.slashIdx + 1)
  if (side === "first") return productNumeralEdge(num, side) ?? true
  return productNumeralEdge(den, side) ?? productNumeralEdge(num, side) ?? true
}

/** The numeral edge of a product's surviving factors, or null when every one vanished. */
function productNumeralEdge(factors: Factor[], side: "first" | "last"): boolean | null {
  const live = factors.filter((f) => f.kind !== "glue" && f.vanishes?.() !== true)
  if (live.length === 0) return null
  return live[side === "first" ? 0 : live.length - 1].numeralEdge?.(side) === true
}

/** A product that joinFactors emits as "": nothing but glue and factors that vanish. */
function printsNothing(factors: Factor[]): boolean {
  return factors.every((f) => f.kind === "glue" || f.vanishes?.() === true)
}

/**
 * A product that prints nothing but numerals: every surviving factor a digit
 * run, raised or not, or none at all, where emission sets a 1 in its place.
 * The constants π, e and i are not digits, and `3\frac{\pi}{2}` is no mixed number.
 */
function printsNumeralOnly(factors: Factor[]): boolean {
  return factors.every(
    (f) => f.kind === "glue" || f.vanishes?.() === true || (f.kind === "num" && f.numeralEdge?.("first") === true),
  )
}

/** Every factor of a product vanishes under the strip, and there is at least one. */
function productVanishes(factors: Factor[]): boolean {
  const live = factors.filter((f) => f.kind !== "glue")
  return live.length > 0 && live.every((f) => f.vanishes?.() === true)
}

/**
 * A wrapped sum vanishes when it is one unsigned term whose factors all do:
 * `{c}`, `(c^{2})` and `\sqrt{G}` wrap nothing once c and G are one. A sign
 * or a second term keeps it (`(-c)` is −1, and `(1 + c)` still a sum).
 */
function sumVanishes(sum: SumInfo): boolean {
  return !sum.multiTerm && sum.terms[0].sign === "" && productVanishes(sum.terms[0].factors)
}

function emitTerm(t: TermInfo, ctx: Ctx): string {
  // Stripped constants may leave a side of a "/" (or the whole term) empty.
  if (t.slashIdx >= 0) {
    const num = joinFactors(t.factors.slice(0, t.slashIdx), ctx)
    const den = joinFactors(t.factors.slice(t.slashIdx + 1), ctx)
    if (den === "") return num === "" ? emptyProductTex(ctx) : num
    if (num === "") return `${emptyProductTex(ctx)}/${den}`
    return `${num}/${den}`
  }
  return joinFactors(t.factors, ctx) || emptyProductTex(ctx)
}

/**
 * Emit a factor list with constants inserted where physics culture expects
 * them: G lands just after the leading numeral cluster (`8\pi G T_{ab}`),
 * c lands at the tail but before any trailing differentials (`c^{2}dt^{2}`,
 * `2\pi k_B c`). Both insertion positions are computed on the factor list
 * first, so neither insertion shifts the other.
 */
function partsWith(factors: Factor[], gTex: string, cTex: string, ctx: Ctx): string[] {
  const parts = factors.map((f) => factorTex(f, f.isBareSum ? `\\left(${f.emit()}\\right)` : f.emit(), ctx))
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
  // After an unparenthesized function argument, c would read as more of it:
  // `v = \tanh\phi` restored as `\tanh\phi c` says tanh(φc). It goes before the
  // function head instead (`c\tanh\phi`), and before every head whose
  // argument runs on into the next (`\sin\theta\cos\phi`).
  for (;;) {
    let prev = tailPos - 1
    while (prev >= 0 && factors[prev].kind === "glue") prev -= 1
    if (prev < 0 || factors[prev].openArgument !== true) break
    tailPos = prev
  }
  if (cTex) parts.splice(tailPos, 0, cTex)
  if (gTex) parts.splice(headPos, 0, gTex)
  return parts
}

/** Rebuild a term with c^(a/12) G^(b/12) inserted in the culturally expected slots. */
function emitTermWith(t: TermInfo, a12: number, b12: number, ctx: Ctx): string {
  if (a12 === 0 && b12 === 0) return emitTerm(t, ctx)

  // Half-integer powers read best inside a square root when there is one.
  if ((a12 % D12 !== 0 || b12 % D12 !== 0) && t.slashIdx < 0) {
    const sqrtIdx = t.factors.findIndex((f) => f.kind === "sqrt" && f.sqrt?.bodyTerm)
    if (sqrtIdx >= 0 && t.factors.filter((f) => f.kind === "sqrt").length === 1) {
      const bodyTerm = t.factors[sqrtIdx].sqrt!.bodyTerm!
      // The body's sign is the sum's to emit, and rebuilt from the term alone it
      // went missing: `x = \sqrt{-Mr}` came back as `\sqrt{\frac{GMr}{c^{2}}}`.
      const inner = leadSignTex(bodyTerm, ctx) + emitTermWith(bodyTerm, a12 * 2, b12 * 2, ctx)
      const parts = t.factors.map((f, idx) => factorTex(f, idx === sqrtIdx ? `\\sqrt{${inner}}` : f.emit(), ctx))
      return joinTex(parts)
    }
  }

  // A power restored, which a replay for the numeral-fusion net marks opaque
  // and closes as the written factor folded into it, `from`, or else as a
  // factor no written one is (Ctx.net).
  const restored = (tex: "c" | "G", e12: number, from?: Factor) =>
    ctx.net == null
      ? formatExp(tex, e12)
      : `${netOpaque(formatExp(tex, e12))}${NET_END}${from == null ? "restored" : netId(ctx.net, from)}${NET_TAG_CLOSE}`
  const cNum = a12 > 0 ? restored("c", a12) : ""
  const cDen = a12 < 0 ? restored("c", -a12) : ""
  const gNum = b12 > 0 ? restored("G", b12) : ""
  const gDen = b12 < 0 ? restored("G", -b12) : ""

  // A source-level “x/y” term keeps its slash form (the separator factor at
  // slashIdx is skipped and re-emitted between the halves).
  if (t.slashIdx >= 0) {
    const numF = t.factors.slice(0, t.slashIdx)
    const denF = t.factors.slice(t.slashIdx + 1)
    const numParts = partsWith(numF, gNum, cNum, ctx)
    const denParts = partsWith(denF, gDen, cDen, ctx)
    return `${joinTex(numParts)}/${joinTex(denParts)}`
  }

  // A term led by a fraction absorbs the constants into that fraction.
  const fracIdx = t.factors.findIndex((f) => f.kind === "frac")
  if (fracIdx >= 0 && t.factors[fracIdx].frac) {
    const frac = t.factors[fracIdx].frac!
    // Drop a now-redundant bare 1 numerator: \frac{1·c⁴}{…} → \frac{c⁴}{…}.
    const bareOne =
      (gNum !== "" || cNum !== "") && frac.num.length === 1 && frac.num[0].kind === "num" && frac.num[0].emit() === "1"
    const numParts = partsWith(bareOne ? [] : frac.num, gNum, cNum, ctx)
    const denParts = partsWith(frac.den, gDen, cDen, ctx)
    const fracTex = `${frac.cmd}{${joinTex(numParts)}}{${joinTex(denParts)}}`
    return joinTex(t.factors.map((f, idx) => factorTex(f, idx === fracIdx ? fracTex : f.emit(), ctx)))
  }

  // Plain product: an inserted constant first folds into a power of the same
  // constant the term already carries, then joins the product; negatives wrap
  // the result in a fraction.
  const merged = mergeConstants(t.factors, a12, b12)
  const numParts = partsWith(
    merged.factors,
    merged.b12 > 0 ? restored("G", merged.b12, merged.folded.G) : "",
    merged.a12 > 0 ? restored("c", merged.a12, merged.folded.c) : "",
    ctx,
  )
  const numerator = joinTex(numParts) || emptyProductTex(ctx)
  const mergedDen =
    (merged.b12 < 0 ? restored("G", -merged.b12) : "") +
    (merged.a12 < 0 ? restored("c", -merged.a12) : "")
  if (mergedDen === "") return numerator
  return `\\frac{${numerator}}{${mergedDen}}`
}

/**
 * Fold an inserted power of c or G into a power of the same constant already in
 * the term. Without this, `c` needing a c⁻¹ emitted `\frac{Gc}{c}` instead of
 * `G`, and `mc` needing another c emitted `mcc` instead of `mc^{2}`.
 *
 * A constant that alone keeps two numerals apart stays where it is written:
 * folded, it left them side by side, and `x = 2\,G\,3\,M` restored to
 * `\frac{23GM}{c^{2}}` (the kerns between print nothing), and `x = 2\ G\ 3\ M`
 * to `\frac{2\ \ 3G\ M}{c^{2}}`, which reads as 23 all the same. Kept, it is not
 * folded, and an inserted power of it is set beside the product as it would
 * be with no constant written.
 *
 * `folded` holds the first written factor of each constant folded away, so
 * that the power it went into is, to the numeral-fusion net, that factor
 * moved, not a factor the author never wrote (Ctx.net).
 */
function mergeConstants(
  factors: Factor[],
  a12: number,
  b12: number,
): { factors: Factor[]; a12: number; b12: number; folded: { c?: Factor; G?: Factor } } {
  const folded: { c?: Factor; G?: Factor } = {}
  if (!factors.some((f) => f.constant)) return { factors, a12, b12, folded }
  let a = a12
  let b = b12
  const rest: Factor[] = []
  factors.forEach((f, k) => {
    if (f.constant == null || separatesNumerals(rest, factors.slice(k + 1))) {
      rest.push(f)
      return
    }
    folded[f.constant.tex] ??= f
    if (f.constant.tex === "c") a += f.constant.e12
    else b += f.constant.e12
  })
  return { factors: rest, a12: a, b12: b, folded }
}

/**
 * Whether a factor set between `before` and `after` is all that keeps two
 * numerals apart: the last factor before it and the first after it that is
 * not itself a constant to fold meet as numerals (numeralsMeet), with nothing
 * printed between them. Spacing prints nothing there, as the numeral-fusion
 * net reads it: a kern, a control space `\ ` and a `~` alike (`2\ 3` is 23
 * with its digits grouped), where a product sign prints.
 */
function separatesNumerals(before: Factor[], after: Factor[]): boolean {
  let left = before.length - 1
  while (left >= 0 && before[left].kind === "glue") left -= 1
  let right = 0
  while (right < after.length && (after[right].kind === "glue" || after[right].constant != null)) right += 1
  if (left < 0 || right >= after.length || !numeralsMeet(before[left], after[right])) return false
  const between = [...before.slice(left + 1), ...after.slice(0, right)]
  return between.every((f) => f.kind !== "glue" || printsNothingBetweenNumerals(f.emit()))
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
  /** The row opens at a relation and continues the chain above it, whose statement it is. */
  continued: boolean
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

/**
 * Relations KaTeX builds from a macro as an `htmlmathml` pair, recognized by
 * the character of their MathML half: the relation each one is, and the
 * commands that write it. Since KaTeX 0.16.47 `\neq` and `\ne` arrive this way
 * rather than as rel atoms, and every ≠ statement had declined as an
 * unsupported "htmlmathml" construct. ≕ (`\eqqcolon`, a definition written
 * right to left) is left out with `=:`: the corpus has none, and `E = :Mc^2:`,
 * a normal-ordered product, is exactly `=` followed by `:`.
 */
const HTMLMATHML_RELS: Record<string, { rel: string; spellings: string[] }> = {
  "≠": { rel: "\\neq", spellings: ["\\neq", "\\ne"] },
  "≔": { rel: ":=", spellings: ["\\coloneqq"] },
}

function htmlmathmlRelOf(n: any): { rel: string; spellings: string[] } | null {
  if (n?.type !== "htmlmathml" || !Array.isArray(n.mathml) || n.mathml.length !== 1) return null
  const m = n.mathml[0]
  const body = (m?.type === "mclass" && m.mclass === "mrel") || m?.type === "op" ? m.body : null
  if (!Array.isArray(body) || body.length !== 1 || body[0]?.type !== "textord") return null
  return HTMLMATHML_RELS[body[0].text] ?? null
}

/** The relation a node stands for, or null: a rel atom's text, or ≠ and ≔ from their MathML half. */
function relTextOf(n: any): string | null {
  if (n?.type === "atom" && n.family === "rel") return n.text
  return htmlmathmlRelOf(n)?.rel ?? null
}

/** KaTeX's `\not`: an htmlmathml node whose MathML half is the combining long solidus U+0338. */
function isNotSlash(n: any): boolean {
  return (
    n?.type === "htmlmathml" &&
    Array.isArray(n.mathml) &&
    n.mathml.length === 1 &&
    n.mathml[0]?.type === "textord" &&
    n.mathml[0].text === "\u0338"
  )
}

/** Whatever closes the node before a relation: whitespace, closing braces, an alignment tab, a `\right` delimiter. */
const CLOSING_SYNTAX = /^(?:\s|\}|&|\\right\s*(?:\\[a-zA-Z]+|\\.|[^\s\\]))*/

/**
 * The spelling of a relation built from a macro, which carries no loc of its
 * own. It is read forward from the end of the nearest located node before it,
 * past only the syntax that closes that node, and accepted only when the first
 * command found there is one of the relation's own spellings. Anything else
 * gives null: the relation declines rather than being emitted as something the
 * reader did not write.
 *
 * Forward, not between the neighbours on both sides: the node after a relation
 * is often located only inside itself — a fraction at its numerator, a root at
 * its radicand — so the slice up to it swallowed `\frac{` and `\sqrt{`, and
 * `r \ne \frac{M}{2}` declined as a reassembly fault.
 */
function relSpellingOf(grouped: any[], idx: number, ctx: Ctx, spellings: string[]): string | null {
  let start = 0
  for (let j = idx - 1; j >= 0; j -= 1) {
    const span = spanOf(grouped[j], ctx.input)
    if (span) {
      start = span[1]
      break
    }
  }
  const rest = ctx.input.slice(start).replace(CLOSING_SYNTAX, "")
  const word = /^\\[a-zA-Z]+/.exec(rest)?.[0]
  return word != null && spellings.includes(word) ? word : null
}

/** The decline for a relation nothing is restored across, named by what it is. */
function unsupportedRelReason(text: string): string {
  if (text === "\\propto") {
    return "a proportionality — constants are absorbed in ∝, so restoring them is not meaningful"
  }
  if (ARROWS.has(text)) {
    return `the arrow “${text}” — a substitution, a limit, or a map, none of which fixes a dimension`
  }
  if (EXCHANGES.has(text)) return `the exchange “${text}” (a swap or a duality), which is not an equation`
  if (text === ":") {
    return "a colon that is not part of “:=” (normal ordering, a ratio, or a map), which the engine does not read"
  }
  if (text === "\\parallel") return "“\\parallel” (a norm bar or “parallel to”), which the engine does not read"
  if (text === "\\mid") return "“\\mid” (a conditional or an inner-product bar), which the engine does not read"
  return `the unsupported relation “${text}”`
}

/**
 * The target a row may continue: the dimension of the chain above it, null
 * when nothing is above it, or "ambiguous" when the row above held a
 * separator (translateLine) and a continuation could belong to the statement
 * on either side of it.
 */
type Carried = Dim | null | "ambiguous"

function translateRow(nodes: any[], ctx: Ctx, carriedTarget: Carried): RowResult {
  const grouped = groupDelims(nodes)

  const sides: any[][] = []
  const rels: string[] = []
  // What each relation is, whatever its spelling: rels keeps `\coloneqq` as
  // the reader wrote it, and here it is the definition `:=`.
  const relKinds: string[] = []
  const tabAtRel: boolean[] = []
  let current: any[] = []
  let pendingTab = false
  const pushRel = (text: string, kind: string) => {
    sides.push(current)
    rels.push(text)
    relKinds.push(kind)
    tabAtRel.push(pendingTab)
    pendingTab = false
    current = []
  }
  for (let gi = 0; gi < grouped.length; gi += 1) {
    const n = grouped[gi]
    if (n?.type === "__tab") {
      pendingTab = true
      continue
    }
    if (isNotSlash(n)) throw new Unsupported("a relation negated with \\not, which is not supported yet (\\neq is)")
    const built = htmlmathmlRelOf(n)
    if (built != null) {
      const spelled = relSpellingOf(grouped, gi, ctx, built.spellings)
      if (spelled == null) {
        throw new Unsupported(`the relation “${built.rel}”, whose written spelling the engine could not read`)
      }
      pushRel(spelled, built.rel)
      continue
    }
    if (n?.type === "atom" && n.family === "rel") {
      // `:=` is two rel atoms. Adjacent, they are one relation, a definition,
      // and the defined side has by definition the dimension of its definiens.
      // A colon on its own (normal ordering `:X:`, a ratio, a map) is not.
      const next = grouped[gi + 1]
      if (n.text === ":" && next?.type === "atom" && next.family === "rel" && next.text === "=") {
        pushRel(":=", ":=")
        gi += 1
        continue
      }
      if (!SUPPORTED_RELS.has(n.text)) throw new Unsupported(unsupportedRelReason(n.text))
      pushRel((safeSrc(n, ctx) || n.text).trim(), n.text)
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
    parseSum(grouped, ctx, { anchor: "none" }, "wide")
    const src = srcOfNodes(nodes, ctx)
    return { emitSides: () => [src], rels: [], tabAtRel: [], target: ZERO, hadRel: false, continued: false }
  }

  const spacing: FactorSpacing = rels.length > 1 ? "any" : "wide"
  const sums = sides.map((side) =>
    side.length === 0 || side.every((n) => isEmptyOrdgroup(n) || SKIP_TYPES.has(n?.type))
      ? null
      : parseSum(side, ctx, { anchor: "none" }, spacing),
  )

  // Only a row's first side may be empty, and only as a continuation. An empty
  // side anywhere else relates nothing: `E = <p>` read as E, then nothing, then
  // p, and shipped as `E = < pc >`.
  if (sums.some((sum, idx) => sum == null && idx > 0)) {
    throw new Unsupported("a relation with nothing on one side of it")
  }

  // A row that opens at a relation continues the previous row's chain
  // (`r &= 2M \\ &= M`), so its sides take that chain's dimension. Anchored on
  // its own content instead, that row shipped as `= M` in kilograms while the
  // chain was in metres, and `0 &< r \\ &< 2M` passed as unchanged. With no
  // chain before it, nothing anchors it. Any other row anchors on its first
  // side that has a non-zero term (literal zeros carry any dimension).
  //
  // A continuation row is never judged a declaration on its own: `v &= \frac{dr}{dt}
  // \\ &= c` ends a derivation in a constant, and read by itself `= c` declared
  // the whole equation a unit convention. It belongs to its chain, whose first
  // row carries the quantities. Any row that anchors itself is judged, and one
  // declaration declines the whole equation: in `c &= 1 \\ E &= mc^2` the first
  // row would otherwise ship `c = 1` under a unit banner.
  //
  // After a row that held several statements (`r &= 2M, \quad t = M`, or
  // `&\Rightarrow t = M` after the chain above) a continuation could continue
  // any of them, and nothing written says which.
  let target: Dim
  if (sums[0] == null) {
    if (carriedTarget === "ambiguous") {
      throw new Unsupported(
        "a continuation row after a row of several statements — which one it continues is ambiguous",
      )
    }
    if (carriedTarget == null) {
      throw new Unsupported(`a row that begins at “${rels[0]}” with nothing before it to anchor it`)
    }
    target = carriedTarget
  } else {
    declarationGuard(sums, relKinds, ctx)
    const anchored = sums.map((sum) => (sum == null ? null : sumAnchor(sum.terms))).find((d) => d != null)
    // Every term a literal zero: identity.
    target = anchored ?? (carriedTarget === "ambiguous" ? null : carriedTarget) ?? ZERO
  }

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

  return { emitSides, rels, tabAtRel, target: resolvedTarget, hadRel: true, continued: sums[0] == null }
}

/**
 * Logical connectives. Their operands are propositions: a connective relates
 * no quantities, so no dimension flows across it, and each side is a
 * statement translated on its own anchor. Single arrows are not among them
 * (ARROWS): `k \to k/|k|` substitutes one quantity for another.
 */
const CONNECTIVES = new Set([
  "\\Rightarrow",
  "\\Longrightarrow",
  "\\Leftarrow",
  "\\Longleftarrow",
  "\\Leftrightarrow",
  "\\Longleftrightarrow",
])

/**
 * The connectives KaTeX builds from a macro, keyed by the macro body their
 * relation is located in: `\implies` expands to `\DOTSB\;\Longrightarrow\;`,
 * so its rel atom has no span in the equation, and each `\;` becomes a kern
 * beside it. A relation located in one of these bodies can only have been
 * written as that macro — the same fact spacingTexOf reads `~` from — so the
 * macro is re-emitted whole, and its two kerns go with it instead of being
 * emitted a second time as the author's spacing. This reads the parse tree,
 * not the source: the forward scan ≠ needs (relSpellingOf) stops at the
 * spacing authors set around a connective, `\quad\implies\quad`.
 */
const CONNECTIVE_MACROS: Record<string, string> = {
  "\\DOTSB\\;\\Longrightarrow\\;": "\\implies",
  "\\DOTSB\\;\\Longleftarrow\\;": "\\impliedby",
  "\\DOTSB\\;\\Longleftrightarrow\\;": "\\iff",
}

/**
 * The connective at `grouped[idx]`, or null when there is none: its spelling
 * as written, and the kerns its macro set beside it, which no earlier macro
 * may have claimed (`taken`). A connective whose spelling cannot be read
 * declines rather than be emitted as something the reader did not write.
 */
function connectiveAt(
  grouped: any[],
  idx: number,
  ctx: Ctx,
  taken: Set<any>,
): { tex: string; owned: any[] } | null {
  const n = grouped[idx]
  if (!(n?.type === "atom" && n.family === "rel" && CONNECTIVES.has(n.text))) return null
  if (locIsOwn(n.loc, ctx.input)) return { tex: safeSrc(n, ctx) || n.text, owned: [] }
  const macro = CONNECTIVE_MACROS[n.loc?.lexer?.input]
  const owned = [grouped[idx - 1], grouped[idx + 1]]
  if (macro == null || !owned.every((k) => k?.type === "kern" && kernCommandOf(k) === "\\;" && !taken.has(k))) {
    throw new Unsupported(`the relation “${n.text}”, whose written spelling the engine could not read`)
  }
  return { tex: macro, owned }
}

/** What stands between two statements, and the spacing written before and after it. */
type Separator = { kind: "list" | "connective" | "wide"; tex: string; pre: any[]; post: any[] }

type LineItem = { row: RowResult } | { tex: string }

/** A display line as statements: each translated as its own row, in order, with the separators between them. */
type LineResult = { items: LineItem[]; rows: RowResult[] }

const isListPunct = (n: any) => n?.type === "atom" && n.family === "punct" && (n.text === "," || n.text === ";")

/** What a statement is made of: every node but spacing, alignment tabs and empty groups. */
const isStatementContent = (n: any) => isMeaningfulNode(n) && n.type !== "__tab"

/** The total width in em of the run of spacing that starts at `nodes[idx]` (skipEm). */
function runEmAt(nodes: any[], idx: number): number {
  let em = 0
  for (let k = idx; k < nodes.length && nodes[k] != null && SKIP_TYPES.has(nodes[k].type); k += 1) {
    em += skipEm(nodes[k])
  }
  return em
}

/** Whether a run of nodes is a statement: it holds a relation, and ends at none, nor opens at one unless allowed. */
function isStatement(nodes: any[], mayOpenAtRelation: boolean): boolean {
  const content = nodes.filter(isStatementContent)
  return (
    content.some((n) => relTextOf(n) != null) &&
    (mayOpenAtRelation || relTextOf(content[0]) == null) &&
    relTextOf(content[content.length - 1]) == null
  )
}

/**
 * Spacing that separates two statements, re-emitted as written: a spacing
 * node through spacingTexOf, an alignment tab as `&`. A kern has no span, so
 * it is rebuilt from its width: the command KaTeX gives that width, `\mkern`
 * for any other width in mu (LaTeX's `\hspace` takes no mu), `\hspace`
 * otherwise. A kern written some other way (`\enspace`, `\hspace{1em}`)
 * then no longer matches the source, and the backstop declines, naming it.
 */
function separatorSpacingTex(raw: any, ctx: Ctx): string {
  if (raw?.type === "__tab") return "&"
  if (raw?.type === "kern") {
    const command = kernCommandOf(raw)
    if (command != null) return command
    const { number, unit } = raw.dimension
    return unit === "mu" ? `\\mkern${number}mu` : `\\hspace{${number}${unit}}`
  }
  return spacingTexOf(raw, ctx)
}

/** A separator's TeX, spaced to sit between two rows. A list's comma or semicolon closes the statement before it. */
function separatorTex(sep: Separator, ctx: Ctx): string {
  const pre = joinTex(sep.pre.map((n) => separatorSpacingTex(n, ctx)))
  const post = joinTex(sep.post.map((n) => separatorSpacingTex(n, ctx)))
  const body = [pre, sep.tex, post].filter((s) => s !== "").join(" ")
  return `${sep.kind === "list" && pre === "" ? "" : " "}${body} `
}

/**
 * A piece between hard separators, split at each run of spacing at least a
 * quad wide (the whole run totalled, as the between-factors guard totals it)
 * when every part is a statement: each holds a relation, none ends at one,
 * and none but the first opens at one. Otherwise the piece stays whole, and
 * a wide run inside it is left to that guard, which declines it: in
 * `r = 2M \qquad (1)` the (1) is an equation label, not a statement.
 */
function wideSplit(piece: any[]): { parts: any[][]; runs: any[][] } {
  const parts: any[][] = [[]]
  const runs: any[][] = []
  for (let k = 0; k < piece.length; k += 1) {
    const part = parts[parts.length - 1]
    if (piece[k] == null || !SKIP_TYPES.has(piece[k].type) || !part.some(isStatementContent)) {
      part.push(piece[k])
      continue
    }
    let end = k
    while (end < piece.length && piece[end] != null && (SKIP_TYPES.has(piece[end].type) || isEmptyOrdgroup(piece[end]))) {
      end += 1
    }
    const run = piece.slice(k, end)
    const spacing = run.filter((n) => !isEmptyOrdgroup(n))
    if (runEmAt(spacing, 0) >= 1 - 1e-9) {
      runs.push(spacing)
      parts.push([])
    } else {
      part.push(...run)
    }
    k = end - 1
  }
  const split = parts.length > 1 && parts.every((part, j) => isStatement(part, j === 0))
  return split ? { parts, runs } : { parts: [piece], runs: [] }
}

const LIST_REASON = "lists or multiple statements — select a single equation"

/** The relations of SUPPORTED_RELS that order their sides, and so bound them. */
const ORDER_RELS = new Set([
  "<",
  ">",
  "\\le",
  "\\leq",
  "\\leqq",
  "\\leqslant",
  "\\ge",
  "\\geq",
  "\\geqq",
  "\\geqslant",
  "\\ll",
  "\\gg",
  "\\lesssim",
  "\\gtrsim",
  "\\lessapprox",
  "\\gtrapprox",
])

/**
 * Whether the relations on the two sides of a comma, the last before it and
 * the first after it, are both order relations: then the comma can list the
 * terms between them, which both bounds share (`0 < t,\ r < 2M` for t and r
 * each in (0, 2M)), as well as separate two statements. The shared list is a
 * convention of bounds, the interval an inequality chain draws; across an
 * equality it would equate the listed terms with each other, which no one
 * writes a list to say, so `r_s = 2M, \qquad t = 0` stays two statements.
 * The relations are read at the top level of each statement, as the split is.
 */
function sharesOperands(left: any[], right: any[]): boolean {
  const lastRel = [...left].reverse().map(relTextOf).find((rel) => rel != null)
  const firstRel = right.map(relTextOf).find((rel) => rel != null)
  return lastRel != null && firstRel != null && ORDER_RELS.has(lastRel) && ORDER_RELS.has(firstRel)
}

/**
 * A display line as the statements it holds. One line may state several
 * things: a list (`r_s = 2M, \qquad t = 0`), an implication
 * (`M \neq 0 \implies r_s = 2M`), or relations set apart by wide space
 * (`t = 0 \qquad r = 2M`, which read as one chain shipped as t = 0·r = 2M).
 * Nothing crosses a separator: each statement is translated as a row of its
 * own, on its own anchor, and the line is re-emitted statement by statement
 * with each separator and its spacing as written.
 *
 * What separates, at the top level of the line:
 * - `;`, always;
 * - `,` only when explicit spacing follows it. A bare comma separates
 *   arguments and list members as often as statements, so it stays in the
 *   statement and declines there as a list;
 * - a logical connective (CONNECTIVES);
 * - a run of spacing at least a quad wide, only where every part it leaves is
 *   a statement (wideSplit).
 * Every statement must hold a relation and end at none, and none but the
 * first may open at one (the first may continue the chain above it). Between
 * two complete relations a semicolon or a connective has no single-chain
 * reading, so the split is a fact of the notation; a line that falls short of
 * it declines. A comma has a second reading, and is a fact only without it:
 * between two order relations it can list the terms they share, and
 * `a < x,\ y < b` is the standard way to put x and y both in (a, b). Split,
 * `0 < t,\ r < 2M` gave t the bound of r, a length where t needs a time, so a
 * comma with an order relation on each side of it (sharesOperands) declines
 * as a list. Only a leading connective may have nothing before it: its left
 * operand is the previous display, or the prose.
 *
 * The rule is looser than the extension's own splitter (src/tex.ts
 * splitStatements), which wants spacing on both sides of a comma and splits
 * wide space only at `\quad` and `\qquad`. A line that splitter keeps whole
 * reaches the engine whole, and is split here under the guards above.
 *
 * Only the first statement may continue the chain carried from the row
 * above. Each statement is judged for a declaration on its own
 * (declarationGuard, in translateRow), and one declaration declines the whole
 * line: `c = 1, \qquad r_s = 2M` would otherwise restore c in r_s after
 * declaring it 1. The pieces are checked in order, as they are translated, so
 * a reason read in an earlier statement is the one the reader sees.
 */
function translateLine(nodes: any[], ctx: Ctx, carried: Carried): LineResult {
  const grouped = groupDelims(nodes)
  const pieces: any[][] = [[]]
  const seps: Separator[] = []
  const owned = new Set<any>()
  for (let gi = 0; gi < grouped.length; gi += 1) {
    const n = grouped[gi]
    if (owned.has(n)) continue
    if (isListPunct(n) && (n.text === ";" || runEmAt(grouped, gi + 1) > 0)) {
      seps.push({ kind: "list", tex: n.text, pre: [], post: [] })
      pieces.push([])
      continue
    }
    const connective = connectiveAt(grouped, gi, ctx, owned)
    if (connective != null) {
      // The macro's first kern is the node just read into the current piece.
      if (connective.owned.length > 0) {
        pieces[pieces.length - 1].pop()
        owned.add(connective.owned[1])
      }
      seps.push({ kind: "connective", tex: connective.tex, pre: [], post: [] })
      pieces.push([])
      continue
    }
    pieces[pieces.length - 1].push(n)
  }

  // Spacing and an alignment tab around a separator belong to it, not to the
  // statements; `aligned`'s empty shim groups are no one's.
  seps.forEach((sep, i) => {
    const left = pieces[i]
    for (;;) {
      const last = left[left.length - 1]
      if (last == null || !(SKIP_TYPES.has(last.type) || last.type === "__tab" || isEmptyOrdgroup(last))) break
      left.pop()
      if (!isEmptyOrdgroup(last)) sep.pre.unshift(last)
    }
    const right = pieces[i + 1]
    while (right.length > 0 && right[0] != null && (SKIP_TYPES.has(right[0].type) || isEmptyOrdgroup(right[0]))) {
      const first = right.shift()
      if (!isEmptyOrdgroup(first)) sep.post.push(first)
    }
  })

  const items: LineItem[] = []
  const rows: RowResult[] = []
  pieces.forEach((piece, i) => {
    const before = i > 0 ? seps[i - 1] : null
    const after = seps[i] ?? null
    if (before != null) items.push({ tex: separatorTex(before, ctx) })
    if (seps.length > 0) {
      const byConnective = before?.kind === "connective" || after?.kind === "connective"
      const content = piece.filter(isStatementContent)
      if (content.length === 0) {
        if (i === 0 && after?.kind === "connective") return
        throw new Unsupported(byConnective ? "an implication with nothing on one side" : LIST_REASON)
      }
      if (!content.some((n) => relTextOf(n) != null)) {
        // Read as a line with no relation is, for its legend and for any truer
        // reason its content gives (`L_{-1}|\psi\rangle\ ,\ L_{-2}|\psi\rangle`
        // is Dirac notation before it is a list), then declined.
        translateRow(piece, ctx, null)
        throw new Unsupported(
          byConnective ? "an implication whose side is not a statement (it has no relation)" : LIST_REASON,
        )
      }
      if (!isStatement(piece, i === 0)) throw new Unsupported("a relation with nothing on one side of it")
      if (before?.kind === "list" && before.tex === "," && sharesOperands(pieces[i - 1], piece)) {
        throw new Unsupported(LIST_REASON)
      }
    }
    const { parts, runs } = wideSplit(piece)
    parts.forEach((part, j) => {
      if (j > 0) items.push({ tex: separatorTex({ kind: "wide", tex: "", pre: [], post: runs[j - 1] }, ctx) })
      const row = translateRow(part, ctx, i === 0 && j === 0 ? carried : null)
      rows.push(row)
      items.push({ row })
    })
  })
  return { items, rows }
}

/**
 * A line's TeX, statement by statement. Only the start is trimmed (the space
 * before a leading connective): a line ends on a row, whose last character
 * may be the space of a control space.
 */
function lineTexOf(line: LineResult): string {
  return line.items
    .map((item) => ("row" in item ? rowTexOf(item.row) : item.tex))
    .join("")
    .trimStart()
}

/**
 * The unit banner for a line or an array of statements: the one unit when
 * every statement carries it, otherwise each statement's unit in order, with
 * `;\ ` between them. "Both sides carry s" for `r_s &= 2M \\ t &= M` claimed
 * the last row's unit for the whole.
 */
function unitSummaryTex(units: string[]): string {
  return units.every((unit) => unit === units[0]) ? units[0] : units.join(";\\ ")
}

/**
 * Trailing sentence punctuation, token-wise. Display equations routinely end
 * in “\,.”, “\qquad”, or a bare period — the sentence's punctuation, not the
 * equation's. Two guards: a trailing “.” can be a NULL DELIMITER
 * (\right. / \Big.), where stripping it unbalances the math; and a matched
 * “\<char>” is only a control token when its backslash is an escape — the run
 * of backslashes ending there must have odd total length (in “x \\ ” the
 * matched backslash is the tail of a row separator).
 * A trailing colon is not sentence punctuation: it can close a normal-ordered
 * product, and stripping it rewrote `E = :Mc^2:` into `E = :Mc^2`, an equation
 * the reader did not write. Kept, a lone colon declines as what it is.
 * Exported: the stage-2 extractor uses this same stripper, so the two layers
 * cannot disagree about what a delimiter dot is.
 */
export function stripTrailingPunctuation(tex: string): string {
  // Trailing whitespace goes, except the space of a control space: trimmed, it
  // left a lone backslash (`E = m\ ` became the unparseable `E = m\`), which
  // is how the engine's own restored `E = m\ ` failed to read back. Kept, the
  // whole control space is stripped below like any other trailing spacing.
  let t = tex.replace(/\s+$/, "")
  if ((/\\+$/.exec(t)?.[0].length ?? 0) % 2 === 1) t += " "
  for (;;) {
    let m = t.match(/(\\(?:quad|qquad)|\\[,;:! ]|[.,;~]|\s)$/)
    if (!m) return t
    if (m[0].startsWith("\\")) {
      const runBefore = (t.slice(0, t.length - m[0].length).match(/\\*$/) ?? [""])[0].length
      if ((runBefore + 1) % 2 === 0) {
        m = t.match(/([.,;~]|\s)$/)
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
  const ctx: Ctx = {
    input: tex,
    reg,
    legend: new Map(),
    unknown: new Map(),
    mutated: false,
    strip: false,
    mask: false,
    font: null,
    constantsRead: [],
    net: null,
  }
  const legendOut = () =>
    Array.from(ctx.legend.values()).map((record) => ({
      tex: record.tex,
      gloss: record.gloss,
      unit: legendUnitOf(record, DEFAULT_TARGET),
    }))
  try {
    const nodes = katex.__parse(tex, { strict: false, trust: false, displayMode: true })
    if (containsRel(groupDelims(nodes))) {
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

/**
 * A numeral as the net reads it: its TeX, and its identity. A numeral factor's
 * digits carry the factor's (factorTex), the same in the live replay and the
 * masked one; a fraction of numerals carries its parts'. A digit no numeral
 * factor printed carries its spelling: one in an index, a power or a
 * radical's degree sliced from the source as written, which both replays
 * print alike.
 */
type NumeralMark = { tex: string; id: string }

/**
 * A line of print, as far as numerals go: each numeral in order, and a break
 * (null) wherever something visible stands between two of them.
 */
type NumeralLine = (NumeralMark | null)[]

/**
 * What the net reads off a replay: its lines of numerals, and for each sign
 * a net replay tagged (leadSignTex), the identity of the factor it is set
 * right after, or null. A sign is set right after a factor when the last
 * thing printed before it is that factor's end, with nothing but spacing,
 * braces or null delimiters between: `3{-2}` sets the − right after the 3,
 * where it reads as a subtraction, and `3\cdot{-2}` and `= {-2}` set it after
 * no factor.
 */
type NetReading = { lines: NumeralLine[]; signs: Map<string, string | null> }

/**
 * Reads the lines a TeX string prints into `reading`, and returns the
 * string's own. A numeral is a digit, or a decimal point, as a numeral factor
 * reads it (so `32` is two numerals side by side, and a strip that fuses `3`
 * and `2` into `32` shows), or a fraction whose numerator and denominator are
 * both digit runs (`\frac{1}{2}`, `\frac12`). A numeral with a numeric power
 * (`10^{3}`, `\frac{1}{2}^{2}`) is still a numeral at its end. Braces, the
 * null delimiters `\left.` and `\right.`, whitespace, spacing, and commands
 * that only restyle what they hold print nothing between two numerals;
 * anything else is visible: a letter, a sign, a bracket or bar, an operator,
 * a root. A fraction's numerator and denominator, and a script, are lines of
 * their own, whose numerals never meet one outside them (`c^{2}5` is c²·5,
 * not a 25), and a numeric script is that line as well as part of the numeral
 * it may sit on (`10^{23}` holds the pair 2, 3). An opaque mark (netOpaque)
 * prints something visible, and nothing in it is read.
 */
function numeralLines(tex: string, reading: NetReading): NumeralLine {
  const line: NumeralLine = []
  reading.lines.push(line)
  // The factor whose end is the first thing read since the last visible mark.
  let after: string | null = null
  const visible = (mark: NumeralMark | null) => {
    line.push(mark)
    after = null
  }
  let i = 0
  while (i < tex.length) {
    const ch = tex[i]
    if (ch === NET_NUMERAL || ch === NET_END || ch === NET_SIGN) {
      const close = tex.indexOf(NET_TAG_CLOSE, i)
      const id = tex.slice(i + 1, close)
      i = close + 1
      if (ch === NET_END) {
        after ??= id
      } else if (ch === NET_SIGN) {
        reading.signs.set(id, after)
      } else {
        for (; i < tex.length && /[0-9.]/.test(tex[i]); i += 1) visible({ tex: tex[i], id: `#${id}` })
      }
    } else if (/[\s{}~]/.test(ch)) {
      i += 1
    } else if (/[0-9.]/.test(ch)) {
      visible({ tex: ch, id: `=${ch}` })
      i += 1
    } else if (ch === NET_OPEN) {
      let depth = 0
      do {
        if (tex[i] === NET_OPEN) depth += 1
        else if (tex[i] === NET_CLOSE) depth -= 1
        i += 1
      } while (depth > 0 && i < tex.length)
      visible(null)
    } else if (ch === "^" || ch === "_") {
      const script = texArgumentAt(tex, i + 1)
      const body = script.body.replace(NET_TAG, "")
      const numeric = /^[\s{}0-9.+\-/]*$/.test(body)
      const last = line[line.length - 1]
      if (numeric && last != null) {
        last.tex += `${ch}{${body.trim()}}`
        after = null
      } else {
        visible(null)
      }
      // The script's own digits are a line of their own whatever it sits on:
      // a strip inside a script fuses digits there (`10^{2G3}` to `10^{23}`,
      // `2^{1\frac{G}{c^2}0}` to `2^{10}`, `e^{2\,G\,3}` to `e^{23}`), and the
      // power carries them into the value.
      numeralLines(script.body, reading)
      i = script.end
    } else if (ch === "\\") {
      i = controlSequenceMarks(tex, i, visible, reading)
    } else {
      visible(null)
      i += 1
    }
  }
  return line
}

/** Whether glue prints nothing between two numerals, as the net reads it (numeralLines). */
function printsNothingBetweenNumerals(tex: string): boolean {
  return numeralLines(tex, { lines: [], signs: new Map() }).length === 0
}

/** Spacing, and commands that restyle what follows or what they hold without printing anything of their own. */
const INVISIBLE_WORDS = new Set([
  "quad",
  "qquad",
  "enspace",
  "enskip",
  "thinspace",
  "medspace",
  "thickspace",
  "negthinspace",
  "negmedspace",
  "negthickspace",
  "space",
  "nobreakspace",
  "nobreak",
  "allowbreak",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle",
  "rm",
  "bf",
  "it",
  "sf",
  "tt",
  "cal",
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathnormal",
  "mathcal",
  "mathbb",
  "mathfrak",
  "mathscr",
  "boldsymbol",
  "bm",
  "text",
  "textrm",
  "textbf",
  "textit",
  "textsf",
  "texttt",
  "textnormal",
  "mathord",
  "mathbin",
  "mathrel",
  "mathopen",
  "mathclose",
  "mathpunct",
  "mathinner",
  "limits",
  "nolimits",
])
/** Commands whose first argument prints nothing: a width, a color, or content set as blank space. */
const INVISIBLE_ARGUMENT_WORDS = new Set(["hspace", "color", "textcolor", "phantom", "hphantom", "vphantom"])
const KERN_WORDS = new Set(["kern", "mkern", "hskip", "mskip"])
const KERN_WIDTH = /\s*\{?\s*[-+]?[\d.]+\s*[a-z]{2}\s*\}?/y
const DELIMITER_SIZES = /^(?:left|right|middle|bigg?|Bigg?)[lrm]?$/

/**
 * Reads the control sequence at `i` (numeralLines), handing what it prints
 * to `visible`, and returns where the text after it resumes.
 */
function controlSequenceMarks(
  tex: string,
  i: number,
  visible: (mark: NumeralMark | null) => void,
  reading: NetReading,
): number {
  const word = /\\([a-zA-Z]+)/y
  word.lastIndex = i
  const found = word.exec(tex)
  if (found == null) {
    // A control symbol: `\,`, `\:`, `\;`, `\!`, `\>` and a control space print
    // only space; any other (`\\`, `\{`, `\|`) prints.
    if (!/[,:;!>\s]/.test(tex[i + 1] ?? "")) visible(null)
    return i + 2
  }
  const name = found[1]
  let end = i + found[0].length
  if (FRAC_CMDS.has(`\\${name}`)) {
    const num = texArgumentAt(tex, end)
    const den = texArgumentAt(tex, num.end)
    const part = (body: string) => {
      const from = reading.lines.length
      numeralLines(body, reading)
      return digitRunOf(reading.lines.slice(from))
    }
    const numDigits = part(num.body)
    const denDigits = part(den.body)
    visible(
      numDigits != null && denDigits != null
        ? { tex: `\\${name}{${numDigits.tex}}{${denDigits.tex}}`, id: `(${numDigits.id}/${denDigits.id})` }
        : null,
    )
    return den.end
  }
  if (DELIMITER_SIZES.test(name)) {
    const nullDelimiter = /\s*\./y
    nullDelimiter.lastIndex = end
    if (nullDelimiter.exec(tex) != null) return nullDelimiter.lastIndex
    visible(null)
    return end
  }
  if (KERN_WORDS.has(name)) {
    KERN_WIDTH.lastIndex = end
    return KERN_WIDTH.exec(tex) != null ? KERN_WIDTH.lastIndex : end
  }
  if (INVISIBLE_ARGUMENT_WORDS.has(name)) {
    if (tex[end] === "*") end += 1
    return texArgumentAt(tex, end).end
  }
  if (!INVISIBLE_WORDS.has(name)) visible(null)
  return end
}

/**
 * The digits of a fraction's part (controlSequenceMarks), with their
 * identities, when the part prints a digit run and nothing else, else null.
 * It is read off the part's lines, not its text, so that braces, null
 * delimiters and restyling print nothing here as everywhere else in the net:
 * `\frac{1}{{2}}` and `\frac{1}{\left.2\right.}` are ½ to a reader, as
 * `\frac{1}{2}` is. The part's own line must be digits with no break, and no
 * further line (a script) may hold a numeral.
 */
function digitRunOf(partLines: NumeralLine[]): NumeralMark | null {
  const [own, ...further] = partLines
  const marks = own.every((mark) => mark != null && /^[0-9.]$/.test(mark.tex)) ? (own as NumeralMark[]) : []
  if (!marks.some((mark) => /[0-9]/.test(mark.tex))) return null
  if (!further.every((line) => line.every((mark) => mark == null))) return null
  return { tex: marks.map((mark) => mark.tex).join(""), id: marks.map((mark) => mark.id).join(" ") }
}

/** The argument a command or script takes at `i`: a brace group's content, a control sequence, or one character. */
function texArgumentAt(tex: string, i: number): { body: string; end: number } {
  let at = i
  while (at < tex.length && /\s/.test(tex[at])) at += 1
  if (tex[at] === "{") {
    let depth = 0
    for (let k = at; k < tex.length; k += 1) {
      if (tex[k] === "\\") k += 1
      else if (tex[k] === "{") depth += 1
      else if (tex[k] === "}" && --depth === 0) return { body: tex.slice(at + 1, k), end: k + 1 }
    }
    return { body: tex.slice(at + 1), end: tex.length }
  }
  if (tex[at] === "\\") {
    const word = /\\(?:[a-zA-Z]+|[\s\S])/y
    word.lastIndex = at
    const found = word.exec(tex)
    if (found != null) return { body: found[0], end: at + found[0].length }
  }
  return { body: tex.slice(at, at + 1), end: Math.min(at + 1, tex.length) }
}

/** A replay's TeX as the net reads it (numeralLines). */
function netReadingOf(tex: string): NetReading {
  const reading: NetReading = { lines: [], signs: new Map() }
  numeralLines(tex, reading)
  return reading
}

/** The runs of numerals a reading holds side by side; a lone numeral is a run of one. */
function numeralRuns(reading: NetReading): NumeralMark[][] {
  const runs: NumeralMark[][] = []
  for (const line of reading.lines) {
    let run: NumeralMark[] = []
    for (const mark of [...line, null]) {
      if (mark != null) {
        run.push(mark)
      } else {
        if (run.length > 0) runs.push(run)
        run = []
      }
    }
  }
  return runs
}

/** Two numerals set side by side, by identity. */
function pairKey(left: NumeralMark, right: NumeralMark): string {
  return `${left.id}\n${right.id}`
}

/**
 * The first place in `runs` where two numerals stand side by side that
 * `against` never sets side by side, or null: the run, and the index of the
 * numeral after the join.
 */
function unmatchedJoin(runs: NumeralMark[][], against: NumeralMark[][]): { run: NumeralMark[]; at: number } | null {
  const joins = new Set(against.flatMap((run) => run.slice(1).map((mark, k) => pairKey(run[k], mark))))
  for (const run of runs) {
    for (let at = 1; at < run.length; at += 1) {
      if (!joins.has(pairKey(run[at - 1], run[at]))) return { run, at }
    }
  }
  return null
}

/**
 * The two numerals that meet at a join, each whole: the digits of one
 * numeral factor go together (`10^{3}` and `5`, not `0^{3}` and `5`).
 */
function numeralsAt(run: NumeralMark[], at: number): [string, string] {
  let from = at - 1
  while (from > 0 && run[from - 1].id === run[at - 1].id) from -= 1
  let to = at + 1
  while (to < run.length && run[to].id === run[at].id) to += 1
  const tex = (marks: NumeralMark[]) => marks.map((mark) => mark.tex).join("")
  return [tex(run.slice(from, at)), tex(run.slice(at, to))]
}

/**
 * The numeral-fusion net. Two numerals set side by side read as one number:
 * `32` or `3\,2` (a thin space is how digits are grouped) as thirty-two,
 * `3\,\frac{1}{2}` as the mixed number 3½. A translation that sets side by
 * side two numerals the source kept apart made a number the author did not
 * write: `3\,\frac{G}{2c^2}M` stripped to `3\,\frac{1}{2}M`, 3½ M where the
 * value is 1.5 M, and `2\,\left.\frac{3G}{c^2}\right|M` to `2\left.3\right|M`,
 * 23 M where it is 6 M. One that sets something between two numerals the
 * source set side by side split a number the author wrote: `3\,\frac{1}{2}M`
 * restored as `3\,\frac{G}{2c^{2}}M` keeps only the product 3·½, where the
 * source may mean 3½.
 *
 * Guards that matched these shapes term by term were passed, one review round
 * after another, by a shape one bracket or one delimiter away. The net reads
 * the whole output instead: the numerals the live emission prints against
 * those the masked emission, the source as written, prints, both replayed
 * with the constants opaque and every numeral tagged with its identity
 * (Ctx.net). Each numeral is compared as the one it is, never by spelling:
 * two numerals the live replay sets side by side that the masked one does
 * not are a number made, and two the masked replay sets side by side that
 * the live one does not are a number split. Two readings that set the same
 * numerals side by side, pair for pair, hold the same runs, so this is the
 * runs compared as sequences of identities, and nothing made in one place is
 * offset by anything split, removed or written elsewhere. Matched by
 * spelling, runs let `x = 2\,\left.3\right.\,M + 2\ G\ 3\ M` ship at SI: the
 * first term's `2\,\left.3\right.` was split by a restored G, the second
 * term's 2 and 3 were set side by side by a folded one, and the two runs
 * spelled 2 3 answered for each other. A numeral no numeral factor printed
 * is known by its spelling (NumeralMark), which only an index, a power or a
 * radical's degree sliced from the source as written prints, alike in both
 * replays; the 1 an emptied product prints is tagged as made (emptyProductTex).
 *
 * A strip only removes, which can make a join and cannot split one, so to a
 * geometrized target only a join made is asked. A restoration adds letters,
 * scripts and structure, which split one, and it moves a constant it folds
 * into another power of itself, which can make one where that constant was
 * all that stood between two numerals (separatesNumerals keeps such a
 * constant in place; this is the net under it).
 *
 * Signs are read the same way. A sign written on a factor (`{-2}`, `{+M}`)
 * that is set right after another factor reads as a sign between terms: `3{-2}M`
 * reads 3 − 2M. Where the live replay sets such a sign right after another
 * factor than the masked one does, or right after a factor where the masked
 * one sets it after none, the translation moved the sign against its
 * neighbor: `x = 3\,\frac{G}{c^2}\,{-2}M` stripped to `3{-2}M`, which reads
 * 3 − 2M where the value is −6M, and `x = {-2}M` restored as
 * `\frac{G{-2}M}{c^{2}}`, which reads (G − 2M)/c². A sign the author set right
 * after a factor, and a translation leaves there, is the author's reading;
 * a written constant folded into a restored power is that constant moved
 * (mergeConstants), so `3\,G\,{-2}\,M` restored as `\frac{3G{-2}M}{c^{2}}`
 * keeps the sign where the author set it.
 */
function numeralFusionNet(
  live: string,
  masked: string,
  stripped: boolean,
  signQuote: (id: string) => string,
): void {
  const printedReading = netReadingOf(live)
  const writtenReading = netReadingOf(masked)
  const printed = numeralRuns(printedReading)
  const written = numeralRuns(writtenReading)
  const made = unmatchedJoin(printed, written)
  if (made != null) {
    const [left, right] = numeralsAt(made.run, made.at)
    throw new Unsupported(
      stripped
        ? `the numerals ending “${left}” and opening “${right}”, which a stripped constant leaves side by side as one number — not supported`
        : `the numerals ending “${left}” and opening “${right}”, which the restoration sets side by side as one number, moving the constant written between them — not supported`,
    )
  }
  if (!stripped) {
    const split = unmatchedJoin(written, printed)
    if (split != null) {
      const [left, right] = numeralsAt(split.run, split.at)
      throw new Unsupported(
        `the numerals ending “${left}” and opening “${right}”, one number or a product, which a constant restored between or into them would leave only as the product — not supported`,
      )
    }
  }
  for (const [id, after] of printedReading.signs) {
    if (after == null || writtenReading.signs.get(id) === after) continue
    throw new Unsupported(
      stripped
        ? `the sign on “${signQuote(id)}”, which a stripped constant leaves right after another factor, where it reads as a sign between terms — not supported`
        : `the sign on “${signQuote(id)}”, which the restoration sets right after another factor, where it reads as a sign between terms — not supported`,
    )
  }
}

/**
 * Spacing commands that make a kern the engine cannot re-emit as written: the
 * kern carries no span, so it is dropped, or rebuilt as the one command its
 * width has (`\hspace{1em}` as `\quad`), and the rebuilt equation falls short
 * of the source. The backslash before each must not be the second half of a
 * `\\`.
 */
const UNWRITTEN_SPACING =
  /(?<!\\)((?:\\\\)*)(\\(?:hspace\*?\s*\{[^{}]*\}|(?:kern|mkern|hskip|mskip)\s*\{?\s*[-+]?[\d.]+\s*[a-z]{2}(?:\s*\})?|(?:enspace|enskip|thinspace|medspace|thickspace|negthinspace|negmedspace|negthickspace)(?![a-zA-Z])))/g
/** A control space, `\ `, whose backslash is not the second half of a `\\`. */
const CONTROL_SPACE = /(?<!\\)(?:\\\\)*\\\s/

/**
 * Where the rebuilt equation diverges from its source only by spacing the
 * engine cannot re-emit, the divergence is that spacing, and it is named:
 * `t = r \enspace - r` and `r\sin\hspace{1em}(M/t)` had declined as a generic
 * reassembly fault. So is a control space that the reading drops, as it does
 * one opening a side of a fraction (`\frac{\ G\ M}{c^2}`). A divergence in
 * anything else keeps the generic reason: a control space fused into the next
 * token (`r\\sqrt`) is not a spacing that went missing. The spacing named is
 * the first one written that the rebuilt equation lacks, not merely the first
 * one written, which a source-spelled construct may have carried through.
 */
function unwrittenSpacingGuard(masked: string, source: string, cmpNorm: (s: string) => string): void {
  const unwritten = (s: string) => cmpNorm(s.replace(UNWRITTEN_SPACING, "$1"))
  const spellings = (s: string) => {
    const found: string[] = []
    s.replace(UNWRITTEN_SPACING, (_match: string, _pairs: string, spelling: string) => {
      found.push(spelling)
      return ""
    })
    return found
  }
  const kept = spellings(masked)
  const lost = spellings(source).find((spelling) => {
    const at = kept.indexOf(spelling)
    if (at < 0) return true
    kept.splice(at, 1)
    return false
  })
  if (lost != null && unwritten(masked) === unwritten(source)) {
    throw new Unsupported(unwrittenSpacingReason(lost))
  }
  const spaceless = (s: string) => unwritten(s).split(CONTROL_SPACE_SENTINEL).join("")
  if (CONTROL_SPACE.test(source) && spaceless(masked) === spaceless(source)) {
    throw new Unsupported(unwrittenSpacingReason("\\ "))
  }
}

function unwrittenSpacingReason(spacing: string): string {
  return `the spacing “${spacing}”, which the engine cannot re-emit as written, is not supported`
}

/** Stands in for a control space (`\ `) in the backstop's comparison; no TeX source contains it. */
const CONTROL_SPACE_SENTINEL = "\u0000"

export function translateTex(
  rawTex: string,
  katex: { __parse: (tex: string, options?: Record<string, unknown>) => any[] },
  reg: HubRegistry,
  spec: TargetSpec = DEFAULT_TARGET,
): TranslationResult {
  return translateCore(rawTex, katex, reg, spec, false)
}

/**
 * `rereading` is set only when the core reads back an equation it has just
 * restored (the re-read backstop in checkRebuilt), so that reading is never
 * checked by a third one.
 */
function translateCore(
  rawTex: string,
  katex: { __parse: (tex: string, options?: Record<string, unknown>) => any[] },
  reg: HubRegistry,
  spec: TargetSpec,
  rereading: boolean,
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
    font: null,
    constantsRead: [],
    net: null,
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
    make: () => { restoredTex: string; statementUnits: string[]; changed: boolean } | "no-anchor",
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
      const units = outcome.statementUnits
      return {
        kind: "translated",
        originalTex: tex,
        restoredTex: outcome.restoredTex,
        changed: outcome.changed,
        targetUnitTex: unitSummaryTex(units),
        ...(units.length > 1 ? { statementUnitTex: units } : {}),
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
  //
  // A control space is not whitespace. Stripping its space with the rest left a
  // lone backslash, so `r\ \sqrt{…}` normalized to the same string as the
  // corrupt `r\\sqrt{…}` (a line break), and `r\ r` to the same as `r\r`, and
  // the backstop passed both. Deleting the whole control space instead would
  // equate `r\ r` with `rr`. Each one — a backslash after an even run of
  // backslashes, then a space, tab or newline — becomes a sentinel, so a
  // control space that goes missing, or fuses into another token, is a
  // divergence.
  const cmpNorm = (s: string) => {
    let out = s
      .replace(/(?<!\\)((?:\\\\)*)\\\s/g, `$1${CONTROL_SPACE_SENTINEL}`)
      .replace(/\\qquad|\\quad|\\[,;!:]/g, "")
      .replace(/[\s{}]/g, "")
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
      unwrittenSpacingGuard(masked, tex, cmpNorm)
      throw new Unsupported(
        "an internal reassembly fault — the rebuilt equation diverged from the source (nothing was shown rather than something wrong)",
      )
    }
    // The masked replay is the source as written, so the numerals it sets
    // side by side are the author's, and the factors its signs are set after;
    // the live one must set the same. Both are replayed once more with the
    // constants opaque and the numerals, factors and signs tagged (Ctx.net),
    // and the replays leave nothing behind: a strip they repeat was recorded
    // the first time.
    const mutated = ctx.mutated
    const net = new Map<object, string>()
    let printed: string
    let written: string
    ctx.net = net
    try {
      printed = rebuild()
      written = maskedEmission(ctx, rebuild)
    } finally {
      ctx.net = null
      ctx.mutated = mutated
    }
    numeralFusionNet(printed, written, ctx.strip, (id) => {
      const term = Array.from(net).find(([, value]) => value === id)?.[0] as TermInfo
      return `${leadSign(term.sign)}${termQuote(term, ctx)}`
    })
    // The masked replay proves the emitters reproduced what the reader wrote; it
    // cannot see a restoration that analysis solved and emission then dropped or
    // misplaced. `ds = d(r - t)` came back verbatim while reporting a change,
    // and `v = \tanh\phi` came back as `\tanh\phi c`, tanh(φc). Read back, a
    // restored equation must balance as it stands: translated, with nothing
    // left to restore or strip. It cannot see a misplacement that keeps the
    // dimensions (a constant set where an operator takes it as its operand);
    // placement rules guard those. Geometrized, it runs only when a strip
    // happened, since only then is the equation mutated. With an unknown symbol
    // the translation declines on that symbol anyway, and a re-read would only
    // relabel it.
    if (!rereading && ctx.mutated && ctx.unknown.size === 0) {
      const again = translateCore(restoredTex, katex, reg, spec, true)
      if (again.kind !== "translated" || again.changed) {
        throw new Unsupported(
          "an internal reassembly fault — the rebuilt equation does not balance when read again (nothing was shown rather than something wrong)",
        )
      }
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
      // A row may hold several statements (translateLine); the banner names
      // the unit of each statement the array states, a continuation row's
      // being its chain's. After a row with a separator in it, a continuation
      // could continue the chain on either side of the separator — before a
      // leading connective, the chain of the rows above — so none is carried.
      let carried: Carried = null
      let anyRel = false
      const results: LineResult[] = []
      const statementUnits: string[] = []
      const gaps: string[] = []
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
        const row = rows[rowIdx]
        if (row.length === 0 || row.every((n) => isEmptyOrdgroup(n) || n?.type === "__tab"))
          continue
        const line = translateLine(row, ctx, carried)
        const stated = line.rows.filter((res) => res.hadRel)
        if (stated.length > 0) {
          carried = line.items.length > 1 ? "ambiguous" : stated[0].target
          for (const res of stated) if (!res.continued) statementUnits.push(unitTexOf(res.target, spec))
          anyRel = true
        } else if (anyRel) {
          throw new Unsupported("a continuation row without its own relation")
        }
        results.push(line)
        // Row spacing is content: `\\[6pt]` must not become a bare `\\`.
        const gap = arrayNode.rowGaps?.[rowIdx]
        gaps.push(gap ? `[${gap.number}${gap.unit}]` : "")
      }
      if (!anyRel) return "no-anchor"
      const rebuild = () => {
        const body = results
          .map(
            (line, idx) => lineTexOf(line) + (idx < results.length - 1 ? ` \\\\${gaps[idx]}\n` : ""),
          )
          .join("")
        return `\\begin{${envName}}${envArg}\n${body}\n\\end{${envName}}`
      }
      const restored = rebuild()
      checkRebuilt(restored, rebuild)
      return { restoredTex: restored, statementUnits, changed: ctx.mutated }
    }

    const line = translateLine(nodes, ctx, null)
    const stated = line.rows.filter((res) => res.hadRel)
    if (stated.length === 0) return "no-anchor"
    const rebuild = () => lineTexOf(line)
    const restored = rebuild()
    checkRebuilt(restored, rebuild)
    return {
      restoredTex: restored,
      statementUnits: stated.map((res) => unitTexOf(res.target, spec)),
      changed: ctx.mutated,
    }
  })
}
