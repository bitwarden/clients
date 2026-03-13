# Access Intelligence - Service Testing Standards

**Purpose:** Testing guidelines for platform-agnostic services and domain models

**Related:** [testing-standards-components.md](./testing-standards-components.md) for Angular component testing

---

## Table of Contents

1. [Test Organization and Coverage](#test-organization-and-coverage)
2. [Bitwarden Test Utilities](#bitwarden-test-utilities)
3. [Shared Test Helpers](#shared-test-helpers)
4. [Avoiding `any` Types in Tests](#avoiding-any-types-in-tests)
5. [Test Structure and Patterns](#test-structure-and-patterns)
6. [Manual Construction for Test Fixtures](#manual-construction-for-test-fixtures)
7. [Testing View Model Methods](#testing-view-model-methods)
8. [Running Tests](#running-tests)

---

## Test Organization and Coverage

**Follow the CipherView pattern** - comprehensive test coverage for smart models and services.

**Coverage Goals:**

- **View Models**: 8-10 tests per model covering all query, update, and computation methods
- **Services**: Test both integration flows and individual methods
- **Test Files**: Co-locate with source (`*.spec.ts` next to `*.ts`)

**Example Coverage:**

- [risk-insights.view.spec.ts](../../reports/risk-insights/models/view/risk-insights.view.spec.ts) - 31 tests for RiskInsightsView
- [risk-insights-report.view.spec.ts](../../reports/risk-insights/models/view/risk-insights-report.view.spec.ts) - 23 tests for RiskInsightsReportView
- [default-report-generation.service.spec.ts](../../reports/risk-insights/services/implementations/default-report-generation.service.spec.ts) - 17 tests for service

---

## Bitwarden Test Utilities

**ALWAYS use Bitwarden's built-in test utilities** from `@bitwarden/common/spec` instead of constructing test objects directly.

### Available Utilities

```typescript
import {
  makeEncString,
  makeStaticByteArray,
  makeSymmetricCryptoKey,
  GetUniqueString,
} from "@bitwarden/common/spec";
```

### makeEncString

**Use for:** Creating test EncString objects

```typescript
// ✅ CORRECT - Use makeEncString
const encKey = makeEncString("test-data");
const report = new RiskInsights();
report.contentEncryptionKey = makeEncString("encryption-key");

// ❌ WRONG - Don't construct EncString directly
const encKey = new EncString("test-data");
```

**Why:**

- Properly constructed EncString with correct encryption type
- Consistent test data format
- Avoids subtle bugs from incorrect EncString construction

### makeStaticByteArray

**Use for:** Creating deterministic byte arrays for crypto operations

```typescript
// ✅ CORRECT - Creates [0, 1, 2, ..., 63]
const key = makeStaticByteArray(64);

// With offset - creates [10, 11, 12, ..., 73]
const key = makeStaticByteArray(64, 10);
```

**Why:**

- Deterministic - same input always produces same output
- Predictable for testing crypto operations
- No random failures from varying test data

### makeSymmetricCryptoKey

**Use for:** Creating test symmetric keys

```typescript
// ✅ CORRECT - Create 64-byte key with seed
const userKey = makeSymmetricCryptoKey<UserKey>(64, 0);
const orgKey = makeSymmetricCryptoKey<OrgKey>(64, 1);

// Different seeds create different keys
const key1 = makeSymmetricCryptoKey(64, 0);
const key2 = makeSymmetricCryptoKey(64, 1);
```

**Parameters:**

- `length`: Key size (32 or 64 bytes)
- `seed`: Optional seed for deterministic generation (default: 0)

### GetUniqueString

**Use for:** Generating unique test identifiers

```typescript
// ✅ CORRECT - Creates unique strings
const userId = GetUniqueString("user"); // "user_abc-123-def"
const reportId = GetUniqueString("report"); // "report_xyz-456-ghi"

// Without prefix
const id = GetUniqueString(); // "abc-123-def-456"
```

**Why:**

- Ensures test isolation (no ID collisions)
- Readable test output (prefix helps identify what failed)
- Already used by Access Intelligence shared helpers

### Quick Reference

| Utility                               | Use For                   | Example                           |
| ------------------------------------- | ------------------------- | --------------------------------- |
| `makeEncString(data?)`                | Test EncStrings           | `makeEncString("encrypted-data")` |
| `makeStaticByteArray(len, start?)`    | Deterministic byte arrays | `makeStaticByteArray(64)`         |
| `makeSymmetricCryptoKey(len?, seed?)` | Test crypto keys          | `makeSymmetricCryptoKey(64, 0)`   |
| `GetUniqueString(prefix?)`            | Unique test IDs           | `GetUniqueString("user")`         |

---

## Shared Test Helpers

**ALWAYS use shared test helpers** instead of duplicating helper functions.

**Location:** [`testing/test-helpers.ts`](../../reports/risk-insights/testing/test-helpers.ts)

### Available Helpers

```typescript
// RiskInsights View helpers
createRiskInsights(options?) → RiskInsightsView
createRiskInsightsSummary(counts?) → RiskInsightsSummaryView
createRiskInsightsMetrics(counts?) → RiskInsightsMetrics

// Member helpers
createMember(id?, name?, email?) → OrganizationUserView
createMemberRegistry(members[]) → MemberRegistry

// Cipher helpers
createCipher(id?, uris[], collectionIds[]) → CipherView
createCipherHealth(isAtRisk, options?) → CipherHealthView

// Collection & Group helpers
createCollectionAccess(collectionId, userIds[], groupIds[]) → CollectionAccessDetails
createGroupMembership(groupId, memberIds[]) → GroupMembershipDetails

// Report & Application helpers
createReport(appName, memberRefs{}, cipherRefs{}) → RiskInsightsReportView
createApplication(name, isCritical, reviewedDate?) → RiskInsightsApplicationView

// Composite helpers
createTestScenario({ memberCount, applications[], ciphersPerApp }) → Complete test data
```

### Usage Example

```typescript
import {
  createRiskInsights,
  createRiskInsightsSummary,
  createMember,
  createCipher,
  createReport,
} from "../../testing/test-helpers";
import { makeEncString } from "@bitwarden/common/spec";

describe("MyService", () => {
  it("should process data correctly", () => {
    // Create full RiskInsights view
    const riskInsights = createRiskInsights({
      id: "report-123" as OrganizationReportId,
      organizationId: "org-456" as OrganizationId,
      reports: [createReport("github.com", { u1: true }, { c1: true })],
      summary: createRiskInsightsSummary({
        totalApplicationCount: 10,
        totalMemberCount: 50,
      }),
    });

    // Create individual test data
    const member = createMember("u1", "Alice", "alice@example.com");
    const cipher = createCipher("c1", ["https://github.com"], ["coll-1"]);

    // Use Bitwarden utilities for crypto objects
    const encKey = makeEncString("test-key");

    // ... test logic
  });
});
```

### Benefits

- ✅ **DRY** - No duplicate helper code
- ✅ **Consistency** - Same test data patterns everywhere
- ✅ **Maintainability** - Update once, affects all tests
- ✅ **Integration** - Uses `GetUniqueString()` from `@bitwarden/common/spec`

---

## Avoiding `any` Types in Tests

**Rule:** Avoid `any` types in test code. Use proper TypeScript typing.

### Pattern 1: Type Test Objects Properly

```typescript
// ❌ WRONG - Using `any`
const json: any = {
  id: "report-123",
  organizationId: "org-456",
};

// ✅ CORRECT - Using Partial<DeepJsonify<T>>
const json: Partial<DeepJsonify<RiskInsightsView>> = {
  id: "report-123" as OrganizationReportId,
  organizationId: "org-456" as OrganizationId,
};
```

**Why:**

- Type safety catches errors at compile time
- Better IDE autocomplete and refactoring support
- Documents expected data structure

### Pattern 2: Cast Tagged Types

```typescript
// For Tagged types (OrganizationId, OrganizationReportId, CipherId, etc.)
const testData: ApplicationHealthReportDetail = {
  applicationName: "github.com",
  cipherIds: ["cipher-1" as CipherId, "cipher-2" as CipherId],
  atRiskCipherIds: ["cipher-1" as CipherId],
  // ... other fields
};
```

### Pattern 3: Omit Properties Instead of Setting to `undefined`

```typescript
// ❌ WRONG - Setting to undefined (causes type errors)
const json = {
  applicationName: "github.com",
  memberRefs: undefined, // Type error!
  cipherRefs: undefined, // Type error!
};

// ✅ CORRECT - Omit the properties
const json = {
  applicationName: "github.com",
  // memberRefs and cipherRefs intentionally omitted to test defaults
};
```

### Pattern 4: Avoid Type Assertions for Incomplete Objects

**Issue:** Type assertions (`as Type`) bypass TypeScript's type checking. When types evolve (new required fields), assertions hide compilation errors.

```typescript
// ❌ WRONG - Type assertion hides missing required fields
const testData = {
  applicationName: "github.com",
  cipherIds: ["cipher-1"],
  // Missing: passwordCount, atRiskPasswordCount, memberCount, atRiskMemberCount
} as ApplicationHealthReportDetail;

// ✅ CORRECT - Create complete object (compiler enforces all fields)
const testData: ApplicationHealthReportDetail = {
  applicationName: "github.com",
  passwordCount: 2,
  atRiskPasswordCount: 1,
  cipherIds: ["cipher-1" as CipherId, "cipher-2" as CipherId],
  atRiskCipherIds: ["cipher-1" as CipherId],
  memberCount: 1,
  atRiskMemberCount: 1,
  memberDetails: [
    {
      userGuid: "member-1",
      userName: "John Doe",
      email: "john@example.com",
      cipherId: "cipher-1",
    },
  ],
  atRiskMemberDetails: [
    {
      userGuid: "member-1",
      userName: "John Doe",
      email: "john@example.com",
      cipherId: "cipher-1",
    },
  ],
};
```

**When Type Assertions Are Acceptable:**

- Casting string to Tagged types: `"user-123" as UserId`
- Test setup where partial object is intentional: `{} as any` for mock objects
- Never for production-like test data structures

---

## Test Structure and Patterns

### Standard Test Structure

**Follow this structure:**

```typescript
describe("ServiceOrModelName", () => {
  // ==================== Test Helpers (if needed) ====================

  // Import shared helpers at the top
  // Only create local helpers if they have a specific signature unique to this file

  // ==================== Setup ====================

  beforeEach(() => {
    // Setup mocks, services, etc.
  });

  // ==================== Tests by Feature/Method ====================

  describe("methodName", () => {
    it("should handle typical case", () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = method(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("should handle edge case", () => {
      // ...
    });
  });
});
```

### Test Grouping

- Group related tests with `describe()` blocks
- Test one method/feature per describe block
- Use clear, descriptive test names ("should X when Y")

### Arrange-Act-Assert Pattern

```typescript
it("should compute summary correctly", () => {
  // Arrange - Setup test data
  const view = new RiskInsightsView();
  view.reports = [createReport("github.com", { u1: true }, { c1: true })];

  // Act - Execute the code under test
  view.recomputeSummary();

  // Assert - Verify the results
  expect(view.summary.totalApplicationCount).toBe(1);
  expect(view.summary.totalAtRiskApplicationCount).toBe(1);
});
```

---

## Manual Construction for Test Fixtures

**Rule:** Use manual construction for test fixtures, NOT `fromJSON()`.

```typescript
// ✅ CORRECT - Manual construction
const view = new RiskInsightsView();
view.id = "test-id" as OrganizationReportId;
view.reports = [createReport("github.com", {}, {})];
view.memberRegistry = createMemberRegistry([...]);

// ❌ WRONG - Using fromJSON for test fixtures
const view = RiskInsightsView.fromJSON({
  id: "test-id",
  reports: [...],
});
```

**Why:**

- More explicit and readable
- Easier to see what properties are being tested
- Avoids coupling tests to serialization logic
- Reserve `fromJSON()` tests for testing serialization itself

**Exception:** Test `fromJSON()` itself

```typescript
describe("fromJSON", () => {
  it("should deserialize correctly", () => {
    const json: Partial<DeepJsonify<RiskInsightsView>> = {
      id: "test-id" as OrganizationReportId,
      reports: [...],
    };

    const view = RiskInsightsView.fromJSON(json);

    expect(view.id).toBe("test-id");
  });
});
```

---

## Testing View Model Methods

**Pattern:** Test query methods, update methods, and computation methods separately.

```typescript
describe("RiskInsightsView", () => {
  describe("Query Methods", () => {
    describe("getAtRiskMembers", () => {
      it("should return all unique at-risk members", () => { ... });
      it("should deduplicate members across applications", () => { ... });
      it("should return empty array when no at-risk members", () => { ... });
    });
  });

  describe("Update Methods", () => {
    describe("markApplicationAsCritical", () => {
      it("should mark existing application as critical", () => { ... });
      it("should add new application if not in list", () => { ... });
      it("should trigger summary recomputation", () => { ... });
    });
  });

  describe("Computation Methods", () => {
    describe("recomputeSummary", () => {
      it("should compute total counts correctly", () => { ... });
      it("should deduplicate at-risk members", () => { ... });
    });
  });
});
```

**Benefits:**

- Clear organization by functionality
- Easy to find tests for specific methods
- Encourages comprehensive coverage of all method types

---

## Running Tests

```bash
# Run specific test file
npm test -- path/to/file.spec.ts

# Run all tests in a directory
npm test -- bitwarden_license/bit-common/src/dirt/reports/risk-insights

# Run tests with coverage
npm test -- --coverage

# Type-check after tests (catches TypeScript errors)
npm run test:types

# Lint check (catches import order, formatting issues)
npm run lint

# Auto-fix linting issues
npm run lint -- --fix

# Watch mode for development
npm test -- --watch path/to/file.spec.ts
```

### Pre-Commit Checklist

**Run these commands before committing:**

```bash
# 1. Run all tests
npm test -- bitwarden_license/bit-common/src/dirt/reports/risk-insights

# 2. Type-check
npm run test:types

# 3. Lint and auto-fix
npm run lint -- --fix
```

**Why:**

- Tests catch runtime issues
- `test:types` catches TypeScript errors
- `lint --fix` catches and auto-fixes import order, formatting, unused imports
- Running all three ensures clean, working code

### Test Output Tips

**Filter tests by pattern:**

```bash
# Run only tests matching "saveReport"
npm test -- default-report-persistence.service.spec.ts -t "saveReport"

# Run tests in specific describe block
npm test -- risk-insights.view.spec.ts -t "Query Methods"
```

**Debugging failed tests:**

```bash
# Run with verbose output
npm test -- --verbose path/to/file.spec.ts

# Run single test file without parallel execution
npm test -- --runInBand path/to/file.spec.ts
```

---

## Quick Reference

| Do                                                     | Don't                                 |
| ------------------------------------------------------ | ------------------------------------- |
| ✅ Use `makeEncString()` from `@bitwarden/common/spec` | ❌ Use `new EncString()` directly     |
| ✅ Use `Partial<DeepJsonify<T>>` for JSON test data    | ❌ Use `any` for test data            |
| ✅ Import shared test helpers                          | ❌ Duplicate helper functions         |
| ✅ Manual construction for fixtures                    | ❌ Use `fromJSON()` for fixtures      |
| ✅ Cast Tagged types (`as CipherId`)                   | ❌ Type assert incomplete objects     |
| ✅ Omit optional properties                            | ❌ Set properties to `undefined`      |
| ✅ Create complete test objects                        | ❌ Hide missing fields with `as Type` |
| ✅ Group tests by method/feature                       | ❌ Flat test structure                |
| ✅ Clear, descriptive test names                       | ❌ Vague test names like "works"      |
| ✅ Arrange-Act-Assert pattern                          | ❌ Mix setup and assertions           |

---

## Related Documentation

**Standards:**

- [Model Standards](./model-standards.md) - View model construction and EncString patterns
- [Service Standards](./service-standards.md) - Service responsibility patterns to test
- [RxJS Standards](./rxjs-standards.md) - Observable patterns and error handling
- [Testing Standards - Components](./testing-standards-components.md) - Angular component testing

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
