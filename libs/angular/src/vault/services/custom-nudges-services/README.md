# Custom Nudge Services

This folder contains custom implementations of `SingleNudgeService` that provide specialized logic for determining when nudges should be shown or dismissed.

## Architecture Overview

### Core Components

- **`NudgesService`** (`../nudges.service.ts`) - The main service that components use to check nudge status and dismiss nudges
- **`SingleNudgeService`** - Interface that all nudge services implement
- **`DefaultSingleNudgeService`** - Base implementation that stores dismissed state in user state
- **Custom nudge services** - Specialized implementations with additional logic

### How It Works

1. Components call `NudgesService.showNudgeSpotlight$()` or `showNudgeBadge$()` with a `NudgeType`
2. `NudgesService` routes to the appropriate custom nudge service (or falls back to `DefaultSingleNudgeService`)
3. The custom service returns a `NudgeStatus` indicating if the badge/spotlight should be shown
4. Custom services can combine the persisted dismissed state with dynamic conditions (e.g., account age, vault contents)

### NudgeStatus

```typescript
type NudgeStatus = {
  hasBadgeDismissed: boolean; // True if the badge indicator should be hidden
  hasSpotlightDismissed: boolean; // True if the spotlight/callout should be hidden
};
```

## Service Categories

### Universal Services

These services work on **all clients** (browser, web, desktop) and use `@Injectable({ providedIn: "root" })`.

| Service                           | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `NewAccountNudgeService`          | Auto-dismisses after account is 30 days old                            |
| `NewItemNudgeService`             | Checks cipher counts for "add first item" nudges                       |
| `HasItemsNudgeService`            | Checks if vault has items                                              |
| `EmptyVaultNudgeService`          | Checks empty vault state                                               |
| `AccountSecurityNudgeService`     | Checks security settings (PIN, biometrics)                             |
| `VaultSettingsImportNudgeService` | Checks import status                                                   |
| `NoOpNudgeService`                | Always returns dismissed (used as fallback for client specific nudges) |

### Client-Specific Services

These services require **platform-specific features** and must be explicitly registered in each client that supports them.

| Service                       | Clients      | Requires                               |
| ----------------------------- | ------------ | -------------------------------------- |
| `AutoConfirmNudgeService`     | Browser only | `AutomaticUserConfirmationService`     |
| `BrowserAutofillNudgeService` | Browser only | `BrowserApi` (lives in `apps/browser`) |

## Adding a New Nudge Service

### Step 1: Determine if Universal or Client-Specific

**Universal** - If your service only depends on:

- `StateProvider`
- Services available in all clients (e.g., `CipherService`, `OrganizationService`)

**Client-Specific** - If your service depends on:

- Browser APIs (`BrowserApi`, autofill services)
- Services only available in certain clients
- Platform-specific features

### Step 2: Create the Service

#### For Universal Services

```typescript
// my-nudge.service.ts
import { Injectable } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

@Injectable({ providedIn: "root" })
export class MyNudgeService extends DefaultSingleNudgeService {
  constructor(
    stateProvider: StateProvider,
    private myDependency: MyDependency, // Must be available in all clients
  ) {
    super(stateProvider);
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId), // Gets persisted dismissed state
      this.myDependency.someData$,
    ]).pipe(
      map(([persistedStatus, data]) => {
        // Return dismissed if user already dismissed OR your condition is met
        const autoDismiss = /* your logic */;
        return {
          hasBadgeDismissed: persistedStatus.hasBadgeDismissed || autoDismiss,
          hasSpotlightDismissed: persistedStatus.hasSpotlightDismissed || autoDismiss,
        };
      }),
    );
  }
}
```

#### For Client-Specific Services

```typescript
// my-client-specific-nudge.service.ts
import { Injectable } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

@Injectable() // NO providedIn: "root"
export class MyClientSpecificNudgeService extends DefaultSingleNudgeService {
  constructor(
    stateProvider: StateProvider,
    private clientSpecificService: ClientSpecificService,
  ) {
    super(stateProvider);
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.clientSpecificService.someData$,
    ]).pipe(
      map(([persistedStatus, data]) => {
        const autoDismiss = /* your logic */;
        return {
          hasBadgeDismissed: persistedStatus.hasBadgeDismissed || autoDismiss,
          hasSpotlightDismissed: persistedStatus.hasSpotlightDismissed || autoDismiss,
        };
      }),
    );
  }
}
```

### Step 3: Add NudgeType

Add your nudge type to `NudgeType` in `../nudges.service.ts`:

```typescript
export const NudgeType = {
  // ... existing types
  MyNewNudge: "my-new-nudge",
} as const;
```

### Step 4: Register in NudgesService

#### For Universal Services

Add to `customNudgeServices` map in `../nudges.service.ts`:

```typescript
private customNudgeServices: Partial<Record<NudgeType, SingleNudgeService>> = {
  // ... existing
  [NudgeType.MyNewNudge]: inject(MyNudgeService),
};
```

#### For Client-Specific Services

1. **Add injection token** in `../nudge-injection-tokens.ts`:

```typescript
export const MY_NUDGE_SERVICE = new InjectionToken<SingleNudgeService>("MyNudgeService");
```

2. **Inject with optional** in `../nudges.service.ts`:

```typescript
private myNudgeService = inject(MY_NUDGE_SERVICE, { optional: true });

private customNudgeServices = {
  // ... existing
  [NudgeType.MyNewNudge]: this.myNudgeService ?? this.noOpNudgeService,
};
```

3. **Register in each supporting client** (e.g., `apps/browser/src/popup/services/services.module.ts`):

```typescript
import { MY_NUDGE_SERVICE } from "@bitwarden/angular/vault";

safeProvider({
  provide: MY_NUDGE_SERVICE as SafeInjectionToken<SingleNudgeService>,
  useClass: MyClientSpecificNudgeService,
  deps: [StateProvider, ClientSpecificService],
}),
```
