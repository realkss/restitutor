// Census §6.5: declaration-sentence extraction. "where m is the mass" becomes
// the triple (m, mass, [1,0,0,0,0]): templates over sentences, a gloss
// grammar whose stopword list is the precision device, a noun table for the
// dimension, and the GR registry's own reading set beside it wherever the two
// disagree. The per-paper declaration wins — that is the point of §6.5 — but
// the clash is surfaced, never resolved silently, because a mis-parsed
// declaration and a genuine per-paper override look alike at this stage.
//
// What is deliberately NOT mined here: "we set c = 1" (a normalization, routed
// to the chain parser in detect.ts), dimensionless ratios ("η = n_b/n_γ" has
// no unit axis — census §2.1), and hatted or tilded symbols (§6.5 cue (iii):
// the decoration means the symbol left physical units).
import { GLOSSARY_NOUNS, GlossNoun } from "./tables.generated"
import { DimQ, dimQ } from "./convention"
import { findRegistryForSlug, RegEntry } from "./unitsEngine"
import { INDEX_LIKE, dimToDimQ } from "./bridge"
import { foldMathAlphanumeric } from "./detect"

export type Caveat = "ambiguous" | "convention-dependent" | "depends-on-d" | "coordinate-convention"

export type MinedSymbol = {
  /** The symbol as written, without its $ delimiters. */
  symbol: string
  /** The gloss phrase as printed. */
  gloss: string
  noun: GlossNoun
  /** The noun's SI reading. */
  dim: DimQ
  template: string
  sentence: string
  /** A defining expression, where the sentence gave one. */
  expr?: string
  caveat?: Caveat
  /** The GR registry's reading of the same symbol, where it disagrees. */
  registry?: { gloss: string; dim: DimQ }
}

export type MinedDefinition = { symbol: string; expr: string; sentence: string }

export type MinedReport = {
  symbols: MinedSymbol[]
  /** "X ≡ expr" with no gloss attached: worth routing onward, not a unit-axis triple. */
  definitions: MinedDefinition[]
}

// ---------------------------------------------------------------------------
// Grammar (drafted from census §6.5 and audited on unseen sentences).
// ---------------------------------------------------------------------------
const STOP =
  "is|are|was|were|be|been|being|am|the|a|an|this|that|these|those|which|who|whose|and|or|but|if|so|then|than|as|not|no|of|in|on|at|by|to|for|from|with|without|into|onto|over|under|between|among|across|through|per|via|up|out|due|about|above|below|within|we|it|its|they|their|there|here|where|when|run|runs|ranges|range|extends|goes|runs-over|denotes|denote|denoted|gives|give|given|defines|define|defined|equals|equal|represents|represent|has|have|had|can|may|must|will|shall|should|only|also|respectively|both|each|all|any|same|measured|expressed|evaluated|written|normalized|normalised|taken|obtained|computed|calculated|assumed|used|introduced|discussed|listed|reported|quoted|shown|see|ref|eq|eqs|fig|table|appendix"

// A symbol: a TeX macro (with one optional brace argument, so \mathbf{J}
// reads) or a single Latin letter, with optional subscript and superscript,
// optionally inside $…$. \hat, \tilde and \bar are excluded on purpose.
// Primes are admitted before and after the sub/superscripts (t', x'^\mu):
// retarded and source variables are the GR/E&M bread and butter (review v2).
const SYM = String.raw`(?<![A-Za-z0-9_\\])\$?(?:\\(?!(?:hat|widehat|tilde|widetilde|bar|overline)\b)[A-Za-z]+(?:\{[^{}]{1,16}\})?|[A-Za-z])(?:'{1,3})?(?:_(?:\{[^{}]{1,24}\}|\\?[A-Za-z0-9]+))?(?:\^(?:\{[^{}]{1,12}\}|[*'\d]))?(?:'{1,3})?\$?(?![A-Za-z0-9_])`
const S = String.raw`(?<symbol>${SYM})`
// A gloss word: anything outside the stopword list.
const W = String.raw`(?!(?:${STOP})\b)[A-Za-z][A-Za-z-]*`
const OF_TAIL = String.raw`\s+of\s+(?:light|sound|inertia|gravity|freedom|state|refraction|motion)`
const BOUNDARY = String.raw`(?=[,.;:)\]]|$|\s+(?:${STOP})\b)`
const GLOSS_LAZY = String.raw`(?<gloss>(?:${W}${OF_TAIL}|${W}(?:\s+${W}){0,4}?))${BOUNDARY}`
const GLOSS_GREEDY = String.raw`(?<gloss>(?:${W}${OF_TAIL}|${W}(?:\s+${W}){0,4}))`
const EXPR = String.raw`(?<expr>[^,;$]{1,60}?)(?:\$(?=[\s,.;]|$)|(?=[,.;]|$)|(?=\s+(?:${STOP})\b))`

type Template = { id: string; re: RegExp; list?: boolean; expr?: boolean; confined?: boolean }
const T = (id: string, src: string, flags: Omit<Template, "id" | "re"> = {}): Template => ({
  id,
  re: new RegExp(src, "g"),
  ...flags,
})

export const TEMPLATES: Template[] = [
  T("where_comma_list_are_the_Y", String.raw`\bwhere\s+(?<symbol>${SYM}(?:(?:\s*,\s*|\s*,?\s+and\s+)${SYM})+)\s+are\s+the\s+${GLOSS_LAZY}`, { list: true }),
  T("where_X_is_the_Y", String.raw`\bwhere\s+${S}\s+is\s+the\s+${GLOSS_LAZY}`),
  T("where_X_is_a_Y", String.raw`\bwhere\s+${S}\s+is\s+an?\s+${GLOSS_LAZY}`),
  T("where_X_denotes_the_Y", String.raw`\bwhere\s+${S}\s+(?:denotes|represents|stands\s+for|labels)\s+the\s+${GLOSS_LAZY}`),
  T("here_X_is_the_Y", String.raw`\b[Hh]ere,?\s+${S}\s+(?:is|denotes|represents|labels|stands\s+for)\s+the\s+${GLOSS_LAZY}`),
  T("let_X_be_the_Y", String.raw`\b[Ll]et\s+${S}\s+(?:be|denote)\s+the\s+${GLOSS_LAZY}`),
  T("with_X_the_Y", String.raw`\bwith\s+${S}\s+the\s+${GLOSS_LAZY}`),
  T("X_is_the_Y_sentence_initial", String.raw`(?:^|(?<=[.;:]\s))${S}\s+(?:is|denotes|represents)\s+the\s+${GLOSS_LAZY}`),
  T("continuation_X_is_the_Y", String.raw`(?:[,;]|\band|\bwhile)\s+${S}\s+(?:is|denotes|represents)\s+the\s+${GLOSS_LAZY}`),
  T("continuation_X_the_Y", String.raw`(?:[,;]|\band)\s+${S}\s+the\s+${GLOSS_LAZY}`),
  T("X_being_the_Y", String.raw`${S}\s+being\s+the\s+${GLOSS_LAZY}`),
  T("X_stands_for_the_Y", String.raw`${S}\s+(?:stands\s+for|refers\s+to|corresponds\s+to)\s+the\s+${GLOSS_LAZY}`),
  T("Y_denoted_by_X", String.raw`\b[Tt]he\s+${GLOSS_LAZY}\s*,?\s+(?:denoted|written|labelled|labeled)\s+(?:by\s+|as\s+)?${S}`),
  T("X_paren_the_Y", String.raw`${S}\s*\(\s*the\s+${GLOSS_GREEDY}[^()]{0,40}\)`),
  T("X_eq_expr_is_the_Y", String.raw`${S}\s*=\s*(?<expr>[^,;$]{1,60}?)\$?\s+is\s+the\s+${GLOSS_LAZY}`, { expr: true }),
  T("we_define_X_eq_expr", String.raw`\b[Ww]e\s+(?:define|introduce|write|set)\s+${S}\s*(?:\\equiv|≡|:=|=)\s*${EXPR}(?:\s+as\s+the\s+${GLOSS_LAZY})?`, { expr: true }),
  // "is defined as [7] $\kappa = 8\pi G/c^4$": the citation bracket may sit between.
  T("defined_as_X_eq_expr", String.raw`\b(?:defined|given)\s+(?:as|by)\s*(?:\[\s*\d+\s*\]\s*)?${S}\s*(?:\\equiv|≡|:=|=)\s*${EXPR}`, { expr: true }),
  T("X_equiv_expr", String.raw`${S}\s*(?:\\equiv|≡)\s*${EXPR}`, { expr: true }),
  T("X_colon_eq_expr", String.raw`${S}\s*:=\s*${EXPR}`, { expr: true }),
  // The bare appositive ("the Hubble parameter H_0") has the highest recall
  // and, alone, the worst precision of the set: it runs only in a sentence
  // another template has already identified as a declaration.
  T("appositive_the_Y_X", String.raw`\b[Tt]he\s+${GLOSS_GREEDY}\s+${S}`, { confined: true }),
]

// ---------------------------------------------------------------------------
// Noun resolution.
// ---------------------------------------------------------------------------
const NOUN_INDEX = new Map<string, GlossNoun>()
for (const n of GLOSSARY_NOUNS) {
  NOUN_INDEX.set(n.noun.toLowerCase(), n)
  for (const s of n.synonyms) if (!NOUN_INDEX.has(s.toLowerCase())) NOUN_INDEX.set(s.toLowerCase(), n)
}

function singulars(phrase: string): string[] {
  const out = [phrase]
  if (/[^s]s$/.test(phrase)) out.push(phrase.slice(0, -1))
  if (/es$/.test(phrase)) out.push(phrase.slice(0, -2))
  if (/ies$/.test(phrase)) out.push(phrase.slice(0, -3) + "y")
  return out
}

/**
 * The full phrase, then its head before an of-tail ("speed of light" →
 * "speed"; "moment of inertia" is a noun of its own and never reaches this),
 * then with leading modifiers dropped one at a time — each tried singular too.
 */
export function resolveNoun(gloss: string): GlossNoun | null {
  const phrase = gloss.toLowerCase().replace(/\s+/g, " ").trim()
  const heads = [phrase]
  const of = phrase.indexOf(" of ")
  // Only the whitelisted of-tails name the head ("speed of light" is a
  // speed); "density of states" is not a density (review v2).
  if (of > 0 && /^ of (?:light|sound|inertia|gravity|freedom|state|refraction|motion)s?$/.test(phrase.slice(of)))
    heads.push(phrase.slice(0, of))
  for (const head of heads) {
    const words = head.split(" ")
    // Leading modifiers drop one at a time, never past an "of": the head of
    // "center of mass" is "center", and it names nothing here.
    const limit = words.indexOf("of") > 0 ? words.indexOf("of") : words.length
    for (let i = 0; i < limit; i++) {
      for (const cand of singulars(words.slice(i).join(" "))) {
        const n = NOUN_INDEX.get(cand)
        if (n) return n
      }
    }
  }
  return null
}

function caveatOf(n: GlossNoun): Caveat | undefined {
  if (n.dimensionDependsOnSpatialDimension) return "depends-on-d"
  if (n.ambiguous) return "ambiguous"
  if (n.coordinateConventionDependent) return "coordinate-convention"
  if (n.conventionDependent) return "convention-dependent"
  return undefined
}

// ---------------------------------------------------------------------------
// The registry cross-check.
// ---------------------------------------------------------------------------
const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/00")

/**
 * The GR registry's reading of a symbol, by the engine's own lookup order:
 * an exact identity (k_B, T_H, r_s), else the base's INDEXED reading when the
 * subscript is a run of indices (T_{μν} is the stress–energy tensor, never
 * the temperature), else the bare reading for a bare symbol. A subscripted
 * symbol the engine declines is declined here too — never guessed from its
 * base letter (review v2).
 */
export function registryReading(symbol: string): { gloss: string; dim: DimQ } | null {
  if (!GR) return null
  const read = (e: RegEntry) => ({ gloss: e.gloss, dim: dimToDimQ(e.dim) })
  if (GR.exact[symbol]) return read(GR.exact[symbol])
  const m = /^(.+?)(?:_(?:\{([^{}]*)\}|(\\?[A-Za-z0-9]+))(?:\^.*)?|\^.*)$/.exec(symbol)
  if (m) {
    const base = m[1]
    const sub = (m[2] ?? m[3] ?? "").replace(/[{}\s]/g, "")
    if (sub && GR.exact[`${base}_${sub}`]) return read(GR.exact[`${base}_${sub}`])
    if (sub && INDEX_LIKE.test(sub) && GR.indexed[base]) return read(GR.indexed[base])
    return null
  }
  return GR.bare[symbol] ? read(GR.bare[symbol]) : null
}

export const dimEq = (a: DimQ, b: DimQ): boolean => a.every((x, i) => x.eq(b[i]))

// ---------------------------------------------------------------------------
// The miner.
// ---------------------------------------------------------------------------
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.;!?])\s+(?=[A-Z$\\(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const cleanSymbol = (s: string) => s.replace(/\$/g, "").trim()

export function mineDeclarations(text: string): MinedReport {
  const symbols: MinedSymbol[] = []
  const definitions: MinedDefinition[] = []
  const seen = new Set<string>()
  // Typographic primes and dashes fold to ASCII so t′ and t' share a key
  // and "stress–energy" reads as one gloss word.
  const folded = foldMathAlphanumeric(text).replace(/[′″‴]/g, "'").replace(/[–—]/g, "-")
  for (const raw of splitSentences(folded)) {
    const sentence = raw.length > 200 ? raw.slice(0, 200) : raw
    type Hit = { at: number; symbol: string; gloss?: string; expr?: string; template: string }
    const hits: Hit[] = []
    const run = (t: Template) => {
      t.re.lastIndex = 0
      for (const m of raw.matchAll(t.re)) {
        const g = m.groups ?? {}
        const syms = t.list ? g.symbol.split(/\s*,\s*|\s*,?\s+and\s+/) : [g.symbol]
        for (const s of syms) {
          const symbol = cleanSymbol(s)
          if (!symbol) continue
          // An undelimited a, A or I is an English word, not a symbol
          // ("the force a particle feels") — review v2.
          if (/^[aAI]$/.test(symbol) && !s.includes("$")) continue
          hits.push({ at: m.index ?? 0, symbol, gloss: g.gloss, expr: g.expr?.trim(), template: t.id })
        }
      }
    }
    for (const t of TEMPLATES) if (!t.confined) run(t)
    if (hits.length) for (const t of TEMPLATES) if (t.confined) run(t)
    hits.sort((a, b) => a.at - b.at)
    for (const h of hits) {
      // "we set c = 1" is a normalization, not a reading: the chain parser's.
      if (h.expr !== undefined && /^\s*1\s*$/.test(h.expr)) continue
      if (seen.has(h.symbol)) continue
      const noun = h.gloss ? resolveNoun(h.gloss) : null
      if (!noun) {
        if (h.expr) {
          seen.add(h.symbol)
          definitions.push({ symbol: h.symbol, expr: h.expr, sentence })
        }
        continue
      }
      seen.add(h.symbol)
      const dim = dimQ(...noun.dim)
      const reg = registryReading(h.symbol)
      const out: MinedSymbol = { symbol: h.symbol, gloss: h.gloss!, noun, dim, template: h.template, sentence }
      if (h.expr) out.expr = h.expr
      const caveat = caveatOf(noun)
      if (caveat) out.caveat = caveat
      if (reg && !dimEq(reg.dim, dim)) out.registry = reg
      symbols.push(out)
    }
  }
  return { symbols, definitions }
}
