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

export type UnverifiableTag = { key: string; declaredOn: "left" | "right" }

export type CombineReport = {
  /** False iff any shared key disagrees. */
  combinable: boolean
  conflicts: TagConflict[]
  /** Keys present on exactly one side: not a bar, but the honest caveat — with the side named. */
  unverifiable: UnverifiableTag[]
}

export type CombineOptions = {
  /**
   * strict: a key declared on only one side also bars combination — the
   * conservative reading of §2.13(a)'s "never combine values whose tags
   * differ" when one side's tag state is unknowable. Default false: report
   * as unverifiable, leave the call to the consumer.
   */
  strict?: boolean
}

/** The §2.13(a) lint: refuse to combine quantities whose identity tags differ. */
export function checkCombinable(a: Tagged, b: Tagged, opts: CombineOptions = {}): CombineReport {
  const conflicts: TagConflict[] = []
  const unverifiable: UnverifiableTag[] = []
  // Own-key discipline: an inherited prototype property must never fabricate a
  // tag ("constructor", "toString" — real hazard with plain-object tag maps).
  const keys = new Set([...Object.keys(a.tags), ...Object.keys(b.tags)])
  for (const key of [...keys].sort()) {
    const hasLeft = Object.hasOwn(a.tags, key)
    const hasRight = Object.hasOwn(b.tags, key)
    if (hasLeft && hasRight) {
      if (a.tags[key] !== b.tags[key])
        conflicts.push({ key, left: a.tags[key], right: b.tags[key] })
    } else {
      unverifiable.push({ key, declaredOn: hasLeft ? "left" : "right" })
    }
  }
  const combinable = opts.strict
    ? conflicts.length === 0 && unverifiable.length === 0
    : conflicts.length === 0
  return { combinable, conflicts, unverifiable }
}

/** Render a report as decline-vocabulary text (empty string when fully clean). */
export function describeReport(r: CombineReport, aTex = "left", bTex = "right"): string {
  const parts: string[] = []
  for (const c of r.conflicts)
    parts.push(`identity conflict on ${c.key}: ${aTex} is ${c.left}, ${bTex} is ${c.right} — convert or refuse`)
  for (const u of r.unverifiable)
    parts.push(
      `unverifiable: ${u.key} declared only on ${u.declaredOn === "left" ? aTex : bTex}`,
    )
  return parts.join("; ")
}
