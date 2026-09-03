// The gate in front of the engine: what is not a relation between physical
// quantities is refused before any symbol is read. The engine's tokenizer
// takes TeX at its word — "SL" is S times L — so a group name would come
// back as a legend of entropy and angular momentum. A named mathematical
// object (a group, a set, a map, an algebra) carries nothing to restore, and
// the product contract is to decline loudly, never to misread.
import type { TranslationResult } from "./unitsEngine"

const Q = (s: string) => "‘" + s + "’"

// Named objects physicists write in math italic with an argument: Lie
// groups and their relatives, structure functors, named operators.
const NAMED_OBJECT =
  /(?<![A-Za-z\\])(SL|GL|SO|SU|Sp|Spin|PSL|PGL|PSU|PSO|Pin|ISO|Diff|Aut|Hom|End|Ker|Coker|Iso|Isom|Lie|Sym|Alt|AdS|dS|Vir|Vect|Mat|Gal|Cl|Symp|Conf|Poinc|Lor)\s*(?:_\s*(?:\{[^{}]*\}|[A-Za-z0-9]))?\s*(?:\^\s*(?:\{[^{}]*\}|[A-Za-z0-9+\-]))?\s*(?:\(|\\left\s*\()/
// A number set or an algebra: nothing here has a dimension.
const STRUCTURE_SET = /\\math(?:bb|frak)\s*\{[^{}]*\}/
// Statements about sets and maps, not about quantities.
const STRUCTURE_RELATION = /\\(?:in|notin|subset|subseteq|supset|supseteq|cong|simeq|hookrightarrow|twoheadrightarrow|mapsto|circ|oplus|otimes|ltimes|rtimes|wr)(?![A-Za-z])/

/**
 * A synthetic decline for TeX that is a mathematical object rather than an
 * equation of quantities, or null when the engine should see it.
 */
export function refuseNonEquation(tex: string): TranslationResult | null {
  // Each reason follows the view's "Declined: this equation contains …".
  const reasons: string[] = []
  const named = NAMED_OBJECT.exec(tex)
  if (named) {
    // Quote the object with its argument: SL(2,\mathbb{R}), not SL.
    const close = tex.indexOf(")", named.index)
    const shown = close > 0 ? tex.slice(named.index, close + 1) : named[0]
    reasons.push(`${Q(shown.trim())}, the name of a mathematical object (a group or a functor), which has no dimension`)
  }
  const set = STRUCTURE_SET.exec(tex)
  if (set) reasons.push(`${Q(set[0])}, a set or an algebra, not a quantity`)
  if (!reasons.length) {
    const rel = STRUCTURE_RELATION.exec(tex)
    if (rel) reasons.push(`${Q(rel[0])}, a relation between sets or maps, not between quantities`)
  }
  if (!reasons.length) return null
  return {
    kind: "declined",
    reasons: [...reasons, "nothing to restore, since it is not a relation between physical quantities"],
    unknown: [],
    legend: [],
  }
}
