// Detection tests (census §6): declarations intersect, visible constants
// exclude, absence proves nothing, homographs never act, conflicts are
// findings. Sets, never guesses.
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONVENTIONS } from "./convention"
import { DetectionReport, generatesConstant, inferConventions } from "./detect"
import { CONST_DIM } from "./convention"

const keys = (r: DetectionReport) => r.sets.flat()

describe("generatesConstant (any-normalization visibility rule)", () => {
  test("geometrized generates c and G; reduced-planck generates G only as 8πG — still counts", () => {
    assert.ok(generatesConstant("geometrized", "c", CONST_DIM.c))
    assert.ok(generatesConstant("geometrized", "G", CONST_DIM.G))
    // 8πG = 1 is a normalization OF G: a reduced-Planck paper prints neither.
    assert.ok(generatesConstant("reduced-planck", "G", CONST_DIM.G))
    assert.ok(generatesConstant("sixteen-pi-g", "G", CONST_DIM.G))
  })
  test("SI generates nothing; Hartree does NOT generate c (c = 1/α in-system)", () => {
    assert.ok(!generatesConstant("si", "c", CONST_DIM.c))
    assert.ok(!generatesConstant("si", "\\hbar", CONST_DIM.hbar))
    assert.ok(!generatesConstant("hartree", "c", CONST_DIM.c))
    assert.ok(generatesConstant("hartree", "\\hbar", CONST_DIM.hbar))
  })
})

describe("declaration evidence intersects", () => {
  test("a geometrized declaration keeps the G = c = 1 family and drops SI and 8πG = 1", () => {
    const r = inferConventions({ text: "Throughout we use geometrized units." })
    assert.strictEqual(r.kind, "narrowed")
    const set = keys(r)
    for (const k of ["geometrized", "geometrized-gaussian", "geometrized-hl"])
      assert.ok(set.includes(k), k)
    for (const k of ["si", "reduced-planck", "sixteen-pi-g", "hartree", "hep-hl-kb"])
      assert.ok(!set.includes(k), `${k} should be excluded`)
  })
  test("the bare equation form 'G = c = 1' works too, and Planck systems rightly survive it", () => {
    const r = inferConventions({ text: "We set G = c = 1 in what follows." })
    const set = keys(r)
    assert.ok(set.includes("geometrized"))
    // Planck units also set G = c = 1 — the declaration alone cannot separate.
    assert.ok(set.includes("planck-gaussian"))
  })
  test("two declarations compose: geometrized ∩ Gaussian rendering", () => {
    const r = inferConventions({
      text: "We adopt geometrized units and Gaussian units for the electromagnetic sector.",
    })
    const set = keys(r)
    assert.ok(set.includes("geometrized-gaussian"))
    assert.ok(!set.includes("geometrized-hl"))
    assert.ok(!set.includes("gaussian")) // plain Gaussian keeps c — dropped by G = c = 1
    assert.strictEqual(r.evidence.length, 2)
  })
  test("ħ = c = 1 keeps the natural-unit family and drops geometrized (no ħ generator there)", () => {
    const r = inferConventions({ text: "We work in natural units, \\hbar = c = 1." })
    const set = keys(r)
    assert.ok(set.includes("hep-hl-kb"))
    assert.ok(!set.includes("geometrized"))
    assert.ok(!set.includes("si"))
  })
})

describe("visible-constant evidence excludes — absence never does", () => {
  test("a printed ħ excludes ħ = 1 conventions and keeps SI, Gaussian, geometrized", () => {
    const r = inferConventions({ equations: ["E = \\hbar \\omega"] })
    assert.strictEqual(r.kind, "narrowed")
    const set = keys(r)
    for (const k of ["si", "gaussian", "geometrized"]) assert.ok(set.includes(k), k)
    for (const k of ["hep-hl-kb", "hartree", "reduced-planck"])
      assert.ok(!set.includes(k), `${k} should be excluded`)
  })
  test("a printed 1/(4πε₀) excludes the ε₀-absorbing renderings", () => {
    const r = inferConventions({
      equations: ["F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q_1 q_2}{r^2}"],
    })
    const set = keys(r)
    assert.ok(set.includes("si"))
    assert.ok(!set.includes("gaussian"))
  })
  test("8πG visible excludes EVERY G-normalization, including 8πG = 1 and 16πG = 1", () => {
    const r = inferConventions({ equations: ["G_{ab} = \\frac{8\\pi G}{c^{4}} T_{ab}"] })
    const set = keys(r)
    assert.ok(set.includes("si"))
    for (const k of ["geometrized", "reduced-planck", "sixteen-pi-g", "bh-scale"])
      assert.ok(!set.includes(k), `${k} should be excluded`)
  })
  test("an equation with no constants proves nothing: all candidates survive", () => {
    const r = inferConventions({ equations: ["\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}"] })
    assert.strictEqual(r.kind, "insufficient")
    assert.strictEqual(keys(r).length, Object.keys(CONVENTIONS).length)
  })
})

describe("homograph honesty (census §6.6)", () => {
  test("a bare c is recorded as weak evidence and excludes nothing — c is also a sound speed", () => {
    const r = inferConventions({ equations: ["E = m c^{2}"] })
    assert.strictEqual(r.kind, "insufficient")
    const weak = r.evidence.find((e) => e.kind === "visible-constant" && e.constant === "c")
    assert.ok(weak)
    if (weak.kind === "visible-constant") {
      assert.strictEqual(weak.strength, "weak-homograph")
      assert.deepStrictEqual(weak.excludes, [])
    }
  })
  test("a bare G (the Einstein tensor's letter) excludes nothing either", () => {
    const r = inferConventions({ equations: ["G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}"] })
    // G_{ab} must not even register: the subscript disqualifies the token.
    // 8\pi T carries no G, so nothing strong fires.
    assert.strictEqual(r.kind, "insufficient")
    for (const e of r.evidence)
      if (e.kind === "visible-constant") assert.deepStrictEqual(e.excludes, [])
  })
})

describe("conflict is a finding, not a failure", () => {
  test("declared geometrized + printed 8πG/c⁴ → conflict, with both pieces of evidence attached", () => {
    const r = inferConventions({
      text: "We use geometrized units throughout.",
      equations: ["G_{ab} = \\frac{8\\pi G}{c^{4}} T_{ab}"],
    })
    assert.strictEqual(r.kind, "conflict")
    assert.strictEqual(r.sets.length, 0)
    assert.ok(r.evidence.some((e) => e.kind === "declaration"))
    assert.ok(
      r.evidence.some(
        (e) => e.kind === "visible-constant" && e.strength === "strong" && e.excludes.length > 0,
      ),
    )
  })
})

describe("the sets contract (census §6.2)", () => {
  test("empty input → insufficient, with the FULL candidate list as the one honest set", () => {
    const r = inferConventions({})
    assert.strictEqual(r.kind, "insufficient")
    assert.strictEqual(r.sets.length, 1)
    assert.strictEqual(r.sets[0].length, Object.keys(CONVENTIONS).length)
    assert.deepStrictEqual(r.evidence, [])
  })
  test("candidates option scopes the search", () => {
    const r = inferConventions(
      { text: "geometrized units" },
      { candidates: ["geometrized", "si"] },
    )
    assert.deepStrictEqual(keys(r), ["geometrized"])
  })
})
