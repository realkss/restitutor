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
  // A trailing "d" the engine reads as a derivative, and a bar inside
  // parentheses it reads as a relation (p(d | H)), are the reader's, not
  // the carrier's; they are tried before the fragment wordings they share.
  [/reads as a derivative|relation nested inside a group/, "unsupported"],
  // The carrier was not one equation: an alignment block, a list of
  // statements, a row cut at its relation, a trailing operator, nothing.
  // After the extractor rejoins equation-group rows, what remains here is
  // mostly the engine reading an argument comma as a list separator.
  [/lists or multiple statements|a row that begins at|a trailing .* with nothing after it|an empty expression/, "fragment"],
  [/a proportionality/, "proportional"],
  // The equation IS a units declaration (c = G = 1): nothing to restore.
  [/a relation between the constants themselves/, "declaration"],
  // Constructs the engine's reader does not handle, in its several wordings.
  [
    /not supported|could not be read|could not read|cannot read|floating super\/subscript|symbolic exponent|unsupported (?:relation|accent|differential)|closing delimiter|cannot pair with its partner|in this position|primed symbol|time derivative of a compound|integrals, sums, and limits/,
    "unsupported",
  ],
]
// Classes about the dimensions of a relation the engine did read; judged
// only once every symbol in it has a reading.
const DIMENSIONAL: [RegExp, OutcomeClass][] = [
  [/temperature dimensions that do not balance/, "kept-explicit"],
  [/charge dimensions that do not balance/, "charge"],
  [/no c–G completion/, "no-completion"],
]

export function classifyOutcome(r: TranslationResult): Outcome {
  if (r.kind === "translated") return { class: r.changed ? "translated" : "unchanged", reason: "", unknown: [] }
  if (r.kind === "no-anchor") return { class: "no-anchor", reason: "", unknown: [] }
  const reason = r.reasons[0] ?? ""
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
