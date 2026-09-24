// TeX-level normalizations that sit in front of the frozen engine. The engine
// reads KaTeX parse trees and re-emits the equation it read as a check on
// itself; a construct its emitter cannot reproduce is declined as a
// reassembly fault. Rewriting such a construct to an equivalent one the
// emitter knows keeps the engine frozen and the page readable.

const OVER = /\\over(?![a-zA-Z])/

/** True when the character at i is preceded by an odd run of backslashes (an escaped brace). */
function escaped(s: string, i: number): boolean {
  let n = 0
  for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) n++
  return n % 2 === 1
}

/**
 * TeX's primitive fraction, `{a \over b}`, as Wikipedia's alttext prints
 * one display equation in ten, rewritten to `{\frac{a}{b}}`: the same
 * group, the same fraction, in the form the engine's emitter reproduces.
 * The enclosing brace group is found by scanning, so nested fractions fold
 * inner-first. A top-level `\over` with no enclosing group (TeX's "the
 * whole equation is the numerator") is left alone; the engine declines it
 * and says so.
 */
export function overToFrac(tex: string): string {
  let s = tex
  for (let guard = 0; guard < 60; guard++) {
    const k = s.search(OVER)
    if (k < 0) break
    let start = -1
    for (let j = k - 1, depth = 0; j >= 0; j--) {
      if (escaped(s, j)) continue
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
      if (escaped(s, j)) continue
      if (s[j] === "{") depth++
      else if (s[j] === "}") {
        if (depth === 0) {
          end = j
          break
        }
        depth--
      }
    }
    if (start < 0 || end < 0) return s
    const a = s.slice(start + 1, k).trim()
    const b = s.slice(k + 5, end).trim()
    s = s.slice(0, start) + "{\\frac{" + a + "}{" + b + "}}" + s.slice(end + 1)
  }
  return s
}

// ---------------------------------------------------------------------------
// Statements. A carrier is not always one equation: LaTeXML splits an
// eqnarray row into cells and a long equation across rows; a single alttext
// can hold an aligned environment, or two statements joined by "and". The
// engine refuses all of those as fragments ("select a single equation"), and
// on the corpus that was one pooled equation in eight. These fold rows back
// into statements and split a line into its statements, at the TeX level,
// before the engine sees anything.
// ---------------------------------------------------------------------------

const RELATION = /^\s*(?:=|:=|\\equiv|\\approx|\\simeq|\\sim|\\propto|\\cong|\\leq?|\\geq?|\\neq?|\\to|\\rightarrow|\\mapsto|\\ll|\\gg|<|>)(?![A-Za-z])/
const TRAILING_OPERATOR = /(?:[+\-=]|\\times|\\cdot|\\pm|\\mp|\\otimes|\\wedge|\\left\s*[(\[{]|\\bigl\s*[(\[])\s*$/
const LEADING_OPERATOR = /^\s*(?:[+\-]|\\times|\\cdot|\\pm|\\mp|\\otimes)(?![A-Za-z])/
const RELATION_TOKEN = /=|:=|\\equiv|\\approx|\\simeq|\\sim|\\propto|\\cong|\\leq?|\\geq?|\\neq?|\\to|\\rightarrow|\\mapsto|\\ll|\\gg|<|>/g

/** The relations at brace and bracket depth zero, in order: where each stands, and how it is written. */
function topLevelRelations(s: string): { index: number; token: string }[] {
  const out: { index: number; token: string }[] = []
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "\\" && i + 1 < s.length && !/[A-Za-z]/.test(s[i + 1])) {
      i++ // an escaped brace or symbol
      continue
    }
    if (ch === "{" || ch === "(" || ch === "[") depth++
    else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1)
    else if (depth === 0) {
      RELATION_TOKEN.lastIndex = i
      const m = RELATION_TOKEN.exec(s)
      if (m && m.index === i) {
        // A macro must end here: \leq is not \left, \to is not \tolerance.
        const after = s[i + m[0].length]
        if (!(m[0].startsWith("\\") && after !== undefined && /[A-Za-z]/.test(after))) {
          out.push({ index: i, token: m[0] })
          i += m[0].length - 1 // := is one relation, not : and then =
        }
      }
    }
  }
  return out
}

/** The index of the first relation at brace and bracket depth zero, or -1. */
function topLevelRelation(s: string): number {
  return topLevelRelations(s)[0]?.index ?? -1
}

const ORDER_TOKEN = /^(?:<|>|\\leq?|\\geq?|\\ll|\\gg)$/

/**
 * Whether a comma between two statements can instead list the terms both
 * bounds share: the relation before it and the relation after it both order
 * their sides. `0 < t,\quad r < 2M` puts t and r both in (0, 2M); split, it
 * gave t the bound of r. The engine's statement layer (translateLine) declines
 * the same shape, so the line is left whole for it to decline.
 */
function sharesOperands(left: string, right: string): boolean {
  const before = topLevelRelations(left).pop()
  const after = topLevelRelations(right)[0]
  return before != null && after != null && ORDER_TOKEN.test(before.token) && ORDER_TOKEN.test(after.token)
}

const hasRelation = (s: string) => topLevelRelation(s) >= 0

/** The part before the first top-level relation, or null when there is none. */
export function lhsOf(s: string): string | null {
  const i = topLevelRelation(s)
  return i >= 0 ? s.slice(0, i).trim() || null : null
}

/**
 * Rows of an equation group folded into statements: a row that continues
 * the previous one (the previous row ends with an operator or an open
 * delimiter, or this row begins with one) is joined to it; a row that
 * begins with a relation restates the previous statement's left side, as
 * "a = b \\ = c" means a = c; anything else opens a new statement. Each
 * statement remembers the rows it came from.
 */
export function foldRows(rows: string[]): { tex: string; rows: number[] }[] {
  const out: { tex: string; rows: number[] }[] = []
  rows.forEach((raw, i) => {
    const r = raw.trim()
    if (!r) return
    const prev = out[out.length - 1]
    if (prev && (TRAILING_OPERATOR.test(prev.tex) || LEADING_OPERATOR.test(r))) {
      prev.tex += " " + r
      prev.rows.push(i)
      return
    }
    if (prev && RELATION.test(r)) {
      const lhs = lhsOf(prev.tex)
      out.push({ tex: (lhs ? lhs + " " : "") + r, rows: [i] })
      return
    }
    out.push({ tex: r, rows: [i] })
  })
  return out
}

const ROW_ENV = /\\begin\{(aligned|align\*?|gathered|gather\*?|eqnarray\*?|split|multline\*?|alignat\*?|flalign\*?)\}([\s\S]*?)\\end\{\1\}/
const SPACING = /^(?:\s|\\[,;:!> ]|\\quad|\\qquad|\\hspace\{[^{}]*\}|\\ )+|(?:\s|\\[,;:!> ]|\\quad|\\qquad|\\hspace\{[^{}]*\}|\\ )+$/g
// "and" in its printed forms, a semicolon, a \qquad, or a comma set off by
// explicit spacing on both sides ("a = b\ \ \ ,\ \ \ c = d") — never a bare
// comma, which separates arguments and list members.
const AND = /^(?:\{\s*\\rm\s+and\s*\}|\\(?:text|mbox|textrm|mathrm|hbox)\s*\{\s*and\s*\}|;|\\qquad|(?:\\[ ,;:]\s*)+,\s*(?:\\[ ,;:]\s*)+)/
const QUAD = /^\\quad(?![A-Za-z])/

/** Alignment marks dropped at the top level; a nested matrix keeps its own. */
function stripAlignmentMarks(row: string): string {
  let out = ""
  let env = 0
  for (let i = 0; i < row.length; i++) {
    if (row.startsWith("\\begin{", i)) env++
    else if (row.startsWith("\\end{", i)) env = Math.max(0, env - 1)
    if (row[i] === "\\" && i + 1 < row.length && !/[A-Za-z]/.test(row[i + 1])) {
      out += row[i] + row[i + 1]
      i++
      continue
    }
    out += row[i] === "&" && env === 0 ? " " : row[i]
  }
  return out
}

/** Splits at the top level of braces, brackets and environments. */
function splitTopLevel(s: string, separator: (rest: string) => number): string[] {
  const out: string[] = []
  let depth = 0
  let env = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    // The separator is tried first at every top-level position: it may open
    // a brace ({\rm and}) or begin with an escape (\ \ \ , or the row
    // separator \\ itself), which the tracking below would otherwise skip.
    if (depth === 0 && env === 0) {
      const n = separator(s.slice(i))
      if (n > 0) {
        out.push(s.slice(start, i))
        start = i + n
        i = start - 1
        continue
      }
    }
    if (ch === "\\" && i + 1 < s.length && !/[A-Za-z]/.test(s[i + 1])) {
      i++ // an escaped brace, a spacing macro, or a row separator that is not being split on
      continue
    }
    if (s.startsWith("\\begin{", i)) env++
    else if (s.startsWith("\\end{", i)) env = Math.max(0, env - 1)
    if (ch === "{" || ch === "(" || ch === "[") depth++
    else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1)
  }
  out.push(s.slice(start))
  return out
}

/**
 * The statements a carrier holds: the rows of an aligned environment folded
 * as an equation group; a line split at "and", a semicolon or a \qquad,
 * and at a \quad when every piece is a relation of its own. A line that
 * does not split cleanly into relations is returned whole — the engine's
 * decline names it, and a wrong split would be a wrong claim. So is a line
 * with a comma between two order relations (sharesOperands), wherever the
 * comma stands: in the separator, or beside it.
 */
export function splitStatements(tex: string): string[] {
  const t = tex.trim()
  const env = ROW_ENV.exec(t)
  if (env && t.replace(env[0], "").replace(/[{}\s]/g, "") === "") {
    const rows = splitTopLevel(env[2], (rest) => (rest.startsWith("\\\\") ? 2 : 0)).map((r) =>
      stripAlignmentMarks(r).replace(/\\\\\s*$/, "").replace(SPACING, "").replace(/ {2,}/g, " ").trim(),
    )
    const folded = foldRows(rows).map((s) => s.tex.replace(SPACING, "").trim()).filter(Boolean)
    return folded.length ? folded : [t]
  }
  let seps: string[] = []
  const at = (re: RegExp) => (rest: string) => {
    const n = re.exec(rest)?.[0].length ?? 0
    if (n > 0) seps.push(rest.slice(0, n))
    return n
  }
  let raw = splitTopLevel(t, at(AND))
  if (raw.length === 1) {
    seps = []
    raw = splitTopLevel(t, at(QUAD))
  }
  // Each kept piece, and whether a comma stands between it and the one before.
  const pieces: string[] = []
  const commaBefore: boolean[] = []
  let comma = false
  raw.forEach((p, k) => {
    const bare = p.replace(SPACING, "")
    const clean = bare.replace(/^[,.]+|[,.]+$/g, "").replace(SPACING, "").trim()
    if (clean) {
      if (pieces.length > 0) commaBefore.push(comma || bare.startsWith(","))
      pieces.push(clean)
      comma = false
    } else if (bare.includes(",")) {
      comma = true
    }
    comma = comma || bare.endsWith(",") || (seps[k]?.includes(",") ?? false)
  })
  const shared = pieces.some((p, j) => j > 0 && commaBefore[j - 1] && sharesOperands(pieces[j - 1], p))
  if (pieces.length > 1 && pieces.every(hasRelation) && !shared) return pieces
  return [t]
}
