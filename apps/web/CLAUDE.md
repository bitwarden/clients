# Web Vault - Critical Rules

- **NEVER** access browser extension APIs
  - Web vault runs in standard browser context (no chrome._/browser._ APIs)
  - DON'T import or use BrowserApi or extension-specific code

- **ALWAYS** assume multi-tenant organization features
  - Web vault supports enterprise organizations with complex permissions
  - Use organization permission guards: `/apps/web/src/app/admin-console/organizations/guards/`

- **CRITICAL**: All sensitive operations must work without local storage
  - Web vault may run in environments that clear storage aggressively
  - DON'T rely on localStorage/sessionStorage for security-critical data
