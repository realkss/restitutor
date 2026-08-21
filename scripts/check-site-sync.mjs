// Verifies the site's vendored engine copy is byte-identical to src/.
// This repository is the source of record; the site consumes a vendored copy.
// Override the site location with SITE_PATH.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sitePath =
  process.env.SITE_PATH ??
  "C:/Users/silen/Documents/hypomnemata/quartz/components/scripts";
const files = ["unitsEngine.ts", "unitsEngine.test.ts"];

// Normalize CRLF at read: Windows checkouts differ from committed LF content,
// and the comparison is about content identity, not line endings.
const sha = (p) =>
  createHash("sha256")
    .update(readFileSync(p, "utf8").replaceAll("\r\n", "\n"))
    .digest("hex");

let ok = true;
for (const f of files) {
  let here, there;
  try {
    here = sha(join("src", f));
    there = sha(join(sitePath, f));
  } catch (e) {
    console.error(`ERROR reading ${f}: ${e.message}`);
    ok = false;
    continue;
  }
  const same = here === there;
  ok &&= same;
  console.log(`${same ? "OK   " : "DRIFT"} ${f}`);
  if (!same) console.log(`      repo ${here.slice(0, 16)}… site ${there.slice(0, 16)}…`);
}
process.exit(ok ? 0 : 1);
