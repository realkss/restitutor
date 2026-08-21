// The round-5 kernel battery (docs/data/kernel_test.py, 15/15) ported to the
// TypeScript convention layer. These are census-named regressions: §10.3,
// §2.3 (rank bookkeeping), §2.4 (span rule), §2.9 (converter graph ≠ basis).
import test, { describe } from "node:test"
import assert from "node:assert"
import {
  CONST_DIM,
  CONVENTIONS,
  Convention,
  DimQ,
  Frac,
  dimQ,
  solveRestoration,
  validateConvention,
} from "./convention"

const conv = (name: string, gens: [string, DimQ][], symmetryOverride?: string): Convention => ({
  name,
  generators: gens.map(([tex, dim]) => ({
    tex,
    dim,
    numericFactor: "1",
    emits: tex,
    kind: "theory_scale" as const,
  })),
  symmetryOverride,
})

const E_SI = dimQ(1, 1, -3, 0, -1)
const B_SI = dimQ(1, 0, -2, 0, -1)
const dimSub = (a: DimQ, b: DimQ) => a.map((x, i) => x.sub(b[i])) as DimQ

describe("rank bookkeeping (census §2.3)", () => {
  test("{t, J} is over-determined and the implied group is NAMED", () => {
    const energy = dimQ(1, 2, -2, 0, 0)
    const v = validateConvention(conv("t=J=1", [["t", energy], ["J", energy]]))
    assert.strictEqual(v.kind, "over-determined")
    assert.strictEqual(v.impliedGroups.length, 1)
    // t^{-1}·J = 1 (equivalently J/t = 1) — the physics claim, named.
    assert.match(v.impliedGroups[0], /t.*J.*= 1|J.*t.*= 1/)
  })

  test("{ħ, k_B, a, e} is well-posed but residual rank 1 (no energy scale)", () => {
    const v = validateConvention(
      conv("cm-declaration", [
        ["\\hbar", CONST_DIM.hbar],
        ["k_B", CONST_DIM.kB],
        ["a", dimQ(0, 1, 0, 0, 0)],
        ["e", CONST_DIM.e],
      ]),
    )
    assert.strictEqual(v.kind, "well-posed")
    assert.strictEqual(v.residualRank, 1)
  })

  test("{L, U, ν} is over-determined and the implied group is the Reynolds combination", () => {
    const v = validateConvention(
      conv("NS over-declared", [
        ["L", dimQ(0, 1, 0, 0, 0)],
        ["U", dimQ(0, 1, -1, 0, 0)],
        ["\\nu", dimQ(0, 2, -1, 0, 0)],
      ]),
    )
    assert.strictEqual(v.kind, "over-determined")
    assert.match(v.impliedGroups[0], /L.*U.*\\nu/)
  })

  test("symmetry override is carried through (ideal-GRMHD case)", () => {
    const mass = dimQ(1, 0, 0, 0, 0)
    const v = validateConvention(
      conv("GRMHD two mass scales", [["M_{\\rm BH}", mass], ["\\mathcal{M}_{\\rm unit}", mass]], "ideal-GRMHD density-rescaling symmetry"),
    )
    assert.strictEqual(v.kind, "over-determined")
    assert.strictEqual(
      v.kind === "over-determined" && v.symmetryOverride,
      "ideal-GRMHD density-rescaling symmetry",
    )
  })
})

describe("residual-rank ladder (census §1.6)", () => {
  const ladder: [string, number][] = [
    ["c=1 only", 4],
    ["geometrized", 3],
    ["hep-hl", 1],
    ["planck-gaussian", 0],
  ]
  const conventions: Record<string, Convention> = {
    "c=1 only": conv("c=1", [["c", CONST_DIM.c]]),
    geometrized: CONVENTIONS["geometrized"],
    "hep-hl": CONVENTIONS["hep-hl"],
    "planck-gaussian": CONVENTIONS["planck-gaussian"],
  }
  for (const [name, expected] of ladder) {
    test(`${name} → residual rank ${expected}`, () => {
      const v = validateConvention(conventions[name])
      assert.strictEqual(v.residualRank, expected)
    })
  }

  test("Kolb–Turner keeps G: residual rank 2 differs from reduced-Planck's 1", () => {
    assert.strictEqual(validateConvention(CONVENTIONS["kolb-turner"]).residualRank, 2)
    assert.strictEqual(validateConvention(CONVENTIONS["reduced-planck"]).residualRank, 1)
  })
})

describe("the span rule (census §2.4)", () => {
  test("light-wave [E]/[B] restores c¹ when c is a generator", () => {
    const s = solveRestoration(CONVENTIONS["geometrized"], dimSub(E_SI, B_SI))
    assert.strictEqual(s.kind, "unique")
    if (s.kind === "unique") {
      assert.strictEqual(s.exponents.length, 1)
      assert.strictEqual(s.exponents[0].generator.tex, "c")
      assert.ok(s.exponents[0].power.eq(Frac.of(1)))
    }
  })

  test("the same restoration under a 4πε₀-only set is INCONSISTENT (decline, hint hidden c)", () => {
    const only4pe = conv("4πε₀ only", [["4\\pi\\varepsilon_0", CONST_DIM.eps0]])
    assert.strictEqual(solveRestoration(only4pe, dimSub(E_SI, B_SI)).kind, "inconsistent")
  })
})

describe("uniqueness theorem and non-bases (census §2.9)", () => {
  test("c, G independent; c, G, ħ independent (unique restorations)", () => {
    assert.strictEqual(validateConvention(CONVENTIONS["geometrized"]).kind, "well-posed")
    const cgh = conv("cGh", [
      ["c", CONST_DIM.c],
      ["G", CONST_DIM.G],
      ["\\hbar", CONST_DIM.hbar],
    ])
    assert.strictEqual(validateConvention(cgh).kind, "well-posed")
  })

  test("{hc, h, ħ, k_B} is DEPENDENT — a converter graph, not a generator basis", () => {
    const hc = dimQ(1, 3, -1, 0, 0)
    const v = validateConvention(
      conv("spectroscopic", [
        ["hc", hc],
        ["h", CONST_DIM.hbar],
        ["\\hbar", CONST_DIM.hbar],
        ["k_B", CONST_DIM.kB],
      ]),
    )
    assert.strictEqual(v.kind, "over-determined")
    assert.strictEqual(v.rank, 3)
  })

  test("Hartree and Rydberg generator sets are both well-posed rank 4 (the factor 2 is invisible, as it must be)", () => {
    const h = validateConvention(CONVENTIONS["hartree"])
    const r = validateConvention(CONVENTIONS["rydberg"])
    assert.strictEqual(h.kind, "well-posed")
    assert.strictEqual(r.kind, "well-posed")
    assert.strictEqual(h.rank, 4)
    assert.strictEqual(r.rank, 4)
  })
})

describe("numeric regressions (census §10.3)", () => {
  test("1 T = 10⁴ G including the kg·m→g·cm base conversion; skipping it errs by ~3.16", () => {
    const mu0 = 4 * Math.PI * 1e-7
    const withBase = Math.sqrt((4 * Math.PI) / mu0) * Math.sqrt(1000) / Math.sqrt(100)
    assert.ok(Math.abs(withBase - 1e4) / 1e4 < 1e-12)
    const withoutBase = Math.sqrt((4 * Math.PI) / mu0)
    assert.ok(Math.abs(withoutBase - 3162.2776) < 1e-3)
  })

  test("μ_unrat · ε_unrat = 1/c²", () => {
    const mu0 = 4 * Math.PI * 1e-7
    const eps0 = 8.8541878128e-12
    const c = 2.99792458e8
    const lhs = (mu0 / (4 * Math.PI)) * (4 * Math.PI * eps0)
    assert.ok(Math.abs(lhs - 1 / c ** 2) / (1 / c ** 2) < 1e-9)
  })
})
