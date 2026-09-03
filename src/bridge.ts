// The bridge between the production engine (src/unitsEngine.ts, vendored by
// the site, frozen) and the convention layer (src/convention.ts, the census's
// data model). The engine keeps its own solver; this module maps its world
// onto Convention objects so the two can be cross-validated and so surfaces
// can show the convention-layer diagnosis for whatever target the engine is
// translating into.
import type { Dim, HubRegistry, RegEntry, TargetSpec, UnitSystem } from "./unitsEngine"
import { dimensionOf } from "./unitsEngine"
import type { DetectionReport } from "./detect"
import type { MinedDefinition, MinedSymbol } from "./mine"
import { EM_FLAVOR } from "./rendering"
import { CONVENTIONS, Convention, DimQ, Frac } from "./convention"

/**
 * Engine dimensions are integer TWELFTHS over (M, L, T, Θ, I) — exact for the
 * powers that occur (halves from \sqrt, thirds from cube roots). Convert to
 * the convention layer's rationals exactly.
 */
export function dimToDimQ(d: Dim): DimQ {
  return d.map((n) => new Frac(BigInt(n), 12n)) as DimQ
}

/** The other way: engine twelfths, or null where an exponent is not a multiple of 1/12. */
export function dimQToDim(d: DimQ): Dim | null {
  const out: number[] = []
  for (const f of d) {
    const num = f.n * 12n
    if (num % f.d !== 0n) return null
    out.push(Number(num / f.d))
  }
  return out as Dim
}

const sameDim = (a: Dim, b: Dim) => a.every((x, i) => x === b[i])

/** The registry's glosses carry their rationale after a dash, a comma or a parenthesis; a legend needs the reading only. */
const shortGloss = (g: string) => g.split(/\s+[—–]\s+|,\s|\s\(/)[0]

/** The engine's own constants and pure numbers: a page never re-reads these. */
const ENGINE_CONSTANTS = new Set(["c", "G", "\\hbar", "k_B", "\\pi", "i", "e", "\\infty"])

/**
 * A subscript made only of Greek macros and the engine's Latin index letters
 * (a–k) is a run of indices (g_{\mu\nu}, T_{ab}), not an identity (m_1, H_0,
 * R_s — the engine declines R_s rather than reading it as an indexed R).
 */
export const INDEX_LIKE = /^(?:\\[a-zA-Z]+|[a-k]){1,4}$/

/**
 * The registry extended by what the page declares (census §6.5): "where Σ
 * is the surface density" gives Σ a reading the registry lacked, and "m is
 * the comoving separation" overrides the registry's mass — the declaration
 * wins, and the legend says so in the gloss. A reading the registry already
 * holds adds nothing; the engine's own constants are never re-read; a
 * subscripted symbol is an exact reading (and, for an index-like subscript,
 * the base's indexed reading). The input registry is never mutated.
 */
export function registryWithDeclarations(reg: HubRegistry, symbols: MinedSymbol[]): HubRegistry {
  const bare = { ...reg.bare }
  const exact = { ...reg.exact }
  const indexed = { ...reg.indexed }
  let changed = false
  const place = (table: Record<string, RegEntry>, key: string, entry: RegEntry) => {
    const prior = table[key]
    if (prior && sameDim(prior.dim, entry.dim)) return
    table[key] = entry
    changed = true
  }
  for (const s of symbols) {
    if (ENGINE_CONSTANTS.has(s.symbol)) continue
    // A reading the text has not pinned down is not a registry reading: an
    // ambiguous noun ("density", "flux") or one whose dimension depends on
    // the spatial dimension stays in the Symbols card with its caveat.
    if (s.caveat === "ambiguous" || s.caveat === "depends-on-d") continue
    const dim = dimQToDim(s.dim)
    if (!dim) continue
    const gloss =
      s.noun.noun +
      (s.registry ? ` (declared in the text; the registry reads ${shortGloss(s.registry.gloss)})` : " (declared in the text)")
    const entry: RegEntry = { dim, gloss, si: s.noun.si }
    const m = /^(.+?)_(?:\{([^{}]*)\}|(\\?[A-Za-z0-9]+))$/.exec(s.symbol.replace(/\^.*$/, ""))
    if (m) {
      const base = m[1]
      const sub = (m[2] ?? m[3] ?? "").replace(/[{}\s]/g, "")
      place(exact, `${base}_${sub}`, entry)
      if (INDEX_LIKE.test(sub)) place(indexed, base, entry)
    } else {
      place(bare, s.symbol, entry)
    }
  }
  return changed ? { ...reg, bare, exact, indexed } : reg
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }
const sup = (n: string) => n.split("").map((ch) => SUP[ch] ?? ch).join("")

/** The SI unit string of an engine dimension, in the registry's own style ("kg⁻¹ m⁻¹ s²"). */
export function siUnitOf(d: Dim): string {
  const parts: string[] = []
  const bases = ["kg", "m", "s", "K", "A"]
  d.forEach((e12, i) => {
    if (e12 === 0) return
    if (e12 % 12 === 0) parts.push(e12 === 12 ? bases[i] : bases[i] + sup(String(e12 / 12)))
    else {
      const g = gcd(Math.abs(e12), 12)
      parts.push(`${bases[i]}^(${e12 / g}/${12 / g})`)
    }
  })
  return parts.length ? parts.join(" ") : "1"
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

type Katex = { __parse: (tex: string, options?: Record<string, unknown>) => any[] }

const LHS_SYMBOL = /^\s*(\\?[A-Za-z]+(?:_(?:\{[^{}]*\}|\\?[A-Za-z0-9]+))?(?:\^(?:\{[^{}]*\}|[A-Za-z0-9]))?)\s*=(?!=)\s*([\s\S]+)$/
const NEXT_RELATION = /\\(?:approx|simeq|sim|le|ge|leq|geq|neq|ne|equiv|propto)(?![A-Za-z])|[<>=]|≈|≃|≤|≥/

/**
 * Definitions read off the page's equations (census §6.5, "the printed
 * defining expression"): a display equation whose left side is one symbol
 * and whose right side is built from the registry's CONSTANTS alone
 * ("κ = 8πG/c⁴ ≈ 2.07665 × 10⁻⁴³ N⁻¹") defines a derived constant. An
 * equation with variables on the right (E = mc²) is physics, not a
 * definition, and is left to the translator.
 */
export function definitionsFromEquations(equations: string[], reg: HubRegistry, katex: Katex): MinedDefinition[] {
  const out: MinedDefinition[] = []
  const seen = new Set<string>()
  for (const raw of equations) {
    const m = LHS_SYMBOL.exec(raw.replace(/\\displaystyle|\\textstyle/g, "").trim())
    if (!m) continue
    const symbol = m[1].replace(/\s+/g, "")
    if (seen.has(symbol) || ENGINE_CONSTANTS.has(symbol)) continue
    let rhs = m[2]
    const cut = rhs.search(NEXT_RELATION)
    if (cut >= 0) rhs = rhs.slice(0, cut)
    rhs = rhs.replace(/[\s,.;]+$/, "").trim()
    if (!rhs) continue
    const r = dimensionOf(rhs, katex, reg)
    if (r.kind !== "dim" || r.dim.every((x) => x === 0)) continue
    if (!r.legend.every((e) => ENGINE_CONSTANTS.has(e.tex))) continue
    seen.add(symbol)
    out.push({ symbol, expr: rhs, sentence: raw.slice(0, 200) })
  }
  return out
}

/**
 * Definitions feeding the registry (census §6.5, the definitions path): a
 * symbol the page DEFINES by an expression ("κ = 8πG/c⁴") takes that
 * expression's dimension under the registry's own readings, computed by the
 * engine — exact where a gloss could only be read, and available where no
 * gloss resolves at all. Definitions apply in page order, so a later one
 * may use an earlier one; a dimensionless definition (a ratio) belongs to no
 * unit axis and is left alone; the engine's constants are never redefined.
 */
export function registryWithDefinitions(
  reg: HubRegistry,
  report: { symbols: MinedSymbol[]; definitions: MinedDefinition[] },
  katex: Katex,
): HubRegistry {
  const defs = [
    ...report.symbols.filter((s) => s.expr).map((s) => ({ symbol: s.symbol, expr: s.expr! })),
    ...report.definitions.map((d) => ({ symbol: d.symbol, expr: d.expr })),
  ]
  let out = reg
  for (const d of defs) {
    if (ENGINE_CONSTANTS.has(d.symbol) || /^\s*1\s*$/.test(d.expr)) continue
    const r = dimensionOf(d.expr, katex, out)
    if (r.kind !== "dim" || r.dim.every((x) => x === 0)) continue
    const bare = { ...out.bare }
    const exact = { ...out.exact }
    const indexed = { ...out.indexed }
    let changed = false
    const place = (table: Record<string, RegEntry>, key: string, prior: RegEntry | undefined) => {
      if (prior && sameDim(prior.dim, r.dim)) return
      const gloss = "defined in the text" + (prior ? `; the registry reads ${shortGloss(prior.gloss)}` : "")
      table[key] = { dim: r.dim, gloss, si: siUnitOf(r.dim) }
      changed = true
    }
    const m = /^(.+?)_(?:\{([^{}]*)\}|(\\?[A-Za-z0-9]+))$/.exec(d.symbol.replace(/\^.*$/, ""))
    if (m) {
      const base = m[1]
      const sub = (m[2] ?? m[3] ?? "").replace(/[{}\s]/g, "")
      place(exact, `${base}_${sub}`, exact[`${base}_${sub}`])
      if (INDEX_LIKE.test(sub)) place(indexed, base, indexed[base])
    } else place(bare, d.symbol, bare[d.symbol])
    if (changed) out = { ...out, bare, exact, indexed }
  }
  return out
}

/**
 * The engine's six translation targets, mapped to their encoded conventions.
 * The engine's source is always the GR registry's own convention (geometrized,
 * G = c = 1 with ħ and k_B kept explicit).
 */
export function conventionKeyForTarget(spec: TargetSpec): string {
  if (spec.geometrized) {
    return { hl: "geometrized-hl", si: "geometrized", gaussian: "geometrized-gaussian" }[
      spec.system
    ]
  }
  return { hl: "heaviside-lorentz", si: "si", gaussian: "gaussian" }[spec.system]
}

export function conventionForTarget(spec: TargetSpec): Convention {
  return CONVENTIONS[conventionKeyForTarget(spec)]
}

/** The GR registry's source convention. */
export const SOURCE_CONVENTION_KEY = "geometrized"

/**
 * What a detection report says about the translate target — and only what
 * EVERY surviving candidate agrees on. A row reads as geometrized when it
 * declares both c and G as unit generators; its E&M system comes from its
 * determined flavor (esu/emu render as the Gaussian target). Rows with no
 * determined flavor say nothing about the system, and one dissenting row
 * withholds that axis entirely: a set is never collapsed to a guess.
 */
export function targetFromDetection(report: DetectionReport): Partial<TargetSpec> {
  if (report.kind !== "narrowed" || report.sets.length === 0) return {}
  const keys = report.sets[0]
  const geomOf = (k: string) => {
    const gens = CONVENTIONS[k].generators.filter((g) => g.role !== "inserted" && g.numericFactor === "1")
    return gens.some((g) => g.tex === "c") && gens.some((g) => g.tex === "G")
  }
  const systemOf = (k: string): UnitSystem | null => {
    const f = EM_FLAVOR[k]
    if (!f || f.length !== 1) return null
    return ({ si: "si", gaussian: "gaussian", esu: "gaussian", emu: "gaussian", "heaviside-lorentz": "hl" } as const)[f[0]]
  }
  const out: Partial<TargetSpec> = {}
  const geoms = new Set(keys.map(geomOf))
  if (geoms.size === 1) out.geometrized = [...geoms][0]
  // Rows with no determined flavor (mechanical rows kept by an E&M sentence)
  // have no opinion on the system; they abstain rather than dissent.
  const systems = keys.map(systemOf).filter((s): s is UnitSystem => s !== null)
  if (systems.length > 0 && new Set(systems).size === 1) out.system = systems[0]
  return out
}
