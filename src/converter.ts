// The numeric converter (census §2.9): an equivalence GRAPH through h, c, k_B —
// not a generator solve. {hc, h, ħ, k_B} share dimension directions and are not
// an independent basis; what relates eV to cm⁻¹ to K to nm is a set of edges,
// exactly one of which (E = hc/λ) is RECIPROCAL and carries the medium tag
// (census §5 round-3: air vs vacuum is 2.77×10⁻⁴ — orders of magnitude above
// line-list precision — and a wavelength without a declared medium does not
// convert; it declines).
//
// Constants are the SI-2019 exact values (vintage tag below): h, c, k_B, e are
// defining constants, so every factor here is exact by construction.

export const CONSTANT_VINTAGE = "SI-2019 (defining constants, exact)"

export const H = 6.62607015e-34 // J·s, exact
export const C = 299792458 // m/s, exact
export const KB = 1.380649e-23 // J/K, exact
export const E_CHARGE = 1.602176634e-19 // C, exact
export const HBAR = H / (2 * Math.PI)

/** Multiplicative energy-equivalent units: value × factor = energy in joule. */
const ENERGY_LIKE: Record<string, number> = {
  "J": 1,
  "eV": E_CHARGE,
  "meV": E_CHARGE * 1e-3,
  "keV": E_CHARGE * 1e3,
  "MeV": E_CHARGE * 1e6,
  "GeV": E_CHARGE * 1e9,
  "Hz": H, // E = hν — the ν edge
  "kHz": H * 1e3,
  "MHz": H * 1e6,
  "GHz": H * 1e9,
  "THz": H * 1e12,
  "rad/s": HBAR, // E = ħω — the ω edge; the 2π between ν and ω is these two rows
  "cm^-1": H * C * 100, // E = hc·ν̃ — the kayser edge
  "K": KB, // E = k_B T
}

/** Wavelength units: value × factor = metres. The reciprocal side of the graph. */
const WAVELENGTH: Record<string, number> = {
  "m": 1,
  "um": 1e-6,
  "nm": 1e-9,
  "Å": 1e-10,
}

export type Medium = "vacuum" | "air"

export type ConvertResult =
  | { kind: "converted"; value: number }
  | { kind: "declined"; reason: string }

export type ConvertOptions = {
  /** Required whenever a wavelength unit is involved. */
  medium?: Medium
  /** Refractive index of standard air at the working wavelength (Edlén/Ciddor). Required for medium "air". */
  airIndex?: number
}

export function knownUnits(): string[] {
  return [...Object.keys(ENERGY_LIKE), ...Object.keys(WAVELENGTH)]
}

/** λ_vacuum in metres from a wavelength quantity, honoring the medium tag. */
function toVacuumMetres(value: number, unit: string, opts: ConvertOptions): number | ConvertResult {
  const metres = value * WAVELENGTH[unit]
  if (opts.medium === undefined)
    return {
      kind: "declined",
      reason:
        "wavelength carries a medium tag (census §5 round-3: air vs vacuum is 2.77×10⁻⁴) — declare medium: \"vacuum\" or \"air\"",
    }
  if (opts.medium === "vacuum") return metres
  if (opts.airIndex === undefined)
    return {
      kind: "declined",
      reason:
        "medium \"air\" needs the refractive index of standard air at this wavelength (Edlén/Ciddor) — pass airIndex; it is wavelength-, T-, p- and humidity-dependent, so no default is honest",
    }
  return metres * opts.airIndex // λ_vac = n·λ_air
}

/**
 * Convert between any two energy-equivalent or wavelength units. Multiplicative
 * throughout except across the reciprocal edge E = hc/λ_vacuum.
 */
export function convert(
  value: number,
  from: string,
  to: string,
  opts: ConvertOptions = {},
): ConvertResult {
  const fromWave = from in WAVELENGTH
  const toWave = to in WAVELENGTH
  if (!fromWave && !(from in ENERGY_LIKE))
    return { kind: "declined", reason: `unknown unit "${from}"` }
  if (!toWave && !(to in ENERGY_LIKE))
    return { kind: "declined", reason: `unknown unit "${to}"` }

  if (!fromWave && !toWave)
    return { kind: "converted", value: (value * ENERGY_LIKE[from]) / ENERGY_LIKE[to] }

  if (fromWave && toWave) {
    // Same side of the reciprocal edge: still a length, but media may differ.
    const vac = toVacuumMetres(value, from, opts)
    if (typeof vac !== "number") return vac
    // Emit in the target unit as a VACUUM wavelength — re-tagging into air would
    // need the index at the target too; keep the output unambiguous.
    return { kind: "converted", value: vac / WAVELENGTH[to] }
  }

  if (fromWave) {
    const vac = toVacuumMetres(value, from, opts)
    if (typeof vac !== "number") return vac
    if (vac === 0) return { kind: "declined", reason: "zero wavelength has no energy equivalent" }
    const joule = (H * C) / vac // the reciprocal edge
    return { kind: "converted", value: joule / ENERGY_LIKE[to] }
  }

  // energy-like → wavelength
  const joule = value * ENERGY_LIKE[from]
  if (joule === 0) return { kind: "declined", reason: "zero energy has no wavelength equivalent" }
  if (opts.medium === undefined)
    return {
      kind: "declined",
      reason:
        "wavelength carries a medium tag (census §5 round-3) — declare medium: \"vacuum\" or \"air\"",
    }
  const vacMetres = (H * C) / joule
  if (opts.medium === "vacuum")
    return { kind: "converted", value: vacMetres / WAVELENGTH[to] }
  if (opts.airIndex === undefined)
    return {
      kind: "declined",
      reason: "medium \"air\" needs airIndex (Edlén/Ciddor) — no default is honest",
    }
  return { kind: "converted", value: vacMetres / opts.airIndex / WAVELENGTH[to] }
}
