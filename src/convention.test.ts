// The round-5 kernel battery (docs/data/kernel_test.py, 15/15) ported to the
// TypeScript convention layer, extended per the phase-2 adversarial review:
// census-named regressions from §10.3, §2.3 (rank bookkeeping incl. the
// partial outcome), §2.4 (span rule), §2.9 (converter graph ≠ basis).
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
    role: "absorbed" as const,
  })),
  symmetryOverride,
})

const E_SI = dimQ(1, 1, -3, 0, -1)
const B_SI = dimQ(1, 0, -2, 0, -1)
const LENGTH = dimQ(0, 1, 0, 0, 0)
const MASS = dimQ(1, 0, 0, 0, 0)
const ENERGY = dimQ(1, 2, -2, 0, 0)
const dimSub = (a: DimQ, b: DimQ) => a.map((x, i) => x.sub(b[i])) as DimQ

describe("rank bookkeeping (census §2.3)", () => {
  test("{t, J} is over-determined and the implied group is NAMED exactly", () => {
    const v = validateConvention(conv("t=J=1", [["t", ENERGY], ["J", ENERGY]]))
    assert.strictEqual(v.kind, "over-determined")
    if (v.kind === "over-determined") {
      assert.deepStrictEqual(v.impliedGroups, ["t^{-1} \\cdot J = 1"])
    }
  })

  test("{ħ, k_B, a, e} is PARTIAL: independent, but residual rank 1 (no energy scale)", () => {
    const v = validateConvention(
      conv("cm-declaration", [
        ["\\hbar", CONST_DIM.hbar],
        ["k_B", CONST_DIM.kB],
        ["a", LENGTH],
        ["e", CONST_DIM.e],
      ]),
    )
    assert.strictEqual(v.kind, "partial")
    assert.strictEqual(v.residualRank, 1)
  })

  test("{L, U, ν} is over-determined and the implied group is exactly the Reynolds combination", () => {
    const v = validateConvention(
      conv("NS over-declared", [
        ["L", LENGTH],
        ["U", dimQ(0, 1, -1, 0, 0)],
        ["\\nu", dimQ(0, 2, -1, 0, 0)],
      ]),
    )
    assert.strictEqual(v.kind, "over-determined")
    if (v.kind === "over-determined") {
      assert.deepStrictEqual(v.impliedGroups, ["L^{-1} \\cdot U^{-1} \\cdot \\nu = 1"])
    }
  })

  test("over-determined groups are named by EMITS: the reduced-Planck 8πG beside a bare G is no tautology", () => {
    const withFactor: Convention = {
      name: "8πG=1 and G=1 together",
      generators: [
        { tex: "G", dim: CONST_DIM.G, numericFactor: "8\\pi", emits: "(8\\pi G)", kind: "fundamental_constant", role: "absorbed" },
        { tex: "G", dim: CONST_DIM.G, numericFactor: "1", emits: "G", kind: "fundamental_constant", role: "absorbed" },
      ],
    }
    const v = validateConvention(withFactor)
    assert.strictEqual(v.kind, "over-determined")
    if (v.kind === "over-determined") {
      // The named contradiction carries the 8π; naming by tex would print G⁻¹·G = 1.
      assert.deepStrictEqual(v.impliedGroups, ["(8\\pi G)^{-1} \\cdot G = 1"])
    }
  })

  test("symmetry override is carried through (ideal-GRMHD case)", () => {
    const v = validateConvention(
      conv(
        "GRMHD two mass scales",
        [["M_{\\rm BH}", MASS], ["\\mathcal{M}_{\\rm unit}", MASS]],
        "ideal-GRMHD density-rescaling symmetry",
      ),
    )
    assert.strictEqual(v.kind, "over-determined")
    assert.strictEqual(
      v.kind === "over-determined" && v.symmetryOverride,
      "ideal-GRMHD density-rescaling symmetry",
    )
  })

  test("a dimensionless generator is rejected outright (the N_A = 1 absurdity)", () => {
    assert.throws(
      () => validateConvention(conv("bad", [["N_A", dimQ(0, 0, 0, 0, 0)]])),
      /dimensionless generator "N_A"/,
    )
  })
})

describe("all shipped conventions: full validation records (census §1.6 ladder and §3 rows)", () => {
  const EXPECT: Record<string, { kind: string; n: number; rank: number; residual: number }> = {
    "geometrized": { kind: "partial", n: 2, rank: 2, residual: 3 },
    "geometrized-gaussian": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "hep-hl-kb": { kind: "partial", n: 4, rank: 4, residual: 1 },
    "reduced-planck": { kind: "partial", n: 4, rank: 4, residual: 1 },
    "kolb-turner": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "planck-gaussian": { kind: "well-posed", n: 5, rank: 5, residual: 0 },
    "hartree": { kind: "partial", n: 4, rank: 4, residual: 1 },
    "rydberg": { kind: "partial", n: 4, rank: 4, residual: 1 },
    // classical E&M family — the SI baseline is the zero-generator identity
    "si": { kind: "partial", n: 0, rank: 0, residual: 5 },
    "gaussian": { kind: "partial", n: 1, rank: 1, residual: 4 },
    "esu": { kind: "partial", n: 1, rank: 1, residual: 4 },
    "emu": { kind: "partial", n: 1, rank: 1, residual: 4 },
    "heaviside-lorentz": { kind: "partial", n: 1, rank: 1, residual: 4 },
    // natural units
    "c-only": { kind: "partial", n: 1, rank: 1, residual: 4 },
    "hep-hl": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "gaussian-natural": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "planck-hl": { kind: "well-posed", n: 5, rank: 5, residual: 0 },
    "classical-kappa": { kind: "partial", n: 2, rank: 2, residual: 3 },
    "sixteen-pi-g": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "string-alpha-prime": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "lattice": { kind: "partial", n: 3, rank: 3, residual: 2 },
    // GR / astro
    "bh-scale": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "nr-code": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "geometrized-hl": { kind: "partial", n: 3, rank: 3, residual: 2 },
    // atomic / statistical
    "dirac-atomic": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "kb-only": { kind: "partial", n: 1, rank: 1, residual: 4 },
    // nondimensionalization presets
    "lj-reduced": { kind: "partial", n: 4, rank: 4, residual: 1 },
    "chaos-mw": { kind: "partial", n: 2, rank: 2, residual: 3 },
    "trap-units": { kind: "partial", n: 3, rank: 3, residual: 2 },
    "ns-inertial": { kind: "partial", n: 3, rank: 3, residual: 2 },
  }
  test("every shipped convention has an expectation and vice versa", () => {
    assert.deepStrictEqual(Object.keys(CONVENTIONS).sort(), Object.keys(EXPECT).sort())
  })
  for (const [key, e] of Object.entries(EXPECT)) {
    test(`${key}: ${e.kind}, n=${e.n}, rank=${e.rank}, residual ${e.residual}`, () => {
      const v = validateConvention(CONVENTIONS[key])
      assert.strictEqual(v.kind, e.kind)
      assert.strictEqual(v.generatorCount, e.n)
      assert.strictEqual(v.rank, e.rank)
      assert.strictEqual(v.residualRank, e.residual)
    })
  }
  test("Kolb–Turner keeps G: its residual 2 vs reduced-Planck's 1 is the discriminating gap", () => {
    assert.strictEqual(validateConvention(CONVENTIONS["kolb-turner"]).residualRank, 2)
    assert.strictEqual(validateConvention(CONVENTIONS["reduced-planck"]).residualRank, 1)
  })
  test("c=1 alone is partial with residual 4", () => {
    const v = validateConvention(conv("c=1", [["c", CONST_DIM.c]]))
    assert.strictEqual(v.kind, "partial")
    assert.strictEqual(v.residualRank, 4)
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

describe("restoration solve: exact exponents and non-unique branch", () => {
  test("reduced-Planck length restores half-integer powers: √(8πGħ/c³) = √(8π)·l_P", () => {
    const s = solveRestoration(CONVENTIONS["reduced-planck"], LENGTH)
    assert.strictEqual(s.kind, "unique")
    if (s.kind === "unique") {
      const byTex = Object.fromEntries(s.exponents.map((e) => [e.generator.tex, e.power]))
      assert.ok(byTex["\\hbar"].eq(Frac.of(1, 2)))
      assert.ok(byTex["c"].eq(Frac.of(-3, 2)))
      assert.ok(byTex["G"].eq(Frac.of(1, 2)))
      assert.strictEqual(byTex["k_B"], undefined)
      // The emitted combination carries the 8π the solve cannot see:
      const gG = s.exponents.find((e) => e.generator.tex === "G")!
      assert.strictEqual(gG.generator.emits, "(8\\pi G)")
    }
  })

  test("a dependent generator set yields non-unique for in-span targets, inconsistent for out-of-span", () => {
    const lun = conv("L,U,ν", [
      ["L", LENGTH],
      ["U", dimQ(0, 1, -1, 0, 0)],
      ["\\nu", dimQ(0, 2, -1, 0, 0)],
    ])
    assert.strictEqual(solveRestoration(lun, LENGTH).kind, "non-unique")
    assert.strictEqual(solveRestoration(lun, MASS).kind, "inconsistent")
  })
})

describe("uniqueness theorem and non-bases (census §2.9)", () => {
  test("c, G and c, G, ħ are independent (unique restorations exist; both partial over 5 dims)", () => {
    assert.strictEqual(validateConvention(CONVENTIONS["geometrized"]).kind, "partial")
    const cgh = conv("cGh", [
      ["c", CONST_DIM.c],
      ["G", CONST_DIM.G],
      ["\\hbar", CONST_DIM.hbar],
    ])
    const v = validateConvention(cgh)
    assert.strictEqual(v.kind, "partial")
    assert.strictEqual(v.rank, 3)
  })

  test("{hc, h, ħ, k_B} is DEPENDENT — a converter graph, not a generator basis", () => {
    const hc = dimQ(1, 3, -2, 0, 0) // [h] + [c] = (1,2,−1) + (0,1,−1)
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
})

describe("dimQ construction", () => {
  test("pads short inputs and rejects over-length inputs", () => {
    assert.deepStrictEqual(
      dimQ(1).map((f) => f.toString()),
      ["1", "0", "0", "0", "0"],
    )
    assert.throws(() => dimQ(1, 2, 3, 4, 5, 6), /5-dimension basis/)
  })
})

describe("numeric regressions (census §10.3)", () => {
  test("1 T = 10⁴ G including the kg·m→g·cm base conversion; skipping it errs by ~3.16", () => {
    const mu0 = 4 * Math.PI * 1e-7
    const withBase = (Math.sqrt((4 * Math.PI) / mu0) * Math.sqrt(1000)) / Math.sqrt(100)
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
