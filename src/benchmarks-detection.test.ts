// The census's mined benchmark corpus (docs/data/benchmarks-seed.json) as the
// detection scoreboard (census §10.1 class B). Three boards and a negative suite:
//
//   FORMS board  — each seed system's annotated equation forms (Coulomb, Gauss,
//                  Einstein, Schrödinger/Dirac) fed as equations. The census
//                  wrote these as commentary, with counterfactual remarks in
//                  them ("if the paper also sets ħ = 1 …"), which is exactly
//                  how notation sections talk — so the true convention must
//                  SURVIVE them. Specificity is reported, never asserted.
//   REGISTRY round-trip — each registry row's own generators written as the
//                  sentence a paper prints ("We set ħ = c = 1.") must keep
//                  that row.
//   SEED-DECLARATION board — the seed's generator lists likewise, asserted
//                  only where the seed's list equals the row's generators
//                  exactly (the seed writes "ε₀" for rows whose generator is
//                  4πε₀; that looseness is the seed's, not the detector's).
//   ANTI-FINGERPRINTS — the seven retired tells (census §6.6) fire nothing.
//
// Only seed systems that correspond to a registry row carry an expectation;
// the mapping is pinned by hand (code-unit triples, document hybrids, and
// refuse-class systems have no row on purpose). Where the seed's own text
// invokes a second normalization for a row ("With G = c = 1, Reissner–
// Nordström reads …" under CGS-Gaussian), the geometrized twin is expected too.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CONVENTIONS } from "./convention"
import { inferConventions } from "./detect"

type Seed = {
  system_forms: { family: string; system: string; generators: string[]; forms: Record<string, string> }[]
  anti_fingerprints: { pattern: string; must_not_fire: string; why: string }[]
}
const seed: Seed = JSON.parse(
  readFileSync(fileURLToPath(new URL("../docs/data/benchmarks-seed.json", import.meta.url)), "utf8"),
)

/** Seed system name (prefix) → the registry rows that ARE that system. */
const EXPECT: [string, string[]][] = [
  ["SI (2019 revision)", ["si"]],
  ["MKSA / pre-2019 SI", ["si"]],
  ["CGS-Gaussian", ["gaussian", "geometrized-gaussian"]],
  ["CGS-ESU", ["esu"]],
  ["CGS-EMU", ["emu"]],
  ["Heaviside–Lorentz natural units", ["hep-hl"]],
  ["Heaviside–Lorentz", ["heaviside-lorentz", "geometrized-hl", "planck-hl"]],
  ["Practical/mixed CGS of experimental magnetism", ["magnetism-emu"]],
  ["Gaussian-geometrized", ["geometrized-gaussian"]],
  ["HEP natural units (ħ = c = 1) with Heaviside–Lorentz", ["hep-hl"]],
  ["HEP natural units with Boltzmann constant", ["hep-hl-kb"]],
  ["Gaussian natural units", ["gaussian-natural"]],
  ["Relativistic units (c = 1 only", ["c-only"]],
  ["Planck units, Gaussian flavour", ["planck-gaussian"]],
  ["Planck units, Heaviside–Lorentz flavour", ["planck-hl"]],
  ["Reduced Planck units", ["reduced-planck"]],
  ["Holographic/SUGRA", ["sixteen-pi-g"]],
  ["String units α' = 1", ["string-alpha-prime"]],
  ["String length units ℓ_s = 1 with ℓ_s = 2π", ["string-ls-2pi"]],
  ["Lattice units (a = 1) on top of ħ = c = 1", ["lattice"]],
  ["Geometrized units (G = c = 1)", ["geometrized"]],
  ["Geometrized-Gaussian units", ["geometrized-gaussian"]],
  ["Geometrized Heaviside-Lorentz units", ["geometrized-hl"]],
  ["Black-hole scale units", ["bh-scale"]],
  ["Numerical-relativity code units (G = c = M_\\odot = 1)", ["nr-code"]],
  ["Numerical-relativity code units (G = c = M = 1)", ["bh-scale", "nr-code"]],
  ["c = 1 only (relativist's", ["c-only"]],
  ["Reduced-Planck cosmology units", ["reduced-planck"]],
  ["Classical \\kappa = 1 units", ["classical-kappa"]],
  ["Planck units (G = c = \\hbar = k_B = 1)", ["planck-gaussian", "planck-hl"]],
  ["Gaussian-CGS relativistic astrophysics", ["gaussian"]],
  ["Hartree atomic units (SI-based rendering", ["hartree"]],
  ["Hartree atomic units (Gaussian/cgs-based rendering)", ["hartree-gaussian"]],
  ["Rydberg atomic units", ["rydberg"]],
  ["Relativistic (Dirac) atomic units", ["dirac-atomic"]],
  ["Effective (excitonic / material) atomic units", ["effective-au"]],
  ["Condensed-matter theory units (ħ = k_B = 1", ["lattice-model"]],
  ["Lattice-model condensed-matter units", ["lattice-model"]],
  ["CGS-emu / Gaussian magnetism", ["magnetism-emu"]],
  ["Hamiltonian and classical-chaos conventions", ["chaos-mw"]],
  ["Harmonic-trap units", ["trap-units"]],
  ["Molecular-dynamics simulation unit sets", ["lj-reduced"]],
]

const expectationFor = (system: string) => EXPECT.find(([prefix]) => system.startsWith(prefix))?.[1] ?? null

/** The seed writes a generator as TeX with an optional annotation: "a\ (\text{lattice spacing})". */
const cleanGenerator = (g: string) => g.replace(/\\\s*\(\\text\{[^}]*\}\)/g, "").replace(/\s+/g, "").trim()
const unwrap = (s: string) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s)
const generatorSet = (key: string) => new Set(CONVENTIONS[key].generators.map((g) => unwrap(g.emits).replace(/\s+/g, "")))
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

const holds = (r: ReturnType<typeof inferConventions>, expected: string[]) =>
  r.kind !== "conflict" && (r.kind !== "narrowed" || expected.some((k) => r.sets.flat().includes(k)))

describe("benchmark corpus — detection scoreboard (census §10.1 class B)", () => {
  const mapped = seed.system_forms.filter((s) => expectationFor(s.system))
  test("the hand-pinned mapping names real rows and covers the registry-encoded systems", () => {
    for (const [, keys] of EXPECT) for (const k of keys) assert.ok(k in CONVENTIONS, k)
    assert.ok(mapped.length >= 40, `mapped ${mapped.length} of ${seed.system_forms.length} seed systems`)
  })

  test("FORMS board: the true convention survives its own annotated equation forms, every time", () => {
    const failures: string[] = []
    let narrowed = 0
    let survivors = 0
    for (const s of mapped) {
      const r = inferConventions({ equations: Object.values(s.forms) })
      if (r.kind === "narrowed") {
        narrowed++
        survivors += r.sets[0].length
      }
      if (!holds(r, expectationFor(s.system)!))
        failures.push(`${s.system} → ${r.kind} ${JSON.stringify(r.sets.flat().slice(0, 6))}`)
    }
    console.log(
      `  forms board: ${mapped.length} systems · narrowed ${narrowed} · mean survivors when narrowed ${narrowed ? (survivors / narrowed).toFixed(1) : "–"} of ${Object.keys(CONVENTIONS).length}`,
    )
    assert.deepStrictEqual(failures, [])
  })

  test("REGISTRY round-trip: 'We set <own generators> = 1.' keeps every row that has generators", () => {
    const failures: string[] = []
    let narrowed = 0
    let total = 0
    for (const key of Object.keys(CONVENTIONS)) {
      const gens = [...generatorSet(key)]
      if (gens.length === 0) continue
      total++
      const r = inferConventions({ text: `We set ${gens.join(" = ")} = 1.` })
      if (r.kind === "narrowed") narrowed++
      if (!holds(r, [key])) failures.push(`${key} [${gens.join(", ")}] → ${r.kind} ${JSON.stringify(r.sets.flat().slice(0, 6))}`)
    }
    console.log(`  registry round-trip: ${total} rows · narrowed ${narrowed}`)
    assert.deepStrictEqual(failures, [])
  })

  test("SEED-DECLARATION board: exact-generator seed rows survive their own 'We set … = 1.'", () => {
    const failures: string[] = []
    let exact = 0
    let loose = 0
    for (const s of mapped) {
      const gens = new Set(s.generators.map(cleanGenerator).filter(Boolean))
      if (gens.size === 0) continue
      const expected = expectationFor(s.system)!
      const isExact = expected.some((k) => sameSet(gens, generatorSet(k)))
      if (!isExact) {
        loose++
        continue
      }
      exact++
      const r = inferConventions({ text: `We set ${[...gens].join(" = ")} = 1.` })
      if (!holds(r, expected)) failures.push(`${s.system} [${[...gens].join(", ")}] → ${r.kind} ${JSON.stringify(r.sets.flat().slice(0, 6))}`)
    }
    console.log(`  seed declarations: ${exact} exact-generator rows asserted · ${loose} loose rows reported only`)
    assert.deepStrictEqual(failures, [])
  })

  test("ANTI-FINGERPRINTS: the seven retired tells fire nothing (census §6.6)", () => {
    // The seed states each tell in prose; here is each as a paper would print it.
    const asPaper: Record<string, { text?: string; equations?: string[] }> = {
      "alpha_s = g^2/4pi": { equations: ["\\alpha_s = \\frac{g^2}{4\\pi}"] },
      "3.107e8 m/s as an EM constant": { text: "The constant was measured as 3.107 × 10^8 m/s." },
      "absurdly LARGE B values": { equations: ["B = 3 \\times 10^{14}\\,\\mathrm{G}"] },
      "m_P = G^(-1/2)": { equations: ["m_P = G^{-1/2}"] },
      "M^2 = 2(N+Ntilde-2) 'rather than' 4(N-1)": { equations: ["M^2 = 2(N + \\tilde N - 2)"] },
      "rutherford (Rd) unit": { text: "Activities are quoted in rutherfords (Rd)." },
      "Hellings-Downs reaching -0.25 (or -0.5) at 180 deg": {
        text: "The Hellings–Downs curve reaches −0.25 at 180 degrees.",
      },
    }
    assert.strictEqual(seed.anti_fingerprints.length, 7)
    for (const a of seed.anti_fingerprints) {
      const input = asPaper[a.pattern]
      assert.ok(input, `no paper form for anti-fingerprint “${a.pattern}”`)
      const r = inferConventions(input)
      assert.strictEqual(r.kind, "insufficient", `“${a.pattern}” must not fire (${a.must_not_fire}): ${JSON.stringify(r.evidence)}`)
    }
  })
})
