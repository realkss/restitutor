// The bridge between the production engine (src/unitsEngine.ts, vendored by
// the site, frozen) and the convention layer (src/convention.ts, the census's
// data model). The engine keeps its own solver; this module maps its world
// onto Convention objects so the two can be cross-validated and so surfaces
// can show the convention-layer diagnosis for whatever target the engine is
// translating into.
import type { Dim, HubRegistry, RegEntry, TargetSpec, UnitSystem } from "./unitsEngine"
import type { DetectionReport } from "./detect"
import type { MinedSymbol } from "./mine"
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

/** The engine's own constants and pure numbers: a page never re-reads these. */
const ENGINE_CONSTANTS = new Set(["c", "G", "\\hbar", "k_B", "\\pi", "i", "e", "\\infty"])

/** A subscript made only of Greek macros and single letters is a run of indices (g_{\mu\nu}), not an identity (m_1, H_0). */
const INDEX_LIKE = /^(?:\\[a-zA-Z]+|[a-zA-Z]){1,4}$/

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
    const dim = dimQToDim(s.dim)
    if (!dim) continue
    const gloss =
      s.noun.noun +
      (s.registry ? ` (declared in the text; the registry reads ${s.registry.gloss})` : " (declared in the text)")
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
