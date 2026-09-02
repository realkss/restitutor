// The §6.3/§6.4 equation-form matchers (docs/data/fingerprints.json), run
// through the real detector: every drafted positive fires its rule and every
// drafted negative does not, each rule narrows to a real non-empty set, and
// constants-explicit SI is asserted positively.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { DetectionReport, inferConventions } from "./detect"
import { targetFromDetection } from "./bridge"

type Rule = { id: string; label: string; positives: string[]; negatives: string[] }
const RULES: Rule[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("../docs/data/fingerprints.json", import.meta.url)), "utf8"),
)

const fired = (r: DetectionReport, label: string) =>
  r.evidence.some((e) => e.kind === "fingerprint" && e.label === label)
const keys = (r: DetectionReport) => r.sets.flat()

describe("equation-form matchers (census §6.3/§6.4): the drafted positives and negatives", () => {
  assert.strictEqual(RULES.length, 20)
  for (const rule of RULES) {
    test(rule.id, () => {
      for (const p of rule.positives) {
        const r = inferConventions({ equations: [p] })
        assert.ok(fired(r, rule.label), `positive did not fire: ${p}`)
        assert.strictEqual(r.kind, "narrowed", `positive left no candidates: ${p}`)
        assert.ok(r.sets[0].length > 0)
      }
      for (const n of rule.negatives) {
        const r = inferConventions({ equations: [n] })
        assert.ok(!fired(r, rule.label), `negative fired: ${n}`)
      }
    })
  }
})

describe("what the matchers assert", () => {
  test("constants-explicit SI is asserted, not the residue of nothing firing", () => {
    const r = inferConventions({
      equations: ["\\nabla\\times\\mathbf{H} = \\mathbf{J} + \\frac{\\partial\\mathbf{D}}{\\partial t}"],
    })
    assert.strictEqual(r.kind, "narrowed")
    assert.ok(keys(r).includes("si"))
    assert.ok(!keys(r).includes("gaussian"))
    assert.ok(!keys(r).includes("heaviside-lorentz"))
    assert.ok(keys(r).includes("geometrized"), "mechanical rows survive an E&M form")
    assert.strictEqual(targetFromDetection(r).system, "si")
  })
  test("the ½∫√−g(R − 2Λ) action is 8πG = 1, the bare integral 16πG = 1 — the prefactor, never the bracket", () => {
    const half = inferConventions({ equations: ["S = \\frac{1}{2}\\int d^4x\\,\\sqrt{-g}\\,(R - 2\\Lambda)"] })
    assert.deepStrictEqual(keys(half), ["classical-kappa", "reduced-planck"])
    const bare = inferConventions({ equations: ["S = \\int d^4x\\,\\sqrt{-g}\\,(R - 2\\Lambda)"] })
    assert.deepStrictEqual(keys(bare), ["sixteen-pi-g"])
    const bracket = inferConventions({ equations: ["S = \\int d^4x\\,\\sqrt{-g}\\,\\frac{R}{16\\pi G}"] })
    assert.ok(!bracket.evidence.some((e) => e.kind === "fingerprint"))
  })
  test("Gaussian Ampère and SI Ampère in one body is a conflict, and both forms are attached", () => {
    const r = inferConventions({
      equations: [
        "\\nabla\\times\\mathbf{H} = \\frac{4\\pi}{c}\\mathbf{J} + \\frac{1}{c}\\frac{\\partial\\mathbf{D}}{\\partial t}",
        "\\nabla\\times\\mathbf{H} = \\mathbf{J} + \\frac{\\partial\\mathbf{D}}{\\partial t}",
      ],
    })
    assert.strictEqual(r.kind, "conflict")
    assert.strictEqual(r.evidence.filter((e) => e.kind === "fingerprint").length, 2)
  })
  test("the two rationalized systems stay a set under Gauss's law alone", () => {
    const r = inferConventions({ equations: ["\\nabla\\cdot\\mathbf{D} = \\rho"] })
    assert.ok(keys(r).includes("si") && keys(r).includes("heaviside-lorentz"))
    assert.strictEqual(targetFromDetection(r).system, undefined)
  })
})
