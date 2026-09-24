import test, { describe } from "node:test"
import assert from "node:assert"
import katexDefault from "katex"
import { dimensionOf } from "./unitsEngine"
import {
  HubRegistry,
  TargetSpec,
  TranslationResult,
  findRegistryForSlug,
  stripTrailingPunctuation,
  symbolKey,
  translateTex,
} from "./unitsEngine"

// katex's published types omit the internal (but stable and documented) __parse.
const katex = katexDefault as typeof katexDefault & {
  __parse: (tex: string, options?: Record<string, unknown>) => any[]
}

const reg = findRegistryForSlug("en/Topics/Physics/Relativity-and-Gravitation/index")!

const SI: TargetSpec = { system: "si", geometrized: false }
const GEO: TargetSpec = { system: "hl", geometrized: true }

function run(tex: string, target: TargetSpec = SI): TranslationResult {
  return translateTex(tex, katex, reg, target)
}

function restored(tex: string, target: TargetSpec = SI): string {
  const result = run(tex, target)
  assert.strictEqual(
    result.kind,
    "translated",
    `expected a translation for “${tex}”, got ${JSON.stringify(result)}`,
  )
  return (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex.replace(
    /\s+/g,
    "",
  )
}

function rendersInKatex(tex: string) {
  assert.doesNotThrow(() => katex.renderToString(tex, { displayMode: true, throwOnError: true }))
}

// The engine reads a handful of KaTeX parse-tree shapes directly. When a KaTeX
// bump changes one of them the engine goes quietly wrong (0.16.21 → 0.16.47
// dropped genfrac's `size` field and every \tfrac started emitting \frac), so
// the shapes are asserted here: a future bump fails loudly, right here, first.
describe("dimensionOf — the definitions path (census §6.5)", () => {
  const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
  test("8πG/c⁴ has the dimension of Einstein's constant, with G and c in the legend", () => {
    const r = dimensionOf("\\frac{8\\pi G}{c^4}", katexDefault, GR)
    assert.ok(r.kind === "dim", JSON.stringify(r))
    assert.deepStrictEqual(r.dim, [-12, -12, 24, 0, 0])
    assert.deepStrictEqual(r.legend.map((e) => e.tex).sort(), ["G", "c"])
  })
  test("a sum must already agree; nothing is restored to reconcile a definition", () => {
    const r = dimensionOf("E + m", katexDefault, GR)
    assert.ok(r.kind === "declined" && r.reasons[0].includes("different dimension"))
    const ok = dimensionOf("2 M + r", katexDefault, GR)
    assert.ok(ok.kind === "declined", "mass plus length is not a definition")
    const same = dimensionOf("r_s + 2 r", katexDefault, GR)
    assert.ok(same.kind === "dim" && same.dim[1] === 12)
  })
  test("an unknown symbol declines with the symbol named, and a relation is refused", () => {
    const u = dimensionOf("\\Xi / r", katexDefault, GR)
    assert.ok(u.kind === "declined" && u.unknown.length === 1)
    const rel = dimensionOf("\\kappa = 8\\pi G", katexDefault, GR)
    assert.ok(rel.kind === "declined" && rel.reasons[0].includes("relation"))
  })
  test("a pure number is dimensionless, and the style wrapper is peeled first", () => {
    const n = dimensionOf("{\\displaystyle 2\\pi}", katexDefault, GR)
    assert.ok(n.kind === "dim" && n.dim.every((x) => x === 0))
  })
})

describe("KaTeX parse-tree shape assumptions", () => {
  test("\\tfrac/\\dfrac/\\cfrac are a styling wrapper around a plain genfrac", () => {
    const shapes = [
      ["\\tfrac{1}{2}", "text", false],
      ["\\dfrac{1}{2}", "display", false],
      ["\\cfrac{1}{2}", "display", true],
    ] as const
    for (const [tex, style, continued] of shapes) {
      const nodes = katex.__parse(tex, { strict: false, trust: false, displayMode: true })
      assert.strictEqual(nodes.length, 1, `${tex}: unexpected top-level node count`)
      assert.strictEqual(nodes[0].type, "styling", `${tex}: KaTeX changed the fraction shape`)
      assert.strictEqual(nodes[0].style, style, `${tex}: styling.style changed`)
      const inner = nodes[0].body.filter((n: any) => n && n.type !== "kern")
      assert.strictEqual(inner.length, 1, `${tex}: styling body is no longer a lone node`)
      assert.strictEqual(inner[0].type, "genfrac", `${tex}: the wrapped node is not a genfrac`)
      assert.strictEqual(inner[0].continued, continued, `${tex}: genfrac.continued changed`)
    }
    const plain = katex.__parse("\\frac{1}{2}", { strict: false, trust: false, displayMode: true })
    assert.strictEqual(plain[0].type, "genfrac", "\\frac grew a wrapper")
  })

  test("a closing delimiter carrying a script becomes the base of a supsub", () => {
    const nodes = katex.__parse("(1)^2", { strict: false, trust: false, displayMode: true })
    const last = nodes[nodes.length - 1]
    assert.strictEqual(last.type, "supsub", "scripted close delimiter is no longer a supsub base")
    assert.strictEqual(last.base.type, "atom")
    assert.strictEqual(last.base.family, "close")
  })

  test("the five display-only environments parse only with displayMode", () => {
    for (const tex of [
      "\\begin{align} a &= b \\end{align}",
      "\\begin{gather} a = b \\end{gather}",
      "\\begin{split} a &= b \\end{split}",
      "\\begin{alignat}{1} a &= b \\end{alignat}",
      "a = b \\tag{1}",
    ]) {
      assert.throws(() => katex.__parse(tex, { strict: false, trust: false }), tex)
      assert.doesNotThrow(
        () => katex.__parse(tex, { strict: false, trust: false, displayMode: true }),
        tex,
      )
    }
  })

  // The pins below record shapes that the engine's source reconstruction has to
  // respect. Three kinds of node matter. Some carry no `loc` at all, so their
  // spelling cannot be sliced from the source and must be rebuilt from the node.
  // Some come out of a macro expansion and carry a "foreign" `loc`, whose offsets
  // index the macro body rather than the equation, so slicing the equation with
  // them returns garbage. And some relations arrive as `htmlmathml` pairs that
  // are recognized only by their MathML character.
  const parse = (tex: string) =>
    katex.__parse(tex, { strict: false, trust: false, displayMode: true })
  const withoutLocs = (tree: unknown) =>
    JSON.parse(JSON.stringify(tree, (key, value) => (key === "loc" ? undefined : value)))
  const isForeign = (node: any, source: string) =>
    node.loc !== undefined && node.loc.lexer.input !== source
  const loneMathml = (node: any) => {
    assert.strictEqual(node.type, "htmlmathml")
    assert.strictEqual(node.mathml.length, 1)
    return node.mathml[0]
  }

  // A rebuilt op head re-emits `\limits` or `\nolimits` exactly when the source
  // wrote one. KaTeX marks both spellings the same way, with alwaysHandleSupSub,
  // and only `limits` tells them apart, so the pin holds both halves: reading
  // the flag alone as "\limits was written" would turn `\int\nolimits` into
  // `\int\limits`.
  test("an op node has a name and no loc, and only a written \\limits or \\nolimits sets alwaysHandleSupSub, with limits telling them apart", () => {
    const [op] = parse("\\int x")
    assert.strictEqual(op.type, "op")
    assert.strictEqual(op.name, "\\int")
    assert.strictEqual(op.loc, undefined, "op nodes grew a loc")
    assert.notStrictEqual(op.alwaysHandleSupSub, true, "a bare \\int is marked as a written \\limits or \\nolimits")
    const [limits] = parse("\\int\\limits_0^1 x")
    assert.strictEqual(limits.type, "supsub")
    assert.strictEqual(limits.base.type, "op")
    assert.strictEqual(limits.base.loc, undefined)
    assert.strictEqual(limits.base.alwaysHandleSupSub, true)
    assert.strictEqual(limits.base.limits, true)
    const [nolimits] = parse("\\int\\nolimits_0^1 x")
    assert.strictEqual(nolimits.type, "supsub")
    assert.strictEqual(nolimits.base.type, "op")
    assert.strictEqual(nolimits.base.loc, undefined)
    assert.strictEqual(nolimits.base.alwaysHandleSupSub, true, "a written \\nolimits no longer sets alwaysHandleSupSub")
    assert.strictEqual(nolimits.base.limits, false, "a written \\nolimits no longer clears limits")
  })

  test("~, \\cdots and \\implies carry foreign-lexer locs", () => {
    const tilde = parse("a~b")
    assert.strictEqual(tilde[1].type, "spacing")
    assert.strictEqual(tilde[1].text, "\\nobreakspace")
    assert.ok(isForeign(tilde[1], "a~b"), "~ now carries a loc into the equation")

    const dots = parse("T_{a\\cdots b}")[0].sub.body[1]
    assert.strictEqual(dots.type, "atom")
    assert.strictEqual(dots.text, "\\@cdots")
    assert.ok(isForeign(dots, "T_{a\\cdots b}"), "\\cdots now carries a loc into the equation")

    const implies = parse("a \\implies b").filter((n: any) => n.type === "atom")
    assert.strictEqual(implies.length, 1)
    assert.strictEqual(implies[0].family, "rel")
    assert.strictEqual(implies[0].text, "\\Longrightarrow")
    assert.ok(isForeign(implies[0], "a \\implies b"), "\\implies now carries a loc into the equation")
  })

  test("\\neq, \\coloneqq and \\not are htmlmathml relations; := is two rel atoms", () => {
    const neq = loneMathml(parse("a \\neq b")[1])
    assert.strictEqual(neq.type, "mclass")
    assert.strictEqual(neq.mclass, "mrel")
    assert.deepStrictEqual(
      neq.body.map((n: any) => [n.type, n.text]),
      [["textord", "≠"]],
    )

    const coloneqq = loneMathml(parse("a \\coloneqq b")[1])
    assert.strictEqual(coloneqq.type, "op")
    assert.deepStrictEqual(
      coloneqq.body.map((n: any) => [n.type, n.text]),
      [["textord", "≔"]],
    )

    const notEq = parse("a \\not= b")
    assert.deepStrictEqual(
      [loneMathml(notEq[1]).type, loneMathml(notEq[1]).text],
      ["textord", "̸"],
    )
    assert.deepStrictEqual([notEq[2].type, notEq[2].family, notEq[2].text], ["atom", "rel", "="])

    const define = parse("a := b")
    assert.deepStrictEqual(
      define.slice(1, 3).map((n: any) => [n.type, n.family, n.text]),
      [
        ["atom", "rel", ":"],
        ["atom", "rel", "="],
      ],
    )
  })

  test("delimsizing and \\qquad carry no loc, and \\pm is a bin atom", () => {
    const [sized] = parse("\\bigl( a")
    assert.strictEqual(sized.type, "delimsizing")
    assert.deepStrictEqual([sized.size, sized.mclass, sized.delim], [1, "mopen", "("])
    assert.strictEqual(sized.loc, undefined, "delimsizing grew a loc")

    const [, kern] = parse("a \\qquad b")
    assert.strictEqual(kern.type, "kern")
    assert.deepStrictEqual(kern.dimension, { number: 2, unit: "em" })
    assert.strictEqual(kern.loc, undefined, "\\qquad grew a loc")

    const signs = parse("a = \\pm b \\pm c").filter((n: any) => n.text === "\\pm")
    assert.strictEqual(signs.length, 2, "\\pm after = and between terms")
    for (const pm of signs) assert.deepStrictEqual([pm.type, pm.family], ["atom", "bin"])
  })

  test("a shorthand ' is a loc-less textord \\prime, and x'_\\mu and x_\\mu' parse alike", () => {
    const [shorthand] = parse("x'")
    assert.strictEqual(shorthand.sup.type, "ordgroup")
    assert.strictEqual(shorthand.sup.loc, undefined)
    assert.deepStrictEqual(
      shorthand.sup.body.map((n: any) => [n.type, n.text, n.loc]),
      [["textord", "\\prime", undefined]],
    )
    const [explicit] = parse("x^\\prime")
    assert.strictEqual(explicit.sup.text, "\\prime")
    assert.notStrictEqual(explicit.sup.loc, undefined, "a written \\prime lost its loc")
    assert.deepStrictEqual(withoutLocs(parse("x'_\\mu")), withoutLocs(parse("x_\\mu'")))
  })

  test("^\\text{…} and ^\\mathrm{…} give script bodies without a loc", () => {
    const [text] = parse("T^\\text{out}")
    assert.strictEqual(text.sup.type, "text")
    assert.strictEqual(text.sup.font, "\\text")
    assert.strictEqual(text.sup.loc, undefined, "an unbraced \\text script grew a loc")
    const [roman] = parse("T^\\mathrm{T}")
    assert.strictEqual(roman.sup.type, "font")
    assert.strictEqual(roman.sup.font, "mathrm")
    assert.strictEqual(roman.sup.loc, undefined, "an unbraced \\mathrm script grew a loc")
  })

  test("\\boldsymbol is mclass → font → ordgroup", () => {
    const [bold] = parse("\\boldsymbol{R}")
    assert.strictEqual(bold.type, "mclass")
    assert.strictEqual(bold.mclass, "mord")
    assert.strictEqual(bold.body.length, 1)
    assert.strictEqual(bold.body[0].type, "font")
    assert.strictEqual(bold.body[0].font, "boldsymbol")
    assert.strictEqual(bold.body[0].body.type, "ordgroup")
    assert.deepStrictEqual(
      bold.body[0].body.body.map((n: any) => [n.type, n.text]),
      [["mathord", "R"]],
    )
  })

  test("X^{a}_{b} and X_{b}^{a} parse alike; only the scripts' locs keep the written order", () => {
    // scriptsTex reads the order from these spans; nothing else in the tree has it.
    assert.deepStrictEqual(withoutLocs(parse("X^{a}_{b}")), withoutLocs(parse("X_{b}^{a}")))
    for (const [tex, supFirst] of [
      ["X^{a}_{b}", true],
      ["X_{b}^{a}", false],
      ["X^a_b", true],
    ] as const) {
      const [n] = parse(tex)
      assert.strictEqual(n.type, "supsub", tex)
      assert.notStrictEqual(n.sup.loc, undefined, `${tex}: the superscript lost its loc`)
      assert.notStrictEqual(n.sub.loc, undefined, `${tex}: the subscript lost its loc`)
      assert.strictEqual(n.sup.loc.start < n.sub.loc.start, supFirst, tex)
    }
  })

  test("{T^{ab}}_{;b} is a supsub whose base is an ordgroup holding the tensor's supsub", () => {
    const nodes = parse("{T^{ab}}_{;b}")
    assert.strictEqual(nodes.length, 1)
    const [outer] = nodes
    assert.strictEqual(outer.type, "supsub")
    assert.strictEqual(outer.sup, undefined)
    assert.strictEqual(outer.base.type, "ordgroup")
    assert.strictEqual(outer.base.body.length, 1)
    const inner = outer.base.body[0]
    assert.strictEqual(inner.type, "supsub")
    assert.strictEqual(inner.base.text, "T")
    assert.strictEqual(inner.sub, undefined)
    assert.deepStrictEqual(
      inner.sup.body.map((n: any) => n.text),
      ["a", "b"],
    )
    assert.deepStrictEqual(
      outer.sub.body.map((n: any) => [n.type, n.family, n.text]),
      [
        ["atom", "punct", ";"],
        ["mathord", undefined, "b"],
      ],
    )
  })

  test("a font node records its name, not its spelling, and its body locates the command", () => {
    // fontCmdOf reads the command written just before the body's span: the
    // braced body of \mathrm{Hz} is located from its brace, an old-style
    // switch's body only through its letters, which sit after the command.
    const [braced] = parse("\\mathrm{Hz}")
    assert.strictEqual(braced.type, "font")
    assert.strictEqual(braced.font, "mathrm")
    assert.strictEqual(braced.loc, undefined, "a font node grew a loc")
    assert.strictEqual(braced.body.type, "ordgroup")
    assert.strictEqual(braced.body.loc.start, "\\mathrm".length)
    const [group] = parse("{\\bf p + m}")
    assert.strictEqual(group.type, "ordgroup")
    const [font] = group.body
    assert.strictEqual(font.type, "font")
    assert.strictEqual(font.font, "mathbf", "\\bf no longer names mathbf")
    assert.strictEqual(font.body.type, "ordgroup")
    assert.strictEqual(font.body.loc, undefined, "an old-style switch's body grew a loc")
    assert.strictEqual(font.body.body[0].loc.start, "{\\bf ".length)
    const [single] = parse("\\mathrm{m}")
    assert.strictEqual(single.body.type, "mathord", "a one-letter font body is no longer the bare letter")
  })

  test("\\text is a text node with its command in font and its letters located one by one", () => {
    const [text] = parse("\\text{const.}")
    assert.strictEqual(text.type, "text")
    assert.strictEqual(text.font, "\\text")
    assert.deepStrictEqual(
      text.body.map((n: any) => [n.type, n.text]),
      ["c", "o", "n", "s", "t", "."].map((ch) => ["textord", ch]),
    )
    assert.ok(text.body.every((n: any) => n.loc?.lexer.input === "\\text{const.}"))
    const [roman] = parse("\\textrm{m}")
    assert.strictEqual(roman.type, "text")
    assert.strictEqual(roman.font, "\\textrm")
  })

  test("{\\textstyle\\frac12} and {\\tfrac12} parse to the same shape; only the source tells them apart", () => {
    const written = parse("{\\textstyle\\frac12}")
    const synthesized = parse("{\\tfrac12}")
    assert.deepStrictEqual(withoutLocs(written), withoutLocs(synthesized))
    assert.strictEqual(written[0].type, "ordgroup")
    assert.strictEqual(written[0].body[0].type, "styling")
    assert.strictEqual(written[0].body[0].style, "text")
  })
})

describe("registry routing", () => {
  test("matches GR pages in every language and nothing else", () => {
    assert.ok(findRegistryForSlug("en/Topics/Physics/Relativity-and-Gravitation/index"))
    assert.ok(
      findRegistryForSlug(
        "ko/Topics/Physics/Relativity-and-Gravitation/IV.-Cosmology/01.-Cosmography/index",
      ),
    )
    assert.strictEqual(findRegistryForSlug("en/Topics/Physics/Quantum-Computing/index"), null)
    assert.strictEqual(findRegistryForSlug("en/Topics/Chess/index"), null)
  })
})

describe("SI restoration", () => {
  test("Schwarzschild radius: r_s = 2M", () => {
    assert.strictEqual(restored("r_s = 2M"), "r_{s}=\\frac{2GM}{c^{2}}")
  })

  test("Einstein field equations pick up G/c⁴", () => {
    const result = run("G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      const stripped = result.restoredTex.replace(/\s+/g, "")
      assert.ok(stripped.includes("8\\piGT_{ab}"), stripped)
      assert.ok(stripped.includes("c^{4}"), stripped)
      rendersInKatex(result.restoredTex)
    }
  })

  test("surface gravity: κ = 1/(4M) → c⁴/4GM", () => {
    assert.strictEqual(restored("\\kappa = \\frac{1}{4M}"), "\\kappa=\\frac{c^{4}}{4GM}")
  })

  test("Hawking temperature regains exactly the site's own c", () => {
    assert.strictEqual(
      restored("T_H = \\frac{\\hbar\\kappa}{2\\pi k_B}"),
      "T_{H}=\\frac{\\hbar\\kappa}{2\\pik_{B}c}",
    )
  })

  test("Bekenstein–Hawking entropy: S = k_B A / 4ħ", () => {
    const out = restored("S = \\frac{k_B A}{4\\hbar}")
    assert.ok(out.includes("c^{3}"), out)
    assert.ok(out.includes("4G\\hbar") || out.includes("4\\hbarG"), out)
  })

  test("Newtonian potential: Φ = −M/r", () => {
    assert.strictEqual(restored("\\Phi = -\\frac{M}{r}"), "\\Phi=-\\frac{GM}{r}")
  })

  test("metric line element restores c²dt² with G/c² inside the parenthesis", () => {
    const out = restored("ds^2 = -\\left(1 - \\frac{2M}{r}\\right)dt^2")
    assert.ok(out.includes("c^{2}dt^2"), out)
    assert.ok(out.includes("\\frac{2GM}{rc^{2}}"), out)
  })

  test("proper time chain: dτ² = −g dx dx = −ds²", () => {
    const out = restored("d\\tau^2 = -g_{ab}dx^a dx^b = -ds^2")
    assert.strictEqual(out.split("\\frac").length - 1, 2)
    assert.ok(out.includes("{c^{2}}"), out)
  })

  test("orbital speed keeps the constant inside the square root", () => {
    assert.strictEqual(restored("v = \\sqrt{\\frac{M}{r}}"), "v=\\sqrt{\\frac{GM}{r}}")
  })

  test("already-consistent equations pass through unchanged", () => {
    const result = run("T_H = \\frac{\\hbar\\kappa}{2\\pi k_B c}")
    assert.strictEqual(result.kind, "translated")
    if (result.kind === "translated") {
      assert.strictEqual(result.changed, false)
    }
  })

  test("trailing prose punctuation is stripped, not translated", () => {
    assert.strictEqual(restored("r_s = 2M."), "r_{s}=\\frac{2GM}{c^{2}}")
    const result = run(
      "\\Gamma^{\\rho}{}_{\\mu\\nu} = \\tfrac{1}{2}\\,g^{\\rho\\sigma}\\left(\\partial_\\mu g_{\\nu\\sigma} + \\partial_\\nu g_{\\mu\\sigma} - \\partial_\\sigma g_{\\mu\\nu}\\right),",
    )
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
  })

  test("Christoffel definition is consistent and unchanged", () => {
    const result = run(
      "\\Gamma^{\\rho}{}_{\\mu\\nu} = \\tfrac{1}{2}\\,g^{\\rho\\sigma}\\left(\\partial_\\mu g_{\\nu\\sigma} + \\partial_\\nu g_{\\mu\\sigma} - \\partial_\\sigma g_{\\mu\\nu}\\right)",
    )
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") assert.strictEqual(result.changed, false)
  })

  test("four-velocity normalization: g u u = −1 stays put", () => {
    const result = run("g_{ab}u^a u^b = -1")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") assert.strictEqual(result.changed, false)
  })

  test("plane-wave phase e^{-iωt} is dimensionless as written", () => {
    const result = run("\\phi = e^{-i\\omega t}")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") assert.strictEqual(result.changed, false)
  })

  test("restored output renders in KaTeX", () => {
    for (const tex of [
      "r_s = 2M",
      "\\kappa = \\frac{1}{4M}",
      "ds^2 = -\\left(1 - \\frac{2M}{r}\\right)dt^2 + \\frac{dr^2}{1 - \\frac{2M}{r}} + r^2 d\\Omega^2",
      "\\Phi = -\\frac{M}{r}",
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") rendersInKatex(result.restoredTex)
    }
  })
})

describe("review regressions", () => {
  test("F1: every fraction command survives both the no-op and the insertion path", () => {
    for (const cmd of ["\\frac", "\\tfrac", "\\dfrac", "\\cfrac"]) {
      // Insertion path: the command must ride through emitTermWith.
      const inserted = run(`\\kappa = ${cmd}{1}{4M}`)
      assert.strictEqual(inserted.kind, "translated", `${cmd} → ${JSON.stringify(inserted)}`)
      if (inserted.kind === "translated") {
        assert.ok(
          inserted.restoredTex.includes(`${cmd}{c^{4}}{4GM}`),
          `${cmd} insertion → ${inserted.restoredTex}`,
        )
        rendersInKatex(inserted.restoredTex)
      }
      // No-op path: the rebuilt equation must be the source verbatim.
      const noop = run(`\\kappa = ${cmd}{c^{4}}{4GM}`)
      assert.strictEqual(noop.kind, "translated", `${cmd} → ${JSON.stringify(noop)}`)
      if (noop.kind === "translated") {
        assert.strictEqual(noop.changed, false, `${cmd} no-op → ${noop.restoredTex}`)
        assert.ok(noop.restoredTex.includes(cmd), `${cmd} no-op → ${noop.restoredTex}`)
      }
    }
  })

  test("literal zeros are dimension-transparent: vacuum/null/conservation equations pass through", () => {
    for (const tex of ["R_{\\mu\\nu} = 0", "ds^2 = 0", "\\nabla_a T^{ab} = 0"]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") assert.strictEqual(result.changed, false, tex)
    }
  })

  test("a zero never picks up constants (no '0c'), and \\dot survives", () => {
    const result = run("\\dot{r} = 0")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.strictEqual(result.changed, false)
      assert.ok(result.restoredTex.includes("\\dot{r}"), result.restoredTex)
      assert.ok(!result.restoredTex.includes("0c"), result.restoredTex)
    }
  })

  test("function heads survive re-emission", () => {
    const result = run("z = \\sin\\omega t")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.ok(result.restoredTex.includes("\\sin"), result.restoredTex)
      assert.strictEqual(result.changed, false)
    }
    const squared = run("ds^2 = r^2 \\sin^2\\theta \\, d\\phi^2")
    assert.strictEqual(squared.kind, "translated", JSON.stringify(squared))
    if (squared.kind === "translated") {
      assert.ok(squared.restoredTex.includes("\\sin^{2}"), squared.restoredTex)
      rendersInKatex(squared.restoredTex)
    }
  })

  test("source-level '/' division survives the no-insertion path", () => {
    for (const [tex, keep] of [
      ["v = p/m", "p/m"],
      ["\\nu = c/\\lambda", "c/\\lambda"],
      ["H = \\dot{a}/a", "\\dot{a}/a"],
    ] as const) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.ok(result.restoredTex.includes(keep), `${tex} → ${result.restoredTex}`)
        assert.strictEqual(result.changed, false, tex)
      }
    }
  })

  test("slash inside an expression exponent survives", () => {
    const result = run("z = e^{i\\phi/2}")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.ok(result.restoredTex.includes("/2"), result.restoredTex)
    }
  })

  test("powered \\left(...\\right) groups keep delimiters and inner restorations", () => {
    const result = run(
      "ds^2 = -\\left(1 - \\frac{2M}{r}\\right)dt^2 + \\left(1 - \\frac{2M}{r}\\right)^{-1}dr^2 + r^2 d\\Omega^2",
    )
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.ok(
        result.restoredTex.includes("\\left(1 - \\frac{2GM}{rc^{2}}\\right)^{-1}"),
        result.restoredTex,
      )
      rendersInKatex(result.restoredTex)
    }
  })

  test("all-digit raised indices are components, not powers", () => {
    const t00 = run("T^{00} = \\rho")
    assert.strictEqual(t00.kind, "translated", JSON.stringify(t00))
    if (t00.kind === "translated") {
      assert.ok(t00.restoredTex.replace(/\s+/g, "").includes("\\rhoc^{2}"), t00.restoredTex)
    }
    const efe = run("G^{00} = 8\\pi T^{00}")
    assert.strictEqual(efe.kind, "translated", JSON.stringify(efe))
    if (efe.kind === "translated") {
      assert.ok(efe.restoredTex.includes("c^{4}"), efe.restoredTex)
    }
    const x0 = run("x^0 = ct")
    assert.strictEqual(x0.kind, "translated", JSON.stringify(x0))
    if (x0.kind === "translated") assert.strictEqual(x0.changed, false)
  })

  test("standard aligned rows with &= translate row by row", () => {
    const result = run("\\begin{aligned} r_s &= 2M \\\\ &= 2M \\end{aligned}")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      const rows = result.restoredTex.split("\\\\")
      assert.strictEqual(rows.length, 2, result.restoredTex)
      assert.ok(
        rows.every((r) => r.includes("&=")),
        result.restoredTex,
      )
      assert.ok(result.restoredTex.includes("\\frac{2GM}{c^{2}}"), result.restoredTex)
      rendersInKatex(result.restoredTex)
    }
  })

  test("flat brackets keep their delimiter type", () => {
    const result = run("E = M[1 + v^2]")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.ok(/\[1 \+ .*\]/.test(result.restoredTex), result.restoredTex)
    }
  })

  test("font wrappers survive analysis and emission", () => {
    const plain = run("\\mathbf{p} = m\\mathbf{v}")
    assert.strictEqual(plain.kind, "translated", JSON.stringify(plain))
    if (plain.kind === "translated") {
      assert.ok(plain.restoredTex.includes("\\mathbf{p}"), plain.restoredTex)
      assert.ok(plain.restoredTex.includes("\\mathbf{v}"), plain.restoredTex)
    }
    const powered = run("E^2 = m^2 + \\mathbf{p}^2")
    assert.strictEqual(powered.kind, "translated", JSON.stringify(powered))
    if (powered.kind === "translated") {
      assert.ok(powered.restoredTex.includes("\\mathbf{p}^{2}"), powered.restoredTex)
      rendersInKatex(powered.restoredTex)
    }
  })

  test("unary minus after a binary operator folds instead of vanishing", () => {
    const result = run("E = p - -p")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.ok(result.restoredTex.includes("+ pc"), result.restoredTex)
    }
  })

  test("digit-subscripted differentials take their power", () => {
    const result = run("ds^2 = dx_1^2 + dx_2^2")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") assert.strictEqual(result.changed, false)
  })

  test("F6: the display-only environments are not reported as unparseable TeX", () => {
    for (const tex of [
      "\\begin{align} r_s &= 2M \\end{align}",
      "\\begin{gather} r_s = 2M \\end{gather}",
      "\\begin{split} r_s &= 2M \\end{split}",
      "\\begin{alignat}{1} r_s &= 2M \\end{alignat}",
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.ok(result.restoredTex.includes("\\frac{2GM}{c^{2}}"), result.restoredTex)
        rendersInKatex(result.restoredTex)
      }
    }
    // \label really is undefined in KaTeX — that decline is correct and stays.
    const labelled = run("\\label{eq:rs} r_s = 2M")
    assert.strictEqual(labelled.kind, "declined", JSON.stringify(labelled))
  })

  test("F7: alignment tabs, row gaps and the environment name all survive", () => {
    // A tab before every relation, not just the first.
    const twoTabs = run("\\begin{aligned} r_s &= 2M &= 2M \\end{aligned}")
    assert.strictEqual(twoTabs.kind, "translated", JSON.stringify(twoTabs))
    if (twoTabs.kind === "translated") {
      assert.strictEqual((twoTabs.restoredTex.match(/&/g) ?? []).length, 2, twoTabs.restoredTex)
      rendersInKatex(twoTabs.restoredTex)
    }
    // Row spacing is content, not decoration.
    const gapped = run("\\begin{aligned} r_s &= 2M \\\\[6pt] r_s &= 2M \\end{aligned}")
    assert.strictEqual(gapped.kind, "translated", JSON.stringify(gapped))
    if (gapped.kind === "translated") {
      assert.ok(gapped.restoredTex.includes("\\\\[6pt]"), gapped.restoredTex)
      rendersInKatex(gapped.restoredTex)
    }
    // The source environment is echoed, not rewritten to aligned.
    const arr = run("\\begin{array}{cc} r_s &= 2M \\end{array}")
    assert.strictEqual(arr.kind, "translated", JSON.stringify(arr))
    if (arr.kind === "translated") {
      assert.ok(arr.restoredTex.includes("\\begin{array}{cc}"), arr.restoredTex)
      assert.ok(!arr.restoredTex.includes("aligned"), arr.restoredTex)
      rendersInKatex(arr.restoredTex)
    }
  })

  test("F7: cmpNorm no longer blinds the backstop to lost alignment", () => {
    // An environment the engine has no row model for must not be silently
    // rewritten into `aligned` — the backstop has to be able to see the tabs.
    const cases = run("\\begin{cases} r_s = 2M \\\\ r_s = 2M \\end{cases}")
    assert.strictEqual(cases.kind, "declined", JSON.stringify(cases))
  })

  test("F4: an upright \\mathrm{d} differential keeps its head", () => {
    // Already consistent: the rebuilt equation must be the source verbatim.
    const noop = run("ds^2 = -c^2\\mathrm{d}t^2 + \\mathrm{d}r^2")
    assert.strictEqual(noop.kind, "translated", JSON.stringify(noop))
    if (noop.kind === "translated") {
      assert.strictEqual(noop.changed, false, noop.restoredTex)
      assert.strictEqual(
        (noop.restoredTex.match(/\\mathrm\{d\}/g) ?? []).length,
        2,
        noop.restoredTex,
      )
    }
    // Mutating: this used to ship `c^{2}dt^2`, silently dropping `\mathrm{`.
    const inserted = run("ds^2 = -\\left(1 - \\frac{2M}{r}\\right)\\mathrm{d}t^2")
    assert.strictEqual(inserted.kind, "translated", JSON.stringify(inserted))
    if (inserted.kind === "translated") {
      assert.ok(inserted.restoredTex.includes("\\mathrm{d}t^2"), inserted.restoredTex)
      assert.ok(!/[^{]dt\^2/.test(inserted.restoredTex), inserted.restoredTex)
      rendersInKatex(inserted.restoredTex)
    }
    // \partial keeps working, and so does the ordered form d^2x.
    assert.strictEqual(run("ds^2 = \\mathrm{d}x^a \\mathrm{d}x^b g_{ab}").kind, "translated")
  })

  test("F2: a scripted closing delimiter still closes its group", () => {
    for (const [tex, keep] of [
      ["E = m(1 + v)^2", "(1 + \\frac{v}{c})^{2}"],
      ["E = m[1 + v]^2", "[1 + \\frac{v}{c}]^{2}"],
      ["E = m(1 + v)_i", "(1 + \\frac{v}{c})_{i}"],
    ] as const) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.ok(result.restoredTex.includes(keep), `${tex} → ${result.restoredTex}`)
        rendersInKatex(result.restoredTex)
      }
    }
    // The \left…\right control never regressed; keep it pinned alongside.
    assert.strictEqual(run("E = m\\left(1 + v\\right)^2").kind, "translated")
  })

  test("F3: control-word delimiters do not glue onto the next letter", () => {
    for (const [tex, glued] of [
      ["\\langle v \\rangle = 0", "\\langlev"],
      ["E = m\\langle v \\rangle", "\\langlev"],
      ["x = \\lbrack r \\rbrack", "\\lbrackr"],
    ] as const) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.ok(!result.restoredTex.includes(glued), result.restoredTex)
        rendersInKatex(result.restoredTex)
      }
    }
  })

  test("F5: G = c = 1 declines instead of shipping \\frac{Gc}{c} and 1G", () => {
    for (const target of [SI, GEO]) {
      const result = run("G = c = 1", target)
      assert.strictEqual(result.kind, "declined", JSON.stringify(result))
      if (result.kind === "declined") {
        assert.ok(
          result.reasons.some((r) => r.includes("constants themselves")),
          JSON.stringify(result.reasons),
        )
      }
    }
  })

  test("F5: a bare literal 1 takes no constants, and inserted ones merge", () => {
    // A whole side that is just `1` is a convention marker, not a quantity.
    const unit = run("\\Omega = 1")
    assert.strictEqual(unit.kind, "translated", JSON.stringify(unit))
    if (unit.kind === "translated") {
      assert.ok(!unit.restoredTex.includes("1G"), unit.restoredTex)
      assert.ok(!/1\s*c/.test(unit.restoredTex), unit.restoredTex)
    }
    // A constant already in the term merges with the inserted power instead of
    // sitting next to it (`mcc`) or across a fraction bar (`\frac{Gc}{c}`).
    assert.strictEqual(restored("E = mc"), "E=mc^{2}")
    // A literal 1 that is one term of a sum still pins the sum to dimensionless.
    assert.strictEqual(run("E^2 = 1 - \\frac{2M}{r}").kind, "declined")
  })

  test("F8: the \\r* delimiter family closes its opener", () => {
    for (const tex of [
      "x = m\\lVert v \\rVert",
      "x = \\lfloor r \\rfloor",
      "x = \\lceil r \\rceil",
    ]) {
      const result = run(tex)
      assert.notStrictEqual(
        result.kind,
        "declined",
        `${tex} → ${JSON.stringify(result.kind === "declined" ? result.reasons : result)}`,
      )
    }
  })

  test("F9: bars pair as an absolute value, and an unpairable | is a bar, not an unknown symbol", () => {
    // Since step 8 the pairing of m|v| is unique, and |v| has the dimension of v.
    assert.strictEqual(restored("E = m|v|"), "E=m|v|c")
    const result = run("p(a|b) = 1")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      assert.deepStrictEqual(result.unknown, [], "| is a delimiter, never a dictionary miss")
      assert.deepStrictEqual(result.reasons, ["a bar “|” the engine cannot pair as an absolute value"])
    }
  })

  test("the reassembly backstop covers mutating translations, not just no-ops", () => {
    // \enspace is a kern with no span, so the emitter drops it, and the
    // comparison keeps it (it is not one of the kerns it can name). With a
    // constant to insert, a dropped token like this used to ride out unchecked;
    // replaying the emission with the insertion masked makes it visible, and
    // declining is the contract-correct outcome. (The witness was E = 2p^a_b,
    // re-emitted subscript first until scripts kept their written order.) The
    // backstop names a divergence that is only such spacing; it is still the
    // masked replay that sees it.
    const result = run("E = m\\enspace v")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      assert.deepStrictEqual(result.reasons, [
        "the spacing “\\enspace”, which the engine cannot re-emit as written, is not supported",
      ])
    }
    assert.strictEqual(restored("E = 2p^a_b"), "E=2p^{a}_{b}c")
  })

  test("insertion scaffolding is not mistaken for a divergence", () => {
    // \left(…\right) around a bare sum, and the dropped redundant 1 numerator,
    // are part of the insertion itself — the masked replay must not see them.
    const wrapped = run("E = m{1 + v^2}")
    assert.strictEqual(wrapped.kind, "translated", JSON.stringify(wrapped))
    if (wrapped.kind === "translated") {
      assert.ok(wrapped.restoredTex.includes("\\left("), wrapped.restoredTex)
      rendersInKatex(wrapped.restoredTex)
    }
    assert.strictEqual(restored("\\kappa = \\frac{1}{4M}"), "\\kappa=\\frac{c^{4}}{4GM}")
  })

  test("every unchanged result is verbatim the source (reassembly backstop)", () => {
    const cmp = (s: string) => s.replace(/\\qquad|\\quad|\\[,;!:]/g, "").replace(/[\s{}&]/g, "")
    for (const tex of [
      "g_{ab}u^a u^b = -1",
      "\\Gamma^{\\rho}{}_{\\mu\\nu} = \\tfrac{1}{2}\\,g^{\\rho\\sigma}\\left(\\partial_\\mu g_{\\nu\\sigma} + \\partial_\\nu g_{\\mu\\sigma} - \\partial_\\sigma g_{\\mu\\nu}\\right)",
      "v = p/m",
      "z = \\sin\\omega t",
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated" && !result.changed) {
        assert.strictEqual(cmp(result.restoredTex), cmp(tex), tex)
      }
    }
  })
})

// Registry readings added 2026-08-17, pending CEO merge review. Each is checked
// against the equation on "00. Conventions and Notation" that motivated it.
describe("registry additions (2026-08-17)", () => {
  test("bare g is the metric determinant: the d'Alembertian passes through", () => {
    const result = run(
      "\\Box \\phi = \\frac{1}{\\sqrt{-g}} \\partial_\\mu \\left( \\sqrt{-g}\\, g^{\\mu \\nu} \\partial_\\nu \\phi \\right)",
    )
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.strictEqual(result.changed, false, result.restoredTex)
      assert.ok(
        result.legend.some((l) => l.tex === "g" && l.gloss.includes("determinant")),
        JSON.stringify(result.legend),
      )
    }
  })

  test("indexed omega is a one-form; bare omega is still an angular frequency", () => {
    const riemann = run(
      "\\left(\\nabla_a \\nabla_b - \\nabla_b \\nabla_a\\right)\\omega_c = R_{abc}{}^{d}\\,\\omega_d",
    )
    assert.strictEqual(riemann.kind, "translated", JSON.stringify(riemann))
    if (riemann.kind === "translated") assert.strictEqual(riemann.changed, false)
    // Bare omega keeps its dimensional reading, so e^{-iωt} is still dimensionless.
    const phase = run("\\phi = e^{-i\\omega t}")
    assert.strictEqual(phase.kind, "translated", JSON.stringify(phase))
    if (phase.kind === "translated") assert.strictEqual(phase.changed, false)
    const bare = run("\\omega = \\frac{v}{r}")
    assert.strictEqual(bare.kind, "translated", JSON.stringify(bare))
    if (bare.kind === "translated") {
      assert.ok(
        bare.legend.some((l) => l.tex === "\\omega" && l.gloss.includes("angular frequency")),
        JSON.stringify(bare.legend),
      )
    }
  })

  test("CEO ruling: \\partial_t resolves wherever \\partial_a already does", () => {
    // The four labels the corpus actually carries, each on \partial.
    for (const label of ["t", "r", "\\theta", "\\phi"]) {
      const tex = `\\Box \\phi = \\partial_${label} \\partial_${label} \\phi`
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.strictEqual(result.changed, false, result.restoredTex)
        assert.ok(
          result.legend.some((l) => l.gloss.includes("coordinate derivative")),
          `${tex} → ${JSON.stringify(result.legend)}`,
        )
      }
    }
    // A coordinate label reads the same as an abstract index does.
    const abstract = run("\\Box \\phi = \\partial_a \\partial_a \\phi")
    const coordinate = run("\\Box \\phi = \\partial_t \\partial_r \\phi")
    assert.strictEqual(abstract.kind, "translated")
    assert.strictEqual(coordinate.kind, "translated")
    // And it reaches the rest of the indexed family, not just \partial:
    // coordinate-component notation now resolves.
    const metric = run("g_{tt} = -1")
    assert.strictEqual(metric.kind, "translated", JSON.stringify(metric))
    if (metric.kind === "translated") {
      assert.ok(
        metric.legend.some((l) => l.tex === "g_{tt}" && l.gloss.includes("metric")),
        JSON.stringify(metric.legend),
      )
    }
  })

  test("CEO ruling: coordinate labels change nothing about bare symbols", () => {
    // Bare t is still the coordinate time, bare r still the radial coordinate.
    const bare = run("t = \\frac{r}{c}")
    assert.strictEqual(bare.kind, "translated", JSON.stringify(bare))
    if (bare.kind === "translated") {
      assert.strictEqual(bare.changed, false, bare.restoredTex)
      assert.ok(
        bare.legend.some((l) => l.tex === "t" && l.gloss === "coordinate time"),
        JSON.stringify(bare.legend),
      )
      assert.ok(
        bare.legend.some((l) => l.tex === "r" && l.gloss.includes("radial coordinate")),
        JSON.stringify(bare.legend),
      )
    }
    assert.strictEqual(restored("r = 2M"), "r=\\frac{2GM}{c^{2}}")

    // Differentials are untouched: dt, dr and the upright forms all still read
    // through the differential table rather than as indices.
    const line = run("ds^2 = -c^2dt^2 + dr^2 + r^2d\\theta^2")
    assert.strictEqual(line.kind, "translated", JSON.stringify(line))
    if (line.kind === "translated") assert.strictEqual(line.changed, false, line.restoredTex)
    const upright = run("ds^2 = -c^2\\mathrm{d}t^2 + \\mathrm{d}r^2")
    assert.strictEqual(upright.kind, "translated", JSON.stringify(upright))
    if (upright.kind === "translated") assert.strictEqual(upright.changed, false)

    // Identity subscripts still win over the index reading.
    assert.strictEqual(restored("r_s = 2M"), "r_{s}=\\frac{2GM}{c^{2}}")
    const hawking = run("T_H = \\frac{\\hbar\\kappa}{2\\pi k_B c}")
    assert.strictEqual(hawking.kind, "translated", JSON.stringify(hawking))
    if (hawking.kind === "translated") {
      assert.ok(
        hawking.legend.some((l) => l.gloss.includes("Hawking temperature")),
        JSON.stringify(hawking.legend),
      )
    }

    // A superscript is the power position: a coordinate label there is still
    // part of an exponent, not an index, so e^{i\phi} keeps its own reading.
    for (const tex of ["\\phi = e^{-i\\omega t}", "z = e^{i\\phi/2}"]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") assert.strictEqual(result.changed, false, tex)
    }
    const exponent = run("x = e^{i\\phi}")
    assert.strictEqual(exponent.kind, "declined", JSON.stringify(exponent))
    if (exponent.kind === "declined") {
      assert.deepStrictEqual(exponent.unknown, [], "e must not become an indexed lookup")
    }
  })

  test("the spin-weight rider {}_s is a label, and s stays out of the dictionary", () => {
    // The rider parses instead of throwing "a floating super/subscript" …
    const rider = run("x = {}_sR")
    assert.strictEqual(rider.kind, "declined", JSON.stringify(rider))
    if (rider.kind === "declined") {
      assert.ok(!rider.reasons.some((r) => r.includes("floating")), JSON.stringify(rider.reasons))
      assert.ok(
        rider.reasons.some((r) => r.includes("{}_{s}R")),
        JSON.stringify(rider.reasons),
      )
    }
    // … and it carries no dimension of its own, so it cannot change a reading.
    assert.strictEqual(restored("r_s = 2M"), "r_{s}=\\frac{2GM}{c^{2}}")
    const notAnIndex = run("x = T_s")
    assert.strictEqual(notAnIndex.kind, "declined", JSON.stringify(notAnIndex))
    if (notAnIndex.kind === "declined") {
      assert.ok(notAnIndex.unknown.includes("T_{s}"), JSON.stringify(notAnIndex.unknown))
    }
  })
})

describe("declining honestly", () => {
  test("unknown symbols decline and are named", () => {
    const result = run("\\xi = 2M")
    assert.strictEqual(result.kind, "declined")
    if (result.kind === "declined") {
      assert.ok(result.unknown.some((u) => u.includes("\\xi")))
    }
  })

  test("proportionality declines with an explanation", () => {
    const result = run("T_H \\propto \\kappa")
    assert.strictEqual(result.kind, "declined")
  })

  test("integrals decline", () => {
    const result = run("S = \\int L \\, dt")
    assert.strictEqual(result.kind, "declined")
  })

  test("dimensionally inconsistent readings decline instead of guessing", () => {
    // Bare E is an energy in the registry; the specific-energy geodesic
    // convention E² = 1 − 2M/r is inconsistent under that reading.
    const result = run("E^2 = 1 - \\frac{2M}{r}")
    assert.strictEqual(result.kind, "declined")
  })

  test("F11: a quoted term reads as written, not as a sliced span", () => {
    const result = run("S = \\frac{M}{r}\\mathrm{d}r T")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      const quoted = result.reasons.find((r) => r.includes("term"))
      assert.ok(quoted, JSON.stringify(result.reasons))
      assert.ok(quoted!.includes("\\frac{M}{r}"), quoted)
      assert.ok(quoted!.includes("\\mathrm{d}r"), quoted)
    }
  })

  test("F12: \\overline and transparent accents do not double their braces", () => {
    for (const [tex, want] of [
      ["\\overline{r} = 2M", "\\overline{r}"],
      ["\\bar{r} = 2M", "\\bar{r}"],
      ["\\vec{v} = 0", "\\vec{v}"],
    ] as const) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.ok(result.restoredTex.includes(want), result.restoredTex)
        assert.ok(!result.restoredTex.includes("{{"), result.restoredTex)
        rendersInKatex(result.restoredTex)
      }
    }
  })

  test("F13: decline reasons name what actually stopped the engine", () => {
    // A sum is a sum, not an unreadable super/subscript.
    const summed = run("x = \\sum_i r")
    assert.strictEqual(summed.kind, "declined", JSON.stringify(summed))
    if (summed.kind === "declined") {
      assert.ok(
        summed.reasons.some((r) => r.includes("sums")),
        JSON.stringify(summed.reasons),
      )
      assert.ok(
        !summed.reasons.some((r) => r.includes("super/subscript")),
        JSON.stringify(summed.reasons),
      )
    }
    // The `d` closing an index list is not an operator-form derivative.
    const indexList = run("\\epsilon_{abcd} = \\sqrt{-r}\\;[abcd]")
    assert.strictEqual(indexList.kind, "declined", JSON.stringify(indexList))
    if (indexList.kind === "declined") {
      assert.ok(
        indexList.reasons.some((r) => r.includes("index letter")),
        JSON.stringify(indexList.reasons),
      )
      assert.ok(
        !indexList.reasons.some((r) => r.includes("select the applied form")),
        JSON.stringify(indexList.reasons),
      )
    }
    // A big operator wearing limits is still a big operator.
    const integral = run("x = \\int_0^\\infty r")
    assert.strictEqual(integral.kind, "declined", JSON.stringify(integral))
    if (integral.kind === "declined") {
      assert.ok(
        integral.reasons.some((r) => r.includes("integrals, sums, and limits")),
        JSON.stringify(integral.reasons),
      )
    }
    // A Dirac ket is balanced, and the reason says what it is rather than
    // telling the reader their own equation is unbalanced.
    const ket = run("a_i^{\\text{in}} |0_{\\text{in}}\\rangle = 0")
    assert.strictEqual(ket.kind, "declined", JSON.stringify(ket))
    if (ket.kind === "declined") {
      assert.ok(!ket.reasons.some((r) => r.includes("unbalanced")), JSON.stringify(ket.reasons))
      assert.ok(
        ket.reasons.some((r) => r.includes("Dirac bra–ket notation")),
        JSON.stringify(ket.reasons),
      )
    }
    // A free-standing column break is not a list of statements.
    const columns = run("\\begin{array}{cc} r_s & 2M \\end{array}")
    assert.strictEqual(columns.kind, "declined", JSON.stringify(columns))
    if (columns.kind === "declined") {
      assert.ok(
        !columns.reasons.some((r) => r.includes("lists or multiple statements")),
        JSON.stringify(columns.reasons),
      )
    }
  })

  test("an expression with no relation has no anchor", () => {
    const result = run("\\frac{2M}{r}")
    assert.strictEqual(result.kind, "no-anchor")
  })
})

describe("legend", () => {
  test("collects glosses for the symbols it resolved", () => {
    const result = run("r_s = 2M")
    assert.strictEqual(result.kind, "translated")
    if (result.kind === "translated") {
      const keys = result.legend.map((l) => l.gloss)
      assert.ok(keys.some((g) => g.includes("Schwarzschild")))
      assert.ok(keys.some((g) => g.includes("mass")))
    }
  })

  test("F10: a control word is one row however its span was spaced", () => {
    // \Sigma absorbs the space that terminates it, so the three occurrences
    // slice as "\Sigma ", "\Sigma\n " and "\Sigma" — one symbol, not three rows.
    const result = run("\\Sigma = \\Sigma\n + \\Sigma")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.strictEqual(
        result.legend.filter((l) => l.tex === "\\Sigma").length,
        1,
        JSON.stringify(result.legend),
      )
    }
    // No raw newline may reach a decline sentence or an unknown-symbol name.
    const declined = run("\\Xi = \\Xi\n + 2M")
    assert.strictEqual(declined.kind, "declined", JSON.stringify(declined))
    if (declined.kind === "declined") {
      for (const text of [...declined.reasons, ...declined.unknown]) {
        assert.ok(!/\n/.test(text), JSON.stringify(text))
        assert.strictEqual(text, text.trim(), JSON.stringify(text))
      }
      assert.deepStrictEqual(declined.unknown, ["\\Xi"], JSON.stringify(declined.unknown))
    }
  })

  test("the same symbol reached as dr and bare r shows one row", () => {
    const result = run("ds^2 = dr^2 + r^2 d\\Omega^2")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      const rRows = result.legend.filter((l) => l.tex === "r")
      assert.strictEqual(rRows.length, 1, JSON.stringify(result.legend))
    }
  })
})

describe("target systems", () => {
  test("H-L and SI share the restored TeX for gravitational content; labels differ", () => {
    const hl = run("r_s = 2M", { system: "hl", geometrized: false })
    const si = run("r_s = 2M", SI)
    assert.strictEqual(hl.kind, "translated")
    assert.strictEqual(si.kind, "translated")
    if (hl.kind === "translated" && si.kind === "translated") {
      assert.strictEqual(hl.restoredTex, si.restoredTex)
      assert.ok(si.targetUnitTex.includes("\\mathrm{m}"), si.targetUnitTex)
      assert.ok(hl.targetUnitTex.includes("\\mathrm{cm}"), hl.targetUnitTex)
    }
  })

  test("Gaussian legend labels use the CGS base", () => {
    const result = run("r_s = 2M", { system: "gaussian", geometrized: false })
    assert.strictEqual(result.kind, "translated")
    if (result.kind === "translated") {
      const mass = result.legend.find((l) => l.gloss === "mass")
      assert.strictEqual(mass?.unit, "g", JSON.stringify(result.legend))
    }
  })

  test("geometrizing strips constants: Schwarzschild radius", () => {
    assert.strictEqual(restored("r_s = \\frac{2GM}{c^{2}}", GEO), "r_{s}=2M")
  })

  test("geometrizing empties a numerator down to 1: surface gravity", () => {
    assert.strictEqual(restored("\\kappa = \\frac{c^{4}}{4GM}", GEO), "\\kappa=\\frac{1}{4M}")
  })

  test("geometrizing E = mc²", () => {
    assert.strictEqual(restored("E = mc^2", GEO), "E=m")
  })

  test("already-geometrized input passes through unchanged under the geometrized target", () => {
    const result = run("r_s = 2M", GEO)
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") assert.strictEqual(result.changed, false)
  })

  test("geometrized target still declines on non-c/G inconsistency", () => {
    const result = run("T_H = \\kappa", GEO)
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
  })

  test("geometrized target labels dimensions as length powers", () => {
    const result = run("E = mc^2", GEO)
    assert.strictEqual(result.kind, "translated")
    if (result.kind === "translated") {
      // Energy in G = c = 1 carries one power of length.
      assert.ok(result.targetUnitTex.includes("\\mathrm{cm}"), result.targetUnitTex)
      const mass = result.legend.find((l) => l.gloss === "mass")
      assert.strictEqual(mass?.unit, "cm", JSON.stringify(result.legend))
    }
  })

  test("geometrized restored output renders in KaTeX", () => {
    for (const tex of [
      "r_s = \\frac{2GM}{c^{2}}",
      "ds^2 = -\\left(1 - \\frac{2GM}{rc^{2}}\\right)c^{2}dt^{2} + \\left(1 - \\frac{2GM}{rc^{2}}\\right)^{-1}dr^2 + r^2 d\\Omega^2",
      "T_H = \\frac{\\hbar\\kappa}{2\\pi k_B c}",
    ]) {
      const result = run(tex, GEO)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") rendersInKatex(result.restoredTex)
    }
  })
})

describe("pre-parse normalization (2026-08-29 review fixes)", () => {
  test("a leading styling directive is inert typography, not a decline", () => {
    const plain = restored("E = m c^{2}")
    assert.strictEqual(restored("\\textstyle E = m c^{2}"), plain)
    assert.strictEqual(restored("\\scriptstyle E = m c^{2}"), plain)
    assert.strictEqual(restored("{\\textstyle E = m c^{2}}"), plain)
    // Wikipedia's wrapper arriving unstripped:
    assert.strictEqual(restored("{\\displaystyle E = m c^{2}}"), plain)
  })
  test("the style unwrap refuses non-partner braces, and the engine replays the style", () => {
    // The opening brace closes before the end, so the string-level unwrap must
    // not touch it (unwrapping would unbalance the math). A wrapper scoped to
    // one SIDE is outside the normalization's scope; it used to decline, and
    // now the group re-emits the style it was written with.
    const result = run("{\\textstyle E} = m c^{2}")
    assert.strictEqual(result.kind, "translated", JSON.stringify(result))
    if (result.kind === "translated") {
      assert.strictEqual(result.restoredTex, "{\\textstyle E} = mc^{2}")
      assert.strictEqual(result.changed, false)
    }
  })
  test("nested wrapper and punctuation normalize to a fixpoint", () => {
    assert.strictEqual(restored("{\\displaystyle E = m c^{2} .}"), restored("E = m c^{2}"))
    assert.strictEqual(restored("\\textstyle E = m c^{2}\\,."), restored("E = m c^{2}"))
  })
  test("stripTrailingPunctuation strips sentence tokens but never a delimiter dot", () => {
    assert.strictEqual(stripTrailingPunctuation("x = y\\,."), "x = y")
    assert.strictEqual(stripTrailingPunctuation("x = y\\qquad"), "x = y")
    assert.strictEqual(stripTrailingPunctuation("x = y ;"), "x = y")
    assert.strictEqual(stripTrailingPunctuation("f = \\left( g \\right."), "f = \\left( g \\right.")
    assert.strictEqual(
      stripTrailingPunctuation("f = \\left( g \\right ."),
      "f = \\left( g \\right .",
    )
    assert.strictEqual(stripTrailingPunctuation("x \\Big."), "x \\Big.")
    // A row separator's backslash is never half-eaten:
    assert.strictEqual(stripTrailingPunctuation("x \\\\ ."), "x \\\\")
  })
  test("an equation ending in \\,. translates end to end (the arXiv-HTML pattern)", () => {
    assert.strictEqual(restored("E = m c^{2}\\,."), restored("E = m c^{2}"))
  })
})

describe("explicit spacing between two factors (the two-statements trap)", () => {
  const SPACING = "explicit spacing between two factors — two statements or one product? (select a single equation)"
  const declinesOnSpacing = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
    if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [SPACING], tex)
  }

  test("two statements set side by side decline instead of multiplying", () => {
    // Read as the chain t = 0·r = 2M, these shipped t = \frac{0r}{c} = \frac{2GM}{c^{3}},
    // or declined only by accident. A run a quad wide or wider now splits the
    // line into its statements (the statement layer, step 9); a narrower run
    // is no statement separator, and declines.
    for (const tex of [
      "t = 0 \\;\\;\\; r = 2M",
      // The relations reviewer's counterexamples: runs narrower than a quad.
      "t = 0 \\hspace{0.9em} r = 2M",
      "t = 0 \\, r = 2M",
      "\\begin{aligned} t &= 0 \\;\\;\\; r = 2M \\end{aligned}",
    ]) {
      declinesOnSpacing(tex)
      declinesOnSpacing(tex, GEO)
    }
  })

  test("a run a quad wide between factors declines in any row", () => {
    // An equation label, not a factor: this shipped r = \frac{2GM(1)}{c^{2}}.
    declinesOnSpacing("r = 2M \\qquad (1)")
    declinesOnSpacing("E = mc^2 \\qquad (1)")
    declinesOnSpacing("r = 2M \\quad r")
    declinesOnSpacing("r = 2M \\qquad t")
    // The run is totalled: three interword spaces make a quad, as do 18mu and 10pt.
    declinesOnSpacing("r = 2M ~~~ r")
    declinesOnSpacing("r = 2M \\enspace\\enspace r")
    declinesOnSpacing("r = 2M \\mkern18mu r")
    declinesOnSpacing("r = 2M \\kern10pt r")
  })

  test("in a chain, even a thin space between factors declines", () => {
    declinesOnSpacing("E = m\\,c^2 = M")
    declinesOnSpacing("E = m \\cdot \\, c^2 = M")
    declinesOnSpacing("ds^2 = -c^2\\,dt^2 + dx^2 = 0")
  })

  test("a truer reason read inside the term wins", () => {
    const result = run("r = 2M \\quad \\text{for} \\quad t > 0")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      assert.deepStrictEqual(result.reasons, ["prose (“for”) inside the equation — select a single equation"])
    }
  })

  test("product typography outside the guard still translates", () => {
    // One relation, and no run as wide as a quad: ordinary product typography.
    assert.strictEqual(restored("ds^2 = -c^2\\,dt^2 + dx^2"), "ds^2=-c^{2}dt^2+dx^2")
    assert.strictEqual(restored("ds^2 = -c^2\\,dt^2 + dx^2", GEO), "ds^2=-dt^2+dx^2")
    assert.strictEqual(restored("E = m\\,c^2"), "E=mc^{2}")
    // Spacing between a function head and its argument is inside one factor.
    assert.strictEqual(restored("x = r\\sin\\,\\theta = r\\sin\\theta"), "x=r\\sin\\theta=r\\sin\\theta")
    // A negative kern separates nothing; a bracket already makes one expression.
    assert.strictEqual(run("E = m\\!c^2 = M").kind, "translated")
    assert.strictEqual(run("E = \\left(m \\, c^{2}\\right) = M").kind, "translated")
    // Unknown symbols still decline on their own, with no spacing reason.
    const unknown = run("\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}")
    assert.strictEqual(unknown.kind, "declined")
    if (unknown.kind === "declined") assert.ok(!unknown.reasons.includes(SPACING), JSON.stringify(unknown))
  })
})

describe("source fidelity: foreign-lexer locs, spacing as written, control spaces", () => {
  // restored() strips whitespace, which would erase the difference between a
  // control space `\ ` and a line break `\\`; these tests compare raw output.
  const rawRestored = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
    rendersInKatex(out)
    return out
  }
  const parse = (tex: string) =>
    katex.__parse(tex, { strict: false, trust: false, displayMode: true })

  test("the spacing nodes the engine re-emits: own spans, except ~, located in its macro body", () => {
    // Every spelling of a control space parses to one spacing node "\ " with a
    // span into the equation; a slice of it ends in the whitespace itself.
    for (const tex of ["r\\ r", "r\\\tr", "r\\\nr"]) {
      const node = parse(tex)[1]
      assert.strictEqual(node.type, "spacing", tex)
      assert.strictEqual(node.text, "\\ ", tex)
      assert.strictEqual(node.loc.lexer.input, tex, `${tex}: a control space lost its own loc`)
    }
    for (const [tex, text] of [
      ["r\\space r", "\\space"],
      ["r\\nobreak r", "\\nobreak"],
      ["r\\nobreakspace r", "\\nobreakspace"],
    ]) {
      const node = parse(tex)[1]
      assert.strictEqual(node.type, "spacing", tex)
      assert.strictEqual(node.text, text, tex)
      assert.strictEqual(node.loc.lexer.input, tex, `${tex}: lost its own loc`)
    }
    // spacingTexOf reads `~` back from exactly this: the node KaTeX's `~` macro
    // expands to is located in the macro body "\nobreakspace".
    const tilde = parse("r~r")[1]
    assert.strictEqual(tilde.type, "spacing")
    assert.strictEqual(tilde.text, "\\nobreakspace")
    assert.strictEqual(tilde.loc.lexer.input, "\\nobreakspace", "the ~ macro body changed")
  })

  test("a control space is re-emitted as a control space, never as a line break", () => {
    // Trimmed to a lone backslash, the control space fused with the next
    // command: these shipped r\\sqrt{r^{2}} and r\\frac{M}{M} (line breaks),
    // m\\cdot, and the text-mode ring accent \r.
    for (const target of [SI, GEO]) {
      assert.strictEqual(rawRestored("x^{2} = r\\ \\sqrt{r^{2}}", target), "x^{2} = r\\ \\sqrt{r^{2}}")
      assert.strictEqual(rawRestored("x = r\\ \\frac{M}{M}", target), "x = r\\ \\frac{M}{M}")
      assert.strictEqual(rawRestored("x = r\\,\\ r/r", target), "x = r\\ r/r")
    }
    assert.strictEqual(rawRestored("E = m\\ \\cdot c^2"), "E = m\\ \\cdot c^{2}")
    // A control space by tab or newline is the same token, re-emitted as `\ `.
    assert.strictEqual(rawRestored("E = m\\\tc^2"), "E = m\\ c^{2}")
    assert.strictEqual(rawRestored("E = m\\\nc^2"), "E = m\\ c^{2}")
    // At the end of a braced script, where the braces are peeled off.
    assert.strictEqual(rawRestored("E = mc^{2\\ }"), "E = mc^{2\\ }")
    // Inside a nested sum, and in every row of an array.
    assert.strictEqual(rawRestored("x = \\sqrt{r\\ r}"), "x = \\sqrt{r\\ r}")
    assert.strictEqual(
      rawRestored("\\begin{aligned} E &= m\\ c^2 \\\\ &= M\\ c^2 \\end{aligned}"),
      "\\begin{aligned}\nE &= m\\ c^{2} \\\\\n&= M\\ c^{2}\n\\end{aligned}",
    )
  })

  test("\\space, \\nobreak and a spelled-out \\nobreakspace still translate verbatim", () => {
    // The big-operator reviewer's counterexamples: a rebuild that maps these to
    // "" or to `~` turned three translations into reassembly faults.
    for (const tex of ["E = M\\space c^{2}", "x = r\\nobreak r/r", "x = r\\nobreakspace r/r"]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.strictEqual(result.restoredTex, tex)
        assert.strictEqual(result.changed, false, tex)
      }
    }
  })

  test("~ is re-emitted as ~, where it used to be sliced as a copy of the equation", () => {
    for (const tex of [
      "E = m~c^2",
      "E = (m~c^2)",
      "E = \\left(m~c^2\\right)",
      "E = \\frac{m~c^2}{1}",
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") assert.strictEqual(result.changed, false, tex)
    }
    assert.strictEqual(rawRestored("E = m~c^2"), "E = m~c^{2}")
    // Stripped, c² takes the ~ that only separated it along (batch-1 review fix (a)).
    assert.strictEqual(rawRestored("E = m~c^2", GEO), "E = m")
    assert.strictEqual(rawRestored("x = r ~ \\frac{M}{M}"), "x = r~\\frac{M}{M}")
  })

  test("a macro-built token no longer slices the equation: keys and quotes are the source's", () => {
    // \cdots is located in its macro body; the subscript used to key itself as
    // T_{T_{a\cdots b}}, an entry no registry could ever hold. (An ellipsis in
    // an index list is a continuation, so the unknown is a base the registry
    // does not index.)
    const dots = run("S_{a\\cdots b} = r")
    assert.strictEqual(dots.kind, "declined", JSON.stringify(dots))
    if (dots.kind === "declined") assert.deepStrictEqual(dots.unknown, ["S_{a\\cdots b}"])
    // The term was quoted as “ar = a~bb”; a group keeps its own span too.
    for (const [tex, quoted] of [
      ["r = a~b", "“a~b”"],
      ["x = (r~r)", "“(r~r)”"],
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") assert.ok(result.reasons[0].includes(quoted), JSON.stringify(result.reasons))
    }
  })

  test("a control space the emitter drops is a divergence, not inert whitespace", () => {
    // The function-argument emission drops glue after \sin. With control spaces
    // deleted in the comparison, `r\sin\theta` would pass for `r\sin\ \theta`; the
    // sentinel makes it a divergence, so the result either keeps the space or
    // declines.
    for (const target of [SI, GEO]) {
      const result = run("x = r\\sin\\ \\theta", target)
      if (result.kind === "translated") assert.ok(result.restoredTex.includes("\\ \\theta"), result.restoredTex)
      else assert.strictEqual(result.kind, "declined")
    }
  })

  test("spacing emitted as written does not unmask two statements set side by side", () => {
    // The integration probe: rebuilding `~` and `\ ` faithfully turned these
    // accidental reassembly faults into t = \frac{0~~~~r}{c} = \frac{2GM}{c^{3}}.
    // A run narrower than a quad is still declined by the between-factors
    // guard (step 1); a run a quad wide splits the line into two statements
    // (step 9), each restored on its own anchor, never into a product.
    const SPACING = "explicit spacing between two factors — two statements or one product? (select a single equation)"
    for (const tex of ["t = 0 ~ r = 2M", "t = 0 \\ r = 2M"]) {
      for (const target of [SI, GEO]) {
        const result = run(tex, target)
        assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
        if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [SPACING], tex)
      }
    }
    assert.strictEqual(rawRestored("t = 0 ~~~~ r = 2M"), "t = 0 ~~~~ r = \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("t = 0 \\ \\ \\ r = 2M"), "t = 0 \\ \\ \\  r = \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("t = 0 ~~~~ r = 2M", GEO), "t = 0 ~~~~ r = 2M")
  })

  test("geometrized stripping that leaves only glue empties the product", () => {
    // Spacing and product signs join factors; with every factor stripped they
    // are dropped, and the empty-side rule applies as it does without them.
    assert.strictEqual(rawRestored("r_s = \\frac{2GM}{c^2\\ }", GEO), "r_{s} = 2M")
    assert.strictEqual(rawRestored("r_s = \\frac{2GM}{c^2~}", GEO), "r_{s} = 2M")
    // A root or a group that wrapped nothing but constants vanishes whole
    // (batch-1 review fix (a)); they used to leave `\sqrt{1}m` and `m{1}^{2}`.
    assert.strictEqual(rawRestored("E = \\sqrt{c^4\\ }m", GEO), "E = m")
    assert.strictEqual(rawRestored("E = m{c~}^2", GEO), "E = m")
    assert.strictEqual(rawRestored("E = m{c\\space}^2", GEO), "E = m")
    assert.strictEqual(rawRestored("v = c\\cdot", GEO), "v = 1")
    // The glue that only separated a vanished factor goes with it.
    assert.strictEqual(rawRestored("E = m\\ c^2", GEO), "E = m")
  })
})

describe("script order and the angular guard", () => {
  const ANGULAR = (tex: string) =>
    `an angular coordinate index on “${tex}” — components along θ and φ do not share the registry's length dimension`
  const declinesAngular = (tex: string, quoted: string) => {
    for (const target of [SI, GEO]) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [ANGULAR(quoted)], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const verbatim = (tex: string) => {
    for (const target of [SI, GEO]) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "translated") {
        assert.strictEqual(result.restoredTex, tex)
        assert.strictEqual(result.changed, false, tex)
      }
    }
  }

  test("superscript-first scripts are re-emitted superscript first", () => {
    // Every X^{a}_{b} was rebuilt as X_{b}^{a} and declined as a reassembly fault.
    assert.strictEqual(restored("E = 2p^a_b"), "E=2p^{a}_{b}c")
    assert.strictEqual(restored("E = 2p^a_b", GEO), "E=2p^{a}_{b}")
    verbatim("\\Gamma^{\\rho}_{\\mu\\nu} = \\Gamma^{\\rho}_{\\nu\\mu}")
    verbatim("T^{0}_{i} = 0")
    verbatim("\\delta^{\\mu}_{\\nu} = \\delta_{\\nu}^{\\mu}")
    // The legend and the unknown list quote the symbol in its written order too.
    const gamma = run("\\Gamma^{\\rho}_{\\mu\\nu} = \\Gamma^{\\rho}_{\\nu\\mu}")
    assert.strictEqual(gamma.kind, "translated")
    if (gamma.kind === "translated") {
      assert.deepStrictEqual(
        gamma.legend.map((l) => l.tex),
        ["\\Gamma^{\\rho}_{\\mu\\nu}", "\\Gamma^{\\rho}_{\\nu\\mu}"],
      )
    }
    const xi = run("\\Xi^{a}_{b} = 0")
    assert.strictEqual(xi.kind, "declined")
    if (xi.kind === "declined") assert.deepStrictEqual(xi.unknown, ["\\Xi^{a}_{b}"])
  })

  test("riders and compound bases keep the written order", () => {
    verbatim("T_{a}{}^{b}_{c} = 0")
    verbatim("E = \\left(p\\right)^{2}_{a}/m")
    verbatim("E = \\left(v\\right)^{2}_{a}m")
  })

  test("an indexed component with a superscript and θ or φ in either script declines by name", () => {
    // Unblocked by script order, these became unchanged translations under a
    // banner of m⁻¹ and of a pressure: Γ^μ_{θθ} and T^0_θ are neither.
    declinesAngular("\\Gamma^{\\mu}_{\\theta\\theta} = 0", "\\Gamma^{\\mu}_{\\theta\\theta}")
    declinesAngular("T^{0}_{\\theta} = 0", "T^{0}_{\\theta}")
    declinesAngular("\\Gamma^{\\theta}_{rr} = 0", "\\Gamma^{\\theta}_{rr}")
    declinesAngular("\\Gamma^{r}_{\\theta\\theta} = -r", "\\Gamma^{r}_{\\theta\\theta}")
    declinesAngular("\\Gamma^{\\theta}_{r\\theta} = \\frac{1}{r}", "\\Gamma^{\\theta}_{r\\theta}")
    declinesAngular("x^{\\mu}_{\\varphi} = 0", "x^{\\mu}_{\\varphi}")
    // The spelling never decides the reading: subscript first declines as well,
    // though it used to translate.
    declinesAngular("\\Gamma_{\\theta\\theta}^{\\mu} = 0", "\\Gamma_{\\theta\\theta}^{\\mu}")
    // A power is a superscript too.
    declinesAngular("E = g_{\\phi\\phi}^{2}", "g_{\\phi\\phi}^{2}")
    // Every indexed lookup, the differential's operand included.
    declinesAngular("ds = dx^{\\mu}_{\\theta}", "x^{\\mu}_{\\theta}")
  })

  test("the guard leaves the 2026-08-17 subscript ruling and other reasons alone", () => {
    // A subscript alone still reads θ and φ as indices.
    verbatim("g_{\\theta\\phi} = 0")
    // A power on ∂ is a derivative order: the Teukolsky operator's ∂_φ², one of
    // the equations the ruling was drawn from, still stops only on unknown ψ.
    for (const tex of ["\\partial_\\phi^2\\psi = 0", "\\nabla_\\theta^{2}\\psi = 0"]) {
      const order = run(tex)
      assert.strictEqual(order.kind, "declined", tex)
      if (order.kind === "declined") {
        assert.deepStrictEqual(order.reasons, [], tex)
        assert.deepStrictEqual(order.unknown, ["\\psi"], tex)
      }
    }
    // A superscript that is neither a power nor an index list keeps its own reason.
    const exponent = run("g_{\\theta\\theta}^{n} = 0")
    assert.strictEqual(exponent.kind, "declined")
    if (exponent.kind === "declined") {
      assert.deepStrictEqual(exponent.reasons, ["an exponent on “g_{\\theta\\theta}^{n}” that could not be read"])
    }
    // No indexed reading, no guard: an unknown base is reported as unknown.
    const unknown = run("\\Xi^{\\mu}_{\\theta} = 0")
    assert.strictEqual(unknown.kind, "declined")
    if (unknown.kind === "declined") {
      assert.deepStrictEqual(unknown.reasons, [])
      assert.deepStrictEqual(unknown.unknown, ["\\Xi^{\\mu}_{\\theta}"])
    }
    // θ and φ in an exponent are not indices.
    const phase = run("x = e^{i\\phi}")
    assert.strictEqual(phase.kind, "declined")
    if (phase.kind === "declined") assert.ok(!phase.reasons.some((r) => r.includes("angular")), JSON.stringify(phase))
  })
})

describe("reassembly fidelity and upright words", () => {
  // Raw output, so the spelling of a font or a style is what is compared.
  const rawRestored = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
    rendersInKatex(out)
    return out
  }
  const declinesWith = (tex: string, reason: string) => {
    for (const target of [SI, GEO]) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [reason], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const UPRIGHT_WORD = (word: string) =>
    `the upright word “${word}” — a unit, a label or an operator, not a product of symbols`
  const UPRIGHT_LETTER = (letter: string) =>
    `the upright letter “${letter}” — a unit, a label or an operator, not a variable`
  const INSIDE_FONT = (font: string) =>
    `a constant to restore inside the font “${font}”, where it would be set in that font and read as another symbol`

  test("a font is re-emitted as it was written, old-style switches included", () => {
    // Every one of these came back as \mathbf{…} or \mathrm{…} and declined as a
    // reassembly fault.
    for (const [tex, out] of [
      ["E = {\\bf p}", "E = {\\bf p}c"],
      ["E = \\bm{p}", "E = \\bm{p}c"],
      ["E = \\boldsymbol{p}", "E = \\boldsymbol{p}c"],
      ["E = \\mathbf{p}", "E = \\mathbf{p}c"],
      ["E^{2} = {\\bf p}^{2} + m^{2}", "E^{2} = {\\bf p}^{2}c^{2} + m^{2}c^{4}"],
    ]) {
      assert.strictEqual(rawRestored(tex), out, tex)
      assert.strictEqual(rawRestored(tex, GEO), tex, tex)
    }
    // A bare font script has no span; it is rebuilt rather than sliced to its
    // letter, and without braces it was not written with: the braced
    // `r_{\mathrm{s}}` is another node, which reads back as an unknown symbol.
    assert.strictEqual(rawRestored("r_\\mathrm{s} = 2M"), "r_\\mathrm{s} = \\frac{2GM}{c^{2}}")
  })

  test("a font under an accent survives", () => {
    assert.strictEqual(rawRestored("E = \\tilde{\\bm{p}}"), "E = \\tilde{\\bm{p}}c")
    assert.strictEqual(rawRestored("E = \\vec{\\mathbf{p}}"), "E = \\vec{\\mathbf{p}}c")
    assert.strictEqual(rawRestored("E = \\tilde{\\bm{p}}", GEO), "E = \\tilde{\\bm{p}}")
  })

  test("a constant never lands inside a font, and a sum under one is parenthesized", () => {
    // The outer constant stands outside the font, with \left(\right) around the
    // bare sum; `{\bf p + p}c` would read as p + pc.
    assert.strictEqual(rawRestored("E = {\\bf p + p}"), "E = \\left({\\bf p + p}\\right)c")
    assert.strictEqual(rawRestored("E = \\mathbf{p + p}"), "E = \\left(\\mathbf{p + p}\\right)c")
    // An inner constant cannot stand outside: `{\bf p + mc}c` set a bold c.
    for (const [tex, font] of [
      ["E = {\\bf p + m}", "\\bf"],
      ["E = \\mathbf{p + m}", "\\mathbf"],
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [INSIDE_FONT(font)], tex)
      // Nothing is restored in a geometrized target, so nothing lands inside.
      assert.strictEqual(rawRestored(tex, GEO), tex, tex)
    }
    // Upright, the letters are no variables to begin with.
    declinesWith("E = {\\rm p + m}", UPRIGHT_LETTER("p"))
  })

  test("a style written inside a group is re-emitted; the one \\tfrac implies is not invented", () => {
    assert.strictEqual(rawRestored("E = {\\textstyle\\frac12}m"), "E = {\\textstyle \\frac{1}{2}}mc^{2}")
    assert.strictEqual(rawRestored("E = {\\textstyle\\frac12}m", GEO), "E = {\\textstyle \\frac{1}{2}}m")
    assert.strictEqual(rawRestored("E = {\\displaystyle\\frac{1}{2}}m"), "E = {\\displaystyle \\frac{1}{2}}mc^{2}")
    assert.strictEqual(rawRestored("E = {\\tfrac12}m"), "E = {\\tfrac{1}{2}}mc^{2}")
  })

  test("a written leading plus is kept", () => {
    assert.strictEqual(rawRestored("E = +m"), "E = +mc^{2}")
    assert.strictEqual(rawRestored("E = +m", GEO), "E = +m")
    assert.strictEqual(rawRestored("x = +t - r"), "x = +tc - r")
    assert.strictEqual(rawRestored("E = -+m"), "E = -mc^{2}")
  })

  test("upright words are units, labels or operators, never products of symbols", () => {
    // Live, the first shipped unchanged (H·z), and the others were read as c·m,
    // G·e·V, the differential dt and V·o·l. (Tr, a trace, is read as the
    // operator it names since step 11.)
    declinesWith("\\omega = 2\\pi\\,\\mathrm{Hz}", UPRIGHT_WORD("Hz"))
    declinesWith("E = \\mathrm{cm}", UPRIGHT_WORD("cm"))
    declinesWith("\\lambda = 21\\,\\mathrm{cm}", UPRIGHT_WORD("cm"))
    declinesWith("E = {\\rm GeV}", UPRIGHT_WORD("GeV"))
    declinesWith("E = \\mathrm{dt}", UPRIGHT_WORD("dt"))
    declinesWith("\\mathrm{Vol}\\,T = \\rho", UPRIGHT_WORD("Vol"))
    declinesWith("\\mathrm{Vol} = r^{3}", UPRIGHT_WORD("Vol"))
    declinesWith("\\text{Var}(x) = r^{2}", UPRIGHT_WORD("Var"))
    // A run with a space in it is quoted as written.
    declinesWith("x = {\\rm Tr A}", "the upright words “Tr A” — units, labels or operators, not a product of symbols")
  })

  test("a single upright letter is no variable, except d, e and i", () => {
    // Live, the metre was restored as a mass and the second as an arc length.
    declinesWith("r = 3\\,\\mathrm{m}", UPRIGHT_LETTER("m"))
    declinesWith("t = 5\\,\\mathrm{s}", UPRIGHT_LETTER("s"))
    declinesWith("E = \\mathrm{m}^{2}", UPRIGHT_LETTER("m"))
    declinesWith("E = \\mathrm{T}_{ab}", UPRIGHT_LETTER("T"))
    declinesWith("E = \\text{m}", UPRIGHT_LETTER("m"))
    // Every letter under an upright font is upright, not only a lone one.
    declinesWith("x = \\mathrm{2m}", UPRIGHT_LETTER("m"))
    // The letters with an upright reading of their own keep it.
    assert.strictEqual(rawRestored("E = mc^2e^{\\mathrm{i}kx}"), "E = mc^{2}e^{\\mathrm{i}kx}")
    assert.strictEqual(rawRestored("E = \\mathrm{e}^{2}m"), "E = \\mathrm{e}^{2}mc^{2}")
    assert.strictEqual(rawRestored("ds^2 = -c^2\\mathrm{d}t^2 + dx^2"), "ds^2 = -c^{2}\\mathrm{d}t^2 + dx^2")
  })

  test("a differential does not make an upright letter a variable", () => {
    // Live, the operand bypassed the guard: the metre after a d was restored as
    // a mass (c^{2}d\mathrm{m}) and the second as an arc length.
    declinesWith("E = d\\mathrm{m}", UPRIGHT_LETTER("m"))
    declinesWith("E = \\mathrm{d}\\mathrm{m}", UPRIGHT_LETTER("m"))
    declinesWith("v = \\frac{dr}{d\\mathrm{s}}", UPRIGHT_LETTER("s"))
    declinesWith("v = \\frac{d\\mathrm{s}}{dt}", UPRIGHT_LETTER("s"))
    declinesWith("E = d^2\\mathrm{m}", UPRIGHT_LETTER("m"))
    // Through a script on the operand, outside the font or inside it.
    declinesWith("E = d\\mathrm{m}^{2}", UPRIGHT_LETTER("m"))
    declinesWith("E = d\\mathrm{m^2}", UPRIGHT_LETTER("m"))
    declinesWith("E = d\\mathrm{m}_{1}", UPRIGHT_LETTER("m"))
    // The upright d is the differential itself and keeps its reading.
    assert.strictEqual(rawRestored("ds = \\mathrm{d}t"), "ds = c\\mathrm{d}t")
    assert.strictEqual(rawRestored("v = \\frac{\\mathrm{d}r}{\\mathrm{d}t}"), "v = \\frac{\\mathrm{d}r}{\\mathrm{d}t}")
  })

  test("prose and placeholders say what they are", () => {
    const PROSE = (word: string) => `prose (“${word}”) inside the equation — select a single equation`
    const PLACEHOLDER = (word: string) =>
      `an unspecified constant (“${word}”), whose dimension the notation does not fix`
    declinesWith("x = r \\quad \\text{for} \\quad r > 2M", PROSE("for"))
    declinesWith("x = r \\ {\\rm at}\\ r = 2M", PROSE("at"))
    declinesWith("E = \\text{s.t.}", PROSE("s.t."))
    // Punctuation after the word does not hide it.
    declinesWith("E = \\text{const.}", PLACEHOLDER("const."))
    declinesWith("r = {\\rm~constant}", PLACEHOLDER("constant"))
    declinesWith("E = \\textit{const}", PLACEHOLDER("const"))
    // A \text the engine cannot name keeps the general reason.
    declinesWith("E = \\text{e}", "\\text content inside the equation")
  })

  test("a run of letters under another font is one name or a product, and declines", () => {
    const NAME = (word: string, font: string) =>
      `the multi-letter name “${word}” under “${font}” — one name or a product of symbols, which the notation does not say`
    declinesWith("E = \\mathit{eff}", NAME("eff", "\\mathit"))
    declinesWith("E = \\mathbf{AB}", NAME("AB", "\\mathbf"))
  })
})

describe("function tail: argument extent and the re-read backstop", () => {
  const rawRestored = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
    rendersInKatex(out)
    return out
  }
  const declines = (tex: string, reason: string, targets: TargetSpec[] = [SI, GEO]) => {
    for (const target of targets) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [reason], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const NO_COMPLETION = (term: string) =>
    `a term admitting no c–G completion under the registry's readings of its symbols (term “${term}”)`
  const OPEN_TAIL = (head: string) =>
    `restoring a constant at the end of the unparenthesized argument of “${head}”, where it would read as a factor outside the function, is not supported`
  const REREAD =
    "an internal reassembly fault — the rebuilt equation does not balance when read again (nothing was shown rather than something wrong)"

  test("a constant never follows an unparenthesized argument; it goes before the head", () => {
    // Live, these came back as `\tanh\phi c` and `t\cos\theta c`: tanh(φc) and cos(θc).
    assert.strictEqual(rawRestored("v = \\tanh\\phi"), "v = c\\tanh\\phi")
    assert.strictEqual(rawRestored("v = \\tanh\\phi", GEO), "v = \\tanh\\phi")
    assert.strictEqual(rawRestored("x = t\\cos\\theta"), "x = tc\\cos\\theta")
    // Before every head whose argument runs on into the next one.
    assert.strictEqual(rawRestored("v = \\sin\\theta\\cos\\phi"), "v = c\\sin\\theta\\cos\\phi")
    // Braces do not print, so `{\tanh\phi}c` reads as tanh(φc) as well.
    assert.strictEqual(rawRestored("v = {\\tanh\\phi}"), "v = c{\\tanh\\phi}")
    assert.strictEqual(rawRestored("v = \\frac{\\tanh\\phi}{2}"), "v = \\frac{c\\tanh\\phi}{2}")
    // Ledger #21 (gr-qc/9712019).
    assert.strictEqual(
      rawRestored("v={\\frac{x}{t}}={\\frac{{\\sinh\\phi}}{{\\cosh\\phi}}}=\\tanh\\phi"),
      "v = {\\frac{x}{t}} = {\\frac{{\\sinh\\phi}}{{\\cosh\\phi}}}c = c\\tanh\\phi",
    )
    // Nothing to restore, nothing moves.
    assert.strictEqual(rawRestored("x = r\\sin\\theta\\cos\\phi"), "x = r\\sin\\theta\\cos\\phi")
    assert.strictEqual(rawRestored("z = \\sin\\omega t"), "z = \\sin\\omega t")
  })

  test("a delimited group after the head is the whole argument, restored inside its delimiters", () => {
    // What follows the closing delimiter is an outer factor: v² cos θ, never
    // cos(θv²). Live, this one came back as `\cos\frac{(\theta)v^{2}}{c^{2}}c^{2}`.
    for (const tex of ["\\Phi = \\cos(\\theta)v^2", "\\Phi = \\cos(\\theta)\\,v^{2}"]) {
      assert.strictEqual(rawRestored(tex), "\\Phi = \\cos(\\theta)v^{2}", tex)
      assert.strictEqual((run(tex) as { changed?: boolean }).changed, false, tex)
    }
    // The argument's own constants stay inside the author's delimiters.
    assert.strictEqual(rawRestored("x = \\cos(\\omega r)\\,r"), "x = \\cos(\\frac{\\omega r}{c})r")
    assert.strictEqual(rawRestored("x = r\\ln(M/t)"), "x = r\\ln(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin(M/t)"), "x = r\\sin(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\ln(M/t)^{2}"), "x = r\\ln(GM/tc^{3})^{2}")
    // Ledger #1033 (gr-qc/9712019): the c used to land after `\right)` and
    // multiply the sinh instead of the time inside it.
    assert.strictEqual(
      rawRestored("a=\\sqrt{\\frac{{3}}{\\Lambda}}\\sinh\\left(\\sqrt{\\frac{{\\Lambda}}{3}}\\,t\\right)"),
      "a = \\sqrt{\\frac{{3}}{\\Lambda}}\\sinh\\left(\\sqrt{\\frac{{\\Lambda}}{3}}tc\\right)",
    )
    // sin(t/M)·(t/M): the second group is an outer factor and takes the outer constants.
    assert.strictEqual(rawRestored("x = r\\sin(t/M)(t/M)"), "x = \\frac{r\\sin(tc^{3}/GM)(t/M)c^{3}}{G}")
    assert.strictEqual(rawRestored("x = r\\sin(t/M)(t/M)", GEO), "x = r\\sin(t/M)(t/M)")
  })

  test("factors after the closing delimiter are not read into the argument", () => {
    // Live, each read the later factors into the argument: `\sin(t)/M` was
    // restored as sin(t/M), `r\sin(t)c^{3}/GM`.
    declines("x = r\\sin(t)/M", NO_COMPLETION("t"))
    declines("x = r\\sin(t)\\frac{1}{M}", NO_COMPLETION("t"))
    declines("x = r\\sin(\\sqrt{\\Lambda})\\,t", NO_COMPLETION("\\sqrt{\\Lambda}"))
  })

  test("a constant restored at the end of an unparenthesized argument declines", () => {
    // `\sin 2(\sqrt{\Lambda}t)c` reads as much as c·sin(2√Λt) as sin(2√Λt·c).
    declines("x = r\\sin 2(\\sqrt{\\Lambda}t)", OPEN_TAIL("\\sin"), [SI])
    declines("x = r\\ln M/t", OPEN_TAIL("\\ln"), [SI])
    // Nothing is restored in a geometrized target, so nothing lands there.
    assert.strictEqual(rawRestored("x = r\\sin 2(\\sqrt{\\Lambda}t)", GEO), "x = r\\sin2(\\sqrt{\\Lambda}t)")
    // Inside a fraction the constants are plainly inside the argument.
    assert.strictEqual(rawRestored("x = r\\sin\\frac{t}{M}"), "x = r\\sin\\frac{tc^{3}}{GM}")
  })

  test("a differential's group operand keeps what was restored inside it", () => {
    // Live, `ds = d(r - t)` came back verbatim while reporting a change.
    assert.strictEqual(rawRestored("ds = d(r - t)"), "ds = d(r - tc)")
    assert.strictEqual(rawRestored("ds = d\\left(r - t\\right)"), "ds = d\\left(r - tc\\right)")
    assert.strictEqual(rawRestored("ds = d(r - t)", GEO), "ds = d(r - t)")
  })

  test("a restored equation must balance when read again", () => {
    // No emission left drops or misplaces a constant, so the witness is a
    // dictionary that reads c as something other than the speed of light (a
    // dimensionless central charge): the c the restoration inserts does not
    // read back as the constant it was inserted as.
    const centralCharge: HubRegistry = {
      ...reg,
      bare: { ...reg.bare, c: { dim: [0, 0, 0, 0, 0], gloss: "central charge", si: "1" } },
    }
    const result = translateTex("E = m", katex, centralCharge, SI)
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [REREAD])
    // With an unknown symbol it does not run: the decline names the symbol.
    const unknown = run("v = \\Xi\\tanh\\phi")
    assert.strictEqual(unknown.kind, "declined", JSON.stringify(unknown))
    if (unknown.kind === "declined") {
      assert.deepStrictEqual(unknown.reasons, [])
      assert.deepStrictEqual(unknown.unknown, ["\\Xi"])
    }
    // Geometrized, the stripped equation reads back with nothing left to strip.
    assert.strictEqual(rawRestored("v = c\\tanh\\phi", GEO), "v = \\tanh\\phi")
    // A trailing control space is stripped whole, so an output ending in one
    // reads back; trimmed to a lone backslash, it did not parse.
    assert.strictEqual(stripTrailingPunctuation("E = m\\ "), "E = m")
    assert.strictEqual(stripTrailingPunctuation("E = m \\\\ "), "E = m \\\\")
    assert.strictEqual(rawRestored("E = mc^2\\ "), "E = mc^{2}")
  })
})

describe("relations core: relations, continuation rows, branch signs", () => {
  const translated = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = result as Extract<TranslationResult, { kind: "translated" }>
    rendersInKatex(out.restoredTex)
    return out
  }
  const rawRestored = (tex: string, target: TargetSpec = SI) => translated(tex, target).restoredTex
  const declines = (tex: string, reason: string, targets: TargetSpec[] = [SI, GEO]) => {
    for (const target of targets) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [reason], tex)
    }
  }
  const COLON =
    "a colon that is not part of “:=” (normal ordering, a ratio, or a map), which the engine does not read"
  const EMPTY_SIDE = "a relation with nothing on one side of it"
  const COMMA_IN_BRACKETS =
    "a comma inside brackets (function arguments, a tuple, a commutator, or an inner product), which the engine does not read as a product"
  const REL_IN_BRACKETS =
    "a relation inside brackets (an evaluation point, a limit, a conditional, or an index swap), which is not a factor"
  const SIGN_RUN = "a sign directly beside “\\pm” or “\\mp”, which the engine does not fold"
  const SIGN_LABEL =
    "a sign standing as a superscript (a light-cone index or a charge label), which is neither a power nor a dictionary index"

  test("equality-type relations are restored across like =", () => {
    // \lesssim and \gtrsim can mean "≤ C·(…)" with C absorbed, the caveat \sim
    // already carries; the owner holds that reading open, and they restore as \sim does.
    for (const rel of [
      "\\doteq",
      "\\approxeq",
      "\\lesssim",
      "\\gtrsim",
      "\\leqslant",
      "\\geqslant",
      "\\leqq",
      "\\geqq",
      "\\lessapprox",
      "\\gtrapprox",
    ]) {
      const out = translated(`r ${rel} 2M`)
      assert.strictEqual(out.restoredTex, `r ${rel} \\frac{2GM}{c^{2}}`, rel)
      assert.strictEqual(out.targetUnitTex, "\\mathrm{m}", rel)
      assert.strictEqual(rawRestored(`r ${rel} 2M`, GEO), `r ${rel} 2M`, rel)
    }
  })

  test("≠ is read from its MathML half and re-emitted as it was written", () => {
    // Dead since KaTeX 0.16.47, which builds \neq and \ne as htmlmathml: every
    // ≠ statement declined as the unsupported construct "htmlmathml".
    assert.strictEqual(rawRestored("r \\neq 2M"), "r \\neq \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("r \\ne 2M"), "r \\ne \\frac{2GM}{c^{2}}")
    assert.strictEqual(
      rawRestored("\\begin{aligned} r &\\ne 2M \\end{aligned}"),
      "\\begin{aligned}\nr &\\ne \\frac{2GM}{c^{2}}\n\\end{aligned}",
    )
    // The relations reviewer's counterexamples: sliced between its neighbours,
    // the spelling swallowed the head of a loc-less neighbour, and each of
    // these declined as a reassembly fault.
    assert.strictEqual(rawRestored("r \\ne \\frac{M}{2}"), "r \\ne \\frac{GM}{2c^{2}}")
    assert.strictEqual(rawRestored("r \\ne \\sqrt{M^2}"), "r \\ne \\frac{G\\sqrt{M^{2}}}{c^{2}}")
    assert.strictEqual(rawRestored("\\bar r \\ne 2M"), "\\bar{r} \\ne \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("\\bar{r} \\ne 2M"), "\\bar{r} \\ne \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("\\left(r\\right) \\ne 2M"), "\\left(r\\right) \\ne \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("\\frac{r}{M} \\neq 2"), "\\frac{r}{M} \\neq \\frac{2G}{c^{2}}")
    // With no located node before it in its row, the spelling cannot be read,
    // and the relation declines rather than being emitted in another spelling.
    declines(
      "\\begin{aligned} r &= 2M \\\\ &\\ne M \\end{aligned}",
      "the relation “\\neq”, whose written spelling the engine could not read",
    )
    declines("r \\not= 2M", "a relation negated with \\not, which is not supported yet (\\neq is)")
    declines("r \\not< 2M", "a relation negated with \\not, which is not supported yet (\\neq is)")
  })

  test(":= is a definition; a colon on its own is not", () => {
    assert.strictEqual(rawRestored("r_s := 2M"), "r_{s} := \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("r_s \\coloneqq 2M"), "r_{s} \\coloneqq \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("r_s \\coloneqq \\frac{2M}{1}"), "r_{s} \\coloneqq \\frac{2GM}{1c^{2}}")
    // =: has no corpus instance, and `E = :Mc^2:` (a normal-ordered product) is
    // `=` then `:`: read as a definition, it shipped as `E =: Mc^{2}`.
    for (const tex of ["2M =: r_s", "E = :Mc^2:", "r = :2M:", "r = : 2M :.", "a : b = r : M", "E = mc^2:"]) {
      declines(tex, COLON)
    }
    // The closing colon is no longer stripped as sentence punctuation.
    assert.strictEqual(stripTrailingPunctuation("E = :Mc^2:"), "E = :Mc^2:")
    assert.strictEqual(stripTrailingPunctuation("E = :Mc^2:."), "E = :Mc^2:")
    assert.strictEqual(stripTrailingPunctuation("x = y \\:"), "x = y")
  })

  test("relations nothing is restored across say what they are", () => {
    declines("r \\to 2M", "the arrow “\\to” — a substitution, a limit, or a map, none of which fixes a dimension")
    declines(
      "r \\rightarrow r + M",
      "the arrow “\\rightarrow” — a substitution, a limit, or a map, none of which fixes a dimension",
    )
    declines("r \\mapsto 2M", "the arrow “\\mapsto” — a substitution, a limit, or a map, none of which fixes a dimension")
    declines("r \\leftrightarrow M", "the exchange “\\leftrightarrow” (a swap or a duality), which is not an equation")
    declines("r \\parallel M", "“\\parallel” (a norm bar or “parallel to”), which the engine does not read")
    declines("r \\mid M", "“\\mid” (a conditional or an inner-product bar), which the engine does not read")
    declines("E \\propto M", "a proportionality — constants are absorbed in ∝, so restoring them is not meaningful")
  })

  test("a relation or a comma inside brackets declines by name", () => {
    for (const tex of ["(u, v) = 0", "g_{ab} = (-1, 1, 1, 1)", "\\eta_{ab} = (-,+,+,+)", "x = \\sin(a, b)", "x = [r; M]"]) {
      declines(tex, COMMA_IN_BRACKETS)
    }
    for (const tex of ["g_{00}(r \\to \\infty) = -1", "(r_s = 2M)", "x = \\sin(r = M)"]) declines(tex, REL_IN_BRACKETS)
    // ≠ counts as a relation there too.
    const neq = run("f = (r \\ne 0)")
    assert.strictEqual(neq.kind, "declined", JSON.stringify(neq))
    if (neq.kind === "declined") assert.deepStrictEqual(neq.reasons, [REL_IN_BRACKETS])
  })

  test("a relation with an empty side declines", () => {
    // `E = <p>` read as E, nothing, p, nothing, and shipped as `E = < pc >`;
    // ledger #423's `\ll` written as `<<` shipped a relation between nothing.
    for (const tex of ["E = <p>", "E =", "r < < M", "{\\frac{{dx^{i}}}{{d\\tau}}}<<{\\frac{{dt}}{{d\\tau}}}"]) {
      declines(tex, EMPTY_SIDE)
    }
    // A row that opens at a relation with no chain before it has nothing to continue.
    declines("= 2M", "a row that begins at “=” with nothing before it to anchor it")
  })

  test("a row that opens at a relation continues the chain before it", () => {
    // Anchored on its own content, the continuation shipped `= M` in kilograms.
    const chain = translated("\\begin{aligned} r &= 2M \\\\ &= M \\end{aligned}")
    assert.strictEqual(
      chain.restoredTex,
      "\\begin{aligned}\nr &= \\frac{2GM}{c^{2}} \\\\\n&= \\frac{GM}{c^{2}}\n\\end{aligned}",
    )
    assert.strictEqual(chain.targetUnitTex, "\\mathrm{m}")
    assert.strictEqual(
      rawRestored("\\begin{aligned} r &= 0 \\\\ &= M \\end{aligned}"),
      "\\begin{aligned}\nr &= 0 \\\\\n&= \\frac{GM}{c^{2}}\n\\end{aligned}",
    )
    // Passed as unchanged in kilograms, though 2M must become a length.
    const bound = translated("\\begin{aligned}0 &< r \\\\ &< 2M\\end{aligned}")
    assert.strictEqual(bound.restoredTex, "\\begin{aligned}\n0 &< r \\\\\n&< \\frac{2GM}{c^{2}}\n\\end{aligned}")
    assert.strictEqual(bound.changed, true)
    assert.strictEqual(bound.targetUnitTex, "\\mathrm{m}")
    // Gathered rows continue the same way, and a new statement anchors afresh.
    assert.strictEqual(
      rawRestored("\\begin{gathered} r = 2M \\\\ = M \\end{gathered}"),
      "\\begin{gathered}\nr = \\frac{2GM}{c^{2}} \\\\\n= \\frac{GM}{c^{2}}\n\\end{gathered}",
    )
    assert.strictEqual(
      rawRestored("\\begin{aligned} E &= M \\\\ r &= 2M \\\\ &= 3M \\end{aligned}"),
      "\\begin{aligned}\nE &= Mc^{2} \\\\\nr &= \\frac{2GM}{c^{2}} \\\\\n&= \\frac{3GM}{c^{2}}\n\\end{aligned}",
    )
  })

  test("± and ∓ are branch signs: both branches take the same constants", () => {
    const cases: [string, string, string][] = [
      ["r = M \\pm a", "r = \\frac{GM}{c^{2}} \\pm a", "\\mathrm{m}"],
      ["r = M \\mp a", "r = \\frac{GM}{c^{2}} \\mp a", "\\mathrm{m}"],
      ["r = \\pm M", "r = \\pm \\frac{GM}{c^{2}}", "\\mathrm{m}"],
      ["x = \\pm t", "x = \\pm tc", "\\mathrm{m}"],
      ["t = \\pm r + 2M", "t = \\pm \\frac{r}{c} + \\frac{2GM}{c^{3}}", "\\mathrm{s}"],
      [
        "r = GM \\pm \\sqrt{G^2M^2 - a^2}",
        "r = \\frac{GM}{c^{2}} \\pm \\frac{\\sqrt{G^{2}M^{2} - a^{2}c^{4}}}{c^{2}}",
        "\\mathrm{m}",
      ],
      ["E = \\pm \\sqrt{p^2 + M^2}", "E = \\pm \\sqrt{p^{2} + M^{2}c^{2}}c", "\\mathrm{kg}\\,\\mathrm{m}^{2}\\,\\mathrm{s}^{-2}"],
      ["r = e^{\\pm i \\omega t} M", "r = \\frac{Ge^{\\pm i\\omega t}M}{c^{2}}", "\\mathrm{m}"],
      // `= \pm 1` states a value, not a unit convention, and is restored like `= -1`.
      ["v = \\pm 1", "v = \\pm 1c", "\\mathrm{m}\\,\\mathrm{s}^{-1}"],
      // Ledger #830 (gr-qc/9712019), with G explicit and c = 1.
      [
        "{\\frac{{dt}}{{dr}}}=\\pm\\left(1-{\\frac{{2GM}}{r}}\\right)^{-1}",
        "{\\frac{{dt}}{{dr}}} = \\pm \\frac{\\left(1 - \\frac{{\\frac{{2GM}}{r}}}{c^{2}}\\right)^{-1}}{c}",
        "\\mathrm{m}^{-1}\\,\\mathrm{s}",
      ],
    ]
    for (const [tex, out, unit] of cases) {
      const result = translated(tex)
      assert.strictEqual(result.restoredTex, out, tex)
      assert.strictEqual(result.targetUnitTex, unit, tex)
    }
    const kv = translated("\\omega = \\pm k v")
    assert.strictEqual(kv.restoredTex, "\\omega = \\pm kv")
    assert.strictEqual(kv.changed, false)
    // Geometrized, the branch sign survives the strip.
    assert.strictEqual(rawRestored("r = M \\pm a", GEO), "r = M \\pm a")
    assert.strictEqual(rawRestored("r = \\mp\\frac{GM}{c^2} \\pm a", GEO), "r = \\mp M \\pm a")
    assert.strictEqual(rawRestored("r = \\pm\\frac{GM}{c^2}", GEO), "r = \\pm M")
    // A definition's sum must already agree, branch or not.
    const length = dimensionOf("\\frac{2GM}{c^2} \\pm r", katexDefault, reg)
    assert.ok(length.kind === "dim", JSON.stringify(length))
    assert.deepStrictEqual(length.dim, [0, 12, 0, 0, 0])
    const mixed = dimensionOf("M \\pm a", katexDefault, reg)
    assert.ok(mixed.kind === "declined", JSON.stringify(mixed))
    assert.deepStrictEqual(mixed.reasons, ["terms of different dimension — nothing is restored to reconcile a definition"])
  })

  test("a sign beside a branch sign would need a fold that keeps no branch, and declines", () => {
    for (const tex of ["r = M \\pm -a", "r = M - \\pm a", "r = -\\pm a", "r = \\pm -a", "r = M \\pm \\mp a"]) {
      declines(tex, SIGN_RUN)
    }
  })

  test("a root keeps the sign of its body", () => {
    // Rebuilt from the body term alone, the sign went missing: `x = \sqrt{-Mr}`
    // shipped as `x = \sqrt{\frac{GMr}{c^{2}}}`.
    assert.strictEqual(rawRestored("x = \\sqrt{-M r}"), "x = \\sqrt{-\\frac{GMr}{c^{2}}}")
    assert.strictEqual(rawRestored("x = \\sqrt{\\pm M r}"), "x = \\sqrt{\\pm \\frac{GMr}{c^{2}}}")
    assert.strictEqual(rawRestored("x = \\sqrt{+M r}"), "x = \\sqrt{+\\frac{GMr}{c^{2}}}")
    assert.strictEqual(rawRestored("v = \\sqrt{-\\frac{M}{r}}"), "v = \\sqrt{-\\frac{GM}{r}}")
    assert.strictEqual(rawRestored("x = \\sqrt{-M r}", GEO), "x = \\sqrt{-Mr}")
  })

  test("a sign in a superscript is a label, and a run of signs is a pattern", () => {
    // A lone sign is a label the dictionary can key, and is looked up (step 11);
    // a sign closing a longer superscript, or set on nothing, is not.
    for (const [tex, name] of [
      ["x = \\sigma^{\\pm}", "\\sigma^{\\pm}"],
      ["x = X^{+}", "X^{+}"],
      ["x = X^{-}_{L}", "X^{-}_{L}"],
    ]) {
      const result = run(tex)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") assert.deepStrictEqual(result.unknown, [name], tex)
    }
    for (const tex of ["x = X^{n+}", "x = {}^{+}X"]) {
      declines(tex, SIGN_LABEL)
    }
    declines("(-+++)", "signs with nothing to act on (a sign pattern such as a metric signature)")
    // A sign with an operand after it is not a label: this is still a symbolic power.
    declines("r^{\\pm 1} = M", "a symbolic exponent on the dimensional base “r”")
  })
})

describe("declarations: relations among the constants themselves", () => {
  const DECLARATION =
    "a relation between the constants themselves — a declaration of the unit convention rather than a physical relation to restore"
  const numericValue = (quote: string) => `a numeric value for “${quote}”, in units the equation does not state`
  const comparison = (quote: string) => `a comparison of “${quote}” with a number, in units the equation does not state`
  const RELATION_ONLY = "a relation between the constants themselves, with no quantity in it to restore"
  const madeOfConstants = (quote: string) =>
    `a term made only of c and G that the registry's readings of the other terms would require rewriting into another constant (term “${quote}”)`
  const declines = (tex: string, reason: string) => {
    for (const target of [SI, GEO]) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [reason], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const translated = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = result as Extract<TranslationResult, { kind: "translated" }>
    rendersInKatex(out.restoredTex)
    return out
  }

  test("setting constants to one declines on every target, read through groups, fractions and roots", () => {
    // `c = 1` shipped in SI under the banner m s⁻¹; geometrized, `\frac{c^4}{G} = 1`
    // shipped as `1 = 1` and `{c} = 1` as `{1} = 1`.
    for (const tex of [
      "c = 1",
      "\\hbar = 1",
      "k_B = 1",
      "8\\pi G = 1",
      "\\frac{c^4}{G} = 1",
      "{c} = 1",
      "(c) = 1",
      "\\left(c\\right) = 1",
      "\\frac{1}{c} = 1",
      "G/c^2 = 1",
      "\\sqrt{G} = 1",
      "c^2 = 1",
      "c^{-1} = 1",
      "\\hbar c = 1",
      "\\hbar^2 = 1",
      "(8\\pi) G = 1",
      "\\hbar = c = 1",
      "c = \\hbar = k_B = 1",
      "G = c = 1",
      "c = +1",
      "c \\equiv 1",
      "\\hbar := 1",
    ]) {
      declines(tex, DECLARATION)
    }
  })

  test("a definition spelled \\coloneqq is read as :=, not as a comparison", () => {
    // The relation was matched by its spelling, so `c \coloneqq 1` was a
    // "comparison of c with a number" while `c := 1` was a declaration.
    declines("c \\coloneqq 1", DECLARATION)
    declines("G \\coloneqq c \\coloneqq 1", DECLARATION)
    declines("\\begin{aligned} E &= mc^2 \\\\ c &\\coloneqq 1 \\end{aligned}", DECLARATION)
    declines("c \\coloneqq 299792458", numericValue("c"))
    declines("c \\coloneqq -1", numericValue("c"))
  })

  test("only an equality setting unsigned constants to +1 is a declaration", () => {
    // The numerals alone once decided it: `\hbar \ne 1` (ħ is NOT one), the
    // central-charge bound `c < 1`, `c = -1` and `c^2 = -1` were all called
    // unit conventions, while `c = -2` was a numeric value.
    for (const [tex, quote] of [
      ["\\hbar \\ne 1", "\\hbar"],
      ["c < 1", "c"],
      ["c > 1", "c"],
      ["c \\leq 1", "c"],
      ["G \\ll 1", "G"],
      ["c \\sim 1", "c"],
      ["c \\approx 1", "c"],
    ]) {
      declines(tex, comparison(quote))
    }
    declines("c = -1", numericValue("c"))
    declines("c = -2", numericValue("c"))
    declines("-c = 1", numericValue("c"))
    declines("-c = -1", numericValue("c"))
    declines("c = \\pm 1", numericValue("c"))
    declines("c^2 = -1", numericValue("c^{2}"))
    // A sign inside a wrapping is read through it too, not flattened away.
    declines("(-c) = 1", numericValue("(-c)"))
    declines("\\frac{-c^4}{G} = 1", numericValue("\\frac{-c^{4}}{G}"))
    declines("\\sqrt{-G} = 1", numericValue("\\sqrt{-G}"))
    // A side made only of constants is quoted whole: it is c + G that gets a value.
    declines("c + G = 1", numericValue("c + G"))
    // With no numeral but zero, the row only relates the constants.
    declines("c > G", RELATION_ONLY)
    declines("c - G = 0", RELATION_ONLY)
    declines("G = c", RELATION_ONLY)
  })

  test("a constant given any other value states it in units the equation does not name", () => {
    // `c = -26` is a central charge the registry reads as the speed of light;
    // it came out as `c = -26c`, and `c = 299792458` as `299792458c`.
    declines("c = 299792458", numericValue("c"))
    declines("c = -26", numericValue("c"))
    declines("c = 2\\pi", numericValue("c"))
    declines("\\hbar c = 197.3", numericValue("\\hbar c"))
    declines("c^2 - 1 = 0", numericValue("c^{2}"))
    declines("c = 1 + 1", numericValue("c"))
  })

  test("a continuation row that ends in a constant belongs to its chain", () => {
    // Read by itself, `&= c` declared the whole derivation a unit convention.
    const v = translated("\\begin{aligned} v &= \\frac{dr}{dt} \\\\ &= c \\end{aligned}")
    assert.strictEqual(v.changed, false)
    assert.strictEqual(v.restoredTex, "\\begin{aligned}\nv &= \\frac{dr}{dt} \\\\\n&= c\n\\end{aligned}")
    const rs = translated("\\begin{aligned} \\frac{2GM}{r_s} &= \\frac{2GM}{2GM/c^2} \\\\ &= c^2 \\end{aligned}")
    assert.strictEqual(rs.changed, false)
    const lp = translated(
      "\\begin{aligned} \\frac{\\ell_P^2c^3}{\\hbar} &= \\frac{\\hbar G}{c^3}\\frac{c^3}{\\hbar} \\\\ &= G \\end{aligned}",
    )
    assert.strictEqual(lp.changed, false)
    // Continuing a chain in another dimension, the constant is a term among quantities.
    declines("\\begin{aligned} r &= 2M \\\\ &= c \\end{aligned}", madeOfConstants("c"))
  })

  test("a row that declares declines the whole equation", () => {
    // Otherwise the first row shipped `c = 1` beside a restored `E = mc^2`.
    declines("\\begin{aligned} c &= 1 \\\\ E &= mc^2 \\end{aligned}", DECLARATION)
    declines("\\begin{aligned} c &= 1 \\\\ &= v \\end{aligned}", DECLARATION)
    declines("\\begin{aligned} G &= 1 \\\\ c &= 1 \\end{aligned}", DECLARATION)
  })

  test("a constant term among quantities is a verdict on the registry's readings", () => {
    declines("g_{00} \\approx -c^2 - 2\\Phi", madeOfConstants("c^{2}"))
    declines("a = b = c", madeOfConstants("c"))
  })

  test("relations with a quantity in them are untouched", () => {
    assert.strictEqual(translated("v = 0.5").restoredTex, "v = 0.5c")
    const th = translated("T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}")
    assert.strictEqual(th.changed, false)
    assert.strictEqual(translated("\\frac{2GM}{r_s} = c^2").changed, false)
    assert.strictEqual(translated("\\Omega = 1").restoredTex, "\\Omega = 1")
    assert.strictEqual(translated("E = mc^2", GEO).restoredTex, "E = m")
  })
})

describe("batch-1 review fixes", () => {
  const rawRestored = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
    rendersInKatex(out)
    return out
  }
  const declines = (tex: string, reason: string, targets: TargetSpec[] = [SI, GEO]) => {
    for (const target of targets) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [reason], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const SPACING = "explicit spacing between two factors — two statements or one product? (select a single equation)"

  test("(a) a stripped constant takes the glue that only separated it along", () => {
    // Live after step 2, each of these left spacing or a product sign with
    // nothing on one side of it, two runs of glue merged into one, or a `1`.
    assert.strictEqual(rawRestored("E = m~\\cdot~ c^2", GEO), "E = m")
    assert.strictEqual(rawRestored("E = m\\ c^2", GEO), "E = m")
    assert.strictEqual(rawRestored("x = \\frac{GM}{c^2}\\ \\frac{c^2}{G}", GEO), "x = M")
    assert.strictEqual(rawRestored("ds^2 = -c^2\\ dt^2+dx^2", GEO), "ds^2 = -dt^2 + dx^2")
    assert.strictEqual(rawRestored("r_s = \\frac{2\\ G\\ M}{c^2}", GEO), "r_{s} = 2\\ M")
    // A group, a root, a powered group or a fraction that held nothing but
    // constants vanishes whole instead of leaving a 1 beside the product.
    assert.strictEqual(rawRestored("E = m(c^2)", GEO), "E = m")
    assert.strictEqual(rawRestored("E = m{c^2}", GEO), "E = m")
    assert.strictEqual(rawRestored("x = (c)^2 r", GEO), "x = r")
    assert.strictEqual(rawRestored("t = r\\frac{1}{c}", GEO), "t = r")
    assert.strictEqual(rawRestored("E = \\frac{1}{c}\\, m c^3", GEO), "E = m")
    // Between two survivors, one run of glue stays: the first one written.
    assert.strictEqual(rawRestored("E = m\\cdot c\\cdot v", GEO), "E = m\\cdot v")
    // A strip that vanishes is still a change, and still read back.
    for (const tex of ["E = m\\ c^2", "\\kappa = \\frac{c^4}{4GM}", "x = \\frac{GM}{c^2}\\ \\frac{c^2}{G}"]) {
      assert.strictEqual((run(tex, GEO) as { changed?: boolean }).changed, true, tex)
    }
  })

  test("(a) glue is kept where nothing vanished, and a 1 stays when it is the whole product", () => {
    assert.strictEqual(rawRestored("E = m\\ v^2", GEO), "E = m\\ v^{2}")
    assert.strictEqual(rawRestored("\\frac{M}{r} = \\frac{c^2}{G}", GEO), "\\frac{M}{r} = 1")
    assert.strictEqual(rawRestored("\\kappa = \\frac{c^4}{4GM}", GEO), "\\kappa = \\frac{1}{4M}")
    assert.strictEqual(rawRestored("E = mc^2 + M c^2\\ ", GEO), "E = m + M")
    // Nothing is stripped outside a geometrized target, so nothing moves.
    assert.strictEqual(rawRestored("E = m~\\cdot~ c^2"), "E = m~\\cdot~c^{2}")
    assert.strictEqual(rawRestored("r_s = \\frac{2\\ G\\ M}{c^2}"), "r_{s} = \\frac{2\\ G\\ M}{c^{2}}")
  })

  test("(b) c or G under a font other than italic is another symbol, not the constant", () => {
    const FONT = (adjective: string, spelled: string, letter: string) =>
      `the ${adjective} “${spelled}” — another symbol (a vector, a tensor or a label), not the constant ${letter}`
    // Live, `E = m{\bf c}^2` stripped to `m{\bf 1}^{2}`, and `{\bf c} = 1` shipped unchanged.
    declines("E = m{\\bf c}^2", FONT("bold", "{\\bf c}", "c"))
    declines("{\\bf c} = 1", FONT("bold", "{\\bf c}", "c"))
    declines("E = m\\mathbf{c}^2", FONT("bold", "\\mathbf{c}", "c"))
    declines("E = m\\mathbf c^2", FONT("bold", "\\mathbf{c}", "c"))
    declines("E = m\\boldsymbol{c}^2", FONT("bold", "\\boldsymbol{c}", "c"))
    declines("E = m\\bm{c}^2", FONT("bold", "\\bm{c}", "c"))
    declines("x = \\mathcal{G} M", FONT("calligraphic", "\\mathcal{G}", "G"))
    declines("x = \\mathsf{G} M", FONT("sans-serif", "\\mathsf{G}", "G"))
    declines("E = m\\mathbf{c^2}", FONT("bold", "\\mathbf{c}", "c"))
    // Upright keeps the upright-letter reason it already had.
    declines("E = m\\mathrm{c}^2", "the upright letter “c” — a unit, a label or an operator, not a variable")
  })

  test("(b) italic c is still the constant, and a bold G with indices is still the Einstein tensor", () => {
    assert.strictEqual(rawRestored("E = m\\mathit{c}^2"), "E = m\\mathit{c}^{2}")
    assert.strictEqual(rawRestored("E = m\\mathit{c}^2", GEO), "E = m")
    // Looked through, an italic c set to one is a declaration like `c = 1`.
    declines(
      "\\mathit{c} = 1",
      "a relation between the constants themselves — a declaration of the unit convention rather than a physical relation to restore",
    )
    assert.strictEqual(rawRestored("\\mathbf{G}_{ab} = 8\\pi T_{ab}"), "\\mathbf{G}_{ab} = \\frac{8\\pi GT_{ab}}{c^{4}}")
  })

  test("(c) a row that opens at a relation quotes the relation it opens at", () => {
    const OPENS = (rel: string) => `a row that begins at “${rel}” with nothing before it to anchor it`
    declines("= 2M", OPENS("="))
    declines("< r", OPENS("<"))
    declines("\\le r", OPENS("\\le"))
    declines("\\approx r", OPENS("\\approx"))
    declines("\\ne r", OPENS("\\ne"))
  })

  test("(d) an evaluation bar is never a function's argument group", () => {
    // Live, `r\sin\left.M/t\right|` restored to `r\sin\left.GM/tc^{3}\right|`.
    declines("x = r\\sin\\left.M/t\\right|", "an evaluation bar “\\left. … \\right|”, which is not supported yet", [SI])
    declines("x = r\\sin\\left.M/t\\right|_{0}^{1}", "evaluation limits, which are not supported yet", [SI])
    declines("x = r\\sin\\left.M/t\\right|^{1}", "evaluation limits, which are not supported yet", [SI])
    declines(
      "x = r\\sin\\left.M/t\\right|_{t=0}",
      "an evaluation condition in a subscript, which is not supported yet",
      [SI],
    )
  })

  test("(d) a modulus after a head follows the unparenthesized-argument rule", () => {
    // Not an argument group: the constants restore the whole argument, bars included.
    assert.strictEqual(rawRestored("x = r\\sin\\left|M/t\\right|"), "x = r\\sin\\frac{G\\left|M/t\\right|}{c^{3}}")
    assert.strictEqual(rawRestored("x = r\\sin\\lvert M/t\\rvert"), "x = r\\sin\\frac{G\\lvert M/t\\rvert}{c^{3}}")
    // A bracket group is still the argument, restored inside it.
    assert.strictEqual(rawRestored("x = r\\sin\\left(M/t\\right)"), "x = r\\sin\\left(GM/tc^{3}\\right)")
  })

  test("(e) spacing between a head and its delimited argument is emitted as written", () => {
    // Live, the \quad was dropped, and `\ ` and `~` declined as a divergence.
    assert.strictEqual(rawRestored("x = r\\sin\\quad(M/t)"), "x = r\\sin\\quad(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin\\ (M/t)"), "x = r\\sin\\ (GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin~(M/t)"), "x = r\\sin~(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin\\,(M/t)"), "x = r\\sin\\,(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin^{2}\\,(M/t)"), "x = r\\sin^{2}\\,(GM/tc^{3})")
    // A kern no command spells declines by name; one spelled another way than
    // its rebuilt command is a divergence the backstop catches, and names.
    declines(
      "x = r\\sin\\hspace{2pt}(M/t)",
      "spacing between “\\sin” and its argument that the engine cannot re-emit as written, which is not supported",
      [SI],
    )
    declines(
      "x = r\\sin\\thinspace(M/t)",
      "the spacing “\\thinspace”, which the engine cannot re-emit as written, is not supported",
      [SI],
    )
  })

  test("(f) a numeral raised to a power is one dimensionless numeral", () => {
    // KaTeX parses 10^{8} as 1 followed by 0^{8}; the "0" was an unknown symbol.
    const VALUE = (quote: string) => `a numeric value for “${quote}”, in units the equation does not state`
    declines("c = 3\\times10^{8}", VALUE("c"))
    declines("c = 3\\times10^8", VALUE("c"))
    declines("\\hbar = 1.054\\times10^{-34}", VALUE("\\hbar"))
    assert.strictEqual(rawRestored("v = 10^{-3}"), "v = 10^{-3}c")
    assert.strictEqual(rawRestored("x = 2^{10} r"), "x = 2^{10}r")
    // A symbolic exponent is read as e's is: dimensionless, restored inside.
    assert.strictEqual(rawRestored("x = 10^{M/r} r"), "x = 10^{GM/rc^{2}}r")
    const unknown = run("x = 10^{n} r")
    assert.strictEqual(unknown.kind, "declined", JSON.stringify(unknown))
    if (unknown.kind === "declined") assert.deepStrictEqual(unknown.unknown, ["n"])
    // A powered numeral is no literal 1: it does not mark a convention.
    assert.strictEqual(rawRestored("v = 1^{2}"), "v = 1^{2}c")
  })

  test("(g) a digit superscript beside an index subscript on an indexed reading declines", () => {
    const DIGIT = (tex: string) => `a digit superscript on “${tex}” — a component index or a power`
    // Live, these shipped unchanged under m⁻², m⁻³ and m⁻⁴.
    declines("\\Gamma^{2}_{00} = 0", DIGIT("\\Gamma^{2}_{00}"))
    declines("\\Gamma^{3}_{23} = 0", DIGIT("\\Gamma^{3}_{23}"))
    declines("R^{2}_{0} = 0", DIGIT("R^{2}_{0}"))
    declines("\\Gamma_{00}^{2} = 0", DIGIT("\\Gamma_{00}^{2}"))
    declines("\\Gamma^{2}_{12}={\\frac{1}{r}}", DIGIT("\\Gamma^{2}_{12}"))
  })

  test("(g) a power with no component reading is read as it was", () => {
    // Superscript 1 gives the index reading's dimension either way.
    assert.strictEqual(rawRestored("\\Gamma^{1}_{00} = \\frac{M}{r^2}"), "\\Gamma^{1}_{00} = \\frac{GM}{r^{2}c^{2}}")
    // An identity the registry spells out, a symbol with no subscript, a derivative order.
    assert.strictEqual(
      rawRestored("\\Omega_{\\Lambda}\\equiv\\frac{\\Lambda\\,c^{2}}{3\\,H_{0}^{2}}"),
      "\\Omega_{\\Lambda} \\equiv \\frac{\\Lambda c^{2}}{3H_{0}^{2}}",
    )
    assert.strictEqual(rawRestored("A = r^2"), "A = r^{2}")
    assert.strictEqual(rawRestored("\\partial_{t}^{2} r = 0"), "\\partial_{t}^{2}r = 0")
    // A superscript 0 is an index, as it always was.
    assert.strictEqual(rawRestored("\\Gamma^{0}_{00} = \\frac{M}{r^2}"), "\\Gamma^{0}_{00} = \\frac{GM}{r^{2}c^{2}}")
  })

  test("(h) spacing before a sign that separates terms is a statement boundary too", () => {
    // Live, `t = 0 \qquad -r = 2M` shipped as t = 0 − r/c = 2GM/c³. A quad
    // wide, the run now separates two statements (step 9); narrower, it declines.
    assert.strictEqual(rawRestored("t = 0 \\qquad -r = 2M"), "t = 0 \\qquad -r = \\frac{2GM}{c^{2}}")
    declines("t = 0 \\; -r = 2M", SPACING)
    declines("v = x = y\\, - x", SPACING)
    // In a single-relation row only a run of a quad or more declines.
    declines("r = 2M \\qquad - a", SPACING)
    assert.strictEqual(rawRestored("-c^2\\,dt^2 \\, + dx^2 = ds^2"), "-c^{2}dt^2 + dx^2 = ds^2")
    assert.strictEqual(rawRestored("ds^2 = -c^2\\,dt^2 + dx^2"), "ds^2 = -c^{2}dt^2 + dx^2")
    assert.strictEqual(rawRestored("E = m\\, + M"), "E = mc^{2} + Mc^{2}")
    // Inside brackets the delimiters already make one expression.
    assert.strictEqual(rawRestored("E = (m\\qquad + M)"), "E = (m + M)c^{2}")
  })

  // Round 1: numerals that kerns or a stripped constant kept apart fused into
  // another number, and the digit guard missed the staggered-index spelling.
  // Since step 7c one net over the output declines every such fusion.
  const FUSED = (left: string, right: string) =>
    `the numerals ending “${left}” and opening “${right}”, which a stripped constant leaves side by side as one number — not supported`

  test("(f) a kern between two numerals is emitted, rebuilt from its width", () => {
    // Live, the kern was dropped and the numerals fused: 310^{2}, 2.510^{-3}, 32, 3.5.
    assert.strictEqual(rawRestored("x = 3\\,10^{2} M"), "x = \\frac{3\\,10^{2}GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\;10^{2}\\,M"), "x = \\frac{3\\;10^{2}GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 2.5\\,10^{-3}\\,M"), "x = \\frac{2.5\\,10^{-3}GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,2 M"), "x = \\frac{3\\,2GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,.5\\,M"), "x = \\frac{3\\,.5GM}{c^{2}}")
    assert.strictEqual(rawRestored("E = 5\\,10^{2}\\,m c^2", GEO), "E = 5\\,10^{2}m")
    // A kern no command gives cannot be rebuilt, so it declines by name.
    declines(
      "x = 3\\hspace{1pt}2 M",
      "spacing between two numerals that the engine cannot re-emit as written, which is not supported",
      [SI],
    )
    // Control spacing was always kept; a kern beside anything but a numeral is still dropped.
    assert.strictEqual(rawRestored("x = 3\\ 10^{2} M"), "x = \\frac{3\\ 10^{2}GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3~10^{2} M"), "x = \\frac{3~10^{2}GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 2\\,\\pi\\, M"), "x = \\frac{2\\pi GM}{c^{2}}")
    assert.strictEqual(rawRestored("E = m\\,c^2"), "E = mc^{2}")
  })

  test("(a) a stripped constant between two numerals declines, whatever spacing stays", () => {
    // Live, the numerals fused: M/55 for M/25, 23M, 510^{2}m, 10^{3}5M. Round 1
    // kept a kern between them (`\frac{M}{5\,5}`, `2\,3M`), but a thin space is
    // how digits are grouped, and 5 5 still reads as 55: since step 7c they decline.
    declines("x = \\frac{G\\,M}{5\\,c^2\\,5}", FUSED("5", "5"), [GEO])
    declines("x = 2\\,G\\,3\\,M", FUSED("2", "3"), [GEO])
    declines("E = 5\\,c^2\\,10^{2}\\,m", FUSED("5", "10^{2}"), [GEO])
    declines("x = 10^{3}\\,G\\,5 M", FUSED("10^{3}", "5"), [GEO])
    declines("x = 1.5\\,G\\,.5\\,M", FUSED("1.5", ".5"), [GEO])
    // A strip that bares a numeral inside a group is seen from outside it.
    declines("x = 2\\,{G\\,3}\\,M", FUSED("2", "3"), [GEO])
    declines("x = 2G3M", FUSED("2", "3"), [GEO])
    declines("x = \\frac{2 G 3 M}{c^2}", FUSED("2", "3"), [GEO])
    declines("x = 2 G^{2} 3 M", FUSED("2", "3"), [GEO])
    declines("x = 2\\ G\\ 3\\ M", FUSED("2", "3"), [GEO])
    // A product sign printed between them keeps them apart, and a kern beside a non-numeral still goes.
    assert.strictEqual(rawRestored("x = 2\\cdot G\\cdot 3 M", GEO), "x = 2\\cdot3M")
    assert.strictEqual(rawRestored("x = 2\\,G\\,M", GEO), "x = 2M")
  })

  test("(a) a written constant between two numerals is not folded away at SI", () => {
    // Live, folding G into the inserted constants left the kerns alone between 2 and 3.
    assert.strictEqual(rawRestored("x = 2\\,G\\,3\\,M"), "x = \\frac{2G3M}{c^{2}}")
    assert.strictEqual(rawRestored("x = 2G3M"), "x = \\frac{2G3M}{c^{2}}")
    // Anywhere else it still folds and moves to the head.
    assert.strictEqual(rawRestored("x = M G"), "x = \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("E = mc"), "E = mc^{2}")
  })

  test("(g) a digit superscript declines across a floating rider too", () => {
    const DIGIT = (tex: string) => `a digit superscript on “${tex}” — a component index or a power`
    // Live, these shipped as m⁻⁴, m⁻⁶, m⁻⁴, and the component R₀₀.
    declines("R^{2}{}_{323} = 0", DIGIT("R^{2}{}_{323}"))
    declines("R^{3}{}_{232} = 0", DIGIT("R^{3}{}_{232}"))
    declines("R^{2}{}_{0} = 0", DIGIT("R^{2}{}_{0}"))
    declines("R^{2}{}_{0} = \\frac{M^2}{r^6}", DIGIT("R^{2}{}_{0}"))
    declines("R_{00}{}^{2} = 0", DIGIT("R_{00}{}^{2}"))
    declines("\\Gamma^{2}{}_{00} = 0", DIGIT("\\Gamma^{2}{}_{00}"))
    // The digits 0 and 1 keep the component reading.
    assert.strictEqual(rawRestored("R^{0}{}_{101} = \\frac{M}{r^3}"), "R^{0}{}_{101} = \\frac{GM}{r^{3}c^{2}}")
    assert.strictEqual(rawRestored("R^{1}{}_{010} = \\frac{M}{r^3}"), "R^{1}{}_{010} = \\frac{GM}{r^{3}c^{2}}")
    assert.strictEqual(rawRestored("R_{00}{}^{0} = 0"), "R_{00}{}^{0} = 0")
  })

  // Round 2: a fraction of numerals is a numeral too, whether written or left
  // by a strip, and the digit guard missed the braced stagger.

  test("(f) a kern beside a fraction of numerals is kept: it stops a mixed-number reading", () => {
    // Live, the kern was dropped and 1.5r read as the mixed number 3½ r.
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}\\,r + M"), "x = 3\\,\\frac{1}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 2\\,\\frac{1}{2}\\,r + M"), "x = 2\\,\\frac{1}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = r\\,3\\,\\frac{1}{2} + M"), "x = r3\\,\\frac{1}{2} + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,\\tfrac{1}{2}\\,r + M"), "x = 3\\,\\tfrac{1}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,\\dfrac{1}{2}\\,r + M"), "x = 3\\,\\dfrac{1}{2}r + \\frac{GM}{c^{2}}")
    // A mixed number the author wrote stays one, and a fraction that is not
    // all numerals is no mixed number, so the kern beside it still goes.
    assert.strictEqual(rawRestored("x = 3\\frac{1}{2}r + M"), "x = 3\\frac{1}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\frac{1}{2}r + \\frac{GM}{c^2}", GEO), "x = 3\\frac{1}{2}r + M")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{\\pi}{2}\\,r + M"), "x = 3\\frac{\\pi}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{r}{2} + M"), "x = 3\\frac{r}{2} + \\frac{GM}{c^{2}}")
  })

  test("(a) a strip that leaves a numeral at a fraction's edge beside another declines", () => {
    // Live, these fused: 32M for 6M, 2½M for M, 3½M for 1.5M.
    declines("E = 3 \\frac{2G}{c^2} M", FUSED("3", "2"), [GEO])
    declines("x = \\frac{2G}{c^2}\\frac{1}{2}M", FUSED("2", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("E = 2 c^2 \\frac{1}{2} m", FUSED("2", "\\frac{1}{2}"), [GEO])
    // A kern kept between them does not keep them apart (`3\,2M` reads as
    // 32M); round 1 shipped it, and since step 7c it declines.
    declines("E = 3\\,\\frac{2G}{c^2}\\, M", FUSED("3", "2"), [GEO])
    // Before a fraction of numerals a kern keeps nothing apart, for it is how
    // a mixed number is set; these shipped as 2½m for m and 3½M for 1.5M
    // until step 7b, and decline with the others.
    declines("E = 2\\, c^2\\, \\frac{1}{2} m", FUSED("2", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\,\\frac{G}{c^{2}}\\,\\frac{1}{2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\,\\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    // With no numeral on the other side, the collapsed fraction is set as it prints.
    assert.strictEqual(rawRestored("x = \\frac{2G}{c^2} M", GEO), "x = 2M")
    assert.strictEqual(rawRestored("x = r\\frac{G}{2c^2}", GEO), "x = r\\frac{1}{2}")
  })

  test("(g) a digit superscript declines across braces, in both orders", () => {
    const DIGIT = (tex: string) => `a digit superscript on “${tex}” — a component index or a power`
    // Live, these shipped under m⁻⁴ or translated on the power reading.
    declines("{R^{2}}_{0} = 0", DIGIT("{R^{2}}_{0}"))
    declines("{R^{2}}_{00} = \\frac{M^2}{r^6}", DIGIT("{R^{2}}_{00}"), [SI])
    declines("{R^{2}}_{00} = \\frac{G^2M^2}{c^4r^6}", DIGIT("{R^{2}}_{00}"), [GEO])
    declines("{R_{00}}^{2} = 0", DIGIT("{R_{00}}^{2}"))
    declines("{\\Gamma^{2}}_{00} = 0", DIGIT("{\\Gamma^{2}}_{00}"))
    declines("{\\Gamma_{00}}^{2} = 0", DIGIT("{\\Gamma_{00}}^{2}"))
    // Braces followed by a rider are the same notation.
    declines("{R^{2}}{}_{0} = 0", DIGIT("{R^{2}}{}_{0}"))
    declines("{R_{00}}{}^{2} = 0", DIGIT("{R_{00}}{}^{2}"))
    // The digits 0 and 1 keep the component reading; a base with no indexed
    // reading, or an identity the registry spells out, keeps the power.
    assert.strictEqual(rawRestored("{R^{0}}_{101} = \\frac{M}{r^3}"), "{R^{0}}_{101} = \\frac{GM}{r^{3}c^{2}}")
    assert.strictEqual(rawRestored("{R^{1}}_{010} = \\frac{M}{r^3}"), "{R^{1}}_{010} = \\frac{GM}{r^{3}c^{2}}")
    assert.strictEqual(rawRestored("{R^{0}}{}_{101} = \\frac{M}{r^3}"), "{R^{0}}{}_{101} = \\frac{GM}{r^{3}c^{2}}")
    assert.strictEqual(rawRestored("{R_{00}}^{1} = 0"), "{R_{00}}^{1} = 0")
    assert.strictEqual(rawRestored("{r^{2}}_{0} = 0"), "{r^{2}}_{0} = 0")
    assert.strictEqual(rawRestored("{H_0}^{2} = \\frac{1}{r^2}"), "{H_{0}}^{2} = \\frac{c^{2}}{r^{2}}")
  })

  // Step 7b: the wrong outputs the polish review left standing.
  test("a floating script after a function head declines", () => {
    const FLOATING = (script: string, head: string) =>
      `the floating script “${script}” after “${head}” — the function's power or a script on its argument — which is not supported`
    // Live, the script opened the argument and the restored G took it:
    // `r\sin\frac{G{}^{2}(M/t)}{c^{3}}`, with the square on G.
    declines("x = r\\sin{}^{2}(M/t)", FLOATING("{}^{2}", "\\sin"))
    declines("x = r\\sin\\,^{2}(M/t)", FLOATING("{}^{2}", "\\sin"))
    declines("x = r\\sin\\quad^{2}(M/t)", FLOATING("{}^{2}", "\\sin"))
    declines("x = r\\sin {}^{2}(M/t)", FLOATING("{}^{2}", "\\sin"))
    declines("x = r\\sin{}_{2}(M/t)", FLOATING("{}_{2}", "\\sin"))
    declines("x = r\\ln{}^{2}(M/t)", FLOATING("{}^{2}", "\\ln"))
    declines("x = r\\sin^{2}{}^{3}(M/t)", FLOATING("{}^{3}", "\\sin^{2}"))
    declines("x = r\\sin{}{}^{2}(M/t)", FLOATING("{}^{2}", "\\sin"))
    declines("x = r\\sin{}^{2}x", FLOATING("{}^{2}", "\\sin"))
    // Braced, the script still opened the argument: `r\sin\frac{G{{}^{2}}(M/t)}{c^{3}}`
    // and `r\ln\frac{{{}^{2}}(r/M)c^{2}}{G}`.
    declines("x = r\\sin{{}^{2}}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{\\,{}^{2}}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{{}^{2}(M/t)}", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{{}_{0}}(M/t)", FLOATING("{}_{0}", "\\sin"), [SI])
    declines("x = r\\ln{{}^{2}}(r/M)", FLOATING("{}^{2}", "\\ln"), [SI])
    declines("x = r\\sin{{{}^{2}}}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{{}{}^{2}}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{{}^{2}}^{3}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{{\\,}{}^{2}}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    declines("x = r\\sin{\\,}^{2}(M/t)", FLOATING("{}^{2}", "\\sin"), [SI])
    // A prime on nothing is a floating script, declined when it is read: its
    // script has no source to name it by, and naming it here failed as an
    // unrecovered fragment.
    declines("x = r\\sin{}'(M/t)", "a floating super/subscript", [SI])
    // A power on the head itself, and an empty group with no script, are read as before.
    assert.strictEqual(rawRestored("x = r\\sin^{2}(M/t)"), "x = r\\sin^{2}(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin^{2}\\,(M/t)"), "x = r\\sin^{2}\\,(GM/tc^{3})")
    assert.strictEqual(rawRestored("x = r\\sin{}(M/t)"), "x = r\\sin(GM/tc^{3})")
  })

  test("a sign right after a product sign or a slash is a sign on a factor, and declines", () => {
    const SIGNED = (sign: string, product: string) =>
      `the sign “${sign}” right after “${product}”, a sign on a factor rather than between terms, which is not supported`
    // Live, the split at the sign shipped `t = \frac{r\cdot}{c} - \frac{r}{c}`, where r·(−r) is m².
    declines("t = r \\cdot -r", SIGNED("-", "\\cdot"))
    declines("t = r \\times -r", SIGNED("-", "\\times"))
    declines("t = r \\cdot +r", SIGNED("+", "\\cdot"))
    declines("t = r\\cdot\\,-r", SIGNED("-", "\\cdot"))
    declines("t = r \\cdot \\pm r", SIGNED("\\pm", "\\cdot"))
    declines("t = r \\cdot - r - r", SIGNED("-", "\\cdot"))
    declines("t = r / -r", SIGNED("-", "/"))
    // A sign between terms, and a product sign between factors, are read as before.
    assert.strictEqual(rawRestored("t = r - r"), "t = \\frac{r}{c} - \\frac{r}{c}")
    assert.strictEqual(rawRestored("E = 3\\times10^{8} m"), "E = 3\\times10^{8}mc^{2}")
    assert.strictEqual(rawRestored("E = m\\cdot c\\cdot v", GEO), "E = m\\cdot v")
  })

  const HL: TargetSpec = { system: "hl", geometrized: false }
  const ACCENTED = (spelled: string, letter: string) =>
    `the accented “${spelled}” — another symbol (a vector, a mean, an operator or a label), not the constant ${letter}`

  test("an accented c or G is another symbol, not the constant", () => {
    // Live at GEO: `\vec{1}M`, `\bar{1}M`, `\tilde{1}M`, `\hat{1} = 1`; at SI
    // `\vec{c}Mc` and `\frac{\bar{G}Mc^{2}}{G}`, the accented letter read as the constant.
    declines("E = \\vec{c} M", ACCENTED("\\vec{c}", "c"))
    declines("E = \\bar{G} M", ACCENTED("\\bar{G}", "G"))
    declines("E = \\tilde{G} M", ACCENTED("\\tilde{G}", "G"))
    declines("\\hat{c} = 1", ACCENTED("\\hat{c}", "c"), [GEO])
    declines("E = \\vec c M", ACCENTED("\\vec{c}", "c"))
    declines("E = \\bar{{c}} M", ACCENTED("\\bar{c}", "c"))
    declines("E = \\overline{c} M", ACCENTED("\\overline{c}", "c"))
    declines("E = \\check{c} M", ACCENTED("\\check{c}", "c"))
    declines("E = \\breve{G} M", ACCENTED("\\breve{G}", "G"))
    declines("E = \\hat{c}^{2} M", ACCENTED("\\hat{c}", "c"))
    declines("E = \\vec{c}\\cdot\\vec{p}", ACCENTED("\\vec{c}", "c"), [GEO])
    // A script on the letter under the accent: live at GEO `\bar{1}M`,
    // `\overline{1}M` and `\hat{1}t^{2}/t`; at SI `\frac{G\bar{c^{2}}M}{c^{4}}`.
    declines("x = \\bar{c^{2}} M", ACCENTED("\\bar{c^{2}}", "c"))
    declines("x = \\overline{c^{2}} M", ACCENTED("\\overline{c^{2}}", "c"))
    declines("x = \\hat{c^{2}}\\,t^{2}/t", ACCENTED("\\hat{c^{2}}", "c"), [GEO])
    // c_0 is not read as the constant but looked up, and is not in the registry:
    // the decline names it unknown, not the accent (step 7c: the accent decides
    // on what the analysis read).
    const subscripted = run("x = \\hat{c_{0}} M")
    assert.ok(subscripted.kind === "declined", JSON.stringify(subscripted))
    assert.deepStrictEqual(subscripted.reasons, [])
    assert.deepStrictEqual(subscripted.unknown, ["c_{0}"])
    declines("x = \\bar{{c}^{2}} M", ACCENTED("\\bar{{c}^{2}}", "c"))
    declines("x = \\tilde{G^{2}} M", ACCENTED("\\tilde{G^{2}}", "G"))
    // An empty group, a script on nothing or brackets beside the lone letter:
    // live at GEO `\bar{1}M`, `\vec{1}M`, `\hat{1}M`, `\overline{1}M`, and
    // `\bar{{}^{2}}M` with the square stripped as c² under the bar.
    declines("x = \\bar{c{}} M", ACCENTED("\\bar{c}", "c"))
    declines("x = \\bar{{}c} M", ACCENTED("\\bar{c}", "c"))
    declines("x = \\vec{{}c} M", ACCENTED("\\vec{c}", "c"))
    declines("x = \\hat{G{}} M", ACCENTED("\\hat{G}", "G"))
    declines("x = \\overline{c{}} M", ACCENTED("\\overline{c}", "c"))
    declines("x = \\bar{{c}{}} M", ACCENTED("\\bar{{c}}", "c"))
    declines("x = \\bar{c{}^{2}} M", ACCENTED("\\bar{c{}^{2}}", "c"))
    declines("x = \\bar{(c)} M", ACCENTED("\\bar{(c)}", "c"))
    declines("x = \\bar{\\left(c\\right)} M", ACCENTED("\\bar{\\left(c\\right)}", "c"))
    // An accent over any other letter is read.
    assert.strictEqual(rawRestored("E = \\bar{m}c^2", GEO), "E = \\bar{m}")
    assert.strictEqual(rawRestored("E = \\bar{m}c^2"), "E = \\bar{m}c^{2}")
  })

  // Step 7c: the accent and numeral guards matched TeX shapes, and each review
  // round found the next shape one bracket or one delimiter away still shipping.
  test("an accent declines whenever the analysis of its body read c or G as the constant", () => {
    // Live at GEO `\bar{1}M`, `\hat{1}M`, `\bar{2}M`; at SI a G inserted beside
    // the accented letter read as the speed of light: `\frac{G\bar{((c))}M}{c^{3}}`.
    for (const target of [SI, HL, GEO]) {
      declines("x = \\bar{((c))} M", ACCENTED("\\bar{((c))}", "c"), [target])
      declines("x = \\bar{(c)^{2}} M", ACCENTED("\\bar{(c)^{2}}", "c"), [target])
      declines("x = \\bar{[(c)]} M", ACCENTED("\\bar{[(c)]}", "c"), [target])
      declines("x = \\hat{((G))} M", ACCENTED("\\hat{((G))}", "G"), [target])
      declines("\\hat{((c))}M = M", ACCENTED("\\hat{((c))}", "c"), [target])
      declines("x = \\bar{c\\cdot} M", ACCENTED("\\bar{c\\cdot}", "c"), [target])
      declines("x = \\bar{2c} M", ACCENTED("\\bar{2c}", "c"), [target])
      declines("x = \\bar{1\\,c} M", ACCENTED("\\bar{1c}", "c"), [target])
    }
    // An accent over an expression that holds the constant declines too: the
    // conservative answer to whether the c under the bar is the constant.
    declines("E = \\overline{mc^2}", ACCENTED("\\overline{mc^{2}}", "c"))
    declines("E = \\overline{cM}", ACCENTED("\\overline{cM}", "c"))
    declines("x = \\bar{\\frac{c}{1}} M", ACCENTED("\\bar{\\frac{c}{1}}", "c"))
    // The dot reads its letter too: \dot{c} is a dotted variable as often as dc/dt.
    declines("x = \\dot{c}\\,t^2", ACCENTED("\\dot{c}", "c"))
    declines("x = \\ddot{G}", ACCENTED("\\ddot{G}", "G"))
    // Anything else under an accent is read as before.
    assert.strictEqual(rawRestored("E = \\bar{m}c^2", HL), "E = \\bar{m}c^{2}")
    assert.strictEqual(rawRestored("\\dot{r} = v"), "\\dot{r} = v")
    assert.strictEqual(rawRestored("E = \\vec{p}\\cdot\\vec{v}", GEO), "E = \\vec{p}\\cdot\\vec{v}")
  })

  test("a translation that sets numerals side by side, or parts them, declines (the numeral-fusion net)", () => {
    const WRITTEN = (left: string, right: string) =>
      `the numerals ending “${left}” and opening “${right}”, one number or a product, which a constant restored between or into them would leave only as the product — not supported`
    // Live at GEO `3\left.\frac{1}{2}\right|M` (3½M for 1.5M), `2\left.3\right|M`
    // (23M for 6M) and `\left|3\right.2M`; at SI and HL the author's
    // `3\,\left.\frac{1}{2}\right|M` had G set into it.
    declines("x = 3\\,\\left.\\frac{G}{2c^2}\\right|M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 2\\,\\left.\\frac{3G}{c^2}\\right|M", FUSED("2", "3"), [GEO])
    declines("x = \\left|\\frac{3G}{c^2}\\right.\\,2M", FUSED("3", "2"), [GEO])
    declines("x = 3\\,\\left.\\frac{1}{2}\\right|M", WRITTEN("3", "\\frac{1}{2}"), [SI, HL])
    // None of them needs anything at the other targets, and each prints as written.
    for (const target of [SI, HL]) {
      assert.strictEqual(rawRestored("x = 3\\,\\left.\\frac{G}{2c^2}\\right|M", target), "x = 3\\left.\\frac{G}{2c^{2}}\\right|M")
      assert.strictEqual(rawRestored("x = 2\\,\\left.\\frac{3G}{c^2}\\right|M", target), "x = 2\\left.\\frac{3G}{c^{2}}\\right|M")
      assert.strictEqual(rawRestored("x = \\left|\\frac{3G}{c^2}\\right.\\,2M", target), "x = \\left|\\frac{3G}{c^{2}}\\right.2M")
    }
    assert.strictEqual(rawRestored("x = 3\\,\\left.\\frac{1}{2}\\right|M", GEO), "x = 3\\left.\\frac{1}{2}\\right|M")
    // Step 7c review: a fraction's parts are read as the net reads everything,
    // so a brace, a restyling or a null delimiter in a part does not hide ½.
    // Live at GEO `3\frac{1}{{2}}M`, `3\frac{{1}}{2}M`,
    // `3\frac{1}{{\displaystyle 2}}M` and `3\frac{1}{\left.2\right.}M`, read as
    // 3½ M where the value is 1.5 M; at SI and HL the author's
    // `3\,\frac{1}{{2}}M` had G set into it.
    const braced: [string, string][] = [
      ["x = 3\\,\\frac{G}{{2c^2}}M", "x = 3\\frac{G}{{2c^{2}}}M"],
      ["x = 3\\,\\frac{G}{{2}c^2}M", "x = 3\\frac{G}{{2}c^{2}}M"],
      ["x = 3\\,\\frac{{1}G}{2c^2}M", "x = 3\\frac{{1}G}{2c^{2}}M"],
      ["x = 3\\,\\frac{G}{c^2 {2}}M", "x = 3\\frac{G}{c^{2}{2}}M"],
      ["x = 3\\,\\frac{G}{c^2}\\frac{{1}}{2}M", "x = 3\\frac{G}{c^{2}}\\frac{{1}}{2}M"],
      ["x = 3\\,\\frac{G}{{\\displaystyle 2}c^2}M", "x = 3\\frac{G}{{\\displaystyle 2}c^{2}}M"],
      ["x = 3\\,\\frac{G}{\\left.2\\right.c^2}M", "x = 3\\frac{G}{\\left.2\\right.c^{2}}M"],
    ]
    for (const [tex, asWritten] of braced) {
      declines(tex, FUSED("3", "\\frac{1}{2}"), [GEO])
      assert.strictEqual(rawRestored(tex, SI), asWritten)
      assert.strictEqual(rawRestored(tex, HL), asWritten)
    }
    declines("x = 3\\,\\frac{1}{{2}}M", WRITTEN("3", "\\frac{1}{2}"), [SI, HL])
    declines("x = 3\\,\\frac{{1}}{2}M", WRITTEN("3", "\\frac{1}{2}"), [SI, HL])
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{{2}}M", GEO), "x = 3\\frac{1}{{2}}M")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{{1}}{2}M", GEO), "x = 3\\frac{{1}}{2}M")
    // A numeric script is a line of its own, on a numeral or not: live at GEO
    // `r10^{23}` (10^{6} r), `M2^{10}` (1024 M for M), `M10^{{2}{3}}` and
    // `M10^{23}`, the strip fusing the digits of the power.
    declines("x = r\\,10^{2G3}", FUSED("2", "3"), [GEO])
    declines("x = M\\,10^{2\\frac{G}{c^2}3}", FUSED("2", "3"), [GEO])
    declines("x = M\\,2^{1\\frac{G}{c^2}0}", FUSED("1", "0"), [GEO])
    declines("x = M\\,10^{{2}G{3}}", FUSED("2", "3"), [GEO])
    declines("x = M\\,10^{2\\,c\\,3}", FUSED("2", "3"), [GEO])
    declines("x = M\\,10^{2\\,\\frac{G}{c^{2}}\\,3}", FUSED("2", "3"), [GEO])
    declines("x = M\\,10^{-2\\,G\\,3}", FUSED("2", "3"), [GEO])
    // Before, on e and π, only the balance re-read caught it, as a reassembly fault.
    declines("x = M\\,e^{2\\,G\\,3}", FUSED("2", "3"), [GEO])
    // A strip in a power that fuses nothing, and a power as written, print as before.
    assert.strictEqual(rawRestored("x = M\\,10^{2G}", GEO), "x = M10^{2}")
    assert.strictEqual(rawRestored("E = 10^{23}\\,M", GEO), "E = 10^{23}M")
    assert.strictEqual(rawRestored("E = 10^{23}\\,M"), "E = 10^{23}Mc^{2}")
    // A bracket, a bar or a product sign printed between two numerals keeps them apart.
    assert.strictEqual(rawRestored("x = 3\\,\\left(\\frac{G}{2c^2}\\right)M", GEO), "x = 3\\left(\\frac{1}{2}\\right)M")
    assert.strictEqual(rawRestored("x = 3\\cdot\\frac{G}{2c^2}M", GEO), "x = 3\\cdot\\frac{1}{2}M")
    // Numerals the author set side by side stay so, and the ones a restoration
    // leaves alone print as written.
    for (const target of [SI, HL]) {
      assert.strictEqual(rawRestored("E = 2mc^2", target), "E = 2mc^{2}")
      assert.strictEqual(rawRestored("E = 4\\,463\\,302\\,M", target), "E = 4\\,463\\,302Mc^{2}")
      assert.strictEqual(rawRestored("E = \\frac{1}{2}mv^2", target), "E = \\frac{1}{2}mv^{2}")
    }
    assert.strictEqual(rawRestored("E = 2mc^2", GEO), "E = 2m")
    assert.strictEqual(rawRestored("r_s = \\frac{2GM}{c^2}", GEO), "r_{s} = 2M")
    assert.strictEqual(rawRestored("E = 4\\,463\\,302\\,M", GEO), "E = 4\\,463\\,302M")
    assert.strictEqual(rawRestored("E = \\frac{1}{2}mv^2", GEO), "E = \\frac{1}{2}mv^{2}")
    assert.strictEqual(rawRestored("E = 3\\,10^{8}\\,m c^2", GEO), "E = 3\\,10^{8}m")
    // `a` has no reading in the GR registry, so this row declines on that as it always did.
    for (const target of [SI, HL, GEO]) {
      const kinematic = run("x = \\frac{1}{2}at^2", target)
      assert.ok(kinematic.kind === "declined", JSON.stringify(kinematic))
      assert.ok(!kinematic.reasons.some((reason) => reason.includes("numerals")), JSON.stringify(kinematic))
    }
  })

  test("the net matches runs one for one, and the digits a strip removes go with their constant", () => {
    const GSI: TargetSpec = { system: "si", geometrized: true }
    const WRITTEN = (left: string, right: string) =>
      `the numerals ending “${left}” and opening “${right}”, one number or a product, which a constant restored between or into them would leave only as the product — not supported`
    // Step 7c review, round 2. The net compared totals, and the digits of a
    // stripped power offset the adjacency a strip made: live at GEO and at
    // geometrized SI, `3\frac{1}{2}M` (3½ M where the value is 1.5 M),
    // `2\left.3\right|M` (23 M for 6 M) and `32M` (for 6 M).
    const made: [string, string, string][] = [
      ["x = 3\\,\\left(\\frac{G}{c^2}\\right)^{10}\\left(\\frac{c^2}{G}\\right)^{9}\\,\\frac{1}{2}\\,M", "3", "\\frac{1}{2}"],
      ["x = 3\\,\\frac{G}{2\\,c^{\\frac{10}{5}}}\\,M", "3", "\\frac{1}{2}"],
      ["x = 3\\,\\frac{G}{c^{\\frac{10}{5}}}\\,\\frac{1}{2}\\,M", "3", "\\frac{1}{2}"],
      ["x = 2\\,\\frac{G}{c^{\\frac{10}{5}}}\\,\\frac{1}{2}\\,M", "2", "\\frac{1}{2}"],
      ["x = 2\\,\\left.\\frac{3G}{c^{\\frac{10}{5}}}\\right|M", "2", "3"],
      ["x = 3\\,G\\,2\\,c^{-\\frac{12}{6}} M", "3", "2"],
      ["x = 3\\,G\\,2\\,c^{-\\tfrac{12}{6}} M", "3", "2"],
      ["x = 3\\,G\\,2\\,c^{-\\dfrac{12}{6}} M", "3", "2"],
      ["x = 3\\,\\left(\\frac{G}{c^2}\\right)^{10}\\left(\\frac{c^2}{G}\\right)^{9}\\,2\\,M", "3", "2"],
      // Before, the 1 and 0 of the power were named as a number the author set.
      ["x = 3\\,G^{\\frac{10}{10}}\\,2\\,\\frac{M}{c^2}", "3", "2"],
    ]
    for (const [tex, left, right] of made) {
      declines(tex, FUSED(left, right), [GEO, GSI])
      assert.strictEqual(run(tex, SI).kind, "translated", tex)
    }
    // A number made in one place is not offset by one the author wrote elsewhere.
    declines("x = 3\\,\\frac{G}{2c^2}\\,M + 3\\,\\frac{1}{2}\\,M", FUSED("3", "\\frac{1}{2}"), [GEO])
    // The digits of a power that vanishes with its constant were never a number
    // of the author's, and nothing is restored at a geometrized target: these
    // translate, as `3M` did before step 7c.
    for (const target of [GEO, GSI]) {
      assert.strictEqual(
        rawRestored("x = 3\\,\\left(\\frac{G}{c^2}\\right)^{10}\\left(\\frac{c^2}{G}\\right)^{10}\\,\\frac{G}{c^2}\\,M", target),
        "x = 3M",
      )
      assert.strictEqual(rawRestored("x = \\frac{G}{c^{\\frac{10}{5}}}\\,1\\,5\\,M", target), "x = 1\\,5M")
    }
    // A restored power's digits are not the author's either, nor are those of
    // a power written as a fraction, restored or not.
    assert.strictEqual(
      rawRestored("x = 3\\,\\left(\\frac{G}{c^2}\\right)^{10}\\left(\\frac{c^2}{G}\\right)^{9}\\,\\frac{1}{2}\\,M"),
      "x = 3\\left(\\frac{G}{c^{2}}\\right)^{10}\\left(\\frac{c^{2}}{G}\\right)^{9}\\frac{G^{9}}{2c^{18}}M",
    )
    assert.strictEqual(rawRestored("x = 3\\,\\frac{G}{2\\,c^{\\frac{10}{5}}}\\,M"), "x = 3\\frac{G}{2c^{\\frac{10}{5}}}M")
    // At a restoring target a run the author set still may not be parted.
    declines("x = 3\\,\\frac{1}{2}\\,\\left(\\frac{c^2}{G}\\right)^{10} M", WRITTEN("3", "\\frac{1}{2}"), [SI])
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}\\,\\left(\\frac{c^2}{G}\\right)^{10} M", GEO), "x = 3\\,\\frac{1}{2}M")
    // Step 7d: a control space or a `~` prints nothing between two numerals, so
    // the G written between them stays in place instead of being folded into
    // its restored power, which left `2\ \ 3` (read as 23) and declined.
    assert.strictEqual(rawRestored("x = 2\\ G\\ 3\\ M"), "x = \\frac{2\\ G\\ 3\\ M}{c^{2}}")
    assert.strictEqual(rawRestored("x = 2~G~3~M", HL), "x = \\frac{2~G~3~M}{c^{2}}")
    declines("x = 2\\ G\\ 3\\ M", FUSED("2", "3"), [GEO])
  })

  test("the net compares numerals and signs by identity, never by spelling (step 7d)", () => {
    const GSI: TargetSpec = { system: "si", geometrized: true }
    const WRITTEN = (left: string, right: string) =>
      `the numerals ending “${left}” and opening “${right}”, one number or a product, which a constant restored between or into them would leave only as the product — not supported`
    // Step 7c review: runs matched by spelling let a number split in one term
    // answer for one made in the other, and these shipped at SI and HL:
    // `\frac{2G\,\left.3\right.M}{c^{2}} + \frac{2\ \ 3G\ M}{c^{2}}`, the first
    // term's 2 and 3 parted by G, the second's set side by side as 23.
    const offset: [string, string, string][] = [
      ["x = 2\\,\\left.3\\right.\\,M + 2\\ G\\ 3\\ M", "2", "3"],
      ["x = 2\\ G\\ 3\\ M + 2\\,\\left.3\\right.\\,M", "2", "3"],
      ["x = 2\\,\\left.3\\right.\\,M + 2~G~3~M", "2", "3"],
      ["x = 2~G~3~M + 2\\,\\left.3\\right.\\,M", "2", "3"],
      ["x = 2\\,\\left.3\\right.\\,M + 2\\ G\\ 3\\ M + r", "2", "3"],
      ["x = 5\\,\\left.7\\right.\\,M + 5\\ G\\ 7\\ M", "5", "7"],
      ["x = 2\\,\\left.3\\right.\\,\\left(\\frac{c^2}{G}\\right)^{10} M + 2\\ G\\ 3\\ M", "2", "3"],
    ]
    for (const [tex, left, right] of offset) {
      declines(tex, WRITTEN(left, right), [SI, HL])
      declines(tex, FUSED(left, right), [GEO, GSI])
    }
    // The pair named is the one that meets, each numeral whole: before, the
    // made run's whole tail was named as the numeral opening it (“\frac{1}{3}2”).
    declines("x = 3\\,\\frac{G}{3c^2}\\,2M", FUSED("3", "\\frac{1}{3}"), [GEO])
    declines("x = 10^{3}\\,G\\,5 M", FUSED("10^{3}", "5"), [GEO])
    // Numerals spelled alike are still two numerals: the author's `10^{3}` does
    // not answer for the `1^{2}0^{2}` a strip makes in the other term, nor the
    // author's `\frac{1}{2}\frac{1}{2}` for the pair a strip sets side by side.
    declines("x = 10^{3}M + 1^{2}\\,G\\,0^{2}\\,\\frac{M}{c^2}", FUSED("1^{2}", "0^{2}"), [GEO, GSI])
    declines(
      "x = \\frac{1}{2}\\frac{1}{2}M + \\frac{1}{2}\\,G\\,\\frac{1}{2}\\frac{M}{c^2}",
      FUSED("\\frac{1}{2}", "\\frac{1}{2}"),
      [GEO, GSI],
    )

    // A sign on a factor that a strip leaves right after another factor reads
    // as a sign between terms: live at GEO `3{-2}M`, which reads 3 − 2M where
    // the value is −6M, and `3{+M}`, 3 + M for 3M.
    const STRIPPED = (signed: string) =>
      `the sign on “${signed}”, which a stripped constant leaves right after another factor, where it reads as a sign between terms — not supported`
    const stripped: [string, string, string][] = [
      ["x = 3\\,\\frac{G}{c^2}\\,{-2}M", "-2", "x = 3\\frac{G}{c^{2}}{-2}M"],
      ["x = 3\\,G\\,{-2}\\,\\frac{M}{c^2}", "-2", "x = 3G{-2}\\frac{M}{c^{2}}"],
      ["x = 3\\,\\frac{G}{c^2}\\,{+M}", "+M", "x = 3\\frac{G}{c^{2}}{+M}"],
      // Inside a group, or with the sign's factor null-delimited or set in a
      // font, the strip moves it all the same: live `3{{-2}}M`, `{3}{-2}M`,
      // `3\left.-2\right.M` and `3\mathbf{-2}M`.
      ["x = 3\\,{G{-2}}M", "-2", "x = \\frac{3{G{-2}}M}{c^{2}}"],
      ["x = {3G}{-2}\\frac{M}{c^2}", "-2", "x = {3G}{-2}\\frac{M}{c^{2}}"],
      ["x = 3\\,G\\,\\left.-2\\right.\\,\\frac{M}{c^2}", "-2", "x = 3G\\left.-2\\right.\\frac{M}{c^{2}}"],
      ["x = 3\\,G\\,\\mathbf{-2}\\,\\frac{M}{c^2}", "-2", "x = 3G\\mathbf{-2}\\frac{M}{c^{2}}"],
    ]
    for (const [tex, signed, asWritten] of stripped) {
      declines(tex, STRIPPED(signed), [GEO, GSI])
      assert.strictEqual(rawRestored(tex, SI), asWritten)
      assert.strictEqual(rawRestored(tex, HL), asWritten)
    }
    // With no numeral beside it (`M{-2}`, M − 2 for −2M), with ± or ∓, and with
    // the author's own `3{-2}M` in the other term, which is another sign.
    declines("x = M\\,G\\,{-2}\\frac{1}{c^2}", STRIPPED("-2"), [GEO, GSI])
    declines("x = 3\\,\\frac{G}{c^2}\\,{\\pm 2}M", STRIPPED("\\pm 2"), [GEO, GSI])
    declines("x = 3\\,\\frac{G}{c^2}\\,{\\mp 2}M", STRIPPED("\\mp 2"), [GEO, GSI])
    declines("x = 3\\,\\frac{G}{c^2}\\,{-2}M + 3{-2}M", STRIPPED("-2"), [GEO, GSI])
    // A sign the author set right after a factor stays the author's reading,
    // and a strip that leaves it after a relation, a sign or a product sign
    // leaves it a sign on its factor.
    assert.strictEqual(rawRestored("x = 3{-2}M", GEO), "x = 3{-2}M")
    assert.strictEqual(rawRestored("x = \\frac{G}{c^2}{-2}M", GEO), "x = {-2}M")
    assert.strictEqual(rawRestored("x = r + \\frac{G}{c^2}{-2}M", GEO), "x = r + {-2}M")
    assert.strictEqual(rawRestored("x = 3\\cdot\\frac{G}{c^2}{-2}M", GEO), "x = 3\\cdot{-2}M")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{G}{c^2}\\cdot{-2}M", GEO), "x = 3\\cdot{-2}M")
    // The restoration's side of the same reading: live at SI and HL,
    // `x = {-2}M` shipped as `\frac{G{-2}M}{c^{2}}`, which reads (G − 2M)/c²,
    // and a G folded from after the sign to before it read 3G − 2M.
    const RESTORED = (signed: string) =>
      `the sign on “${signed}”, which the restoration sets right after another factor, where it reads as a sign between terms — not supported`
    declines("x = {-2}M", RESTORED("-2"), [SI, HL])
    declines("x = 3\\,{-2}\\,G\\,M", RESTORED("-2"), [SI, HL])
    declines("x = 3{-2}M", RESTORED("-2"), [SI, HL])
    assert.strictEqual(rawRestored("x = {-2}M", GEO), "x = {-2}M")
    // A G folded into its restored power and set back where it was written
    // keeps the sign's neighbor, as the author wrote it.
    assert.strictEqual(rawRestored("x = 3\\,G\\,{-2}\\,M"), "x = \\frac{3G{-2}M}{c^{2}}")
    declines("x = 3\\,G\\,{-2}\\,M", STRIPPED("-2"), [GEO])
    // A sign between terms is no sign on a factor, and a restoration beside one reads as before.
    assert.strictEqual(rawRestored("E = -m"), "E = -mc^{2}")
    assert.strictEqual(rawRestored("x = r - M"), "x = r - \\frac{GM}{c^{2}}")
  })

  test("a strip that makes a fraction of numerals after a numeral declines, spacing or not", () => {
    // Live at GEO, `3\,\frac{G}{2c^2}M` shipped as `3\,\frac{1}{2}M`: the
    // value is 1.5M, and a thin space before ½ is how 3½ is set.
    declines("x = 3\\,\\frac{G}{2c^2}\\,M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3~\\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\ \\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\;\\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\,\\tfrac{G}{2c^2}M", FUSED("3", "\\tfrac{1}{2}"), [GEO])
    declines("x = 3\\,{\\frac{G}{2c^2}}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\,\\frac{2G}{3c^2}M", FUSED("3", "\\frac{2}{3}"), [GEO])
    declines("x = 3\\,G\\,\\frac{1}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    // (Balanced since step 7c, which checks at emission, after the completion.)
    declines("x^2 = r3\\,\\frac{G}{2c^2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    // A strip that makes the numeral before an author's fraction does the same.
    declines("x = \\frac{3G}{c^2}\\,\\frac{1}{2}M", FUSED("3", "\\frac{1}{2}"), [GEO])
    // A script on the fraction, or null delimiters around it, change nothing:
    // live at GEO `3\frac{1}{2}^{2}M` (0.75M, read as 3½ squared) and
    // `3\left.\frac{1}{2}\right.M` (1.5M, read as 3½ M).
    declines("x = 3\\,\\frac{G}{2c^2}^{2}M", FUSED("3", "\\frac{1}{2}^{2}"), [GEO])
    declines("x = 3\\frac{G}{2c^2}^{2}M", FUSED("3", "\\frac{1}{2}^{2}"), [GEO])
    declines("x = 3\\,{\\frac{G}{2c^2}}^{2}M", FUSED("3", "\\frac{1}{2}^{2}"), [GEO])
    declines("x = 3\\,\\frac{G}{2c^2}_{0}M", FUSED("3", "\\frac{1}{2}_{0}"), [GEO])
    declines("x = 3\\,\\left.\\frac{G}{2c^2}\\right.M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\left.\\frac{G}{2c^2}\\right.M", FUSED("3", "\\frac{1}{2}"), [GEO])
    declines("x = 3\\,\\left.\\frac{G}{2c^2}\\right.^{2}M", FUSED("3", "\\frac{1}{2}^{2}"), [GEO])
    // A numeral a strip leaves at the edge of a fraction, scripted, null-delimited
    // or not, meets the one before it whatever kern stays: live, `2\left.3\right.M`
    // read as 23M where the value is 6M, and step 7b's `2\,\left.3\right.M`,
    // `3\,2^{2}M` and `3\,2M` still read as 23M, 32²M and 32M.
    declines("x = 3\\,\\frac{2G}{c^2}^{2}M", FUSED("3", "2^{2}"), [GEO])
    declines("x = 2\\,\\left.\\frac{3G}{c^2}\\right.M", FUSED("2", "3"), [GEO])
    declines("x = 3\\,\\frac{2G}{c^2}M", FUSED("3", "2"), [GEO])
    // A mixed number the author set stays one; a product sign, a bracket or a
    // symbol in the fraction is no mixed number.
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}\\,r + \\frac{GM}{c^2}", GEO), "x = 3\\,\\frac{1}{2}r + M")
    assert.strictEqual(rawRestored("x = 3\\cdot\\frac{G}{2c^2}M", GEO), "x = 3\\cdot\\frac{1}{2}M")
    assert.strictEqual(rawRestored("x = 3\\,\\left(\\frac{G}{2c^2}\\right)M", GEO), "x = 3\\left(\\frac{1}{2}\\right)M")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{\\pi G}{2c^2}M", GEO), "x = 3\\frac{\\pi}{2}M")
  })

  test("a constant restored into or before an author's fraction of numerals after a numeral declines", () => {
    const WRITTEN = (left: string, right: string) =>
      `the numerals ending “${left}” and opening “${right}”, one number or a product, which a constant restored between or into them would leave only as the product — not supported`
    // The insertion's side of the same reading. Live at SI, `3\,\frac{1}{2}M`
    // shipped as `3\,\frac{G}{2c^{2}}M`, 1.5 GM/c² where 3½ M is 3.5, and a G
    // set after the leading numerals split them: `\frac{3G\,{\frac{1}{2}}M}{c^{2}}`.
    declines("x = 3\\,\\frac{1}{2}M", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = 3\\frac{1}{2}M", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = 3\\,\\tfrac{1}{2}M", WRITTEN("3", "\\tfrac{1}{2}"), [SI])
    declines("x = 3\\,{\\frac{1}{2}}M", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = 3\\,\\frac{1}{2}\\frac{M}{r}t", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = \\frac{3\\frac{1}{2}M}{r}r", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = M\\,3\\,\\frac{1}{2}", WRITTEN("3", "\\frac{1}{2}"), [SI])
    // A script on the fraction, or null delimiters around it: live at SI
    // `\frac{3G\frac{1}{2}^{2}M}{c^{2}}` and `\frac{3G\left.\frac{1}{2}\right.M}{c^{2}}`.
    declines("x = 3\\,\\frac{1}{2}^{2}M", WRITTEN("3", "\\frac{1}{2}^{2}"), [SI])
    declines("x = 3\\,\\left.\\frac{1}{2}\\right.M", WRITTEN("3", "\\frac{1}{2}"), [SI])
    declines("x = 3\\,{\\frac{1}{2}}^{2}M", WRITTEN("3", "\\frac{1}{2}^{2}"), [SI])
    // Two digit runs the author set side by side are one number or a product just the same.
    declines("x = 2\\,\\left.3\\right.M", WRITTEN("2", "3"), [SI])
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}^{2}M", GEO), "x = 3\\,\\frac{1}{2}^{2}M")
    // With no insertion there, or a product sign or a symbol in the way, it prints as written.
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}\\,r + M"), "x = 3\\,\\frac{1}{2}r + \\frac{GM}{c^{2}}")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{1}{2}M", GEO), "x = 3\\,\\frac{1}{2}M")
    assert.strictEqual(rawRestored("x = 3\\cdot\\frac{1}{2}M"), "x = 3\\cdot\\frac{G}{2c^{2}}M")
    assert.strictEqual(rawRestored("x = 3\\,\\frac{\\pi}{2}M"), "x = 3\\frac{\\pi G}{2c^{2}}M")
  })

  test("a divergence that is only spacing the engine cannot re-emit names that spacing", () => {
    const UNWRITTEN = (spacing: string) =>
      `the spacing “${spacing}”, which the engine cannot re-emit as written, is not supported`
    // Each declined before as a generic reassembly fault.
    declines("x = r\\sin\\hspace{1em}(M/t)", UNWRITTEN("\\hspace{1em}"), [SI])
    declines("t = r \\enspace - r", UNWRITTEN("\\enspace"), [SI])
    declines("t = r \\hspace{0.9em} - r", UNWRITTEN("\\hspace{0.9em}"), [SI])
    declines("x = \\frac{\\ G\\ M}{c^2}", UNWRITTEN("\\ "), [GEO])
    declines("x = \\frac{M}{\\ c^2}\\,G", UNWRITTEN("\\ "), [GEO])
  })
})

describe("delimiters: bars, sized delimiters, Dirac notation and construct names", () => {
  const parse = (tex: string) => katex.__parse(tex, { strict: false, trust: false, displayMode: true })
  const rawRestored = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
    rendersInKatex(out)
    return out
  }
  const declines = (tex: string, reason: string, targets: TargetSpec[] = [SI, GEO]) => {
    for (const target of targets) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") {
        assert.deepStrictEqual(result.reasons, [reason], tex)
        assert.deepStrictEqual(result.unknown, [], tex)
      }
    }
  }
  const DIRAC =
    "Dirac bra–ket notation, whose states' dimensions depend on a normalization the dictionary does not record"
  const UNPAIRED = (bar: string) => `a bar “${bar}” the engine cannot pair as an absolute value`
  const TENSOR = (tensor: string) =>
    `bars around the tensor “${tensor}” — a modulus or a determinant, which differ in dimension`

  test("KaTeX shapes the pairing reads", () => {
    // Bars are ordinary symbols, with no side of their own.
    assert.deepStrictEqual(
      parse("|p\\|\\vert\\Vert").map((n: any) => [n.type, n.text]),
      [
        ["textord", "|"],
        ["mathord", "p"],
        ["textord", "\\|"],
        ["textord", "\\vert"],
        ["textord", "\\Vert"],
      ],
    )
    // A sized delimiter's side survives only as its mclass.
    assert.deepStrictEqual(
      parse("\\big| \\bigm| \\bigr) \\Bigg\\langle").map((n: any) => [n.type, n.size, n.mclass, n.delim]),
      [
        ["delimsizing", 1, "mord", "|"],
        ["delimsizing", 1, "mrel", "|"],
        ["delimsizing", 1, "mclose", ")"],
        ["delimsizing", 4, "mord", "\\langle"],
      ],
    )
    // \braket builds a \mathinner around a braced body; \middle| is its own node.
    const [braket] = parse("\\braket{1|E|1}")
    assert.deepStrictEqual([braket.type, braket.mclass, braket.body[0].text], ["mclass", "minner", "\\langle"])
    assert.strictEqual(braket.body[1].type, "ordgroup")
    const [middled] = parse("\\left\\langle a \\middle| b\\right\\rangle")
    assert.deepStrictEqual([middled.body[1].type, middled.body[1].delim], ["middle", "|"])
    // The factorial is a close atom; a prescript is a script on the opener.
    const [, bang] = parse("2!")
    assert.deepStrictEqual([bang.type, bang.family, bang.text], ["atom", "close", "!"])
    const [prescript] = parse("(^{12}C)")
    assert.deepStrictEqual([prescript.type, prescript.base.type, prescript.base.family], ["supsub", "atom", "open"])
    // \boxed is an enclose labelled \fbox, with no location of its own.
    const [boxed] = parse("\\boxed{m}")
    assert.deepStrictEqual([boxed.type, boxed.label, boxed.loc], ["enclose", "\\fbox", undefined])
  })

  test("bars pair as an absolute value when exactly one pairing exists", () => {
    for (const [tex, out] of [
      ["E^2 = |\\vec{p}|^2 + m^2", "E^{2} = |\\vec{p}|^{2}c^{2} + m^{2}c^{4}"],
      ["E = |p| + m", "E = |p|c + mc^{2}"],
      ["\\Phi = -\\frac{M}{|x|}", "\\Phi = -\\frac{GM}{|x|}"],
      ["E = m|v|", "E = m|v|c"],
      // A bar after a slash opens the divisor, so |p||v|/|v| has one pairing.
      ["E = |p||v|/|v|", "E = |p||v|c/|v|"],
      ["E = m/|v|", "E = mc^{3}/|v|"],
      // Double bars are a norm, which has the dimension of what it measures.
      ["E = \\|p\\|", "E = \\|p\\|c"],
      ["E = \\Vert p\\Vert", "E = \\Vert p\\Vert c"],
    ]) {
      assert.strictEqual(rawRestored(tex), out, tex)
      const geo = run(tex, GEO)
      assert.ok(geo.kind === "translated" && !geo.changed, `${tex} → ${JSON.stringify(geo)}`)
    }
    // Nested bars pair uniquely; a dimensionless tensor passes the tensor guard,
    // since its modulus and its determinant are both dimensionless.
    assert.strictEqual(rawRestored("r = |x - |y||"), "r = |x - |y||")
    assert.strictEqual(rawRestored("h_{ab} = |h_{ab}|"), "h_{ab} = |h_{ab}|")
    assert.strictEqual(rawRestored("r = \\sqrt{|g|}\\,x"), "r = \\sqrt{|g|}x")
    const d = dimensionOf("|p|", katexDefault, reg)
    assert.ok(d.kind === "dim", JSON.stringify(d))
    assert.deepStrictEqual(d.dim, [12, 12, -12, 0, 0])
  })

  test("a bar with no unique pairing declines, claiming no meaning for it", () => {
    declines("p(a|b) = 1", UNPAIRED("|"))
    // An evaluation bar and a family mismatch are not conditionals either.
    declines("x = x\\big|_{t=0}", UNPAIRED("\\big|"))
    declines("E = \\|p|", UNPAIRED("\\|"))
    declines("|x|y|z| = r", "absolute-value bars “|” whose pairing is ambiguous")
  })

  test("sized delimiters pair as their glyphs do and are re-emitted as written", () => {
    assert.strictEqual(rawRestored("E = \\bigl[p + m\\bigr]"), "E = \\bigl[p + mc\\bigr]c")
    assert.strictEqual(rawRestored("E = \\big(p + m\\big)"), "E = \\big(p + mc\\big)c")
    assert.strictEqual(rawRestored("E = \\Bigl\\{p + m\\Bigr\\}"), "E = \\Bigl\\{p + mc\\Bigr\\}c")
    assert.strictEqual(rawRestored("E = \\Big|p\\Big|"), "E = \\Big|p\\Big|c")
    assert.strictEqual(rawRestored("E = \\bigl|p\\bigr|"), "E = \\bigl|p\\bigr|c")
    assert.strictEqual(rawRestored("E = \\big(p + m\\big)", GEO), "E = \\big(p + m\\big)")
    // A relation-class bar and a null delimiter pair with nothing.
    declines("p = x\\bigm| y", "the sized delimiter “\\bigm|”, which the engine cannot pair")
    declines("E = \\big. p", "the sized delimiter “\\big.”, which the engine cannot pair")
    // A mismatch quotes the opener as written, never an internal glyph name.
    declines("E = \\bigl| p )", "the closing delimiter “)” where “\\bigl|” was open")
    declines("E = \\bigl| p \\bigr\\|", "the closing delimiter “\\bigr\\|” where “\\bigl|” was open")
    declines("E = (p]", "the closing delimiter “]” where “(” was open")
  })

  test("Dirac bra–kets decline in every spelling, bars hidden in braces included", () => {
    for (const tex of [
      "\\langle 0|N|0\\rangle = 1",
      "a|0\\rangle = 0",
      "\\lvert\\psi\\rangle = 0",
      "E = \\big\\langle p\\big|",
      "a_i^{\\text{in}} |0_{\\text{in}}\\rangle = 0",
      "x = \\left\\langle a \\middle| b\\right\\rangle",
      // Reviewer counterexamples: the bars hid in a brace group or a
      // \mathinner, or the angle brackets were written as the relations < >.
      "\\langle{0|p|0}\\rangle = 1",
      "E = \\langle {0|p|0} \\rangle",
      "E = \\braket{1|E|1}",
      "E = <1|p|1>",
    ]) {
      declines(tex, DIRAC)
    }
    // Live wrong before step 8: the ket translated as a bracket of bars.
    declines("\\left|0\\right\\rangle = 0", DIRAC)
    // Review round: KaTeX keeps the angle brackets `<`, `>`, `\lt` and `⟨` as
    // written in \left/\right and sized delimiters, and a ket spelled with
    // them still translated.
    assert.deepStrictEqual(
      parse("\\left|0\\right> \\bigl\\lt").map((n: any) => [n.type, n.right ?? n.delim]),
      [
        ["leftright", ">"],
        ["delimsizing", "\\lt"],
      ],
    )
    for (const tex of [
      "\\left|0\\right> = 0",
      "E = a\\left|0\\right>",
      "E = \\left<p\\right|",
      "E = \\left\\lt p\\right|",
      "E = \\left<a\\middle|b\\right>",
      "E = \\left|p\\right⟩",
      "E = \\bigl<p\\bigr|",
      "E = \\big|p\\big>",
    ]) {
      declines(tex, DIRAC)
    }
    // An angle bracket with no bar in it is still an expectation value, in
    // any spelling, and is re-emitted as written.
    assert.strictEqual(rawRestored("E = \\langle p\\rangle"), "E = \\langle p\\rangle c")
    assert.strictEqual(rawRestored("E = \\left<p\\right>"), "E = \\left<p\\right>c")
    assert.strictEqual(rawRestored("E = \\bigl<p\\bigr>"), "E = \\bigl<p\\bigr>c")
    assert.strictEqual(rawRestored("E = \\bigl\\lt p\\bigr\\gt"), "E = \\bigl\\lt p\\bigr\\gt c")
  })

  test("bars around a dimensional tensor decline: a modulus or a determinant", () => {
    declines("P = |T_{ab}|", TENSOR("T_{ab}"))
    declines("P = \\left|T_{ab}\\right|", TENSOR("T_{ab}"))
    declines("P = \\lvert T_{ab}\\rvert", TENSOR("T_{ab}"))
    declines("P = \\big|T_{ab}\\big|", TENSOR("T_{ab}"))
    // Reviewer counterexamples: a staggered mixed tensor translated as a
    // modulus, an accent hid the base, and a font garbled the quotation.
    declines("\\rho = |T^{a}{}_{b}|", TENSOR("T^{a}{}_{b}"))
    declines("P = |T_{a}{}^{b}|", TENSOR("T_{a}{}^{b}"))
    declines("P = |\\bar T_{ab}|", TENSOR("\\bar{T}_{ab}"))
    declines("P = |\\mathbf{T}_{ab}|", TENSOR("\\mathbf{T}_{ab}"))
    // Review round: braces, an accent, an overline or an old-style font set
    // around the whole indexed symbol hid it, and the bars read as a modulus.
    declines("\\rho = |\\tilde{T_{ab}}|", TENSOR("\\tilde{T_{ab}}"))
    declines("\\rho = |{\\bf T_{ab}}|", TENSOR("{\\bf T_{ab}}"))
    declines("\\rho = |{T^{a}{}_{b}}|", TENSOR("{T^{a}{}_{b}}"))
    declines("\\rho = \\left|{T_{ab}}\\right|", TENSOR("{T_{ab}}"))
    declines("\\rho = \\left|\\tilde{T_{ab}}\\right|", TENSOR("\\tilde{T_{ab}}"))
    declines("\\rho = |{\\textstyle T_{ab}}|", TENSOR("{\\textstyle T_{ab}}"))
    declines("\\rho = |\\tilde{T^{a}{}_{b}}|", TENSOR("\\tilde{T^{a}{}_{b}}"))
    declines("\\rho = |\\overline{T}_{ab}|", TENSOR("\\overline{T}_{ab}"))
    declines("\\rho = |\\overline{T_{ab}}|", TENSOR("\\overline{T_{ab}}"))
    // Second review round: a braced indexed symbol carrying a further script
    // (`{T^{\mu}}_{\nu}`) read only through its outer supsub, whose base has
    // no text, and the mixed tensor passed as a modulus.
    declines("\\rho = |{T^{a}}_{b}|", TENSOR("{T^{a}}_{b}"))
    declines("\\rho = |{T_{a}}_{b}|", TENSOR("{T_{a}}_{b}"))
    declines("\\rho = \\left|{T^{\\mu}}_{\\nu}\\right|", TENSOR("{T^{\\mu}}_{\\nu}"))
    declines("\\rho = \\lvert{T_{a}}^{b}\\rvert", TENSOR("{T_{a}}^{b}"))
    declines("\\rho = |{{T^{a}}_{b}}^{c}|", TENSOR("{{T^{a}}_{b}}^{c}"))
    declines("\\rho = |{T^{a}{}_{b}}_{c}|", TENSOR("{T^{a}{}_{b}}_{c}"))
    // The wrappers change nothing else: one index is still a component's
    // modulus, and a dimensionless tensor still passes.
    assert.strictEqual(rawRestored("\\rho = |{T_{a}}|"), "\\rho = \\frac{|{T_{a}}|}{c^{2}}")
    assert.strictEqual(rawRestored("h_{ab} = |\\tilde{h_{ab}}|"), "h_{ab} = |\\tilde{h_{ab}}|")
    assert.strictEqual(rawRestored("h_{ab} = |{h_{a}}_{b}|"), "h_{ab} = |{h_{a}}_{b}|")
  })

  test("factorials, prescripts, braced delimiters and constructs are named as written", () => {
    declines("x = 2!\\,r", "a factorial “!”, which is not supported yet")
    declines("r(^{12}C) = 1", "a script on the opening delimiter “(”, which the engine cannot read")
    declines("{[}a,b{]} = 1", "a delimiter set apart in braces (“{[}”), which the engine cannot pair")
    declines("x = r ?", "the symbol “?” in this position")
    const CONSTRUCT = (name: string) => `the construct “${name}”, which is not supported yet`
    declines("E = \\boxed{m}", CONSTRUCT("\\fbox"))
    declines("E = \\hbox{m}", CONSTRUCT("\\hbox"))
    declines("E = \\xrightarrow{F} m", CONSTRUCT("\\xrightarrow"))
    declines("E = \\overbrace{m}", CONSTRUCT("\\overbrace"))
    declines("E = \\begin{pmatrix} m \\end{pmatrix}", CONSTRUCT("matrix or array environment"))
  })
})

describe("statement layer: lists, connectives, wide space and the unit summary", () => {
  const HL: TargetSpec = { system: "hl", geometrized: false }
  const translated = (tex: string, target: TargetSpec = SI) => {
    const result = run(tex, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = result as Extract<TranslationResult, { kind: "translated" }>
    rendersInKatex(out.restoredTex)
    // A line that needs nothing restored comes back as written, up to inert typography.
    const cmp = (s: string) => s.replace(/\\qquad|\\quad|\\[,;!:]/g, "").replace(/[\s{}]/g, "")
    if (!out.changed) assert.strictEqual(cmp(out.restoredTex), cmp(tex), tex)
    return out
  }
  const expect = (tex: string, target: TargetSpec, restoredTex: string, unit: string, changed: boolean) => {
    const out = translated(tex, target)
    assert.strictEqual(out.restoredTex, restoredTex, tex)
    assert.strictEqual(out.targetUnitTex, unit, tex)
    assert.strictEqual(out.changed, changed, tex)
    return out
  }
  const declines = (tex: string, reason: string, targets: TargetSpec[] = [SI, GEO]) => {
    for (const target of targets) {
      const result = run(tex, target)
      assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
      if (result.kind === "declined") assert.deepStrictEqual(result.reasons, [reason], tex)
    }
  }
  const M = "\\mathrm{m}"
  const S = "\\mathrm{s}"
  const KG = "\\mathrm{kg}"
  const J = "\\mathrm{kg}\\,\\mathrm{m}^{2}\\,\\mathrm{s}^{-2}"
  const LIST = "lists or multiple statements — select a single equation"
  const SPACING = "explicit spacing between two factors — two statements or one product? (select a single equation)"
  const DECLARATION =
    "a relation between the constants themselves — a declaration of the unit convention rather than a physical relation to restore"
  const AMBIGUOUS = "a continuation row after a row of several statements — which one it continues is ambiguous"
  const UNWRITTEN = (spacing: string) =>
    `the spacing “${spacing}”, which the engine cannot re-emit as written, is not supported`
  const UNIT_ONE = (statement: string) =>
    `a side that is the number 1 in “${statement}”, whose units the equation does not state`

  test("KaTeX shapes the connective macros are read from", () => {
    // translateLine re-emits \implies, \iff and \impliedby from the macro body
    // their rel atom is located in, and drops the two 5mu kerns beside it.
    const parse = (tex: string) => katex.__parse(tex, { strict: false, trust: false, displayMode: true })
    for (const [macro, rel] of [
      ["\\implies", "\\Longrightarrow"],
      ["\\iff", "\\Longleftrightarrow"],
      ["\\impliedby", "\\Longleftarrow"],
    ]) {
      const [, before, atom, after] = parse(`a ${macro} b`)
      assert.strictEqual(atom.type, "atom", macro)
      assert.strictEqual(atom.family, "rel", macro)
      assert.strictEqual(atom.text, rel, macro)
      assert.strictEqual(atom.loc.lexer.input, `\\DOTSB\\;${rel}\\;`, `${macro}: the macro body changed`)
      for (const kern of [before, after]) {
        assert.strictEqual(kern.type, "kern", macro)
        assert.deepStrictEqual([kern.dimension.number, kern.dimension.unit], [5, "mu"], macro)
      }
    }
  })

  test("a list of statements: each is restored on its own anchor", () => {
    const list = expect("r_s = 2M, \\qquad t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\qquad t = 0", `${M};\\ ${S}`, true)
    assert.deepStrictEqual(list.statementUnitTex, [M, S])
    expect("r_s = 2M, \\qquad t = 0", HL, "r_{s} = \\frac{2GM}{c^{2}}, \\qquad t = 0", "\\mathrm{cm};\\ \\mathrm{s}", true)
    const geo = expect("r_s = 2M, \\qquad t = 0", GEO, "r_{s} = 2M, \\qquad t = 0", "\\mathrm{cm}", false)
    assert.deepStrictEqual(geo.statementUnitTex, ["\\mathrm{cm}", "\\mathrm{cm}"])
    // One unit when every statement carries it.
    expect("r_s = 2M, \\qquad r = 3M", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\qquad r = \\frac{3GM}{c^{2}}", M, true)
    expect("r_s = 2M; \\quad E = M", SI, "r_{s} = \\frac{2GM}{c^{2}}; \\quad E = Mc^{2}", `${M};\\ ${J}`, true)
    expect("r_s = 2M;t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}}; t = 0", `${M};\\ ${S}`, true)
    expect(
      "r_s = 2M,\\qquad t = 0,\\qquad E = M",
      SI,
      "r_{s} = \\frac{2GM}{c^{2}}, \\qquad t = 0, \\qquad E = Mc^{2}",
      `${M};\\ ${S};\\ ${J}`,
      true,
    )
    // A single statement carries no per-statement list.
    assert.strictEqual(translated("r_s = 2M").statementUnitTex, undefined)
  })

  test("the site's Conventions lists translate, unchanged", () => {
    // The T list glosses a generic tensor as stress–energy: a registry reading
    // the owner holds open (integration §4.2 item 11), not a construct problem.
    expect(
      "T_{(ab)} = \\tfrac{1}{2}\\left(T_{ab}+T_{ba}\\right), \\qquad T_{[ab]} = \\tfrac{1}{2}\\left(T_{ab}-T_{ba}\\right)",
      HL,
      "T_{(ab)} = \\tfrac{1}{2}\\left(T_{ab} + T_{ba}\\right), \\qquad T_{[ab]} = \\tfrac{1}{2}\\left(T_{ab} - T_{ba}\\right)",
      "\\mathrm{g}\\,\\mathrm{cm}^{-1}\\,\\mathrm{s}^{-2}",
      false,
    )
    expect(
      "R_{ac} = R_{abc}{}^{b}, \\qquad R = g^{ac} R_{ac}",
      HL,
      "R_{ac} = R_{abc}{}^{b}, \\qquad R = g^{ac}R_{ac}",
      "\\mathrm{cm}^{-2}",
      false,
    )
  })

  test("wide space separates statements only where every part is one", () => {
    // Bug 1 of the relations design: this shipped t = \frac{0r}{c} = \frac{2GM}{c^{3}}.
    expect("t = 0 \\qquad r = 2M", SI, "t = 0 \\qquad r = \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("t = 0 \\quad r = 2M", SI, "t = 0 \\quad r = \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect(
      "r_s = 2M \\qquad r = 2M \\qquad t = M",
      SI,
      "r_{s} = \\frac{2GM}{c^{2}} \\qquad r = \\frac{2GM}{c^{2}} \\qquad t = \\frac{GM}{c^{3}}",
      `${M};\\ ${M};\\ ${S}`,
      true,
    )
    // The run is totalled, as the between-factors guard totals it.
    expect("t = 0 ~~~~ r = 2M", SI, "t = 0 ~~~~ r = \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("r_s = 2M \\qquad\\;\\; t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}} \\qquad\\;\\; t = 0", `${M};\\ ${S}`, true)
    expect(
      "\\begin{aligned} t &= 0 \\qquad r = 2M \\end{aligned}",
      SI,
      "\\begin{aligned}\nt &= 0 \\qquad r = \\frac{2GM}{c^{2}}\n\\end{aligned}",
      `${S};\\ ${M}`,
      true,
    )
    // A part that is no statement leaves the run to the between-factors guard.
    declines("r = 2M \\qquad (1)", SPACING)
    declines("r = 2M \\qquad t", SPACING)
    declines("r = M \\quad r", SPACING)
    declines("r = 2M \\qquad - a", SPACING)
    // Narrower than a quad, a run separates nothing.
    declines("t = 0 \\;\\;\\; r = 2M", SPACING)
    declines("t = 0 \\hspace{0.9em} r = 2M", SPACING)
    // The truer reason, read inside the statement, wins.
    declines("r = 2M \\quad \\text{for} \\quad t > 0", "prose (“for”) inside the equation — select a single equation")
  })

  test("spacing around a separator is re-emitted as written, or declines by name", () => {
    // A mu kern is rebuilt as \mkern (LaTeX's \hspace takes no mu units).
    expect("r_s = 2M,\\mkern18mu t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\mkern18mu t = 0", `${M};\\ ${S}`, true)
    expect("r_s = 2M,\\mkern18mu t = 0", GEO, "r_{s} = 2M, \\mkern18mu t = 0", "\\mathrm{cm}", false)
    expect("r_s = 2M,~t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}}, ~ t = 0", `${M};\\ ${S}`, true)
    expect("r_s = 2M~,~~t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}} ~ , ~~ t = 0", `${M};\\ ${S}`, true)
    expect("r_s = 2M,\\, t = 0", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\, t = 0", `${M};\\ ${S}`, true)
    // A kern written in a way its width does not name cannot be re-emitted as
    // written; the line declines naming it rather than respelling it.
    declines("r_s = 2M,\\enspace t = 0", UNWRITTEN("\\enspace"))
    declines("r_s = 2M,\\hspace{2em} t = 0", UNWRITTEN("\\hspace{2em}"))
    declines("r_s = 2M,\\hskip10pt t = 0", UNWRITTEN("\\hskip10pt"))
    declines("t = 0 \\enspace\\enspace r = 2M", UNWRITTEN("\\enspace"))
  })

  test("a logical connective separates two statements; each side must be one", () => {
    expect(
      "M \\neq 0 \\qquad \\Longrightarrow \\qquad r_s = 2M",
      SI,
      "M \\neq 0 \\qquad \\Longrightarrow \\qquad r_{s} = \\frac{2GM}{c^{2}}",
      `${KG};\\ ${M}`,
      true,
    )
    // The macros are re-emitted whole, their own \; with them.
    expect("M \\neq 0 \\implies r_s = 2M", SI, "M \\neq 0 \\implies r_{s} = \\frac{2GM}{c^{2}}", `${KG};\\ ${M}`, true)
    expect("r > 2M \\iff t > 0", SI, "r > \\frac{2GM}{c^{2}} \\iff t > 0", `${M};\\ ${S}`, true)
    expect("t > M \\impliedby r > 2M", SI, "t > \\frac{GM}{c^{3}} \\impliedby r > \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect(
      "r = M \\quad \\implies \\quad t = M",
      SI,
      "r = \\frac{GM}{c^{2}} \\quad \\implies \\quad t = \\frac{GM}{c^{3}}",
      `${M};\\ ${S}`,
      true,
    )
    expect("r_s = 2M \\Longrightarrow t = 0", GEO, "r_{s} = 2M \\Longrightarrow t = 0", "\\mathrm{cm}", false)
    // A leading connective: the left operand is the previous display, or the prose.
    expect("\\Rightarrow r_s = 2M", SI, "\\Rightarrow r_{s} = \\frac{2GM}{c^{2}}", M, true)
    expect(
      "\\begin{aligned} r_s &= 2M \\\\ &\\Rightarrow E = M \\end{aligned}",
      SI,
      "\\begin{aligned}\nr_{s} &= \\frac{2GM}{c^{2}} \\\\\n& \\Rightarrow E = Mc^{2}\n\\end{aligned}",
      `${M};\\ ${J}`,
      true,
    )
    // The relations reviewer's counterexamples: a relation or a side located
    // only inside itself beside the connective faulted in the prototype.
    expect("r \\neq 0 \\implies \\frac{r}{2} = M", SI, "r \\neq 0 \\implies \\frac{r}{2} = \\frac{GM}{c^{2}}", M, true)
    translated("r > 0 \\iff \\frac{t}{M} > 0")
    // At SI the bare 1 stands for GM/c³ (unitLiteralGuard); t/M is a pure number only geometrized.
    translated("\\frac{r}{M} \\neq 2 \\implies \\frac{t}{M} \\ne 1", GEO)
    declines("\\frac{r}{M} \\neq 2 \\implies \\frac{t}{M} \\ne 1", UNIT_ONE("\\frac{t}{M} \\ne 1"), [SI])
    const NOTHING = "an implication with nothing on one side"
    const NO_STATEMENT = "an implication whose side is not a statement (it has no relation)"
    for (const tex of ["r_s = 2M \\Rightarrow", "\\Rightarrow", "r_s = 2M \\Rightarrow \\Rightarrow t = M"]) declines(tex, NOTHING)
    declines("r = 2M, \\quad \\Rightarrow t = 0", NOTHING)
    for (const tex of ["r_s = 2M \\Rightarrow M", "r \\Leftarrow 2M", "x \\Rightarrow 0"]) declines(tex, NO_STATEMENT)
  })

  test("a declaration in any statement declines the whole line", () => {
    // The relations reviewer's counterexamples: at hl+geo these shipped
    // `1 = 1, \qquad r_s = 2M`, and in SI c stayed restored beside c = 1.
    for (const tex of ["c = 1, \\qquad r_s = 2M", "c = 1 \\implies r_s = 2M", "r_s = 2M, \\qquad G = 1"]) {
      declines(tex, DECLARATION, [SI, HL, GEO])
    }
  })

  test("a statement with a bare 1 for a side declines unless it is a pure number in the target", () => {
    // The statement-layer reviewer's counterexamples: each shipped at SI with
    // the 1 bare under a false banner (v ≪ c, |Φ| ≪ c², GM/(rc²) ≪ 1 and
    // r = GM/c² were meant). Whether a lone 1 is restored is the owner's
    // ruling (integration §4.2 item 9); until then a split line declines.
    const cases: [string, string, string, string][] = [
      [
        "E = m + \\frac{1}{2}mv^2, \\qquad v \\ll 1",
        "v \\ll 1",
        "E = m + \\frac{1}{2}mv^{2}, \\qquad v \\ll 1",
        "\\mathrm{cm};\\ \\text{dimensionless}",
      ],
      [
        "g_{tt} \\approx -(1 + 2\\Phi) \\qquad |\\Phi| \\ll 1",
        "|\\Phi| \\ll 1",
        "g_{tt} \\approx -(1 + 2\\Phi) \\qquad |\\Phi| \\ll 1",
        "\\text{dimensionless}",
      ],
      [
        "\\Phi = -\\frac{M}{r}, \\qquad \\frac{M}{r} \\ll 1",
        "\\frac{M}{r} \\ll 1",
        "\\Phi = -\\frac{M}{r}, \\qquad \\frac{M}{r} \\ll 1",
        "\\text{dimensionless}",
      ],
      [
        "t = M \\implies \\frac{r}{M} = 1",
        "\\frac{r}{M} = 1",
        "t = M \\implies \\frac{r}{M} = 1",
        "\\mathrm{cm};\\ \\text{dimensionless}",
      ],
    ]
    for (const [tex, statement, geoTex, geoUnit] of cases) {
      declines(tex, UNIT_ONE(statement), [SI, HL])
      // Geometrized, each of these is a pure number, and the 1 is one.
      expect(tex, GEO, geoTex, geoUnit, false)
    }
    // A mass set to 1 is a length set to 1 geometrized: it declines on every target.
    declines("M = 1,\\ r_s = 2M", UNIT_ONE("M = 1"), [SI, HL, GEO])
    declines("r_s = 2M \\qquad M = 1", UNIT_ONE("M = 1"), [SI, HL, GEO])
    declines("\\Rightarrow v \\ll 1", UNIT_ONE("v \\ll 1"), [SI])
    // Against a dimensionless statement the 1 is a pure number, and a signed
    // 1 or a 1 in a sum is an ordinary term.
    expect(
      "g_{tt} = -1 \\qquad r \\gg M",
      SI,
      "g_{tt} = -1 \\qquad r \\gg \\frac{GM}{c^{2}}",
      `\\text{dimensionless};\\ ${M}`,
      true,
    )
    expect("g_{tt} = -1 \\qquad r \\gg M", GEO, "g_{tt} = -1 \\qquad r \\gg M", "\\text{dimensionless};\\ \\mathrm{cm}", false)
    expect(
      "g_{tt} = -1 + \\frac{2M}{r} \\qquad r > 2M",
      SI,
      "g_{tt} = -1 + \\frac{2GM}{rc^{2}} \\qquad r > \\frac{2GM}{c^{2}}",
      `\\text{dimensionless};\\ ${M}`,
      true,
    )
    expect("r_s = 2M, \\qquad \\frac{r}{r_s} = 1", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\qquad \\frac{r}{r_{s}} = 1", `${M};\\ \\text{dimensionless}`, true)
    // A list the line turns out to be declines as one before any 1 in it is judged.
    declines("0 < t < 1,\\ 0 < r < 2M", LIST)
    // A 1 in a chain is judged as a side too: v < c was meant.
    declines("0 < v < 1, \\qquad r_s = 2M", UNIT_ONE("0 < v < 1"), [SI])
    expect("0 < v < 1, \\qquad r_s = 2M", GEO, "0 < v < 1, \\qquad r_{s} = 2M", "\\text{dimensionless};\\ \\mathrm{cm}", false)
    // Anchored on the 1, the other side is completed to a pure number: r/M = 1 is r = GM/c².
    expect(
      "r_s = 2M \\qquad 1 = \\frac{r}{M}",
      SI,
      "r_{s} = \\frac{2GM}{c^{2}} \\qquad 1 = \\frac{rc^{2}}{GM}",
      `${M};\\ \\text{dimensionless}`,
      true,
    )
    // An unknown symbol leaves no target to judge the 1 against (v ξ may be a
    // pure number), so the line declines for the unknown, with no reason.
    for (const target of [SI, GEO]) {
      const unknown = run("v \\xi \\ll 1, \\qquad r_s = 2M", target)
      assert.strictEqual(unknown.kind, "declined", JSON.stringify(unknown))
      if (unknown.kind === "declined") {
        assert.deepStrictEqual(unknown.reasons, [], JSON.stringify(unknown))
        assert.deepStrictEqual(unknown.unknown, ["\\xi"], JSON.stringify(unknown))
      }
    }
  })

  test("a bare 1 on any row of a display with a list row declines unless it is a pure number", () => {
    // The list row is what makes the display readable, so every statement in
    // it is judged, not the list row's alone: these shipped with the 1 bare
    // under a banner of m² s⁻², kg, m s⁻¹ and m² s⁻², where |Φ| ≪ c², a
    // declared mass, v ≪ c and Φ ≪ c² were meant.
    const aligned = (...rows: string[]) => `\\begin{aligned}\n${rows.join(" \\\\\n")}\n\\end{aligned}`
    const weakField = aligned("g_{tt} &\\approx -(1 + 2\\Phi), \\qquad g_{rr} \\approx 1 - 2\\Phi", "|\\Phi| &\\ll 1")
    declines(weakField, UNIT_ONE("|\\Phi| &\\ll 1"), [SI, HL])
    expect(weakField, GEO, weakField, "\\text{dimensionless}", false)
    const declared = aligned("r_s &= 2M, \\qquad t = 0", "M &= 1")
    declines(declared, UNIT_ONE("M &= 1"), [SI, HL, GEO])
    declines(aligned("M &= 1", "r_s &= 2M, \\qquad t = 0"), UNIT_ONE("M &= 1"), [SI, HL, GEO])
    const slow = aligned("E &\\approx m + \\tfrac{1}{2}mv^{2}, \\qquad r_{s} = 2M", "v &\\ll 1")
    declines(slow, UNIT_ONE("v &\\ll 1"), [SI, HL])
    expect(slow, GEO, slow, "\\mathrm{cm};\\ \\mathrm{cm};\\ \\text{dimensionless}", false)
    const weak = aligned("r_{s} &= 2M, \\qquad r \\gg M", "\\Phi &\\ll 1")
    declines(weak, UNIT_ONE("\\Phi &\\ll 1"), [SI, HL])
    expect(weak, GEO, weak, "\\mathrm{cm};\\ \\mathrm{cm};\\ \\text{dimensionless}", false)
    // Against a pure number the 1 on another row is one.
    expect(
      aligned("r_s &= 2M, \\qquad t = 0", "\\frac{r}{r_s} &= 1"),
      SI,
      aligned("r_{s} &= \\frac{2GM}{c^{2}}, \\qquad t = 0", "\\frac{r}{r_{s}} &= 1"),
      `${M};\\ ${S};\\ \\text{dimensionless}`,
      true,
    )
    // It is judged once the display is read, so a list on a later row is the reason.
    declines(aligned("r_s &= 2M, \\qquad M = 1", "\\theta &= 0, \\pi"), LIST, [SI, GEO])
  })

  test("what is not a list of statements keeps its decline", () => {
    for (const tex of [
      "\\theta = 0, \\pi",
      "\\theta = 0,\\ \\pi",
      "r_s = 2M, t = 0",
      "x, y = 0",
      "; r_s = 2M",
      "E = mc^2, \\qquad (1)",
      // A comma followed by a break hint, not by spacing, stays a bare comma.
      "r_s = 2M,\\nobreak t = 0",
    ]) {
      declines(tex, LIST)
    }
    declines("r_s = 2M, \\quad = 3M", "a relation with nothing on one side of it")
    // A comma nested in an expression is not a list of statements.
    declines(
      "x = \\frac{a, b}{c}",
      "a comma or semicolon inside an expression (arguments, a tuple, or a list), which the engine does not read as a product",
    )
  })

  test("a comma between two order relations may list the terms they share, and declines", () => {
    // `0 < t,\ r < 2M` puts t and r both in (0, 2M). Split, it gave t the
    // bound of r, 2GM/c², a length, at SI.
    for (const tex of [
      "0 < t,\\ r < 2M",
      "0 < t,\\; r < 2M",
      "0 < t,\\, r < 2M",
      "-M < r,\\; t < M",
      "0 \\le r,\\quad t \\le 2M",
      "r > 2M,\\quad t > M",
      "E \\ll M,\\ r \\gg M",
      // Two whole chains are the same shape at the comma: the engine cannot
      // tell a list of bounded terms from them, so they decline alike.
      "0 < t < 1,\\ 0 < r < 2M",
      "r_s = 2M,\\ 0 < t,\\ r < 2M",
    ]) {
      declines(tex, LIST)
    }
    // A semicolon, a connective or wide space lists no terms, and neither does
    // a comma with an equality on one side of it.
    expect("0 < t;\\ r < 2M", SI, "0 < t; \\  r < \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("0 < t \\implies r < 2M", SI, "0 < t \\implies r < \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("0 < t \\qquad r < 2M", SI, "0 < t \\qquad r < \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("0 < t,\\ r = 2M", SI, "0 < t, \\  r = \\frac{2GM}{c^{2}}", `${S};\\ ${M}`, true)
    expect("r_s = 2M,\\ t > 0", SI, "r_{s} = \\frac{2GM}{c^{2}}, \\  t > 0", `${M};\\ ${S}`, true)
  })

  test("continuation rows and the array banner", () => {
    const chain = expect(
      "\\begin{aligned} r &= 2M \\\\ &= M, \\quad t = 0 \\end{aligned}",
      SI,
      "\\begin{aligned}\nr &= \\frac{2GM}{c^{2}} \\\\\n&= \\frac{GM}{c^{2}}, \\quad t = 0\n\\end{aligned}",
      `${M};\\ ${S}`,
      true,
    )
    assert.deepStrictEqual(chain.statementUnitTex, [M, S])
    // After a row with a separator, a continuation could continue either statement.
    declines("\\begin{aligned} r &= 2M, \\quad t = M \\\\ &= 0 \\end{aligned}", AMBIGUOUS)
    declines("\\begin{aligned} r &= 2M \\\\ &\\Rightarrow t = M \\\\ &= 3M \\end{aligned}", AMBIGUOUS)
    declines("\\begin{aligned} r &= 2M \\\\ &= M \\qquad t = 0 \\\\ &= 3M \\end{aligned}", AMBIGUOUS)
    // Intended banner changes (relations reviewer): the banner named the last
    // row's unit for the whole array; it names each statement's now.
    expect(
      "\\begin{aligned} r_s &= 2M \\\\ t &= M \\end{aligned}",
      SI,
      "\\begin{aligned}\nr_{s} &= \\frac{2GM}{c^{2}} \\\\\nt &= \\frac{GM}{c^{3}}\n\\end{aligned}",
      `${M};\\ ${S}`,
      true,
    )
    expect(
      "\\begin{aligned} E &= M \\\\ r &= 2M \\\\ &= 3M \\end{aligned}",
      SI,
      "\\begin{aligned}\nE &= Mc^{2} \\\\\nr &= \\frac{2GM}{c^{2}} \\\\\n&= \\frac{3GM}{c^{2}}\n\\end{aligned}",
      `${J};\\ ${M}`,
      true,
    )
    // A continuation is its chain's statement, so one chain is one unit.
    const one = expect(
      "\\begin{aligned} r &= 2M \\\\ &= M \\end{aligned}",
      SI,
      "\\begin{aligned}\nr &= \\frac{2GM}{c^{2}} \\\\\n&= \\frac{GM}{c^{2}}\n\\end{aligned}",
      M,
      true,
    )
    assert.strictEqual(one.statementUnitTex, undefined)
  })
})

describe("index tokens, primes and the canonical symbol key", () => {
  const rawRestored = (tex: string, target: TargetSpec = SI, registry: HubRegistry = reg) => {
    const result = translateTex(tex, katex, registry, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    return (result as Extract<TranslationResult, { kind: "translated" }>).restoredTex
  }
  const declined = (tex: string, registry: HubRegistry = reg) => {
    const result = translateTex(tex, katex, registry, SI)
    assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
    return result as Extract<TranslationResult, { kind: "declined" }>
  }
  // Primed symbols as a page would declare them: the bridge places a reading
  // under symbolKey's name, and these stand in for such placements.
  const L = { dim: [0, 12, 0, 0, 0] as HubRegistry["bare"][string]["dim"], gloss: "coordinate in another chart", si: "m" }
  const primed: HubRegistry = {
    ...reg,
    bare: {
      ...reg.bare,
      "x'": L,
      "t'": { dim: [0, 0, 12, 0, 0], gloss: "time in the boosted frame", si: "s" },
      "\\alpha'": { dim: [0, 24, 0, 0, 0], gloss: "Regge slope", si: "m²" },
    },
    indexed: { ...reg.indexed, "x'": L, "\\Gamma'": reg.indexed["\\Gamma"] },
  }

  test("KaTeX: a shorthand prime and what is raised after it share one superscript; a primed index is a supsub", () => {
    const parse = (tex: string) => katex.__parse(tex, { strict: false, trust: false, displayMode: true })
    const [power] = parse("x'^{2}")
    assert.deepStrictEqual(
      power.sup.body.map((n: any) => [n.type, n.loc == null]),
      [
        ["textord", true],
        ["ordgroup", false],
      ],
    )
    assert.strictEqual(power.sup.loc, undefined, "the shorthand superscript grew a span")
    const [index] = parse("x^{\\mu'}")
    assert.strictEqual(index.sup.body[0].type, "supsub")
    assert.strictEqual(index.sup.body[0].base.text, "\\mu")
    assert.strictEqual(index.sup.body[0].sup.body[0].text, "\\prime")
  })

  test("a primed, labelled, grouped or continued index is an index (R5b, F-P2)", () => {
    // Carroll's transformation laws declined as a symbolic exponent on x.
    assert.strictEqual(
      rawRestored("x^{\\mu'} = \\Lambda^{\\mu'}{}_{\\nu}x^{\\nu}"),
      "x^{\\mu'} = \\Lambda^{\\mu'}{}_{\\nu}x^{\\nu}",
    )
    for (const target of [SI, { system: "hl", geometrized: false } as TargetSpec]) {
      assert.strictEqual(
        rawRestored("T_{\\mu^{\\prime}\\nu^{\\prime}} = \\rho u_{\\mu^{\\prime}} u_{\\nu^{\\prime}}", target),
        "T_{\\mu^{\\prime}\\nu^{\\prime}} = \\rho u_{\\mu^{\\prime}}u_{\\nu^{\\prime}}c^{2}",
      )
    }
    assert.strictEqual(
      rawRestored("T_{\\mu^{\\prime}\\nu^{\\prime}} = \\rho u_{\\mu^{\\prime}} u_{\\nu^{\\prime}}", GEO),
      "T_{\\mu^{\\prime}\\nu^{\\prime}} = \\rho u_{\\mu^{\\prime}}u_{\\nu^{\\prime}}",
    )
    assert.strictEqual(rawRestored("T_{\\mu'\\nu'} = \\rho u_{\\mu'}u_{\\nu'}"), "T_{\\mu'\\nu'} = \\rho u_{\\mu'}u_{\\nu'}c^{2}")
    assert.strictEqual(
      rawRestored("T^{\\mu'}{}_{\\nu'} = \\rho u^{\\mu'}u_{\\nu'}"),
      "T^{\\mu'}{}_{\\nu'} = \\rho u^{\\mu'}u_{\\nu'}c^{2}",
    )
    assert.strictEqual(rawRestored("R_{ab{cd}} = -R_{ba{cd}}"), "R_{ab{cd}} = -R_{ba{cd}}")
    assert.strictEqual(rawRestored("x^{\\mu_1} = 0"), "x^{\\mu_1} = 0")
    assert.strictEqual(rawRestored("T_{a\\cdots b} = \\rho"), "T_{a\\cdots b} = \\rho c^{2}")
  })

  test("what is not an index list stays out of one", () => {
    // The unknown is the source's own slice (the macro-span fix).
    assert.deepStrictEqual(declined("S_{\\mu_{1}\\cdots\\mu_{n}} = 0").unknown, ["S_{\\mu_{1}\\cdots\\mu_{n}}"])
    // An upright letter is a label, never an index: not through a subscript
    // on an index, nor under a font.
    assert.deepStrictEqual(declined("T_{\\nu_{\\rm e}} = \\rho").unknown, ["T_{\\nu_{\\rm e}}"])
    assert.deepStrictEqual(declined("T_{\\mathbf{\\mu}'} = \\rho").unknown, ["T_{\\mathbf{\\mu}'}"])
    assert.deepStrictEqual(declined("x^{\\mu_{\\rm e}} = 0").reasons, ["a symbolic exponent on the dimensional base “x”"])
    // Brackets and an ellipsis alone index nothing.
    assert.deepStrictEqual(declined("T_{()} = \\rho").unknown, ["T_{()}"])
    assert.deepStrictEqual(declined("x^{\\cdots} = 0").reasons, ["a symbolic exponent on the dimensional base “x”"])
  })

  test("a decorated, grouped or continued superscript on a group is not read as an index (review fix)", () => {
    // On a group the superscript could be a symbolic power, and the group's
    // dimension passed through unchanged shipped `…^{\alpha_1}c` as if the
    // exponent were 1. These declined before the new index tokens and still do.
    const UNREADABLE = ["a super/subscript construct the engine could not read"]
    for (const tex of [
      "r = M\\left(\\frac{t}{M}\\right)^{\\alpha_1}",
      "z = \\left(\\frac{r}{M}\\right)^{\\beta'}",
      "r = M(t/M)^{{2}}",
      "z = (r/M)^{\\gamma_1}",
      "r = M\\left[\\frac{t}{M}\\right]^{\\alpha_1}",
      "r = M\\left(\\frac{t}{M}\\right)^{\\mu_1\\cdots\\mu_n}",
    ]) {
      assert.deepStrictEqual(declined(tex).reasons, UNREADABLE, tex)
    }
    // A braced symbol is the symbol (step 11): r^{α₁} goes to r's indexed
    // reading, which the dictionary does not have, as it does unbraced.
    assert.deepStrictEqual(declined("r = {r}^{\\alpha_1}").unknown, ["{r}^{\\alpha_1}"])
    assert.deepStrictEqual(declined("r = r^{\\alpha_1}").unknown, ["r^{\\alpha_1}"])
    // Braces only group: a braced numeral is the numeral, so `p^{{2}}` is not
    // the component p² of the four-momentum; the component shape still is one.
    assert.deepStrictEqual(declined("E = p^{{2}}").reasons, ["a symbolic exponent on the dimensional base “p”"])
    assert.strictEqual(rawRestored("E = p^{{0}}"), "E = p^{{0}}c")
    // A plain index letter on a symbol keeps its indexed reading.
    assert.strictEqual(rawRestored("E = p^{\\alpha_1}"), "E = p^{\\alpha_1}c")
  })

  test("the angular guard reads θ and φ through a prime, a label and braces on the index", () => {
    const ANGULAR = (tex: string) =>
      `an angular coordinate index on “${tex}” — components along θ and φ do not share the registry's length dimension`
    for (const [tex, quoted] of [
      ["\\Gamma^{\\mu}_{\\theta'\\theta'} = 0", "\\Gamma^{\\mu}_{\\theta'\\theta'}"],
      ["\\Gamma^{\\mu}_{{\\theta\\theta}} = 0", "\\Gamma^{\\mu}_{{\\theta\\theta}}"],
      ["\\Gamma^{\\theta'}_{rr} = 0", "\\Gamma^{\\theta'}_{rr}"],
    ]) {
      assert.deepStrictEqual(declined(tex).reasons, [ANGULAR(quoted)], tex)
    }
    // A primed symbol's own indexed reading is guarded as any other is.
    assert.deepStrictEqual(declined("\\Gamma'^{\\mu}_{\\theta\\theta} = 0", primed).reasons, [
      ANGULAR("\\Gamma'^{\\mu}_{\\theta\\theta}"),
    ])
    assert.deepStrictEqual(declined("\\Gamma'^{2}_{00} = 0", primed).reasons, [
      "a digit superscript on “\\Gamma'^{2}_{00}” — a component index or a power",
    ])
    // The subscript ruling still reads them.
    assert.strictEqual(rawRestored("g_{\\theta'\\theta'} = 0"), "g_{\\theta'\\theta'} = 0")
  })

  test("a primed symbol is looked up under its own name and borrows nothing from its letter", () => {
    // Unknown only is asserted: an unknown reads as dimensionless, so the
    // decline may also name a term with no completion.
    const unknown = (tex: string, registry: HubRegistry = reg) => declined(tex, registry).unknown
    assert.deepStrictEqual(unknown("x' = x"), ["x'"])
    // α′, the Regge slope, is not the lapse α.
    assert.deepStrictEqual(unknown("\\alpha' = \\ell_P^{2}"), ["\\alpha'"])
    assert.deepStrictEqual(unknown("f'(r) = 2M/r^{2}"), ["f'"])
    // The number of primes is part of the name.
    assert.deepStrictEqual(unknown("t'' = t", primed), ["t''"])
    // Primes before or after the subscript, shorthand or written, are one name,
    // listed primes first; each re-emits without a reassembly fault.
    for (const [tex, name] of [
      ["x'_{\\mu} = x_{\\mu}", "x'_{\\mu}"],
      ["x_{\\mu}' = x_{\\mu}", "x'_{\\mu}"],
      ["X^{\\prime}_{\\mu} = x_{\\mu}", "X'_{\\mu}"],
    ]) {
      const result = declined(tex)
      assert.deepStrictEqual(result.unknown, [name], tex)
      assert.ok(!result.reasons.some((r) => r.includes("reassembly")), JSON.stringify(result.reasons))
    }
    // The listed name carries no power.
    assert.deepStrictEqual(unknown("x'^{2} = r^2"), ["x'"])
    // c′ and G′ are not the constants.
    const notC = declined("c' = 1")
    assert.deepStrictEqual([notC.reasons, notC.unknown], [[], ["c'"]])
    assert.deepStrictEqual(unknown("G'M = r"), ["G'"])
    // A label after the primes is part of the name (step 11), listed as written.
    assert.deepStrictEqual(unknown("u'^{\\rm out} = r"), ["u'^{\\rm out}"])
    assert.deepStrictEqual(unknown("x'^{+} = x"), ["x'^{+}"])
  })

  test("a declared primed symbol translates, its primes re-emitted as written", () => {
    // A-P3–A-P5: the boost, shorthand and written, and unchanged when geometrized.
    assert.strictEqual(
      rawRestored("t' = t\\cosh\\phi - x\\sinh\\phi", SI, primed),
      "t' = t\\cosh\\phi - \\frac{x\\sinh\\phi}{c}",
    )
    assert.strictEqual(
      rawRestored("t^{\\prime} = t\\cosh\\phi - x\\sinh\\phi", SI, primed),
      "t^{\\prime} = t\\cosh\\phi - \\frac{x\\sinh\\phi}{c}",
    )
    assert.strictEqual(rawRestored("t' = t\\cosh\\phi - x\\sinh\\phi", GEO, primed), "t' = t\\cosh\\phi - x\\sinh\\phi")
    // The scripts in the order written, shorthand primes as apostrophes.
    for (const tex of [
      "x'_{\\mu} = x_{\\mu}",
      "x_{\\mu}' = x_{\\mu}",
      "x^{\\prime}_{\\mu} = x_{\\mu}",
      "x_{\\mu}^{\\prime} = x_{\\mu}",
      "x'^{\\mu} = x^{\\mu}",
      "\\alpha^{\\prime\\,2} = r^{4}",
      "\\alpha'^{2} = r^{4}",
    ]) {
      assert.strictEqual(rawRestored(tex, SI, primed), tex)
    }
    assert.strictEqual(rawRestored("x'^2 = r^2", SI, primed), "x'^{2} = r^{2}")
    assert.strictEqual(rawRestored("t^{\\prime} = x^\\prime", SI, primed), "t^{\\prime} = \\frac{x^{\\prime}}{c}")
    // The legend shows the primed name, primes before the subscript, and an
    // index list as written.
    const legend = translateTex("x_{\\mu}' x'^{\\mu} = \\alpha'", katex, primed, SI)
    assert.ok(legend.kind === "translated", JSON.stringify(legend))
    if (legend.kind === "translated") {
      assert.deepStrictEqual(
        legend.legend.map((e) => e.tex),
        ["x'_{\\mu}", "x'^{\\mu}", "\\alpha'"],
      )
    }
  })

  test("a primed differential is the primed symbol under d (A-N9)", () => {
    // Read as any scripted operand, `dx^{\prime}_{\mu}` was looked up as dx_μ.
    assert.ok(declined("\\mathrm{d}x' = dx").unknown.includes("x'"))
    assert.deepStrictEqual(declined("ds = dx'").unknown, ["x'"])
    assert.deepStrictEqual(declined("ds = dx^{\\prime}_{\\mu}").unknown, ["x'_{\\mu}"])
    assert.deepStrictEqual(declined("ds = dx'_{\\mu}").unknown, ["x'_{\\mu}"])
    assert.strictEqual(rawRestored("dt' = ds", SI, primed), "dt' = \\frac{ds}{c}")
    assert.strictEqual(rawRestored("\\mathrm{d}t' = ds", SI, primed), "\\mathrm{d}t' = \\frac{ds}{c}")
    assert.strictEqual(rawRestored("ds = dx'", SI, primed), "ds = dx'")
  })

  test("primes the engine cannot read as part of a name decline by name (A-N7, A-N8)", () => {
    const COMPOUND = "a prime on a compound expression, which the engine cannot read as a symbol"
    const MIXED = "a prime mixed into a superscript the engine could not read"
    for (const [tex, reason] of [
      ["(r)' = 1", COMPOUND],
      ["\\vec{k}' = k", COMPOUND],
      ["x^{2\\prime} = r", MIXED],
      ["x'^{\\prime} = r", MIXED],
      ["x'^{n+} = x", "a sign standing as a superscript (a light-cone index or a charge label), which is neither a power nor a dictionary index"],
      ["\\mathrm{m}' = M", "the upright letter “m” — a unit, a label or an operator, not a variable"],
    ]) {
      const result = declined(tex)
      assert.deepStrictEqual(result.reasons, [reason], tex)
      assert.deepStrictEqual(result.unknown, [], tex)
    }
    // A primed big operator names itself.
    assert.ok(declined("E = \\sum' p").reasons[0].includes("integrals, sums, and limits"))
  })

  test("symbolKey: the name the engine looks a symbol up by", () => {
    for (const [tex, key] of [
      ["t", "t"],
      ["t'", "t'"],
      ["t^{\\prime}", "t'"],
      ["t^\\prime", "t'"],
      ["t''", "t''"],
      ["\\alpha^{\\prime\\prime}", "\\alpha''"],
      ["\\alpha '", "\\alpha'"],
      ["p'_\\mu", "p'_\\mu"],
      ["p_\\mu'", "p'_\\mu"],
      ["p_{\\mu}^{\\prime}", "p'_\\mu"],
      ["p^{\\prime}_{\\mu}", "p'_\\mu"],
      ["T_{\\mu \\nu}", "T_\\mu\\nu"],
      ["r_s", "r_s"],
      ["r_\\mathrm{s}", "r_s"],
      ["r_{\\rm s}", "r_\\rms"],
      ["\\mathbf{J}_i", "\\mathbf{J}_i"],
    ] as const) {
      assert.strictEqual(symbolKey(tex), key, tex)
    }
    // A superscript other than primes names no entry, nor do primes mixed with one.
    for (const tex of ["x'^{\\mu}", "x'^{2}", "x'^{\\prime}", "x^{\\prime}'", "x'_\\mu'", "u_{j}^{\\rm out}", "T^{\\rm eff}", "m_1^2", "T_ab", "x_{\\mu}_{\\nu}", "", "{x}"]) {
      assert.strictEqual(symbolKey(tex), null, tex)
    }
  })

  test("symbolKey agrees with the engine: a reading placed under the key is the one the engine reads", () => {
    const reading = { dim: [0, 12, 0, 0, 0] as HubRegistry["bare"][string]["dim"], gloss: "a declared length", si: "m" }
    for (const tex of ["t'", "t^{\\prime}", "t^\\prime", "\\alpha''", "q'_\\mu", "q_{\\mu}'", "q_{\\mu}^{\\prime}", "Q_{\\mu \\nu}", "Q_\\mathrm{s}"]) {
      const key = symbolKey(tex)!
      const table = key.includes("_") ? "exact" : "bare"
      const declared: HubRegistry = { ...reg, [table]: { ...reg[table], [key]: reading } }
      const result = translateTex(`${tex} = r`, katex, declared, SI)
      assert.strictEqual(result.kind, "translated", `${tex} (key ${key}) → ${JSON.stringify(result)}`)
      if (result.kind === "translated") assert.ok(result.legend.some((e) => e.gloss === "a declared length"), tex)
    }
  })
})

describe("bases, accents, labels and named operators (step 11)", () => {
  const translated = (tex: string, target: TargetSpec = SI, registry: HubRegistry = reg) => {
    const result = translateTex(tex, katex, registry, target)
    assert.strictEqual(result.kind, "translated", `${tex} → ${JSON.stringify(result)}`)
    const out = result as Extract<TranslationResult, { kind: "translated" }>
    rendersInKatex(out.restoredTex)
    return out
  }
  const rawRestored = (tex: string, target: TargetSpec = SI, registry: HubRegistry = reg) =>
    translated(tex, target, registry).restoredTex
  const declined = (tex: string, registry: HubRegistry = reg) => {
    const result = translateTex(tex, katex, registry, SI)
    assert.strictEqual(result.kind, "declined", `${tex} → ${JSON.stringify(result)}`)
    return result as Extract<TranslationResult, { kind: "declined" }>
  }
  const reasons = (tex: string) => declined(tex).reasons
  const unchanged = (tex: string, registry: HubRegistry = reg) => {
    const out = translated(tex, SI, registry)
    assert.strictEqual(out.changed, false, tex)
    return out
  }
  const DOT = (tex: string) =>
    `a dot on the indexed symbol “${tex}” — a time derivative or the derivative along u^{a}, which differ by a velocity`
  const SCRIPTED_ACCENT = (accent: string, tex: string) =>
    `the accent “${accent}” over the scripted symbol “${tex}” — a unit vector, an operator or a transform, which need not keep the symbol's dimension — is not supported yet`
  const MARK_ON_COMPOUND = (mark: string) =>
    `the label or mark “${mark}” on a compound expression, which the engine cannot read as a symbol`

  test("KaTeX shapes the label and operator readings rest on", () => {
    const parse = (tex: string) => katex.__parse(tex, { strict: false, trust: false, displayMode: true })
    // A \text or \mathrm written as the whole script has no span of its own.
    const [text] = parse("u^\\text{out}")
    assert.strictEqual(text.sup.type, "text")
    assert.strictEqual(text.sup.loc, undefined)
    const [font] = parse("T^\\mathrm{vac}")
    assert.strictEqual(font.sup.type, "font")
    assert.strictEqual(font.sup.loc, undefined)
    // Marks are bin atoms; a braced accent keeps a span on its braces only.
    for (const [tex, mark] of [
      ["a^{\\dagger}", "\\dagger"],
      ["a^{*}", "*"],
      ["a^{\\ast}", "\\ast"],
      ["a^{\\star}", "\\star"],
      ["a^{\\intercal}", "\\intercal"],
    ]) {
      const [node] = parse(tex)
      assert.deepStrictEqual([node.sup.body[0].type, node.sup.body[0].family, node.sup.body[0].text], ["atom", "bin", mark], tex)
    }
    const [braced] = parse("{\\bar h}_{\\mu\\nu}")
    assert.strictEqual(braced.base.type, "ordgroup")
    assert.ok(braced.base.loc != null)
    assert.strictEqual(braced.base.body[0].type, "accent")
    assert.strictEqual(braced.base.body[0].loc, undefined)
    // \overline is a node of its own, its body a located group.
    const [over] = parse("\\overline{T}_{ab}")
    assert.strictEqual(over.base.type, "overline")
    // \mathop around a word has no name; \nolimits and \operatorname* set alwaysHandleSupSub.
    const [mathop] = parse("\\mathop{\\rm Tr}T")
    assert.deepStrictEqual([mathop.type, mathop.name, mathop.body[0].type], ["op", undefined, "font"])
    assert.strictEqual(parse("\\mathop{\\rm Tr}\\nolimits T")[0].alwaysHandleSupSub, true)
    assert.strictEqual(parse("\\operatorname*{Tr}T")[0].alwaysHandleSupSub, true)
    assert.strictEqual(parse("\\operatorname{tr}(T)")[0].alwaysHandleSupSub, false)
  })

  test("a braced or font-wrapped symbol is the symbol (R2)", () => {
    assert.strictEqual(rawRestored("{r}_{s} = 2M"), "{r}_{s} = \\frac{2GM}{c^{2}}")
    // Braces read as a compound base appended the indices to the bare letter:
    // T read as a temperature.
    assert.strictEqual(rawRestored("{T}_{ab} = \\rho"), "{T}_{ab} = \\rho c^{2}")
    // LaTeXML's braced ∂ (Carroll's notes) was a false dictionary miss.
    unchanged("{\\partial}_{\\mu}T^{\\mu\\nu} = 0")
    // The reviewer's R2 blockers: each re-emits as written, no reassembly fault.
    assert.strictEqual(unchanged("\\boldsymbol{x}_{i} = \\mathbf{x}_{i}").restoredTex, "\\boldsymbol{x}_{i} = \\mathbf{x}_{i}")
    assert.strictEqual(unchanged("\\bm{x}_i = r").restoredTex, "\\bm{x}_{i} = r")
    assert.strictEqual(unchanged("{\\bf x}_i = r").restoredTex, "{\\bf x}_{i} = r")
    assert.strictEqual(unchanged("{\\cal R}_{ab} = 0").restoredTex, "{\\cal R}_{ab} = 0")
    // An upright letter is still no variable, braced or not.
    assert.deepStrictEqual(reasons("{\\rm r}_{s} = 2M"), [
      "the upright letter “r” — a unit, a label or an operator, not a variable",
    ])
    // A lone power on a braced symbol keeps its compound reading; the
    // reviewer's `{\rm d}^{4}x` declines on its d by name, not as a fault.
    assert.strictEqual(rawRestored("E = {c}^{2}m"), "E = {c}^{2}m")
    assert.ok(!reasons("{\\rm d}^{4}x = 0")[0].includes("reassembly"))
    // A braced primed symbol is the primed symbol; a primed accent is a compound.
    assert.deepStrictEqual(declined("{\\alpha}' = x").unknown, ["{\\alpha}'"])
    assert.deepStrictEqual(reasons("\\vec{k}' = k"), ["a prime on a compound expression, which the engine cannot read as a symbol"])
  })

  test("a scripted bar, arrow, check, breve or overline reads the symbol under it with its scripts (R3)", () => {
    // Read as a compound base, h̄_{μν} looked up the bare h.
    const box = translated("\\Box\\bar h_{\\mu\\nu} = -16\\pi T_{\\mu\\nu}")
    assert.strictEqual(box.restoredTex, "\\Box\\bar{h}_{\\mu\\nu} = -\\frac{16\\pi GT_{\\mu\\nu}}{c^{4}}")
    assert.ok(box.legend.some((e) => e.tex === "\\bar{h}_{\\mu\\nu}" && e.gloss === "metric perturbation"))
    assert.strictEqual(rawRestored("\\Box\\bar h_{\\mu\\nu} = -16\\pi G T_{\\mu\\nu}", GEO), "\\Box\\bar{h}_{\\mu\\nu} = -16\\pi T_{\\mu\\nu}")
    assert.strictEqual(rawRestored("\\bar h_{00} = -4\\Phi"), "\\bar{h}_{00} = -\\frac{4\\Phi}{c^{2}}")
    // T̄_{μν} is the stress–energy tensor, not a temperature, in every spelling.
    for (const tex of ["\\bar{T}_{\\mu\\nu} = T_{\\mu\\nu}", "{\\bar{T}}_{\\mu\\nu} = T_{\\mu\\nu}", "\\overline{T}_{\\mu\\nu} = T_{\\mu\\nu}"]) {
      assert.strictEqual(unchanged(tex).targetUnitTex, "\\mathrm{kg}\\,\\mathrm{m}^{-1}\\,\\mathrm{s}^{-2}", tex)
    }
    unchanged("\\bar{\\mathbf{h}}_{\\mu\\nu} = 0")
    assert.strictEqual(rawRestored("\\check{r}_{s} = 2M"), "\\check{r}_{s} = \\frac{2GM}{c^{2}}")
    assert.strictEqual(rawRestored("\\breve{r}_{s} = 2M"), "\\breve{r}_{s} = \\frac{2GM}{c^{2}}")
    // A lone power keeps the compound reading it always had.
    assert.strictEqual(rawRestored("\\bar r^2 = M^2"), "\\bar{r}^{2} = \\frac{G^{2}M^{2}}{c^{4}}")
    // Under an accent c is another symbol, scripted or not.
    assert.deepStrictEqual(reasons("\\bar{c}_{ab} = 0"), [
      "the accented “\\bar{c}” — another symbol (a vector, a mean, an operator or a label), not the constant c",
    ])
  })

  test("a dot on an indexed symbol declines: d/dt or the derivative along u^a", () => {
    // The 1+3 reviewer's counterexamples: read as d/dt, each shipped a c.
    assert.deepStrictEqual(reasons("\\dot{u}^{a} = u^{b}\\nabla_{b}u^{a}"), [DOT("\\dot{u}^{a}")])
    assert.deepStrictEqual(reasons("\\dot{h}_{ij} = u^{a}\\nabla_{a}h_{ij}"), [DOT("\\dot{h}_{ij}")])
    // Deliberately given up: `\dot{x}^{\mu} = u^{\mu}` shipped `u^{\mu}c` (§1.2).
    assert.deepStrictEqual(reasons("\\dot{x}^{\\mu} = u^{\\mu}"), [DOT("\\dot{x}^{\\mu}")])
    assert.deepStrictEqual(reasons("\\dot{T}_{ab} = \\rho\\omega"), [DOT("\\dot{T}_{ab}")])
    assert.deepStrictEqual(reasons("\\dot{x}_{1}^{2} = v^{2}"), [DOT("\\dot{x}_{1}^{2}")])
    // A dotted identity reads, and its legend row is the symbol under the dot.
    const rs = unchanged("\\dot{r}_s = v")
    assert.strictEqual(rs.restoredTex, "\\dot{r}_{s} = v")
    assert.ok(rs.legend.some((e) => e.tex === "r_{s}" && e.unit === "m"), JSON.stringify(rs.legend))
    assert.ok(unchanged("\\dot{r} = v").legend.some((e) => e.tex === "r" && e.unit === "m"))
    unchanged("\\ddot{r}_s = v/t")
    // A symbol with no indexed reading is looked up, and missed.
    assert.deepStrictEqual(declined("\\dot{\\zeta}_{k} = 0").unknown, ["\\zeta_{k}"])
  })

  test("stacked, hat, tilde and wide accents on a scripted symbol decline; the bare letter is never read", () => {
    assert.deepStrictEqual(reasons("\\hat{\\bar{h}}_{ab} = 0"), ["stacked accents on “\\hat{\\bar{h}}_{ab}”, which are not supported"])
    assert.deepStrictEqual(reasons("\\bar{\\dot{T}}_{ab} = 0"), ["stacked accents on “\\bar{\\dot{T}}_{ab}”, which are not supported"])
    // Owner-gated (R1): read through a hat, ĝ_{αβ} was the metric determinant
    // and θ̂ the polar angle.
    assert.deepStrictEqual(reasons("\\hat{g}_{\\alpha\\beta} = 0"), [SCRIPTED_ACCENT("\\hat", "\\hat{g}_{\\alpha\\beta}")])
    assert.deepStrictEqual(reasons("\\hat{x}^{i}\\hat{x}_{i} = 1"), [SCRIPTED_ACCENT("\\hat", "\\hat{x}^{i}")])
    assert.deepStrictEqual(reasons("{\\hat{\\theta}}^{(\\nu)}({\\hat{e}}_{(\\mu)}) = \\delta^{\\nu}_{\\mu}"), [
      SCRIPTED_ACCENT("\\hat", "{\\hat{\\theta}}^{(\\nu)}"),
    ])
    assert.deepStrictEqual(reasons("\\tilde{h}_{ij} = h_{ij}"), [SCRIPTED_ACCENT("\\tilde", "\\tilde{h}_{ij}")])
    // Without R1 a wide accent is not read at all; `\widehat{v} = v/c` would ship `vc/c`.
    assert.deepStrictEqual(reasons("\\widehat{v} = v/c"), ["the unsupported accent “\\widehat”"])
    assert.deepStrictEqual(reasons("\\widetilde{\\Gamma}^{a}_{bc} = -\\Gamma^{a}_{bc}"), ["the unsupported accent “\\widetilde”"])
    // An index subscript on an accented letter the dictionary has no reading
    // for is a miss, not the bare letter (v, a velocity).
    assert.deepStrictEqual(declined("\\vec{v}_{1} = v").unknown, ["\\vec{v}_{1}"])
  })

  test("a label is part of the symbol's name, looked up under it and never under its letter (R4)", () => {
    // Read as its letter, the out-mode shipped as the four-velocity u_j.
    assert.deepStrictEqual(declined("u^{\\text{out}}_j = u_j").unknown, ["u^{\\text{out}}_{j}"])
    for (const [tex, name] of [
      ["E^{(4)} = 0", "E^{(4)}"],
      ["X^{+} = 0", "X^{+}"],
      ["\\alpha^{*} = 0", "\\alpha^{*}"],
      ["c^{*} = 1", "c^{*}"],
      ["H^{({\\rm R})} = 0", "H^{({\\rm R})}"],
      ["C^{\\rm(old)}_{00} = 0", "C^{\\rm(old)}_{00}"],
      ["a^{\\text{in}\\dagger}_{i} = 0", "a^{\\text{in}\\dagger}_{i}"],
    ]) {
      assert.deepStrictEqual(declined(tex).unknown, [name], tex)
    }
    // A label on G is a name like any other; G^{eff} is not Newton's constant.
    assert.deepStrictEqual(declined("G^{\\mathrm{eff}} = G").unknown, ["G^{\\mathrm{eff}}"])
    // One key for every spelling of the label, each re-emitted as written.
    const vac = { ...reg, indexed: { ...reg.indexed, "T^{\\mathrm{vac}}": reg.indexed.T } }
    for (const label of ["{\\mathrm{vac}}", "\\mathrm{vac}", "{\\text{vac}}", "\\text{vac}", "{\\rm vac}", "{\\text{\\,vac}}"]) {
      assert.strictEqual(
        rawRestored(`T_{ab}^${label} = -\\frac{\\Lambda}{8\\pi}g_{ab}`, SI, vac),
        `T_{ab}^${label} = -\\frac{\\Lambda c^{4}}{8\\pi G}g_{ab}`,
        label,
      )
    }
    // A lone sign keys an exact reading like any subscripted name.
    const light = { ...reg, exact: { ...reg.exact, "X^{+}_L": reg.bare.r } }
    assert.strictEqual(rawRestored("X^{+}_{L} = 2M", SI, light), "X^{+}_{L} = \\frac{2GM}{c^{2}}")
    // An unbraced \text label keeps its command.
    const out = { ...reg, bare: { ...reg.bare, "u^{\\mathrm{out}}": reg.bare.r } }
    assert.strictEqual(rawRestored("u^\\text{out} = 2M", SI, out), "u^\\text{out} = \\frac{2GM}{c^{2}}")
  })

  test("what is no label keeps its reading (R4 reviewer counterexamples)", () => {
    // Upright e, i and d are not labels: these are powers, as they always were.
    for (const tex of [
      "E = mc^2e^{\\mathrm{i}kx}",
      "E = mc^2 e^{-\\mathrm{i}\\omega t}",
      "E = mc^2\\mathrm{e}^{\\mathrm{i}\\omega t}",
      "E = mc^2 e^{\\mathrm{i}\\pi}",
      "E = mc^2 e^{-\\mathrm{i}\\omega t/2}",
    ]) {
      unchanged(tex)
    }
    // Nor is an operator's name: here it acts on nothing.
    assert.deepStrictEqual(reasons("z = e^{\\mathrm{Im}}"), ["the operator “\\mathrm{Im}” with nothing to act on"])
    // A label among index letters is neither.
    assert.deepStrictEqual(reasons("h^{ij\\mathrm{TT}} = 0"), ["a superscript on “h^{ij\\mathrm{TT}}” that mixes a label with indices"])
    assert.deepStrictEqual(reasons("C^{{\\rm(new)}\\mu}{}_{\\mu} = 0"), [
      "a superscript on “C^{{\\rm(new)}\\mu}” that mixes a label with indices",
    ])
    // An italic superscript beside a subscript is still a power or a label, unread.
    assert.deepStrictEqual(reasons("g_i^{n} = 0"), ["an exponent on “g_{i}^{n}” that could not be read"])
    // A big operator names itself before any label is read.
    assert.ok(reasons("\\sum^{\\rm N}_{i}x_i = r")[0].includes("integrals, sums, and limits"))
    // A parenthesized index list is still an index list (a frame component).
    assert.strictEqual(rawRestored("E = p^{(\\mu)}"), "E = p^{(\\mu)}c")
  })

  test("a dagger keeps the symbol's reading; on a constant it declines", () => {
    assert.strictEqual(unchanged("E^{\\dagger} = mc^2").restoredTex, "E^{\\dagger} = mc^{2}")
    assert.strictEqual(rawRestored("E^{\\dagger} = mc^2", GEO), "E^{\\dagger} = m")
    assert.deepStrictEqual(reasons("x = c^{\\dagger}"), ["a label or mark on the constant “c”"])
    assert.deepStrictEqual(reasons("x = \\mathbf{c}^{\\dagger}"), [
      "the bold “\\mathbf{c}” — another symbol (a vector, a tensor or a label), not the constant c",
    ])
  })

  test("a group keeps its dimension under a dagger or a transpose, and reads no other mark (R8b)", () => {
    for (const mark of ["\\mathrm{T}", "\\dagger", "\\intercal", "\\top", "\\mathsf{T}"]) {
      assert.strictEqual(unchanged(`A = (x)^{${mark}}x`).restoredTex, `A = (x)^{${mark}}x`, mark)
    }
    // These had the false 'symbolic exponent' or sign-label reasons.
    assert.deepStrictEqual(reasons("r = (r)^{*}"), [MARK_ON_COMPOUND("*")])
    assert.deepStrictEqual(reasons("r = (r)^{+}"), [MARK_ON_COMPOUND("+")])
    assert.deepStrictEqual(reasons("r = \\left(r\\right)^{\\rm out}"), [MARK_ON_COMPOUND("\\rm out")])
  })

  test("named operators: a trace or a part keeps its operand's dimension", () => {
    assert.strictEqual(rawRestored("\\operatorname{tr}(T_{ab}) = -\\rho"), "\\operatorname{tr}(T_{ab}) = -\\rho c^{2}")
    assert.strictEqual(rawRestored("\\mathrm{tr}(T_{ab}) = -\\rho"), "\\mathrm{tr}(T_{ab}) = -\\rho c^{2}")
    assert.strictEqual(rawRestored("{\\rm tr}\\,(T_{ab}) = -\\rho"), "{\\rm tr}(T_{ab}) = -\\rho c^{2}")
    assert.strictEqual(rawRestored("\\mathop{\\rm Tr}T_{ab} = \\rho"), "\\mathop{\\rm Tr}T_{ab} = \\rho c^{2}")
    assert.strictEqual(rawRestored("2\\operatorname{Re}(h_{ab}) = \\Phi"), "2\\operatorname{Re}(h_{ab}) = \\frac{\\Phi}{c^{2}}")
    // G goes after the numerals, before the operator; c at the tail.
    assert.strictEqual(rawRestored("r = 2\\operatorname{Re}(h_{ab})M"), "r = \\frac{2G\\operatorname{Re}(h_{ab})M}{c^{2}}")
    assert.strictEqual(rawRestored("M = \\operatorname{Re}(h_{ab})r"), "M = \\frac{\\operatorname{Re}(h_{ab})rc^{2}}{G}")
    assert.strictEqual(unchanged("\\operatorname{Tr}\\,\\operatorname{Re}(h_{ab}) = 0").restoredTex, "\\operatorname{Tr}\\operatorname{Re}(h_{ab}) = 0")
    assert.strictEqual(rawRestored("\\operatorname{tr}(T_{ab}) = -\\rho c^2", GEO), "\\operatorname{tr}(T_{ab}) = -\\rho")
    // Read as T·r it declined as an upright word; read as a trace, the
    // registry's bare T is a temperature (an owner question), which is said.
    assert.ok(reasons("\\mathrm{Tr}\\,T = \\rho")[0].startsWith("temperature dimensions that do not balance"))
    assert.deepStrictEqual(reasons("\\operatorname{Tr} = 1"), ["the operator “\\operatorname{Tr}” with nothing to act on"])
    assert.deepStrictEqual(reasons("\\mathrm{Tr}/M = 1"), ["the operator “\\mathrm{Tr}” with nothing to act on"])
    assert.deepStrictEqual(reasons("\\mathrm{Tr}^{2}(T_{ab}) = \\rho^2"), ["a script on the operator “\\mathrm{Tr}”, which is not supported"])
    assert.deepStrictEqual(reasons("\\operatorname{Tr}_{A} T_{ab} = \\rho"), ["a script on the operator “\\operatorname{Tr}”, which is not supported"])
  })

  test("named operators: a sign, a transcendental function, a numeral-base logarithm", () => {
    assert.strictEqual(rawRestored("\\operatorname{sgn}(t - x) = 1"), "\\operatorname{sgn}(t - \\frac{x}{c}) = 1")
    unchanged("\\text{sgn}(x) = 1")
    assert.deepStrictEqual(reasons("\\operatorname{sgn} t = 1"), [
      "the sign function “\\operatorname{sgn}” without a delimited argument, which is not supported",
    ])
    assert.strictEqual(rawRestored("\\operatorname{erf}(r/M) = 1"), "\\operatorname{erf}(rc^{2}/GM) = 1")
    // A power on the name is read as \sin^{2} is.
    assert.strictEqual(rawRestored("\\operatorname{erf}^{2}(r/M) = 1"), "\\operatorname{erf}^{2}(rc^{2}/GM) = 1")
    assert.strictEqual(rawRestored("\\log_{2}(r/M) = 1"), "\\log_{2}(rc^{2}/GM) = 1")
    assert.strictEqual(rawRestored("\\log_{10}(r/M) = 1"), "\\log_{10}(rc^{2}/GM) = 1")
    for (const tex of ["\\exp_{p}(k^{\\mu}) = x^{\\nu}", "\\log_{b} r = 1"]) {
      assert.deepStrictEqual(reasons(tex), ["a decorated function the engine cannot read"], tex)
    }
    // Any other operator is named; the starred form keeps the general reason.
    assert.deepStrictEqual(reasons("\\operatorname{diag}(-1,1,1,1) = g_{ab}"), [
      "the operator “\\operatorname{diag}”, which is not supported",
    ])
    assert.deepStrictEqual(reasons("\\operatorname*{argmax} r = 1"), ["an \\operatorname construct, which is not supported"])
    // The site's signature line, read past its operator, stops at its tuple
    // (the step-6 test that waited for the named operators).
    assert.deepStrictEqual(reasons("\\operatorname{sign}(g_{ab}) = (-,+,+,+)"), [
      "a comma inside brackets (function arguments, a tuple, a commutator, or an inner product), which the engine does not read as a product",
    ])
  })
})
