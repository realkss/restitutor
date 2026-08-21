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
        (spec.geometrized
          ? result.changed
            ? ", geometrized (constants verified, then stripped)"
            : ", geometrized"
          : "") +
        (result.changed ? "" : " — already in target form"),
    )
  } else if (result.kind === "no-anchor") {
    badge(
      "verdict",
      "No anchor",
      " — no relation to anchor the target dimension; paste a full equation, not a bare expression.",
    )
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
    for (const sym of result.unknown) {
      const li = document.createElement("li")
      li.textContent = `Unknown symbol: ${sym} — not in the registry's readings.`
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
      tdUnit.textContent = e.unit
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

// ---------------------------------------------------------------------------
// Convention inspector: the generator-parameterized layer, live.
// ---------------------------------------------------------------------------
import { CONVENTIONS, EM_RIDERS, activeRiders, validateConvention } from "../src/convention"

const convEl = $<HTMLSelectElement>("conv")
const convOut = $("convOut")

/** Which E&M rendering's rider table demonstrates the span rule for each convention. */
const RENDERING: Record<string, string> = {
  si: "si",
  gaussian: "gaussian",
  esu: "esu",
  emu: "emu",
  "heaviside-lorentz": "heaviside-lorentz",
  "geometrized-gaussian": "gaussian",
  "gaussian-natural": "gaussian",
  "planck-gaussian": "gaussian",
  "geometrized-hl": "heaviside-lorentz",
  "hep-hl": "heaviside-lorentz",
  "hep-hl-kb": "heaviside-lorentz",
  "planck-hl": "heaviside-lorentz",
}

for (const [key, c] of Object.entries(CONVENTIONS)) {
  const opt = document.createElement("option")
  opt.value = key
  opt.textContent = c.name
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
      li.textContent = `implied physical restriction: ${grp}`
      ul.appendChild(li)
    }
    card.appendChild(ul)
  }
  convOut.appendChild(card)

  if (c.generators.length) {
    const gcard = document.createElement("div")
    gcard.className = "card"
    const gh = document.createElement("h2")
    gh.textContent = "Generators set to 1"
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
      tdF.textContent = gen.numericFactor
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
        li.textContent = `${r.symbol} ${r.direction === "multiply" ? "×" : "÷"} ${r.factorTex.replace("\\pi", "π").replace("4π", "4π")}: ${state}`
        ul.appendChild(li)
      }
      rcard.appendChild(ul)
    }
    convOut.appendChild(rcard)
  }
}

convEl.addEventListener("change", inspect)
inspect()
