# Business KPI Audit Report

## Audit scope

Files inspected: `js/app.js`, `index.html`, `css/main.css`, `TEST_CASES.md`, and `WORK_HISTORY.md`. No backend or business workflow file required modification.

## Data-source comparison

| Metric | Source before | Source after | Result |
|---|---|---|---|
| Quotation Value | Active `DB.quotes[].grandTotal/total` | Same | Preserved |
| Business Unit totals | `DB.quoteLines` joined repeatedly to `DB.products`, classified by `brand/discountGroup` | `DB.quoteLines` joined through one product index, classified by centralized BU resolver | Fixed |
| New Customer | `DB.customers` created/updated in last 30 days | Same centralized summary output | Preserved |

## Product data model comparison

| Meaning | Legacy/weak field | Current/preferred fields | Use after fix |
|---|---|---|---|
| Business Unit | `brand`, `discountGroup` | `productBusinessUnit`, `businessUnit`, `quoteType`, `bu`; `brand` only final compatibility fallback | Central resolver |
| Product identity | `id` only | `productId`, `sku`, `productCode`, `id` | Indexed aliases |
| Transaction value | `lineTotal` or `grandTotal` only | `lineTotal`, `netTotal`, `netAmount`, `amount`, `total`, `grandTotal`, `quotationValue`; unit price × qty fallback | Central value resolver |
| Master/list price | `price` / `listPrice` | Not used as the primary KPI value | Fallback only when no transactional total exists |

## Root cause

The Dashboard mixed two different aggregation paths. Quotation Value summed quotation headers, while BU totals depended on quote lines and obsolete classification fields. Current product normalization already exposes `productBusinessUnit` and `businessUnit`, but Business KPI ignored them. A second lifecycle defect prevented Dashboard recalculation after separately loaded product data arrived.

## New calculation flow

1. Normalize quotation headers.
2. Build active quotation index and calculate Quotation Value.
3. Build product identity index once.
4. Iterate quote lines once.
5. Resolve each line's BU from line → product → legacy quote metadata.
6. Resolve transactional line value.
7. Aggregate into a dynamic `Map` keyed by normalized BU.
8. Return summary and data-quality state.
9. Render dynamically; no fixed Business Unit calculation keys.

## Empty and failure behavior

- No quote-line data: `—` with an empty-data explanation.
- Unresolvable BU data: `—` / `Unable to calculate KPI`.
- Partial unresolved data: totals are suppressed to prevent misleading partial numbers.

## Rollback

Restore `js/app.js`, `js/version.js`, `TEST_CASES.md`, and `WORK_HISTORY.md` from the previous release, then redeploy. No database or Apps Script rollback is required.
