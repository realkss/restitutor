// The unit-contract detector (census §2.13(b), with the round-4 C38 recall
// repair): pheno "plug-in" master formulas are DELIBERATELY dimensionally
// inhomogeneous — a bare decimal prefactor is a power of (ħ, c, e) in the
// bracketed unit contract. A linter must not flag them; a restorer must not
// restore on top (double-restoring the oscillation phase errs by ~10⁹).
// Detection keys on the bare decimal against this curated table, because
// bracket markup is unstable inside real documents (1.267 bare, 2.48
// parenthesised, 7.56×10⁻⁵ [eV²] bracketed).

export type ContractConstant = {
  value: number
  /**
   * Relative tolerance for recognition — the PRINTED-TRUNCATION width, not the
   * CODATA width: the table exists to catch the rounded literals papers print
   * (1.27, 0.2998, 197.3), so each window is ~half a unit in the last digit of
   * the shortest form seen in the literature. Deliberate exclusion: a bare
   * "0.3" never matches c/10⁹ (false-positive risk beats the recall).
   */
  tolerance: number
  /** What the decimal IS, as physics. */
  meaning: string
  /** The unit contract the formula's bracketed slots declare. */
  contract: string
  /** The formula family it fingerprints. */
  fingerprint: string
}

export const CONTRACT_CONSTANTS: ContractConstant[] = [
  {
    value: 1.2669327,
    tolerance: 3e-3, // catches the ubiquitous 1.27
    meaning: "1/(4ħc)",
    contract: "Δm²[eV²] · L[km] / E[GeV] → radians",
    fingerprint: "neutrino oscillation phase: sin²(1.27 Δm² L / E)",
  },
  {
    value: 0.299792458,
    tolerance: 1e-4, // catches 0.2998 and 0.29979; a bare 0.3 stays out
    meaning: "c / 10⁹",
    contract: "p[GeV/c] = 0.2998 · B[T] · R[m]",
    fingerprint: "magnetic rigidity",
  },
  {
    value: 0.3893793721,
    tolerance: 2e-4, // catches 0.3894
    meaning: "(ħc)²",
    contract: "GeV² · mbarn",
    fingerprint: "cross-section conversion σ = 0.3894 |M|²/s …",
  },
  {
    value: 197.3269804,
    tolerance: 2e-4, // catches 197.33 and 197.3
    meaning: "ħc",
    contract: "MeV · fm",
    fingerprint: "the ħc bridge itself",
  },
  {
    value: 6.582119569e-25,
    tolerance: 1e-4, // catches 6.582e-25
    meaning: "ħ",
    contract: "GeV · s",
    fingerprint: "width ↔ lifetime: τ = ħ/Γ",
  },
  {
    value: 1239.84198,
    tolerance: 2e-4, // catches 1239.84 and the common 1240
    meaning: "hc",
    contract: "eV · nm",
    fingerprint: "photon energy E = 1239.84/λ",
  },
]

export type ContractMatch =
  | {
      kind: "unit-contract"
      constant: ContractConstant
      /**
       * The census ruling: tag the equation, SUPPRESS dimensional lint on it,
       * and never restore constants on top of the baked prefactor.
       */
      ruling: "suppress-lint-and-restoration"
    }
  | { kind: "no-match" }

/** Recognize a bare decimal as a known unit-contract prefactor. */
export function recognizeContractConstant(x: number): ContractMatch {
  const ax = Math.abs(x)
  for (const constant of CONTRACT_CONSTANTS) {
    if (Math.abs(ax - constant.value) / constant.value <= constant.tolerance) {
      return { kind: "unit-contract", constant, ruling: "suppress-lint-and-restoration" }
    }
  }
  return { kind: "no-match" }
}
