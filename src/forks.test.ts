// The fork-recovery rules (docs/data/forks.json), each run through the real
// detector: every drafted positive recovers its branch, every negative does
// not, and a page with nothing recoverable is negative evidence.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { detectForks } from "./forks"

type Rule = { id: string; fork: string; branch: string; surface: string; positives: string[]; negatives: string[] }
const RULES: Rule[] = JSON.parse(readFileSync(fileURLToPath(new URL("../docs/data/forks.json", import.meta.url)), "utf8"))

const input = (rule: Rule, s: string) => (rule.surface === "prose" ? { text: s } : { equations: [s] })
const recovered = (rule: Rule, s: string) =>
  detectForks(input(rule, s)).findings.some((f) => f.ruleId === rule.id && f.branch === rule.branch)

describe("fork recovery from printed forms (census §5 / §6.5b)", () => {
  for (const rule of RULES) {
    test(`${rule.id}: ${rule.fork} → ${rule.branch}`, () => {
      for (const p of rule.positives) assert.ok(recovered(rule, p), `positive did not recover: ${p}`)
      for (const n of rule.negatives) assert.ok(!recovered(rule, n), `negative recovered: ${n}`)
    })
  }
  test("nothing recoverable is negative evidence, never a default", () => {
    const r = detectForks({ equations: ["R_{ab} = 0", "\\Box \\phi = 0"] })
    assert.deepStrictEqual(r.findings, [])
    assert.strictEqual(r.negative, true)
    assert.strictEqual(detectForks({}).negative, false)
  })
  test("no two rules recover different branches of one fork from the same positive", () => {
    for (const rule of RULES)
      for (const p of rule.positives) {
        const r = detectForks(input(rule, p))
        assert.deepStrictEqual(r.conflicts, [], `${rule.id}: ${p} → conflicts ${r.conflicts.join(", ")}`)
      }
  })
})
