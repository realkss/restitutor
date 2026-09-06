// TeX's \over, as Wikipedia prints it, in front of the frozen engine.
import test, { describe } from "node:test"
import assert from "node:assert"
import katex from "katex"
import { findRegistryForSlug, translateTex } from "./unitsEngine"
import { overToFrac } from "./tex"

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
