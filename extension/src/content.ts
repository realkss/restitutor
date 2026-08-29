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
import { renderTranslation } from "../../app/resultView"
import { MathCandidate, scanForMath } from "./extract"

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

let panel: HTMLElement | null = null
let resultsEl: HTMLElement
let provenanceEl: HTMLElement
let systemSel: HTMLSelectElement
let geomBox: HTMLInputElement
let currentTex = ""

function buildPanel(): void {
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
    panel!.remove()
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
  systemSel.addEventListener("change", runTranslate)
  geomBox.addEventListener("change", runTranslate)

  resultsEl = document.createElement("div")
  resultsEl.className = "rst-results"

  panel.append(head, controls, resultsEl)
  document.body.appendChild(panel)
}

function runTranslate(): void {
  const spec: TargetSpec = {
    system: systemSel.value as UnitSystem,
    geometrized: geomBox.checked,
  }
  // Real pages carry arbitrary TeX; an engine crash must degrade into an
  // honest report, never a dead panel.
  try {
    const result = translateTex(currentTex, katex, profile.registry, spec)
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
  if (!panel) buildPanel()
  currentTex = c.tex
  provenanceEl.textContent = `TeX via ${VIA_LABEL[c.via]} · profile: ${profile.id}`
  runTranslate()
}

function init(): void {
  const candidates = scanForMath(document)
  for (const c of candidates) {
    const target = c.displayEl as unknown as HTMLElement
    if (!(target instanceof Element)) continue
    target.classList.add("rst-math")
    if (!target.hasAttribute("title")) target.setAttribute("title", "restitutor: click to translate")
    target.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      openPanel(c)
    })
  }
  markCarrierless()
}

// Honesty marker (product contract: decline loudly, never silently skip):
// MathJax v3 renders math with NO TeX carrier in the DOM, so those elements
// can never be candidates. Say so on hover instead of ignoring them.
function markCarrierless(): void {
  const containers = document.querySelectorAll<HTMLElement>(
    "mjx-container, span.MathJax, div.MathJax_Display",
  )
  for (const el of containers) {
    if (el.classList.contains("rst-math")) continue // v2 pairs decorated via their script
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
