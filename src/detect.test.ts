// Detection tests (census §6). Every case that the v1 review confirmed is
// pinned here as a regression: chains read their numeric prefixes, named
// systems need a declarative frame, "natural units" classifies nothing,
// visible constants are body-level, homographs never act, conflicts are
// findings. Sets, never guesses.
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONST_DIM, CONVENTIONS } from "./convention"
import {
  CONSTANT_TOKENS,
  DetectionReport,
  NAMED_RULES,
  absorbsExactly,
  absorbsWithFactor,
  generatesConstant,
  inferConventions,
  inferDocument,
  normalizeProse,
  normalizeTexForDetection,
  prevalent,
} from "./detect"

const keys = (r: DetectionReport) => r.sets.flat()
const ALL = Object.keys(CONVENTIONS).length
const has = (r: DetectionReport, ...ks: string[]) => {
  for (const k of ks) assert.ok(keys(r).includes(k), `${k} should survive`)
}
const lacks = (r: DetectionReport, ...ks: string[]) => {
  for (const k of ks) assert.ok(!keys(r).includes(k), `${k} should be excluded`)
}
const declarations = (r: DetectionReport) => r.evidence.filter((e) => e.kind === "declaration")

describe("absorption predicates", () => {
  test("strict vs loose: 8πG = 1 rows generate G loosely but not as G = 1", () => {
    assert.ok(generatesConstant("reduced-planck", "G", CONST_DIM.G))
    assert.ok(!absorbsExactly("reduced-planck", "G", CONST_DIM.G))
    assert.ok(absorbsWithFactor("reduced-planck", "G", CONST_DIM.G, "8\\pi"))
    assert.ok(absorbsWithFactor("classical-kappa", "G", CONST_DIM.G, "8\\pi"))
    assert.ok(absorbsWithFactor("sixteen-pi-g", "G", CONST_DIM.G, "16\\pi"))
    assert.ok(!absorbsWithFactor("geometrized", "G", CONST_DIM.G, "8\\pi"))
  })
  test("SI generates nothing; Hartree does not generate c (c = 1/α in-system)", () => {
    assert.ok(!generatesConstant("si", "c", CONST_DIM.c))
    assert.ok(!generatesConstant("hartree", "c", CONST_DIM.c))
    assert.ok(generatesConstant("hartree", "\\hbar", CONST_DIM.hbar))
  })
})

describe("channel 1 — declaration chains read their numeric prefixes", () => {
  test("G = c = 1 keeps the strict G = 1 family and drops every other G normalization", () => {
    const r = inferConventions({ text: "We set G = c = 1 in what follows." })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "geometrized", "geometrized-gaussian", "geometrized-hl", "planck-gaussian", "bh-scale")
    lacks(r, "si", "reduced-planck", "classical-kappa", "sixteen-pi-g", "hartree", "gaussian")
  })
  test("THE v1 BLOCKER: 8πG = c = 1 is the κ family, never the geometrized family", () => {
    for (const text of [
      "We adopt units in which 8\\pi G = c = 1.",
      "We use units with 8πG = c = 1.",
      "in units where 8 π G = c = 1 throughout",
    ]) {
      const r = inferConventions({ text })
      assert.strictEqual(r.kind, "narrowed", text)
      assert.deepStrictEqual(keys(r), ["classical-kappa", "reduced-planck"], text)
    }
  })
  test("16πG = c = 1 derives sixteen-pi-g from the registry, not a hand list", () => {
    const r = inferConventions({ text: "with 16\\pi G = c = 1" })
    assert.deepStrictEqual(keys(r), ["sixteen-pi-g"])
  })
  test("8πG = 1 alone keeps BOTH 8πG rows (a set, not the single hardcoded guess)", () => {
    const r = inferConventions({ text: "We set 8\\pi G = 1." })
    assert.deepStrictEqual(keys(r), ["classical-kappa", "reduced-planck"])
  })
  test("ħ = c = k_B = 1: ħ and c are strict, k_B is a modifier axis", () => {
    const r = inferConventions({ text: "We use \\hbar = c = k_B = 1." })
    has(r, "hep-hl-kb", "reduced-planck", "kolb-turner")
    has(r, "hep-hl") // no k_B generator, but Θ is unreachable there: compatible
    lacks(r, "geometrized", "si", "hartree", "c-only")
    assert.strictEqual(declarations(r).length, 1)
    assert.strictEqual(declarations(r)[0].label, "ħ = c = k_B = 1")
  })
  test("k_B = 1 never manufactures a conflict with a system that does not reach temperature", () => {
    const r = inferConventions({ text: "We use atomic units; temperatures are in units with k_B = 1." })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "hartree", "rydberg")
    lacks(r, "si")
  })
  test("a quoted SI value is not a normalization: k_B = 1.380649 × 10⁻²³ does not fire", () => {
    const r = inferConventions({ text: "Here k_B = 1.380649 × 10^-23 J/K is Boltzmann's constant." })
    assert.strictEqual(declarations(r).length, 0)
    assert.strictEqual(r.kind, "insufficient")
  })
  test("a chain typeset as MATH is a declaration, not a visible constant (no self-conflict)", () => {
    const r = inferConventions({
      text: "Throughout we work in natural units,",
      equations: ["\\hbar = c = 1", "E^2 = p^2 + m^2", "E = \\hbar \\omega"],
    })
    assert.notStrictEqual(r.kind, "conflict")
    has(r, "hep-hl-kb")
    lacks(r, "geometrized")
    const ħ = r.evidence.find((e) => e.kind === "visible-constant" && e.constant === "ħ")
    assert.ok(ħ && ħ.kind === "visible-constant" && ħ.strength === "isolated")
  })
})

describe("channel 2 — named systems need a declarative frame", () => {
  test("framed: 'we use geometrized units' narrows", () => {
    const r = inferConventions({ text: "Throughout we use geometrized units." })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "geometrized", "geometrized-gaussian", "geometrized-hl")
    lacks(r, "si", "reduced-planck", "sixteen-pi-g", "hartree")
  })
  test("a restoration remark is a mention, not a declaration (the SI false-conflict)", () => {
    const r = inferConventions({
      text: "We use geometrized units (G = c = 1). To convert to SI units, multiply by the factors in Table 2.",
    })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "geometrized")
    const si = r.evidence.find((e) => e.label === "SI (MKSA) units")
    assert.ok(si && si.kind === "mention")
  })
  test("'reduced Planck constant' — ħ's standard gloss — fires nothing (the v1 blocker)", () => {
    const r = inferConventions({
      text: "Here ħ is the reduced Planck constant and c is the speed of light.",
      equations: ["E = \\hbar\\omega"],
    })
    assert.strictEqual(declarations(r).length, 0)
    assert.strictEqual(r.kind, "insufficient")
    assert.strictEqual(keys(r).length, ALL)
  })
  test("'natural units' classifies nothing on its own, framed or not (census §6.4)", () => {
    for (const text of ["We work in natural units.", "Natural units are a system of units."]) {
      const r = inferConventions({ text })
      assert.strictEqual(r.kind, "insufficient", text)
      assert.ok(r.evidence.some((e) => e.kind === "mention" && e.label === "natural units"), text)
    }
  })
  test("Rydberg atomic units is a narrowing, not a self-conflict", () => {
    const r = inferConventions({ text: "We use Rydberg atomic units throughout." })
    assert.deepStrictEqual(keys(r), ["rydberg"])
    const eff = inferConventions({ text: "Energies are given in effective Rydberg units (Ry*)." })
    assert.deepStrictEqual(keys(eff), ["effective-au"])
  })
  test("two framed declarations compose: geometrized ∩ Gaussian", () => {
    const r = inferConventions({
      text: "We adopt geometrized units and Gaussian units for the electromagnetic sector.",
    })
    has(r, "geometrized-gaussian")
    lacks(r, "geometrized-hl", "gaussian")
    assert.strictEqual(declarations(r).length, 2)
  })
  test("an E&M declaration never deletes a mechanical or undetermined row", () => {
    const r = inferConventions({ text: "Fields are given in Gaussian units throughout." })
    has(r, "gaussian", "magnetism-emu", "hartree", "geometrized", "reduced-planck")
    lacks(r, "si", "heaviside-lorentz", "hep-hl-kb", "esu")
  })
  test("an unframed named system never narrows: the mention cannot conflict with the declaration (mutation m29)", () => {
    const r = inferConventions({ text: "Earlier work reported values in atomic units. We use geometrized units throughout." })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "geometrized", "geometrized-gaussian", "geometrized-hl", "bh-scale", "nr-code")
    lacks(r, "hartree", "rydberg", "si")
    const au = r.evidence.find((e) => e.label === "atomic (Hartree) units")
    assert.ok(au && au.kind === "mention")
  })
  test("a comparison-only named system leaves the candidate set untouched", () => {
    const r = inferConventions({ text: "Results are quoted in Gaussian units for comparison." })
    assert.strictEqual(r.kind, "insufficient")
    assert.strictEqual(keys(r).length, ALL)
  })
  test("every named rule with an implication yields a non-empty set", () => {
    for (const rule of NAMED_RULES) if (rule.implies) assert.ok(rule.implies().length > 0, rule.label)
  })
})

describe("channel 3 — the §6.1 Einstein-prefactor ladder", () => {
  test("8π T with no G → Cluster A (the G = c = 1 family)", () => {
    const r = inferConventions({ equations: ["G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}"] })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "geometrized", "planck-gaussian")
    lacks(r, "si", "reduced-planck", "classical-kappa", "sixteen-pi-g")
    assert.ok(r.evidence.some((e) => e.kind === "fingerprint"))
  })
  test("bare G_μν = T_μν → 8πG = c = 1, both rows", () => {
    const r = inferConventions({ equations: ["G_{\\mu\\nu} = T_{\\mu\\nu}"] })
    assert.deepStrictEqual(keys(r), ["classical-kappa", "reduced-planck"])
  })
  test("8πG T with no c → c = 1 only", () => {
    const r = inferConventions({ equations: ["G_{\\mu\\nu} = 8\\pi G T_{\\mu\\nu}"] })
    has(r, "c-only", "geometrized")
    lacks(r, "si", "hartree")
  })
  test("a Cluster A rung is refuted by a body that keeps printing G (mutation m08)", () => {
    const equations = [
      "G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}",
      ...Array.from({ length: 3 }, (_, i) => `\\Phi^{(${i})} = -\\frac{G M}{r}`),
      ...Array.from({ length: 6 }, (_, i) => `R_{ab}^{(${i})} = 0`),
    ]
    const r = inferConventions({ equations })
    assert.strictEqual(r.kind, "narrowed")
    const c = r.evidence.find((e) => e.kind === "contradicted")
    assert.ok(c && c.kind === "contradicted", "the rung must be contradicted by the printed G")
    assert.strictEqual(c.constantTex, "G")
    assert.strictEqual(c.count, 3)
    assert.strictEqual(c.of, 10)
    assert.ok(!r.evidence.some((e) => e.kind === "fingerprint" && e.label.includes("Cluster A")))
    has(r, "si")
    lacks(r, "geometrized", "reduced-planck")
  })
  test("κ T is symbolic: recorded, binds nothing", () => {
    const r = inferConventions({ equations: ["G_{\\mu\\nu} = \\kappa T_{\\mu\\nu}"] })
    assert.strictEqual(r.kind, "insufficient")
    assert.ok(r.evidence.some((e) => e.kind === "mention" && /κ/.test(e.label)))
  })
})

describe("channel 4 — visible constants are body-level", () => {
  const body = ["E = \\hbar \\omega", "p = \\hbar k", "L = n \\hbar", "F = m a", "v = \\omega r"]
  test("ħ in 3 of 5 body equations excludes the ħ = 1 rows and keeps SI, Gaussian, geometrized", () => {
    const r = inferConventions({ equations: body })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "si", "gaussian", "geometrized")
    lacks(r, "hep-hl-kb", "hartree", "reduced-planck")
  })
  test("ONE restored ħ is isolated evidence — census §6.4's first anti-heuristic", () => {
    const r = inferConventions({ equations: ["E = \\hbar \\omega", "F = m a", "v = \\omega r", "p = m v", "x = v t"] })
    assert.strictEqual(r.kind, "insufficient")
    const ħ = r.evidence.find((e) => e.kind === "visible-constant" && e.constant === "ħ")
    assert.ok(ħ && ħ.kind === "visible-constant" && ħ.strength === "isolated" && ħ.excludes.length === 0)
  })
  test("prevalence is two equations and five percent", () => {
    assert.ok(!prevalent(1, 1))
    assert.ok(prevalent(2, 2))
    assert.ok(prevalent(2, 40))
    assert.ok(!prevalent(2, 41))
  })
  test("decorated subscripts count: k_{\\rm B}, k_\\mathrm{B}, k_{\\text{B}}; and \\hslash", () => {
    const r = inferConventions({ equations: ["E = k_{\\rm B} T", "S = k_\\mathrm{B} \\ln W", "p = k_{\\text{B}} T n"] })
    lacks(r, "hep-hl-kb", "reduced-planck", "kb-only")
    has(r, "si")
    const folded = normalizeTexForDetection("E = \\hslash \\omega")
    assert.match(folded, /\bhbar\b/)
    assert.doesNotMatch(folded, /hslash/)
  })
  test("ε₀ is a homograph: a Debye/DFT ε₀ is weak; a Coulomb 1/(4πε₀) is strong and excludes the cgs flavors", () => {
    const weak = inferConventions({ equations: ["H = \\sum_i \\epsilon_0 c_i^\\dagger c_i", "\\epsilon_0 = 2 \\text{ eV}"] })
    assert.strictEqual(weak.kind, "insufficient")
    const strong = inferConventions({
      equations: ["F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}", "U = \\frac{q_1 q_2}{4\\pi\\varepsilon_0 r}"],
    })
    has(strong, "si")
    lacks(strong, "gaussian", "esu", "emu", "heaviside-lorentz", "hep-hl-kb", "hartree-gaussian", "hartree")
  })
  test("μ₀ is a homograph: a chemical potential is weak; B = μ₀H is strong", () => {
    const weak = inferConventions({ equations: ["\\mu_0 = \\partial E / \\partial N", "E(N) = \\mu_0 N"] })
    assert.strictEqual(weak.kind, "insufficient")
    const strong = inferConventions({ equations: ["B = \\mu_0 H", "\\nabla \\times B = \\mu_0 J"] })
    has(strong, "si")
    lacks(strong, "gaussian", "emu", "magnetism-emu")
  })
  test("Newton's G: GM and 2GM/c² count; a gauss-per-centimetre unit does not", () => {
    const r = inferConventions({ equations: ["r_s = \\frac{2 G M}{c^{2}}", "\\Phi = -\\frac{G M}{r}"] })
    has(r, "si")
    lacks(r, "geometrized", "reduced-planck", "sixteen-pi-g")
    const unit = inferConventions({ equations: ["B' = 100\\,\\mathrm{G/cm}", "\\partial_z B = 5 \\mathrm{G/cm}"] })
    assert.strictEqual(unit.kind, "insufficient")
  })
  test("bare c, G, e never exclude (sound speed, Einstein tensor, Euler's number)", () => {
    const r = inferConventions({ equations: ["E = m c^{2}", "G_{ab} = R_{ab}", "e^{x}"] })
    assert.strictEqual(r.kind, "insufficient")
    for (const e of r.evidence) if (e.kind === "visible-constant") assert.deepStrictEqual(e.excludes, [])
  })
  test("the strong-token table is exactly the five census constants", () => {
    assert.deepStrictEqual(
      CONSTANT_TOKENS.filter((t) => !t.weak).map((t) => t.constant),
      ["ħ", "k_B", "ε₀", "μ₀", "G (Newton)"],
    )
  })
})

describe("normalization — rendered pages fold to the matching form", () => {
  test("MathML innerText (𝐺 = 𝑐 = 1 with newlines, ℏ, π) reads as a chain", () => {
    const rendered = "units where \n𝐺\n=\n𝑐\n=\n1\n throughout."
    assert.match(normalizeProse(rendered), /G = c = 1/)
    const r = inferConventions({ text: rendered })
    has(r, "geometrized")
    lacks(r, "si")
    const hb = inferConventions({ text: "We set ℏ = c = 1." })
    has(hb, "hep-hl-kb")
    const pi = inferConventions({ text: "We set 8πG = c = 1." })
    assert.deepStrictEqual(keys(pi), ["classical-kappa", "reduced-planck"])
  })
})

describe("span-scoped detection (census §6.2, round-4 amendment)", () => {
  test("SI main text + Gaussian appendix → per-span verdicts and a MIXED flag, no document winner", () => {
    const doc = inferDocument([
      {
        id: "main",
        label: "Main text",
        text: "We work in SI units throughout the main text.",
        equations: ["F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}", "U = \\frac{q_1 q_2}{4\\pi\\varepsilon_0 r}"],
      },
      {
        id: "appB",
        label: "Appendix B",
        text: "In Appendix B we work in Gaussian units, following the original derivation.",
        equations: ["\\nu = \\frac{4\\pi n e^{4} \\ln\\Lambda}{m^{2} v^{3}}"],
      },
    ])
    assert.strictEqual(doc.spans.length, 2)
    assert.strictEqual(doc.spans[0].report.kind, "narrowed")
    assert.strictEqual(doc.spans[1].report.kind, "narrowed")
    assert.deepStrictEqual(doc.mixed, [{ a: "main", b: "appB" }])
    // The document-level read is the honest conflict; the spans carry the answer.
    assert.strictEqual(doc.overall.kind, "conflict")
  })
  test("one span, or spans that agree, are not mixed", () => {
    const one = inferDocument([{ id: "p", text: "We use geometrized units." }])
    assert.deepStrictEqual(one.mixed, [])
    const agree = inferDocument([
      { id: "a", text: "We use geometrized units." },
      { id: "b", equations: ["G_{ab} = 8\\pi T_{ab}"] },
    ])
    assert.deepStrictEqual(agree.mixed, [])
    assert.strictEqual(agree.overall.kind, "narrowed")
  })
})

describe("the sets contract (census §6.2) and report hygiene", () => {
  test("empty input → insufficient, a FRESH sorted full list each call", () => {
    const a = inferConventions({})
    const b = inferConventions({})
    assert.strictEqual(a.kind, "insufficient")
    assert.strictEqual(a.sets[0].length, ALL)
    assert.notStrictEqual(a.sets[0], b.sets[0])
    assert.deepStrictEqual(a.sets[0], [...a.sets[0]].sort())
  })
  test("candidates option scopes the search", () => {
    const r = inferConventions({ text: "We use geometrized units." }, { candidates: ["geometrized", "si"] })
    assert.deepStrictEqual(keys(r), ["geometrized"])
  })
  test("a genuine conflict is a finding with both sides attached", () => {
    const r = inferConventions({
      text: "We use geometrized units throughout.",
      equations: ["G_{ab} = \\frac{8\\pi G}{c^{4}} T_{ab}", "\\Box h = -\\frac{16 \\pi G}{c^{4}} T"],
    })
    assert.strictEqual(r.kind, "conflict")
    assert.strictEqual(r.sets.length, 0)
    assert.ok(r.evidence.some((e) => e.kind === "declaration"))
    assert.ok(r.evidence.some((e) => e.kind === "visible-constant" && e.strength === "strong" && e.excludes.length > 0))
  })
  test("Mathematical-Alphanumeric GREEK folds by its real block layout: 𝜅 is κ, 𝜋 is π, never ε or λ", () => {
    // italic κ α π γ, bold α π ω, and the ϵ variant
    const italic = String.fromCodePoint(0x1d705, 0x1d6fc, 0x1d70b, 0x1d6fe, 0x1d6c2, 0x1d6d1, 0x1d6da, 0x1d6dc)
    assert.strictEqual(normalizeProse(italic), "kappa" + "alpha" + "pi" + "γ" + "alpha" + "pi" + "ω" + "epsilon")
    // and the chain "8πG = 1" survives Chrome's math-italic rendering of MathML
    const r = inferConventions({ text: "We work in units where 8" + String.fromCodePoint(0x1d70b, 0x1d43a) + " = c = 1." })
    assert.strictEqual(r.kind, "narrowed")
    has(r, "reduced-planck", "classical-kappa")
  })
  test("a vacuum-only GR page leaves the G family undivided (Cluster B honesty)", () => {
    const r = inferConventions({ equations: ["R_{ab} = 0", "ds^2 = -(1 - 2M/r) dt^2"] })
    assert.strictEqual(r.kind, "insufficient")
  })
})

// Real-page finding (2026-09-02): the Arabic Wikipedia field-equations page
// says "using geometrized units where G = c = 1, this can be rewritten as …"
// — in Arabic, so no English frame catches it — while writing G in 13 of 70
// equations. Under v1.5 that was a conflict; the equations as printed govern.
describe("a stated chain weighed against the printed equations", () => {
  const body = (withG: number, total: number) => [
    ...Array.from({ length: withG }, (_, i) => `G_{ab} + \\Lambda g_{ab} = \\frac{8 \\pi G}{c^{4}} T_{ab}^{(${i})}`),
    ...Array.from({ length: total - withG }, (_, i) => `R_{ab}^{(${i})} = 0`),
  ]
  test("a chain the body contradicts at body level is recorded as such, and does not narrow", () => {
    const r = inferConventions({ text: "باستعمال وحدات هندسية حيث G = c = 1, يمكن إعادة كتابتها", equations: body(3, 10) })
    assert.strictEqual(r.kind, "narrowed")
    const c = r.evidence.find((e) => e.kind === "contradicted")
    assert.ok(c && c.kind === "contradicted")
    assert.strictEqual(c.constantTex, "G")
    assert.strictEqual(c.count, 3)
    assert.strictEqual(c.of, 10)
    assert.ok(!r.evidence.some((e) => e.kind === "declaration"))
    has(r, "si", "gaussian", "heaviside-lorentz")
    lacks(r, "geometrized")
  })
  test("an isolated appearance does not unseat the chain (authors restore c and G in final formulas)", () => {
    const r = inferConventions({ text: "Throughout, G = c = 1.", equations: body(1, 40) })
    assert.strictEqual(r.kind, "narrowed")
    assert.ok(r.evidence.some((e) => e.kind === "declaration" && e.form === "chain"))
    assert.ok(!r.evidence.some((e) => e.kind === "contradicted"))
    has(r, "geometrized")
    lacks(r, "si")
  })
  test("a lecture-notes page: the unnormalized Hilbert action is contradicted by the 8πG it writes throughout", () => {
    // Carroll's notes print S = ∫√−g R before normalizing it, then 8πG in
    // dozens of equations among thousands: under 5% but far past eight.
    const equations = [
      "S = \\int d^4x \\sqrt{-g} R",
      ...Array.from({ length: 12 }, (_, i) => `R_{\\mu\\nu}^{(${i})} - \\frac12 R g_{\\mu\\nu} = 8\\pi G T_{\\mu\\nu}`),
      ...Array.from({ length: 400 }, (_, i) => `\\nabla_{\\mu} V^{(${i})} = 0`),
    ]
    const r = inferConventions({ text: "we will choose units in which c = 1;", equations })
    assert.strictEqual(r.kind, "narrowed")
    const c = r.evidence.find((e) => e.kind === "contradicted")
    assert.ok(c && c.kind === "contradicted" && c.constantTex === "G" && c.count === 12)
    assert.ok(r.evidence.some((e) => e.kind === "declaration" && e.label === "c = 1"))
    has(r, "c-only")
    lacks(r, "sixteen-pi-g", "geometrized")
  })
  test("a restored k_B never voids an untouched ħ = c = 1: the modifier is contradicted, the rest declares (review v2)", () => {
    const thermo = ["n = 1/(e^{E/k_B T} - 1)", "S = k_B \\ln \\Omega", "F = -k_B T \\ln Z", "\\langle E \\rangle = (3/2) k_B T"]
    const r = inferConventions({ text: "Throughout we set hbar = c = k_B = 1.", equations: thermo })
    assert.ok(r.evidence.some((e) => e.kind === "contradicted" && e.constantTex === "k_B"))
    assert.ok(r.evidence.some((e) => e.kind === "declaration" && e.label === "ħ = c = 1"))
    has(r, "hep-hl")
    lacks(r, "hep-hl-kb", "si")
  })
  test("a hedged first occurrence never deletes the adoption that follows (review v2)", () => {
    const a = inferConventions({ text: "One can set G = c = 1 to simplify the algebra. Throughout this paper we work in units with G = c = 1." })
    const b = inferConventions({ text: "Throughout this paper we work in units with G = c = 1. One can set G = c = 1 to simplify the algebra." })
    assert.strictEqual(a.kind, "narrowed")
    assert.deepStrictEqual(keys(a), keys(b))
    assert.strictEqual(a.evidence.filter((e) => e.kind === "declaration" || e.kind === "mention").length, 1)
  })
  test("a named system's first occurrence in a conversion remark never hides the later adoption (review v2)", () => {
    const a = inferConventions({
      text: "Earlier measurements are reported in atomic units, and we converted them for comparison. Throughout this paper we use atomic units.",
    })
    const b = inferConventions({ text: "Throughout this paper we use atomic units." })
    assert.strictEqual(a.kind, "narrowed")
    assert.deepStrictEqual(keys(a), keys(b))
  })
  test("two exclusive chains in adjacent display equations are alternatives, as in prose (review v2)", () => {
    const r = inferConventions({ equations: ["4\\pi\\varepsilon_0 = 1", "\\varepsilon_0 = 1"] })
    assert.strictEqual(r.kind, "insufficient")
    assert.strictEqual(r.evidence.filter((e) => e.kind === "mention").length, 2)
  })
  test("equation order never decides the verdict: a contested form stays contested (review v2)", () => {
    const one = "\\nabla \\cdot E = 4\\pi\\rho"
    const both = "\\nabla \\cdot E = 4\\pi\\rho \\qquad \\nabla \\cdot D = \\rho"
    const a = inferConventions({ equations: [one, both] })
    const b = inferConventions({ equations: [both, one] })
    assert.strictEqual(a.kind, b.kind)
    assert.deepStrictEqual(keys(a), keys(b))
    assert.notStrictEqual(a.kind, "conflict")
  })
  test("a span inherits what the document prints: three G's in a short section are still the document's (review v2)", () => {
    const main = {
      id: "main",
      equations: Array.from({ length: 30 }, (_, i) => `G_{ab}^{(${i})} = \\frac{8 \\pi G}{c^{4}} T_{ab}`),
    }
    const section = { id: "s", equations: ["S = \\int d^4x \\sqrt{-g} R", "R_{ab} = 0", "\\Box \\phi = 0"] }
    const doc = inferDocument([main, section])
    const s = doc.spans.find((x) => x.id === "s")!.report
    assert.ok(s.evidence.some((e) => e.kind === "contradicted"))
    assert.ok(!s.sets.flat().includes("sixteen-pi-g") || s.kind !== "narrowed")
    assert.deepStrictEqual(doc.mixed, [])
  })
  test("fractions fold with balanced braces, \\over, and a redundant wrapper (review v2)", () => {
    assert.strictEqual(normalizeTexForDetection("{\\frac {c^{4}}{16\\pi G}}"), "(c^{4})/(16 pi G)")
    assert.strictEqual(normalizeTexForDetection("{8\\pi G \\over c^{4}}"), "(8 pi G)/(c^{4})")
    assert.strictEqual(normalizeTexForDetection("\\tfrac12 R"), "(1)/(2) R")
    assert.strictEqual(normalizeTexForDetection("\\frac{\\frac{a}{b}}{c}"), "((a)/(b))/(c)")
  })
  test("\"can be rewritten in units where G = c = 1\" is a rewrite, not an adoption", () => {
    const r = inferConventions({ text: "In geometrized units where G = c = 1, this can be rewritten as a simpler form.", equations: body(0, 4) })
    assert.ok(r.evidence.some((e) => e.kind === "mention" && e.label === "G = c = 1"))
    assert.ok(!r.evidence.some((e) => e.kind === "declaration"))
  })
})
