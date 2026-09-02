// The §6.5 declaration miner over its drafted sentence bed
// (docs/data/glossary.json, 21 sentences: 17 positives, 4 must-yield-nothing
// traps, 2 registry contradictions). Each positive must yield exactly the
// expected symbols with the expected noun and dimension, and nothing more.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dimQ } from "./convention"
import { dimEq, mineDeclarations, resolveNoun, splitSentences } from "./mine"

type Expected = { symbol: string; gloss: string; noun: string; dim: (number | [number, number])[]; matchedTemplate: string }
type Case = {
  id: string
  sentence: string
  expected: Expected[]
  mustYieldNothing?: boolean
  contradictsRegistry?: { symbol: string; registryDim: number[] }
}
const CASES: Case[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("../docs/data/glossary.json", import.meta.url)), "utf8"),
).tests

describe("census §6.5 declaration miner: the drafted sentence bed", () => {
  assert.strictEqual(CASES.length, 21)
  for (const c of CASES) {
    test(c.id, () => {
      const r = mineDeclarations(c.sentence)
      if (c.mustYieldNothing) {
        assert.deepStrictEqual(
          r.symbols.map((s) => s.symbol),
          [],
          `trap yielded ${r.symbols.map((s) => `${s.symbol}:${s.noun.noun}`).join(", ")}`,
        )
        return
      }
      for (const exp of c.expected) {
        const got = r.symbols.find((s) => s.symbol === exp.symbol)
        assert.ok(got, `missing ${exp.symbol}; got ${r.symbols.map((s) => s.symbol).join(", ") || "nothing"}`)
        assert.strictEqual(got.noun.noun, exp.noun, `${exp.symbol} read as ${got.noun.noun}`)
        assert.ok(dimEq(got.dim, dimQ(...exp.dim)), `${exp.symbol}: wrong dimension`)
        if (c.contradictsRegistry && c.contradictsRegistry.symbol === exp.symbol) {
          assert.ok(got.registry, `${exp.symbol}: registry clash not surfaced`)
          assert.ok(dimEq(got.registry.dim, dimQ(...c.contradictsRegistry.registryDim)))
        }
      }
      assert.strictEqual(
        r.symbols.length,
        c.expected.length,
        `extra symbols: ${r.symbols.map((s) => `${s.symbol}:${s.noun.noun}`).join(", ")}`,
      )
    })
  }
})

describe("what the miner refuses and what it folds", () => {
  test("\"we set c = 1\" is a normalization for the chain parser, not a reading", () => {
    const r = mineDeclarations("We set $c = 1$ throughout, and $G = 1$ as well.")
    assert.deepStrictEqual(r.symbols, [])
    assert.deepStrictEqual(r.definitions, [])
  })
  test("a dimensionless ratio is a definition, never a unit-axis triple", () => {
    const r = mineDeclarations("We define $\\eta = n_b/n_\\gamma$, the baryon-to-photon ratio.")
    assert.deepStrictEqual(r.symbols, [])
    assert.deepStrictEqual(r.definitions.map((d) => [d.symbol, d.expr]), [["\\eta", "n_b/n_\\gamma"]])
  })
  test("rendered pages carry Mathematical-Alphanumeric glyphs, which fold before matching", () => {
    const r = mineDeclarations("where 𝑚 is the mass of the particle and 𝑟 is the orbital radius.")
    assert.deepStrictEqual(r.symbols.map((s) => [s.symbol, s.noun.noun]), [["m", "mass"], ["r", "radius"]])
  })
  test("a symbol the registry reads differently carries both readings", () => {
    const r = mineDeclarations("Here $m$ is the comoving separation between the haloes.")
    assert.strictEqual(r.symbols.length, 1)
    assert.strictEqual(r.symbols[0].registry?.gloss, "mass")
  })
  test("the same reading as the registry raises no clash", () => {
    const r = mineDeclarations("Here $M$ is the mass of the black hole.")
    assert.strictEqual(r.symbols.length, 1)
    assert.strictEqual(r.symbols[0].registry, undefined)
  })
  test("noun resolution drops leading modifiers and tries the singular", () => {
    assert.strictEqual(resolveNoun("present-day Hubble constant")?.noun, "Hubble parameter")
    assert.strictEqual(resolveNoun("orbital separations")?.noun, "length")
    assert.strictEqual(resolveNoun("larger")?.noun, undefined)
  })
  test("sentences split on terminal punctuation, never inside 1.4 GHz or Ref. [4]", () => {
    const s = splitSentences("Sources above $S_\\nu$ at 1.4 GHz follow Ref. [4], where $S_\\nu$ is the flux density. Next sentence.")
    assert.strictEqual(s.length, 2)
  })
})
