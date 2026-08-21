// The bridge between the production engine (src/unitsEngine.ts, vendored by
// the site, frozen) and the convention layer (src/convention.ts, the census's
// data model). The engine keeps its own solver; this module maps its world
// onto Convention objects so the two can be cross-validated and so surfaces
// can show the convention-layer diagnosis for whatever target the engine is
// translating into.
import type { Dim, TargetSpec } from "./unitsEngine"
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
