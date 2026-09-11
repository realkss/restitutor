// Stage-2 content script (product-design §2.2): scan the page for math whose
// TeX the page itself carries, decorate it, and translate on click in an
// in-page panel. The engine runs entirely in the page — no network, no OCR.
import katexDefault from "katex"
import {
  DEFAULT_TARGET,
  SYSTEM_LABELS,
  TargetSpec,
  UnitSystem,
  translateTex,
} from "../../src/unitsEngine"
import { defaultProfile } from "../../src/profiles"
import { CONVENTIONS } from "../../src/convention"
import { DetectionReport, DocumentReport, Evidence, Span, inferDocument } from "../../src/detect"
import { registryWithDeclarations, registryWithDefinitions, targetFromDetection } from "../../src/bridge"
import { refuseNonEquation } from "../../src/gate"
import { ForkReport, detectForks } from "../../src/forks"
import { MinedDefinition, MinedSymbol } from "../../src/mine"
import { documentSpans as spansOfPage, equationPool, pageReadings } from "./page"
import { renderTranslation } from "../../app/resultView"
import { MathCandidate, scanForMath } from "./extract"
import panelCss from "../panel.css"
import katexCss from "katex/dist/katex.min.css"

const katex = katexDefault as unknown as {
  render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void
  __parse: (tex: string, options?: Record<string, unknown>) => unknown[]
}

const profile = defaultProfile()

const VIA_LABEL: Record<MathCandidate["via"], string> = {
  "alttext": "MathML alttext",
  "mml-annotation": "x-tex annotation (KaTeX)",
  "mathjax2-script": "math/tex script (MathJax v2)",
}

let host: HTMLElement | null = null
let panel: HTMLElement | null = null
let resultsEl: HTMLElement
let provenanceEl: HTMLElement
let systemSel: HTMLSelectElement
let geomBox: HTMLInputElement
let currentTex = ""
let pageDetection: DetectionReport | null = null
let pageDocument: DocumentReport | null = null
let pageSymbols: MinedSymbol[] = []
let pageDefinitions: MinedDefinition[] = []
let pageForks: ForkReport | null = null

// The page-conventions card is DERIVED from the evidence the report
// carries — never a fixed sentence that might name a cause that did not
// participate — and it speaks in convention NAMES and typeset equation
// forms, not registry slugs and pseudo-math.
// A candidate as its prose name plus its defining relation TYPESET from the
// registry's own generator TeX: "Geometrized (c = G = 1)" with real
// subscripts, never "k_B" or "M_odot" as text.
function candidateNode(key: string): HTMLElement {
  const c = CONVENTIONS[key]
  const span = document.createElement("span")
  span.className = "rst-cand"
  if (!c) {
    span.textContent = key
    return span
  }
  // The registry's names carry a parenthetical formula or a colon annotation
  // ("SI (2019): the zero-generator baseline"); neither is for the reader.
  const prose = c.name.replace(/\s*\([^()]*\)$/, "").replace(/:.*$/, "").trim()
  span.append(prose)
  // Rows whose generators are alternatives ("m^* or 2m^*") have no chain to typeset.
  if (c.generators.length && !c.generators.some((g) => g.emits.includes("\\text"))) {
    const unwrap = (s: string) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s)
    const m = document.createElement("span")
    katex.render(c.generators.map((g) => unwrap(g.emits)).join(" = ") + " = 1", m, { throwOnError: false })
    span.append(" (", m, ")")
  }
  return span
}

function evidenceItem(e: Evidence): HTMLLIElement {
  const li = document.createElement("li")
  const quote = (s: string) => {
    const span = document.createElement("span")
    span.className = "rst-excerpt"
    const cut = s.length > 140 ? s.slice(0, 140) + "…" : s
    span.textContent = " " + String.fromCharCode(0x201c) + cut + String.fromCharCode(0x201d)
    return span
  }
  switch (e.kind) {
    case "declaration": {
      if (e.labelTex) {
        const m = document.createElement("span")
        katex.render(e.labelTex, m, { throwOnError: false })
        li.append("Stated: ", m, ".", quote(e.excerpt))
      } else {
        li.append("Stated: " + e.label + ".", quote(e.excerpt))
      }
      break
    }
    case "fingerprint": {
      const m = document.createElement("span")
      katex.render(e.tex, m, { throwOnError: false })
      li.append(m, ": " + e.meaning + ".")
      break
    }
    case "visible-constant": {
      const m = document.createElement("span")
      katex.render(e.constantTex, m, { throwOnError: false })
      li.append(
        m,
        " explicit in " + e.count + " of " + e.of + " equations" +
          (e.strength === "strong" ? "." : "; too few to count."),
      )
      break
    }
    case "contradicted": {
      const chain = document.createElement("span")
      katex.render(e.labelTex, chain, { throwOnError: false })
      const k = document.createElement("span")
      katex.render(e.constantTex, k, { throwOnError: false })
      li.append(
        "Stated ",
        chain,
        ", yet ",
        k,
        " is written in " + e.count + " of " + e.of + " equations; the equations govern.",
      )
      break
    }
    case "mention": {
      if (e.labelTex) {
        const m = document.createElement("span")
        katex.render(e.labelTex, m, { throwOnError: false })
        li.append(m, ": " + (e.note || "mentioned, not declared") + ".")
      } else li.append(e.label + ": " + (e.note || "mentioned, not declared") + ".")
      break
    }
  }
  return li
}

const TOTAL_CONVENTIONS = Object.keys(CONVENTIONS).length

function detectionCard(): HTMLElement | null {
  const r = pageDetection
  if (!r) return null
  const card = document.createElement("div")
  card.className = "card"
  const h = document.createElement("h2")
  h.textContent = "Conventions"
  card.appendChild(h)

  const acting = r.evidence.filter(
    (e) =>
      e.kind === "declaration" ||
      e.kind === "fingerprint" ||
      e.kind === "contradicted" ||
      (e.kind === "visible-constant" && e.strength === "strong"),
  )
  const noted = r.evidence.filter((e) => !acting.includes(e) && !(e.kind === "visible-constant" && e.strength === "weak-homograph"))

  const line = document.createElement("p")
  line.style.margin = "0"
  const lead = document.createElement("span")
  // A mixed document has no document-level winner (census §6.2): the span
  // verdicts come first, and the evidence follows as on any other page.
  const isMixed = !!(pageDocument && pageDocument.mixed.length)
  if (isMixed) {
    lead.className = "verdict warn"
    lead.textContent = "Mixed."
    line.append(lead, " Different parts of the page use different conventions.")
    card.appendChild(line)
    const ul = document.createElement("ul")
    ul.className = "reasons"
    for (const s of pageDocument!.spans) {
      if (s.report.kind !== "narrowed") continue
      const li = document.createElement("li")
      li.append(s.label + ": ")
      s.report.sets[0].slice(0, 3).forEach((k, i) => {
        if (i) li.append(" · ")
        li.appendChild(candidateNode(k))
      })
      if (s.report.sets[0].length > 3) li.append(" · +" + (s.report.sets[0].length - 3))
      ul.appendChild(li)
    }
    card.appendChild(ul)
  } else if (r.kind === "narrowed") {
    const set = r.sets[0]
    lead.className = "verdict ok"
    lead.textContent = "Consistent with " + set.length + " of " + TOTAL_CONVENTIONS + " conventions"
    line.append(lead, ":")
    card.appendChild(line)
    const cands = document.createElement("p")
    cands.className = "rst-cands"
    set.forEach((k, i) => {
      if (i) cands.append("  ·  ")
      cands.appendChild(candidateNode(k))
    })
    card.appendChild(cands)
  } else if (r.kind === "conflict") {
    lead.className = "verdict warn"
    lead.textContent = "Inconsistent."
    line.append(lead, " No convention satisfies all of the following.")
    card.appendChild(line)
  } else {
    lead.className = "verdict"
    lead.textContent = "Undetermined."
    line.append(lead, " Nothing in the page fixes a convention.")
    card.appendChild(line)
  }

  const shown = r.kind === "insufficient" ? noted : acting
  if (shown.length) {
    const ul = document.createElement("ul")
    ul.className = "reasons"
    for (const e of shown) ul.appendChild(evidenceItem(e))
    card.appendChild(ul)
  }
  if ((isMixed || r.kind === "narrowed") && noted.length) {
    const also = document.createElement("p")
    also.className = "unitline"
    also.append("Not used: ")
    noted.forEach((e, i) => {
      if (i) also.append("; ")
      if (e.kind === "visible-constant") {
        const m = document.createElement("span")
        katex.render(e.constantTex, m, { throwOnError: false })
        also.appendChild(m)
      } else if (e.kind === "mention") {
        if (e.labelTex) {
          const m = document.createElement("span")
          katex.render(e.labelTex, m, { throwOnError: false })
          also.appendChild(m)
          if (e.note) also.append(" (" + e.note + ")")
        } else also.append(e.label)
      }
    })
    also.append(".")
    card.appendChild(also)
  }
  return card
}

// The page cards (Conventions, Symbols) are rebuilt whenever detection
// reruns — after a MutationObserver rescan the panel must not keep showing
// the verdict of the pool as it first stood (review v2).
// The dimensionless conventions the printed forms fix (census §5, §6.5b):
// which side of each fork the page is on, and the forks it prints both
// sides of. Nothing recoverable shows nothing — negative evidence is never
// rendered as a default.
function forksCard(): HTMLElement | null {
  if (!pageForks || pageForks.findings.length === 0) return null
  const card = document.createElement("div")
  card.className = "card"
  const h = document.createElement("h2")
  h.textContent = "Dimensionless conventions"
  card.appendChild(h)
  const ul = document.createElement("ul")
  ul.className = "reasons"
  for (const f of pageForks.findings) {
    const li = document.createElement("li")
    const m = document.createElement("span")
    katex.render(f.tex, m, { throwOnError: false })
    li.append(m, ": " + f.meaning.replace(/\.\s*$/, "") + ".")
    ul.appendChild(li)
  }
  for (const fork of pageForks.conflicts) {
    const li = document.createElement("li")
    li.append("Both sides of the " + fork + " fork are printed.")
    ul.appendChild(li)
  }
  card.appendChild(ul)
  return card
}

function renderCards(): void {
  if (!panel) return
  for (const old of panel.querySelectorAll(".rst-page-card")) old.remove()
  const cards = [detectionCard(), forksCard(), symbolsCard()].filter((c): c is HTMLElement => !!c)
  for (const card of cards) {
    card.classList.add("rst-page-card")
    if (resultsEl && resultsEl.parentElement === panel) panel.insertBefore(card, resultsEl)
    else panel.appendChild(card)
  }
}

// The translate target follows the span that owns the clicked equation
// (census §6.2: never a document-level winner on a mixed page); the reader's
// own choice survives clicks inside the same span.
const spanOf = new WeakMap<MathCandidate, string>()
let seededSpan: string | null = null

function reportFor(c: MathCandidate): DetectionReport | null {
  const id = spanOf.get(c) ?? null
  const span = id && pageDocument ? pageDocument.spans.find((s) => s.id === id) : undefined
  if (span && span.report.kind === "narrowed") return span.report
  if (pageDocument && pageDocument.mixed.length) return null
  return pageDetection
}

function seedTarget(c: MathCandidate): void {
  const id = spanOf.get(c) ?? "page"
  if (id === seededSpan) return
  seededSpan = id
  const report = reportFor(c)
  if (!report) return
  const seed = targetFromDetection(report)
  if (seed.system) systemSel.value = seed.system
  if (seed.geometrized !== undefined) geomBox.checked = seed.geometrized
}

// Symbols the text declares (census §6.5): the reading as printed, its
// dimension's noun, and the registry's own reading wherever it disagrees —
// the declaration wins, the clash is shown. A caveated reading is shown
// with its caveat and stays out of the registry (bridge.registryTrusts):
// the card says so, since the translation will not use it.
const CAVEAT_TEXT: Record<NonNullable<MinedSymbol["caveat"]>, string> = {
  ambiguous: "Ambiguous noun; not used for translation.",
  "convention-dependent": "Dimension depends on the E&M system; not used for translation.",
  "depends-on-d": "Dimension depends on the spatial dimension; not used for translation.",
  "coordinate-convention": "Depends on the coordinate convention; not used for translation.",
}

function symbolsCard(): HTMLElement | null {
  if (!pageSymbols.length && !pageDefinitions.length) return null
  const card = document.createElement("div")
  card.className = "card"
  const h = document.createElement("h2")
  h.textContent = "Symbols"
  card.appendChild(h)
  const ul = document.createElement("ul")
  ul.className = "reasons"
  for (const s of pageSymbols) {
    const li = document.createElement("li")
    const m = document.createElement("span")
    katex.render(s.symbol, m, { throwOnError: false })
    const gloss = s.gloss.toLowerCase() === s.noun.noun.toLowerCase() ? "" : " (“" + s.gloss + "”)"
    li.append(m, ": " + s.noun.noun + gloss + ".")
    // The registry's glosses carry their own rationale after a dash or a
    // comma; the card needs only the reading.
    if (s.registry) li.append(" Registry reads " + s.registry.gloss.split(/\s+[—–]\s+|,\s|\s\(/)[0] + ".")
    if (s.caveat) li.append(" " + CAVEAT_TEXT[s.caveat])
    // A definition of the same symbol, from the prose or the equations,
    // joins the symbol's line.
    const expr = s.expr ?? pageDefinitions.find((d) => d.symbol === s.symbol)?.expr
    if (expr) {
      const e = document.createElement("span")
      katex.render(expr, e, { throwOnError: false })
      li.append(" Defined as ", e, ".")
    }
    ul.appendChild(li)
  }
  // Definitions with no gloss: the expression alone fixes the dimension.
  const glossed = new Set(pageSymbols.map((s) => s.symbol))
  for (const d of pageDefinitions.filter((d) => !glossed.has(d.symbol)).slice(0, 8)) {
    const li = document.createElement("li")
    const m = document.createElement("span")
    katex.render(d.symbol, m, { throwOnError: false })
    const e = document.createElement("span")
    katex.render(d.expr, e, { throwOnError: false })
    li.append(m, ": defined as ", e, ".")
    ul.appendChild(li)
  }
  card.appendChild(ul)
  return card
}

function buildPanel(): void {
  // The panel lives inside a SHADOW ROOT: page CSS — including !important
  // rules on generic class names like .card — cannot reach it, and our card
  // styles cannot leak out. Both stylesheets ride along as bundled text.
  // (@font-face inside a shadow root is ignored by Chrome, which is why
  // loadKatexStylesheet() ALSO registers the fonts at document level.)
  host = document.createElement("div")
  const root = host.attachShadow({ mode: "open" })
  for (const cssText of [katexCss, panelCss]) {
    const style = document.createElement("style")
    style.textContent = cssText
    root.appendChild(style)
  }

  panel = document.createElement("div")
  panel.id = "rst-panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-label", "restitutor")

  const head = document.createElement("div")
  head.className = "rst-head"
  const title = document.createElement("span")
  title.className = "rst-title"
  title.textContent = "restitutor"
  provenanceEl = document.createElement("span")
  provenanceEl.className = "rst-via"
  const close = document.createElement("button")
  close.className = "rst-close"
  close.type = "button"
  close.textContent = "×"
  close.setAttribute("aria-label", "close")
  close.addEventListener("click", () => {
    host!.remove()
    host = null
    panel = null
  })
  head.append(title, provenanceEl, close)

  const controls = document.createElement("div")
  controls.className = "rst-controls"
  systemSel = document.createElement("select")
  systemSel.setAttribute("aria-label", "target unit system")
  for (const [value, label] of Object.entries(SYSTEM_LABELS)) {
    const opt = document.createElement("option")
    opt.value = value
    opt.textContent = label
    if (value === DEFAULT_TARGET.system) opt.selected = true
    systemSel.appendChild(opt)
  }
  const geomLabel = document.createElement("label")
  geomBox = document.createElement("input")
  geomBox.type = "checkbox"
  geomLabel.append(geomBox, " geometrized")
  controls.append(systemSel, geomLabel)
  seededSpan = null
  systemSel.addEventListener("change", runTranslate)
  geomBox.addEventListener("change", runTranslate)

  resultsEl = document.createElement("div")
  resultsEl.className = "rst-results"
  resultsEl.setAttribute("aria-live", "polite")

  panel.append(head, controls, resultsEl)
  renderCards()
  root.appendChild(panel)
  document.body.appendChild(host)
}

function runTranslate(): void {
  const spec: TargetSpec = {
    system: systemSel.value as UnitSystem,
    geometrized: geomBox.checked,
  }
  // Real pages carry arbitrary TeX; an engine crash must degrade into an
  // honest report, never a dead panel.
  try {
    // The page's own declarations ("where Σ is the surface density") extend
    // the registry for this page — census §6.5: the declaration wins, and
    // the legend says where each reading came from.
    let registry = pageSymbols.length ? registryWithDeclarations(profile.registry, pageSymbols) : profile.registry
    // A symbol the page DEFINES ("κ = 8πG/c⁴") takes its expression's
    // dimension, computed by the engine under the readings above.
    if (pageDefinitions.length || pageSymbols.some((s) => s.expr))
      registry = registryWithDefinitions(registry, { symbols: pageSymbols, definitions: pageDefinitions }, katex)
    // A named mathematical object (SL(2,R), a set, a map) is refused before
    // the engine can read it as a product of quantities.
    const result = refuseNonEquation(currentTex) ?? translateTex(currentTex, katex, registry, spec)
    renderTranslation(resultsEl, result, spec, currentTex, katex)
  } catch (e) {
    resultsEl.textContent = ""
    const card = document.createElement("div")
    card.className = "card"
    const p = document.createElement("p")
    p.style.margin = "0"
    const badge = document.createElement("span")
    badge.className = "verdict warn"
    badge.textContent = "Engine error"
    p.append(
      badge,
      ` — the extracted TeX crashed the engine (${e instanceof Error ? e.message : String(e)}). The extraction itself is shown below; this is a bug worth reporting.`,
    )
    const pre = document.createElement("pre")
    pre.textContent = currentTex
    card.append(p, pre)
    resultsEl.appendChild(card)
  }
}

function openPanel(c: MathCandidate): void {
  // The page can remove the panel by routes other than our close button
  // (SPA re-renders, cleanup scripts) — a disconnected panel means rebuild.
  if (!panel || !panel.isConnected) buildPanel()
  currentTex = c.tex
  provenanceEl.textContent = `TeX via ${VIA_LABEL[c.via]} · profile: ${profile.id}`
  seedTarget(c)
  runTranslate()
}

const decorated = new WeakSet<Element>()
const pool: MathCandidate[] = []

function decorate(candidates: MathCandidate[]): number {
  let added = 0
  for (const c of candidates) {
    const target = c.displayEl as unknown as HTMLElement
    if (!(target instanceof Element) || decorated.has(target)) continue
    decorated.add(target)
    pool.push(c)
    added++
    target.classList.add("rst-math")
    // title on a MathML element shows nothing in Chrome; hang the tooltip on
    // the nearest HTML ancestor (ar5iv: td.ltx_eqn_cell) in that case.
    const tipHost =
      target.tagName.toLowerCase() === "math" ? (target.parentElement ?? target) : target
    if (!tipHost.hasAttribute("title")) tipHost.setAttribute("title", "restitutor: click to translate")
    target.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      openPanel(c)
    })
  }
  return added
}

// Document-level detection (census section 6): prose declarations, the
// ladder, body-level visible constants across everything extracted so far.
// Spans (census section 6.2) and the equation pool come from page.ts, which
// touches only the standard DOM so the node tests over captured pages run
// the same code; here the span of each pooled equation is remembered for
// seeding the translate target by the equation the reader clicked.
function documentSpans(): Span[] {
  const { spans, spanIdOf } = spansOfPage(document, equationPool(pool))
  for (const [c, id] of spanIdOf) spanOf.set(c, id)
  return spans
}

function runDetection(): void {
  try {
    const spans = documentSpans()
    pageDocument = inferDocument(spans)
    pageDetection = pageDocument.overall
    // The dimensionless forks (census §5), recovered from printed forms.
    pageForks = detectForks({
      text: spans.map((s) => s.text ?? "").join("\n"),
      equations: spans.flatMap((s) => s.equations ?? []),
    })
  } catch {
    pageDocument = null
    pageDetection = null // detection must never take the panel down with it
    pageForks = null
  }
  seededSpan = null
  if (panel?.isConnected) renderCards()
  // The miner runs off the load path; when it lands, the cards and an open
  // translation (whose registry it may extend) are refreshed.
  const mine = () => {
    try {
      // Declared symbols and constants-only definitions (page.ts; the
      // registry never sees a reading the text has not pinned down).
      const readings = pageReadings(document, pool, profile.registry, katex)
      pageSymbols = readings.symbols
      pageDefinitions = readings.definitions
    } catch {
      pageSymbols = []
      pageDefinitions = []
    }
    if (panel?.isConnected) {
      renderCards()
      if (currentTex) runTranslate()
    }
  }
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => mine(), { timeout: 2000 })
  else setTimeout(mine, 0)
}

function init(): void {
  loadKatexStylesheet()
  decorate(scanForMath(document))
  markCarrierless()
  runDetection()

  // Pages add math after document_idle (SPA navigation, lazily rendered
  // sections). Rescan on DOM growth, debounced; already-decorated elements
  // are skipped and detection is recomputed over the enlarged pool. Our own
  // panel host is a light-DOM insertion too and is ignored.
  let timer: number | undefined
  const observer = new MutationObserver((records) => {
    const grew = records.some((r) =>
      [...r.addedNodes].some((n) => n.nodeType === 1 && n !== host && !(host && host.contains(n))),
    )
    if (!grew) return
    if (timer !== undefined) clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = undefined
      const added = decorate(scanForMath(document))
      markCarrierless()
      if (added) runDetection()
    }, 400)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// Registers KaTeX's @font-face rules at DOCUMENT level: Chrome ignores
// @font-face inside a shadow root, and a content_scripts stylesheet would
// resolve url() against the PAGE (fonts requested from the visited site).
// A runtime-URL link resolves against the extension origin; faces registered
// on the document apply to shadow-root content. The dev fixture links the
// stylesheet itself and has no chrome.runtime.
function loadKatexStylesheet(): void {
  const rt = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } })
    .chrome?.runtime
  if (!rt?.getURL) return
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = rt.getURL("katex.min.css")
  document.head.appendChild(link)
}

// Honesty marker (product contract: decline loudly, never silently skip):
// MathJax v3 renders math with NO TeX carrier in the DOM, so those elements
// can never be candidates. Say so on hover instead of ignoring them.
function markCarrierless(): void {
  const containers = document.querySelectorAll<HTMLElement>(
    "mjx-container, span.MathJax, div.MathJax_Display",
  )
  for (const el of containers) {
    // Anything inside (or containing) a decorated candidate is spoken for —
    // MathJax v2 display output nests spans under the decorated wrapper.
    if (el.closest(".rst-math") || el.querySelector(".rst-math")) continue
    el.classList.add("rst-carrierless")
    if (!el.hasAttribute("title"))
      el.setAttribute(
        "title",
        "restitutor: this math carries no TeX source in the page — nothing to look up (deterministic extraction only, no OCR)",
      )
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
