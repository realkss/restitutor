// TeX-level normalizations that sit in front of the frozen engine. The engine
// reads KaTeX parse trees and re-emits the equation it read as a check on
// itself; a construct its emitter cannot reproduce is declined as a
// reassembly fault. Rewriting such a construct to an equivalent one the
// emitter knows keeps the engine frozen and the page readable.

const OVER = /\\over(?![a-zA-Z])/

/** True when the character at i is preceded by an odd run of backslashes (an escaped brace). */
function escaped(s: string, i: number): boolean {
  let n = 0
  for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) n++
  return n % 2 === 1
}

/**
 * TeX's primitive fraction, `{a \over b}`, as Wikipedia's alttext prints
 * one display equation in ten, rewritten to `{\frac{a}{b}}`: the same
 * group, the same fraction, in the form the engine's emitter reproduces.
 * The enclosing brace group is found by scanning, so nested fractions fold
 * inner-first. A top-level `\over` with no enclosing group (TeX's "the
 * whole equation is the numerator") is left alone; the engine declines it
 * and says so.
 */
export function overToFrac(tex: string): string {
  let s = tex
  for (let guard = 0; guard < 60; guard++) {
    const k = s.search(OVER)
    if (k < 0) break
    let start = -1
    for (let j = k - 1, depth = 0; j >= 0; j--) {
      if (escaped(s, j)) continue
      if (s[j] === "}") depth++
      else if (s[j] === "{") {
        if (depth === 0) {
          start = j
          break
        }
        depth--
      }
    }
    let end = -1
    for (let j = k + 5, depth = 0; j < s.length; j++) {
      if (escaped(s, j)) continue
      if (s[j] === "{") depth++
      else if (s[j] === "}") {
        if (depth === 0) {
          end = j
          break
        }
        depth--
      }
    }
    if (start < 0 || end < 0) return s
    const a = s.slice(start + 1, k).trim()
    const b = s.slice(k + 5, end).trim()
    s = s.slice(0, start) + "{\\frac{" + a + "}{" + b + "}}" + s.slice(end + 1)
  }
  return s
}
