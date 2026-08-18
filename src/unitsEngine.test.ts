import test, { describe } from "node:test"
import assert from "node:assert"
import katexDefault from "katex"
import { TargetSpec, TranslationResult, findRegistryForSlug, translateTex } from "./unitsEngine"

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

  test("F9: a bare | is declined as a delimiter, not as an unknown symbol", () => {
    const result = run("E = m|v|")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      assert.deepStrictEqual(result.unknown, [], "| is a delimiter, never a dictionary miss")
      assert.ok(
        result.reasons.some((r) => r.includes("delimiter")),
        JSON.stringify(result.reasons),
      )
    }
  })

  test("the reassembly backstop covers mutating translations, not just no-ops", () => {
    // supsubTex always writes the subscript first, so `p^a_b` re-emits as
    // `p_{b}^{a}`. With a constant to insert, that rewrite used to ride out
    // unchecked (`E = 2p^a_b` shipped as `E = 2p_{b}^{a}c`); replaying the
    // emission with the insertion masked makes it visible, and declining is the
    // contract-correct outcome.
    const result = run("E = 2p^a_b")
    assert.strictEqual(result.kind, "declined", JSON.stringify(result))
    if (result.kind === "declined") {
      assert.ok(
        result.reasons.some((r) => r.includes("reassembly fault")),
        JSON.stringify(result.reasons),
      )
    }
    // The same equation without anything to insert already declined, and still does.
    assert.strictEqual(run("p^a_b = 0").kind, "declined")
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
