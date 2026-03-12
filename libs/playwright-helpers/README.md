# playwright-helpers

Owned by: architecture

Framework for writing end-to-end Playwright tests with the Bitwarden seeder API. Provides test data isolation, authentication session management, and common test patterns.

## Overview

Each test worker receives a unique play ID that namespaces all test data on the server, preventing collisions between parallel tests. The framework integrates with the Bitwarden seeder API to create and destroy test data server-side, and provides fixtures for authentication with automatic session caching.

## Structure

```
src/
├── expect/              # Custom assertions (e.g., expectUnlockedAs)
├── fixtures/            # Playwright fixtures
├── queries/             # Read-only seeder API requests
├── scene-templates/     # Seeder API test data setup/teardown
├── play.ts              # Main entry point for seeder interaction
└── test.ts              # Extended Playwright test with fixtures
```

**Scenes** - Create server-side test data (users, vaults, etc.) with automatic teardown. Scene templates define what data to create, and scenes provide access to the created data and string mangling for test isolation.

**Queries** - Fetch data from the seeder API without creating or destroying resources.

**Fixtures** - Playwright fixtures. These may automate common user interactions (e.g. `auth.fixture.ts`), present easier interfaces to interact with the browser host (e.g. `user-state.fixture.ts`), or otherwise provide reusable code to keep tests concise and clear.

**Expect** - Custom expect functions for common test patterns.

## Usage

### Basic Test

```typescript
import { test, expectUnlockedAs } from "@bitwarden/playwright-helpers";

test("vault access", async ({ auth }) => {
  const { page, scene } = await auth.authenticate("test@example.com", "password");
  await expectUnlockedAs(scene.mangle("test@example.com"), page);
  await page.goto("/#/vault");
  await expect(page.getByRole("bit-vault")).toContainText("No Items");
});
```

### String Mangling

Strings can be mangled locally to ensure uniqueness across parallel tests when not using the Seeder API.:

```typescript
// Server-side mangling (via scenes)
scene.mangle("test@example.com"); // "test@example.com_a1b2c3d4"

// Client-side mangling (for test-created data)
Play.mangler("my-id"); // "my-id_a1b2c3d4"
Play.mangleEmail("test@e.com"); // "test_a1b2c3d4@e.com"
```

Mangling locally should be used as infrequently as possible, since uniqueness constraints are a server concern and seeding is much faster than creation through browser automation. Local mangling exists only to enable creation-flow testing.

## Extending

Add scene templates to [`scene-templates/`](src/scene-templates/) and queries to [`queries/`](src/queries/). Each extends its respective base class and must match a server-side template/query name.

Common assertions should be stored in [`expect/`](src/expect/).

## Debug

### Skip automatic cleanup:

```bash
PLAYWRIGHT_SKIP_CLEAN_STAGE=1 npx playwright test
```

This allows you to execute tests in order to set up state and poke around at your leisure. Test-seeded data can still be deleted by PlayId, and a `curl` command to delete is printed to stdout if `PLAYWRIGHT_SKIP_CLEAN_STAGE` is set.

### Slow motion

```bash
PLAYWRIGHT_SLOW_MO=250 npx playwright test --headed
```

Slow mo defines the number of milliseconds to pause between browser interactions, while `--headed` specifies executing in a window rather than headless. This combination allows you to watch a test with pauses long enough to actually understand what's happening.
