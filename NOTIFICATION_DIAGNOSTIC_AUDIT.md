# Notification and Diagnostic Logging Audit

Date: 2026-07-29  
Project: Saint-Gobain Sales System  
Scope: Phase 1 audit before centralized notification and diagnostic framework implementation.

## Summary

The repository already has several notification mechanisms, but they are not centralized:

- Native browser dialogs are still present in production JavaScript.
- A single legacy toast element exists in `index.html`, driven by `toast(msg)` in `js/app.js`.
- Quotation has custom modal implementations for draft recovery, quote type selection, product decisions, price input, custom unit input, action sheets, and export-blocking states.
- CRUD/customer/product/promotion modal uses shared `#modal`, but it is not a full notification framework.
- API timeout/network errors have basic codes in `js/api.js`, but UI event IDs and safe diagnostic logging are not centralized.
- Quotation local draft autosave status exists, but it is module-specific and not connected to a shared error/event/logging layer.

Current measured findings:

| Pattern | Count |
|---|---:|
| `alert(` | 1 |
| `confirm(` | 2 |
| `prompt(` | 0 |
| `toast(` | 207 |
| `role="dialog"` | 5 |
| `class="toast"` | 1 |
| `class="modal` | 4 |

## Native dialogs found

| File | Function/Location | Current Notification | Trigger | Risk | Recommended Component |
|---|---|---|---|---|---|
| `js/auth.js:14-18` | `toastMessage(message)` fallback | `alert(message)` if `toast` is unavailable | Login/bootstrap/change-password errors before app toast is available | Browser hostname appears; blocking native UI; no error code/event ID | `showToast()` fallback, no native `alert()` |
| `js/quotation.js:1638-1645` | `confirmAndCancelCurrentQuotation()` | `window.confirm()` | Cancel persisted quotation from quotation “More” action | Browser hostname appears; synchronous blocking; no duplicate-click protection | `showDestructiveConfirm()` |
| `js/quotation.js:1722-1726` | `confirmQuotationEditNavigation(reference)` | `window.confirm()` | Open another quotation while current quote is dirty | Browser hostname appears; synchronous blocking; must be migrated carefully to async | `showConfirm()` and async caller update |

## Custom dialogs and modal implementations

| File | Function/Location | Current Notification | Trigger | Risk | Recommended Component |
|---|---|---|---|---|---|
| `index.html:198-207` | `#quoteTypeModal` | Static custom modal | Select BU before quotation | Separate modal implementation; no shared queue or diagnostic hooks | Preserve for now; later migrate to shared `showConfirm`/selection dialog only if safe |
| `index.html:209` | `#modal` | Shared CRUD modal shell | Customer/product/promotion add/edit | Shared shell but not notification-specific; rich HTML form body | Preserve; do not merge into notification framework |
| `index.html:209` | `#toast` | Single legacy toast element | All `toast(msg)` calls | One message at a time; no type/severity/event/logging/queue | Replace `toast()` implementation with shared `showToast()` |
| `index.html:161` | `#quotationPrintPreview` | Print preview dialog/overlay | Quotation preview/print/export | Workflow-specific overlay | Preserve; not a notification |
| `index.html:174` | `#productPriceModal` | Product calculator modal | Product price calculation | Workflow-specific modal | Preserve; later review accessibility only |
| `index.html:189` | `#quoteDetailModal` | Quotation detail modal | View quotation history detail | Workflow-specific modal | Preserve; later review accessibility only |
| `js/quotation.js:621-704` | `showQuotationDraftDialog(options)` | Custom async draft recovery/destructive dialog | Draft restore/discard and New Quotation reset | Good async pattern exists, but separate from shared queue/logging/error details | Migrate to shared confirm once foundation is stable |
| `js/quotation.js:2667` | `renderQuoteProductDecisionModal(...)` | Custom decision modal | Duplicate paid/free product decisions | Important async product decision flow; high risk if migrated blindly | Preserve initially; later migrate with dedicated tests |
| `js/quotation.js:2762` | `showQuotePriceInputModal(...)` | Custom input modal | Missing/overridden quote line price | Form/input modal; must preserve validation and focus | Preserve initially; later wrap into `showPromptDialog()` |
| `js/quotation.js:2850` | `showQuoteCustomUnitModal(...)` | Custom input modal | Quote line unit override | Form/input modal; must preserve validation and focus | Preserve initially; later wrap into `showPromptDialog()` |

## Toast/status notification hotspots

| File | Function/Location | Current Notification | Trigger | Risk | Recommended Component |
|---|---|---|---|---|---|
| `js/app.js:2883` | `toast(msg)` | Legacy single toast | Global app/user/customer/product/profile/settings messages | No variants, no queue, no event ID, no diagnostic logging | Delegate to `showToast()` |
| `js/auth.js:14` | `toastMessage(message)` | Delegates to `toast()` or native alert | Auth and session messages | Native fallback | Delegate to shared notifications |
| `js/quotation.js` | Many `toast(...)` calls | Legacy single toast | Quotation validation, save, export, share, product add, edit, cancel | Important errors have no code/event ID in UI | Keep calls initially through `toast()` wrapper; migrate high-risk errors later |
| `js/app.js:2145-2380` | Profile image/upload/save flow | Toast-only upload/save status | File select, resize, upload, profile save | Upload failure has no event ID/log details | Later map upload failures to `PROFILE/API` errors |
| `js/app.js:1483-1567` | Customer load/refresh | Toast-only loading and errors | Customers API load/refresh | Error details not standardized | Later use `showLoading` + error mapping |
| `js/app.js:1938-2138` | Quotation history/detail actions | Toast-only errors/success | Load/open/duplicate/cancel from history | Cancel/duplicate errors not standardized | Later migrate high-risk history actions |

## Loading and error handlers

| File | Function/Location | Current Notification | Trigger | Risk | Recommended Component |
|---|---|---|---|---|---|
| `js/api.js:27` | `API_TIMEOUT_MS = 30000` | Timeout constants and codes | API timeout | Codes exist but no event ID/logging connection | Error catalog + diagnostic log |
| `js/api.js:642-767` | JSONP/fetch timeout/network handling | Returns `TIMEOUT`, `NETWORK_ERROR`, etc. | API request failure | Raw API message may be shown by callers; no event ID | `normalizeAppError()` + `logDiagnosticEvent()` |
| `js/app.js:934-953` | `loadData()` | Toast loading/error | Bootstrap data load | Session/permission handled with raw toast and clearSession | Auth/session-specific modal/toast + diagnostic log |
| `js/quotation.js:267-617` | Draft autosave status | Inline pill/banner | Saving/saved/error/restored draft | Module-specific, no offline state/event ID | Improve status states and connect failed/offline to diagnostics |

## Classification by notification type

| Type | Existing coverage | Gap |
|---|---|---|
| Success Toast | Legacy `toast()` | No green styling/queue/icon/type |
| Information Toast | Legacy `toast()` | No blue styling/queue/icon/type |
| Warning Modal | Some custom modals | No shared warning component |
| Confirmation Modal | Quotation draft dialog and native confirm | Native confirm remains; no shared queue |
| Destructive Confirmation | Native cancel confirm; draft discard custom | No shared destructive component |
| Error Modal | None centralized | No error code/event ID/details |
| Form/Input Modal | Quote price/unit custom modals | Not centralized |
| Loading State | Toast text and local button busy states | No shared loading overlay |
| Inline Validation | Forms and quote price/unit errors | Not standardized |
| Session/Auth Alert | Toast/native fallback | Not centralized; native fallback exists |
| Offline/Network Alert | API codes only | No UI offline state or diagnostic link |

## Initial migration recommendation

Use a rollback-safe phased approach:

1. Add `js/notifications.js` with shared toast/dialog/loading/error/diagnostic helpers.
2. Load it before `auth.js`, `app.js`, and `quotation.js`.
3. Change the existing `toast(msg)` implementation to delegate to `showToast()` for backward compatibility with ~207 existing calls.
4. Remove native `alert()` fallback in `auth.js`.
5. Migrate the two native `window.confirm()` quotation workflows to async shared confirmation dialogs.
6. Improve quotation draft autosave status text/styling without changing draft storage/debounce behavior.
7. Defer complex form/input modals and product decision modals until the shared framework is stable and covered by tests.

## Security observations

- Existing toast uses `textContent`, which is safe for plain messages.
- Several custom quotation modals build HTML strings. They mostly escape dynamic values, but should not be refactored casually.
- New diagnostics must redact tokens, passwords, full quotation payloads, full customer records, hidden discounts, and stack traces for non-SUPER_ADMIN users.
- Client-side diagnostic history should be bounded and local-only unless server-side architecture is reviewed separately.

## Phase 1 status

Audit complete enough to start a focused framework foundation and high-risk native-dialog migration. Full module-by-module migration remains pending by design.
