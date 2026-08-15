# Customer KPI Audit Report

## Root cause

1. Dashboard total customer used `DB.customers.length || DB.counts.customers`, so it could display the bootstrap count while the customer record list was still empty.
2. Active, inactive, and new counts were calculated only from `DB.customers`; therefore all three became zero before the lazy customer load completed.
3. `renderCustomerViews()` did not re-render Dashboard after customer data loaded.
4. Active-state interpretation was fragmented and did not centrally support current/legacy fields such as `active`, `isActive`, `enabled`, `isEnabled`, `status`, `customerStatus`, and `isDeleted`.
5. New customer logic used native `new Date(createdAt || updatedAt)`, which could misread Thai Buddhist years and incorrectly classify updated legacy customers as new.

## Data source

- Customer KPI SSOT: role/area/assigned-sales scoped `DB.customers` returned by the existing customer API/cache path.
- `DB.counts.customers` is presentation-only fallback for Total while records are loading; it is never used to fabricate category counts.

## New architecture

- `resolveCustomerActiveState(customer)` centralizes status precedence and defaults missing status to Active.
- `parseCustomerDateForKpi(value)` supports Date, timestamp, ISO, DD/MM/YYYY, YYYY-MM-DD, Thai digits, and Buddhist years.
- `getCustomerCreatedDateForKpi(customer)` checks created fields only.
- `calculateCustomerSummary(customers)` aggregates total, active, inactive, and new customers in one pass.
- Dashboard renderer only consumes the returned summary.
- Entering Dashboard triggers the existing scoped customer loader.
- Customer load/cache refresh re-renders Dashboard.

## Status precedence

1. `isDeleted=true` => inactive.
2. `active`
3. `isActive`
4. `enabled`
5. `isEnabled`
6. `status`
7. `customerStatus`
8. Missing/unknown status => active for backward compatibility.

## New-customer date fields

`createdAt`, `createdDate`, `createdTime`, `createdOn`, `dateCreated`, `timestamp`.

`updatedAt` is intentionally not treated as creation time.

## Performance

Old logic used multiple `filter()` passes. New logic is O(n) with one aggregation loop.

## Files modified

- `js/app.js`
- `js/version.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`
