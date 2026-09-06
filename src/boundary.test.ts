// The import boundary (product-design §3, §3.1). The engine imports nothing;
// the deterministic core under src/ imports only its siblings, never the
// surfaces (app/, extension/) and never any context-reading layer that may
// be added beside it later. A reading reaches the registry through
// bridge.registryTrusts alone, so nothing outside src/ can hand the engine a
// dimension the text did not pin down.
import test, { describe } from "node:test"
import assert from "node:assert"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const src = fileURLToPath(new URL("./", import.meta.url))
const IMPORT = /^\s*(?:import|export)\b[^"'\n]*?\bfrom\s*["']([^"']+)["']/gm

const importsOf = (file: string): string[] =>
  [...readFileSync(join(src, file), "utf8").matchAll(IMPORT)].map((m) => m[1])

describe("the import boundary of the deterministic core", () => {
  test("the engine imports nothing", () => {
    assert.deepStrictEqual(importsOf("unitsEngine.ts"), [])
  })
  test("every core module imports only its siblings under src/ (tests may import node and katex)", () => {
    const files = readdirSync(src).filter((f) => f.endsWith(".ts"))
    assert.ok(files.length > 10)
    for (const file of files) {
      const isTest = file.endsWith(".test.ts")
      for (const spec of importsOf(file)) {
        const sibling = /^\.\/[A-Za-z0-9_.-]+$/.test(spec)
        const testOnly = isTest && (spec.startsWith("node:") || spec === "katex")
        assert.ok(sibling || testOnly, `${file} imports "${spec}", which is outside src/`)
      }
    }
  })
  test("the registry is extended through registryTrusts alone", () => {
    const bridge = readFileSync(join(src, "bridge.ts"), "utf8")
    assert.ok(/export function registryTrusts\(/.test(bridge))
    // The two override paths place readings through the shared helper, and
    // the declarations path consults the gate before it places anything.
    const declarations = bridge.slice(bridge.indexOf("export function registryWithDeclarations("))
    assert.ok(declarations.indexOf("registryTrusts(s)") < declarations.indexOf("withReading("))
  })
})
