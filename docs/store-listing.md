# Chrome Web Store listing — restitutor

Everything the store's developer dashboard asks for, ready to paste. The submission itself needs the developer account (a one-time registration fee, Google sign-in), which is yours to do; `npm run package:ext` produces the zip.

## Package

- Build: `npm run build:ext`, then `npm run package:ext` → `release/restitutor-<version>.zip` (manifest at the zip root, icons included).
- Manifest V3, version from `extension/manifest.json`. Bump the version before every upload; the store rejects a re-upload of the same version.

## Store listing

**Name:** restitutor

**Summary (≤ 132 characters):**
Restore, strip, and dimension-check the constants in equations. Lookup, never inference - the unvouched-for declines loudly.

**Category:** Education (alternative: Productivity)

**Language:** English

**Detailed description:**

restitutor reads the equations a physics page already carries as TeX (ar5iv and arXiv HTML pages, Wikipedia) and, on a click, restores or strips the physical constants they suppress: the c and G a geometrized equation omits, the constants an SI reader wants back. Every translation is a lookup against a registry of symbol readings and a table of 36 unit conventions from a published census of the literature. Nothing is inferred: an equation whose symbols the registry cannot vouch for is declined, with the offending symbol named.

On each page the extension also reads what the page itself says about its conventions — a stated "G = c = 1", a named system, the form of the field equations, which constants are printed and which are absent — and reports the set of conventions consistent with all of it, never a single guess. Where the page declares its symbols ("where Σ is the surface density") those readings extend the registry for that page, and where it defines a symbol by an expression ("κ = 8πG/c⁴") the expression's dimension is used.

Everything runs locally: no network requests, no accounts, no data collection.

Source and issue tracker: https://github.com/realkss/restitutor (MIT).

## Privacy practices

- **Single purpose:** translate the unit conventions of equations on physics pages, in place.
- **Permission justification, host permissions** (`https://ar5iv.labs.arxiv.org/*`, `https://arxiv.org/html/*`, `https://*.wikipedia.org/*`): the content script must run on the pages whose markup carries TeX, in order to find equations and the sentences that declare their symbols. No other permission is requested.
- **Remote code:** none. All code and data ship in the package.
- **Data use disclosures:** the extension does not collect or transmit any user data. Tick "does not collect user data" on every category.
- **Privacy policy URL:** https://github.com/realkss/restitutor/blob/main/docs/privacy.md

## Assets

- Icon: `extension/icons/icon128.png` (also 16/32/48 in the package).
- Screenshots (1280×800 or 640×400, at least one, up to five): take them from the loaded extension on
  1. the English Wikipedia article "Einstein field equations" with the panel open on G + Λg = κT (shows Conventions, Symbols with the defined κ, and a translation);
  2. Carroll's lecture notes on ar5iv (gr-qc/9712019) with the panel open on any display equation (shows the contradiction line: the stated bare action against the printed G);
  3. the Arabic Wikipedia article on the field equations (right-to-left page, left-to-right panel).
- Promotional tile (optional, 440×280): the icon on the warm-paper background with the name set in IBM Plex Serif.

## Hand-off checklist

1. Register the developer account at https://chrome.google.com/webstore/devconsole (Google sign-in, one-time fee).
2. `npm run build:ext && npm run package:ext`, upload `release/restitutor-0.2.0.zip`.
3. Paste the listing above; upload the icon and screenshots; set visibility (unlisted for a first pass is fine).
4. Fill the privacy tab from the section above; submit for review. Reviews for a no-permission, no-remote-code extension usually clear within a few days.
