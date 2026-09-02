// The bridge between the production engine (src/unitsEngine.ts, vendored by
// the site, frozen) and the convention layer (src/convention.ts, the census's
// data model). The engine keeps its own solver; this module maps its world
// onto Convention objects so the two can be cross-validated and so surfaces
// can show the convention-layer diagnosis for whatever target the engine is
// translating into.
import type { Dim, TargetSpec, UnitSystem } from "./unitsEngine"
import type { DetectionReport } from "./detect"
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
