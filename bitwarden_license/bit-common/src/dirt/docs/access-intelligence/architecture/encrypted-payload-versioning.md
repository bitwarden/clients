# Encrypted payload versioning

**Purpose:** Documents the versioning strategy for AccessReport encrypted payloads, including the
format, service architecture, legacy migration path, and how to add a new version

---

## Table of Contents

1. [Overview](#1-overview)
2. [The VersionEnvelope format](#2-the-versionenvelope-format)
3. [Service architecture](#3-service-architecture)
4. [Decrypt flow](#4-decrypt-flow)
5. [Encrypt (serialize) flow](#5-encrypt-serialize-flow)
6. [Legacy format detection](#6-legacy-format-detection)
7. [How to add a new version](#7-how-to-add-a-new-version)
8. [Future cleanup](#8-future-cleanup)

---

## 1. Overview

Each AccessReport is stored as three separately encrypted payloads:

| Payload         | Storage                  | Contains                                         |
| --------------- | ------------------------ | ------------------------------------------------ |
| **Report**      | Remote storage (pending) | `ApplicationHealth[]` entries + `MemberRegistry` |
| **Summary**     | API inline `EncString`   | Aggregate counts (`totalMemberCount`, etc.)      |
| **Application** | API inline `EncString`   | Per-app settings (`isCritical`, `reviewedDate`)  |

Before versioning was added, payloads were written without version metadata. When V2 introduced a
new report structure (compact `cipherRefs`/`memberRefs` instead of full member arrays), there was
no reliable way to detect which format was stored on disk.

The versioning layer solves this by wrapping each payload in a `VersionEnvelope<T>` before
encryption and unwrapping it after decryption. Each payload has its own independent version — a
structural change to the report payload does not force a version bump on the summary if the summary
format hasn't changed.

---

## 2. The VersionEnvelope format

All payloads are serialized as `{ version: number, data: T }` before encryption:

```json
{
  "version": 1,
  "data": { "...payload-specific data..." }
}
```

The `version` field describes the schema of `data`. Current versions:

| Payload     | Current version | Legacy (unversioned) detection |
| ----------- | --------------- | ------------------------------ |
| Report      | 1               | `Array.isArray(json)`          |
| Summary     | 1               | `!isVersionEnvelope(json)`     |
| Application | 1               | `Array.isArray(json)`          |

### Supporting types

All versioning types live in
[`services/abstractions/versioning.service.ts`](../../../../../access-intelligence/services/abstractions/versioning.service.ts):

```typescript
// The on-disk wrapper format
export interface VersionEnvelope<T> {
  version: number;
  data: T;
}

// True when json has { version: number, data: any }
export function isVersionEnvelope(value: unknown): value is VersionEnvelope<unknown>;

// Thrown when a version number is present but not recognized
export class UnsupportedVersionError extends Error {
  constructor(readonly foundVersion: number | undefined) {}
}
```

---

## 3. Service architecture

Three services handle versioning, one per payload type:

| Service                        | Type parameter               | `currentVersion` |
| ------------------------------ | ---------------------------- | ---------------- |
| `ReportVersioningService`      | `AccessReportPayload`        | 1                |
| `SummaryVersioningService`     | `AccessReportSummaryData`    | 1                |
| `ApplicationVersioningService` | `AccessReportSettingsData[]` | 1                |

All three extend `VersioningService<T>`:

```typescript
export abstract class VersioningService<T> {
  abstract readonly currentVersion: number;

  // Deserialize and validate JSON from a decrypted payload.
  // Returns wasLegacy: true when the payload had no version envelope.
  abstract process(json: unknown): { data: T; wasLegacy: boolean };

  // Serialize typed data to the versioned JSON format for encryption.
  abstract serialize(data: T): string;
}
```

All three services are wired into Angular DI in `access-intelligence-routing.module.ts` and
injected into `DefaultAccessReportEncryptionService`, which calls them during encrypt/decrypt.

---

## 4. Decrypt flow

```
EncString (stored on disk)
  → EncryptService.decryptString()        raw JSON string
  → JSON.parse()                          unknown
  → VersioningService.process(json)       { data: T, wasLegacy: boolean }
  → typed payload data
  → used to populate AccessReportView
```

`process()` handles two cases:

**Versioned payload** (`isVersionEnvelope(json)` is `true`)

1. Check `json.version === currentVersion` — throw `UnsupportedVersionError` if not
2. Validate the payload type via type guard
3. Return `{ data: json.data, wasLegacy: false }`

**Legacy payload** (no version envelope)

1. Apply payload-specific migration to normalize old format to current typed shape
2. Return `{ data: migrated, wasLegacy: true }`

If `wasLegacy` is `true` on any payload, `DefaultAccessReportEncryptionService` sets
`hadLegacyBlobs: true` on `DecryptedAccessReportData`. The persistence service uses this flag
to re-save the report in the current envelope format.

---

## 5. Encrypt (serialize) flow

```
typed payload data
  → VersioningService.serialize(data)     '{ "version": 1, "data": { ... } }'
  → EncryptService.encryptString()        EncString
```

`serialize()` always writes the current version envelope — legacy format is never written. This
means every save migrates any legacy payloads to the current format automatically.

---

## 6. Legacy format detection

Each payload type had a different unversioned format before versioning was introduced:

### Report payload (legacy)

The original format was a flat `ApplicationHealthReportDetail[]` array with full `MemberDetails`
objects embedded per cipher — no member registry, no compact refs.

- **Detection:** `Array.isArray(json)`
- **Migration:** `ReportVersioningService._transformLegacyReportToPayload()` builds the member
  registry and converts `MemberDetails` arrays to compact `memberRefs` Records

### Application payload (legacy)

The original format was an `OrganizationReportApplication[]` array.

- **Detection:** `Array.isArray(json)`
- **Migration:** Maps `reviewedDate: Date` → ISO string, `null` → `undefined`

### Summary payload (legacy)

The original format was a plain `{ totalMemberCount, totalAtRiskMemberCount, ... }` object with
no version envelope. Note: an earlier iteration added a top-level `version` field as a sibling
alongside the summary fields. The `isVersionEnvelope` guard correctly identifies both as legacy
because neither has the `data` wrapper.

- **Detection:** `!isVersionEnvelope(json)`
- **Migration:** The flat object is already the correct shape — validate and return as-is

---

## 7. How to add a new version

Use a version bump only for **breaking changes**: renaming a field, removing a field,
restructuring the shape, or adding a new required field. For optional additions, see below.

### Breaking change: step-by-step

1. **Update the payload type** (`AccessReportPayload`, `AccessReportSummaryData`, or
   `AccessReportSettingsData[]`)

2. **Update the type guard** in `risk-insights-type-guards.ts` to validate the new shape

3. **In the versioning service:**
   - Increment `currentVersion`
   - Add a `case json.version === currentVersion` branch in `process()` for the new shape
   - The previous version becomes a migration case — add transformation logic
   - `serialize()` needs no changes — it serializes the current type automatically

4. **Write migration logic** for the previous version: normalize old data to the new type
   (e.g., set a default for a new required field)

### Example: adding a required field to summary

```typescript
// payload type change:
interface AccessReportSummaryData {
  totalMemberCount: number;
  // ... existing fields ...
  totalPendingTaskCount: number; // new required field
}

// SummaryVersioningService:
readonly currentVersion = 2;

process(json: unknown): { data: AccessReportSummaryData; wasLegacy: boolean } {
  if (isVersionEnvelope(json)) {
    if (json.version === 2) {
      // current — validate and return
      if (!isAccessReportSummaryData(json.data)) { throw ... }
      return { data: json.data, wasLegacy: false };
    }
    if (json.version === 1) {
      // migrate: supply default for new required field
      const migrated = { ...(json.data as V1Shape), totalPendingTaskCount: 0 };
      if (!isAccessReportSummaryData(migrated)) { throw ... }
      return { data: migrated, wasLegacy: false };
    }
    throw new UnsupportedVersionError(json.version);
  }
  // legacy (no envelope) — migrate to current
  const migrated = { ...(json as LegacyShape), totalPendingTaskCount: 0 };
  if (!isAccessReportSummaryData(migrated)) { throw ... }
  return { data: migrated, wasLegacy: true };
}
```

### Additive change: no version bump needed

If a new field is optional (`field?: Type`):

- Add the optional field to the payload type
- Update the type guard to not require it
- In `process()`, treat `undefined` as the field's default value
- No version bump required — old payloads simply won't have the field

---

## 8. Future cleanup

### Rename `hadLegacyBlobs` on `DecryptedAccessReportData`

The field `hadLegacyBlobs` uses "blobs" terminology from the old naming convention. It should be
renamed to `hadLegacyPayloads` to align with the terminology in this document. This is a trivial
rename across `DefaultAccessReportEncryptionService` and its callers.

---

## Related documentation

- [Report storage architecture](./report-blob-storage-architecture.md) — Storage plan for the
  report payload
- [`versioning.service.ts`](../../../../../access-intelligence/services/abstractions/versioning.service.ts) — Abstract base class and shared types
- [`access-report-encryption.service.ts`](../../../../../access-intelligence/services/abstractions/access-report-encryption.service.ts) — Encryption service abstraction

---

**Document Version:** 1.2
**Last Updated:** 2026-03-12
**Maintainer:** DIRT Team
