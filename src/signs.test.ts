// Sign-convention axis tests (census §2.12, §10.1 class D, C15, C18).
import test, { describe } from "node:test"
import assert from "node:assert"
import {
  ABSENT,
  UNSTAMPED,
  contractionParity,
  determined,
  leviCivitaLowered,
  signatureTranslation,
} from "./signs"

describe("contraction parity (census §2.12: the bosonic translation rule)", () => {
  test("the census's own examples: (∂φ)² flips; m²φ² and F_μν F^μν do not", () => {
    assert.strictEqual(contractionParity(1), -1) // (∂φ)²: one contraction
    assert.strictEqual(contractionParity(0), 1) // m²φ²: none
    assert.strictEqual(contractionParity(2), 1) // F_μν F^μν: two
  })
  test("rejects non-counts", () => {
    assert.throws(() => contractionParity(-1))
    assert.throws(() => contractionParity(1.5))
  })
})

describe("signature translation (census §2.12)", () => {
  test("mostly-plus ↔ mostly-minus is mechanical, with the fermion caveat attached", () => {
    const t = signatureTranslation("mostly-plus", "mostly-minus")
    assert.strictEqual(t.kind, "mechanical")
    if (t.kind === "mechanical") {
      assert.strictEqual(t.termSign(1), -1)
      assert.match(t.caveat, /bosonic sector only/)
    }
  })

  test("flip∘flip = identity (census §10.1 class D)", () => {
    const fwd = signatureTranslation("mostly-plus", "mostly-minus")
    const back = signatureTranslation("mostly-minus", "mostly-plus")
    assert.strictEqual(fwd.kind, "mechanical")
    assert.strictEqual(back.kind, "mechanical")
    if (fwd.kind === "mechanical" && back.kind === "mechanical") {
      for (const c of [0, 1, 2, 3, 4, 7]) {
        assert.strictEqual(fwd.termSign(c) * back.termSign(c), 1, `contractions=${c}`)
      }
    }
  })

  test("same signature is the identity", () => {
    assert.strictEqual(signatureTranslation("mostly-plus", "mostly-plus").kind, "identity")
  })

  test("Euclidean refuses in BOTH directions with the tag-never-continue reason", () => {
    for (const [f, t] of [
      ["euclidean", "mostly-plus"],
      ["mostly-minus", "euclidean"],
    ] as const) {
      const r = signatureTranslation(f, t)
      assert.strictEqual(r.kind, "refuse")
      if (r.kind === "refuse") assert.match(r.reason, /never continue/)
    }
  })

  test("notational ict is declared unimplemented (v2), not refused and not faked", () => {
    const r = signatureTranslation("ict", "mostly-plus")
    assert.strictEqual(r.kind, "unimplemented")
    if (r.kind === "unimplemented") assert.match(r.reason, /i-carrying component riders/)
  })
})

describe("Levi-Civita typed by index position (census C18)", () => {
  test("ε^{0123} = −ε_{0123}: an upper-index declaration inverts on lowering", () => {
    assert.strictEqual(leviCivitaLowered({ value: "+1", indexPosition: "upper" }), "-1")
    assert.strictEqual(leviCivitaLowered({ value: "-1", indexPosition: "upper" }), "+1")
    assert.strictEqual(leviCivitaLowered({ value: "+1", indexPosition: "lower" }), "+1")
  })
})

describe("three-valued switches (census C15)", () => {
  test("the unstamped record is ABSENT on every axis — never a fabricated default", () => {
    for (const v of Object.values(UNSTAMPED)) {
      assert.strictEqual(v.state, "absent")
    }
  })
  test("determined/undetermined/absent are distinguishable states", () => {
    const d = determined<"mostly-plus" | "mostly-minus">("mostly-plus")
    assert.strictEqual(d.state, "determined")
    assert.notStrictEqual(d.state, ABSENT.state)
    assert.strictEqual(d.state === "determined" && d.value, "mostly-plus")
  })
})
