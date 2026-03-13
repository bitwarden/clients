# Model Standards

**Purpose:** Standards for view model construction, 4-layer model architecture, and working with encrypted strings in Access Intelligence development

---

## Table of Contents

1. [View Model Construction Patterns](#view-model-construction-patterns)
   - [When to Use Manual Construction vs fromJSON](#when-to-use-manual-construction-vs-fromjson)
   - [Quick Reference Table](#quick-reference-table)
2. [4-Layer Model Architecture](#4-layer-model-architecture)
   - [Write Flow (Save)](#write-flow-save)
   - [Read Flow (Load)](#read-flow-load)
3. [Working with EncString](#working-with-encstring)
   - [EncString Structure](#encstring-structure)
   - [Common Operations](#common-operations)
   - [Testing with EncString](#testing-with-encstring)
   - [Quick Reference](#quick-reference)

---

## View Model Construction Patterns

### When to Use Manual Construction vs fromJSON

**Follow the Cipher pattern** - even in the 4-layer pipeline, Cipher uses manual construction when transforming Domain → View.

#### Pattern 1: Manual Construction

**Use when:** Creating a **NEW instance from computed/generated data**

```typescript
// ✅ CORRECT - Generating fresh report from raw data
const view = new RiskInsightsView();
view.id = "" as any; // Will be set by persistence service
view.reports = computedReports; // Freshly computed
view.memberRegistry = registry; // Freshly computed
view.creationDate = new Date(); // NEW timestamp

// ✅ CORRECT - Cipher Domain → View transformation (Cipher.decrypt)
async decrypt(userKey: SymmetricCryptoKey): Promise<CipherView> {
  const model = new CipherView(this); // Pass Domain object
  model.name = await decrypt(this.name); // Manually populate fields
  return model;
}
```

**Why:** We're not deserializing existing data - we're **creating something new** from computation or transformation.

#### Pattern 2: fromJSON (Deserialization)

**Use when:** Reconstructing an instance from **serialized storage** (API, cache, localStorage)

```typescript
// ✅ CORRECT - Loading saved report from storage
const savedData = await this.stateProvider.get(REPORT_KEY);
const view = RiskInsightsView.fromJSON(savedData);

// ✅ CORRECT - State deserialization (ciphers.state.ts)
deserializer: (cipher: Jsonify<CipherView>) => CipherView.fromJSON(cipher);
```

**Why:** We're **deserializing** data that was previously saved using `toJSON()`.

### Quick Reference Table

| Scenario              | Pattern             | Example                                    |
| --------------------- | ------------------- | ------------------------------------------ |
| **Generate new data** | Manual construction | `new RiskInsightsView()` + populate fields |
| **Domain → View**     | Manual construction | `new CipherView(this)` in `decrypt()`      |
| **Load from storage** | `fromJSON()`        | `RiskInsightsView.fromJSON(savedData)`     |
| **Save to storage**   | `toJSON()`          | `view.toJSON()` → serialize                |
| **Test fixtures**     | Manual construction | `new RiskInsightsView()` + set test data   |

---

## 4-Layer Model Architecture

All models in `bitwarden_license/bit-common/src/dirt/reports/risk-insights/models/` follow the 4-layer architecture:

- **api/** - Wire format (SDK/API responses)
- **data/** - Serializable format (cacheable, plain JSON)
- **domain/** - Business logic layer (EncString fields, encrypted data)
- **view/** - Presentation layer (decrypted, query methods)

### Write Flow (Save)

```typescript
View (manual construction)
  ↓ constructor or populate
Domain (encrypted fields)
  ↓ toData()
Data (serializable)
  ↓ toSdk() or save directly
API (wire format) or Storage
```

**Example:**

```typescript
// ReportPersistenceService.save()
const view = new RiskInsightsView(); // Manual construction
const domain = new RiskInsights(view); // View → Domain
const encrypted = await this.encrypt(domain); // Encrypt
const data = encrypted.toData(); // Domain → Data
await this.apiService.save(data.toSdk()); // Data → API
```

### Read Flow (Load)

```typescript
API (wire format) or Storage
  ↓ fromResponse() or retrieve
Data (serializable)
  ↓ fromJSON()
Domain (encrypted)
  ↓ decrypt()
View (manual construction inside decrypt)
```

**Example:**

```typescript
// ReportPersistenceService.load()
const apiResponse = await this.apiService.get(id); // API
const data = RiskInsightsData.fromJSON(apiResponse); // API → Data
const domain = new RiskInsights(data); // Data → Domain
const view = await domain.decrypt(key); // Domain → View (manual construction)
return view;
```

---

## Working with EncString

### EncString Structure

EncString objects have several properties for different use cases:

```typescript
interface EncString {
  encryptedString: string; // Full encrypted data (MOST COMMON)
  data: string; // Encrypted data without metadata
  iv: string; // Initialization vector
  mac: string; // Message authentication code
}
```

### Common Operations

**Checking if EncString has data:**

```typescript
// ✅ CORRECT - Check .encryptedString for API responses
if (!encString || !encString.encryptedString || encString.encryptedString === "") {
  throw new Error("No encrypted data");
}

// ❌ WRONG - Don't check .data for API responses
if (!encString || encString.data === "") { ... }
```

**Extracting for storage/API:**

```typescript
// ✅ CORRECT - Use .encryptedString property
const data = domain.toData();
data.contentEncryptionKey = encString.encryptedString ?? "";
data.reports = apiResponse.reportData.encryptedString ?? "";

// ❌ WRONG - .data doesn't include encryption metadata
data.contentEncryptionKey = encString.data ?? "";
```

**Validating API response EncStrings:**

```typescript
// ✅ CORRECT - Complete validation
if (
  !apiResponse.contentEncryptionKey ||
  !apiResponse.contentEncryptionKey.encryptedString ||
  apiResponse.contentEncryptionKey.encryptedString === ""
) {
  throw new Error("Report encryption key not found");
}

// ❌ WRONG - Incomplete check (might have empty .encryptedString)
if (!apiResponse.contentEncryptionKey) {
  throw new Error("Report encryption key not found");
}
```

### Testing with EncString

Always use `makeEncString` from `@bitwarden/common/spec`:

```typescript
import { makeEncString } from "@bitwarden/common/spec";

// ✅ CORRECT - Use test utility
const report = new RiskInsights();
report.contentEncryptionKey = makeEncString("test-key");
report.reports = makeEncString("encrypted-reports");

// ❌ WRONG - Direct construction
report.contentEncryptionKey = new EncString("test-key");
```

**Why:**

- `makeEncString` creates properly formatted EncString with correct encryption type
- Consistent test data format across all tests
- Avoids subtle bugs from incorrect EncString construction

### Quick Reference

| Operation               | Property              | Example                                |
| ----------------------- | --------------------- | -------------------------------------- |
| API response validation | `.encryptedString`    | `if (!enc.encryptedString) { ... }`    |
| Extract for persistence | `.encryptedString`    | `data.key = enc.encryptedString ?? ""` |
| Testing                 | Use `makeEncString()` | `makeEncString("test-data")`           |
| Never use               | `.data`               | ❌ Wrong for API responses             |

---

## File Organization

### Barrel Imports (Required)

The `access-intelligence/models/` folder exposes a barrel file at `models/index.ts` that re-exports
all model classes from every layer (api, data, domain, view). **Always import from the barrel, never
from individual model files.**

**From bit-common** (use a relative path to the barrel root):

```typescript
// ✅ CORRECT
import { AccessReportView, ApplicationHealthView } from "../../access-intelligence/models";

// ❌ WRONG - imports from a specific file
import { AccessReportView } from "../../access-intelligence/models/view/access-report.view";
```

**From bit-web** (use the `@bitwarden/bit-common` alias to the barrel root):

```typescript
// ✅ CORRECT
import {
  AccessReportView,
  ApplicationHealthView,
} from "@bitwarden/bit-common/dirt/access-intelligence/models";

// ❌ WRONG - imports from a specific file
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/access-report.view";
```

**Exception — files inside `models/` itself** must use `./` relative sibling imports. Importing
from the barrel would be circular because the barrel re-exports those same files.

```typescript
// ✅ CORRECT - sibling import inside models/
import { MemberRegistryEntryView } from "./member-registry-entry.view";

// ❌ WRONG - circular
import { MemberRegistryEntryView } from "../index";
```

**When adding a new model file:** export it from `models/index.ts` immediately so all callers can
use the barrel.

---

### One Class Per File (4-Layer Models)

**Rule:** Every 4-layer model class gets its own file.

**Pattern:**

```
models/
├── data/
│   ├── risk-insights.data.ts           ← RiskInsightsData only
│   └── risk-insights-report.data.ts    ← RiskInsightsReportData only (+ small related interfaces)
├── domain/
│   ├── risk-insights.ts                ← RiskInsights only
│   └── risk-insights-report.ts         ← RiskInsightsReport only
└── view/
    ├── risk-insights.view.ts            ← RiskInsightsView only
    └── risk-insights-report.view.ts     ← RiskInsightsReportView only
```

**Why:** Matches patterns elsewhere in the codebase. Keeps files focused, makes layer boundaries clear.

**Small related interfaces** (like `MemberRegistryEntryData` alongside `RiskInsightsReportData`) may
stay in the same file when they are tightly coupled to that class and not used independently.

### Service-Internal Types Belong with the Service Abstraction

**Rule:** Types that exist solely as input/output contracts for a specific service are **not** Data
layer models. They belong in the service abstraction file, not in `models/data/`.

**Examples of service-internal types:**

- Encryption I/O shapes (e.g., the decrypted payload passed to `encryptReport()`)
- Internal blob format types (e.g., the versioned JSON format inside an encrypted EncString)
- Operation result structs returned only by one service

**Where they live:**

```
services/
└── abstractions/
    └── risk-insights-encryption.service.ts   ← RiskInsightsReportBlob, RiskInsightsDecryptedData
```

**Why:** These types describe a service contract, not a storage-serializable model. They are rarely
exported outside the service layer. Placing them in `models/data/` incorrectly implies they are
cacheable, API-mappable data objects.

**How to tell the difference:**

| Question                                      | Data model | Service-internal type |
| --------------------------------------------- | ---------- | --------------------- |
| Can it be constructed from an API response?   | ✅ Yes     | ❌ No                 |
| Is it stored/cached directly?                 | ✅ Yes     | ❌ No                 |
| Is it the I/O of one specific service method? | ❌ No      | ✅ Yes                |
| Does it live inside an EncString blob?        | ❌ No      | ✅ Yes                |

---

## Related Documentation

**Standards:**

- [Service Standards](./service-standards.md) - Service patterns for working with models
- [Angular Standards](./angular-standards.md) - Smart models and mutation patterns
- [Testing Standards - Services](./testing-standards-services.md) - Testing models and EncString

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.2
**Last Updated:** 2026-03-12
**Maintainer:** DIRT Team
