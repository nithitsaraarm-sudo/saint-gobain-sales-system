# Accessibility and UX Smoke Test Checklist

Use this checklist before deploying UI changes to the Saint-Gobain Sales System.

## Devices and viewports

- Desktop Chrome/Edge at 1366x768.
- Android Chrome at 360x800.
- iPhone Safari at 375x667 and 390x844.
- PWA standalone mode after closing and reopening the app.

## Keyboard and focus

- Tab order starts at login controls and follows visible UI order.
- Visible focus ring appears on primary, yellow, ghost, tiny, setting tile, sidebar, logout, and modal close buttons.
- Enter/Space activates focused buttons once.
- Escape closes modals where the existing app flow supports Escape.
- Focus does not move to hidden sidebar/menu buttons.

## Screen reader semantics

- Main modal overlays expose `role="dialog"` and `aria-modal="true"`.
- Dialogs have either `aria-labelledby` or `aria-label`.
- Toast and loading/status messages use polite live regions.
- Decorative icon images keep empty `alt=""` and actionable icon buttons keep an accessible label/title.

## Touch and mobile layout

- Interactive controls keep at least a 44px touch target where the UI already expects touch use.
- Customer modal body scrolls independently while header/footer remain visible.
- Quotation brand selector, action bar, product picker, and cart controls do not create horizontal scroll.
- iPhone Safari safe-area top/bottom does not hide modal headers, footers, or logout/sidebar controls.

## Forms and validation

- Validation messages are visible without requiring horizontal scroll.
- Save buttons show the existing loading/disabled state and cannot double-submit.
- File upload label opens the hidden file input on iPhone Safari, Android Chrome, and desktop.
- Invalid profile image URLs fall back to the placeholder without a broken-image loop.

## Role and permission UX

- Hidden or disabled buttons match backend permissions for the current role.
- VIEWER sees read-only flows only.
- SALES does not see customers outside assigned area.
- SUPER_ADMIN can still reach admin-only settings and user management.

## Quotation workflows

- New quotation, select BU, search customer, add product, save, preview, print, PDF, PNG, share, duplicate, and cancel preserve existing behavior.
- Old quotation numbers still open and render.
- Export controls remain reachable on mobile and desktop.

## PWA/cache

- Refresh, logout/login, and PWA reopen do not show stale private customer, quotation, product preference, or profile data.
- Static assets load from the current app/cache version.
- Offline fallback appears only for navigation, not API failures.

## Notes

- Automated axe/Playwright/Lighthouse checks are not configured in this repository yet.
- If a JavaScript runtime and browser test stack are added later, this checklist should become the baseline for automated accessibility smoke tests.
