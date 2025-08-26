# Claude Memory for Bitwarden Clients

## Removing Components from loose-components.module.ts

When refactoring components to be standalone and removing them from the legacy `loose-components.module.ts`:

### Process:

1. **Analyze the component's current usage** - Check how it's declared/imported/exported in loose-components.module.ts
2. **Find the component file** - Examine its current dependencies and verify it's already standalone (has `imports` array)
3. **Search for all usages** - Use `grep` to find all references across the codebase
4. **Remove from loose-components.module.ts**:
   - Remove the import statement
   - Remove from the `imports` array
   - Remove from the `exports` array
5. **Verify direct imports exist** - Check that routing modules and other consumers already import the component directly
6. **Run lint** - Ensure no errors were introduced

### Key findings from OrganizationLayoutComponent refactoring:

- Modern Angular components with `imports` arrays are standalone by default (no need to add `standalone: true`)
- Routing modules in this codebase already import components directly
- The main task is just cleaning up the loose-components.module.ts file
- Always verify with `grep OrganizationLayoutComponent` to find all usages before making changes

### Files commonly involved:

- `apps/web/src/app/shared/loose-components.module.ts` - The main module to clean up
- `apps/web/src/app/admin-console/organizations/organization-routing.module.ts` - Web routing
- `bitwarden_license/bit-web/src/app/admin-console/organizations/organizations-routing.module.ts` - License routing
