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
