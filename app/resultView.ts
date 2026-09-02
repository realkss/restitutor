// Shared translation-result view: the verdict/source/restored/legend cards,
// used by both the stage-1 paste box and the stage-2 extension panel.
import { SYSTEM_LABELS, TargetSpec, TranslationResult } from "../src/unitsEngine"

export type KatexLike = {
  render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void
}

function mathCard(katex: KatexLike, title: string, tex: string): HTMLElement {
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

const QUOTE_L = String.fromCharCode(0x201c)
const QUOTE_R = String.fromCharCode(0x201d)
// Backslash, caret, underscore, braces: the fragment is TeX, not a word.
const TEXISH = new RegExp("[" + String.fromCharCode(92) + "^_{}]")

/**
 * A quoted fragment of an engine explanation, as inline math when it looks
 * like TeX (or is a lone symbol), otherwise as the quoted word it is. A
 * fragment KaTeX cannot parse falls back to its quoted source text.
 */
function inlineMath(katex: KatexLike, tex: string, force = false): HTMLElement {
  const span = document.createElement("span")
  const mathy = force || TEXISH.test(tex) || /^[A-Za-z]$/.test(tex)
  if (!mathy) {
    span.textContent = QUOTE_L + tex + QUOTE_R
    return span
  }
  try {
    katex.render(tex, span, { throwOnError: true })
  } catch {
    span.textContent = QUOTE_L + tex + QUOTE_R
  }
  return span
}

/**
 * Engine explanations quote the offending TeX in curly quotes; render each
 * quoted fragment so the reader sees the symbol, not its source.
 */
function explain(katex: KatexLike, el: HTMLElement, text: string): void {
  const parts = text.split(QUOTE_L)
  el.append(parts[0])
  for (let i = 1; i < parts.length; i++) {
    const close = parts[i].indexOf(QUOTE_R)
    if (close < 0) {
      el.append(QUOTE_L + parts[i])
      continue
    }
    el.append(inlineMath(katex, parts[i].slice(0, close)), parts[i].slice(close + 1))
  }
}

export function renderTranslation(
  outEl: HTMLElement,
  result: TranslationResult,
  spec: TargetSpec,
  sourceTex: string,
  katex: KatexLike,
): void {
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
      " — no relation to anchor the target dimension; a full equation is needed, not a bare expression.",
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
      li.append("Declined: this equation contains ")
      explain(katex, li, r)
      li.append(".")
      ul.appendChild(li)
    }
    for (const sym of result.unknown) {
      const li = document.createElement("li")
      li.append("Unknown symbol: ", inlineMath(katex, sym, true), " — not in the registry's readings.")
      ul.appendChild(li)
    }
    head.appendChild(ul)
  }
  outEl.appendChild(head)

  outEl.appendChild(mathCard(katex, "Source", sourceTex))
  if (result.kind === "translated") {
    const card = mathCard(katex, "Restored", result.restoredTex)
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
