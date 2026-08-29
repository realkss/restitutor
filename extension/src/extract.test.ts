// Extraction-adapter tests: structural stubs stand in for DOM elements, so the
// adapters run under node:test with no DOM implementation.
import test, { describe } from "node:test"
import assert from "node:assert"
import { MathCandidate, MinimalEl, normalizeTex, scanForMath, texFromMathEl } from "./extract"

type StubInit = {
  tagName?: string
  attrs?: Record<string, string>
  text?: string | null
  children?: Record<string, Stub | null>
  closestMap?: Record<string, Stub | null>
  prevSibling?: Stub | null
}

class Stub implements MinimalEl {
  tagName: string
  private attrs: Record<string, string>
  textContent: string | null
  private children: Record<string, Stub | null>
  private closestMap: Record<string, Stub | null>
  previousElementSibling: Stub | null
  constructor(init: StubInit = {}) {
    this.tagName = init.tagName ?? "math"
    this.attrs = init.attrs ?? {}
    this.textContent = init.text ?? null
    this.children = init.children ?? {}
    this.closestMap = init.closestMap ?? {}
    this.previousElementSibling = init.prevSibling ?? null
  }
  getAttribute(name: string): string | null {
    return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null
  }
  querySelector(sel: string): Stub | null {
    return this.children[sel] ?? null
  }
  closest(sel: string): Stub | null {
    return this.closestMap[sel] ?? null
  }
}

const root = (byQuery: Record<string, Stub[]>) => ({
  querySelectorAll: (sel: string) => byQuery[sel] ?? [],
})

const ANN = 'annotation[encoding="application/x-tex"]'
const EINSTEIN = "G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}"

describe("normalizeTex", () => {
  test("unwraps Wikipedia's {\\displaystyle …} and a bare \\displaystyle prefix", () => {
    assert.strictEqual(normalizeTex(`{\\displaystyle ${EINSTEIN}}`), EINSTEIN)
    assert.strictEqual(normalizeTex(`\\displaystyle ${EINSTEIN}`), EINSTEIN)
  })
  test("strips \\label{} and LaTeXML line-continuation comments, keeps the math", () => {
    assert.strictEqual(normalizeTex("E = m c^{2} \\label{eq:emc}"), "E = m c^{2}")
    assert.strictEqual(normalizeTex("G_{ab} +%\n \\Lambda g_{ab}"), "G_{ab} +\\Lambda g_{ab}")
  })
  test("does not rewrite math it has no rule for", () => {
    assert.strictEqual(normalizeTex(`  ${EINSTEIN}  `), EINSTEIN)
  })
  test("strips trailing sentence punctuation token-wise (the arXiv \\,. pattern)", () => {
    // Real alttexts from the recon: a quarter of display equations end this way.
    assert.strictEqual(
      normalizeTex("\\tilde{F}_{5}=\\star\\tilde{F}_{5}\\,."),
      "\\tilde{F}_{5}=\\star\\tilde{F}_{5}",
    )
    assert.strictEqual(normalizeTex("s^{2}=(\\Delta x)^{2}\\ ."), "s^{2}=(\\Delta x)^{2}")
    assert.strictEqual(normalizeTex("E = m c^{2}\\qquad"), "E = m c^{2}")
    assert.strictEqual(normalizeTex("a = b ."), "a = b")
    assert.strictEqual(normalizeTex("a = b\\,;"), "a = b")
  })
  test("never strips a null delimiter's dot (\\right. / \\Big.), spaced or not", () => {
    assert.strictEqual(
      normalizeTex("f = \\left( \\frac{dg}{dx} \\right."),
      "f = \\left( \\frac{dg}{dx} \\right.",
    )
    assert.strictEqual(normalizeTex("x \\Big."), "x \\Big.")
    assert.strictEqual(normalizeTex("f = \\left( g \\right ."), "f = \\left( g \\right .")
    // …but punctuation AFTER a closed delimiter still goes:
    assert.strictEqual(normalizeTex("f = \\left( g \\right) ."), "f = \\left( g \\right)")
  })
  test("strips trailing ~ and never eats a row separator's backslash", () => {
    assert.strictEqual(normalizeTex("a \\sim b~"), "a \\sim b")
    // "x \\ ." ends in a ROW SEPARATOR + punctuation: the separator survives.
    assert.strictEqual(normalizeTex("x \\\\ ."), "x \\\\")
  })
  test("strips the whole leading sizing-directive family, not just \\displaystyle", () => {
    assert.strictEqual(normalizeTex(`\\textstyle ${EINSTEIN}`), EINSTEIN)
    assert.strictEqual(normalizeTex("\\scriptstyle n"), "n")
    assert.strictEqual(normalizeTex("\\scriptscriptstyle x + y"), "x + y")
  })
  test("the {\\displaystyle} unwrap refuses non-partner braces (never corrupts)", () => {
    // The opening brace closes BEFORE the end — unwrapping would unbalance it.
    const tricky = "{\\displaystyle \\frac{\\hbar}{2}}\\,\\mathrm{J\\,s}"
    assert.strictEqual(normalizeTex(tricky), tricky)
    assert.strictEqual(
      normalizeTex("{\\displaystyle x} \\cdot {\\displaystyle y}"),
      "{\\displaystyle x} \\cdot {\\displaystyle y}",
    )
  })
  test("an escaped \\% is a percent sign, not a comment", () => {
    assert.strictEqual(normalizeTex("x = 50\\%\n+ y"), "x = 50\\%\n+ y")
    // A doubled backslash before % is a row separator; the % IS a comment.
    assert.strictEqual(normalizeTex("a \\\\%\nb"), "a \\\\b")
  })
})

describe("texFromMathEl", () => {
  test("alttext wins (LaTeXML/ar5iv/Wikipedia) with provenance", () => {
    const el = new Stub({ attrs: { alttext: EINSTEIN } })
    assert.deepStrictEqual(texFromMathEl(el), { tex: EINSTEIN, via: "alttext" })
  })
  test("falls back to the x-tex annotation (KaTeX MathML)", () => {
    const el = new Stub({ children: { [ANN]: new Stub({ tagName: "annotation", text: EINSTEIN }) } })
    assert.deepStrictEqual(texFromMathEl(el), { tex: EINSTEIN, via: "mml-annotation" })
  })
  test("no deterministic carrier → null, never a guess", () => {
    assert.strictEqual(texFromMathEl(new Stub()), null)
    assert.strictEqual(texFromMathEl(new Stub({ attrs: { alttext: "   " } })), null)
  })
})

describe("scanForMath", () => {
  test("collects all three flavors with the right display targets", () => {
    const ar5iv = new Stub({ attrs: { alttext: EINSTEIN, display: "block" } })
    const katexWrapper = new Stub({ tagName: "span" })
    const katexMath = new Stub({
      children: { [ANN]: new Stub({ tagName: "annotation", text: "E = m c^{2}" }) },
      closestMap: { ".katex": katexWrapper },
    })
    const mjPreview = new Stub({ tagName: "div", attrs: { class: "MathJax_Display" } })
    const mjScript = new Stub({
      tagName: "script",
      attrs: { type: "math/tex; mode=display" },
      text: "ds^2 = -dt^2 + dr^2",
      prevSibling: mjPreview,
    })
    const found = scanForMath(
      root({ math: [ar5iv, katexMath], 'script[type^="math/tex"]': [mjScript] }),
    )
    assert.strictEqual(found.length, 3)
    const by = (via: string): MathCandidate => found.find((c) => c.via === via)!
    assert.strictEqual(by("alttext").tex, EINSTEIN)
    assert.strictEqual(by("alttext").display, true)
    assert.strictEqual(by("alttext").displayEl, ar5iv)
    assert.strictEqual(by("mml-annotation").displayEl, katexWrapper)
    assert.strictEqual(by("mathjax2-script").display, true)
    assert.strictEqual(by("mathjax2-script").displayEl, mjPreview)
  })
  test("Wikipedia math routes clicks to the .mwe-math-element wrapper", () => {
    // The wrapper holds BOTH the MathML and the SVG fallback image; which child
    // is visible varies by skin/browser, so the wrapper is the click target.
    // Production Wikipedia uses …-block (verified live); -display is legacy.
    const wrapper = new Stub({ tagName: "span", attrs: { class: "mwe-math-element mwe-math-element-block" } })
    const wikiMath = new Stub({
      attrs: { alttext: `{\\displaystyle ${EINSTEIN}}` },
      closestMap: { ".mwe-math-element": wrapper },
    })
    const [c] = scanForMath(root({ math: [wikiMath], 'script[type^="math/tex"]': [] }))
    assert.strictEqual(c.tex, EINSTEIN)
    assert.strictEqual(c.displayEl, wrapper)
    assert.strictEqual(c.display, true) // wrapper class says -block
  })
  test("KaTeX display nesting prefers .katex-display over the inner .katex", () => {
    const kd = new Stub({ tagName: "span", attrs: { class: "katex-display" } })
    const k = new Stub({ tagName: "span", attrs: { class: "katex" } })
    const el = new Stub({
      children: { [ANN]: new Stub({ tagName: "annotation", text: "x" }) },
      closestMap: { ".katex-display": kd, ".katex": k },
    })
    const [c] = scanForMath(root({ math: [el], 'script[type^="math/tex"]': [] }))
    assert.strictEqual(c.displayEl, kd)
    assert.strictEqual(c.display, true)
  })
  test("MathJax v2: an unrelated preceding element never becomes the click target", () => {
    const unrelated = new Stub({ tagName: "a", attrs: { class: "citation" } })
    const script = new Stub({
      tagName: "script",
      attrs: { type: "math/tex" },
      text: "E = m c^{2}",
      prevSibling: unrelated,
    })
    const [c] = scanForMath(root({ math: [], 'script[type^="math/tex"]': [script] }))
    assert.strictEqual(c.displayEl, script) // falls back to the script itself
  })
  test("deduplicates by visible element and skips empty carriers", () => {
    const wrapper = new Stub({ tagName: "span" })
    const twice = new Stub({
      children: { [ANN]: new Stub({ tagName: "annotation", text: "x" }) },
      closestMap: { ".katex": wrapper },
    })
    const empty = new Stub({ tagName: "script", attrs: { type: "math/tex" }, text: "  " })
    const found = scanForMath(
      root({ math: [twice, twice], 'script[type^="math/tex"]': [empty] }),
    )
    assert.strictEqual(found.length, 1)
  })
})
