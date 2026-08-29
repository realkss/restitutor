// Bundle the stage-2 extension into extension/dist/ — a load-unpacked-ready
// directory (manifest + content script + panel css + KaTeX css/fonts, all
// local; the extension makes no network requests). Also drops a copy of the
// content script into app/dist/ so app/fixtures/stage2.html can exercise the
// scan-decorate-translate flow in an ordinary browser tab, no install needed.
import { build } from "esbuild"
import { cpSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("..", import.meta.url))
const p = (...parts) => join(root, ...parts)

mkdirSync(p("extension/dist"), { recursive: true })
mkdirSync(p("app/dist"), { recursive: true })

await build({
  entryPoints: [p("extension/src/content.ts")],
  bundle: true,
  format: "iife", // content scripts are classic scripts, not modules
  outfile: p("extension/dist/content.js"),
  logLevel: "info",
})

cpSync(p("extension/manifest.json"), p("extension/dist/manifest.json"))
cpSync(p("extension/panel.css"), p("extension/dist/panel.css"))
cpSync(p("node_modules/katex/dist/katex.min.css"), p("extension/dist/katex.min.css"))
cpSync(p("node_modules/katex/dist/fonts"), p("extension/dist/fonts"), { recursive: true })

// Dev fixture copies (app/dist is gitignored and served by the preview
// server). KaTeX's css + fonts too, so the fixture renders correctly on a
// clean clone without a prior build:app.
cpSync(p("extension/dist/content.js"), p("app/dist/content.js"))
cpSync(p("extension/panel.css"), p("app/dist/panel.css"))
cpSync(p("node_modules/katex/dist/katex.min.css"), p("app/dist/katex.min.css"))
cpSync(p("node_modules/katex/dist/fonts"), p("app/dist/fonts"), { recursive: true })

console.log("extension built: load-unpacked directory = extension/dist/")
