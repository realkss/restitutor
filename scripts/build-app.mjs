// Bundle the stage-1 paste-box app and stage KaTeX's stylesheet + fonts locally
// (the site's charter and this repo's posture agree: no runtime CDN requests).
import { build } from "esbuild"
import { cpSync, mkdirSync } from "node:fs"

mkdirSync("app/dist", { recursive: true })

await build({
  entryPoints: ["app/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "app/dist/main.js",
  logLevel: "info",
})

cpSync("node_modules/katex/dist/katex.min.css", "app/dist/katex.min.css")
cpSync("node_modules/katex/dist/fonts", "app/dist/fonts", { recursive: true })
console.log("app built: app/index.html + app/dist/")
