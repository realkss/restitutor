// Stage-1 paste box: the site floater's translation flow, without the site.
import katexDefault from "katex"
import {
  DEFAULT_TARGET,
  SYSTEM_LABELS,
  TargetSpec,
  UnitSystem,
  translateTex,
} from "../src/unitsEngine"

const katex = katexDefault as unknown as {
  render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void
  __parse: (tex: string, options?: Record<string, unknown>) => any[]
}

import { defaultProfile } from "../src/profiles"

const registry = defaultProfile().registry

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const texEl = $<HTMLTextAreaElement>("tex")
const systemEl = $<HTMLSelectElement>("system")
const geomEl = $<HTMLInputElement>("geom")
const outEl = $("out")

for (const [value, label] of Object.entries(SYSTEM_LABELS)) {
  const opt = document.createElement("option")
  opt.value = value
  opt.textContent = label
  if (value === DEFAULT_TARGET.system) opt.selected = true
  systemEl.appendChild(opt)
}

const SAMPLES: [string, string][] = [
  ["Einstein", "G_{ab} + \\Lambda g_{ab} = 8\\pi T_{ab}"],
  ["Christoffel", "\\Gamma^{a}_{bc} = \\tfrac{1}{2} g^{ad} (\\partial_b g_{dc} + \\partial_c g_{bd} - \\partial_d g_{bc})"],
  ["Schwarzschild", "ds^2 = -(1 - \\tfrac{2M}{r})\\, dt^2 + (1 - \\tfrac{2M}{r})^{-1} dr^2 + r^2\\, d\\Omega^2"],
  ["Decliner", "\\psi_4 = \\chi \\, \\Xi^{ab} \\, T_{ab}"],
]
const samplesEl = $("samples")
for (const [label, tex] of SAMPLES) {
  const b = document.createElement("button")
  b.type = "button"
  b.textContent = label
  b.addEventListener("click", () => {
    texEl.value = tex
    run()
  })
  samplesEl.appendChild(b)
}

import { renderTranslation } from "./resultView"

function run() {
  const spec: TargetSpec = {
    system: systemEl.value as UnitSystem,
    geometrized: geomEl.checked,
  }
  const tex = texEl.value
  const result = translateTex(tex, katex, registry, spec)
  renderTranslation(outEl, result, spec, tex, katex)
  syncInspectorToTarget(spec)
}

$("go").addEventListener("click", run)
texEl.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") run()
})

// ---------------------------------------------------------------------------
// Convention inspector: the generator-parameterized layer, live — and wired:
// the translate target drives it (src/bridge.ts).
// ---------------------------------------------------------------------------
import { CONVENTIONS, EM_RIDERS, TIERS, activeRiders, validateConvention } from "../src/convention"
import { RENDERING } from "./rendering"
import { conventionKeyForTarget } from "../src/bridge"

function syncInspectorToTarget(spec: TargetSpec) {
  convEl.value = conventionKeyForTarget(spec)
  inspect()
}

const convEl = $<HTMLSelectElement>("conv")
const convOut = $("convOut")

for (const [key, c] of Object.entries(CONVENTIONS)) {
  const opt = document.createElement("option")
  opt.value = key
  const tier = TIERS[key]
  opt.textContent = (tier && tier !== "v1" ? `[${tier}] ` : "") + c.name
  if (key === "geometrized") opt.selected = true
  convEl.appendChild(opt)
}

function inspect() {
  const key = convEl.value
  const c = CONVENTIONS[key]
  const v = validateConvention(c)
  convOut.textContent = ""

  const card = document.createElement("div")
  card.className = "card"
  const h = document.createElement("h2")
  h.textContent = "Validation"
  card.appendChild(h)
  const p = document.createElement("p")
  p.style.margin = "0"
  const badge = document.createElement("span")
  badge.className = v.kind === "over-determined" ? "verdict warn" : "verdict ok"
  badge.textContent = v.kind
  p.appendChild(badge)
  p.append(
    ` — ${v.generatorCount} generator${v.generatorCount === 1 ? "" : "s"}, rank ${v.rank}, residual dimension rank ${v.residualRank}`,
  )
  card.appendChild(p)
  if (v.residualRank === 0) {
    const note = document.createElement("p")
    note.className = "unitline"
    note.textContent =
      "Residual rank 0: dimensional checking is vacuous here — the engine's value is restoration only (census §1.6)."
    card.appendChild(note)
  }
  if (v.kind === "over-determined") {
    const ul = document.createElement("ul")
    ul.className = "reasons"
    for (const grp of v.impliedGroups) {
      const li = document.createElement("li")
      li.append("implied physical restriction: ")
      const span = document.createElement("span")
      katex.render(grp, span, { throwOnError: false })
      li.appendChild(span)
      ul.appendChild(li)
    }
    card.appendChild(ul)
  }
  convOut.appendChild(card)

  if (c.generators.length) {
    const gcard = document.createElement("div")
    gcard.className = "card"
    const gh = document.createElement("h2")
    gh.textContent = "Generators (set to 1 unless marked inserted)"
    gcard.appendChild(gh)
    const table = document.createElement("table")
    table.className = "legend"
    const thead = document.createElement("thead")
    const hr = document.createElement("tr")
    for (const t of ["Emits", "Factor", "Kind"]) {
      const th = document.createElement("th")
      th.textContent = t
      hr.appendChild(th)
    }
    thead.appendChild(hr)
    table.appendChild(thead)
    const tbody = document.createElement("tbody")
    for (const gen of c.generators) {
      const tr = document.createElement("tr")
      const tdE = document.createElement("td")
      katex.render(gen.emits, tdE, { throwOnError: false })
      const tdF = document.createElement("td")
      katex.render(gen.numericFactor, tdF, { throwOnError: false })
      const tdK = document.createElement("td")
      tdK.textContent = gen.kind + (gen.role === "inserted" ? " (inserted)" : "")
      tr.append(tdE, tdF, tdK)
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    gcard.appendChild(table)
    convOut.appendChild(gcard)
  }

  const rendering = RENDERING[key]
  if (rendering) {
    const riders = EM_RIDERS[rendering]
    const rcard = document.createElement("div")
    rcard.className = "card"
    const rh = document.createElement("h2")
    rh.textContent = `E&M riders (${rendering} rendering) under the span rule`
    rcard.appendChild(rh)
    if (!riders.length) {
      const none = document.createElement("p")
      none.style.margin = "0"
      none.textContent = "None — SI is the plain quotient's own rendering."
      rcard.appendChild(none)
    } else {
      const active = new Set(activeRiders(c, riders))
      const ul = document.createElement("ul")
      ul.className = "reasons"
      for (const r of riders) {
        const li = document.createElement("li")
        const state = active.has(r) ? "ACTIVE" : "suppressed — the solve supplies this factor"
        const symSpan = document.createElement("span")
        katex.render(r.symbol, symSpan, { throwOnError: false })
        const factorLabel = { "c": "c", "4\\pi": "4π", "2\\pi": "2π" }[r.factorTex] ?? r.factorTex
        li.append(symSpan, ` ${r.direction === "multiply" ? "×" : "÷"} ${factorLabel}: ${state}`)
        ul.appendChild(li)
      }
      rcard.appendChild(ul)
    }
    convOut.appendChild(rcard)
  }
}

convEl.addEventListener("change", inspect)

// ---------------------------------------------------------------------------
// Numeric converter panel: the equivalence graph, decline-loudly included.
// ---------------------------------------------------------------------------
import { convert, knownUnits } from "../src/converter"
import { recognizeContractConstant } from "../src/contract"
import type { Medium } from "../src/converter"

const cvValue = $<HTMLInputElement>("convValue")
const cvFrom = $<HTMLSelectElement>("convFrom")
const cvTo = $<HTMLSelectElement>("convTo")
const cvMedium = $<HTMLSelectElement>("convMedium")
const cvAirIndex = $<HTMLInputElement>("convAirIndex")
const cvResult = $("convResult")

for (const u of knownUnits()) {
  for (const sel of [cvFrom, cvTo]) {
    const opt = document.createElement("option")
    opt.value = u
    opt.textContent = u === "K" ? "K (kelvin)" : u === "kayser" ? "kayser (= cm⁻¹)" : u
    sel.appendChild(opt)
  }
}
cvFrom.value = "nm"
cvTo.value = "eV"

function runConvert() {
  cvResult.textContent = ""
  const card = document.createElement("div")
  card.className = "card"
  const value = Number(cvValue.value)
  const p = document.createElement("p")
  p.style.margin = "0"
  if (!Number.isFinite(value)) {
    p.textContent = "Declined: the value is not a number."
  } else {
    const opts: { medium?: Medium; airIndex?: number } = {}
    if (cvMedium.value) opts.medium = cvMedium.value as Medium
    if (cvAirIndex.value.trim() !== "") opts.airIndex = Number(cvAirIndex.value)
    const r = convert(value, cvFrom.value, cvTo.value, opts)
    if (r.kind === "converted") {
      const badge = document.createElement("span")
      badge.className = "verdict ok"
      badge.textContent = "Converted"
      const mediumNote = "medium" in r && r.medium ? ` (${r.medium})` : ""
      p.append(badge, ` — ${value} ${cvFrom.value} = ${r.value.toPrecision(8)} ${cvTo.value}${mediumNote}`)
    } else {
      const badge = document.createElement("span")
      badge.className = "verdict warn"
      badge.textContent = "Declined"
      p.append(badge, ` — ${r.reason}`)
    }
    const contract = recognizeContractConstant(value)
    if (contract.kind === "unit-contract") {
      const note = document.createElement("p")
      note.className = "unitline"
      note.textContent = `Aside: as a bare formula prefactor (not as this converted quantity), ${value} would be the unit-contract constant ${contract.constant.meaning} (${contract.constant.contract}) — tag it, and never restore on top.`
      card.appendChild(note)
    }
  }
  card.prepend(p)
  cvResult.appendChild(card)
}
$("convGo").addEventListener("click", runConvert)

// Initial render last: run() translates AND syncs the inspector to the target.
run()
runConvert()
