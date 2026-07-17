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
