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
}

/**
 * Normalize page-carried TeX to what the engine expects. Only mechanical,
 * provenance-preserving cleanups — never a rewrite of the math itself.
 */
export function normalizeTex(raw: string): string {
  let t = raw.trim()
  // Wikipedia alttext wraps the whole formula: {\displaystyle …}
  const wrapped = t.match(/^\{\\displaystyle\s([\s\S]*)\}$/)
  if (wrapped) t = wrapped[1].trim()
  if (t.startsWith("\\displaystyle")) t = t.slice("\\displaystyle".length).trim()
  // LaTeXML alttext carries line-continuation comments from the source
  t = t.replace(/%\s*\n\s*/g, "")
  // Equation labels are document plumbing, not math
  t = t.replace(/\\label\{[^}]*\}/g, "")
  return stripTrailingPunctuation(t.trim())
}

// Display equations routinely end in sentence punctuation carried inside the
// math ("\tilde{F}_{5}=\star\tilde{F}_{5}\,." — a quarter of the alttexts on a
// real arXiv HTML page). That is prose, not math; strip it token-wise. The one
// guard: a trailing "." can be a null delimiter (\right. / \Big.), and
// stripping it would unbalance the math — leave those alone.
function stripTrailingPunctuation(tex: string): string {
  // Whitespace is a token here, NOT pre-trimmed: trimming inside the loop
  // would split the two-character "\ " control-space and leave a dangling
  // backslash. The alternation prefers the longer "\<char>" match.
  let t = tex.trimEnd()
  for (;;) {
    const m = t.match(/(\\(?:quad|qquad)|\\[,;:! ]|[.,;:~]|\s)$/)
    if (!m) return t
    if (m[0] === "." && /\\(?:[Bb]igg?[lrm]?|right|left)$/.test(t.slice(0, -1))) return t
    t = t.slice(0, t.length - m[0].length)
  }
}

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
  const push = (c: MathCandidate) => {
    if (seen.has(c.displayEl)) return
    seen.add(c.displayEl)
    out.push(c)
  }

  for (const el of root.querySelectorAll("math")) {
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
        (mweWrapper?.getAttribute("class") ?? "").includes("-display"),
      el,
      displayEl: katexWrapper ?? mweWrapper ?? el,
    })
  }

  for (const el of root.querySelectorAll('script[type^="math/tex"]')) {
    const tex = el.textContent
    if (!tex || tex.trim() === "") continue
    const type = el.getAttribute("type") ?? ""
    // MathJax v2 renders into a sibling span/div placed just before the script.
    const sib = el.previousElementSibling
    push({
      tex: normalizeTex(tex),
      via: "mathjax2-script",
      display: type.includes("mode=display"),
      el,
      displayEl: sib ?? el,
    })
  }

  return out
}
