// TeX's \over, as Wikipedia prints it, in front of the frozen engine.
import test, { describe } from "node:test"
import assert from "node:assert"
import katex from "katex"
import { findRegistryForSlug, translateTex } from "./unitsEngine"
import { foldRows, lhsOf, overToFrac, splitStatements } from "./tex"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const SI = { system: "si", geometrized: false } as const

describe("overToFrac", () => {
  test("a braced \\over becomes the same group with \\frac", () => {
    assert.strictEqual(overToFrac("{8\\pi G \\over c^{4}}"), "{\\frac{8\\pi G}{c^{4}}}")
    assert.strictEqual(overToFrac("x = {a \\over b} + {c \\over d}"), "x = {\\frac{a}{b}} + {\\frac{c}{d}}")
    assert.strictEqual(overToFrac("{{a \\over b} \\over c}"), "{\\frac{{\\frac{a}{b}}}{c}}")
  })
  test("\\overline, escaped braces and a top-level \\over are left alone", () => {
    assert.strictEqual(overToFrac("\\overline{x} + \\overset{a}{b}"), "\\overline{x} + \\overset{a}{b}")
    assert.strictEqual(overToFrac("\\{a \\over b\\}"), "\\{a \\over b\\}")
    assert.strictEqual(overToFrac("a \\over b"), "a \\over b")
    assert.strictEqual(overToFrac("E = mc^{2}"), "E = mc^{2}")
  })
  test("rows of an equation group fold into statements: continuations join, a leading relation restates the left side", () => {
    assert.deepStrictEqual(
      foldRows(["s^{2} = (\\Delta x)^{T}\\eta(\\Delta x)", "= (\\Delta x')^{T}\\eta(\\Delta x')", "= (\\Delta x)^{T}\\Lambda^{T}\\eta\\Lambda(\\Delta x)"]).map((s) => s.tex),
      [
        "s^{2} = (\\Delta x)^{T}\\eta(\\Delta x)",
        "s^{2} = (\\Delta x')^{T}\\eta(\\Delta x')",
        "s^{2} = (\\Delta x)^{T}\\Lambda^{T}\\eta\\Lambda(\\Delta x)",
      ],
    )
    const folded = foldRows(["E =", "m c^{2} +", "p c", "", "= H"])
    assert.deepStrictEqual(folded.map((s) => s.tex), ["E = m c^{2} + p c", "E = H"])
    assert.deepStrictEqual(folded.map((s) => s.rows), [[0, 1, 2], [4]])
    assert.deepStrictEqual(foldRows(["a = b", "- c = d"]).map((s) => s.tex), ["a = b - c = d"])
    assert.strictEqual(lhsOf("x_{a=1} = y"), "x_{a=1}")
    assert.strictEqual(lhsOf("f(a=b) \\leq g"), "f(a=b)")
    assert.strictEqual(lhsOf("\\left( a \\right)"), null)
  })
  test("a line holding several statements splits at and, a semicolon, a \\qquad, or a \\quad between relations", () => {
    assert.deepStrictEqual(splitStatements("D=26\\ \\ \\ {\\rm and}\\ \\ \\ a=1"), ["D=26", "a=1"])
    assert.deepStrictEqual(splitStatements("p(d\\mid H_0)=p_0(d)\\quad\\text{and}\\quad p(d\\mid H_1)=p_1(d)"), [
      "p(d\\mid H_0)=p_0(d)",
      "p(d\\mid H_1)=p_1(d)",
    ])
    assert.deepStrictEqual(splitStatements("r_s = 2M;\\qquad T_H = \\frac{1}{8\\pi M}"), ["r_s = 2M", "T_H = \\frac{1}{8\\pi M}"])
    assert.deepStrictEqual(splitStatements("a = b \\quad c = d"), ["a = b", "c = d"])
    // A comma set off by explicit spacing on both sides joins two statements; a bare comma never splits.
    assert.deepStrictEqual(splitStatements("\\vec{dl}_{1}=\\frac{\\partial\\vec{X}}{\\partial\\sigma}\\ \\ \\ ,\\ \\ \\ \\vec{dl}_{2}=\\frac{\\partial\\vec{X}}{\\partial\\tau}"), [
      "\\vec{dl}_{1}=\\frac{\\partial\\vec{X}}{\\partial\\sigma}",
      "\\vec{dl}_{2}=\\frac{\\partial\\vec{X}}{\\partial\\tau}",
    ])
    assert.deepStrictEqual(splitStatements("f(x, y) = g(y), h = 2"), ["f(x, y) = g(y), h = 2"])
  })
  test("the engine's statement layer is looser than this splitter, and splits what it keeps whole", () => {
    // splitStatements wants spacing on both sides of a comma, and splits wide
    // space only at \quad and \qquad; the engine splits a comma followed by
    // any spacing, a run of spacing a quad wide, and a logical connective.
    // A line kept whole here reaches the engine whole, and is split there.
    for (const [tex, restored] of [
      ["r_s = 2M,\\; t = 0", "r_{s} = \\frac{2GM}{c^{2}}, \\; t = 0"],
      ["t = 0 ~~~~ r = 2M", "t = 0 ~~~~ r = \\frac{2GM}{c^{2}}"],
      ["r_s = 2M,\\mkern18mu t = 0", "r_{s} = \\frac{2GM}{c^{2}}, \\mkern18mu t = 0"],
      ["M \\neq 0 \\implies r_s = 2M", "M \\neq 0 \\implies r_{s} = \\frac{2GM}{c^{2}}"],
    ]) {
      assert.deepStrictEqual(splitStatements(tex), [tex])
      const result = translateTex(tex, katex, GR, SI)
      assert.ok(result.kind === "translated" && result.restoredTex === restored, `${tex} → ${JSON.stringify(result)}`)
      assert.ok(result.kind === "translated" && result.statementUnitTex?.length === 2, tex)
    }
  })
  test("a comma between two order relations stays whole, and the engine declines it as a list", () => {
    // `0 < t,\quad r < 2M` puts t and r both in (0, 2M): split, t took the
    // bound of r. The comma may stand in the separator or beside it.
    for (const tex of [
      "0 < t,\\quad r < 2M",
      "0 < t, \\qquad r < 2M",
      "0 < t\\ \\ ,\\ \\ r < 2M",
      "-M < r ,\\quad t < M",
      "0 \\le r \\quad , \\quad t \\le 2M",
    ]) {
      assert.deepStrictEqual(splitStatements(tex), [tex])
      const result = translateTex(tex, katex, GR, SI)
      assert.ok(
        result.kind === "declined" && result.reasons[0] === "lists or multiple statements — select a single equation",
        `${tex} → ${JSON.stringify(result)}`,
      )
    }
    // A semicolon lists no terms, nor does a comma with an equality beside it.
    assert.deepStrictEqual(splitStatements("0 < t;\\qquad r < 2M"), ["0 < t", "r < 2M"])
    assert.deepStrictEqual(splitStatements("0 < t,\\quad r = 2M"), ["0 < t", "r = 2M"])
    assert.deepStrictEqual(splitStatements("r_s = 2M,\\qquad t > 0"), ["r_s = 2M", "t > 0"])
  })
  test("what is not several statements stays whole: tuples, index ranges, a qualifier with no relation, a matrix", () => {
    assert.deepStrictEqual(splitStatements("X^{\\mu}=(t,\\vec{x})"), ["X^{\\mu}=(t,\\vec{x})"])
    assert.deepStrictEqual(splitStatements("\\mu=0,\\ldots,D-1"), ["\\mu=0,\\ldots,D-1"])
    assert.deepStrictEqual(splitStatements("X^{\\mu}(\\sigma,\\tau)\\qquad \\mu=0"), ["X^{\\mu}(\\sigma,\\tau)\\qquad \\mu=0"])
    assert.deepStrictEqual(splitStatements("f(x) \\quad x > 0"), ["f(x) \\quad x > 0"])
    assert.deepStrictEqual(splitStatements("E = mc^{2}"), ["E = mc^{2}"])
    assert.deepStrictEqual(splitStatements("M = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"), ["M = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"])
  })
  test("an aligned environment is an equation group: rows folded, alignment marks dropped, a nested matrix left intact", () => {
    assert.deepStrictEqual(splitStatements("{\\begin{aligned} G_{ab} &= 8\\pi T_{ab} \\\\ &= \\kappa T_{ab} \\end{aligned}}"), [
      "G_{ab} = 8\\pi T_{ab}",
      "G_{ab} = \\kappa T_{ab}",
    ])
    assert.deepStrictEqual(splitStatements("\\begin{aligned} a &= b + \\\\ &\\quad c \\\\ d &= e \\end{aligned}"), ["a = b + c", "d = e"])
    assert.deepStrictEqual(splitStatements("\\begin{aligned} M &= \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix} \\\\ N &= 2 \\end{aligned}"), [
      "M = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}",
      "N = 2",
    ])
  })
  test("the Arabic Wikipedia field equation, printed with \\over, translates once rewritten", () => {
    const printed = "G_{\\mu \\nu }+\\Lambda g_{\\mu \\nu }={8\\pi G \\over c^{4}}T_{\\mu \\nu }"
    // The engine's emitter does not reproduce \over: the masked re-emission
    // check fails and the equation is declined as a reassembly fault.
    assert.strictEqual(translateTex(printed, katex, GR, SI).kind, "declined")
    const r = translateTex(overToFrac(printed), katex, GR, SI)
    assert.strictEqual(r.kind, "translated", JSON.stringify(r))
    assert.ok(r.kind === "translated" && !r.changed) // already in SI form
  })
})
