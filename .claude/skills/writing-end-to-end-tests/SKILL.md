---
name: writing-end-to-end-tests
description: Write and run Playwright end-to-end tests in `e2e/` for the web vault, browser extension and desktop app. The suite is a key-management internal experiment. Use only when already working in `e2e/`, not to start a test suite elsewhere.
---

## Layout

- Tests: `e2e/tests/<web|browser|desktop|shared>/**/*.e2e.ts`. `shared` holds flows spanning clients.
- Fixtures: `e2e/src/browser/fixtures.ts` (extension in a persistent Chromium context), `e2e/src/desktop/fixtures.ts` (Electron). Web tests use Playwright's own `page`.
- Page helpers: `e2e/src/<client>/*.ts` and `e2e/src/*.ts` (e.g. `LoginPage`, `LockScreen`). Reuse one before writing a new one.
- Client internals (feature flags, lock state, fake biometrics): `automationDriver(page, "<capability>")` in `e2e/src/automation-driver.ts`, backed by `libs/automation-driver`. Prefer it over poking app state through `page.evaluate`.
- Setup (credentials, builds, local server): `e2e/README.md`.

## Locators

- Prefer a trivial role locator: one `getByRole` call that picks out the element on its own, with no `name` or a `name` taken from data the test seeded, e.g. `page.getByRole("dialog")` or `page.getByRole("link", { name: itemName })`. An `id` written in the template (`page.locator("#...")`) works too, but not a generated one like `bit-form-field-3`, which changes with render order.
- Fall back to a test id when no trivial role locator works: it needs chaining or nesting (`.filter()`, scoping into a row, `.nth()`), the role matches more than one element, or only localized copy tells the elements apart. Add a `data-testid` to the component template in the same change and locate it with `page.getByTestId("...")`. Name it `<component>-<element>`, e.g. `lock-biometric-unlock-button`.
- For new locators: no CSS classes, DOM structure or `formcontrolname`. Existing helpers predate this rule; leave them alone unless you are already changing that locator.
- Don't match localized copy: no `getByText` or `getByLabel`, and no role `name` taken from translated text, including button, checkbox and menu labels. Matching data the test seeded itself, such as a folder name, is fine.
- Reach UI owned by another team (see `.github/CODEOWNERS`) through a trivial role locator, or that team's page helper (e.g. `LoginPage`) if one exists. Don't add test ids to their templates or depend on their DOM structure. If neither works, stop and ask rather than break one of these rules.
- Keep each test id and `#id` in a named constant at the top of the helper or test.

## Writing tests

- Assert with web-first `expect(locator)` (`toBeVisible`, `toBeEnabled`, `toHaveURL`). No `waitForTimeout` to wait for state; wait for the state itself.
- Each test logs in fresh. Profiles are wiped per launch, so don't rely on state from an earlier test.
- Long cross-client flows: raise `test.setTimeout` instead of the global timeout.
- Put repeated steps (open settings, set a PIN) in a page helper, not in the test.

## Run them

Always run the tests you wrote or touched, and report the result. A test not observed passing is not done.

```bash
npm run test:e2e:web
npm run test:e2e:browser   # builds the extension first
npm run test:e2e:desktop   # builds desktop first
npm run test:e2e:shared

# Only the web suite is headless. On Linux without a display, wrap the
# other three: xvfb-run -a npm run test:e2e:browser
```

- One test: `cd e2e && npx playwright test -c playwright.<suite>.config.ts <path> -g "<title>"`. Rebuild the client first if its code changed.
- Bug fix: run the test without the fix too. It must fail there.
- On failure, read `e2e/test-results/<test>/` (screenshot, `error-context.md`, `trace.zip`) before changing the test. Fix the cause, not the timeout.
