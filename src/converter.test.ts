// Converter-graph tests: census-verified anchors, the reciprocal edge, and the
// medium-tag decline discipline (census §2.9, §5 round-3, §10.3 test 7).
import test, { describe } from "node:test"
import assert from "node:assert"
import { convert, knownUnits, CONSTANT_VINTAGE } from "./converter"
import { recognizeContractConstant, CONTRACT_CONSTANTS } from "./contract"

const ok = (r: ReturnType<typeof convert>): number => {
  assert.strictEqual(r.kind, "converted")
  return r.kind === "converted" ? r.value : NaN
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b)

describe("multiplicative edges (census-verified anchors)", () => {
  test("1 eV = 8065.5439 cm⁻¹", () => {
    assert.ok(rel(ok(convert(1, "eV", "cm^-1")), 8065.543937) < 1e-6)
  })
  test("1 K = 8.617333262×10⁻⁵ eV — and ×10⁻¹⁴ GeV, the census hep-notes anchor", () => {
    assert.ok(rel(ok(convert(1, "K", "eV")), 8.617333262e-5) < 1e-9)
    assert.ok(rel(ok(convert(1, "K", "GeV")), 8.617333262e-14) < 1e-9)
  })
  test("1 eV = 2.4179893×10¹⁴ Hz", () => {
    assert.ok(rel(ok(convert(1, "eV", "Hz")), 2.417989242e14) < 1e-8)
  })
  test("the ν/ω edge pair differs by exactly 2π (registry fork #10 as graph data)", () => {
    const hz = ok(convert(1, "eV", "Hz"))
    const rads = ok(convert(1, "eV", "rad/s"))
    assert.ok(rel(rads / hz, 2 * Math.PI) < 1e-12)
  })
  test("round trips are exact to machine precision", () => {
    for (const u of ["eV", "cm^-1", "K", "GHz", "rad/s"]) {
      assert.ok(rel(ok(convert(ok(convert(3.7, "eV", u)), u, "eV")), 3.7) < 1e-12, u)
    }
  })
})

describe("the reciprocal edge and the medium tag", () => {
  test("1550 nm vacuum = 0.7999 eV (the 1239.84198 eV·nm anchor)", () => {
    const v = ok(convert(1550, "nm", "eV", { medium: "vacuum" }))
    assert.ok(rel(v, 1239.84198 / 1550) < 1e-8)
  })
  test("a wavelength WITHOUT a medium tag declines — never a silent vacuum default", () => {
    const r = convert(1550, "nm", "eV")
    assert.strictEqual(r.kind, "declined")
    if (r.kind === "declined") assert.match(r.reason, /medium/)
  })
  test("medium air without the index declines, naming Edlén/Ciddor", () => {
    const r = convert(5000, "Å", "cm^-1", { medium: "air" })
    assert.strictEqual(r.kind, "declined")
    if (r.kind === "declined") assert.match(r.reason, /Edlén\/Ciddor/)
  })
  test("the census's own air example: 5000 Å air at n = 1.000279 → σ ≈ 19994.4 cm⁻¹", () => {
    const sigma = ok(convert(5000, "Å", "cm^-1", { medium: "air", airIndex: 1.000279 }))
    assert.ok(Math.abs(sigma - 19994.42) < 0.05)
    // …versus the naive vacuum reading 20000 cm⁻¹: the 5.6 cm⁻¹ the census calls
    // orders of magnitude above line-list precision.
    const naive = ok(convert(5000, "Å", "cm^-1", { medium: "vacuum" }))
    assert.ok(Math.abs(naive - 20000) < 1e-6)
  })
  test("energy → wavelength honors the medium tag too, and zero declines", () => {
    const nm = ok(convert(0.8, "eV", "nm", { medium: "vacuum" }))
    assert.ok(rel(nm, 1239.84198 / 0.8) < 1e-8)
    assert.strictEqual(convert(0, "eV", "nm", { medium: "vacuum" }).kind, "declined")
  })
  test("wavelength → wavelength is a pure prefix rescale: no medium needed, tag rides along", () => {
    // 5000 Å = 500 nm on EITHER side of the edge — the edge is never crossed.
    const r = convert(5000, "Å", "nm")
    assert.strictEqual(r.kind, "converted")
    if (r.kind === "converted") {
      assert.ok(rel(r.value, 500) < 1e-12)
      assert.strictEqual(r.medium, undefined) // no tag in, no tag invented
    }
    const tagged = convert(5000, "Å", "nm", { medium: "air" })
    if (tagged.kind === "converted") assert.strictEqual(tagged.medium, "air")
    else assert.fail("tagged rescale declined")
  })
  test("every emitted wavelength carries its medium stamp; emitted energies carry none", () => {
    const toNm = convert(0.8, "eV", "nm", { medium: "vacuum" })
    if (toNm.kind === "converted") assert.strictEqual(toNm.medium, "vacuum")
    else assert.fail("vacuum crossing declined")
    const toNmAir = convert(0.8, "eV", "nm", { medium: "air", airIndex: 1.000279 })
    if (toNmAir.kind === "converted") assert.strictEqual(toNmAir.medium, "air")
    else assert.fail("air crossing declined")
    const toEv = convert(1550, "nm", "eV", { medium: "vacuum" })
    if (toEv.kind === "converted") assert.ok(!("medium" in toEv && toEv.medium !== undefined))
    else assert.fail("wave→energy declined")
  })
  test("guards decline loudly: non-finite values, negative wavelengths, bad air indices", () => {
    assert.strictEqual(convert(NaN, "eV", "K").kind, "declined")
    assert.strictEqual(convert(Infinity, "nm", "eV", { medium: "vacuum" }).kind, "declined")
    assert.strictEqual(convert(-1550, "nm", "eV", { medium: "vacuum" }).kind, "declined")
    assert.strictEqual(convert(-0.8, "eV", "nm", { medium: "vacuum" }).kind, "declined")
    assert.strictEqual(convert(5000, "Å", "eV", { medium: "air", airIndex: 0.5 }).kind, "declined")
    assert.strictEqual(convert(5000, "Å", "eV", { medium: "air", airIndex: NaN }).kind, "declined")
  })
  test("'kayser' is an explicit alias of cm⁻¹, and bare 'K' stays kelvin (the census homograph gate)", () => {
    assert.strictEqual(ok(convert(1, "kayser", "eV")), ok(convert(1, "cm^-1", "eV")))
    // 1 K (kelvin) is ~8.6×10⁻⁵ eV; 1 kayser is ~1.24×10⁻⁴ eV — the homograph
    // would be a silent factor-of-1.44 error if "K" ever meant kayser.
    assert.ok(rel(ok(convert(1, "K", "eV")), 8.617333262e-5) < 1e-9)
  })
})

describe("graph hygiene", () => {
  test("unknown units decline by name", () => {
    const r = convert(1, "eV", "furlong")
    assert.strictEqual(r.kind, "declined")
  })
  test("the vintage is declared", () => {
    assert.match(CONSTANT_VINTAGE, /SI-2019/)
  })
  test("the unit list is nonempty and includes both sides of the reciprocal edge", () => {
    const units = knownUnits()
    assert.ok(units.includes("cm^-1") && units.includes("nm"))
  })
})

describe("the unit-contract detector (census §2.13(b) + C38)", () => {
  test("1.267 is recognized as 1/(4ħc) in the oscillation contract", () => {
    const m = recognizeContractConstant(1.267)
    assert.strictEqual(m.kind, "unit-contract")
    if (m.kind === "unit-contract") {
      assert.strictEqual(m.constant.meaning, "1/(4ħc)")
      assert.strictEqual(m.ruling, "suppress-lint-and-restoration")
    }
  })
  test("every curated constant is self-consistent numerically", () => {
    // Independent recomputation of each table value from the SI-2019 constants.
    const hbar_GeVs = 6.62607015e-34 / (2 * Math.PI) / 1.602176634e-10
    const hc_MeVfm = (6.62607015e-34 / (2 * Math.PI)) * 299792458 / 1.602176634e-13 / 1e-15
    const checks: Record<string, number> = {
      "ħ": hbar_GeVs,
      "ħc": hc_MeVfm,
      "(ħc)²": (hc_MeVfm / 1000) ** 2 * 10, // (GeV·fm)² → GeV²·mbarn (1 fm² = 10 mbarn)
      "c / 10⁹": 299792458 / 1e9,
      "hc": (6.62607015e-34 * 299792458) / 1.602176634e-19 / 1e-9, // eV·nm
      "1/(4ħc)": 1e-9 / (4 * ((6.62607015e-34 / (2 * Math.PI)) * 299792458) / 1.602176634e-19 / 1e3), // eV²·km/GeV contract
    }
    for (const c of CONTRACT_CONSTANTS) {
      const expected = checks[c.meaning]
      assert.ok(expected !== undefined, `no check for ${c.meaning}`)
      assert.ok(Math.abs(c.value - expected) / expected < 1e-6, `${c.meaning}: ${c.value} vs ${expected}`)
    }
  })
  test("an unremarkable decimal does not match", () => {
    assert.strictEqual(recognizeContractConstant(1.5).kind, "no-match")
    assert.strictEqual(recognizeContractConstant(3.14159).kind, "no-match")
  })
  test("PRINTED-LITERAL BATTERY: each row catches the rounded forms papers actually print", () => {
    // The review blocker: tolerances must be printed-truncation widths, not
    // CODATA widths — the table exists to catch these literals (§2.13(b)).
    const expectMatch: [number, string][] = [
      [1.27, "1/(4ħc)"],
      [1.267, "1/(4ħc)"],
      [0.2998, "c / 10⁹"],
      [0.29979, "c / 10⁹"],
      [0.3894, "(ħc)²"],
      [197.33, "ħc"],
      [197.3, "ħc"],
      [6.582e-25, "ħ"],
      [1239.84, "hc"],
      [1240, "hc"],
      [-1.27, "1/(4ħc)"], // sign is folded — a negated prefactor is the same contract
    ]
    for (const [literal, meaning] of expectMatch) {
      const m = recognizeContractConstant(literal)
      assert.strictEqual(m.kind, "unit-contract", `${literal} should match`)
      if (m.kind === "unit-contract") assert.strictEqual(m.constant.meaning, meaning, `${literal}`)
    }
    // Deliberate exclusion: a bare 0.3 is NOT evidence of magnetic rigidity.
    assert.strictEqual(recognizeContractConstant(0.3).kind, "no-match")
  })
})
