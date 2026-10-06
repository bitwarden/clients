---
name: evaluating-sdk-internal-updates
description: Evaluates a bitwarden/clients "Update sdk-internal to" PR against the sdk-internal commit range for compile-time and runtime breaking changes, maps affected symbols to TypeScript call sites, and applies clear in-scope fixes. Use when reviewing an SDK bump PR, an @bitwarden/sdk-internal version change in package.json, or triaging sdk-internal breaking changes. Requires a sibling `bitwarden/sdk-internal` clone.
allowed-tools:
  - Bash(node .claude/skills/evaluating-sdk-internal-updates/sdk-surface-diff.mjs *)
  - Bash(npm run test:types)
  - Bash(npm run lint:fix)
  - Bash(npm test -- *)
  - Bash(npx prettier *)
  - Bash(gh pr diff:*)
  - Bash(gh pr view:*)
  - Bash(git -C * log *)
  - Bash(git -C * show *)
  - Bash(git grep:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(grep:*)
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Skill(writing-client-code)
  - Skill(bitwarden-delivery-tools:committing-changes)
---

# Evaluating sdk-internal Updates

**Identify both compile-time and runtime breaks before fixing anything — fixing the first break found is not finishing.** Steps 4-7 cover the entire commit range, step 8 reports it, and step 9 starts only after that.

This SDK is the boundary where Protected Data becomes Vault Data. A fix must not send a decrypted value to an API service, log one, or move a decrypt out of the SDK into TypeScript. `.claude/CLAUDE.md` forbids new encryption logic in this repo, so a bump that appears to require some is a finding to report, not a fix to write. [Security definitions](https://contributing.bitwarden.com/architecture/security/definitions).

## Identify

Binding surface facts specific to this SDK: the pin is two npm versions in the root `package.json`, `@bitwarden/sdk-internal` and `@bitwarden/commercial-sdk-internal`, always the same string — `npm run lint:sdk-internal-versions` fails if they differ. The version encodes no commit; the sdk-internal SHA lives in `VERSION` inside the tarball. Nothing generated is committed, here or upstream: the API record is `bitwarden_wasm_internal.d.ts` inside the published package, whose root and `node/` copies are byte-identical, and `bitwarden_wasm_internal_bg.wasm.d.ts` is raw ABI and never a finding.

The annotations behind this surface are `#[wasm_bindgen]` and `derive(..., Tsify)`. `#[uniffi::export]` is mobile-only and largely disjoint, so a uniffi sweep under-reports this surface badly. Serde attributes are part of the emitted type: `rename`, `rename_all`, `skip` and `Option` changes alter the `.d.ts` with no Rust signature change, and a `features = ["wasm"]` edit in `crates/bitwarden-wasm-internal/Cargo.toml` adds or removes types wholesale. Enum members are wire values (`CipherType.Login = 1`); a renumbering compiles clean at every call site and corrupts data.

Most classes have a `private constructor()` and are reachable only through a parent client accessor (`sdk.user_crypto_management()`), so a renamed accessor breaks callers with the class itself unchanged. `tsconfig.base.json` sets `skipLibCheck: true`, so only call sites are checked. `bitwarden_license/bit-common/src/platform/sdk/sdk-alias.d.ts` re-exports the commercial package under the `@bitwarden/sdk-internal` module name and ESLint forbids importing it directly, so call sites grep identically for both packages.

1. `gh pr diff <PR> -R bitwarden/clients -- package.json` → the old and new version.
2. Locate the `bitwarden/sdk-internal` clone in a sibling directory — `../sdk-internal`, where CI places it. If there is none, stop and tell the user it is a required prerequisite for this skill; do not clone it yourself.
3. Read the baseline type check. **In CI it has already run and the prompt names its log; grep it for `error TS` and treat that as this step's output. Do not run it.** Locally, `npm run test:types`. Note any failure and continue — a clean run rules out compile breaks only where the baseline looks, and step 7 is where it does not look.
4. `node .claude/skills/evaluating-sdk-internal-updates/sdk-surface-diff.mjs <old-version> <new-version>`, then again with `--commercial`. It prints RANGE (including the sdk-internal SHA pair step 5 needs), REMOVED, ADDED and MUTATED, keyed per member: a class method, interface property and enum member each get their own `Owner.member` entry. In ADDED, only a pre-existing owner is a break — a new non-optional property on an existing interface breaks every construction site.
5. `git -C ../sdk-internal log --reverse --oneline <old-sha>..<new-sha>`, then `show` each commit. Classify per hunk, not per commit — a commit with one additive headline change can still carry a second, unrelated breaking hunk. A hunk that only touches a macro invocation does not show the surface; read the macro's definition before classifying it. This is also what explains a property the step 4 diff shows renamed or gone.
6. For every symbol from step 4, `git grep -n '<Symbol>'` from the repo root for the bare name — no module list and no import-prefix filter, since everything arrives as a plain `@bitwarden/sdk-internal` import and both apps and `bitwarden_license` consume it. Use `git grep`, not `grep -r`, which also searches `node_modules/@bitwarden/*sdk-internal/` and reports the bindings themselves as call sites. A surface change stays a candidate until a call site makes it a finding.
7. Three sets of call sites step 3 does not cover. Read each one the range touches.
   - `apps/` and `bitwarden_license/` get no dedicated `tsc` leg and ride only on `tsc-strict`, which filters by file, so an ordinary type error inside a `@ts-strict-ignore` file is discarded: `git grep -l '@bitwarden/sdk-internal' -- 'apps/**' 'bitwarden_license/**'`, then check that file list for `@ts-strict-ignore` with the `Grep` tool rather than piping into `xargs`, which carries no grant of its own.
   - The root `tsconfig.json` excludes app spec files but not `bitwarden_license` ones, so `git grep -l '@bitwarden/sdk-internal' -- 'apps/**/*.spec.ts'` is type-checked by nothing; the `bitwarden_license` equivalent is still covered by `tsc-strict`.
   - `git grep -l 'jest.mock("@bitwarden/sdk-internal"'` — factory-form mocks are not checked against the real module and drift silently. `libs/common/src/platform/spec/mock-sdk.service.ts` and `libs/common/spec/jest-sdk-client-factory.ts` are structural and break loudest, the latter on any `PasswordManagerClient` constructor change.
8. Report under these headings, which are the same across every repo running this evaluation: `## SDK bump evaluated`, `## Compile-time breaks`, `## Runtime considerations` (wire-value and serialization findings go here; omit the heading when there are none), `## Everything else in range — confirmed safe`, `## Commit`. Give each finding its commit, symbol and call sites, and state whether the type check passed inside `## Compile-time breaks` rather than as its own section. Cite sdk-internal commits and PRs as `bitwarden/sdk-internal#<N>` or a full URL — a bare `#<N>` copied from a commit subject auto-links into bitwarden/clients and tags an unrelated PR.

## Resolve

9. Fix anything found, compile-time or runtime, whenever the correct behavior is clear and in scope. For a new required argument or method with no existing consumer, grep the underlying concept rather than the new name, which does not exist yet; with no consumer, stub it — an empty body with a `// no-op` comment, or a default return, never a `throw`, which turns a stub into a crash. A sibling's structure is a template; its behavior is not evidence for yours, so read the SDK to choose between two plausible argument values. Never edit `package.json`: the pin is the bump's output, not the fix's. If unsure, report it instead of guessing, along with anything needing a product decision. Invoke `Skill(writing-client-code)` first if the fix is not purely mechanical, then commit with `Skill(bitwarden-delivery-tools:committing-changes)`.
10. `npm run lint:fix`, then `npx prettier --write <edited files>`, then `npm run test:types`, then `npm test -- <edited paths> --maxWorkers=2`. Run all four even in CI: `lint.yml`'s `npm run lint` step runs ESLint as well as Prettier, and `--maxWorkers=2` is this repo's workaround for Jest exhausting memory.
