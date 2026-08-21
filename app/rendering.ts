// Which E&M rendering's rider table the inspector demonstrates for each
// convention. Data (not DOM) so the guard tests can import it directly.
//
// Deliberate exclusions, pinned by test: hartree/rydberg/hartree-gaussian and
// friends set 4πε₀ = 1 and are Gaussian-adjacent, but their magnetic sector
// carries the α-ambiguity (census §6.4) — attaching a rider table here without
// the atomic-units magnetic story would overstate what the engine knows.
export const RENDERING: Record<string, string> = {
  si: "si",
  gaussian: "gaussian",
  esu: "esu",
  emu: "emu",
  "heaviside-lorentz": "heaviside-lorentz",
  "geometrized-gaussian": "gaussian",
  "gaussian-natural": "gaussian",
  "planck-gaussian": "gaussian",
  "geometrized-hl": "heaviside-lorentz",
  "hep-hl": "heaviside-lorentz",
  "hep-hl-kb": "heaviside-lorentz",
  "planck-hl": "heaviside-lorentz",
}

export const RENDERING_EXCLUDED: readonly string[] = [
  "hartree",
  "rydberg",
  "hartree-gaussian",
  "effective-au",
  "magnetism-emu",
] as const
