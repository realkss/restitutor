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
    assert.strictEqual(riders.length, 4)
    assert.ok(riders.every((r) => r.factorTex === "c"))
    const bRider = riders.find((r) => r.symbol === "B")!
    assert.strictEqual(riderActive(CONVENTIONS["heaviside-lorentz"], bRider), true)
    // Under geometrized-HL, c is restored and the rider suppresses:
    assert.strictEqual(riderActive(CONVENTIONS["geometrized-hl"], bRider), false)
  })

  test("ROUND-5 REFINEMENT: dimension-span alone never suppresses — the factor constant must itself be generated", () => {
    // Hartree spans velocity as e²/(4πε₀ħ) = αc — c is 137.036 in-system
    // (census §5 #9), so the c-riders must stay ACTIVE. Same for Rydberg
    // (αc/2), LJ (√(ε/m)), trap units (√(ħω/m)), and NS-inertial (U).
    const cRider = EM_RIDERS["gaussian"].find((r) => r.factorTex === "c" && r.symbol === "B")!
    for (const key of ["hartree", "rydberg", "lj-reduced", "trap-units", "ns-inertial"]) {
      assert.strictEqual(riderActive(CONVENTIONS[key], cRider), true, key)
    }
    // …while a convention that genuinely sets c = 1 still suppresses:
    assert.strictEqual(riderActive(CONVENTIONS["geometrized-gaussian"], cRider), false)
  })

  test("a factor reachable only as an absorbed COMBINATION does not suppress (numericFactor must be 1)", () => {
    // A convention whose only G-flavoured generator is 8πG: solving [G] returns
    // power 1 on that generator, but the generated constant is 8πG, not G.
    const gRider = {
      symbol: "X",
      factorTex: "G",
      factorDim: CONVENTIONS["geometrized"].generators[1].dim,
      direction: "multiply" as const,
    }
    assert.strictEqual(riderActive(CONVENTIONS["reduced-planck"], gRider), true)
    assert.strictEqual(riderActive(CONVENTIONS["geometrized"], gRider), false)
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

  test("rider directions match the census relations: B × c, A × c, H ÷ c, M ÷ c; D × 4π, H × 4π", () => {
    const dir = (key: string, sym: string, factor: string) =>
      EM_RIDERS[key].find((r) => r.symbol === sym && r.factorTex === factor)!.direction
    assert.strictEqual(dir("gaussian", "B", "c"), "multiply")
    assert.strictEqual(dir("gaussian", "A", "c"), "multiply")
    assert.strictEqual(dir("gaussian", "H", "c"), "divide")
    assert.strictEqual(dir("gaussian", "M", "c"), "divide")
    assert.strictEqual(dir("gaussian", "D", "4\\pi"), "multiply")
    assert.strictEqual(dir("gaussian", "H", "4\\pi"), "multiply")
  })

  test("EM_RIDERS covers exactly the five classical renderings", () => {
    assert.deepStrictEqual(Object.keys(EM_RIDERS).sort(), [
      "emu",
      "esu",
      "gaussian",
      "heaviside-lorentz",
      "si",
    ])
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
