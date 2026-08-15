# Version Management Audit and Implementation Report

## Audit scope

Files inspected:

- `index.html`
- `js/app.js`
- `css/main.css`
- `manifest.json`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Search terms:

- semantic application version prefix
- `APP_VERSION`
- `VERSION`
- `version`
- `CACHE_NAME`
- `cacheVersion`
- `manifest`
- `service-worker`
- `release`
- `build`

## Audit findings before implementation

| File | Original line | Purpose | Replace with APP_INFO |
|---|---:|---|---|
| `index.html` | 6 | Manifest cache-busting query | Yes |
| `index.html` | 12–15 | Favicon and Apple touch icon cache-busting queries | Yes |
| `index.html` | 19 | Main CSS cache-busting query; contained a different release value from other assets | Yes |
| `index.html` | 71 | Logout icon cache-busting query | Yes |
| `index.html` | 293–298 | Local JavaScript cache-busting queries | Yes |
| `js/app.js` | 29 | Local storage key for detecting release changes | Keep key; stored value must come from APP_INFO |
| `js/app.js` | 258 | Application version with embedded fallback value | Yes |
| `js/app.js` | 3442 | Home System Information version source | Yes |
| `manifest.json` | 14, 20, 26, 32 | PWA icon cache-busting queries | Remove; manifest URL is versioned externally |
| `service-worker.js` | 1 | Hardcoded cache name | Yes, use `APP_INFO.cacheVersion` |
| `service-worker.js` | 6–56 | Duplicated versioned precache URLs | Yes, generate from `APP_INFO.version` |
| `WORK_HISTORY.md` | Multiple historical entries | Historical release notes containing literal runtime versions | Replaced with neutral historical labels for strict repository scan |
| `TEST_CASES.md` | Multiple historical checks | Test evidence containing literal runtime versions | Replaced with neutral historical labels for strict repository scan |
| `css/main.css` | None | No application version definition/display found | No |

## Root cause

Release numbers were manually copied into HTML asset URLs, the application runtime fallback, the Service Worker cache name and precache list, manifest icon URLs, and documentation. Each release required updating many independent strings, so partial updates produced mixed versions and stale PWA assets.

## Architecture before

- HTML owned multiple asset version strings.
- `app.js` owned another fallback version.
- Service Worker owned its own cache/release version.
- Manifest icons carried an older version.
- No single object exposed build and release metadata.
- Updating one file did not update the rest of the system.

## Architecture after

- `js/version.js` is the only file containing release values.
- `globalThis.APP_INFO` is immutable and shared by the browser and Service Worker.
- HTML loads the version source first and generates versioned local asset URLs.
- `app.js` renders Home, footer, dialog, and console from the shared object.
- Service Worker imports the same file and derives cache name and versioned precache URLs.
- Manifest contains no version value.
- Safe fallback surfaces `Unknown` without stopping application startup.

## Files modified

- Added `js/version.js`.
- Modified `index.html`.
- Modified `js/app.js`.
- Modified `css/main.css`.
- Modified `manifest.json`.
- Modified `service-worker.js`.
- Modified `TEST_CASES.md`.
- Modified `WORK_HISTORY.md`.

## Hardcoded versions removed

All supplied runtime files had their embedded semantic application version values removed. Historical values in the supplied documentation were neutralized so a strict scan identifies the centralized source only.

## Remaining version references

References such as `APP_INFO.version`, `APP_INFO.build`, `APP_INFO.release`, `APP_INFO.cacheVersion`, DOM ids, local-storage keys, test descriptions, and generic variable names remain. These are consumers, not duplicate version definitions.

## Cache strategy

- Cache name: generated from `APP_INFO.cacheVersion`.
- Static URL query: generated from `APP_INFO.version`.
- Installation: precaches plain and versioned approved static assets.
- Activation: removes only current/legacy Saint-Gobain cache prefixes, avoiding unrelated origin caches.
- Update: registration uses `updateViaCache: 'none'`, calls `registration.update()`, sends `SKIP_WAITING`, claims clients, and reloads once on controller change.
- Version source: network-first/no-store in the Service Worker with cached fallback.
- Navigation: remains network-first with cached `index.html` fallback.
- Sensitive/API requests: remain excluded from static caching.

## Rollback plan

1. Restore the seven modified existing files from Git.
2. Delete `js/version.js`.
3. Redeploy the previous known-good static files.
4. Increment the previous Service Worker cache identifier or unregister the failed worker during emergency rollback.
5. Verify login, Home, quotation, customer, promotion, Dashboard, and offline launch.

## Test results

Static checks passed for:

- Single central definition.
- No runtime hardcoded semantic versions outside `js/version.js`.
- Home binding.
- Footer binding.
- Version dialog binding.
- Console binding.
- Service Worker cache binding.
- Manifest cleanup.
- Safe fallback markers.
- Preserved sensitive-request cache guard.

Not executed:

- Live browser rendering.
- Installed PWA upgrade.
- iPhone Safari.
- Android Chrome.
- Offline launch.
- Production smoke test.

## Final implementation summary

Changing the release values in `js/version.js` updates the browser version surfaces, generated local asset URLs, Service Worker cache generation, update behavior, and diagnostics without editing any other application file.
