// Profiles scaffolding tests.
import test, { describe } from "node:test"
import assert from "node:assert"
import { CONVENTIONS } from "./convention"
import { PROFILES, defaultProfile, profileFor } from "./profiles"

describe("profiles", () => {
  test("every profile has a nonempty registry and a real source convention", () => {
    for (const p of PROFILES) {
      const entries =
        Object.keys(p.registry.bare).length +
        Object.keys(p.registry.exact).length +
        Object.keys(p.registry.indexed).length
      assert.ok(entries > 10, p.id)
      assert.ok(p.sourceConventionKey in CONVENTIONS, p.id)
    }
  })
  test("profileFor routes by slug and returns null off-registry", () => {
    assert.strictEqual(profileFor("en/Topics/Physics/Relativity-and-Gravitation/x")?.id, "gr")
    assert.strictEqual(profileFor("en/Topics/Chess/Opening-Prep/"), null)
  })
  test("the default profile is GR — the one production registry", () => {
    assert.strictEqual(defaultProfile().id, "gr")
  })
})
