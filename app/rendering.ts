// Which E&M rendering's rider table the inspector demonstrates for each
// convention. Data (not DOM) so the guard tests can import it directly.
// Every convention key appears in exactly one of the three lists below —
// completeness-guarded by test, so no row can go silently unpinned.
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
  // The two former exclusion-list IOUs, now carrying their own rider tables:
  "magnetism-emu": "magnetism-emu",
  "lattice-model": "lattice-peierls",
}

/**
 * Deliberate exclusions, each with its reason, pinned by test.
 */
export const RENDERING_EXCLUDED: Record<string, string> = {
  // Atomic rows absorbing the Coulomb 4πε₀ combination (4-generator or
  // half-integer rendering): the magnetic sector carries the α-ambiguity
  // (census §6.4) — a rider table here would overstate what the engine knows.
  hartree: "atomic magnetic α-ambiguity (census §6.4)",
  rydberg: "atomic magnetic α-ambiguity (census §6.4)",
  "hartree-gaussian": "atomic magnetic α-ambiguity (census §6.4)",
  "effective-au": "atomic magnetic α-ambiguity (census §6.4)",
  "dirac-atomic": "carries the Gaussian/HL fork in its census rescaling list — un-adjudicated here",
}

/**
 * Conventions with no classical-E&M rendering story to demonstrate —
 * mechanical, gravitational, or per-paper scales whose EM sector is either
 * absent or already carried by their generator sets.
 */
export const RENDERING_NOT_APPLICABLE: readonly string[] = [
  "geometrized",
  "reduced-planck",
  "kolb-turner",
  "c-only",
  "classical-kappa",
  "sixteen-pi-g",
  "string-alpha-prime",
  "string-ls-2pi",
  "lattice",
  "bh-scale",
  "nr-code",
  "kb-only",
  "lj-reduced",
  "chaos-mw",
  "trap-units",
  "ns-inertial",
  "gpe-healing",
] as const
