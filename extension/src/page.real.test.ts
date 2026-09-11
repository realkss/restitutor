// The browser boundary, verified on real markup: the two Wikipedia captures
// in test/fixtures/wikipedia (CC BY-SA, see the README there) parsed by
// linkedom, run through the same page reading the content script runs —
// carrier scan, the display-first pool, section spans, convention
// detection, declared and defined symbols, fork recovery, and translation
// under the page's registry. What the browser showed on these pages is
// pinned here, so a change to the extraction or the page reading that
// would silently alter a verdict fails in node before it ships.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseHTML } from "linkedom"
import katex from "katex"
import { MathCandidate, scanForMath } from "./extract"
import { documentSpans, equationPool, pageReadings } from "./page"
import { inferDocument } from "../../src/detect"
import { detectForks } from "../../src/forks"
import { registryWithDeclarations, registryWithDefinitions } from "../../src/bridge"
import { findRegistryForSlug, translateTex } from "../../src/unitsEngine"
import { refuseNonEquation } from "../../src/gate"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const kx = katex as unknown as { __parse: (tex: string, o?: Record<string, unknown>) => unknown[] }
const SI = { system: "si", geometrized: false } as const

function readPage(file: string) {
  const html = readFileSync(fileURLToPath(new URL("../../test/fixtures/wikipedia/" + file, import.meta.url)), "utf8")
  const doc = parseHTML(html).document as unknown as Document
  const candidates: MathCandidate[] = scanForMath(doc as never)
  const pool = equationPool(candidates)
  const { spans, spanIdOf } = documentSpans(doc, pool)
  const report = inferDocument(spans)
  const forks = detectForks({ text: spans.map((s) => s.text ?? "").join("\n"), equations: spans.flatMap((s) => s.equations ?? []) })
  const readings = pageReadings(doc, candidates, GR, kx)
  let registry = readings.symbols.length ? registryWithDeclarations(GR, readings.symbols) : GR
  if (readings.definitions.length || readings.symbols.some((s) => s.expr)) registry = registryWithDefinitions(registry, readings, kx)
  const translate = (tex: string, reg = registry) => refuseNonEquation(tex) ?? translateTex(tex, kx, reg, SI)
  return { html, doc, candidates, pool, spans, spanIdOf, report, forks, readings, registry, translate }
}

describe("the English article on the field equations, as served", () => {
  const page = readPage("einstein-field-equations.en.html")
  test("every math element carries its TeX in alttext, and the display equations form the pool", () => {
    assert.strictEqual(page.candidates.length, 95)
    assert.ok(page.candidates.every((c) => c.via === "alttext"))
    const displays = page.candidates.filter((c) => c.display).length
    assert.strictEqual(displays, 49)
    assert.strictEqual(page.pool.length, displays)
  })
  test("Parsoid sections become spans, the lead first, and every pooled equation lands in exactly one", () => {
    assert.strictEqual(page.spans[0].label, "Lead")
    assert.ok(page.spans.some((s) => s.label === "Mathematical form"))
    assert.strictEqual(page.spans.length, 13)
    assert.strictEqual(
      page.spans.reduce((n, s) => n + (s.equations?.length ?? 0), 0),
      page.pool.length,
    )
    for (const c of page.pool) assert.ok(page.spanIdOf.get(c)?.startsWith("s"), "pooled equation without a span")
  })
  test("the page declares its symbols; a caveated reading stays off the registry, the definition of κ gets on", () => {
    const by = (symbol: string) => page.readings.symbols.find((s) => s.symbol === symbol)
    assert.strictEqual(by("G_{\\mu \\nu }")?.noun.noun, "Einstein tensor")
    assert.strictEqual(by("G_{\\mu \\nu }")?.caveat, undefined)
    assert.strictEqual(by("g_{\\mu \\nu }")?.caveat, "coordinate-convention")
    assert.strictEqual(by("\\kappa")?.caveat, "ambiguous")
    // The definition is printed inline on this page ("κ = 8πG/c⁴ ≈ 2.07665 × 10⁻⁴³ N⁻¹"),
    // outside the display pool: the definitions scan must reach it anyway.
    const kappa = page.readings.definitions.find((d) => d.symbol === "\\kappa")
    assert.ok(kappa && /8\\pi G/.test(kappa.expr) && /c\^\{4\}/.test(kappa.expr), JSON.stringify(page.readings.definitions))
    assert.deepStrictEqual(page.registry.bare["\\kappa"].dim, [-12, -12, 24, 0, 0])
  })
  test("the field equation written with κ translates under the page's registry and declines under the bare one", () => {
    const efe = page.candidates.find((c) => c.tex === "G_{\\mu \\nu }+\\Lambda g_{\\mu \\nu }=\\kappa T_{\\mu \\nu }")
    assert.ok(efe, "the field equation was not extracted as expected")
    const withPage = page.translate(efe.tex)
    assert.strictEqual(withPage.kind, "translated", JSON.stringify(withPage))
    assert.ok(withPage.kind === "translated" && !withPage.changed) // κ carries the G/c⁴ already: SI form
    assert.strictEqual(page.translate(efe.tex, GR).kind, "declined")
  })
  test("detection returns a set, never a guess: SI survives, geometrized does not, on visible constants alone", () => {
    assert.strictEqual(page.report.overall.kind, "narrowed")
    const sets = (page.report.overall as { sets: string[][] }).sets
    assert.ok(sets[0].includes("si"))
    assert.ok(!sets[0].includes("geometrized"))
    assert.ok(page.report.overall.evidence.some((e) => e.kind === "visible-constant"))
    assert.ok(!page.report.overall.evidence.some((e) => e.kind === "declaration"))
  })
  test("no dimensionless fork is printed here, and that is negative evidence, not a default", () => {
    assert.deepStrictEqual(page.forks.findings, [])
    assert.strictEqual(page.forks.negative, true)
  })
})

describe("the Arabic article on the field equations, as served (right-to-left, fractions as \\over)", () => {
  const page = readPage("einstein-field-equations.ar.html")
  test("nothing is flagged as display, so every math element is pooled, and Parsoid sections still split the page", () => {
    assert.strictEqual(page.candidates.length, 70)
    assert.strictEqual(page.candidates.filter((c) => c.display).length, 0)
    assert.strictEqual(page.pool.length, 70)
    assert.strictEqual(page.spans.length, 6)
    assert.strictEqual(page.spans[0].label, "Lead")
  })
  test("the title equation, printed with {8πG \\over c⁴}, is rewritten to \\frac and translates as already SI", () => {
    assert.ok(/8\\pi G \\over c\^\{4\}/.test(page.html), "the capture no longer prints \\over")
    const efe = page.candidates.find((c) => c.tex === "G_{\\mu \\nu }+\\Lambda g_{\\mu \\nu }={\\frac{8\\pi G}{c^{4}}}T_{\\mu \\nu }")
    assert.ok(efe, JSON.stringify(page.candidates.slice(0, 3).map((c) => c.tex)))
    const r = page.translate(efe.tex)
    assert.strictEqual(r.kind, "translated", JSON.stringify(r))
    assert.ok(r.kind === "translated" && !r.changed)
  })
  test("a stated G = c = 1 against a body that prints G is reported as a contradiction, and SI survives", () => {
    assert.strictEqual(page.report.overall.kind, "narrowed")
    assert.ok(page.report.overall.evidence.some((e) => e.kind === "contradicted"))
    const sets = (page.report.overall as { sets: string[][] }).sets
    assert.ok(sets[0].includes("si"))
    assert.ok(!sets[0].includes("geometrized"))
  })
  test("the miner finds no English declaration on an Arabic page, and the constants-only definition of K still lands", () => {
    assert.deepStrictEqual(page.readings.symbols, [])
    assert.ok(page.readings.definitions.some((d) => d.symbol === "K"))
  })
})
