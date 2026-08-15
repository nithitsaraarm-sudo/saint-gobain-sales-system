# Sales Target Management — Implementation Report

## Root cause
Dashboard read `DB.settings.salesTarget || target || monthlyTarget`; no dedicated target storage existed. Forecast equaled Actual and missing target produced 0.0% Achievement.

## New architecture
`SalesTargets` Google Sheet is the storage SSOT. `resolveEffectiveSalesTarget_()` is the backend target-resolution SSOT. `calculateSalesKpi()` is the frontend KPI calculation SSOT. Dashboard only renders the calculated result.

## Deployment order
1. Add `SalesTarget.gs` to the Apps Script project.
2. Replace `Database.gs` and `Code.gs`.
3. Deploy Apps Script as a new version.
4. Replace frontend files and deploy static/PWA assets.
5. Open Target Management as SUPER_ADMIN; first API use creates `SalesTargets` non-destructively.
6. Create UAT targets and execute P0 tests before production.

## Rollback
Revert the listed frontend/backend files and redeploy the previous Apps Script/static version. Hide/remove the Sales Target settings tile. Do not delete `SalesTargets`; set targets INACTIVE if needed. Clear only `sg_sales_targets_cache`, `sg_effective_sales_target_cache`, `sg_bootstrap_cache`, and the current Service Worker app cache. Verify login, Dashboard Actual, quotations, customers, products and PWA launch.
