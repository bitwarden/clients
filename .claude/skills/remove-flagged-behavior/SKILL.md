---
name: remove-flagged-behavior
description: Remove a feature flag from client code once it has fully rolled out. Use when the user asks to "remove flag X", "remove the feature flag", "clean up flag X", "graduate flag to GA", or "remove flagged logic" for a flag defined in libs/common/src/enums/feature-flag.enum.ts.
---

## Key rule

Do not enable a previously disabled flag as a shortcut — `DefaultFeatureFlagValue` comments say
so explicitly: "DO NOT enable previously disabled flags, REMOVE them instead." Removing the flag
means deleting the `FeatureFlag` enum member, its `DefaultFeatureFlagValue` entry, and every call
site — not just flipping a default to `true`.

## Step 1 — Locate the flag and its call sites

Find the flag's definition and every reference:

```
grep -rn "FeatureFlag\.<FlagName>\b" --include="*.ts" --include="*.html" .
```

Also check for indirect references that don't look like a plain enum access:

- `canAccessFeature(FeatureFlag.<FlagName>, ...)` — route guard (`libs/angular/src/platform/guard/feature-flag.guard.ts`)
- `featureFlaggedRoute({ featureFlag: FeatureFlag.<FlagName>, ... })` — route-level A/B swap (`libs/angular/src/platform/utils/feature-flagged-route.ts`)
- `getFeatureFlag$` / `userCachedFeatureFlag$` subscriptions in templates via `| async`
- Storybook feature-flag addon overrides, mock `ConfigService` values in `*.spec.ts`
- DI registrations that exist only to satisfy one branch (`main.background.ts`, `service-container.ts`, `jslib-services.module.ts`, `*.module.ts` providers)

Read enough of each call site to understand which branch is "old" and which is "new" before touching anything.

## Step 2 — Classify the flag

- **Migration-rollout gate** — the flag guards whether a one-time _data/state_ migration runs, not
  an ongoing behavior. Look for it as a guard clause inside a `Migrator` (`libs/state/src/state-migrations/migrations/`)
  or an `EncryptedMigration` (`libs/common/src/key-management/encrypted-migrator/migrations/`) —
  e.g. `minimum-kdf-migration.ts`'s `needsMigration()` checks `FeatureFlag.ForceUpdateKDFSettings`
  and returns `"noMigrationNeeded"` if it's off. There's no competing "old implementation" — the
  flag just controls whether the one-time migration executes for an account this session.
- **Behavior toggle** — everything else: the flag switches between two ongoing implementations of
  the same feature — UI/UX differences, algorithm changes, **or porting logic to the SDK**
  (e.g. `SdkKeyRotation`, `PM27632_SdkCipherCrudOperations`, `UnlockKeyConnectorWithSdk`). Even when
  moving something to the SDK has no user-visible difference, it's still two branches of code (the
  legacy TS implementation vs. the SDK call) and both need to be read before one is deleted.

This distinction changes what Step 3/4 actually delete: a migration gate has a guard clause to
remove and (usually) no old-implementation code to clean up; a behavior toggle has a whole branch
of implementation to delete.

## Step 3 — Default-enable the new behavior and remove the flag

**Migration-rollout gate:** delete the guard clause so the migration always runs once its other
preconditions are met:

```typescript
// Before
if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpdateKDFSettings))) {
  return "noMigrationNeeded";
}

// After
// (guard removed — migration proceeds whenever the earlier preconditions in this method are met)
```

**Behavior toggle:** read both branches fully before collapsing — confirm which one is actually the
"new" behavior meant to survive (check the PR/ticket that introduced the flag if the naming is
ambiguous). Then collapse to the new branch:

```typescript
// Before
if (await this.configService.getFeatureFlag(FeatureFlag.SdkKeyRotation)) {
  await this.sdkKeyRotationService.rotate(...);
} else {
  await this.legacyKeyRotationService.rotate(...);
}

// After
await this.sdkKeyRotationService.rotate(...);
```

For `featureFlaggedRoute()` swaps, replace the two-route config with just the `flaggedComponent`'s
route. For `canAccessFeature()` guards, remove the guard entirely (or replace with whatever
permission check the feature should have on its own merits).

Then remove the flag definition itself in `libs/common/src/enums/feature-flag.enum.ts`:

- Delete the `FeatureFlag.<FlagName>` enum member
- Delete its `DefaultFeatureFlagValue[FeatureFlag.<FlagName>]` entry
- Leave the surrounding team-grouping comments intact

## Step 4 — Clean up the old behavior

This step is mainly for **behavior toggles**. A migration-rollout gate usually has nothing left to
clean up beyond the guard clause deleted in Step 3 — the migration logic itself is the only
implementation and stays as-is. If the migrator also has legacy pre-migration code paths elsewhere
(e.g. code that special-cased "not yet migrated" state), treat that as its own behavior toggle and
apply this step to it too.

1. Delete the old branch's code (the `else` block, the `defaultComponent`, the legacy service call).
2. Search for now-unreferenced symbols this exposed: functions, methods, whole services/components
   that only existed to serve the deleted branch. `grep -rn "<SymbolName>"` each candidate — if the
   only remaining references are in its own file or its spec file, it's dead.
3. Remove now-unused DI registrations (`safeProvider`/module `providers` entries, `service-container.ts`
   wiring) for services that no longer have any consumer.
4. Remove or update tests that exercised the old branch or mocked the flag as `false`. Tests for the
   new branch that manually stubbed the flag as `true` can drop that stub entirely.
5. Remove now-dead imports.

## Step 5 — Verify

```
npm run lint:fix
npm run prettier
npm run test:types
npm test -- <affected-path>
```

Fix anything these surface before reporting the removal complete — a flag removal that breaks
types or tests isn't done.
