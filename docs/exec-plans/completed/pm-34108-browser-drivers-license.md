# PM-34108 — [Browser] Add Driver's License item type

## Task

Add Driver's License copy actions to the browser popup's vault item list.

## WARP Input

Jira: https://bitwarden.atlassian.net/browse/PM-34108
Summary: "[Browser] Add Driver's License item type"
Description: "Add Driver's License item type to the browser."

## Context

PM-32693 (Driver's License for the Web) already merged and handled:

- Shared lib components: DriversLicenseViewComponent, DriversLicenseSectionComponent
- Data models: DriversLicenseView, DriversLicenseData, DriversLicenseApi
- Browser headers: viewItemHeaderLicense, editItemHeaderLicense, newItemHeaderDriversLicense
- Browser filter service: DriversLicense added to cipherTypes$ behind PM32009NewItemTypes flag
- DIALOG_CIPHER_MENU_ITEMS: DriversLicense already included

Missing (identified gap): Driver's License copy actions in `libs/vault/src/components/item-copy-actions/`

## Plan

1. Update `item-copy-actions.component.ts`:
   - Add `singleCopyableDriversLicense` getter
   - Add `hasDriversLicenseValues` getter
   - Add private `getNumberOfDriversLicenseValues` method
2. Update `item-copy-actions.component.html`:
   - Add `@if (DriversLicense)` block with single/menu copy pattern
   - Fields: firstName, middleName, lastName, licenseNumber
   - Use <bit-item-action> wrapper for consistency with other cipher types

3. Update `item-copy-actions.component.spec.ts`:
   - Add Driver's License test cases

## DONE WHEN

- Driver's License copy actions appear in the browser popup list item
- Users can copy firstName, middleName, lastName, licenseNumber from a Driver's License item
- All existing tests pass
- New tests cover the Driver's License copy actions behavior

## Notes

- CipherListView only has DriversLicenseLicenseNumber in SDK copyableFields
- firstName/middleName/lastName handled via CipherView (full decrypt on click)
- Pattern mirrors BankAccount implementation from vault/PM-34109/copyable-items-bank-account branch

## Phase 7 Handoff Summary

### COMPLETED:

- Added `singleCopyableDriversLicense` getter to `VaultItemCopyActionsComponent`
- Added `hasDriversLicenseValues` getter to `VaultItemCopyActionsComponent`
- Added private `getNumberOfDriversLicenseValues` method (handles both CipherView and CipherListView)
- Added Driver's License section to `item-copy-actions.component.html` with firstName, middleName, lastName, licenseNumber copy buttons
- Added `singleCopyableDriversLicense` and `hasDriversLicenseValues` tests in spec file

### AC STATUS:

- Driver's License copy actions available in browser popup list view: met
- Fields copyable: firstName, middleName, lastName, licenseNumber: met
- Tests pass: met (31 tests, all green)

### SCOPE NOTES:

- None — implementation matches planned scope exactly

### NEXT: commit → review → pr
