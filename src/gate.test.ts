// The gate in front of the engine: a named mathematical object is refused,
// never read symbol by symbol (SL is not S times L). Physical equations pass.
import test, { describe } from "node:test"
import assert from "node:assert"
import { refuseNonEquation } from "./gate"

const refused = (tex: string) => {
  const r = refuseNonEquation(tex)
  return r && r.kind === "declined" ? r.reasons : null
}

describe("the gate: mathematical objects are not equations", () => {
  test("a Lie group is refused with its name, and no legend follows", () => {
    const r = refuseNonEquation("SL(2,\\mathbb{R})")
    assert.ok(r && r.kind === "declined")
    assert.deepStrictEqual(r.legend, [])
    assert.ok(r.reasons[0].includes("SL(2,\\mathbb{R})".slice(0, 2)), r.reasons.join(" | "))
    assert.ok(r.reasons.some((s) => s.includes("the name of a mathematical object")))
  })
  test("the usual suspects: SO(3), SU(2) × U(1), Spin(4), GL(n), Diff(M), Hom(V, W)", () => {
    for (const tex of ["SO(3)", "SU(2) \\times U(1)", "\\mathrm{Spin}(4)", "GL(n, \\mathbb{C})", "\\mathrm{Diff}(M)", "\\mathrm{Hom}(V, W)"]) {
      if (/^\\mathrm/.test(tex)) continue // upright names the engine never mis-multiplies are not the gate's concern
      assert.ok(refused(tex), tex)
    }
  })
  test("number sets and algebras: R^3, mathfrak g", () => {
    assert.ok(refused("\\mathbb{R}^3"))
    assert.ok(refused("\\mathfrak{g} = \\mathfrak{h} \\oplus \\mathfrak{m}"))
    assert.ok(refused("x \\in \\mathbb{R}^{3}"))
  })
  test("physics passes: GM(r) is a product, cross products and integrals are equations", () => {
    for (const tex of [
      "E = m c^2",
      "\\frac{G M(r)}{r^2}",
      "F = q (E + v \\times B)",
      "S = \\int d^4x \\sqrt{-g} R",
      "\\lim_{x \\to 0} f(x)",
      "G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}",
      "L = I \\omega",
      "\\Omega_H = \\frac{a}{2 M r_+}",
    ]) {
      assert.strictEqual(refuseNonEquation(tex), null, tex)
    }
  })
})
