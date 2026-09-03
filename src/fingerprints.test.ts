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
  assert.strictEqual(RULES.length, 22)
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
      equations: ["\\nabla\\times\\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial\\mathbf{E}}{\\partial t}"],
    })
    assert.strictEqual(r.kind, "narrowed")
    assert.ok(keys(r).includes("si"))
    assert.ok(!keys(r).includes("gaussian"))
    assert.ok(!keys(r).includes("heaviside-lorentz"))
    assert.ok(keys(r).includes("geometrized"), "mechanical rows survive an E&M form")
    assert.strictEqual(targetFromDetection(r).system, "si")
  })
  test("J + Ḋ with neither 4π nor 1/c is the rationalized PAIR: at c = 1 it is the Heaviside–Lorentz law too (review v2)", () => {
    const r = inferConventions({
      text: "We use Heaviside-Lorentz units throughout.",
      equations: [
        "\\nabla\\cdot\\mathbf{E} = \\rho",
        "\\nabla\\times\\mathbf{B} = \\mathbf{J} + \\frac{\\partial\\mathbf{E}}{\\partial t}",
        "\\nabla\\times\\mathbf{E} = -\\frac{\\partial\\mathbf{B}}{\\partial t}",
      ],
    })
    assert.strictEqual(r.kind, "narrowed")
    assert.ok(keys(r).includes("heaviside-lorentz"))
    assert.ok(!keys(r).includes("si"))
    const bare = inferConventions({ equations: ["\\nabla\\times\\mathbf{H} = \\mathbf{J} + \\frac{\\partial\\mathbf{D}}{\\partial t}"] })
    assert.ok(keys(bare).includes("si") && keys(bare).includes("heaviside-lorentz"))
    assert.strictEqual(targetFromDetection(bare).system, undefined)
  })
  test("Wikipedia's braced fractions fold, so the matchers fire on alttext (review v2)", () => {
    const r = inferConventions({
      equations: ["\\alpha ={\\frac {e^{2}}{4\\pi \\varepsilon _{0}\\hbar c}}", "S={\\frac {c^{4}}{16\\pi G}}\\int d^{4}x\\,{\\sqrt {-g}}\\,R"],
    })
    const labels = r.evidence.filter((e) => e.kind === "fingerprint").map((e) => e.label)
    assert.ok(labels.includes("Coulomb prefactor 1/(4πε₀)"), labels.join(" | "))
    assert.ok(labels.includes("Einstein–Hilbert prefactor c⁴/16πG"), labels.join(" | "))
  })
  test("G_N is Newton's constant: the 16π guards see it and the visible-constant channel counts it (review v2)", () => {
    const r = inferConventions({
      equations: [
        "S = \\frac{c^4}{16\\pi G_N}\\int d^4x\\,\\sqrt{-g}\\,R",
        ...Array.from({ length: 3 }, (_, i) => `F_{${i}} = \\frac{G_N M m}{r^2}`),
      ],
    })
    assert.ok(!r.evidence.some((e) => e.kind === "fingerprint" && e.label === "Einstein–Hilbert prefactor 1/16π"))
    assert.ok(r.evidence.some((e) => e.kind === "visible-constant" && e.constant === "G (Newton)" && e.strength === "strong"))
    assert.ok(!keys(r).includes("geometrized"))
  })
  test("the variation of the action is not the bare Hilbert action: R_{μν} under √−g fires nothing (review v2)", () => {
    const r = inferConventions({
      equations: ["\\delta S = \\int d^{n}x \\sqrt{-g} \\left[R_{\\mu\\nu} - \\frac{1}{2} R g_{\\mu\\nu}\\right] \\delta g^{\\mu\\nu}"],
    })
    assert.ok(!r.evidence.some((e) => e.kind === "fingerprint"))
    assert.strictEqual(r.kind, "insufficient")
  })
  test("S = A/(4 G) is not the Planck form; S = A/4 with k_B printed throughout is contradicted, not a conflict (review v2)", () => {
    const notPlanck = inferConventions({ equations: ["S = \\frac{A}{4 G}", "S_{\\rm BH} = \\frac{A}{4 G \\hbar}"] })
    assert.ok(!notPlanck.evidence.some((e) => e.kind === "fingerprint"))
    const kb = inferConventions({
      equations: [
        "S = \\frac{A}{4}",
        ...Array.from({ length: 8 }, (_, i) => `Z_{${i}} = \\sum_n e^{-E_n/k_B T}`),
      ],
    })
    assert.notStrictEqual(kb.kind, "conflict")
    assert.ok(kb.evidence.some((e) => e.kind === "contradicted" && e.constantTex === "k_B"))
  })
  test("the radiative-transfer 4π/c is not the Gaussian c-rider (review v2)", () => {
    const r = inferConventions({ equations: ["u_\\nu = \\frac{4\\pi}{c} J_\\nu", "F_\\nu = \\frac{4\\pi}{c}H_\\nu"] })
    assert.ok(!r.evidence.some((e) => e.kind === "fingerprint"))
  })
  test("1/16πG with no c is the c = 1 rung: c absorbed, G printed (review v2)", () => {
    const r = inferConventions({ equations: ["S = \\frac{1}{16\\pi G}\\int d^4x\\,\\sqrt{-g}\\,R"] })
    assert.strictEqual(r.kind, "narrowed")
    assert.ok(keys(r).includes("c-only"))
    assert.ok(!keys(r).includes("geometrized"))
    assert.ok(!keys(r).includes("si"))
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
