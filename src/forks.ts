// Census §6.5b: when no convention is declared, the DIMENSIONLESS forks of
// the §5 registry are recovered from equation form — the PSD's inner-product
// limits, the Fourier kernel, the strain definition, the printed α, the
// Hamiltonian's −½∇² — ranked, and failing all, NEGATIVE evidence, never a
// default. A fork is a place where a dimension check passes and the number
// is wrong; recovering its branch is lookup against printed forms, like
// everything else here. Rules live in docs/data/forks.json (drafted and
// adversarially verified against the census, with positives and negatives)
// and are generated into src/tables.generated.ts.
import { FORK_RULES, ForkRule } from "./tables.generated"
import { normalizeProse, normalizeTexForDetection } from "./detect"

export type ForkFinding = {
  fork: string
  branch: string
  rival: string
  magnitude: string
  /** The canonical printed form, as TeX. */
  tex: string
  meaning: string
  /** The page string that matched. */
  excerpt: string
  ruleId: string
}

export type ForkReport = {
  /** One finding per fork; where two rules assert different branches of one fork, both are kept and `conflicts` names the fork. */
  findings: ForkFinding[]
  /** Forks printed in more than one branch: the page switches convention, or compares two. */
  conflicts: string[]
  /** True when the page has equations and no fork could be recovered — negative evidence, never a default. */
  negative: boolean
}

const COMPILED = FORK_RULES.map((rule) => ({ rule, re: new RegExp(rule.pattern) }))

export function detectForks(input: { text?: string; equations?: string[] }): ForkReport {
  const prose = normalizeProse(input.text ?? "")
  const equations = (input.equations ?? []).map(normalizeTexForDetection)
  const findings: ForkFinding[] = []
  const seen = new Set<string>()
  const surfaces = (rule: ForkRule): string[] =>
    rule.surface === "prose" ? [prose] : rule.surface === "equation" ? equations : [prose, ...equations]
  for (const { rule, re } of COMPILED) {
    if (seen.has(rule.id)) continue
    for (const s of surfaces(rule)) {
      const m = re.exec(s)
      if (!m) continue
      seen.add(rule.id)
      const at = m.index ?? 0
      findings.push({
        fork: rule.fork,
        branch: rule.branch,
        rival: rule.rival,
        magnitude: rule.magnitude,
        tex: rule.tex,
        meaning: rule.meaning,
        excerpt: s.slice(Math.max(0, at - 40), at + m[0].length + 40).trim(),
        ruleId: rule.id,
      })
      break
    }
  }
  const byFork = new Map<string, Set<string>>()
  for (const f of findings) {
    if (!byFork.has(f.fork)) byFork.set(f.fork, new Set())
    byFork.get(f.fork)!.add(f.branch)
  }
  const conflicts = [...byFork.entries()].filter(([, branches]) => branches.size > 1).map(([fork]) => fork)
  return { findings, conflicts, negative: findings.length === 0 && equations.length > 0 }
}
