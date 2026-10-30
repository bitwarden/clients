---
paths:
  - "**/*.spec.ts"
---

# Testing

Distilled from [ADR-0010 — Clients Use Jest Mocks](https://contributing.bitwarden.com/architecture/adr/clients-use-jest-mocks).

## Mocking Interfaces and Classes

Use `mock<T>()` from `jest-mock-extended` to mock interfaces, abstract classes, and services. It gives a fully-typed mock with every method auto-stubbed.

```typescript
import { mock } from "jest-mock-extended";

const cipherService = mock<CipherService>();
const i18nService = mock<I18nService>();

cipherService.get.mockResolvedValue(cipher);
expect(i18nService.t).toHaveBeenCalledWith("itemDeleted");
```

`jest.fn()` is still appropriate for ad-hoc callbacks and spies — but reach for `mock<T>()` whenever you'd otherwise be hand-rolling a partial implementation of a typed interface.

## Querying Elements

Only add a `data-testid` when an element can't be queried by other sufficient means (role, accessible name, label or text). Don't add them proactively. Accessible queries find elements the way users and assistive technology do, so a test that passes also confirms the element is accessible; a test ID passes even when it isn't.

When one is needed, name it `<component>-<element>`, e.g. `login-email-input`, matching [writing-end-to-end-tests](../skills/writing-end-to-end-tests/SKILL.md).
