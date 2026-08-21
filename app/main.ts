// Stage-1 paste box: the site floater's translation flow, without the site.
import katexDefault from "katex"
import {
  DEFAULT_TARGET,
  SYSTEM_LABELS,
  TargetSpec,
  TranslationResult,
  UnitSystem,
  findRegistryForSlug,
  translateTex,
} from "../src/unitsEngine"

const katex = katexDefault as unknown as {
  render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void
  __parse: (tex: string, options?: Record<string, unknown>) => any[]
}

const registry = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")
if (!registry) throw new Error("GR registry not found")

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

function mathCard(title: string, tex: string): HTMLElement {
  const card = document.createElement("div")
  card.className = "card"
  const h = document.createElement("h2")
  h.textContent = title
  card.appendChild(h)
  const m = document.createElement("div")
  try {
    katex.render(tex, m, { displayMode: true, throwOnError: false })
  } catch {
    m.textContent = tex
  }
  card.appendChild(m)
  return card
}

function render(result: TranslationResult, spec: TargetSpec, sourceTex: string) {
  outEl.textContent = ""
  const head = document.createElement("div")
  head.className = "card"
  const verdict = document.createElement("p")
  verdict.style.margin = "0"
  const badge = (cls: string, label: string, rest: string) => {
    const span = document.createElement("span")
    span.className = cls
    span.textContent = label
    verdict.append(span, rest)
  }
  if (result.kind === "translated") {
    badge(
      "verdict ok",
      "Translated",
      ` — target ${SYSTEM_LABELS[spec.system]}` +
        (spec.geometrized ? ", geometrized (constants verified, then stripped)" : "") +
        (result.changed ? "" : " — already in target form"),
    )
  } else if (result.kind === "no-anchor") {
    badge("verdict", "No anchor", " — nothing in this equation needs restoration.")
  } else {
    badge("verdict warn", "Declined", " — the registry cannot vouch for this equation.")
  }
  head.appendChild(verdict)
  if (result.kind === "declined") {
    const ul = document.createElement("ul")
    ul.className = "reasons"
    for (const r of result.reasons) {
      const li = document.createElement("li")
      li.textContent = `Declined: this equation contains ${r}.`
      ul.appendChild(li)
    }
    head.appendChild(ul)
  }
  outEl.appendChild(head)

  outEl.appendChild(mathCard("Source", sourceTex))
  if (result.kind === "translated") {
    const card = mathCard("Restored", result.restoredTex)
    if (result.targetUnitTex) {
      const u = document.createElement("p")
      u.className = "unitline"
      u.textContent = "Both sides carry the unit: "
      const span = document.createElement("span")
      katex.render(result.targetUnitTex, span, { throwOnError: false })
      u.appendChild(span)
      card.appendChild(u)
    }
    outEl.appendChild(card)
  }

  if (result.legend.length) {
    const card = document.createElement("div")
    card.className = "card"
    const h = document.createElement("h2")
    h.textContent = "Legend"
    card.appendChild(h)
    const table = document.createElement("table")
    table.className = "legend"
    table.innerHTML = "<thead><tr><th>Symbol</th><th>Reading</th><th>Unit</th></tr></thead>"
    const tbody = document.createElement("tbody")
    for (const e of result.legend) {
      const tr = document.createElement("tr")
      const tdSym = document.createElement("td")
      katex.render(e.tex, tdSym, { throwOnError: false })
      const tdGloss = document.createElement("td")
      tdGloss.textContent = e.gloss
      const tdUnit = document.createElement("td")
      katex.render(e.unit, tdUnit, { throwOnError: false })
      tr.append(tdSym, tdGloss, tdUnit)
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    card.appendChild(table)
    outEl.appendChild(card)
  }
}

function run() {
  const spec: TargetSpec = {
    system: systemEl.value as UnitSystem,
    geometrized: geomEl.checked,
  }
  const tex = texEl.value
  const result = translateTex(tex, katex, registry!, spec)
  render(result, spec, tex)
}

$("go").addEventListener("click", run)
texEl.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") run()
})
run()
