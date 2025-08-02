# `@bitwarden/state`

## Overview

The `@bitwarden/state` library provides scalable, strongly-typed, and observable application state for Bitwarden clients. This library enables centralized management of both global and per-user state, key-based storage, derived/calculated state, and state clearing. State is managed using RxJS observables and designed for seamless cross-client synchronization.

### Key Concepts

- **State Definitions**: Top-level domains for areas of persistent state (see `StateDefinition`).
- **Key Definitions**: Per-domain or per-user identifiers for stored data (see `KeyDefinition` and `UserKeyDefinition`).
- **Global State**: Application-wide state, not scoped by user.
- **User State**: State scoped to a specific or active user.
- **Derived State**: Observable, memory-persistent state computed from other state.
- **Providers**: Classes for resolving specific state lifecycles and scopes.
- **Event Handling**: Event registration/handling for state purge on lock, logout, and more.

## Exports

All main entry points are available via:

```ts
import * as state from "@bitwarden/state";
```

- State definitions/types: `StateDefinition`, `KeyDefinition`, `UserKeyDefinition`, and related options.
- Provider interfaces: `StateProvider`, `GlobalStateProvider`, `ActiveUserStateProvider`, `SingleUserStateProvider`, `DerivedStateProvider`.
- State domains/constants: e.g., `ACCOUNT_MEMORY`, `TOKEN_DISK`, etc. (see `core/state-definitions.ts`).
- Event utilities: `StateEventRegistrarService`, `StateEventRunnerService`.
- State migration primitives (from `state-migrations`).
- Helper types: `StorageKey`, `DerivedStateDependencies`, etc.
