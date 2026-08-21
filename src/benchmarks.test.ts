// Class-D property tests (census §10.1) over every shipped convention, plus an
// integrity guard on the mined benchmark seed (docs/data/benchmarks-seed.json).
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { CONVENTIONS, DimQ, Frac, dimQ, solveRestoration, validateConvention } from "./convention"

const root = fileURLToPath(new URL("..", import.meta.url))

describe("class-D properties: generator self-consistency", () => {
  // For every independent convention, restoring a generator's own dimension must
  // return exactly that generator to the first power — the grading non-gap
  // (census §2.13: per-term restoration reconstructs ħ/c/α′ counting).
  for (const [key, conv] of Object.entries(CONVENTIONS)) {
    const v = validateConvention(conv)
    if (v.kind === "over-determined" || conv.generators.length === 0) continue
    test(`${key}: each generator restores to itself with power 1`, () => {
      for (const gen of conv.generators) {
        const s = solveRestoration(conv, gen.dim)
        assert.strictEqual(s.kind, "unique", `${key}/${gen.tex}`)
        if (s.kind === "unique") {
          assert.strictEqual(s.exponents.length, 1, `${key}/${gen.tex}`)
          assert.strictEqual(s.exponents[0].generator.tex, gen.tex)
          assert.ok(s.exponents[0].power.eq(Frac.of(1)))
        }
      }
    })
  }
})

describe("class-D properties: round-trip solve", () => {
  // target = Σ xᵢ·dim(gᵢ) with fixed exponent vectors (integers and halves)
  // must solve back to exactly x. Deterministic vectors, no RNG (resume-safe).
  const VECTORS: [number, number][][] = [
    [[1, 1], [2, 1], [-1, 1], [3, 1], [0, 1]],
    [[1, 2], [-3, 2], [1, 1], [0, 1], [5, 2]],
    [[-2, 1], [0, 1], [1, 3], [-1, 2], [2, 1]],
  ]
  for (const [key, conv] of Object.entries(CONVENTIONS)) {
    const v = validateConvention(conv)
    if (v.kind === "over-determined" || conv.generators.length === 0) continue
    test(`${key}: exponent vectors round-trip exactly`, () => {
      for (const vec of VECTORS) {
        const x = conv.generators.map((_, i) => Frac.of(...vec[i % vec.length]))
        const target = conv.generators.reduce(
          (acc, gen, i) => acc.map((a, k) => a.add(x[i].mul(gen.dim[k]))) as DimQ,
          dimQ(0, 0, 0, 0, 0),
        )
        const s = solveRestoration(conv, target)
        assert.strictEqual(s.kind, "unique", key)
        if (s.kind === "unique") {
          const byTex = new Map(s.exponents.map((e) => [e.generator.tex, e.power]))
          conv.generators.forEach((gen, i) => {
            const got = byTex.get(gen.tex) ?? Frac.of(0)
            assert.ok(got.eq(x[i]), `${key}/${gen.tex}: ${got} ≠ ${x[i]}`)
          })
        }
      }
    })
  }
})

describe("benchmark seed integrity (docs/data/benchmarks-seed.json)", () => {
  const seed = JSON.parse(readFileSync(join(root, "docs/data/benchmarks-seed.json"), "utf8"))
  test("the mined corpus keeps its adjudicated shape", () => {
    assert.strictEqual(seed.system_forms.length, 90)
    const forms = seed.system_forms.reduce(
      (n: number, s: { forms: Record<string, string> }) => n + Object.keys(s.forms).length,
      0,
    )
    assert.strictEqual(forms, 220)
    assert.strictEqual(seed.fork_examples.length, 69)
    assert.strictEqual(seed.corrections.length, 108)
    assert.strictEqual(seed.anti_fingerprints.length, 7)
  })
  test("every system form carries a signature tag and a generator list", () => {
    for (const s of seed.system_forms) {
      assert.strictEqual(s.signature_tag, "(-,+,+,+)")
      assert.ok(Array.isArray(s.generators))
    }
  })
  test("anti-fingerprints all name what must NOT fire — the false-positive suite", () => {
    for (const a of seed.anti_fingerprints) {
      assert.ok(a.pattern && a.must_not_fire && a.why)
    }
  })
})
