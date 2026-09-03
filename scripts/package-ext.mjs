// Packages the built extension for the Chrome Web Store: a zip of
// extension/dist/ named by the manifest's version, under release/.
// Run `npm run build:ext` first; this script refuses a stale or empty dist.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("../", import.meta.url))
const dist = join(root, "extension", "dist")
const manifestPath = join(dist, "manifest.json")
if (!existsSync(manifestPath)) {
  console.error("extension/dist/manifest.json missing — run `npm run build:ext` first")
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
for (const required of ["content.js", "decorate.css", "katex.min.css", "icons/icon128.png"]) {
  if (!existsSync(join(dist, required))) {
    console.error(`extension/dist/${required} missing — run \`npm run build:ext\` first`)
    process.exit(1)
  }
}
const contentAge = Date.now() - statSync(join(dist, "content.js")).mtimeMs
if (contentAge > 6 * 60 * 60 * 1000) console.warn("warning: extension/dist/content.js is older than six hours")

const out = join(root, "release")
mkdirSync(out, { recursive: true })
const zip = join(out, `restitutor-${manifest.version}.zip`)
if (existsSync(zip)) rmSync(zip)
// bsdtar (shipped with Windows 10+) writes forward-slash entry names, which
// the store's unpacker needs; PowerShell's Compress-Archive writes
// backslashes and is not used. Entries are dist's contents, so the manifest
// sits at the zip's root.
const entries = readdirSync(dist)
// Git Bash puts GNU tar first on PATH, and GNU tar cannot write a zip.
const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar"
execFileSync(tar, ["-a", "-c", "-f", zip, "-C", dist, ...entries], { stdio: "inherit" })
console.log(`packaged ${zip} (${(statSync(zip).size / 1024).toFixed(0)} kB) — manifest ${manifest.name} ${manifest.version}`)
