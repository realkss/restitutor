// Page declarations feeding the engine (census §6.5, stage 2): what the miner
// reads becomes a registry the engine translates with — the declaration wins,
// the legend says where the reading came from, the registry itself is never
// mutated, and the engine's own constants are never re-read.
import test, { describe } from "node:test"
import assert from "node:assert"
import katex from "katex"
import { findRegistryForSlug, translateTex } from "./unitsEngine"
import { definitionsFromEquations, dimQToDim, registryWithDeclarations, registryWithDefinitions } from "./bridge"
import { mineDeclarations } from "./mine"
import { dimQ } from "./convention"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const mined = (s: string) => mineDeclarations(s).symbols

describe("page declarations extend the registry", () => {
  test("twelfths: integer and half-integer exponents convert; a thirty-sixth does not", () => {
    assert.deepStrictEqual(dimQToDim(dimQ(1, [3, 2], -1, 0, 0)), [12, 18, -12, 0, 0])
    assert.strictEqual(dimQToDim(dimQ(0, [1, 36], 0, 0, 0)), null)
  })
  test("a symbol the registry lacks is read from the page, and the engine stops declining it", () => {
    const before = translateTex("\\sigma = \\pi r^2", katex, GR)
    assert.strictEqual(before.kind, "declined")
    const reg = registryWithDeclarations(GR, mined("where $\\sigma$ is the cross section of the target."))
    assert.notStrictEqual(reg, GR)
    const after = translateTex("\\sigma = \\pi r^2", katex, reg)
    assert.strictEqual(after.kind, "translated")
    assert.ok(after.kind === "translated" && after.legend.some((e) => e.gloss === "cross section (declared in the text)"))
  })
  test("a declared reading that differs from the registry's overrides it and says so", () => {
    const reg = registryWithDeclarations(GR, mined("Here $m$ is the comoving separation between the haloes."))
    assert.strictEqual(reg.bare.m.gloss, "length (declared in the text; the registry reads mass)")
    assert.deepStrictEqual(reg.bare.m.dim, [0, 12, 0, 0, 0])
    assert.strictEqual(GR.bare.m.gloss, "mass")
    const declared = translateTex("m = 2 r", katex, reg)
    assert.ok(declared.kind === "translated" && !declared.changed, JSON.stringify(declared))
    const plain = translateTex("m = 2 r", katex, GR)
    assert.ok(plain.kind === "translated" && plain.changed, JSON.stringify(plain))
  })
  test("the same reading as the registry adds nothing, and constants are never re-read", () => {
    const reg = registryWithDeclarations(
      GR,
      mined("where $M$ is the mass of the black hole and $c$ is the speed of light."),
    )
    assert.strictEqual(reg, GR)
  })
  test("a subscripted declaration is an exact reading; an index-like subscript also reads the base as indexed", () => {
    const reg = registryWithDeclarations(GR, mined("where $L_\\nu$ is the luminosity at 1.4 GHz."))
    assert.deepStrictEqual(reg.exact["L_\\nu"].dim, [12, 24, -36, 0, 0])
    assert.ok(reg.indexed.L)
    assert.strictEqual(GR.exact["L_\\nu"], undefined)
    // An ambiguous noun ("flux density": Jy, W m⁻², tesla) never reaches the registry.
    assert.strictEqual(registryWithDeclarations(GR, mined("where $S_\\nu$ is the flux density at 1.4 GHz.")), GR)
    const reg2 = registryWithDeclarations(GR, mined("where $m_1$ is the mass of the primary."))
    assert.deepStrictEqual(reg2.exact.m_1.dim, [12, 0, 0, 0, 0])
    assert.strictEqual(reg2.indexed.m, undefined)
    assert.strictEqual(reg2.bare.m.gloss, "mass")
  })
})

describe("page definitions extend the registry (the definitions path)", () => {
  const report = (s: string) => mineDeclarations(s)
  test("κ = 8πG/c⁴ takes the expression's dimension, and the field equation stops declining", () => {
    const before = translateTex("G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\kappa T_{\\mu\\nu}", katex, GR)
    assert.strictEqual(before.kind, "declined")
    const reg = registryWithDefinitions(
      GR,
      report("where $\\kappa = 8\\pi G/c^4$ is the Einstein gravitational constant."),
      katex,
    )
    assert.deepStrictEqual(reg.bare["\\kappa"].dim, [-12, -12, 24, 0, 0])
    assert.strictEqual(reg.bare["\\kappa"].gloss, "defined in the text; the registry reads surface gravity")
    assert.strictEqual(reg.bare["\\kappa"].si, "kg⁻¹ m⁻¹ s²")
    const after = translateTex("G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\kappa T_{\\mu\\nu}", katex, reg)
    assert.strictEqual(after.kind, "translated", JSON.stringify(after))
  })
  test("a dimensionless definition is a ratio, not a reading; a constant is never redefined", () => {
    const reg = registryWithDefinitions(GR, report("We define $\\eta = n_b/n_\\gamma$, the baryon-to-photon ratio."), katex)
    assert.strictEqual(reg.bare["\\eta"], GR.bare["\\eta"])
    const c = registryWithDefinitions(GR, report("We define $c = 3 \\times 10^8$."), katex)
    assert.strictEqual(c, GR)
  })
  test("a display equation defines a derived constant when its right side is constants alone (Wikipedia's κ)", () => {
    const eqs = [
      "\\kappa ={\\frac {8\\pi G}{c^{4}}}\\approx 2.07665\\times 10^{-43}\\,{\\textrm {N}}^{-1},",
      "E = m c^{2}",
      "G_{\\mu \\nu }+\\Lambda g_{\\mu \\nu }=\\kappa T_{\\mu \\nu },",
      "M_P = \\sqrt{\\hbar c / G}",
      "\\eta = 2 \\pi",
    ]
    const defs = definitionsFromEquations(eqs, GR, katex)
    assert.deepStrictEqual(defs.map((d) => d.symbol), ["\\kappa", "M_P"])
    assert.strictEqual(defs[0].expr, "{\\frac {8\\pi G}{c^{4}}}")
    const reg = registryWithDefinitions(GR, { symbols: [], definitions: defs }, katex)
    assert.deepStrictEqual(reg.bare["\\kappa"].dim, [-12, -12, 24, 0, 0])
    assert.deepStrictEqual(reg.exact.M_P.dim, [12, 0, 0, 0, 0])
    const after = translateTex("G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\kappa T_{\\mu\\nu}", katex, reg)
    assert.strictEqual(after.kind, "translated", JSON.stringify(after))
  })
  test("definitions apply in page order, so a later one may use an earlier one", () => {
    const reg = registryWithDefinitions(
      GR,
      report("We define $\\rho_c = 3 H^2 / (8\\pi G)$ as the critical density. We define $\\Omega = \\rho / \\rho_c$."),
      katex,
    )
    assert.deepStrictEqual(reg.exact["\\rho_c"].dim, [12, -36, 0, 0, 0])
    assert.strictEqual(reg.bare["\\Omega"], GR.bare["\\Omega"])
  })
})
