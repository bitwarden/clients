# Inline Comments — PR #21077

> Local review mode. Nothing was posted to GitHub.

## Validated findings

After analyzing the committed PR diff and the latest local uncommitted changes, no finding reached the confidence threshold (≥75) required to post an inline comment.

## Resolved review threads (no re-comment needed)

The three open GitHub threads are addressed by the local changes. Per the comment-reopening rules, no responses are posted.

1. **`apps/web/src/app/dirt/reports/pages/cipher-report.component.ts:175`** (claude — ⚠️ IMPORTANT, "misleading success state on failure")
   - Resolved. A `loadFailed` flag is set in the `load()` catch block, and all five shared templates render a `bit-callout type="danger"` error state when it is set. Org report pages share these templates, so they inherit the fix. The exposed-passwords template orders `@if (loadFailed) ... @else if (hasLoaded)` correctly so a failed load no longer falls through to the "no exposed passwords found" success callout.

2. **`apps/web/src/app/dirt/reports/pages/cipher-report.component.ts:141`** (lastbestdev — nested try blocks / individual flag setting)
   - Resolved. The nested try/catch is gone; `load()` now uses a single try/catch/finally. `hasLoaded` is set only on success, `loadFailed` only on failure, and `loading` settles in `finally`.

3. **`apps/web/src/app/dirt/reports/pages/exposed-passwords-report.component.ts:119`** (lastbestdev — log cipher/organization id for troubleshooting)
   - Resolved. The error log now includes `cipher ${cv.id}`. A cipher GUID is not Vault Data, so this is consistent with the no-PII-in-logs rule. Organization scope is already captured via the `[reportScope]` prefix.

## Items from the prior review run that are now resolved

- **Org context-load failure leaving `loadFailed = false` / dangling unhandled rejection** (previously flagged ⚠️ IMPORTANT at `organizations/exposed-passwords-report.component.ts:104` and the four sibling org pages).
  - Resolved by the latest local changes. Each org `ngOnInit` now wraps the entire `orgReportContext.load(...)` + assignment + `super.ngOnInit()` + success log in one `try`, and the `catch` sets `this.loadFailed = true` (and logs) without rethrowing. A context-load failure therefore sets `loadFailed`, the template renders the error callout, and there is no unhandled async rejection in the `tap`.

## Items considered and dropped (false positives / pre-existing)

- `tsc --noEmit` flags `new CipherReportComponent(...)` in `cipher-report.component.spec.ts:54` as instantiating an abstract class. Dropped — pre-existing (present at HEAD before this PR), and the actual jest toolchain compiles and passes it (78/78 tests green).
- Org components no longer rethrow after setting `loadFailed`. Dropped — the only consumer is the route-param `tap`; nothing downstream relies on the rejection, and swallowing is the intended behavior to surface the error UI.
