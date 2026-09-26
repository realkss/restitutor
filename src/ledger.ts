// The decline ledger: every outcome of a translation attempt named by its
// reason class, so a corpus run can say WHY the tool says no — which decides
// what to build next. An unknown symbol the page defines in words the
// templates missed is the case a context reader would rescue; a term with
// no completion over the ambient constants is the case only a new profile
// helps; a refused object or an unsupported construct is neither. The
// classes are read off the engine's own reason strings (src/unitsEngine.ts)
// and the gate's (src/gate.ts); a reason none of them names is "other" and
// is reported, never swallowed.
import type { TranslationResult } from "./unitsEngine"

export type OutcomeClass =
  | "translated"
  | "unchanged"
  | "no-anchor"
  | "unknown-symbol"
  | "no-completion"
  | "kept-explicit"
  | "charge"
  | "proportional"
  | "declaration"
  | "fragment"
  | "unsupported"
  | "parse"
  | "reassembly"
  | "refused"
  | "other"

export type Outcome = {
  class: OutcomeClass
  /** The engine's or the gate's own words, first reason only. */
  reason: string
  /** Symbols the registry could not vouch for (unknown-symbol only). */
  unknown: string[]
}

// Classes that stand whatever else the equation carries: the equation was
// never read as a relation between quantities, or could not be re-emitted.
const STRUCTURAL: [RegExp, OutcomeClass][] = [
  [/name of a mathematical object|a set or an algebra|relation between sets or maps/, "refused"],
  [/reassembly fault/, "reassembly"],
  [/KaTeX could not parse|unbalanced delimiters/, "parse"],
  // A trailing "d" the engine reads as a derivative, and a relation or a
  // comma inside brackets (p(d | H), X(σ,τ)) or inside any other expression,
  // are the reader's, not the carrier's; they are tried before the fragment
  // wordings they share.
  [/reads as a derivative|a relation inside brackets|a comma inside brackets|a comma or semicolon inside an expression/, "unsupported"],
  // The carrier was not one equation: an alignment block, a list of
  // statements, a row cut at its relation, a relation with an empty side, a
  // trailing operator, a bare sign pattern, nothing. Spacing between two
  // factors is the same question asked of a chain: two statements set side
  // by side, or one product. An implication with a side that is no
  // statement, and a continuation row that could continue any statement of
  // the row above, are not one equation either.
  [/lists or multiple statements|a row that begins at|a relation with nothing on one side|a trailing .* with nothing after it|an empty expression|signs with nothing to act on|explicit spacing between two factors|^prose \(|an implication (?:with nothing|whose side)|a continuation row after a row of several statements/, "fragment"],
  [/a proportionality/, "proportional"],
  // The equation IS a units declaration (c = G = 1), gives a constant a value
  // in units it does not name (c = 299792458), compares one with a number
  // (c < 1), or only relates the constants (c > G): nothing to restore. A
  // statement of a list that sets a quantity against a bare 1 (`v \ll 1`,
  // `M = 1`) states it in units the equation does not name, as those do.
  [/a relation between the constants themselves|a numeric value for “.*”, in units the equation does not state|a comparison of “.*” with a number, in units the equation does not state|a side that is the number 1 in “.*”, whose units the equation does not state/, "declaration"],
  // Constructs the engine's reader does not handle, in its several wordings.
  [
    /not supported|could not be read|could not read|cannot read|floating super\/subscript|which may be an exponent or an index|unsupported (?:relation|accent|differential)|closing delimiter|cannot pair|whose pairing is ambiguous|Dirac bra–ket notation|a modulus or a determinant|in this position|time derivative of a compound|a component along the coordinate “|the dictionary reads the .* with x⁰ = ct|the upright (?:word|words|letter) |the multi-letter name |an unspecified constant|a constant to restore inside the font|the arrow “|the exchange “|a colon that is not part of|which the engine does not read|neither a power nor a dictionary index|a sign directly beside|a component index or a power|, not the constant [cG]$|mixes a label with indices|a label or mark on the constant|a dot on the indexed symbol|the operator “.*” with nothing to act on|an upright “d” with nothing after it|a differential of symbolic order|a detached superscript “|after the derivative indices in “|with no measure \(d…\) of its own|a functional integral|with its measure first and more terms|which the engine does not restore|as the name of a set|cannot be paired with one variable|an integral over “|the vector measure|a function whose argument runs into|of a dimensional argument|whose undelimited argument|does not pass through|which the engine cannot name|which the engine does not re-emit|the summation index “|under a sum over |a range under “.*” naming “|whose index the engine cannot isolate|a derivative index “/,
    "unsupported",
  ],
]
// Classes about the dimensions of a relation the engine did read; judged
// only once every symbol in it has a reading.
const DIMENSIONAL: [RegExp, OutcomeClass][] = [
  [/temperature dimensions that do not balance/, "kept-explicit"],
  [/charge dimensions that do not balance/, "charge"],
  // A constant term among quantities the registry reads with another
  // dimension (g_00 ≈ -c² - 2Φ): a verdict on the readings, as no-completion is.
  [/no c–G completion|a term made only of c and G that the registry's readings/, "no-completion"],
]

export function classifyOutcome(r: TranslationResult): Outcome {
  if (r.kind === "translated") return { class: r.changed ? "translated" : "unchanged", reason: "", unknown: [] }
  if (r.kind === "no-anchor") return { class: "no-anchor", reason: "", unknown: [] }
  // A reassembly fault the engine withheld from the reader, because unknown
  // symbols decline the equation too, still stands here as it always has.
  const reason = r.reasons[0] ?? r.fault ?? ""
  for (const [re, cls] of STRUCTURAL) if (re.test(reason)) return { class: cls, reason, unknown: r.unknown }
  // A symbol the registry cannot vouch for comes first: no completion can
  // be judged around it, and the engine returns no reason at all when the
  // unknowns are the only problem.
  if (r.unknown.length) return { class: "unknown-symbol", reason, unknown: r.unknown }
  for (const [re, cls] of DIMENSIONAL) if (re.test(reason)) return { class: cls, reason, unknown: [] }
  return { class: "other", reason, unknown: [] }
}

/** The order the classes are reported in: what the reader can fix first. */
export const OUTCOME_ORDER: OutcomeClass[] = [
  "translated",
  "unchanged",
  "no-anchor",
  "unknown-symbol",
  "no-completion",
  "kept-explicit",
  "charge",
  "proportional",
  "declaration",
  "fragment",
  "unsupported",
  "parse",
  "reassembly",
  "refused",
  "other",
]

export type Ledger = {
  counts: Record<OutcomeClass, number>
  /** Unknown symbols with how many equations each blocked. */
  unknown: Map<string, number>
  others: string[]
}

export function emptyLedger(): Ledger {
  const counts = Object.fromEntries(OUTCOME_ORDER.map((c) => [c, 0])) as Record<OutcomeClass, number>
  return { counts, unknown: new Map(), others: [] }
}

export function record(ledger: Ledger, outcome: Outcome): void {
  ledger.counts[outcome.class]++
  for (const s of outcome.unknown) ledger.unknown.set(s, (ledger.unknown.get(s) ?? 0) + 1)
  if (outcome.class === "other") ledger.others.push(outcome.reason)
}

/**
 * Whether the page's prose mentions the symbol under a declaration cue —
 * the cheap proxy for "the page defines it in words the templates missed",
 * i.e. the case a context reader could rescue. Runs over the miner's
 * surface, where math is already $…$. Strict on purpose: the math chunk
 * must BE the symbol (braces and spaces aside), and the cue must sit within
 * a few words of it — "where $h$ is the strain", "$\psi_4$ denotes", "the
 * lapse $N$ is" — since a single letter occurs inside almost every chunk
 * and "is" inside almost every sentence.
 */
export function mentionedWithCue(surface: string, symbol: string): boolean {
  const key = symbol.replace(/[{}\s]/g, "")
  if (!key) return false
  const before = /(?:where|let|with|write|define|denote|call)\s+(?:\w+\s+){0,3}$/i
  const after = /^\s*(?:,|\()?\s*(?:\w+\s+){0,2}(?:is|are|denotes?|stands?\s+for|represents?|being|means?|called|defined)\b/i
  for (const m of surface.matchAll(/\$([^$]{1,80})\$/g)) {
    if (m[1].replace(/[{}\s]/g, "") !== key) continue
    const start = m.index ?? 0
    const pre = surface.slice(Math.max(0, start - 60), start)
    const post = surface.slice(start + m[0].length, start + m[0].length + 60)
    if (before.test(pre) || after.test(post)) return true
  }
  return false
}
