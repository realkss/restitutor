// The decline ledger over a corpus of captured pages: runs the extension's
// page reading (extension/src/page.ts) in node over every .html file in the
// directories given, translates each pooled equation to SI under the page's
// own registry, and reports why the tool says no — per page and in total —
// with the unknown symbols that blocked the most equations and whether the
// page mentions each under a declaration cue (the case a context reader
// could rescue). Numbers only; no page text is printed.
//
//   npx tsx scripts/ledger.ts test/fixtures/wikipedia corpus app/dist/real [--md out.md]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseHTML } from "linkedom"
import katex from "katex"
import { scanForMath } from "../extension/src/extract"
import { documentSpans, equationPool, miningSurface, pageReadings } from "../extension/src/page"
import { registryWithDeclarations, registryWithDefinitions } from "../src/bridge"
import { refuseNonEquation } from "../src/gate"
import { Ledger, OUTCOME_ORDER, OutcomeClass, classifyOutcome, emptyLedger, mentionedWithCue, record } from "../src/ledger"
import { findRegistryForSlug, translateTex } from "../src/unitsEngine"
import { inferDocument } from "../src/detect"

const GR = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")!
const kx = katex as unknown as { __parse: (tex: string, o?: Record<string, unknown>) => unknown[] }
const SI = { system: "si", geometrized: false } as const

const args = process.argv.slice(2)
const mdAt = args.indexOf("--md")
const mdOut = mdAt >= 0 ? args[mdAt + 1] : null
const dirs = args.filter((a, i) => a !== "--md" && i !== mdAt + 1)

type PageRow = {
  file: string
  carriers: number
  pooled: number
  spans: number
  verdict: string
  ledger: Ledger
  symbols: number
  definitions: number
  cued: Map<string, boolean>
}

const rows: PageRow[] = []
const reasonTally = new Map<string, number>()
const tally = (reason: string) => {
  const key = reason.replace(/\(term “[^”]*”\)|“[^”]*”/g, "").replace(/\s+/g, " ").trim().slice(0, 90)
  reasonTally.set(key, (reasonTally.get(key) ?? 0) + 1)
}
for (const dir of dirs) {
  let files: string[] = []
  try {
    if (statSync(dir).isFile()) files = [dir]
    else files = readdirSync(dir).filter((f) => f.endsWith(".html") && statSync(join(dir, f)).size > 2000).map((f) => join(dir, f))
  } catch {
    continue
  }
  for (const path of files) {
    const f = path
    const html = readFileSync(path, "utf8")
    let doc: Document
    try {
      doc = parseHTML(html).document as unknown as Document
    } catch {
      continue
    }
    const candidates = scanForMath(doc as never)
    if (!candidates.length) continue
    const pool = equationPool(candidates)
    const { spans } = documentSpans(doc, pool)
    let verdict = "?"
    try {
      const report = inferDocument(spans)
      const o = report.overall as { kind: string; sets?: string[][] }
      verdict = o.kind + (o.sets ? " " + o.sets.map((s) => s.length).join("/") : "")
    } catch (e) {
      verdict = "error"
    }
    const readings = pageReadings(doc, candidates, GR, kx)
    let registry = readings.symbols.length ? registryWithDeclarations(GR, readings.symbols) : GR
    if (readings.definitions.length || readings.symbols.some((s) => s.expr)) registry = registryWithDefinitions(registry, readings, kx)
    const ledger = emptyLedger()
    // Statements, not carriers: an equation group's rows and a line joined
    // by "and" each count once (extension/src/extract.ts, src/tex.ts).
    const statements = pool.flatMap((c) => c.statements)
    for (const tex of statements) {
      let outcome
      try {
        outcome = classifyOutcome(refuseNonEquation(tex) ?? translateTex(tex, kx, registry, SI))
      } catch (e) {
        outcome = { class: "other" as OutcomeClass, reason: "engine threw: " + String(e).slice(0, 80), unknown: [] }
      }
      record(ledger, outcome)
      if (outcome.class === "other" || outcome.class === "unsupported") tally(outcome.class + ": " + outcome.reason)
    }
    const surface = miningSurface(doc)
    const cued = new Map<string, boolean>()
    for (const s of ledger.unknown.keys()) cued.set(s, mentionedWithCue(surface, s))
    rows.push({
      file: f,
      carriers: candidates.length,
      pooled: statements.length,
      spans: spans.length,
      verdict,
      ledger,
      symbols: readings.symbols.length,
      definitions: readings.definitions.length,
      cued,
    })
  }
}

const pct = (n: number, of: number) => (of ? ((100 * n) / of).toFixed(0) + "%" : "–")
const total = emptyLedger()
const cuedTotal = new Map<string, { count: number; cued: number }>()
for (const r of rows) {
  for (const c of OUTCOME_ORDER) total.counts[c] += r.ledger.counts[c]
  for (const [s, n] of r.ledger.unknown) {
    const t = cuedTotal.get(s) ?? { count: 0, cued: 0 }
    t.count += n
    if (r.cued.get(s)) t.cued += n
    cuedTotal.set(s, t)
  }
  total.others.push(...r.ledger.others)
}
const pooledTotal = rows.reduce((n, r) => n + r.pooled, 0)

const lines: string[] = []
lines.push(`# Decline ledger`, ``, `${rows.length} pages, ${pooledTotal} pooled equations, translated to SI under each page's own registry.`, ``)
lines.push(`| Page | Carriers | Pooled | Spans | Verdict | Symbols | Definitions | ${OUTCOME_ORDER.join(" | ")} |`)
lines.push(`| --- | ---: | ---: | ---: | --- | ---: | ---: | ${OUTCOME_ORDER.map(() => "---:").join(" | ")} |`)
for (const r of rows)
  lines.push(
    `| ${r.file.replace(/\\/g, "/")} | ${r.carriers} | ${r.pooled} | ${r.spans} | ${r.verdict} | ${r.symbols} | ${r.definitions} | ${OUTCOME_ORDER.map((c) => r.ledger.counts[c] || "").join(" | ")} |`,
  )
lines.push(`| **Total** | | ${pooledTotal} | | | | | ${OUTCOME_ORDER.map((c) => total.counts[c] || "").join(" | ")} |`)
lines.push(``, `## Share of pooled equations`, ``, `| Class | Count | Share |`, `| --- | ---: | ---: |`)
for (const c of OUTCOME_ORDER) lines.push(`| ${c} | ${total.counts[c]} | ${pct(total.counts[c], pooledTotal)} |`)

const unknownEqs = total.counts["unknown-symbol"]
const distinct = [...cuedTotal.entries()].sort((a, b) => b[1].count - a[1].count)
const cuedEqs = distinct.reduce((n, [, t]) => n + t.cued, 0)
const blocking = distinct.reduce((n, [, t]) => n + t.count, 0)
lines.push(
  ``,
  `## Unknown symbols`,
  ``,
  `${distinct.length} distinct symbols blocked ${unknownEqs} equations (${blocking} symbol-occurrences). Of those occurrences, ${cuedEqs} (${pct(cuedEqs, blocking)}) are of a symbol the same page mentions under a declaration cue (is / denotes / where / defined): the case a context reader could rescue. The rest are symbols the page never explains in words: a profile question, not a reading question.`,
  ``,
  `| Symbol | Blocked | Mentioned with a cue |`,
  `| --- | ---: | :---: |`,
)
for (const [s, t] of distinct.slice(0, 40)) lines.push(`| \`${s}\` | ${t.count} | ${t.cued ? "yes" : ""} |`)
if (reasonTally.size) {
  lines.push(``, `## The unsupported constructs and the reasons outside the classes`, ``, `| Reason (the engine's words, the offending term elided) | Count |`, `| --- | ---: |`)
  for (const [r, n] of [...reasonTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) lines.push(`| ${r.replace(/\|/g, "\\|")} | ${n} |`)
}
const text = lines.join("\n") + "\n"
console.log(text)
if (mdOut) {
  writeFileSync(mdOut, text, "utf8")
  console.log("written " + mdOut)
}
