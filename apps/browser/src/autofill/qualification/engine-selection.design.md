# Qualification engine selection

The autofill qualification layer is built around a swappable `QualificationEngine` port. Which engine gets built is a selection problem, and selection has to be answered independently in five places: the popup, the background service worker, and the three autofill content-script bootstraps. This note describes how selection reaches all of them.

## Background

An engine is identified by a `QualificationEngineId` — a stable string persisted in two places, so renaming one is a breaking change to anything already holding the old value. The `ENGINE_REGISTRY` maps each id to a factory, and `resolveEngineId` decides which id a construction site should use.

Three selection sources feed selection, highest precedence first:

1. The picker's choice, written to the shared feature-flag override store.
2. The `qualificationEngine` dev flag, hand-typed into the gitignored `apps/browser/config/local.json` and baked into the bundle by `EnvironmentPlugin` as `process.env.DEV_FLAGS`.
3. The `autofill-qualification-engine` feature flag, resolved through `ConfigService`.

The picker outranks the dev flag: `local.json` is a convenience for whoever set it, and an explicit click is a decision. `QualificationEngineOverrideState.resolvedId$` is that precedence rule, and it is the single implementation of it — the popup and the background both subscribe to it rather than each deriving their own. `resolveEngineId` handles sources 2 and 3 alone, for callers that need an answer without waiting on config.

Both inputs are untrusted — server flag values are cast without any runtime check, and dev flag values are hand-typed — so an unrecognized value degrades to the default rather than throwing. Selection failure must never break autofill for everyone the flag is rolled out to.

A dev-build-only log line names the engine each construction site built, and each swap. It is gated on `process.env.ENV` rather than a runtime toggle so that DefinePlugin folds the branch away in production: a runtime switch would be a side channel a host page could use to observe which classifier is running against its DOM.

## The constraint

Reachability was never the obstacle. The obstacle is that two contexts must construct _synchronously_, at module-evaluation time, while their answer is only available asynchronously:

- `platform/background.ts` constructs `MainBackground` at module scope. Deferring that past the first turn of the event loop would register MV3 event listeners in a microtask, and Chrome may then fail to wake a terminated service worker for those events.
- Each content bootstrap is a synchronous IIFE injected at `document_start` on every page the user visits. The content-script performance budget has no room for a storage read or an IPC round trip there, and content scripts have no access to `ConfigService` at all.

The way out is to swap the engine after construction rather than resolve before it.

## How it works

### A swappable engine

`SwappableQualificationEngine` holds a mutable inner engine and forwards `id`, `name`, `version`, `coveredRoles` and `coveredCategories` through getters. `swap(id)` rebuilds the inner engine and reports whether anything changed.

It composes _outside_ `MemoizingQualificationEngine`, so a swap replaces the memoizer along with the engine and no verdict from the previous engine survives in a warm cache.

`QualificationEngineAdapter` reads `coveredRoles` / `coveredCategories` per call rather than snapshotting them, so coverage follows a swap. It also reads `engine.id` per call, to bypass the engine entirely while `legacy` is selected — the legacy bridge's answers are computed from the same predicates the bypass calls, so skipping it is free, and reading the id live means the bypass turns off the moment the stack swaps away.

### Background follows the selection

`QualificationEngineBackground` subscribes to `QualificationEngineOverrideState.resolvedId$` and swaps the background's stack in place. The stack is built at `resolveEngineId()` during construction and corrected as soon as the subscription emits. Every reference handed out during construction — `AutofillTriageService`, `OverlayBackground`, `ContextMenuClickedHandler` — keeps working.

### Content scripts are corrected, not delayed

Each bootstrap builds at `resolveEngineId()`, which without config resolves to the dev flag or the default, and passes the stack's `swap` into `AutofillInit`. Two things then correct it:

- **Pull.** `AutofillInit.init()` sends `getQualificationEngineId` and swaps on the reply. This covers frames that boot after a change.
- **Push.** `QualificationEngineBackground` sends `updateQualificationEngineId` to every frame of every http(s) tab whenever the selection changes. This covers tabs already open when the flag flips.

Neither blocks construction. Fields are qualified on focus and on mutation, not at construction, so an id arriving a few milliseconds after boot is in time. The id is narrowed with `toQualificationEngineId` on receipt; an unrecognized value leaves the running engine alone.

## Invariants

- Selection never throws. Any unrecognized value from any source degrades to the default.
- Engine identity survives wrapping. Whatever the registry builds must still report its own `id` through the memoizer and the swappable wrapper, or nothing downstream can tell which engine is running.
- Coverage is read, not cached. The adapter's fall-through to the legacy service depends on live coverage.
- Construction is never deferred. Neither the background nor a content script may await its selection source before building.
- No runtime side channel in production. Selection diagnostics are gated at build time, never behind a variable a host page could read or flip.
