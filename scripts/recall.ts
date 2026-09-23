// Convention detection scored against ground truth: runs the extension's page
// reading and inferDocument over the corpus pages named in
// docs/data/detection-truth.json and reports, per paper, whether the
// detector's overall set contains every true convention, some, or none, and
// whether it narrowed a page to which no census convention applies. The
// corpus itself (ar5iv captures) is the authors' and is not in the
// repository; point the script at a local copy.
//
//   npx tsx scripts/recall.ts corpus [--md docs/detection-recall.md]
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseHTML } from "linkedom"
import { scanForMath } from "../extension/src/extract"
import { documentSpans, equationPool } from "../extension/src/page"
import { inferDocument } from "../src/detect"

type Paper = { id: string; arxiv: string; paper: string; scope: string; truthKeys: string[]; ruling: string }
const truth: { papers: Paper[] } = JSON.parse(readFileSync(new URL("../docs/data/detection-truth.json", import.meta.url), "utf8"))
const args = process.argv.slice(2)
const mdAt = args.indexOf("--md")
const mdOut = mdAt >= 0 ? args[mdAt + 1] : null
const dir = args.find((a, i) => a !== "--md" && i !== mdAt + 1) ?? "corpus"

type Row = { p: Paper; kind: string; size: number; outcome: string; declared: string[] }
const rows: Row[] = []
for (const p of truth.papers) {
  const file = join(dir, p.id + ".html")
  if (!existsSync(file)) {
    rows.push({ p, kind: "missing", size: 0, outcome: "no capture", declared: [] })
    continue
  }
  const doc = parseHTML(readFileSync(file, "utf8")).document as unknown as Document
  const { spans } = documentSpans(doc, equationPool(scanForMath(doc as never)))
  const r = inferDocument(spans).overall
  const set = new Set(r.sets.flat())
  const t = p.truthKeys
  const hit = t.filter((k) => set.has(k))
  const outcome =
    t.length === 0
      ? r.kind === "narrowed"
        ? "narrowed a page no convention applies to"
        : "silent, rightly"
      : r.kind === "conflict"
        ? "conflict"
        : hit.length === t.length
          ? r.kind === "narrowed"
            ? "contains the truth, narrowed"
            : "contains the truth, silent"
          : hit.length
            ? `contains ${hit.length} of ${t.length}`
            : "excludes the truth"
  const declared = r.evidence.filter((e) => e.kind === "declaration").map((e) => (e as { label: string }).label)
  rows.push({ p, kind: r.kind, size: set.size, outcome, declared })
}

const lines = [
  "# Convention detection against ground truth",
  "",
  `${rows.length} papers; truth from docs/data/detection-truth.json.`,
  "",
  "| Paper | Scope | Verdict | Set | Outcome | Declarations acted on |",
  "| --- | --- | --- | ---: | --- | --- |",
  ...rows.map((x) => `| ${x.p.arxiv} | ${x.p.scope} | ${x.kind} | ${x.size || ""} | ${x.outcome} | ${x.declared.join("; ").replace(/\|/g, "\\|")} |`),
]
const count = (f: (x: Row) => boolean) => rows.filter(f).length
lines.push(
  "",
  `Contains every true convention: ${count((x) => x.outcome.startsWith("contains the truth"))}; silent where nothing applies: ${count((x) => x.outcome === "silent, rightly")}; partial: ${count((x) => /^contains \d/.test(x.outcome))}; conflict: ${count((x) => x.outcome === "conflict")}; excludes the truth: ${count((x) => x.outcome === "excludes the truth")}; narrowed a page nothing applies to: ${count((x) => x.outcome.startsWith("narrowed a page"))}.`,
)
const text = lines.join("\n") + "\n"
console.log(text)
if (mdOut) writeFileSync(mdOut, text, "utf8")
