// Census §6.5b: code identity as evidence of native units. The drafted table
// (docs/data/codes.json) carries positives that must fire and negatives that
// must not; a settled code in a usage frame declares, an unsettled one or a
// code no registry row absorbs is a mention that names its units.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CONVENTIONS } from "./convention"
import { DetectionReport, inferConventions } from "./detect"

type Rule = {
  id: string
  code: string
  implies: { keys: string[] } | { none: string }
  confidence: number
  positives: string[]
  negatives: string[]
}
const CODES: Rule[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("../docs/data/codes.json", import.meta.url)), "utf8"),
)

const named = (r: DetectionReport, code: string) =>
  r.evidence.filter((e) => (e.kind === "declaration" || e.kind === "mention") && e.label.startsWith(code))

describe("code identity (census §6.5b): the drafted positives and negatives", () => {
  assert.strictEqual(CODES.length, 38)
  for (const rule of CODES) {
    test(rule.id, () => {
      for (const p of rule.positives) {
        const r = inferConventions({ text: p })
        assert.ok(named(r, rule.code).length > 0, `positive did not fire: ${p}`)
        assert.notStrictEqual(r.kind, "conflict")
      }
      for (const n of rule.negatives) {
        const r = inferConventions({ text: n })
        assert.strictEqual(named(r, rule.code).length, 0, `negative fired: ${n}`)
      }
      if ("keys" in rule.implies) for (const k of rule.implies.keys) assert.ok(k in CONVENTIONS, k)
    })
  }
})

describe("what code identity asserts", () => {
  test("Elk in a usage frame declares Hartree units, both renderings; in a citation it is nothing", () => {
    const r = inferConventions({ text: "All calculations were performed with the all-electron code Elk, version 8.5." })
    const decl = r.evidence.find((e) => e.kind === "declaration")
    assert.ok(decl && decl.kind === "declaration" && decl.label.startsWith("Elk"))
    assert.deepStrictEqual(r.sets.flat(), ["hartree", "hartree-gaussian"])
    const cited = inferConventions({ text: "The Elk manual is available from the developers' website." })
    assert.strictEqual(named(cited, "Elk").length, 0)
  })
  test("a code whose units no registry row absorbs is a mention that names them, never a narrowing", () => {
    const r = inferConventions({ text: "Total energies were computed with VASP using a 520 eV plane-wave cutoff." })
    assert.strictEqual(r.kind, "insufficient")
    const m = named(r, "VASP")[0]
    assert.ok(m && m.kind === "mention" && /eV/.test(m.note))
  })
  test("a code below the confidence bar is a mention, even in a usage frame", () => {
    const r = inferConventions({ text: "We evolved the background with CLASS, quoting H in units of Mpc^-1 throughout." })
    assert.ok(named(r, "CLASS").every((e) => e.kind === "mention"))
    assert.strictEqual(r.kind, "insufficient")
  })
  test("a code name never overrides an explicit declaration: they intersect", () => {
    const r = inferConventions({
      text: "We use Rydberg atomic units throughout. The ground states were computed with Quantum ESPRESSO with a 60 Ry cutoff.",
    })
    assert.deepStrictEqual(r.sets.flat(), ["rydberg"])
  })
})
