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
}

type FactorKind = "num" | "glue" | "sym" | "diff" | "frac" | "sqrt" | "group" | "func" | "rider"

type Factor = {
  kind: FactorKind
  dim: Dim
  emit: () => string
  /** Multi-term sums need \left(\right) when a constant lands beside them. */
  isBareSum?: boolean
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

function srcOf(node: unknown, ctx: Ctx): string {
  const span = spanOf(node)
  if (!span) throw new Unsupported("a fragment whose source position could not be recovered")
  return ctx.input.slice(span[0], span[1])
}

function srcOfNodes(nodes: unknown[], ctx: Ctx): string {
  const span = spanOf(nodes)
  if (!span) return ""
  return ctx.input.slice(span[0], span[1])
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

function nodeListOf(node: any): any[] {
  if (node == null) return []
  const u = unwrap(node)
  if (u == null) return []
  if (u.type === "ordgroup") return u.body
  return [u]
}

/** Group flat ( … ) / [ … ] runs into synthetic nodes so sums inside plain parens don't split terms. */
function groupDelims(nodes: any[]): any[] {
  const out: any[] = []
  const stack: any[][] = [out]
  const openers: string[] = []
  const CLOSE_FOR: Record<string, string> = {
    "(": ")",
    "[": "]",
    "\\{": "\\}",
    "\\lbrack": "\\rbrack",
    "\\lbrace": "\\rbrace",
    "\\langle": "\\rangle",
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
      if (openers.length === 0 || openers[openers.length - 1] !== n.text) {
        throw new Unsupported("unbalanced delimiters")
      }
      openers.pop()
      stack.pop()
      const parent = stack[stack.length - 1]
      const group = parent[parent.length - 1]
      if (group.loc && n.loc) {
        group.loc = { start: group.loc.start, end: n.loc.end }
      }
      continue
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

function isIndexToken(node: any): boolean {
  const u = unwrap(node)
  if (!u) return false
  if (u.type === "atom" && (u.family === "open" || u.family === "close" || u.family === "punct")) {
    return u.family !== "punct" // commas in indices (derivative notation) are handled as unsupported elsewhere
  }
  if (SKIP_TYPES.has(u.type)) return true
  const text = textOf(u)
  if (text == null) return false
  return LATIN_INDICES.has(text) || GREEK_INDICES.has(text) || DIGIT_INDICES.has(text)
}

function allIndexTokens(nodes: any[]): boolean {
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
  return meaningful.every((n) => isIndexToken(n))
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
    const exactKey = `${baseText}_${subKeyText(opts.sub, ctx)}`
    entry = reg.exact[exactKey]
    key = exactKey
    if (!entry && allIndexTokens(nodeListOf(opts.sub))) {
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
  const solved = solveCG(need)
  if (typeof solved === "string") {
    throw new Unsupported(`${solved} (term “${t.src}”)`)
  }
  // Geometrized target: consistency is verified (above), but no constants are
  // inserted — the ones present get stripped at emission instead.
  if (ctx.strip) return null
  ctx.mutated = true
  return solved
}

function emitSum(
  terms: TermInfo[],
  ops: string[],
  insertions: ({ a: number; b: number } | null)[],
): string {
  return terms
    .map((t, idx) => {
      const ins = insertions[idx]
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

  const emit = () => emitSum(terms, ops, insertions)

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
        throw new Unsupported(
          "an operator-form derivative (a bare d or ∂) — select the applied form instead",
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

  const isZero =
    pureNumeral &&
    slashIdx < 0 &&
    factors
      .filter((f) => f.kind === "num")
      .every((f) => {
        const value = Number.parseFloat(f.emit())
        return Number.isFinite(value) && value === 0
      })

  return {
    sign,
    factors,
    slashIdx,
    dim: total,
    pureNumeral,
    isZero,
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
  const wholeSrc = () => safeSrc(prefixNode, ctx) + safeSrc(operandNode, ctx)
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
          emit: () => {
            if (!ctx.strip) return src
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
      // genfrac nodes carry no own span — the command comes from the size style.
      const cmd = n.size === "text" ? "\\tfrac" : n.size === "display" ? "\\dfrac" : "\\frac"
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
      const emit = () => `${open}${inner.emit()}${close}`
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
        const innerFactor = analyzeFactor(n.base, ctx)
        return { kind: "sym", dim: innerFactor.dim, emit: () => `${label}{${innerFactor.emit()}}` }
      }
      throw new Unsupported(`the unsupported accent “${label}”`)
    }
    case "overline": {
      const inner = analyzeFactor(n.body, ctx)
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

  // {}^{d} / {}_{\mu\nu} index riders (as in R_{abc}{}^{d} or \Gamma^{\rho}{}_{\mu\nu}).
  if (base == null || (base.type === "ordgroup" && base.body.length === 0)) {
    const supIsIndex = n.sup == null || sup === "index"
    const subIsIndex = n.sub == null || allIndexTokens(nodeListOf(n.sub))
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
        return {
          kind: "sym",
          dim: scaled,
          emit: () => {
            if (!ctx.strip) return wholeTex
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

  // Compound base (group, frac, sqrt, accent) with a numeric power: emission is
  // rebuilt from the analyzed base so inner restorations and delimiters survive.
  if (base != null && typeof sup === "object" && sup != null && n.sub == null) {
    const inner = analyzeFactor(n.base, ctx)
    const supSrc = scriptSrc(n.sup, ctx)
    return {
      kind: "group",
      dim: dimScale(inner.dim, sup.p, sup.q),
      emit: () => `${inner.emit()}^{${supSrc}}`,
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

  // Plain product: constants join the product; negatives wrap it in a fraction.
  const numParts = partsWith(t.factors, gNum, cNum)
  const numerator = joinTex(numParts)
  if (!gDen && !cDen) return numerator
  const den = `${gDen}${cDen}`
  return `\\frac{${numerator}}{${den}}`
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

type RowResult = { sideTexts: string[]; rels: string[]; target: Dim; hadRel: boolean }

function rowTexOf(row: RowResult, withTab: boolean): string {
  let tex = row.sideTexts[0]
  for (let idx = 0; idx < row.rels.length; idx += 1) {
    const tab = withTab && idx === 0 ? "&" : ""
    tex += `${tex.length > 0 ? " " : ""}${tab}${row.rels[idx]} ${row.sideTexts[idx + 1]}`
  }
  return tex
}

function translateRow(nodes: any[], ctx: Ctx, carriedTarget: Dim | null): RowResult {
  const grouped = groupDelims(nodes)

  const sides: any[][] = []
  const rels: string[] = []
  let current: any[] = []
  for (const n of grouped) {
    if (n?.type === "atom" && n.family === "rel") {
      if (!SUPPORTED_RELS.has(n.text)) {
        throw new Unsupported(
          n.text === "\\propto"
            ? "a proportionality — constants are absorbed in ∝, so restoring them is not meaningful"
            : `the unsupported relation “${n.text}”`,
        )
      }
      sides.push(current)
      rels.push(safeSrc(n, ctx) || n.text)
      current = []
      continue
    }
    current.push(n)
  }
  sides.push(current)

  if (rels.length === 0) {
    // No relation: analyze for the legend, but there is nothing to anchor.
    parseSum(grouped, ctx, { anchor: "none" })
    return { sideTexts: [srcOfNodes(nodes, ctx)], rels: [], target: ZERO, hadRel: false }
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

  const resolvedTarget = target
  const sideTexts = sums.map((sum) => {
    if (sum == null) return ""
    const insertions = sum.terms.map((t) => termInsertion(t, resolvedTarget, ctx))
    return emitSum(sum.terms, sum.ops, insertions)
  })

  return { sideTexts, rels, target: resolvedTarget, hadRel: true }
}

export function translateTex(
  rawTex: string,
  katex: { __parse: (tex: string, options?: Record<string, unknown>) => any[] },
  reg: HubRegistry,
  spec: TargetSpec = DEFAULT_TARGET,
): TranslationResult {
  // Display equations routinely end in prose punctuation (“… = 8\pi T_{ab}.”,
  // “\right),”). That punctuation is the sentence's, not the equation's.
  const tex = rawTex.replace(/\s+$/, "").replace(/[.,;]$/, "")
  const ctx: Ctx = {
    input: tex,
    reg,
    legend: new Map(),
    unknown: new Map(),
    mutated: false,
    strip: spec.geometrized,
  }

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

  // For comparing a rebuilt equation against its source: whitespace, braces,
  // alignment tabs, and pure-spacing commands are typographically inert.
  const cmpNorm = (s: string) => s.replace(/\\qquad|\\quad|\\[,;!:]/g, "").replace(/[\s{}&]/g, "")

  // Backstops for the reassembly itself: the rebuilt TeX must parse, and when
  // no constants were inserted it must be the source equation verbatim (up to
  // inert typography). Any divergence declines rather than shipping a mangle.
  const checkRebuilt = (restoredTex: string) => {
    try {
      katex.__parse(restoredTex, { strict: false, trust: false })
    } catch {
      throw new Unsupported(
        "an internal reassembly fault — the rebuilt equation did not parse (nothing was shown rather than something wrong)",
      )
    }
    if (!ctx.mutated && cmpNorm(restoredTex) !== cmpNorm(tex)) {
      throw new Unsupported(
        "an internal reassembly fault — the rebuilt equation diverged from the source (nothing was shown rather than something wrong)",
      )
    }
  }

  return finish(() => {
    let nodes: any[]
    try {
      nodes = katex.__parse(tex, { strict: false, trust: false })
    } catch {
      throw new Unsupported("TeX that KaTeX could not parse")
    }

    const meaningful = nodes.filter((n) => n && !SKIP_TYPES.has(n.type))
    const arrayNode =
      meaningful.length === 1 && meaningful[0].type === "array" ? meaningful[0] : null

    if (arrayNode != null) {
      const rows: any[][] = arrayNode.body.map((row: any[]) =>
        row.flatMap((cell: any) => nodeListOf(cell)),
      )
      let carried: Dim | null = null
      let anyRel = false
      const rowTexts: string[] = []
      for (const row of rows) {
        if (row.length === 0 || row.every((n) => isEmptyOrdgroup(n))) continue
        const res = translateRow(row, ctx, carried)
        if (res.hadRel) {
          carried = res.target
          anyRel = true
        } else if (anyRel) {
          throw new Unsupported("a continuation row without its own relation")
        }
        rowTexts.push(rowTexOf(res, res.hadRel))
      }
      if (!anyRel) return "no-anchor"
      const restored = `\\begin{aligned}\n${rowTexts.join(" \\\\\n")}\n\\end{aligned}`
      checkRebuilt(restored)
      return {
        restoredTex: restored,
        targetUnitTex: unitTexOf(carried ?? ZERO, spec),
        changed: ctx.mutated,
      }
    }

    const res = translateRow(nodes, ctx, null)
    if (!res.hadRel) return "no-anchor"
    const restored = rowTexOf(res, false)
    checkRebuilt(restored)
    return {
      restoredTex: restored,
      targetUnitTex: unitTexOf(res.target, spec),
      changed: ctx.mutated,
    }
  })
}
