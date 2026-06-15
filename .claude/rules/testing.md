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
