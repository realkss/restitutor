// Bundle the stage-1 paste-box app and stage KaTeX's stylesheet + fonts locally
// (the site's charter and this repo's posture agree: no runtime CDN requests).
import { build } from "esbuild"
import { cpSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

// Resolve from the repo root regardless of the caller's cwd.
const root = fileURLToPath(new URL("..", import.meta.url))
const p = (...parts) => join(root, ...parts)

mkdirSync(p("app/dist"), { recursive: true })

await build({
  entryPoints: [p("app/main.ts")],
  bundle: true,
  format: "esm",
  outfile: p("app/dist/main.js"),
  logLevel: "info",
})

cpSync(p("node_modules/katex/dist/katex.min.css"), p("app/dist/katex.min.css"))
cpSync(p("node_modules/katex/dist/fonts"), p("app/dist/fonts"), { recursive: true })
console.log("app built: app/index.html + app/dist/")
