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
import { CODE_RULES, CodeRule, FINGERPRINT_RULES, FingerprintRule } from "./tables.generated"

export type Strength = "strong" | "isolated" | "weak-homograph"

export type Evidence =
  | {
      kind: "declaration"
      label: string
      /** The label as TeX where it is a formula (chains); absent for prose labels. */
      labelTex?: string
      /** For an E&M-flavor declaration: the flavors it names. Two disjoint ones make a hybrid. */
      flavors?: EmFlavor[]
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
      /** The label as TeX where it is a formula (a chain, a matched form). */
      labelTex?: string
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
      /** For an E&M form: the flavors it asserts. Two disjoint ones make a hybrid. */
      flavors?: EmFlavor[]
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
  | {
      /**
       * A chain stated in the text whose constant the body equations keep
       * printing at body level: an encyclopedia rewriting one form "in units
       * where G = c = 1", or a paper contradicting its own declaration. The
       * equations as printed govern (census §6.4); the chain does not narrow.
       */
      kind: "contradicted"
      label: string
      labelTex: string
      excerpt: string
      constant: string
      constantTex: string
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
export function foldMathAlphanumeric(s: string): string {
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
  t = foldFractions(t)
  t = foldMathAlphanumeric(t)
  for (const [re, w] of GREEK_WORDS) t = t.replace(re, w)
  return t.replace(/\s+/g, " ")
}

// One brace-balanced argument (or a single token: \tfrac12, \frac\pi2).
function braceArg(s: string, i: number): { text: string; end: number } | null {
  while (i < s.length && s[i] === " ") i++
  if (s[i] === "{") {
    let depth = 0
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++
      else if (s[j] === "}" && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 }
    }
    return null
  }
  const m = /^(?:\\[a-zA-Z]+|[^\s{}\\])/.exec(s.slice(i))
  return m ? { text: m[0], end: i + m[0].length } : null
}

const FRAC_RE = /\\[dtc]?frac(?![a-zA-Z])/g
const OVER_RE = /\\over(?![a-zA-Z])/

/**
 * \frac{a}{b} (\dfrac, \tfrac, \cfrac) with BRACE-BALANCED arguments, innermost
 * first, to a fixpoint; {a \over b}; and a brace wrapper whose only content
 * is a folded fraction. Wikipedia's alttext writes every fraction as
 * {\frac {c^{4}}{16\pi G}} — a brace-free fold never fired on it (review v2).
 */
export function foldFractions(input: string): string {
  let s = input
  for (let guard = 0; guard < 200; guard++) {
    let changed = false
    for (const m of s.matchAll(FRAC_RE)) {
      const a = braceArg(s, m.index! + m[0].length)
      if (!a) continue
      const b = braceArg(s, a.end)
      if (!b) continue
      if (/\\[dtc]?frac(?![a-zA-Z])/.test(a.text + b.text)) continue
      s = s.slice(0, m.index) + "(" + a.text.trim() + ")/(" + b.text.trim() + ")" + s.slice(b.end)
      changed = true
      break
    }
    if (!changed) break
  }
  for (let guard = 0; guard < 50; guard++) {
    const k = s.search(OVER_RE)
    if (k < 0) break
    let start = -1
    for (let j = k - 1, depth = 0; j >= 0; j--) {
      if (s[j] === "}") depth++
      else if (s[j] === "{") {
        if (depth === 0) {
          start = j
          break
        }
        depth--
      }
    }
    let end = -1
    for (let j = k + 5, depth = 0; j < s.length; j++) {
      if (s[j] === "{") depth++
      else if (s[j] === "}") {
        if (depth === 0) {
          end = j
          break
        }
        depth--
      }
    }
    if (start < 0 || end < 0) {
      s = s.slice(0, k) + " / " + s.slice(k + 5)
      continue
    }
    s = s.slice(0, start) + "(" + s.slice(start + 1, k).trim() + ")/(" + s.slice(k + 5, end).trim() + ")" + s.slice(end + 1)
  }
  return s.replace(/\{\s*(\((?:[^()]|\([^()]*\))*\)\s*\/\s*\((?:[^()]|\([^()]*\))*\))\s*\}/g, "$1")
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
// The right boundary rejects a NUMBER continuing (1.38, 10, 1,5, 1 × 10⁻²³)
// and a FRACTION (ε₀ = 1/4π, G = 1/m_P²), not a sentence's own period.
const CHAIN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_\\])(${TERM}(?:\s*=\s*${TERM})*)\s*=\s*1(?!\d|[.,]\d|\s*[×x]\s*10|\s*/|\s*\\over\b|\s*\^)`,
  "g",
)

// A chain stated hypothetically, negated, or as one of several alternatives
// is not the document's declaration (census §6.4: classify from the body).
const CHAIN_ANTI_FRAME =
  /\b(if|would|were|unless|not fixed by|does not fix|do not fix|orthogonal to|also sets?|(?:third|another|other|second) variant|variant sets|instead|alternatively|rather than|unlike|whereas|as opposed to|compared|in contrast|a different row|note that|one (?:may|can|could|might)|is not (?:unity|set)|not unity|only if|provided that|corresponds to|would (?:be|read|give)|(?:can|may|could|might) (?:also |then |equivalently )?be (?:re)?(?:written|expressed|cast|stated|put))\b/i
const TERM_RE = new RegExp(TERM, "g")

function parseTerms(chain: string): ChainTerm[] {
  const out: ChainTerm[] = []
  for (const m of chain.matchAll(TERM_RE)) out.push({ name: m[2], coef: m[1] ?? "" })
  return out
}

/**
 * A declaration names a GENERATOR by its symbol ("e = 1"), whatever basis
 * the row gives that symbol — hartree-gaussian's e carries the Gaussian
 * half-integer charge dimension, and "ħ = m_e = e = 1" must keep it. So a
 * chain term matches generators by tex and numeric factor directly; the
 * dimension-based predicates serve visibility and the ladder.
 */
function declaresGenerator(convKey: string, tex: string, factor: string): boolean {
  return CONVENTIONS[convKey].generators.some(
    (g) => g.tex === tex && g.role !== "inserted" && normFactor(g.numericFactor) === normFactor(factor),
  )
}

function termImplies(t: ChainTerm): string[] {
  const c = CONST_NAMES[t.name]
  if (c.modifier) return ALL_KEYS.filter(compatibleWithKb)
  const factor = t.coef ? `${t.coef}\\pi` : "1"
  return ALL_KEYS.filter((k) => declaresGenerator(k, c.tex, factor))
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
// A conversion remark, a comparison, a contrast, or a citation: the name is
// mentioned, not adopted. "references?" alone matched "reference energies"
// (the code-identity draft, 2026-09-02), so citations are keyed on their
// own tokens.
const ANTI_FRAME =
  /\b(convert(?:ed|ing|s)?|conversion|to recover|restor\w*|in terms of|quoted in|reported in|compared? (?:to|with)|unlike|whereas|as opposed to|rather than|instead of|for comparison|in contrast|by contrast|contrary to|see also|references?\s*(?:\[|\d|therein)|refs?\.\s*(?:\[|\d)|cited (?:as|in)|manual|documentation|available from|distributed by|developed (?:at|by))\b/i

// Census §6.5b: the program a paper ran, as evidence of its native units.
const CODES = CODE_RULES.map((r) => ({
  rule: r,
  re: new RegExp(r.pattern, "g"),
  cue: r.cue ? new RegExp(r.cue, "i") : null,
}))
const codeUnits = (r: CodeRule) => r.nativeUnits.split(/[:;—(]/)[0].trim().replace(/\.$/, "")
/** The usage frame for a program: what the calculations were performed with. */
const CODE_USAGE =
  /\b(performed|carried out|computed|calculated|obtained|implemented|run|ran|simulated|solved|evolved|generated|relaxed|optimi[sz]ed|converged)\b/i

type NamedRule = {
  label: string
  pattern: RegExp
  /** Undefined ⇒ the phrase classifies nothing on its own (census §6.4). */
  implies?: () => string[]
  /** Set when the rule names an E&M flavor (so hybrids can be recognized). */
  flavors?: EmFlavor[]
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
    flavors: ["gaussian"],
  },
  {
    label: "cgs units (rendering unstated)",
    pattern: /\bcgs\s+units/i,
    implies: () => flavored("gaussian", "esu", "emu"),
    flavors: ["gaussian", "esu", "emu"],
  },
  {
    label: "Heaviside–Lorentz units",
    pattern: /Heaviside\s*[-–]?\s*Lorentz/i,
    implies: () => flavored("heaviside-lorentz"),
    flavors: ["heaviside-lorentz"],
  },
  {
    label: "SI (MKSA) units",
    pattern: /\bSI\s+units\b|\bMKSA\b/,
    implies: () => flavored("si"),
    flavors: ["si"],
  },
  {
    label: "electrostatic (esu) units",
    pattern: /electrostatic\s+units|\besu\s+units|\bin\s+esu\b/i,
    implies: () => flavored("esu"),
    flavors: ["esu"],
  },
  {
    label: "electromagnetic (emu) units",
    pattern: /electromagnetic\s+units|\bemu\s+units|\bin\s+emu\b/i,
    implies: () => flavored("emu"),
    flavors: ["emu"],
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

type Rung = {
  label: string
  tex: string
  meaning: string
  implies?: string[]
  /** The constants the rung claims absorbed — weighed against the body, as chains are. */
  absorbs?: string[]
  note?: string
}

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
      absorbs: ["c"],
    }
  if (!hasG && hasPi)
    return {
      label: `G_μν = ${coef}π T_μν — Cluster A (G = c = 1 family)`,
      tex: `G_{\\mu\\nu} = ${coef}\\pi\\, T_{\\mu\\nu}`,
      meaning: `${coef}π and no G, hence G = c = 1 (Cluster A)`,
      implies: absorbing(["c", CONST_DIM.c], ["G", CONST_DIM.G]),
      absorbs: ["c", "G"],
    }
  if (p === "")
    return {
      label: "G_μν = T_μν — 8πG = c = 1",
      tex: "G_{\\mu\\nu} = T_{\\mu\\nu}",
      meaning: "no prefactor, hence 8πG = c = 1",
      implies: ALL_KEYS.filter(
        (k) => absorbsWithFactor(k, "G", CONST_DIM.G, "8\\pi") && absorbsExactly(k, "c", CONST_DIM.c),
      ),
      absorbs: ["c", "G"],
    }
  return null
}

// ---------------------------------------------------------------------------
// Channel 3b: equation-form matchers (census §6.3 E&M discriminators, §6.4
// strong natural-units tokens, the §6.1 action-prefactor ladder, and the
// constants-explicit forms that assert SI POSITIVELY — never the residue of
// nothing firing). The table lives in docs/data/fingerprints.json with its
// positives and negatives; each rule's implication is resolved against the
// registry here, so a rule names generators, not rows.
// ---------------------------------------------------------------------------
const FINGERPRINTS = FINGERPRINT_RULES.map((r) => ({ rule: r, re: new RegExp(r.pattern) }))

const DIM_OF_TEX: Record<string, DimQ> = {
  "\\hbar": CONST_DIM.hbar,
  c: CONST_DIM.c,
  G: CONST_DIM.G,
  k_B: CONST_DIM.kB,
  e: CONST_DIM.e,
  m_e: CONST_DIM.me,
  "\\varepsilon_0": CONST_DIM.eps0,
  "\\mu_0": CONST_DIM.mu0,
}

/** The constants a rule claims absorbed (the §6.1 action rungs and the Planck forms); E&M flavor rules claim none. */
export function fingerprintAbsorbs(rule: FingerprintRule): string[] {
  const imp = rule.implies
  if ("absorbing" in imp) return imp.absorbing.map(([tex]) => tex)
  if ("absorbsWithFactor" in imp) return [imp.absorbsWithFactor[0]]
  return []
}

export function fingerprintImplies(rule: FingerprintRule): string[] {
  const imp = rule.implies
  if ("flavored" in imp) return flavored(...(imp.flavored as EmFlavor[]))
  if ("keys" in imp) return imp.keys.filter((k) => k in CONVENTIONS)
  // A form that PRINTS a constant (1/16πG prints G) excludes the rows that absorb it.
  const printsNot = (keys: string[]) =>
    keys.filter((k) => !(imp.prints ?? []).some((tex) => generatesConstant(k, tex, DIM_OF_TEX[tex])))
  if ("absorbing" in imp)
    return printsNot(absorbing(...imp.absorbing.map(([tex]) => [tex, DIM_OF_TEX[tex]] as [string, DimQ])))
  const [tex, factor] = imp.absorbsWithFactor
  return printsNot(ALL_KEYS.filter((k) => absorbsWithFactor(k, tex, DIM_OF_TEX[tex], factor)))
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
    // G_N, G_4, G_D are Newton's constant too: no word boundary after G.
    pattern: /\d*\s*pi\s*G(?![A-Za-z])|\bG(?:_\{?[A-Za-z0-9]{1,2}\}?)?\s*M(?![A-Za-z])|\bG(?![A-Za-z])[^=/]{0,10}\)?\s*\/\s*\(?\s*c\s*(?:\^|\)|\b)/,
  },
  { constant: "G (bare)", tex: "G", dim: CONST_DIM.G, pattern: /(?<![A-Za-z_])G(?![A-Za-z_])/, weak: true },
  { constant: "c (bare)", tex: "c", dim: CONST_DIM.c, pattern: /c\^|(?<![A-Za-z_])c(?![A-Za-z_])/, weak: true },
  { constant: "e (bare)", tex: "e", dim: CONST_DIM.e, pattern: /(?<![A-Za-z_])e(?![A-Za-z_])/, weak: true },
]

/**
 * Body-level: at least two equations and at least 5% of them — or eight
 * outright, so that a lecture-notes page of thousands of equations still
 * counts a constant it writes throughout (a restoration in a final formula
 * is one or two appearances, never eight).
 */
export function prevalent(count: number, of: number): boolean {
  return count >= 2 && (count * 20 >= of || count >= 8)
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

/** A constant the body prints at body level — the finding a chain or form is weighed against. */
export type PrintedConstant = { constant: string; constantTex: string; count: number; of: number }

export type DetectionOptions = {
  candidates?: string[]
  /**
   * Constants printed strongly at DOCUMENT level, for a span-scoped run: a
   * section that writes G three times among forty equations still belongs
   * to a document that writes it throughout.
   */
  printed?: PrintedConstant[]
}

const globalOf = (re: RegExp) => new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")

export function inferConventions(input: DetectionInput, opts: DetectionOptions = {}): DetectionReport {
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
  type Chain = {
    excerpt: string
    sentence: string
    src: string
    at: number
    /** Index of the equation the chain was typeset in, if any. */
    eq?: number
    terms: ChainTerm[]
    implies: string[]
  }
  const chains: Chain[] = []
  const chainImplies = (terms: ChainTerm[]) => {
    let implies = [...ALL_KEYS]
    for (const t of terms) {
      const ti = termImplies(t)
      implies = implies.filter((k) => ti.includes(k))
    }
    return implies
  }
  for (const ch of findDeclarationChains(prose)) {
    chains.push({
      excerpt: prose.slice(Math.max(0, ch.index - 40), ch.index + ch.text.length + 40),
      sentence: sentenceAround(prose, ch.index),
      src: prose,
      at: ch.index,
      terms: ch.terms,
      implies: chainImplies(ch.terms),
    })
  }
  equations.forEach((eq, i) => {
    const found = findDeclarationChains(eq)
    if (found.length) {
      for (const ch of found)
        chains.push({
          excerpt: eq,
          sentence: sentenceAround(eq, ch.index),
          src: eq,
          at: ch.index,
          eq: i,
          terms: ch.terms,
          implies: chainImplies(ch.terms),
        })
    } else bodyEquations.push(eq)
  })
  // Two mutually exclusive chains close together — in the same prose, or in
  // adjacent display equations — are alternatives being discussed
  // ("Gaussian-Planck (4πε₀ = 1): … . Heaviside-Planck (ε₀ = 1): …"), not a
  // declaration of either.
  const near = (a: Chain, b: Chain) =>
    a.src === b.src
      ? Math.abs(a.at - b.at) < 400
      : a.eq !== undefined && b.eq !== undefined && Math.abs(a.eq - b.eq) <= 2
  const alternatives = new Set<Chain>()
  for (const a of chains)
    for (const b of chains)
      if (a !== b && near(a, b) && !a.implies.some((k) => b.implies.includes(k))) {
        alternatives.add(a)
        alternatives.add(b)
      }
  // Body statistics come BEFORE any chain is applied: a stated chain is
  // weighed against what the equations print. A constant a chain sets to one
  // yet the body writes at body level (prevalent, in coupling context) means
  // the chain is a rewrite or a slip, not the document's convention — the
  // equations as printed govern (census §6.4), and the chain is recorded as
  // contradicted instead of narrowing.
  const of = bodyEquations.length
  type Stat = { token: ConstantToken; count: number; strength: Strength }
  const stats: Stat[] = []
  for (const token of CONSTANT_TOKENS) {
    const hits = bodyEquations.filter((eq) => token.pattern.test(eq))
    if (hits.length === 0) continue
    if (token.weak) {
      stats.push({ token, count: hits.length, strength: "weak-homograph" })
      continue
    }
    const inContext = token.context ? hits.filter((eq) => token.context!.test(eq)) : hits
    if (inContext.length === 0) {
      stats.push({ token, count: hits.length, strength: "weak-homograph" })
      continue
    }
    stats.push({ token, count: inContext.length, strength: prevalent(inContext.length, of) ? "strong" : "isolated" })
  }
  const printedStrongly = (tex: string): PrintedConstant | undefined => {
    const s = stats.find((x) => x.strength === "strong" && x.token.tex === tex)
    if (s) return { constant: s.token.constant, constantTex: tex, count: s.count, of }
    return opts.printed?.find((p) => p.constantTex === tex)
  }

  // Every chain instance is classified first; one instance per label is
  // kept — a declaration outranks a contradicted one outranks a mention — so
  // a hedged first occurrence ("one can set G = c = 1") never deletes the
  // adoption that follows it (review v2).
  type Verdict = { rank: number; emit: () => void }
  const best = new Map<string, Verdict>()
  for (const ch of chains) {
    const label = chainLabel(ch.terms)
    const hypothetical = CHAIN_ANTI_FRAME.test(ch.sentence)
    let v: Verdict
    if (hypothetical || alternatives.has(ch)) {
      v = {
        rank: 0,
        emit: () =>
          evidence.push({
            kind: "mention",
            label,
            labelTex: chainTex(ch.terms),
            excerpt: ch.sentence.slice(0, 200),
            note: hypothetical ? "stated hypothetically or in contrast, not adopted" : "one of several alternatives stated",
          }),
      }
    } else {
      // A term the body prints at body level is refuted. A refuted MODIFIER
      // (k_B, whose own implication is nearly vacuous) leaves the rest of the
      // chain standing — a restored k_B never voids an untouched ħ = c = 1;
      // a refuted generator (G printed while "G = c = 1" is stated) refutes
      // the chain as a unit, since the statement was one claim.
      let refuted = ch.terms.filter((t) => printedStrongly(CONST_NAMES[t.name].tex))
      if (refuted.some((t) => !CONST_NAMES[t.name].modifier)) refuted = [refuted.find((t) => !CONST_NAMES[t.name].modifier)!]
      const kept = refuted.some((t) => !CONST_NAMES[t.name].modifier) ? [] : ch.terms.filter((t) => !refuted.includes(t))
      const wholeChain = kept.length === 0 && refuted.length > 0
      v = {
        rank: refuted.length ? 1 : 2,
        emit: () => {
          for (const t of refuted) {
            const p = printedStrongly(CONST_NAMES[t.name].tex)!
            evidence.push({
              kind: "contradicted",
              label: wholeChain ? label : chainLabel([t]),
              labelTex: wholeChain ? chainTex(ch.terms) : chainTex([t]),
              excerpt: ch.excerpt.trim(),
              constant: p.constant,
              constantTex: p.constantTex,
              count: p.count,
              of: p.of,
            })
          }
          if (kept.length) {
            const implies = chainImplies(kept)
            evidence.push({
              kind: "declaration",
              form: "chain",
              label: chainLabel(kept),
              labelTex: chainTex(kept),
              excerpt: ch.excerpt.trim(),
              implies,
            })
            intersect(implies)
          }
        },
      }
    }
    const prior = best.get(label)
    if (!prior || v.rank > prior.rank) best.set(label, v)
  }
  for (const v of best.values()) v.emit()

  // 2. Named systems, framed or merely mentioned. Every occurrence is judged
  //    and the first FRAMED one declares, so an early conversion remark never
  //    hides the adoption that follows it (review v2).
  for (const rule of NAMED_RULES) {
    const sentences = [...prose.matchAll(globalOf(rule.pattern))].map((m) => sentenceAround(prose, m.index ?? 0))
    if (sentences.length === 0) continue
    if (!rule.implies) {
      evidence.push({ kind: "mention", label: rule.label, excerpt: sentences[0].slice(0, 200), note: rule.note ?? "" })
      continue
    }
    const framed = sentences.find((s) => FRAME.test(s) && !ANTI_FRAME.test(s))
    if (!framed) {
      evidence.push({
        kind: "mention",
        label: rule.label,
        excerpt: sentences[0].slice(0, 200),
        note: "mentioned, not declared",
      })
      continue
    }
    const implies = rule.implies()
    evidence.push({
      kind: "declaration",
      form: "named",
      label: rule.label,
      excerpt: framed.slice(0, 200),
      implies,
      ...(rule.flavors ? { flavors: rule.flavors } : {}),
    })
    intersect(implies)
  }
  // 2b. Code identity (census §6.5b): when nothing is declared, the program
  //     a paper ran is the evidence — "computed with Elk" is Hartree units.
  //     A name in a usage frame with its cue declares, where the registry
  //     has the row and the native-unit fact is settled (confidence ≥ 0.8);
  //     a name without the frame, or a code whose units no row absorbs, is a
  //     mention that says what the code computes in; a name in a comparison
  //     or a citation is nothing.
  for (const { rule, re, cue } of CODES) {
    let framed: string | null = null
    let plain: string | null = null
    re.lastIndex = 0
    for (const m of prose.matchAll(re)) {
      const at = m.index ?? 0
      const sentence = sentenceAround(prose, at)
      if (ANTI_FRAME.test(sentence)) continue
      if (rule.cueRequired && cue && !cue.test(prose.slice(Math.max(0, at - 300), at + 300))) continue
      if (FRAME.test(sentence) || CODE_USAGE.test(sentence)) framed ??= sentence
      else plain ??= sentence
    }
    if (!framed && !plain) continue
    const units = codeUnits(rule)
    if (framed && "keys" in rule.implies && rule.confidence >= 0.8) {
      const implies = rule.implies.keys.filter((k) => k in CONVENTIONS)
      evidence.push({
        kind: "declaration",
        form: "named",
        label: `${rule.code} (${units})`,
        excerpt: framed.slice(0, 200),
        implies,
      })
      intersect(implies)
      continue
    }
    const note =
      "keys" in rule.implies
        ? rule.confidence < 0.8
          ? `named; computes in ${units}, a reading not yet verified to the registry's standard`
          : `named; computes in ${units}`
        : `named; computes in ${units}, which no registry row absorbs`
    evidence.push({ kind: "mention", label: rule.code, excerpt: (framed ?? plain)!.slice(0, 200), note })
  }

  // 3. The ladder.
  const seenRungs = new Set<string>()
  for (const eq of bodyEquations) {
    const m = EINSTEIN_RE.exec(eq)
    if (!m) continue
    const rung = ladderRung(m[2])
    if (!rung || seenRungs.has(rung.label)) continue
    seenRungs.add(rung.label)
    const printed = (rung.absorbs ?? []).map(printedStrongly).find((s) => s)
    if (printed) {
      evidence.push({
        kind: "contradicted",
        label: rung.label,
        labelTex: rung.tex,
        excerpt: eq.trim().slice(0, 120),
        constant: printed.constant,
        constantTex: printed.constantTex,
        count: printed.count,
        of: printed.of,
      })
      continue
    }
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

  // 3b. Equation-form matchers, one firing per rule. Two forms with disjoint
  //     implications printed in ONE equation string are alternatives being
  //     compared ("Gaussian-Planck: ∇·E = 4πρ. Heaviside-Planck: ∇·E = ρ."),
  //     not the document's form: recorded as mentions, as with chains.
  //     Two passes, so that equation order never decides the verdict
  //     (review v2): a rule asserted on its own somewhere is evidence; one
  //     that only ever appears beside a disjoint alternative is a mention.
  type Hit = { rule: FingerprintRule; implies: string[]; flavors: EmFlavor[] | null; eq: string }
  const firstHit = new Map<string, Hit>()
  const standalone = new Map<string, Hit>()
  for (const eq of bodyEquations) {
    const hits: Hit[] = FINGERPRINTS.filter(({ re }) => re.test(eq)).map(({ rule }) => ({
      rule,
      implies: fingerprintImplies(rule),
      flavors: "flavored" in rule.implies ? (rule.implies.flavored as EmFlavor[]) : null,
      eq,
    }))
    // Disjoint on rows, or — since mechanical rows survive every E&M form —
    // disjoint on the flavor axis.
    const disjoint = (a: Hit, b: Hit) =>
      !a.implies.some((k) => b.implies.includes(k)) ||
      (!!a.flavors && !!b.flavors && !a.flavors.some((f) => b.flavors!.includes(f)))
    const contested = new Set<string>()
    for (const a of hits)
      for (const b of hits)
        if (a !== b && disjoint(a, b)) {
          contested.add(a.rule.id)
          contested.add(b.rule.id)
        }
    for (const h of hits) {
      if (!firstHit.has(h.rule.id)) firstHit.set(h.rule.id, h)
      if (!contested.has(h.rule.id) && !standalone.has(h.rule.id)) standalone.set(h.rule.id, h)
    }
  }
  for (const [id, first] of firstHit) {
    const h = standalone.get(id)
    if (!h) {
      evidence.push({
        kind: "mention",
        label: first.rule.label,
        labelTex: first.rule.tex,
        excerpt: first.eq.trim().slice(0, 120),
        note: "one of several alternatives stated",
      })
      continue
    }
    // A form claiming a constant absorbed while the body prints that
    // constant at body level (the unnormalized Hilbert action of a
    // lecture-notes page, with 8πG everywhere else) is contradicted.
    const printed = fingerprintAbsorbs(h.rule).map(printedStrongly).find((s) => s)
    if (printed) {
      evidence.push({
        kind: "contradicted",
        label: h.rule.label,
        labelTex: h.rule.tex,
        excerpt: h.eq.trim().slice(0, 120),
        constant: printed.constant,
        constantTex: printed.constantTex,
        count: printed.count,
        of: printed.of,
      })
      continue
    }
    evidence.push({
      kind: "fingerprint",
      label: h.rule.label,
      tex: h.rule.tex,
      meaning: h.rule.meaning,
      equation: h.eq.trim().slice(0, 120),
      implies: h.implies,
      ...(h.flavors ? { flavors: h.flavors } : {}),
    })
    intersect(h.implies)
  }

  // Two E&M assertions naming disjoint flavors — declarations or printed
  // forms — are a hybrid (census §6.2's document_hybrid class, Jackson 3e):
  // mechanical rows survive both intersections, so the contradiction must be
  // recognized on the flavor axis itself.
  const flavorBearing = evidence.filter(
    (e): e is Extract<Evidence, { kind: "declaration" | "fingerprint" }> =>
      (e.kind === "declaration" || e.kind === "fingerprint") && !!e.flavors,
  )
  for (let i = 0; i < flavorBearing.length; i++)
    for (let j = i + 1; j < flavorBearing.length; j++)
      if (!flavorBearing[i].flavors!.some((f) => flavorBearing[j].flavors!.includes(f))) {
        survivors = new Set()
        constrained = true
      }

  // 4. Visible constants, body-level (the statistics gathered above).
  for (const { token, count, strength } of stats) {
    const push = (excludes: string[]) =>
      evidence.push({
        kind: "visible-constant",
        constant: token.constant,
        constantTex: token.tex,
        strength,
        excludes,
        count,
        of,
      })
    if (strength !== "strong") {
      push([])
      continue
    }
    const excludes = [...survivors].filter(
      (k) =>
        generatesConstant(k, token.tex, token.dim) ||
        (token.excludesFlavors ?? []).some((f) => (EM_FLAVOR[k] ?? []).includes(f)),
    )
    push(excludes)
    for (const k of excludes) survivors.delete(k)
    constrained = true
  }

  if (!constrained) return { kind: "insufficient", sets: [[...start].sort()], evidence }
  if (survivors.size === 0) return { kind: "conflict", sets: [], evidence }
  return { kind: "narrowed", sets: [[...survivors].sort()], evidence }
}

// ---------------------------------------------------------------------------
// Span-scoped detection (census §6.2, round-4 amendment): a document can be
// SI in the main text and Gaussian in an inherited appendix. Detect per
// span, then report {span → conventions} plus a MIXED flag whenever two
// narrowed spans are disjoint — never a document-level winner.
// ---------------------------------------------------------------------------
export type Span = { id: string; label?: string; text?: string; equations?: string[] }

export type DocumentReport = {
  /** Detection over everything, as if the document were one span. */
  overall: DetectionReport
  spans: { id: string; label: string; report: DetectionReport }[]
  /** Pairs of spans whose narrowed candidate sets share no convention. */
  mixed: { a: string; b: string }[]
}

export function inferDocument(spans: Span[], opts: DetectionOptions = {}): DocumentReport {
  const overall = inferConventions(
    {
      text: spans.map((s) => s.text ?? "").join("\n"),
      equations: spans.flatMap((s) => s.equations ?? []),
    },
    opts,
  )
  // What the whole document prints at body level weighs on every span: a
  // section's three G's among forty equations are still the document's.
  const printed: PrintedConstant[] = overall.evidence.flatMap((e) =>
    e.kind === "visible-constant" && e.strength === "strong"
      ? [{ constant: e.constant, constantTex: e.constantTex, count: e.count, of: e.of }]
      : [],
  )
  const per = spans.map((s) => ({
    id: s.id,
    label: s.label ?? s.id,
    report: inferConventions(s, { ...opts, printed: [...(opts.printed ?? []), ...printed] }),
  }))
  const mixed: { a: string; b: string }[] = []
  for (let i = 0; i < per.length; i++)
    for (let j = i + 1; j < per.length; j++) {
      const a = per[i].report
      const b = per[j].report
      if (a.kind !== "narrowed" || b.kind !== "narrowed") continue
      const bs = new Set(b.sets[0])
      // Disjoint outright, or disjoint on the rows whose E&M flavor is
      // determined (mechanical rows survive every E&M sentence and would
      // otherwise mask an SI-main-text / Gaussian-appendix split).
      const detA = a.sets[0].filter((k) => EM_FLAVOR[k])
      const detB = b.sets[0].filter((k) => EM_FLAVOR[k])
      const disjoint = !a.sets[0].some((k) => bs.has(k))
      const flavorDisjoint = detA.length > 0 && detB.length > 0 && !detA.some((k) => bs.has(k))
      if (disjoint || flavorDisjoint) mixed.push({ a: per[i].id, b: per[j].id })
    }
  return { overall, spans: per, mixed }
}
