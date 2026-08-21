// The identity-metadata layer (census §2.13(a), round 4): same symbol, same
// dimension, different quantity. A typed tag vector attached to symbols and
// numbers, with the lint "never combine values whose tags differ — convert or
// refuse."
//
// Round-4 rulings carried here:
//  - the vector is OPEN (census C04): the well-known keys below are guidance,
//    not an enum — a DFT paper needs xc-functional and double-counting slots
//    the census never enumerated, so unknown keys are first-class;
//  - calibration-stipulation is its own provenance kind, distinct from
//    metrological vintage (census C110): a stipulated, contested input
//    (lattice r₀ ≡ 0.5 fm) is neither a measurement nor an epoch;
//  - a key present on one side only is UNVERIFIABLE, not a conflict — the
//    three-valued discipline of census C15 applied to combination.

export const KNOWN_TAG_KEYS = [
  "kind", // K_RJ vs K_CMB vs T_A; SNR-kind; effective-mass sense
  "scheme", // pole vs MS-bar vs 1S; Hubbard-U scheme
  "scale", // renormalization scale μ; n_f; loop order
  "frame", // source vs detector; coordinate vs fluid-comoving vs LNRF
  "averaging", // sky/polarization/inclination state; ⟨·⟩ operator and window
  "reference-basis", // per-spin / per-valley / per-formula-unit; field- vs power-referenced
  "medium", // air vs vacuum wavelength
  "gauge", // Bloch-sum convention I/II; length vs velocity gauge
  "branch", // modulo-quantum branch choice
  "vintage", // CODATA year; ITS-90 vs IPTS-68; kX factor era
  "uncertainty-semantics", // probable error vs k=1 vs k=2 vs PDG-scaled
  "calibration-stipulation", // r₀ ≡ 0.5 fm and kin — stipulated, not measured
] as const

/** OPEN tag vector: well-known keys above, arbitrary further keys welcome. */
export type IdentityTags = Readonly<Record<string, string>>

export type Tagged = {
  /** Optional display TeX for messages. */
  tex?: string
  tags: IdentityTags
}

export type TagConflict = { key: string; left: string; right: string }

export type CombineReport = {
  /** False iff any shared key disagrees. */
  combinable: boolean
  conflicts: TagConflict[]
  /** Keys present on exactly one side: not a bar, but the honest caveat. */
  unverifiable: string[]
}

/** The §2.13(a) lint: refuse to combine quantities whose identity tags differ. */
export function checkCombinable(a: Tagged, b: Tagged): CombineReport {
  const conflicts: TagConflict[] = []
  const unverifiable: string[] = []
  const keys = new Set([...Object.keys(a.tags), ...Object.keys(b.tags)])
  for (const key of [...keys].sort()) {
    const left = a.tags[key]
    const right = b.tags[key]
    if (left !== undefined && right !== undefined) {
      if (left !== right) conflicts.push({ key, left, right })
    } else {
      unverifiable.push(key)
    }
  }
  return { combinable: conflicts.length === 0, conflicts, unverifiable }
}

/** Render a report as decline-vocabulary text (empty string when fully clean). */
export function describeReport(r: CombineReport, aTex = "left", bTex = "right"): string {
  const parts: string[] = []
  for (const c of r.conflicts)
    parts.push(`identity conflict on ${c.key}: ${aTex} is ${c.left}, ${bTex} is ${c.right} — convert or refuse`)
  if (r.unverifiable.length)
    parts.push(`unverifiable: ${r.unverifiable.join(", ")} declared on one side only`)
  return parts.join("; ")
}
