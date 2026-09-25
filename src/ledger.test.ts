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
    assert.strictEqual(outcome("x = \\pm t").class, "translated")
    assert.strictEqual(outcome("\\mathrm{SL}(2,\\mathbb{R})").class, "refused")
    assert.strictEqual(outcome("G_{ab} + \\Lambda g_{ab} = {8\\pi G \\over c^{4}} T_{ab}").class, "reassembly")
    assert.strictEqual(outcome("r_s = \\frac{2M}").class, "parse")
    // A list item that is no statement; a list of statements is now read.
    assert.strictEqual(outcome("\\theta = 0, \\quad \\pi").class, "fragment")
    assert.strictEqual(outcome("E \\propto M").class, "proportional")
    assert.strictEqual(outcome("\\int \\sqrt{g}\\,R = M").class, "unsupported")
    assert.strictEqual(outcome("\\int \\rho \\, dV = M").class, "unchanged")
    assert.strictEqual(outcome("c = G = 1").class, "declaration")
    // A constant's numeric value is no declaration, but has as little to restore.
    assert.strictEqual(outcome("c = 299792458").class, "declaration")
    assert.strictEqual(outcome("c < 1").class, "declaration")
    assert.strictEqual(outcome("c > G").class, "declaration")
    // A statement of a list set against a bare 1 states it in unnamed units too.
    assert.strictEqual(outcome("M = 1,\\ r_s = 2M").class, "declaration")
    assert.strictEqual(outcome("E = m, \\qquad v \\ll 1").class, "declaration")
    // A constant term among quantities the registry reads otherwise is a
    // verdict on those readings, as a missing completion is.
    assert.strictEqual(outcome("g_{00} \\approx -c^2 - 2\\Phi").class, "no-completion")
    assert.strictEqual(outcome("a = b = c").class, "no-completion")
    assert.strictEqual(outcome("(r_s = 2M)").class, "unsupported") // a bar or relation inside a group is the reader's
    // A bare comma is not a statement separator.
    assert.strictEqual(outcome("r_s = 2M, T_H = 1").class, "fragment")
    // Two statements set side by side with spacing narrower than a quad
    // between them; a quad-wide run before something that is no statement.
    assert.strictEqual(outcome("t = 0 \\;\\;\\; r = 2M").class, "fragment")
    assert.strictEqual(outcome("r = 2M \\qquad (1)").class, "fragment")
    // An implication with a side that is no statement, or no side; a
    // continuation row after a list of statements.
    assert.strictEqual(outcome("r_s = 2M \\Rightarrow M").class, "fragment")
    assert.strictEqual(outcome("r_s = 2M \\Rightarrow").class, "fragment")
    assert.strictEqual(
      outcome("\\begin{aligned} r &= 2M, \\quad t = M \\\\ &= 0 \\end{aligned}").class,
      "fragment",
    )
    // A comma inside an expression other than brackets is the reader's.
    assert.strictEqual(outcome("x = \\frac{a, b}{c}").class, "unsupported")
    assert.strictEqual(outcome("\\sin(x").class, "parse")
    // An indexed component along θ or φ that carries a superscript: the angular guard.
    assert.strictEqual(outcome("\\Gamma^{\\mu}_{\\theta\\theta} = 0").class, "unsupported")
    // Upright words and letters, a run of letters under another font, a
    // placeholder constant, and a constant that would land inside a font are
    // the reader's; prose means the carrier was not one equation.
    assert.strictEqual(outcome("\\omega = 2\\pi\\,\\mathrm{Hz}").class, "unsupported")
    assert.strictEqual(outcome("x = {\\rm Tr A}").class, "unsupported")
    assert.strictEqual(outcome("r = 3\\,\\mathrm{m}").class, "unsupported")
    assert.strictEqual(outcome("E = \\mathit{eff}").class, "unsupported")
    assert.strictEqual(outcome("E = \\text{const.}").class, "unsupported")
    assert.strictEqual(outcome("E = {\\bf p + m}").class, "unsupported")
    assert.strictEqual(outcome("x = r \\quad \\text{for} \\quad r > 2M").class, "fragment")
    // A constant that would end an unparenthesized function argument is the
    // reader's construct; a restored equation that does not read back is a
    // reassembly fault (witnessed through a dictionary that reads c as a
    // dimensionless central charge).
    assert.strictEqual(outcome("x = r\\sin 2(\\sqrt{\\Lambda}t)").class, "unsupported")
    const centralCharge: typeof GR = {
      ...GR,
      bare: { ...GR.bare, c: { dim: [0, 0, 0, 0, 0], gloss: "central charge", si: "1" } },
    }
    assert.strictEqual(classifyOutcome(translateTex("E = m", katex, centralCharge, SI)).class, "reassembly")
    // Bars, sized delimiters, bra–kets and the constructs named as written are
    // the reader's; a row cut inside a delimiter pair is a parse problem.
    for (const tex of [
      "p(a|b) = 1",
      "|x|y|z| = r",
      "a|0\\rangle = 0",
      "P = |T_{ab}|",
      "p = x\\bigm| y",
      "{[}a,b{]} = 1",
      "x = 2!\\,r",
      "r(^{12}C) = 1",
      "E = \\bigl| p )",
      "E = \\boxed{m}",
    ]) {
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    }
    assert.strictEqual(outcome("E = \\bigl[p + m").class, "parse")
    // Relations nothing is restored across, a comma or a relation inside
    // brackets, a sign beside a branch sign and a sign label are the reader's;
    // a relation with an empty side and a bare sign pattern are not one equation.
    for (const tex of [
      "x \\to 2M",
      "r \\leftrightarrow M",
      "E = :Mc^2:",
      "r \\parallel M",
      "r \\mid M",
      "r \\not= 2M",
      "(u, v) = 0",
      "g_{00}(r \\to \\infty) = -1",
      "r = M \\pm -a",
      "x = X^{n+}",
      "\\begin{aligned} r &= 2M \\\\ &\\ne M \\end{aligned}",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    for (const tex of ["E = <p>", "E =", "= 2M", "(-+++)"]) assert.strictEqual(outcome(tex).class, "fragment", tex)
    // Batch-1 review fixes: a row opening at any relation and a statement
    // boundary before a sign are not one equation; a restyled constant, a
    // digit superscript beside an index, an evaluation bar and spacing before
    // an argument the engine cannot re-emit are the reader's; a numeral with
    // a power in it is a numeric value like any other.
    for (const tex of ["< r", "\\le r", "t = 0 \\;\\;\\; -r = 2M"]) assert.strictEqual(outcome(tex).class, "fragment", tex)
    for (const tex of [
      "E = m{\\bf c}^2",
      "x = \\mathcal{G} M",
      "\\Gamma^{2}_{00} = 0",
      "x = r\\sin\\left.M/t\\right|",
      "x = r\\sin\\left.M/t\\right|_{0}^{1}",
      "x = r\\sin\\hspace{2pt}(M/t)",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    assert.strictEqual(outcome("c = 3\\times10^{8}").class, "declaration")
    assert.strictEqual(outcome("r \\ne 2M").class, "translated")
    // Round 1: numerals a kern or a stripped constant kept apart, and a digit
    // superscript across a rider, are the reader's too.
    for (const tex of ["x = 3\\hspace{1pt}2 M", "R^{2}{}_{323} = 0", "R_{00}{}^{2} = 0"])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    const geometrized = classifyOutcome(translateTex("x = 2G3M", katex, GR, { system: "hl", geometrized: true }))
    assert.strictEqual(geometrized.class, "unsupported", geometrized.reason)
    // A primed symbol is looked up under its own name, and one the registry
    // lacks is an unknown symbol; a prime the engine cannot read as part of a
    // name, on a compound expression or mixed into a superscript, is the reader's.
    assert.strictEqual(outcome("x' = x").class, "unknown-symbol")
    assert.deepStrictEqual(outcome("x' = x").unknown, ["x'"])
    for (const tex of ["(r)' = 1", "x^{2\\prime} = r", "x'^{\\prime} = r"])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    // Step 11: a labelled symbol is looked up under its labelled name; the
    // readings of scripted bases, labels and named operators that decline are
    // the reader's.
    assert.strictEqual(outcome("u^{\\text{out}}_j = u_j").class, "unknown-symbol")
    for (const tex of [
      "h^{ij\\mathrm{TT}} = 0",
      "x = c^{\\dagger}",
      "\\dot{u}^{a} = u^{b}\\nabla_{b}u^{a}",
      "\\hat{g}_{ab} = 0",
      "\\hat{\\bar{h}}_{ab} = 0",
      "r = (r)^{+}",
      "\\operatorname{diag}(-1,1,1,1) = g_{ab}",
      "\\operatorname{Tr} = 1",
      "\\operatorname{sgn} t = 1",
      "\\mathrm{Tr}^{2}(T_{ab}) = \\rho",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    // Step 12: an index or a power on a group, a symbolic power, an exponent
    // or a superscript the engine does not read, and evaluation limits, points
    // and conditions are the reader's.
    for (const tex of [
      "z = \\left(\\frac{r}{M}\\right)^{\\alpha}",
      "x = \\Delta^{-s}r",
      "x = r^{1.5}",
      "x = r^{n}",
      "x = \\left[r\\right]_{0}^{R}",
      "x = \\left.r\\right|_{0}",
      "x = (r)_{2M}",
      "x = (r)_{r=0}",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    // Step 14: an upright d with nothing to act on and a differential of
    // symbolic order are the reader's; a d that is the symbol d is looked up.
    for (const tex of ["x = ({\\rm d})", "V = d^{n}x", "\\epsilon_{abcd} = \\sqrt{-r}\\;[abcd]"])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    // Step 15: a numeral on nothing that the notation does not attach, after a
    // factor without indices, after a derivative, or before a factor it may prescript.
    for (const tex of ["x = r{}^{2}", "\\partial_t{}^{2}\\phi = 0", "E = \\vec{p}{}^{2}c"])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    // Step 16: an integral, a limit or a determinant written in a way the
    // notation does not settle, and the operators the engine names but does not read.
    for (const tex of [
      "x = \\int_0^\\infty r",
      "x = \\oint\\frac{(r\\,d\\phi - r\\,d\\theta)}{r}",
      "\\Delta = \\int{\\cal D}\\phi\\, r",
      "x = \\int dt\\, v + r",
      "x = \\int_{r>2M} dr",
      "x = \\int_{2M} dr",
      "x = \\int_{x=0}^{r} dr",
      "x = \\int_{2M}^{r}\\int_{0}^{\\pi} dr\\, d\\theta",
      "x = \\int dz",
      "\\tau = \\int d\\lambda",
      "x = \\int d^{-1}x",
      "x = \\int d\\mathbf{x}",
      "x = \\int dt^{2}",
      "x = \\int r / dr",
      "x = \\sin\\theta\\int dr",
      "S = \\int -2r\\,dt",
      "E = \\int' dr",
      "E = \\lim_{r} M",
      "\\theta = \\lim_{r\\to 2M}",
      "g = \\det(T_{ab})",
      "E = \\det g\\, M",
      "g = \\det_{3}(g_{ab})",
      "\\Phi = \\sqrt{\\frac{M\\det(g_{ab})}{r}}",
      "M = \\prod_{i} M",
      "x = \\max_{t} r",
      "x = \\coprod_i r",
      "x = \\mathop{\\rm lim}_{t} r",
      "x = \\mathop{\\sum_{i}}_{j} r",
      "\\rho = \\mathop{\\rm Tr}\\limits T_{ab}",
      "x \\stackrel{(1)}{=} r",
      "x = \\displaystyle\\int_{0}^{r} dr",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    assert.deepStrictEqual(outcome("v = H_0\\,d").unknown, ["d"])
    // Step 17: a summation index the range does not declare, read where the
    // sum may not reach it, or in a superscript; a range that is not index
    // values; a fixed symbol whose subscript the sum runs over; and an index
    // named as a constant.
    for (const tex of [
      "x = \\sum_{c=1}^{3} c\\,r",
      "r = \\sum_{m} \\frac{M}{m^2}",
      "r = \\sum_{n} M + n",
      "M = \\sum_{k=0}^{\\infty}x^{k}",
      "r = \\sum_{k} dk",
      "E = \\sum_{k=0}^{3} k_{\\mu}",
      "r_s = \\sum_{s} r_s",
      "r = \\sum_{n=0}^{M} r",
      "r = \\sum_{j=0\\atop j\\neq k} r",
      "r = \\sum_{\\bm{k}} r",
    ])
      assert.strictEqual(outcome(tex).class, "unsupported", tex)
    assert.strictEqual(outcome("x = \\sum_i r").class, "unchanged")
  })
  test("derivative marks: every reason the split gives is a construct the reader does not handle", () => {
    // Step 18, under a hub that declares both marks (GR declares none).
    const marks = { ...GR, derivativeMarks: { ";": "\\nabla", ",": "\\partial" } }
    for (const tex of [
      "g_{ab,r} = 0",
      "T_{ab;} = 0",
      "T_{ab;2} = 0",
      "T^{ab;c} = 0",
      "x = x'_{,i}",
      "h_{\\nu\\alpha,\\mu}{}^{\\alpha} = 0",
      "\\Phi_{,i}{}_{i} = 0",
      "\\Phi_{,i}{}^{2} = 0",
      "h_{\\mu\\nu,\\alpha}^{\\ \\ \\ \\ \\ \\ \\alpha} = 0",
      "\\Gamma_{00,i}^{i} = 0",
      "h^{\\ \\ \\ \\ \\ \\ \\alpha}_{\\mu\\nu,\\alpha} = 0",
      "{T^{\\ \\ c}}_{ab;c} = 0",
    ])
      assert.strictEqual(classifyOutcome(translateTex(tex, katex, marks, SI)).class, "unsupported", tex)
    for (const tex of ["\\Phi_{,ii} = 4\\pi\\rho", "T^{ab}{}_{;b} = 0"]) assert.strictEqual(outcome(tex).class, "unsupported", tex)
    assert.strictEqual(outcome("V_{m,n} = 0").class, "unknown-symbol")
  })
  test("nothing the engine says on these pages lands outside the classes", () => {
    // Every wording the engine used on the corpus (scripts/ledger.ts, 2026-09-11)
    // maps to a class; a reworded reason would surface as "other" here.
    for (const tex of ["r_s = 2M", "r_s = \\frac{2M}", "E \\propto M", "\\int \\rho \\, dV = M", "r' = 2M", "a = b = c"])
      assert.notStrictEqual(outcome(tex).class, "other", tex)
  })
  test("a no-completion decline that also names unknown symbols is an unknown-symbol case", () => {
    // The completion cannot be judged around symbols the registry cannot read,
    // and the engine no longer tries: the unknowns are the whole reason.
    const o = outcome("\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}")
    assert.strictEqual(o.class, "unknown-symbol")
    assert.strictEqual(o.reason, "")
    // A clash among terms the registry reads still names its term beside the unknowns.
    const clash = outcome("r = \\theta + \\xi")
    assert.strictEqual(clash.class, "unknown-symbol")
    assert.ok(/no c–G completion/.test(clash.reason))
  })
  test("a reassembly fault withheld from the reader for unknown symbols still stands in the ledger", () => {
    const result = translateTex("\\chi = {8\\pi G \\over c^{4}} T_{ab}", katex, GR, SI)
    assert.ok(result.kind === "declined" && result.reasons.length === 0 && result.fault != null)
    const o = classifyOutcome(result)
    assert.strictEqual(o.class, "reassembly")
    assert.ok(/reassembly fault/.test(o.reason))
    assert.deepStrictEqual(o.unknown, ["\\chi"])
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
