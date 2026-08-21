// The sign-convention axis (census §2.12, extended §2.13(d)) — orthogonal to
// units, sharing nothing with the dimensional solve, which is signature-blind
// by construction.
//
// Round-4 rulings carried here:
//  - every convention switch is THREE-valued (census C15): determined,
//    undetermined, or absent — a defaulted signature tag on a paper with no
//    metric is a fabrication;
//  - the Levi-Civita slot is typed by index position (census C18): in 4D
//    Lorentzian, ε^{0123} = −ε_{0123} under either signature, so a bare "±1"
//    is under-specified and silently inverts every dual tensor;
//  - Euclidean sources are tagged, never continued (census §2.12/§7); the
//    notational-ict translation is specified (i-carrying component riders)
//    but deliberately v2.

// ---------------------------------------------------------------------------
// Three-valued switches (census C15) — shared by every convention axis.
// ---------------------------------------------------------------------------

export type SwitchState<T> =
  | { state: "determined"; value: T }
  | { state: "undetermined" }
  | { state: "absent" }

export const determined = <T>(value: T): SwitchState<T> => ({ state: "determined", value })
export const UNDETERMINED = { state: "undetermined" } as const
export const ABSENT = { state: "absent" } as const

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

export type Signature = "mostly-plus" | "mostly-minus" | "ict" | "euclidean"

/** ε with its index position — the C18 typed slot. */
export type LeviCivita = { value: "+1" | "-1"; indexPosition: "upper" | "lower" }

export type SignConventionRecord = {
  signature: SwitchState<Signature>
  /** Sign convention of the Riemann tensor (MTW [S2]). */
  riemannSign: SwitchState<"+1" | "-1">
  /** Sign of the Ricci contraction R_{μν} = ±R^α_{μαν} — MTW [S2][S3], not [S3] alone. */
  ricciSign: SwitchState<"+1" | "-1">
  leviCivita: SwitchState<LeviCivita>
  /** D_μ = ∂_μ ∓ ieA_μ: the sign written on the coupling. */
  chargeSign: SwitchState<"+" | "-">
  /** Time-domain Fourier kernel: e^{∓iωt}. */
  fourierSign: SwitchState<"+" | "-">
}

/** The honest starting state for a document that has declared nothing. */
export const UNSTAMPED: Readonly<SignConventionRecord> = Object.freeze({
  signature: ABSENT,
  riemannSign: ABSENT,
  ricciSign: ABSENT,
  leviCivita: ABSENT,
  chargeSign: ABSENT,
  fourierSign: ABSENT,
})

// ---------------------------------------------------------------------------
// Real-signature translation: the contraction-parity rule (census §2.12).
// Bosonic sector only — γ-matrix conventions are riders, not parity-derivable.
// ---------------------------------------------------------------------------

/** Under η → −η a term picks up one inverse metric per full contraction. */
export function contractionParity(contractions: number): 1 | -1 {
  if (!Number.isInteger(contractions) || contractions < 0)
    throw new Error(`contraction count must be a non-negative integer, got ${contractions}`)
  return contractions % 2 === 0 ? 1 : -1
}

export type SignatureTranslation =
  | { kind: "identity" }
  | {
      kind: "mechanical"
      /** Sign a bosonic term picks up, by its number of full contractions. */
      termSign: (contractions: number) => 1 | -1
      caveat: "bosonic sector only; fermion bilinears need the γ-convention riders (census §2.12)"
    }
  | { kind: "refuse"; reason: string }
  | { kind: "unimplemented"; reason: string }

export function signatureTranslation(from: Signature, to: Signature): SignatureTranslation {
  if (from === to) return { kind: "identity" }
  if (from === "euclidean" || to === "euclidean")
    return {
      kind: "refuse",
      reason:
        "Wick-rotated Euclidean field theory is an analytically continued formulation, not a notation — tag the source Euclidean, never continue it (census §2.12, §7)",
    }
  if (from === "ict" || to === "ict")
    return {
      kind: "unimplemented",
      reason:
        "notational ict translates via i-carrying component riders (A₄ = iφ, F₄ₖ = iEₖ) — specified in census §2.12, deliberately v2",
    }
  return {
    kind: "mechanical",
    termSign: contractionParity,
    caveat: "bosonic sector only; fermion bilinears need the γ-convention riders (census §2.12)",
  }
}

/**
 * Normalize a declared ε to its LOWERED value (C18). ε^{μνρσ} = det(g⁻¹)·ε_{αβγδ}
 * with matching numerals: in 4D Lorentzian det g < 0, so ε^{0123} = −ε_{0123}
 * under BOTH real signatures — the index position, not the signature, decides
 * the flip. In 4D Euclidean det g > 0 and there is no flip. ict is v2.
 */
export function leviCivitaLowered(declared: LeviCivita, signature: Signature): "+1" | "-1" {
  if (signature === "ict")
    throw new Error("leviCivitaLowered: notational ict is v2 (census §2.12)")
  if (declared.indexPosition === "lower") return declared.value
  if (signature === "euclidean") return declared.value
  return declared.value === "+1" ? "-1" : "+1"
}
