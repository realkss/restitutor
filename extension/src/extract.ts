// Stage-2 TeX extraction (product-design §2.2): deterministic TeX from rendered
// HTML math. The page's own annotations are the source of truth —
//   - LaTeXML (ar5iv, arXiv native HTML, Wikipedia): <math alttext="…TeX…">
//   - KaTeX: <annotation encoding="application/x-tex"> inside the MathML half
//   - MathJax v2: the literal <script type="math/tex"> left in the DOM
// No OCR, no guessing: an element without a deterministic TeX carrier is simply
// not a candidate. Every candidate records HOW its TeX was obtained (provenance,
// same discipline as the engine's per-resolution provenance).
//
// The DOM types here are structural minimums so the adapters are unit-testable
// under node:test without a DOM implementation; real Elements satisfy them.
import { stripTrailingPunctuation } from "../../src/unitsEngine"
import { foldRows, overToFrac, splitStatements } from "../../src/tex"

export type TexVia = "alttext" | "mml-annotation" | "mathjax2-script"

export interface MinimalEl {
  tagName: string
  getAttribute(name: string): string | null
  textContent: string | null
  querySelector(sel: string): MinimalEl | null
  closest(sel: string): MinimalEl | null
  previousElementSibling: MinimalEl | null
}

export interface MinimalRoot {
  querySelectorAll(sel: string): Iterable<MinimalEl>
}

export type MathCandidate = {
  tex: string
  via: TexVia
  display: boolean
  /** The element the TeX was read from. */
  el: MinimalEl
  /** The visible element to decorate and listen on (differs for KaTeX/MathJax). */
  displayEl: MinimalEl
  /**
   * The statements the carrier holds — one, or the rows of an aligned
   * environment, or the pieces of a line joined by "and" (src/tex.ts
   * splitStatements). Detection, definitions and translation run over these.
   */
  statements: string[]
  /** For a statement folded from an equation group's rows: every row it spans, all to be decorated. */
  rows?: MinimalEl[]
}

/**
 * Normalize page-carried TeX to what the engine expects. Only mechanical,
 * provenance-preserving cleanups — never a rewrite of the math itself.
 */
export function normalizeTex(raw: string): string {
  let t = raw.trim()
  // Wikipedia alttext wraps the whole formula: {\displaystyle …} — unwrap ONLY
  // when the opening brace's partner is the final character; a greedy regex
  // would pair unrelated braces and corrupt "{\displaystyle x}\,\mathrm{J}".
  const wrapped = t.match(/^\{\\displaystyle\s([\s\S]*)\}$/)
  if (wrapped && outerBracesArePartners(t)) t = wrapped[1].trim()
  // A leading sizing directive blocks the engine's statement splitter, and the
  // whole family occurs in the wild (\textstyle on hand-compressed sums), not
  // just \displaystyle.
  t = t.replace(/^\\(?:display|text|scriptscript|script)style\b\s*/, "")
  // Source line-continuation comments: an UNESCAPED % swallowing its newline.
  // "50\%" is a percent sign, not a comment — parity of the backslash run.
  t = t.replace(/(\\*)%\s*\n\s*/g, (m, bs: string) => (bs.length % 2 === 1 ? m : bs))
  // Equation labels are document plumbing, not math
  t = t.replace(/\\label\{[^}]*\}/g, "")
  // TeX's primitive {a \over b}, one Wikipedia display equation in ten, in
  // the form the engine's emitter reproduces.
  t = overToFrac(t)
  return stripTrailingPunctuation(t.trim())
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

// Trailing sentence punctuation ("\tilde{F}_{5}=\star\tilde{F}_{5}\,." — a
// quarter of the alttexts on a real arXiv HTML page) is stripped by the
// ENGINE's exported stripTrailingPunctuation (imported above): one
// implementation, so the two layers cannot disagree about what a null
// delimiter's dot is.

const X_TEX_ANNOTATION = 'annotation[encoding="application/x-tex"]'

/** TeX from one <math> element, or null when it carries none. */
export function texFromMathEl(el: MinimalEl): { tex: string; via: TexVia } | null {
  const alt = el.getAttribute("alttext")
  if (alt !== null && alt.trim() !== "") return { tex: normalizeTex(alt), via: "alttext" }
  const ann = el.querySelector(X_TEX_ANNOTATION)
  if (ann && ann.textContent && ann.textContent.trim() !== "")
    return { tex: normalizeTex(ann.textContent), via: "mml-annotation" }
  return null
}

/**
 * Scan a document (or any subtree root) for math with deterministic TeX.
 * Candidates are deduplicated by their visible element.
 */
export function scanForMath(root: MinimalRoot): MathCandidate[] {
  const out: MathCandidate[] = []
  const seen = new Set<MinimalEl>()
  const push = (c: Omit<MathCandidate, "statements">) => {
    if (seen.has(c.displayEl)) return
    seen.add(c.displayEl)
    out.push({ ...c, statements: splitStatements(c.tex) })
  }

  // LaTeXML (ar5iv, arXiv HTML) renders an eqnarray or align as a table
  // whose CELLS are separate math elements — "s² = …" | "=" | "…" on one
  // row, "=" | "…" on the next — so read one cell at a time the engine sees
  // only fragments. The cells of a row are rejoined and the rows of a group
  // folded into statements (src/tex.ts foldRows); each statement is one
  // candidate, decorated on every row it spans.
  type Cell = { el: MinimalEl; tex: string; via: TexVia }
  const groups = new Map<MinimalEl, Map<MinimalEl, Cell[]>>()
  const groupOf = (el: MinimalEl) => el.closest("table.ltx_equationgroup")
  for (const el of root.querySelectorAll("math")) {
    const group = groupOf(el)
    if (!group) continue
    const row = el.closest("tr")
    if (!row) continue
    const got = texFromMathEl(el)
    if (!got) continue
    if (!groups.has(group)) groups.set(group, new Map())
    const rows = groups.get(group)!
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push({ el, ...got })
  }
  const emitted = new Set<MinimalEl>()

  for (const el of root.querySelectorAll("math")) {
    const group = groupOf(el)
    if (group) {
      if (emitted.has(group)) continue
      emitted.add(group)
      const rows = [...groups.get(group)!.entries()]
      const texts = rows.map(([, cells]) => cells.map((c) => c.tex).filter((t) => t.trim()).join(" "))
      for (const s of foldRows(texts)) {
        const spanned = s.rows.map((i) => rows[i][0])
        const first = rows[s.rows[0]][1][0]
        push({ tex: s.tex, via: first.via, display: true, el: first.el, displayEl: spanned[0], rows: spanned })
      }
      continue
    }
    const got = texFromMathEl(el)
    if (!got) continue
    // KaTeX nests its MathML inside the rendered span; Wikipedia hides the
    // MathML behind an .mwe-math-element wrapper that also holds the SVG
    // fallback image (which child is visible varies by skin and browser).
    // In both cases the wrapper is the reliable click target.
    const katexWrapper = el.closest(".katex-display") ?? el.closest(".katex")
    const mweWrapper = el.closest(".mwe-math-element")
    push({
      ...got,
      display:
        el.getAttribute("display") === "block" ||
        el.closest(".katex-display") !== null ||
        // Wikipedia's production wrapper class is …-block; -display kept for
        // older markup.
        /-(block|display)\b/.test(mweWrapper?.getAttribute("class") ?? ""),
      el,
      displayEl: katexWrapper ?? mweWrapper ?? el,
    })
  }

  for (const el of root.querySelectorAll('script[type^="math/tex"]')) {
    const tex = el.textContent
    if (!tex || tex.trim() === "") continue
    const type = el.getAttribute("type") ?? ""
    // MathJax v2 renders into a sibling placed just before the script — but
    // only trust a sibling that actually looks like MathJax output; an
    // unrelated preceding element must not become the click target.
    const sib = el.previousElementSibling
    const render = sib && /(^|\s)MathJax/.test(sib.getAttribute("class") ?? "") ? sib : null
    push({
      tex: normalizeTex(tex),
      via: "mathjax2-script",
      display: type.includes("mode=display"),
      el,
      displayEl: render ?? el,
    })
  }

  return out
}
