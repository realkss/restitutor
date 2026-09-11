// LaTeXML equation groups on real markup shape: the synthetic fixture in
// test/fixtures/latexml (written for this test, in the form ar5iv and arXiv
// HTML give an eqnarray) parsed by linkedom and run through the scanner and
// the page reading — cells rejoined by row, rows folded into statements, a
// long equation reassembled across rows, a two-statement line split.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseHTML } from "linkedom"
import katex from "katex"
import { scanForMath } from "./extract"
import { documentSpans, equationPool } from "./page"
import { findRegistryForSlug, translateTex } from "../../src/unitsEngine"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const html = readFileSync(fileURLToPath(new URL("../../test/fixtures/latexml/equation-group.html", import.meta.url)), "utf8")
const doc = parseHTML(html).document as unknown as Document
const candidates = scanForMath(doc as never)

describe("LaTeXML equation groups", () => {
  test("an eqnarray's cells are rejoined by row and its rows folded into statements", () => {
    assert.deepStrictEqual(
      candidates.map((c) => c.tex),
      [
        "s^{2}=(\\Delta x)^{\\rm T}\\eta(\\Delta x) = (\\Delta x^{\\prime})^{\\rm T}\\eta(\\Delta x^{\\prime})",
        "s^{2} = (\\Delta x)^{\\rm T}\\Lambda^{\\rm T}\\eta\\Lambda(\\Delta x)",
        "r_{s}=2M",
        "E = m+ p",
        "D=26\\ \\ \\ {\\rm and}\\ \\ \\ a=1",
      ],
    )
  })
  test("a statement is decorated on every row it spans, and a lone equation on its math element", () => {
    const rowsOf = (c: (typeof candidates)[number]) => (c.rows ?? []).map((r) => (r as unknown as Element).tagName.toLowerCase())
    assert.deepStrictEqual(rowsOf(candidates[0]), ["tr"])
    assert.deepStrictEqual(rowsOf(candidates[1]), ["tr"])
    assert.deepStrictEqual(rowsOf(candidates[3]), ["tr", "tr"]) // E = mc² + … pc, broken across two rows
    assert.strictEqual(candidates[2].rows, undefined)
    assert.strictEqual((candidates[2].displayEl as unknown as Element).tagName.toLowerCase(), "math")
    assert.ok(candidates.every((c) => c.display && c.via === "alttext"))
  })
  test("the two-statement line reports both statements, and the span counts statements, not carriers", () => {
    assert.deepStrictEqual(candidates[4].statements, ["D=26", "a=1"])
    const { spans } = documentSpans(doc, equationPool(candidates))
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].label, "1 A section")
    assert.strictEqual(spans[0].equations?.length, 6) // 5 carriers, one holding two statements
  })
  test("what was a fragment now translates: the reassembled and the restated rows are equations the engine reads", () => {
    const SI = { system: "si", geometrized: false } as const
    const r = translateTex("r_{s}=2M", katex, GR, SI)
    assert.strictEqual(r.kind, "translated")
    const e = translateTex(candidates[3].tex, katex, GR, SI)
    assert.strictEqual(e.kind, "translated", JSON.stringify(e))
    assert.ok(e.kind === "translated" && e.changed && /c/.test(e.restoredTex), JSON.stringify(e)) // E = m + p gets its c factors back
  })
})
