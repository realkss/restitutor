// Convention detection (census §6, product-design §6): document-level first,
// every conclusion carrying its evidence, and the output is a SET of
// candidates — never a single guess (census §6.2). Detection here is
// FILTERING of the convention registry by what the document actually shows.
//
// Evidence channels, in the order they run:
//   1. DECLARATION CHAINS — "G = c = 1", "ħ = c = k_B = 1", "8πG = c = 1":
//      an equation setting constants to one, in prose OR typeset as math.
//      Each term is read with its numeric prefix (8πG ≠ G — census §6.1/§6.2)
//      and the registry decides which rows generate exactly that; k_B is a
//      composable MODIFIER axis (census §2 verdict 6) and only excludes rows
//      that fix temperature some other way.
//   2. NAMED SYSTEMS — "geometrized units", "Gaussian units", … — count only
//      inside a DECLARATIVE frame ("we use", "throughout", "are adopted");
//      the same phrase in a conversion remark, a comparison, or a reference
//      title is a MENTION: recorded, never narrowing. "Natural units" is
//      polysemous and classifies nothing on its own (census §6.4).
//   3. The §6.1 EINSTEIN-PREFACTOR LADDER — the census's highest-value
//      single token: which prefactor sits between G_μν and T_μν.
//   4. VISIBLE CONSTANTS in the body — a BODY-level statistic, never a
//      one-shot veto: authors restore ħ or c in final numeric formulas
//      (census §6.4, first bullet), so a lone appearance is "isolated"
//      evidence and excludes nothing. ε₀/μ₀ are homographs (a Debye
//      permittivity, a chemical potential) and count only in an
//      electromagnetic coupling context; bare c/G/e never act.
//
// ABSENCE of a constant is never evidence, except where an equation FORM
// demands it (that is what the ladder is). No evidence → every candidate
// survives, and saying so IS the honest answer. Cluster-B honesty (§6.2)
// falls out for free: a vacuum-only GR page yields nothing that separates
// the G-normalization family, so those keys stay together in one set.
import { CONST_DIM, CONVENTIONS, DimQ, Frac, solveRestoration } from "./convention"
import { EM_FLAVOR, EmFlavor } from "./rendering"

export type Strength = "strong" | "isolated" | "weak-homograph"

export type Evidence =
  | {
      kind: "declaration"
      label: string
      /** The label as TeX where it is a formula (chains); absent for prose labels. */
      labelTex?: string
      /** The matched text with a little surrounding context. */
      excerpt: string
      implies: string[]
      /** "chain": an X = Y = 1 equation; "named": a system name in a declarative frame. */
      form: "chain" | "named"
    }
  | {
      /** A system name outside a declarative frame, or a polysemous one. Never narrows. */
      kind: "mention"
      label: string
      excerpt: string
      note: string
    }
  | {
      kind: "fingerprint"
      label: string
      /** The canonical form of the rung, as TeX, for display. */
      tex: string
      /** What the form implies, in words. */
      meaning: string
      /** The page equation that matched. */
      equation: string
      implies: string[]
    }
  | {
      kind: "visible-constant"
      constant: string
      /** The constant as TeX, for display. */
      constantTex: string
      strength: Strength
      /** Empty unless strong — recorded, never acted on otherwise. */
      excludes: string[]
      /** How many of the body equations show it, out of how many. */
      count: number
      of: number
    }

export type DetectionReport = {
  /**
   * narrowed: evidence constrained the candidates. insufficient: nothing
   * constraining was found (mentions and weak evidence may still be listed).
   * conflict: the evidence excludes every candidate — which is itself a
   * finding about the document, and the evidence says which items disagree.
   */
  kind: "narrowed" | "insufficient" | "conflict"
  /** Candidate sets the evidence cannot separate further (v1: one span, one set). */
  sets: string[][]
  evidence: Evidence[]
}

const ALL_KEYS = Object.keys(CONVENTIONS)

// ---------------------------------------------------------------------------
// Absorption predicates over the registry.
// ---------------------------------------------------------------------------

/**
 * Does this convention generate the constant — under ANY normalization?
 * For VISIBILITY evidence: a paper working in 8πG = 1 prints neither G nor
 * 8πG, so any absorbed normalization of the constant counts.
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

const normFactor = (f: string) => f.replace(/[\s{}]/g, "")

/**
 * The STRICT reading a declaration demands: "8πG = 1" means a generator that
 * is G with numeric factor 8π — not G, not 16πG.
 */
export function absorbsWithFactor(convKey: string, tex: string, dim: DimQ, factor: string): boolean {
  const s = solveRestoration(CONVENTIONS[convKey], dim)
  return (
    s.kind === "unique" &&
    s.exponents.length === 1 &&
    s.exponents[0].power.eq(Frac.of(1)) &&
    s.exponents[0].generator.tex === tex &&
    normFactor(s.exponents[0].generator.numericFactor) === normFactor(factor)
  )
}

export const absorbsExactly = (convKey: string, tex: string, dim: DimQ): boolean =>
  absorbsWithFactor(convKey, tex, dim, "1")

/** Temperature is a composable modifier axis: k_B = 1 is compatible with any row that does not reach Θ another way. */
function compatibleWithKb(convKey: string): boolean {
  if (absorbsExactly(convKey, "k_B", CONST_DIM.kB)) return true
  return solveRestoration(CONVENTIONS[convKey], CONST_DIM.kB).kind === "inconsistent"
}

const absorbing = (...consts: [string, DimQ][]) =>
  ALL_KEYS.filter((k) => consts.every(([tex, dim]) => absorbsExactly(k, tex, dim)))

/**
 * Rows compatible with a declared E&M flavor: those whose flavor is
 * DETERMINED and matches, plus every row whose flavor is undetermined or
 * absent — the registry is not closed under mechanical ⊗ E&M composition,
 * so a mechanical row must not be deleted by an E&M sentence.
 */
const flavored = (...flavors: EmFlavor[]) =>
  ALL_KEYS.filter((k) => {
    const f = EM_FLAVOR[k]
    return !f || f.some((x) => flavors.includes(x))
  })

// ---------------------------------------------------------------------------
// Normalization: rendered page text and TeX both fold to one ASCII-ish form
// so a single set of patterns serves prose, innerText, and alttext.
// ---------------------------------------------------------------------------

// Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF): 13 Latin styles of 52
// letters, Greek styles of 58, then digits. innerText of MathML carries these
// (Chrome's math-auto transform), so "𝐺 = 𝑐 = 1" must read as "G = c = 1".
function foldMathAlphanumeric(s: string): string {
  return s.replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
    const cp = ch.codePointAt(0)!
    if (cp <= 0x1d6a3) {
      const i = (cp - 0x1d400) % 52
      return String.fromCharCode(i < 26 ? 65 + i : 97 + (i - 26))
    }
    if (cp >= 0x1d7ce) return String((cp - 0x1d7ce) % 10)
    if (cp >= 0x1d6a8 && cp <= 0x1d7cb) {
      const i = (cp - 0x1d6a8) % 58
      const lower = "αβγδεζηθικλμνξοπρςστυφχψω"
      if (i >= 31 && i - 31 < lower.length) return lower[i - 31]
    }
    return ch
  })
}

const GREEK_WORDS: [RegExp, string][] = [
  [/[ℏħ]/g, "hbar"], // ℏ ħ
  [/ℎ/g, "h"], // ℎ
  [/π/g, "pi"],
  [/α/g, "alpha"],
  [/[εϵ]/g, "epsilon"],
  [/[μµ]/g, "mu"],
  [/κ/g, "kappa"],
  [/′/g, "'"],
  [/[⁡-⁤​]/g, ""], // invisible operators, ZWSP
]

/**
 * Rendered or plain prose → the matching form. Prose can carry TeX too
 * (LaTeXML annotations reach textContent), so the TeX folds run as well.
 */
export function normalizeProse(text: string): string {
  let t = text
  for (const [re, w] of TEX_WORDS) t = t.replace(re, w)
  t = foldMathAlphanumeric(t)
  for (const [re, w] of GREEK_WORDS) t = t.replace(re, w)
  return t.replace(/\s+/g, " ")
}

// A decorated subscript in every shape TeX writes it — _0, _{0}, _{\rm 0},
// _{\rm{0}}, _\mathrm{0}, _{\text{0}} — matched STRUCTURALLY so no brace
// belonging to an enclosing group is consumed.
const DEC = `\\\\(?:rm|mathrm|text|textrm|mathsf|it)`
const SUB = (x: string) =>
  `\\s*_\\s*(?:\\{\\s*${DEC}\\s*\\{\\s*${x}\\s*\\}\\s*\\}|\\{\\s*${DEC}\\s*${x}\\s*\\}|${DEC}\\s*\\{\\s*${x}\\s*\\}|\\{\\s*${x}\\s*\\}|${x}(?![A-Za-z0-9]))`

// Folded words are space-padded so neighbours keep their word boundaries
// ("\mu_0 H" must read "mu0 H", not "mu0H"); whitespace collapses afterwards.
const TEX_WORDS: [RegExp, string][] = [
  // Decorated-subscript constants fold FIRST: the unit/text-group stripper
  // below would otherwise eat the \mathrm{B} in k_\mathrm{B}.
  [/\\(?:hbar|hslash)\b/g, " hbar "],
  [new RegExp(`\\\\(?:var)?epsilon${SUB("0")}`, "g"), " epsilon0 "],
  [new RegExp(`\\\\mu${SUB("0")}`, "g"), " mu0 "],
  [new RegExp(`\\bk${SUB("B")}`, "g"), " kB "],
  [new RegExp(`\\bm${SUB("e")}`, "g"), " me "],
  [/\\(?:mathrm|text|textrm|operatorname|mathsf)\s*\{[^{}]*\}/g, " "], // unit/text groups are not math
  [/\\alpha\s*(?:'|\^\{?\\prime\}?)/g, " alpha' "],
  [/\\pi\b/g, " pi "],
  [/\\kappa\b/g, " kappa "],
  [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)"],
  [/\\(?:left|right|big|Big|bigg|Bigg)\b/g, ""],
  [/\\(?:[,;:!> ]|quad|qquad|thinspace)/g, " "],
  [/\\displaystyle|\\textstyle/g, ""],
]

/** TeX → the matching form (the same folds; kept as a named entry point). */
export const normalizeTexForDetection = (tex: string): string => normalizeProse(tex)

// ---------------------------------------------------------------------------
// Channel 1: declaration chains  X = Y = … = 1
// ---------------------------------------------------------------------------
export type ChainTerm = { name: string; coef: string }

const CONST_NAMES: Record<string, { tex: string; dim: DimQ; modifier?: boolean }> = {
  hbar: { tex: "\\hbar", dim: CONST_DIM.hbar },
  c: { tex: "c", dim: CONST_DIM.c },
  G: { tex: "G", dim: CONST_DIM.G },
  kB: { tex: "k_B", dim: CONST_DIM.kB, modifier: true },
  e: { tex: "e", dim: CONST_DIM.e },
  me: { tex: "m_e", dim: CONST_DIM.me },
  epsilon0: { tex: "\\varepsilon_0", dim: CONST_DIM.eps0 },
  mu0: { tex: "\\mu_0", dim: CONST_DIM.mu0 },
}
const TERM = String.raw`(?:(\d+)\s*pi\s*)?(hbar|kB|me|epsilon0|mu0|c|G|e)`
// The right boundary rejects a NUMBER continuing (1.38, 10, 1,5, 1 × 10⁻²³),
// not a sentence's own period after "= 1."
const CHAIN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_\\])(${TERM}(?:\s*=\s*${TERM})*)\s*=\s*1(?!\d|[.,]\d|\s*[×x]\s*10)`,
  "g",
)
const TERM_RE = new RegExp(TERM, "g")

function parseTerms(chain: string): ChainTerm[] {
  const out: ChainTerm[] = []
  for (const m of chain.matchAll(TERM_RE)) out.push({ name: m[2], coef: m[1] ?? "" })
  return out
}

function termImplies(t: ChainTerm): string[] {
  const c = CONST_NAMES[t.name]
  if (c.modifier) return ALL_KEYS.filter(compatibleWithKb)
  const factor = t.coef ? `${t.coef}\\pi` : "1"
  return ALL_KEYS.filter((k) => absorbsWithFactor(k, c.tex, c.dim, factor))
}

export function findDeclarationChains(
  normalized: string,
): { text: string; terms: ChainTerm[]; index: number }[] {
  const out: { text: string; terms: ChainTerm[]; index: number }[] = []
  for (const m of normalized.matchAll(CHAIN_RE)) {
    out.push({ text: m[0], terms: parseTerms(m[1]), index: m.index ?? 0 })
  }
  return out
}

const PRETTY: Record<string, string> = { hbar: "ħ", kB: "k_B", me: "m_e", epsilon0: "ε₀", mu0: "μ₀" }
const chainLabel = (terms: ChainTerm[]) =>
  terms.map((t) => (t.coef ? `${t.coef}π` : "") + (PRETTY[t.name] ?? t.name)).join(" = ") + " = 1"
const chainTex = (terms: ChainTerm[]) =>
  terms.map((t) => (t.coef ? `${t.coef}\\pi ` : "") + CONST_NAMES[t.name].tex).join(" = ") + " = 1"

// ---------------------------------------------------------------------------
// Channel 2: named systems — only inside a declarative frame.
// ---------------------------------------------------------------------------
const FRAME =
  /\b(we|our|this (?:paper|work|letter|article)|throughout|hereafter|in what follows|in the following|are (?:used|adopted|employed|assumed|chosen|in)|is (?:used|adopted|employed|assumed|chosen|in)|will be used|adopt|use|using|employ|work(?:ing)? in|written in|expressed in|measured in|given in)\b/i
const ANTI_FRAME =
  /\b(convert(?:ed|ing|s)?|conversion|to recover|restor\w*|in terms of|quoted in|reported in|compared? (?:to|with)|unlike|whereas|as opposed to|rather than|instead of|for comparison|see also|references?)\b/i

type NamedRule = {
  label: string
  pattern: RegExp
  /** Undefined ⇒ the phrase classifies nothing on its own (census §6.4). */
  implies?: () => string[]
  note?: string
}

const ATOMIC_FAMILY = ["hartree", "hartree-gaussian", "dirac-atomic", "effective-au", "rydberg"]

export const NAMED_RULES: NamedRule[] = [
  {
    label: "geometrized units (G = c = 1)",
    pattern: /geometri[sz]ed\s+units/i,
    implies: () => absorbing(["c", CONST_DIM.c], ["G", CONST_DIM.G]),
  },
  {
    label: "natural units",
    pattern: /natural\s+units/i,
    note: "ambiguous (c = 1 alone; the HEP set; Planck) and fixes nothing by itself",
  },
  {
    label: "effective (excitonic) Rydberg units",
    pattern: /(?:effective|excitonic)\s+Rydberg\s+(?:atomic\s+)?units/i,
    implies: () => ["effective-au"],
  },
  {
    label: "Rydberg units",
    pattern: /(?<!(?:effective|excitonic)\s)Rydberg\s+(?:atomic\s+)?units/i,
    implies: () => ["rydberg"],
  },
  {
    label: "atomic (Hartree) units",
    pattern: /\batomic\s+units|Hartree\s+(?:atomic\s+)?units/i,
    implies: () => ATOMIC_FAMILY,
  },
  {
    label: "Gaussian (CGS) units",
    pattern: /Gaussian\s+units|CGS-?Gaussian|Gaussian-?CGS/i,
    implies: () => flavored("gaussian"),
  },
  {
    label: "cgs units (rendering unstated)",
    pattern: /\bcgs\s+units/i,
    implies: () => flavored("gaussian", "esu", "emu"),
  },
  {
    label: "Heaviside–Lorentz units",
    pattern: /Heaviside\s*[-–]?\s*Lorentz/i,
    implies: () => flavored("heaviside-lorentz"),
  },
  {
    label: "SI (MKSA) units",
    pattern: /\bSI\s+units\b|\bMKSA\b/,
    implies: () => flavored("si"),
  },
  {
    label: "electrostatic (esu) units",
    pattern: /electrostatic\s+units|\besu\s+units|\bin\s+esu\b/i,
    implies: () => flavored("esu"),
  },
  {
    label: "electromagnetic (emu) units",
    pattern: /electromagnetic\s+units|\bemu\s+units|\bin\s+emu\b/i,
    implies: () => flavored("emu"),
  },
  {
    label: "reduced Planck units",
    pattern: /reduced\s+Planck\s+units/i,
    implies: () => ["reduced-planck"],
  },
  {
    label: "Planck units",
    pattern: /(?<!reduced\s)Planck\s+units/i,
    implies: () => ["planck-gaussian", "planck-hl", "reduced-planck"],
  },
  {
    label: "string units",
    pattern: /string\s+units/i,
    implies: () => ["string-alpha-prime", "string-ls-2pi"],
  },
  {
    label: "lattice units",
    pattern: /lattice\s+units/i,
    implies: () => ["lattice", "lattice-model"],
  },
]

function sentenceAround(text: string, index: number): string {
  // The previous sentence's ". " boundary belongs to IT: start after it.
  const prev = Math.max(text.lastIndexOf(". ", index), text.lastIndexOf("; ", index))
  const start = prev < 0 ? 0 : prev + 2
  const ends = [text.indexOf(". ", index), text.indexOf("; ", index)].filter((i) => i >= 0)
  const end = ends.length ? Math.min(...ends) + 1 : text.length
  return text.slice(start, end).trim()
}

// ---------------------------------------------------------------------------
// Channel 3: the §6.1 Einstein-prefactor ladder.
// ---------------------------------------------------------------------------
const EINSTEIN_RE = /\bG_\{?([a-zA-Z\\]+)\}?\s*(?:\+[^=]*?)?=\s*([^=]*?)\bT_\{?\1\}?/

type Rung = { label: string; tex: string; meaning: string; implies?: string[]; note?: string }

function ladderRung(prefix: string): Rung | null {
  const p = prefix.replace(/\s+/g, " ").trim()
  const hasG = /\bG\b/.test(p)
  const hasC = /\bc\b|c\^/.test(p)
  const hasPi = /\bpi\b/.test(p)
  const coef = p.match(/(\d+)\s*pi/)?.[1] ?? (hasPi ? "8" : "")
  if (/kappa/.test(p))
    return {
      label: "G_μν = κ T_μν — κ symbolic, bind per paper",
      tex: "G_{\\mu\\nu} = \\kappa\\, T_{\\mu\\nu}",
      meaning: "κ symbolic; the units of T₀₀ fix it",
      note: "κ has three literature expansions of different dimension (census §6.1)",
    }
  if (hasG && hasC) return null // constants explicit: the visible-constant channel speaks
  if (hasG && hasPi)
    return {
      label: `G_μν = ${coef}πG T_μν — c = 1`,
      tex: `G_{\\mu\\nu} = ${coef}\\pi G\\, T_{\\mu\\nu}`,
      meaning: "G without c, hence c = 1",
      implies: absorbing(["c", CONST_DIM.c]),
    }
  if (!hasG && hasPi)
    return {
      label: `G_μν = ${coef}π T_μν — Cluster A (G = c = 1 family)`,
      tex: `G_{\\mu\\nu} = ${coef}\\pi\\, T_{\\mu\\nu}`,
      meaning: `${coef}π and no G, hence G = c = 1 (Cluster A)`,
      implies: absorbing(["c", CONST_DIM.c], ["G", CONST_DIM.G]),
    }
  if (p === "")
    return {
      label: "G_μν = T_μν — 8πG = c = 1",
      tex: "G_{\\mu\\nu} = T_{\\mu\\nu}",
      meaning: "no prefactor, hence 8πG = c = 1",
      implies: ALL_KEYS.filter(
        (k) => absorbsWithFactor(k, "G", CONST_DIM.G, "8\\pi") && absorbsExactly(k, "c", CONST_DIM.c),
      ),
    }
  return null
}

// ---------------------------------------------------------------------------
// Channel 4: visible constants (body-level).
// ---------------------------------------------------------------------------
type ConstantToken = {
  constant: string
  tex: string
  dim: DimQ
  /** Matches the constant at all. */
  pattern: RegExp
  /** If present, a match is strong only when this ALSO matches (coupling context). */
  context?: RegExp
  weak?: true
  /** A constant visible in these determined E&M flavors is impossible — exclude them too. */
  excludesFlavors?: EmFlavor[]
}

export const CONSTANT_TOKENS: ConstantToken[] = [
  { constant: "ħ", tex: "\\hbar", dim: CONST_DIM.hbar, pattern: /\bhbar\b/ },
  { constant: "k_B", tex: "k_B", dim: CONST_DIM.kB, pattern: /\bkB\b/ },
  {
    constant: "ε₀",
    tex: "\\varepsilon_0",
    dim: CONST_DIM.eps0,
    pattern: /\bepsilon0\b/,
    context:
      /4\s*pi\s*epsilon0|epsilon0\s*mu0|mu0\s*epsilon0|\/\s*\(?\s*4\s*pi\s*epsilon0|epsilon0\s*\\?nabla|epsilon0\s*E\b|\bq\b[^=]*epsilon0|epsilon0[^=]*\bq\b/,
    excludesFlavors: ["gaussian", "esu", "emu", "heaviside-lorentz"],
  },
  {
    constant: "μ₀",
    tex: "\\mu_0",
    dim: CONST_DIM.mu0,
    pattern: /\bmu0\b/,
    context:
      /mu0\s*\/\s*\(?\s*4\s*pi|mu0\s*(?:H|J|I|M|n)\b|epsilon0\s*mu0|mu0\s*epsilon0|\bB\b[^=]*mu0|mu0[^=]*\bB\b|\\?nabla[^=]*mu0/,
    excludesFlavors: ["gaussian", "esu", "emu", "heaviside-lorentz"],
  },
  {
    // Unmistakably Newton's constant: a coefficient·πG, the GM idiom, or G
    // over a power of c. A bare G is the weak token below.
    constant: "G (Newton)",
    tex: "G",
    dim: CONST_DIM.G,
    pattern: /\d*\s*pi\s*G\b|\bG\s*M\b|\bG\b[^=/]{0,10}\)?\s*\/\s*\(?\s*c\s*(?:\^|\)|\b)/,
  },
  { constant: "G (bare)", tex: "G", dim: CONST_DIM.G, pattern: /(?<![A-Za-z_])G(?![A-Za-z_])/, weak: true },
  { constant: "c (bare)", tex: "c", dim: CONST_DIM.c, pattern: /c\^|(?<![A-Za-z_])c(?![A-Za-z_])/, weak: true },
  { constant: "e (bare)", tex: "e", dim: CONST_DIM.e, pattern: /(?<![A-Za-z_])e(?![A-Za-z_])/, weak: true },
]

/** Body-level: at least two equations and at least 5% of them. */
export function prevalent(count: number, of: number): boolean {
  return count >= 2 && count * 20 >= of
}

// ---------------------------------------------------------------------------
// The report.
// ---------------------------------------------------------------------------
export type DetectionInput = {
  /** Prose to scan for declarations (page text, abstract, …). */
  text?: string
  /** Equations (TeX) to scan for declarations, fingerprints, and visible constants. */
  equations?: string[]
}

export function inferConventions(
  input: DetectionInput,
  opts: { candidates?: string[] } = {},
): DetectionReport {
  const start = [...(opts.candidates ?? ALL_KEYS)]
  let survivors = new Set(start)
  const evidence: Evidence[] = []
  let constrained = false
  const intersect = (keys: string[]) => {
    survivors = new Set([...survivors].filter((k) => keys.includes(k)))
    constrained = true
  }

  const prose = normalizeProse(input.text ?? "")
  const equations = (input.equations ?? []).map(normalizeTexForDetection)

  // 1. Declaration chains — in prose and in typeset math alike. A chain
  //    equation is a declaration, not a body equation: it leaves the
  //    visible-constant pool.
  const bodyEquations: string[] = []
  const chains: { excerpt: string; terms: ChainTerm[] }[] = []
  for (const ch of findDeclarationChains(prose)) {
    chains.push({
      excerpt: prose.slice(Math.max(0, ch.index - 40), ch.index + ch.text.length + 40),
      terms: ch.terms,
    })
  }
  for (const eq of equations) {
    const found = findDeclarationChains(eq)
    if (found.length) for (const ch of found) chains.push({ excerpt: eq, terms: ch.terms })
    else bodyEquations.push(eq)
  }
  const seenChains = new Set<string>()
  for (const ch of chains) {
    const label = chainLabel(ch.terms)
    if (seenChains.has(label)) continue
    seenChains.add(label)
    let implies = [...ALL_KEYS]
    for (const t of ch.terms) {
      const ti = termImplies(t)
      implies = implies.filter((k) => ti.includes(k))
    }
    evidence.push({
      kind: "declaration",
      form: "chain",
      label,
      labelTex: chainTex(ch.terms),
      excerpt: ch.excerpt.trim(),
      implies,
    })
    intersect(implies)
  }

  // 2. Named systems, framed or merely mentioned.
  for (const rule of NAMED_RULES) {
    const m = rule.pattern.exec(prose)
    if (!m) continue
    const sentence = sentenceAround(prose, m.index)
    if (!rule.implies) {
      evidence.push({ kind: "mention", label: rule.label, excerpt: sentence.slice(0, 200), note: rule.note ?? "" })
      continue
    }
    if (!(FRAME.test(sentence) && !ANTI_FRAME.test(sentence))) {
      evidence.push({
        kind: "mention",
        label: rule.label,
        excerpt: sentence.slice(0, 200),
        note: "mentioned, not declared",
      })
      continue
    }
    const implies = rule.implies()
    evidence.push({ kind: "declaration", form: "named", label: rule.label, excerpt: sentence.slice(0, 200), implies })
    intersect(implies)
  }

  // 3. The ladder.
  const seenRungs = new Set<string>()
  for (const eq of bodyEquations) {
    const m = EINSTEIN_RE.exec(eq)
    if (!m) continue
    const rung = ladderRung(m[2])
    if (!rung || seenRungs.has(rung.label)) continue
    seenRungs.add(rung.label)
    if (rung.implies) {
      evidence.push({
        kind: "fingerprint",
        label: rung.label,
        tex: rung.tex,
        meaning: rung.meaning,
        equation: eq.trim().slice(0, 120),
        implies: rung.implies,
      })
      intersect(rung.implies)
    } else {
      evidence.push({ kind: "mention", label: rung.label, excerpt: eq.trim().slice(0, 120), note: rung.note ?? "" })
    }
  }

  // 4. Visible constants, body-level.
  const of = bodyEquations.length
  for (const token of CONSTANT_TOKENS) {
    const hits = bodyEquations.filter((eq) => token.pattern.test(eq))
    if (hits.length === 0) continue
    const push = (strength: Strength, count: number, excludes: string[]) =>
      evidence.push({
        kind: "visible-constant",
        constant: token.constant,
        constantTex: token.tex,
        strength,
        excludes,
        count,
        of,
      })
    if (token.weak) {
      push("weak-homograph", hits.length, [])
      continue
    }
    const inContext = token.context ? hits.filter((eq) => token.context!.test(eq)) : hits
    if (inContext.length === 0) {
      push("weak-homograph", hits.length, [])
      continue
    }
    if (!prevalent(inContext.length, of)) {
      push("isolated", inContext.length, [])
      continue
    }
    const excludes = [...survivors].filter(
      (k) =>
        generatesConstant(k, token.tex, token.dim) ||
        (token.excludesFlavors ?? []).some((f) => (EM_FLAVOR[k] ?? []).includes(f)),
    )
    push("strong", inContext.length, excludes)
    for (const k of excludes) survivors.delete(k)
    constrained = true
  }

  if (!constrained) return { kind: "insufficient", sets: [[...start].sort()], evidence }
  if (survivors.size === 0) return { kind: "conflict", sets: [], evidence }
  return { kind: "narrowed", sets: [[...survivors].sort()], evidence }
}
