// Guards on the inspector's rendering map and the tier stamps — data-level
// tests for app-adjacent tables (phases-3+4 review backlog).
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONVENTIONS, EM_RIDERS, TIERS } from "./convention"
import { RENDERING, RENDERING_EXCLUDED } from "../app/rendering"

describe("tier stamps", () => {
  test("every convention has a tier and every tier names a convention", () => {
    assert.deepStrictEqual(Object.keys(TIERS).sort(), Object.keys(CONVENTIONS).sort())
  })
  test("the four census v2 rows are stamped v2; everything else shipped is v1", () => {
    const v2 = Object.entries(TIERS).filter(([, t]) => t === "v2").map(([k]) => k).sort()
    assert.deepStrictEqual(v2, ["dirac-atomic", "geometrized-hl", "nr-code", "planck-hl"])
    assert.ok(Object.values(TIERS).every((t) => t !== "out_of_scope"))
  })
})

describe("the inspector's rendering map", () => {
  test("every key resolves to a convention and every value to a rider set", () => {
    for (const [key, rendering] of Object.entries(RENDERING)) {
      assert.ok(key in CONVENTIONS, key)
      assert.ok(rendering in EM_RIDERS, rendering)
    }
  })
  test("the Gaussian-adjacent atomic rows are excluded DELIBERATELY (α-ambiguity, census §6.4)", () => {
    for (const key of RENDERING_EXCLUDED) {
      assert.ok(key in CONVENTIONS, key)
      assert.ok(!(key in RENDERING), `${key} must stay excluded until the atomic magnetic story is encoded`)
    }
  })
})
