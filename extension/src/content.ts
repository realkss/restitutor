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
  "alttext": "MathML alttext (LaTeXML)",
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
  const result = translateTex(currentTex, katex, profile.registry, spec)
  renderTranslation(resultsEl, result, spec, currentTex, katex)
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
    if (!(target instanceof HTMLElement) && !(target instanceof Element)) continue
    target.classList.add("rst-math")
    target.setAttribute("title", "restitutor: click to translate")
    target.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      openPanel(c)
    })
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
