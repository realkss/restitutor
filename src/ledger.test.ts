// The decline ledger's classes, read off the engine's and the gate's own
// outcomes on real equations — never off synthesized reason strings, so a
// reworded reason fails here rather than silently landing in "other".
import test, { describe } from "node:test"
import assert from "node:assert"
import katex from "katex"
import { findRegistryForSlug, translateTex } from "./unitsEngine"
import { refuseNonEquation } from "./gate"
import { classifyOutcome, emptyLedger, mentionedWithCue, record } from "./ledger"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const SI = { system: "si", geometrized: false } as const
const outcome = (tex: string) => classifyOutcome(refuseNonEquation(tex) ?? translateTex(tex, katex, GR, SI))

describe("the decline ledger", () => {
  test("every class is reached by a real outcome", () => {
    assert.strictEqual(outcome("r_s = 2M").class, "translated")
    assert.strictEqual(outcome("G_{ab} + \\Lambda g_{ab} = \\frac{8\\pi G T_{ab}}{c^{4}}").class, "unchanged")
    assert.strictEqual(outcome("\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}").class, "unknown-symbol")
    assert.deepStrictEqual(outcome("\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}").unknown, ["\\psi_{4}", "\\chi", "\\Xi^{ab}"])
    assert.strictEqual(outcome("\\Sigma = \\frac{M}{\\pi R^2}").class, "no-completion")
    assert.strictEqual(outcome("S = \\frac{A}{4}").class, "kept-explicit")
    assert.strictEqual(outcome("x = \\pm t").class, "unsupported")
    assert.strictEqual(outcome("\\mathrm{SL}(2,\\mathbb{R})").class, "refused")
    assert.strictEqual(outcome("G_{ab} + \\Lambda g_{ab} = {8\\pi G \\over c^{4}} T_{ab}").class, "reassembly")
    assert.strictEqual(outcome("r_s = \\frac{2M}").class, "parse")
    assert.strictEqual(outcome("r_s = 2M, \\quad T_H = \\frac{1}{8\\pi M}").class, "fragment")
    assert.strictEqual(outcome("E \\propto M").class, "proportional")
    assert.strictEqual(outcome("\\int \\rho \\, dV = M").class, "unsupported")
    assert.strictEqual(outcome("c = G = 1").class, "declaration")
    assert.strictEqual(outcome("(r_s = 2M)").class, "fragment")
    assert.strictEqual(outcome("\\sin(x").class, "parse")
  })
  test("nothing the engine says on these pages lands outside the classes", () => {
    // Every wording the engine used on the corpus (scripts/ledger.ts, 2026-09-11)
    // maps to a class; a reworded reason would surface as "other" here.
    for (const tex of ["r_s = 2M", "r_s = \\frac{2M}", "E \\propto M", "\\int \\rho \\, dV = M", "r' = 2M", "a = b = c"])
      assert.notStrictEqual(outcome(tex).class, "other", tex)
  })
  test("a no-completion decline that also names unknown symbols is an unknown-symbol case", () => {
    // The completion cannot be judged around symbols the registry cannot read.
    const o = outcome("\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}")
    assert.strictEqual(o.class, "unknown-symbol")
    assert.ok(/no c–G completion/.test(o.reason))
  })
  test("the ledger counts classes and the symbols that blocked equations", () => {
    const L = emptyLedger()
    for (const tex of ["r_s = 2M", "\\psi_4 = \\chi T_{ab}", "\\chi = 2", "S = A/4"]) record(L, outcome(tex))
    assert.strictEqual(L.counts.translated, 1)
    assert.strictEqual(L.counts["unknown-symbol"], 2)
    assert.strictEqual(L.counts["kept-explicit"], 1)
    assert.strictEqual(L.unknown.get("\\chi"), 2)
    assert.strictEqual(L.unknown.get("\\psi_{4}"), 1)
    assert.deepStrictEqual(L.others, [])
  })
  test("a declaration cue beside the symbol in the miner's surface is what a context reader could rescue", () => {
    const surface = "The Weyl scalar $\\psi_{4}$ is the outgoing radiation. We also write $\\chi\\,T_{ab}$.\nHere $\\Xi^{ab}$ appears."
    assert.strictEqual(mentionedWithCue(surface, "\\psi_{4}"), true)
    assert.strictEqual(mentionedWithCue(surface, "\\psi_4"), true) // braces are not identity
    assert.strictEqual(mentionedWithCue(surface, "\\chi"), false) // no cue in that sentence
    assert.strictEqual(mentionedWithCue(surface, "\\Xi^{ab}"), false)
    assert.strictEqual(mentionedWithCue(surface, "\\Omega"), false)
  })
})
