# Privacy policy — restitutor browser extension

Effective 2026-09-03.

restitutor runs entirely inside your browser. It reads the TeX that a page already carries in its own markup, translates it on the page, and shows the result in a panel on that page.

**What the extension collects:** nothing. It has no server, makes no network requests, sets no cookies, and stores nothing — not on your device and not elsewhere. It does not read the pages you visit beyond the three sites listed in its manifest (ar5iv, arXiv HTML, Wikipedia), and on those pages it reads only the page content needed to find equations and the sentences that declare their symbols.

**What leaves the page:** nothing. The convention registry, the detection rules and the KaTeX renderer are bundled with the extension; no page content, equation, URL or identifier is transmitted anywhere.

**Permissions:** the extension asks only for the three site matches in its manifest, in order to run its content script there. It requests no other permission.

**Changes:** any change to this policy is recorded in the public repository at https://github.com/realkss/restitutor, in this file's history.

**Contact:** open an issue at https://github.com/realkss/restitutor/issues.
