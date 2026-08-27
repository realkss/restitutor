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
    const mjPreview = new Stub({ tagName: "div" })
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
