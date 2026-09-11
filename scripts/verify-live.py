# Verify the built extension on a LIVE page: headless Edge with
# extension/dist loaded, driven over the DevTools protocol — open the page,
# click the first equation whose TeX matches a pattern, choose the target,
# and dump the panel's text (and a screenshot, if asked). This is the
# browser-side counterpart of extension/src/page.real.test.ts: the tests
# prove the page reading over captured markup; this proves the same code
# inside a real browser on a real page, with the panel rendered.
#
#   python scripts/verify-live.py <url> <tex-regex> [--target si|gaussian|hl]
#                                 [--geometrized] [--shot out.png] [--browser <exe>]
#
# The regex is a JavaScript regex source tested against each equation's TeX
# (its alttext or x-tex annotation) and, failing that, its rendered text.
# Avoid backslashes in it — write "8.{0,2}pi.{0,3}G" for 8\pi G — since
# shells eat them unpredictably. Requires Python 3 with websocket-client
# (`pip install websocket-client`) and a Chromium browser that still honors
# --load-extension: Microsoft Edge does; Google Chrome 137+ ignores the
# flag on branded builds. Run `npm run build:ext` first.
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

from websocket import create_connection

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BROWSER = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

ap = argparse.ArgumentParser()
ap.add_argument("url")
ap.add_argument("pattern")
ap.add_argument("--target", default="si", choices=["si", "gaussian", "hl"])
ap.add_argument("--geometrized", action="store_true")
ap.add_argument("--shot")
ap.add_argument("--browser", default=os.environ.get("RESTITUTOR_BROWSER", DEFAULT_BROWSER))
ap.add_argument("--port", type=int, default=9333)
ap.add_argument("--wait", type=float, default=8.0, help="seconds to let the page load and the content script run")
args = ap.parse_args()

ext = os.path.join(ROOT, "extension", "dist")
if not os.path.exists(os.path.join(ext, "manifest.json")):
    sys.exit("extension/dist/manifest.json missing: run `npm run build:ext` first")
profile = tempfile.mkdtemp(prefix="restitutor-verify-")

proc = subprocess.Popen(
    [
        args.browser,
        "--headless=new",
        f"--remote-debugging-port={args.port}",
        "--remote-allow-origins=*",
        f"--user-data-dir={profile}",
        f"--load-extension={ext}",
        f"--disable-extensions-except={ext}",
        "--window-size=1280,800",
        "--force-device-scale-factor=1",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "about:blank",
    ]
)
try:
    targets = None
    for _ in range(80):
        try:
            targets = json.load(urllib.request.urlopen(f"http://localhost:{args.port}/json"))
            break
        except Exception:
            time.sleep(0.25)
    if targets is None:
        sys.exit("the browser did not answer on the debugging port")
    page = [t for t in targets if t["type"] == "page"][0]
    ws = create_connection(page["webSocketDebuggerUrl"], suppress_origin=True)
    mid = 0

    def send(method, params=None):
        global mid
        mid += 1
        ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == mid:
                return m

    def evaluate(expression):
        r = send("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        return r.get("result", {}).get("result", {}).get("value")

    send("Page.enable")
    send("Runtime.enable")
    send("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 800, "deviceScaleFactor": 1, "mobile": False})
    send("Page.navigate", {"url": args.url})
    time.sleep(args.wait)

    found = evaluate(
        "(() => {"
        " const els = [...document.querySelectorAll('.rst-math')];"
        " const re = new RegExp(" + json.dumps(args.pattern) + ");"
        " const alt = (e) => { const m = e.querySelector('math'); return (m && m.getAttribute('alttext')) || e.getAttribute('alttext') || ''; };"
        " const el = els.find((e) => re.test(alt(e)) || re.test(e.textContent));"
        " if (!el) return { decorated: els.length, clicked: null };"
        " el.scrollIntoView({ block: 'center' });"
        " el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));"
        " return { decorated: els.length, clicked: alt(el).slice(0, 120) };"
        "})()"
    )
    print("decorated equations:", found and found.get("decorated"))
    if not found or not found.get("clicked"):
        sys.exit("no decorated equation matched the pattern (is the host in the manifest's matches, and did the page load?)")
    print("clicked:", found["clicked"])
    time.sleep(5)

    picked = evaluate(
        "(() => {"
        " const host = [...document.querySelectorAll('div')].find((e) => e.shadowRoot);"
        " if (!host) return 'no panel host';"
        " const panel = host.shadowRoot.getElementById('rst-panel');"
        " const sel = panel.querySelector('select');"
        " const box = panel.querySelector('input[type=checkbox]');"
        " if (sel && sel.value !== " + json.dumps(args.target) + ") { sel.value = " + json.dumps(args.target) + "; sel.dispatchEvent(new Event('change', { bubbles: true })); }"
        " if (box && box.checked !== " + ("true" if args.geometrized else "false") + ") box.click();"
        " return 'target ' + (sel ? sel.value : 'none') + (box ? (box.checked ? ', geometrized' : '') : '');"
        "})()"
    )
    print("panel:", picked)
    time.sleep(3)

    text = evaluate(
        "(() => {"
        " const host = [...document.querySelectorAll('div')].find((e) => e.shadowRoot);"
        " const panel = host.shadowRoot.getElementById('rst-panel');"
        " const results = panel.querySelector('.rst-results');"
        " if (results) panel.scrollTop = results.offsetTop - 10;"
        " return panel.innerText;"
        "})()"
    )
    print("---- panel ----")
    print(text)
    print("---- end ----")

    if args.shot:
        shot = send("Page.captureScreenshot", {"format": "png"})
        data = shot.get("result", {}).get("data")
        if data:
            with open(args.shot, "wb") as f:
                f.write(base64.b64decode(data))
            print("screenshot:", args.shot, os.path.getsize(args.shot), "bytes")
    ws.close()
finally:
    proc.terminate()
