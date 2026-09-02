// Guards on the inspector's rendering map and the tier stamps — data-level
// tests for app-adjacent tables (phases-3+4 review backlog).
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONVENTIONS, EM_RIDERS, TIERS } from "./convention"
import {
  EM_FLAVOR,
  EM_FLAVOR_UNDETERMINED,
  RENDERING,
  RENDERING_EXCLUDED,
  RENDERING_NOT_APPLICABLE,
} from "./rendering"

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
  test("every exclusion is deliberate, reasoned, and not also rendered", () => {
    for (const [key, reason] of Object.entries(RENDERING_EXCLUDED)) {
      assert.ok(key in CONVENTIONS, key)
      assert.ok(reason.length > 10, `${key} needs a real reason`)
      assert.ok(!(key in RENDERING), `${key} is both rendered and excluded`)
    }
  })
  test("COMPLETENESS: every convention is rendered, excluded, or explicitly not-applicable — exactly once", () => {
    const all = Object.keys(CONVENTIONS).sort()
    const partition = [
      ...Object.keys(RENDERING),
      ...Object.keys(RENDERING_EXCLUDED),
      ...RENDERING_NOT_APPLICABLE,
    ].sort()
    assert.deepStrictEqual(partition, all)
  })
})

describe("the detection flavor map", () => {
  test("COMPLETENESS: every convention is flavor-determined, undetermined, or mechanical — exactly once", () => {
    const all = Object.keys(CONVENTIONS).sort()
    const partition = [
      ...Object.keys(EM_FLAVOR),
      ...EM_FLAVOR_UNDETERMINED,
      ...RENDERING_NOT_APPLICABLE,
    ].sort()
    assert.deepStrictEqual(partition, all)
  })
  test("determined flavors agree with the rider-table rendering where both exist", () => {
    for (const [key, rendering] of Object.entries(RENDERING)) {
      const flavors = EM_FLAVOR[key]
      if (!flavors) continue
      if (["si", "gaussian", "esu", "emu", "heaviside-lorentz"].includes(rendering))
        assert.ok(flavors.includes(rendering as (typeof flavors)[number]), `${key}: ${rendering} vs ${flavors}`)
    }
  })
})
