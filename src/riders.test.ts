// Riders under the span rule (census §2.4): the rule itself, executable, plus
// the E&M 2×2 table as data assertions (census §10.3 named test 2).
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONVENTIONS, EM_RIDERS, activeRiders, riderActive } from "./convention"

describe("the span rule on riders (census §2.4)", () => {
  test("plain Gaussian (c not a generator): every c-rider is ACTIVE", () => {
    const active = activeRiders(CONVENTIONS["gaussian"], EM_RIDERS["gaussian"])
    const cSymbols = active.filter((r) => r.factorTex === "c").map((r) => r.symbol).sort()
    assert.deepStrictEqual(cSymbols, ["A", "B", "H", "M"])
  })

  test("geometrized-Gaussian (c IS a generator): every c-rider is suppressed — the solve supplies the c", () => {
    const active = activeRiders(CONVENTIONS["geometrized-gaussian"], EM_RIDERS["gaussian"])
    assert.strictEqual(active.filter((r) => r.factorTex === "c").length, 0)
  })

  test("dimensionless 4π-riders are active under EVERY convention (never in any span)", () => {
    for (const key of ["gaussian", "geometrized-gaussian", "planck-gaussian", "si"]) {
      const active = activeRiders(CONVENTIONS[key], EM_RIDERS["gaussian"])
      const fourPi = active.filter((r) => r.factorTex === "4\\pi").map((r) => r.symbol).sort()
      assert.deepStrictEqual(fourPi, ["D", "H"], `4π-riders under ${key}`)
    }
  })

  test("Heaviside–Lorentz rendering carries c-riders but no 4π-riders (rationalized)", () => {
    const riders = EM_RIDERS["heaviside-lorentz"]
    assert.ok(riders.every((r) => r.factorTex === "c"))
    assert.strictEqual(riderActive(CONVENTIONS["heaviside-lorentz"], riders[0]), true)
    // Under geometrized-HL, c is restored and the rider suppresses:
    assert.strictEqual(riderActive(CONVENTIONS["geometrized-hl"], riders[0]), false)
  })
})

describe("the E&M 2×2 table (census §2.4 / §10.3 test 2)", () => {
  test("H carries BOTH rider classes; M carries only the c-rider (H = B − 4πM composition)", () => {
    const gauss = EM_RIDERS["gaussian"]
    const on = (sym: string) => gauss.filter((r) => r.symbol === sym).map((r) => r.factorTex).sort()
    assert.deepStrictEqual(on("H"), ["4\\pi", "c"])
    assert.deepStrictEqual(on("M"), ["c"])
  })

  test("SI = (no, no); HL = (c, no); ESU/EMU = (no, 4π); Gaussian = (c, 4π)", () => {
    const classes = (key: string) => ({
      c: EM_RIDERS[key].some((r) => r.factorTex === "c"),
      fourPi: EM_RIDERS[key].some((r) => r.factorTex === "4\\pi"),
    })
    assert.deepStrictEqual(classes("si"), { c: false, fourPi: false })
    assert.deepStrictEqual(classes("heaviside-lorentz"), { c: true, fourPi: false })
    assert.deepStrictEqual(classes("esu"), { c: false, fourPi: true })
    assert.deepStrictEqual(classes("emu"), { c: false, fourPi: true })
    assert.deepStrictEqual(classes("gaussian"), { c: true, fourPi: true })
  })

  test("Gaussian and ESU share the generator and differ ONLY in the c-riders (census §6.3)", () => {
    assert.deepStrictEqual(
      CONVENTIONS["gaussian"].generators,
      CONVENTIONS["esu"].generators,
    )
    const gaussOnly = EM_RIDERS["gaussian"].filter(
      (r) => !EM_RIDERS["esu"].some((s) => s.symbol === r.symbol && s.factorTex === r.factorTex),
    )
    assert.ok(gaussOnly.length > 0)
    assert.ok(gaussOnly.every((r) => r.factorTex === "c"))
  })
})
