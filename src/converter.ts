// The numeric converter (census §2.9): an equivalence GRAPH through h, c, k_B —
// not a generator solve. {hc, h, ħ, k_B} share dimension directions and are not
// an independent basis; what relates eV to cm⁻¹ to K to nm is a set of edges,
// exactly one of which (E = hc/λ) is RECIPROCAL and carries the medium tag
// (census §5 round-3: air vs vacuum is 2.77×10⁻⁴ — orders of magnitude above
// line-list precision). The tag rules, refined by review:
//  - crossing the reciprocal edge REQUIRES a declared medium (never a silent
//    vacuum default), and every emitted wavelength carries its medium stamp;
//  - a wavelength→wavelength prefix rescale never crosses the edge, so it
//    needs no medium and never changes one;
//  - "air" requires the Edlén/Ciddor index (finite, ≥ 1) — no default is honest.
//
// Constants are the SI-2019 exact values (vintage tag below).

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
  "kayser": H * C * 100, // explicit alias: the census's K-homograph gate — bare "K" is kelvin ONLY
  "K": KB, // E = k_B T — kelvin; the kayser lives under "cm^-1"/"kayser" (census §5 homograph row)
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
  | {
      kind: "converted"
      value: number
      /** Present whenever the emitted quantity is a wavelength: its medium. */
      medium?: Medium
    }
  | { kind: "declined"; reason: string }

export type ConvertOptions = {
  /** Required whenever the reciprocal edge is crossed involving a wavelength. */
  medium?: Medium
  /** Refractive index of standard air at the working wavelength (Edlén/Ciddor). Required for medium "air". */
  airIndex?: number
}

export function knownUnits(): string[] {
  return [...Object.keys(ENERGY_LIKE), ...Object.keys(WAVELENGTH)]
}

const declined = (reason: string): ConvertResult => ({ kind: "declined", reason })

function airIndexOrDecline(opts: ConvertOptions): number | ConvertResult {
  if (opts.airIndex === undefined)
    return declined(
      'medium "air" needs the refractive index of standard air at this wavelength (Edlén/Ciddor) — pass airIndex; it is wavelength-, T-, p- and humidity-dependent, so no default is honest',
    )
  if (!Number.isFinite(opts.airIndex) || opts.airIndex < 1)
    return declined(`airIndex must be a finite number ≥ 1 (got ${opts.airIndex})`)
  return opts.airIndex
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
  if (!Number.isFinite(value)) return declined(`the value is not a finite number (got ${value})`)
  const fromWave = Object.hasOwn(WAVELENGTH, from)
  const toWave = Object.hasOwn(WAVELENGTH, to)
  if (!fromWave && !Object.hasOwn(ENERGY_LIKE, from))
    return declined(`unknown unit "${from}"`)
  if (!toWave && !Object.hasOwn(ENERGY_LIKE, to)) return declined(`unknown unit "${to}"`)

  if (!fromWave && !toWave)
    return { kind: "converted", value: (value * ENERGY_LIKE[from]) / ENERGY_LIKE[to] }

  if (fromWave && toWave) {
    // A pure prefix rescale on the SAME side of the reciprocal edge: no medium
    // is needed and none changes — the tag (if any) rides along untouched.
    return {
      kind: "converted",
      value: (value * WAVELENGTH[from]) / WAVELENGTH[to],
      ...(opts.medium ? { medium: opts.medium } : {}),
    }
  }

  // Crossing the reciprocal edge: medium is mandatory.
  if (opts.medium === undefined)
    return declined(
      'crossing E = hc/λ needs the wavelength\'s medium (census §5 round-3: air vs vacuum is 2.77×10⁻⁴) — declare medium: "vacuum" or "air"',
    )

  if (fromWave) {
    if (value <= 0) return declined("a wavelength must be positive to cross the reciprocal edge")
    let vacMetres = value * WAVELENGTH[from]
    if (opts.medium === "air") {
      const n = airIndexOrDecline(opts)
      if (typeof n !== "number") return n
      vacMetres *= n // λ_vac = n·λ_air
    }
    const joule = (H * C) / vacMetres
    return { kind: "converted", value: joule / ENERGY_LIKE[to] }
  }

  // energy-like → wavelength
  const joule = value * ENERGY_LIKE[from]
  if (joule <= 0)
    return declined("a positive energy is needed to cross the reciprocal edge")
  const vacMetres = (H * C) / joule
  if (opts.medium === "vacuum")
    return { kind: "converted", value: vacMetres / WAVELENGTH[to], medium: "vacuum" }
  const n = airIndexOrDecline(opts)
  if (typeof n !== "number") return n
  return { kind: "converted", value: vacMetres / n / WAVELENGTH[to], medium: "air" }
}
