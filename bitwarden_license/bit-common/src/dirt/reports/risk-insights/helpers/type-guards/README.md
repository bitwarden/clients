# Type Guards

**Purpose:** Reference guide for the type guard infrastructure used to validate decrypted Access Intelligence report data.

---

## Overview

All data arriving from decrypted blobs must pass through these guards before use.
Two categories of building blocks work together:

| File                           | What it contains                                        |
| ------------------------------ | ------------------------------------------------------- |
| `basic-type-guards.ts`         | Primitive guards and factory functions                  |
| `risk-insights-type-guards.ts` | Access Intelligence validators composed from primitives |

---

## Factory Functions

### `createValidator<T>(validators)`

Creates a type guard for a **fixed-schema plain object** from a map of per-field guards.
Use this for every object validator — never write manual object validators.

```typescript
// ✅ DO — compose via createValidator
const isMyModel = createValidator<MyModel>({
  id: isBoundedString,                   // required — must be present and non-empty
  label: isBoundedStringOrNull,          // required — must be present, may be null
  reportedAt: isDateStringOrUndefined,   // optional — key may be absent from JSON
});

// ❌ DON'T — write manual field-by-field checks
function isMyModel(value: unknown): value is MyModel {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isBoundedString(obj["id"]) && ...;
}
```

**Built-in protections:**

- Rejects non-plain-objects (arrays, class instances, `null`)
- Blocks prototype pollution (`__proto__`, `constructor`, `prototype`)
- Absent keys pass `undefined` to the guard — required guards reject it naturally;
  optional guards (e.g. `isBoundedStringOrUndefined`) accept it

#### `.explain()` — Diagnostic Mode

Every validator returned by `createValidator` exposes an `.explain(value)` method.
It returns `string[]` — empty if validation passes, otherwise one message per failing field.

Use `.explain()` only in error messages and logging. Never use it in hot data paths —
it iterates all fields even after the boolean guard has already returned `false`.

```typescript
const errors = isMyModel.explain(suspectValue);
if (errors.length > 0) {
  throw new Error(`Validation failed:\n  ${errors.join("\n  ")}`);
}
```

**Error message format:**

| Situation                    | Example message                                                        |
| ---------------------------- | ---------------------------------------------------------------------- |
| Not a plain object           | `"expected plain object, got Array(3)"`                                |
| Class instance or null-proto | `"rejected: non-plain object (class instance or Object.create(null))"` |
| Prototype pollution attempt  | `"rejected: prototype pollution attempt via key \"__proto__\""`        |
| Field fails its guard        | `"field 'email': guard isBoundedString failed — got null"`             |
| Required field absent        | `"field 'id': guard isBoundedString failed — got undefined"`           |

**Security note:** Messages describe types only (`"null"`, `"string"`, `"Array(3)"`) —
never actual values. Safe for production logs (no PII or vault data exposed).

**Constraint:** `.explain()` reports top-level field failures only. It does not recurse into
why a nested guard (e.g. `isMemberDetailsArray`) failed element-by-element.

---

### `createBoundedArrayGuard<T>(isType)`

Creates a type guard for an array of `T`, bounded to `BOUNDED_ARRAY_MAX_LENGTH` (50 000 items).

```typescript
const isMyModelArray = createBoundedArrayGuard(isMyModel);
```

---

## Primitive Guards

Primitives are `(value: unknown) => value is T` functions that test a single value.
They are the building blocks passed to `createValidator`.

### Choosing the Right Guard for a Field

| TypeScript field type                      | Guard to use                 |
| ------------------------------------------ | ---------------------------- |
| `string` (required)                        | `isBoundedString`            |
| `string \| null`                           | `isBoundedStringOrNull`      |
| `string \| undefined` (optional field)     | `isBoundedStringOrUndefined` |
| `number` (count, non-negative)             | `isBoundedPositiveNumber`    |
| `boolean`                                  | `isBoolean`                  |
| `Record<string, boolean>`                  | `isBooleanRecord`            |
| `Date`                                     | `isDate`                     |
| `Date \| null`                             | `isDateOrNull`               |
| `string` (ISO date, required)              | `isDateString`               |
| `string \| null` (ISO date, nullable)      | `isDateStringOrNull`         |
| `string \| undefined` (ISO date, optional) | `isDateStringOrUndefined`    |

> ⚠️ **Optional vs. nullable:** Use `*OrUndefined` guards for fields that may be absent from
> JSON-parsed objects (`JSON.stringify` drops `undefined` values, so the key won't exist after
> `JSON.parse`). Use `*OrNull` guards for fields that are always present but may be `null`.

---

## Adding a New Validator

### Step 1 — Do you need a new primitive?

If the field type is not covered by the table above, add it to `basic-type-guards.ts`.
Keep each primitive focused on one type.

```typescript
// basic-type-guards.ts
export function isMyNewType(value: unknown): value is MyNewType {
  // single-type check only
}
```

### Step 2 — Compose the object validator

```typescript
// risk-insights-type-guards.ts
const isMyModel = createValidator<MyModel>({
  id: isBoundedString,
  count: isBoundedPositiveNumber,
  reportedAt: isDateStringOrUndefined,
});
const isMyModelArray = createBoundedArrayGuard(isMyModel);
```

### Step 3 — Add a validate function for blob entry points

Validate functions are called at the decryption boundary and throw on invalid data.

```typescript
export function validateMyModelArray(data: unknown): MyModel[] {
  if (!Array.isArray(data)) {
    throw new Error("Invalid data: expected array, received non-array");
  }
  const invalidItems = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isMyModel(item));
  if (invalidItems.length > 0) {
    const elementMessages = invalidItems.map(({ item, index }) => {
      const fieldErrors = isMyModel.explain(item).join("; ");
      return `  element[${index}]: ${fieldErrors}`;
    });
    throw new Error(
      `Invalid data: ${invalidItems.length} invalid element(s)\n` + elementMessages.join("\n"),
    );
  }
  if (!isMyModelArray(data)) {
    throw new Error("Invalid data");
  }
  return data;
}
```

---

## When Manual Validation Is Acceptable

`createValidator` handles fixed-schema objects. Two cases require hand-written logic:

1. **Dynamic-key dictionaries** (e.g. `Record<string, SomeType>`) — use a manual loop:

   ```typescript
   // validateAccessReportPayload does this for memberRegistry
   for (const [key, entry] of Object.entries(registry)) {
     if (!isBoundedString(key) || !isMemberRegistryEntryData(entry)) { ... }
   }
   ```

2. **Custom primitive guards** for field types not in `basic-type-guards.ts` (e.g. `isCipherId`,
   `isValidDateOrNull`) — these are single-value primitives, not object validators.

> **Rule:** Never write a manual multi-field object validator. If `createValidator` can't
> express the validation, add the missing primitive to `basic-type-guards.ts` and compose.
> If the shape is truly dynamic, use a manual loop with existing primitives.

---

**Document Version:** 1.1
**Last Updated:** 2026-03-06
**Maintainer:** DIRT Team
