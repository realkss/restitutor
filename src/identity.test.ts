// Identity-metadata layer tests (census §2.13(a), C04, C110).
import test, { describe } from "node:test"
import assert from "node:assert"
import { KNOWN_TAG_KEYS, checkCombinable, describeReport } from "./identity"

describe("the combination lint (census §2.13(a))", () => {
  test("the flagship: pole m_b vs MS-bar m_b conflict on scheme, scale unverifiable", () => {
    const r = checkCombinable(
      { tex: "m_b", tags: { scheme: "pole" } },
      { tex: "m_b", tags: { scheme: "MS-bar", scale: "m_H" } },
    )
    assert.strictEqual(r.combinable, false)
    assert.deepStrictEqual(r.conflicts, [{ key: "scheme", left: "pole", right: "MS-bar" }])
    assert.deepStrictEqual(r.unverifiable, [{ key: "scale", declaredOn: "right" }])
    const text = describeReport(r, "m_b(pole)", "m_b(MSbar)")
    assert.match(text, /identity conflict on scheme/)
    assert.match(text, /unverifiable: scale declared only on m_b\(MSbar\)/)
  })

  test("kelvin kinds: K_RJ vs K_CMB refuse to add", () => {
    const r = checkCombinable(
      { tags: { kind: "K_RJ", scale: "150 GHz" } },
      { tags: { kind: "K_CMB", scale: "150 GHz" } },
    )
    assert.strictEqual(r.combinable, false)
    assert.strictEqual(r.conflicts[0].key, "kind")
  })

  test("identical tags combine cleanly with an empty report", () => {
    const tags = { frame: "detector", averaging: "sky-averaged" }
    const r = checkCombinable({ tags }, { tags })
    assert.deepStrictEqual(r, { combinable: true, conflicts: [], unverifiable: [], strict: false })
    assert.strictEqual(describeReport(r), "")
  })

  test("a key on one side only is UNVERIFIABLE, not a conflict (three-valued discipline)", () => {
    const r = checkCombinable({ tags: { vintage: "CODATA-2022" } }, { tags: {} })
    assert.strictEqual(r.combinable, true)
    assert.deepStrictEqual(r.unverifiable, [{ key: "vintage", declaredOn: "left" }])
  })

  test("strict mode: an unverifiable key also bars combination", () => {
    const a = { tags: { scheme: "MS-bar" } }
    const b = { tags: { scheme: "MS-bar", scale: "m_H" } }
    assert.strictEqual(checkCombinable(a, b).combinable, true)
    assert.strictEqual(checkCombinable(a, b, { strict: true }).combinable, false)
  })

  test("an inherited prototype property never fabricates a tag", () => {
    const r = checkCombinable({ tags: { toString: "declared" } }, { tags: {} })
    assert.strictEqual(r.combinable, true)
    assert.deepStrictEqual(r.unverifiable, [{ key: "toString", declaredOn: "left" }])
  })

  test("the vector is OPEN (census C04): unknown keys are first-class", () => {
    const r = checkCombinable(
      { tags: { "xc-functional": "PBE", "double-counting": "FLL" } },
      { tags: { "xc-functional": "LDA", "double-counting": "FLL" } },
    )
    assert.strictEqual(r.combinable, false)
    assert.deepStrictEqual(r.conflicts, [{ key: "xc-functional", left: "PBE", right: "LDA" }])
  })

  test("calibration-stipulation is a well-known key of its own (census C110)", () => {
    assert.ok((KNOWN_TAG_KEYS as readonly string[]).includes("calibration-stipulation"))
    assert.ok((KNOWN_TAG_KEYS as readonly string[]).includes("vintage"))
  })
})
