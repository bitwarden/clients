# Web Vault E2E Tests (Playwright) — Critical Rules

**NEVER**

- Modify production app code
- Define selectors inline with tests — page/fragment objects (`*.page.ts` / `*.fragment.ts`) are
  defined alongside the component code they target

**Run**

- `npm run test:e2e:web`

**References**

- https://playwright.dev/docs/test-configuration
- https://playwright.dev/docs/pom
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/test-assertions
