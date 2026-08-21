// Bridge tests: the engine ↔ convention-layer seam, including the sweep that
// verifies the production engine's c–G uniqueness invariant with the
// INDEPENDENT solver — two implementations, one theorem.
import test, { describe } from "node:test"
import assert from "node:assert"
import { findRegistryForSlug } from "./unitsEngine"
import { CONST_DIM, CONVENTIONS, Convention, Frac, solveRestoration } from "./convention"
import { SOURCE_CONVENTION_KEY, conventionKeyForTarget, dimToDimQ } from "./bridge"

const registry = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!

describe("target mapping", () => {
  test("all six engine targets map to encoded conventions", () => {
    const seen = new Set<string>()
    for (const system of ["hl", "si", "gaussian"] as const) {
      for (const geometrized of [true, false]) {
        const key = conventionKeyForTarget({ system, geometrized })
        assert.ok(key in CONVENTIONS, `${system}/${geometrized} → ${key}`)
        seen.add(key)
      }
    }
    assert.strictEqual(seen.size, 6)
    assert.ok(SOURCE_CONVENTION_KEY in CONVENTIONS)
  })
})

describe("twelfths conversion", () => {
  test("integer twelfths convert to exact rationals (Gaussian charge = (½, 3/2, −1))", () => {
    const q = dimToDimQ([6, 18, -12, 0, 0])
    assert.ok(q[0].eq(Frac.of(1, 2)))
    assert.ok(q[1].eq(Frac.of(3, 2)))
    assert.ok(q[2].eq(Frac.of(-1)))
    assert.ok(q[3].isZero() && q[4].isZero())
  })
})

describe("cross-validation: the engine's registry against the independent solver", () => {
  const source = CONVENTIONS[SOURCE_CONVENTION_KEY]
  const sections = ["bare", "exact", "indexed", "differential"] as const
  // The registry's own contract: geometrized G = c = 1 with ħ and k_B kept
  // EXPLICIT — so the engine's constant vocabulary is {c, G, ħ, k_B}, and the
  // cross-validation invariant is uniqueness over that ambient set, not over
  // {c, G} alone.
  const ambient: Convention = {
    name: "engine-ambient",
    generators: [
      ...source.generators,
      { tex: "\\hbar", dim: CONST_DIM.hbar, numericFactor: "1", emits: "\\hbar", kind: "fundamental_constant", role: "absorbed" },
      { tex: "k_B", dim: CONST_DIM.kB, numericFactor: "1", emits: "k_B", kind: "fundamental_constant", role: "absorbed" },
    ],
  }

  test("ħ itself is NOT c–G restorable — the reason the ambient set exists", () => {
    assert.strictEqual(solveRestoration(source, CONST_DIM.hbar).kind, "inconsistent")
  })

  test("every GR registry reading restores uniquely over {c, G, ħ, k_B}, and none carries charge", () => {
    let entries = 0
    for (const section of sections) {
      for (const [tex, entry] of Object.entries(registry[section])) {
        const s = solveRestoration(ambient, dimToDimQ(entry.dim))
        assert.strictEqual(s.kind, "unique", `${section}/${tex}`)
        // No registry reading carries the I dimension today; when charged
        // entries land, this fails and the ambient vocabulary must grow an
        // EM constant (with its rendering fork handled, census §2.4).
        assert.strictEqual(entry.dim[4], 0, `${section}/${tex} carries I`)
        entries++
      }
    }
    // The registry is substantial; a collapsed iteration must not pass silently.
    assert.ok(entries > 50, `swept only ${entries} entries`)
  })

  test("a velocity-dimensioned reading restores to exactly c¹", () => {
    const s = solveRestoration(source, dimToDimQ([0, 12, -12, 0, 0]))
    assert.strictEqual(s.kind, "unique")
    if (s.kind === "unique") {
      assert.strictEqual(s.exponents.length, 1)
      assert.strictEqual(s.exponents[0].generator.tex, "c")
      assert.ok(s.exponents[0].power.eq(Frac.of(1)))
    }
  })
})
