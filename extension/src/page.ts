// The page as the content script reads it: sections as spans (census §6.2),
// the miner's surface, the detection prose surface, and the readings the
// page contributes. Everything here takes the document as an argument and
// touches only the standard DOM, so the same code runs in the extension and
// in the node tests over captured pages (test/fixtures/), which is where the
// browser boundary is actually verified.
import type { Span } from "../../src/detect"
import { definitionsFromEquations, usableDefinitions } from "../../src/bridge"
import { MinedDefinition, MinedSymbol, mineDeclarations } from "../../src/mine"
import type { HubRegistry } from "../../src/unitsEngine"
import { MathCandidate, normalizeTex } from "./extract"

type Katex = { __parse: (tex: string, options?: Record<string, unknown>) => unknown[] }

export type SectionSpec = { label: string; nodes: Element[]; text: string }

/** LaTeXML: every top-level section and appendix, with its paragraphs. */
export function latexmlSections(doc: Document): SectionSpec[] {
  const sections = [...doc.querySelectorAll(".ltx_section, .ltx_appendix")].filter(
    (s) => !s.parentElement?.closest(".ltx_section, .ltx_appendix"),
  )
  return sections.map((sec, i) => {
    const title = (sec.querySelector(".ltx_title")?.textContent ?? "").replace(/\s+/g, " ").trim()
    const paras = [...sec.querySelectorAll(".ltx_para")].filter((q) => !q.closest(".ltx_bibliography")).slice(0, 40)
    return { label: title || "Section " + (i + 1), nodes: [sec], text: paras.map((q) => q.textContent ?? "").join("\n") }
  })
}

/**
 * Wikipedia: the parser output split at its level-2 headings; the lead
 * paragraphs form a span of their own. Parsoid output wraps every level-2
 * section (subsections nested inside) in <section data-mw-section-id>, the
 * lead being section 0; the legacy parser leaves a flat list of blocks with
 * the headings between them.
 */
export function wikipediaSections(doc: Document): SectionSpec[] {
  const root = doc.querySelector(".mw-parser-output")
  if (!root) return []
  const parsoid = [...root.querySelectorAll(":scope > section[data-mw-section-id]")]
  if (parsoid.length > 1) {
    return parsoid.map((sec) => {
      const h = sec.querySelector(":scope > .mw-heading h2, :scope > h2")
      const label = (h?.textContent ?? "").replace(/\s+/g, " ").trim() || "Lead"
      return { label, nodes: [sec], text: (sec.textContent ?? "").slice(0, 120000) }
    })
  }
  const out: SectionSpec[] = []
  let cur: SectionSpec = { label: "Lead", nodes: [], text: "" }
  const flush = () => {
    if (cur.nodes.length) out.push(cur)
  }
  for (const el of root.children) {
    const heading = el.matches(".mw-heading2") ? el.querySelector("h2") : el.matches("h2") ? el : null
    if (heading) {
      flush()
      cur = { label: (heading.textContent ?? "").replace(/\s+/g, " ").trim() || "Section", nodes: [], text: "" }
      continue
    }
    cur.nodes.push(el)
    if (el.matches("p, ul, ol, dl, blockquote, div")) cur.text += (el.textContent ?? "") + "\n"
  }
  flush()
  return out.length > 1 ? out : []
}

/**
 * The equation pool is the page's DISPLAY equations when it has enough of
 * them — inline single symbols are not equations and would dilute every
 * count ("G explicit in 11 of 499") — and every math element otherwise
 * (Wikipedia flags nothing as display). The cap applies after selecting.
 */
export function equationPool(candidates: MathCandidate[]): MathCandidate[] {
  const live = candidates.filter((c) => (c.displayEl as unknown as Element).isConnected)
  const displays = live.filter((c) => c.display)
  return (displays.length >= 8 ? displays : live).slice(0, 1500)
}

/**
 * Spans (census §6.2): on LaTeXML pages every top-level section and appendix
 * is a span with the equations that sit inside it, and the abstract with the
 * unclaimed equations forms one more; on Wikipedia the level-2 sections;
 * elsewhere the page is a single span. `spanIdOf` says which span each
 * pooled equation landed in, for seeding the translate target by the
 * equation the reader clicked.
 */
export function documentSpans(doc: Document, pool: MathCandidate[]): { spans: Span[]; spanIdOf: Map<MathCandidate, string> } {
  const spanIdOf = new Map<MathCandidate, string>()
  let sections = latexmlSections(doc)
  if (sections.length === 0) sections = wikipediaSections(doc)
  // A span's equations are the STATEMENTS its carriers hold: the rows of an
  // equation group, the pieces of a line joined by "and".
  const statements = (cs: MathCandidate[]) => cs.flatMap((c) => c.statements)
  if (sections.length === 0) {
    for (const c of pool) spanIdOf.set(c, "page")
    return { spans: [{ id: "page", label: "Page", text: proseSurface(doc), equations: statements(pool) }], spanIdOf }
  }
  const spans: Span[] = []
  const claimed = new Set<MathCandidate>()
  sections.forEach((sec, i) => {
    const eqs: string[] = []
    for (const c of pool) {
      const el = c.displayEl as unknown as Element
      if (!claimed.has(c) && sec.nodes.some((n) => n.contains(el))) {
        claimed.add(c)
        spanIdOf.set(c, "s" + i)
        eqs.push(...c.statements)
      }
    }
    spans.push({ id: "s" + i, label: sec.label, text: sec.text.slice(0, 120000), equations: eqs })
  })
  const rest = pool.filter((c) => !claimed.has(c))
  for (const c of rest) spanIdOf.set(c, "front")
  const front = doc.querySelector(".ltx_abstract")?.textContent ?? ""
  if (front || rest.length) spans.unshift({ id: "front", label: "Front matter", text: front, equations: statements(rest) })
  return { spans, spanIdOf }
}

/** The TeX a math element carries, normalized, or null when it carries none. */
export function mathTex(el: Element): string | null {
  const alt = el.getAttribute("alttext") ?? el.querySelector("math[alttext]")?.getAttribute("alttext")
  if (alt) return normalizeTex(alt)
  const ann = el.querySelector('annotation[encoding="application/x-tex"]')
  const tex = ann?.textContent?.trim()
  return tex ? normalizeTex(tex) : null
}

/**
 * The miner's surface: prose with every math element replaced by its TeX in
 * $…$. Rendered MathML's textContent glues glyphs to the annotation
 * ("aμa^{\mu}"), which no symbol grammar should be asked to read. Census
 * §6.5b widens the surface to captions, footnotes and table headers, which
 * declare symbols too ("A_⊥/h (MHz)").
 */
export function miningSurface(doc: Document): string {
  const ltx = [...doc.querySelectorAll(".ltx_para")].filter((p) => !p.closest(".ltx_bibliography"))
  const prose = ltx.length ? ltx.slice(0, 80) : [...doc.querySelectorAll("p")].slice(0, 400)
  const roots = [...prose, ...doc.querySelectorAll(".ltx_caption, figcaption, caption, .ltx_note, .reference-text, th")].slice(0, 600)
  const parts: string[] = []
  for (const root of roots) {
    const clone = root.cloneNode(true) as Element
    for (const m of clone.querySelectorAll("math, .mwe-math-element, .katex")) {
      if (!m.isConnected && !clone.contains(m)) continue
      const tex = mathTex(m)
      m.replaceWith(doc.createTextNode(tex ? " $" + tex + "$ " : " "))
    }
    parts.push((clone.textContent ?? "").replace(/\s+/g, " "))
  }
  return parts.join("\n").slice(0, 300000)
}

/**
 * The detection prose surface for a page with no sections: on LaTeXML the
 * abstract, the first paragraphs and any section titled conventions,
 * notation or units — never the bibliography, whose reference titles mention
 * every unit system there is; textContent, not innerText, so the x-tex
 * annotations come along. Elsewhere the body's text, capped.
 */
export function proseSurface(doc: Document): string {
  const parts: string[] = []
  const abstract = doc.querySelector(".ltx_abstract")
  if (abstract) parts.push(abstract.textContent ?? "")
  const paras = doc.querySelectorAll(".ltx_para")
  if (paras.length) {
    let n = 0
    for (const p of paras) {
      if (p.closest(".ltx_bibliography")) continue
      parts.push(p.textContent ?? "")
      if (++n >= 60) break
    }
    for (const sec of doc.querySelectorAll(".ltx_section, .ltx_subsection, .ltx_appendix")) {
      const title = sec.querySelector(".ltx_title")?.textContent ?? ""
      if (/convention|notation|units/i.test(title)) parts.push(sec.textContent ?? "")
    }
    return parts.join("\n").slice(0, 300000)
  }
  const body = doc.body as (HTMLElement & { innerText?: string }) | null
  return (body?.innerText ?? body?.textContent ?? "").slice(0, 300000)
}

/**
 * The readings the page contributes (census §6.5): declared symbols from the
 * miner, and definitions from the prose and from the equations, kept only
 * where they are built from constants (bridge.usableDefinitions). The
 * definitions scan runs over EVERY carrier, not the display pool: Wikipedia
 * marks "κ = 8πG/c⁴ ≈ 2.07665 × 10⁻⁴³ N⁻¹" inline on the field-equations
 * article, and a lone symbol equated to constants is a definition wherever
 * it is printed.
 */
export function pageReadings(
  doc: Document,
  candidates: MathCandidate[],
  registry: HubRegistry,
  katex: Katex,
): { symbols: MinedSymbol[]; definitions: MinedDefinition[] } {
  const mined = mineDeclarations(miningSurface(doc))
  const symbols = mined.symbols.slice(0, 12)
  const fromEquations = definitionsFromEquations(
    candidates.flatMap((c) => c.statements).slice(0, 3000),
    registry,
    katex,
  )
  const known = new Set(mined.definitions.map((d) => d.symbol))
  const definitions = usableDefinitions(
    registry,
    { symbols, definitions: [...mined.definitions, ...fromEquations.filter((d) => !known.has(d.symbol))] },
    katex,
  ).slice(0, 20)
  return { symbols, definitions }
}
