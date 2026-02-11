# DrawerStateService Integration Guide

**Service:** `DrawerStateService` (abstract) / `DefaultDrawerStateService` (implementation)
**Replaces:** Drawer state management in `RiskInsightsDataService`
**Status:** ✅ Service created, ⏳ Integration pending
**Created:** 2026-02-10

---

## Overview

### What This Service Does

`DrawerStateService` manages drawer UI state (open/closed, type, invoker ID) using Angular Signals. It follows the **separation of concerns** principle:

- **State** (open/closed/type) lives in `DrawerStateService`
- **Content** (list of members/apps) is derived in components from `report$` observable

### What It Replaces

**Old approach (RiskInsightsDataService):**

- ❌ Mixed state + content in single `BehaviorSubject<DrawerDetails>`
- ❌ Service computed and stored drawer content
- ❌ Separate `setDrawerFor*` method for each drawer type
- ❌ Content gets stale if report changes

**New approach (DrawerStateService):**

- ✅ State-only service using Signal
- ✅ Components derive content from `report$` + view model methods
- ✅ Single `openDrawer()` method for all types
- ✅ Content always fresh (reactively computed)

### Key Architectural Change

```
OLD: Service stores state + content → Component displays
NEW: Service stores state → Component derives content from report$ → Component displays
```

---

## 1. DI Registration

### Step 1: Add to Providers

**File:** `bitwarden_license/bit-common/src/dirt/reports/risk-insights/services/providers.ts`

```typescript
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { DrawerStateService } from "./abstractions/drawer-state.service";
import { DefaultDrawerStateService } from "./implementations/default-drawer-state.service";

export const ACCESS_INTELLIGENCE_PROVIDERS = [
  safeProvider({
    provide: DrawerStateService,
    useClass: DefaultDrawerStateService,
    deps: [], // No dependencies - pure state management
  }),
  // ... other providers
];
```

### Step 2: Register in Angular Module

**File:** `bitwarden_license/bit-web/src/app/dirt/access-intelligence/access-intelligence.module.ts`

```typescript
import { ACCESS_INTELLIGENCE_PROVIDERS } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";

@NgModule({
  providers: [
    ...ACCESS_INTELLIGENCE_PROVIDERS,
    // Keep existing providers during migration
    RiskInsightsOrchestratorService,
    RiskInsightsDataService,
  ],
})
export class AccessIntelligenceModule {}
```

**Note:** Both old and new services coexist during migration. Remove old services once all components migrated.

---

## 2. Component Migration

### Migration Approach: Option 1 (Minimal Changes)

Keep existing `DrawerDetails` interface and drawer dialog component unchanged. Only change how the parent component creates the `DrawerDetails` object.

#### Before: RiskInsightsComponent (Old)

```typescript
export class RiskInsightsComponent {
  constructor(
    private dataService: RiskInsightsDataService,
    private dialogService: DialogService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit() {
    // OLD: Subscribe to drawerDetails$ which includes content
    this.dataService.drawerDetails$
      .pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev.activeDrawerType === curr.activeDrawerType && prev.invokerId === curr.invokerId,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => {
        if (details.activeDrawerType !== DrawerType.None) {
          this.currentDialogRef = this.dialogService.openDrawer(
            RiskInsightsDrawerDialogComponent,
            { data: details }, // Details includes atRiskMemberDetails, etc.
          );
        } else {
          this.currentDialogRef?.close();
        }
      });
  }

  openAtRiskMembersDrawer() {
    // OLD: Service computes and stores content
    this.dataService.setDrawerForOrgAtRiskMembers("summary-card");
  }
}
```

#### After: RiskInsightsComponent (New)

```typescript
import { toObservable } from "@angular/core/rxjs-interop";

export class RiskInsightsComponent {
  constructor(
    private drawerStateService: DrawerStateService, // NEW
    private dataService: AccessIntelligenceDataService, // NEW (or keep RiskInsightsDataService for now)
    private dialogService: DialogService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit() {
    // NEW: Combine state + report to create DrawerDetails
    combineLatest([
      toObservable(this.drawerStateService.drawerState), // State Signal → Observable
      this.dataService.report$, // Report data
    ])
      .pipe(
        distinctUntilChanged(
          (prev, curr) => prev[0].type === curr[0].type && prev[0].invokerId === curr[0].invokerId,
        ),
        map(([state, report]) => this.createDrawerDetails(state, report)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => {
        if (details.activeDrawerType !== DrawerType.None) {
          this.currentDialogRef = this.dialogService.openDrawer(
            RiskInsightsDrawerDialogComponent,
            { data: details }, // Same interface as before
          );
        } else {
          this.currentDialogRef?.close();
        }
      });
  }

  openAtRiskMembersDrawer() {
    // NEW: Just update state - content derived reactively
    this.drawerStateService.openDrawer(DrawerType.OrgAtRiskMembers, "summary-card");
  }

  // NEW: Helper to convert state + report → DrawerDetails
  private createDrawerDetails(state: DrawerState, report: RiskInsightsView | null): DrawerDetails {
    if (!state.open || !report) {
      return {
        open: false,
        invokerId: "",
        activeDrawerType: DrawerType.None,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };
    }

    // Compute content based on drawer type using view model methods
    switch (state.type) {
      case DrawerType.OrgAtRiskMembers:
        return {
          open: true,
          invokerId: state.invokerId,
          activeDrawerType: state.type,
          atRiskMemberDetails: report.getAtRiskMembers(), // View model method
          appAtRiskMembers: null,
          atRiskAppDetails: null,
        };

      case DrawerType.AppAtRiskMembers:
        const app = report.getApplicationByHostname(state.invokerId);
        return {
          open: true,
          invokerId: state.invokerId,
          activeDrawerType: state.type,
          atRiskMemberDetails: [],
          appAtRiskMembers: {
            members: app?.getMemberDetails() ?? [],
            applicationName: state.invokerId,
          },
          atRiskAppDetails: null,
        };

      case DrawerType.OrgAtRiskApps:
        return {
          open: true,
          invokerId: state.invokerId,
          activeDrawerType: state.type,
          atRiskMemberDetails: [],
          appAtRiskMembers: null,
          atRiskAppDetails: report.getAtRiskApplications(),
        };

      case DrawerType.CriticalAtRiskMembers:
        const criticalMembers = report
          .getCriticalApplications()
          .flatMap((app) => app.getMemberDetails());
        return {
          open: true,
          invokerId: state.invokerId,
          activeDrawerType: state.type,
          atRiskMemberDetails: criticalMembers,
          appAtRiskMembers: null,
          atRiskAppDetails: null,
        };

      case DrawerType.CriticalAtRiskApps:
        return {
          open: true,
          invokerId: state.invokerId,
          activeDrawerType: state.type,
          atRiskMemberDetails: [],
          appAtRiskMembers: null,
          atRiskAppDetails: report.getCriticalAtRiskApplications(),
        };

      default:
        return {
          open: false,
          invokerId: "",
          activeDrawerType: DrawerType.None,
          atRiskMemberDetails: [],
          appAtRiskMembers: null,
          atRiskAppDetails: null,
        };
    }
  }
}
```

#### Drawer Dialog Component (No Changes)

**File:** `risk-insights-drawer-dialog.component.ts`

```typescript
// ✅ NO CHANGES NEEDED!
export class RiskInsightsDrawerDialogComponent {
  constructor(
    @Inject(DIALOG_DATA) public drawerDetails: DrawerDetails, // Same interface
    // ... other deps
  ) {}

  // All existing methods work as-is
  downloadAtRiskMembers() {
    // Still accesses drawerDetails.atRiskMemberDetails
    // Works exactly the same!
  }
}
```

---

## 3. Integration Patterns

### Pattern 1: Opening a Drawer from UI

```typescript
// In any component with a button/link that opens a drawer
export class ReportCardsComponent {
  constructor(private drawerStateService: DrawerStateService) {}

  openAtRiskMembersDrawer() {
    this.drawerStateService.openDrawer(
      DrawerType.OrgAtRiskMembers,
      "summary-card", // Invoker ID
    );
  }

  openAppDrawer(appHostname: string) {
    this.drawerStateService.openDrawer(
      DrawerType.AppAtRiskMembers,
      appHostname, // Dynamic invoker ID
    );
  }
}
```

### Pattern 2: Closing a Drawer

```typescript
// In drawer component or parent
closeDrawer() {
  this.drawerStateService.closeDrawer();
}
```

### Pattern 3: Toggle Drawer (Open if Closed, Close if Same)

```typescript
// In application table row
toggleAppDrawer(appHostname: string) {
  this.drawerStateService.toggleDrawer(
    DrawerType.AppAtRiskMembers,
    appHostname
  );
}
```

### Pattern 4: Checking Drawer State

```typescript
// In component that needs to know drawer state
isDrawerOpen$ = toObservable(this.drawerStateService.drawerState).pipe(map((state) => state.open));

isShowingMembers$ = toObservable(this.drawerStateService.drawerState).pipe(
  map((state) => state.type === DrawerType.OrgAtRiskMembers),
);
```

---

## 4. Migration Checklist

**Phase 1: Setup (Batch 1)**

- [x] Create `DrawerStateService` abstract class
- [x] Create `DefaultDrawerStateService` implementation
- [x] Add to providers (but don't register yet)
- [ ] Create this integration guide

**Phase 2: Preparation (Before Migration)**

- [ ] Ensure `RiskInsightsView` has all required query methods:
  - [ ] `getAtRiskMembers()`
  - [ ] `getApplicationByHostname(hostname)`
  - [ ] `getAtRiskApplications()`
  - [ ] `getCriticalApplications()`
  - [ ] `getCriticalAtRiskApplications()`
- [ ] Ensure `RiskInsightsReportView` has `getMemberDetails()` method
- [ ] Register `ACCESS_INTELLIGENCE_PROVIDERS` in module (parallel to old services)

**Phase 3: Component Migration**

- [ ] Update `RiskInsightsComponent`:
  - [ ] Inject `DrawerStateService`
  - [ ] Replace `dataService.drawerDetails$` subscription with `combineLatest([drawerState, report$])`
  - [ ] Add `createDrawerDetails()` helper method
  - [ ] Update all drawer open methods to use `drawerStateService.openDrawer()`
- [ ] Update any other components that open drawers:
  - [ ] `ReportCardsComponent`
  - [ ] `ApplicationsTableComponent`
  - [ ] `ActivityTabComponent`
- [ ] Test all drawer types:
  - [ ] OrgAtRiskMembers drawer opens and shows correct data
  - [ ] AppAtRiskMembers drawer opens for specific app
  - [ ] OrgAtRiskApps drawer opens and shows correct data
  - [ ] CriticalAtRiskMembers drawer opens
  - [ ] CriticalAtRiskApps drawer opens
  - [ ] Toggle behavior works (close if already open)
  - [ ] CSV export works in drawer

**Phase 4: Cleanup**

- [ ] Remove drawer methods from `RiskInsightsDataService`:
  - [ ] `drawerDetailsSubject`
  - [ ] `drawerDetails$`
  - [ ] `setDrawerForOrgAtRiskMembers()`
  - [ ] `setDrawerForAppAtRiskMembers()`
  - [ ] `setDrawerForOrgAtRiskApps()`
  - [ ] `setDrawerForCriticalAtRiskMembers()`
  - [ ] `setDrawerForCriticalAtRiskApps()`
  - [ ] `closeDrawer()`
  - [ ] `isActiveDrawerType()`
  - [ ] `isDrawerOpenForInvoker()`
- [ ] Verify no references to old drawer methods remain

**Phase 5: Verification**

- [ ] All unit tests pass
- [ ] Manual testing: open/close all drawer types
- [ ] Manual testing: CSV exports work
- [ ] Manual testing: multiple drawers toggle correctly
- [ ] No console errors
- [ ] Performance: drawer opens without delay

---

## 5. Testing Strategy

### Unit Tests

**Test DrawerStateService in isolation:**

```typescript
describe("DefaultDrawerStateService", () => {
  let service: DefaultDrawerStateService;

  beforeEach(() => {
    service = new DefaultDrawerStateService();
  });

  it("should start with drawer closed", () => {
    const state = service.drawerState();
    expect(state.open).toBe(false);
    expect(state.type).toBe(DrawerType.None);
  });

  it("should open drawer with correct type", () => {
    service.openDrawer(DrawerType.OrgAtRiskMembers, "summary-card");
    const state = service.drawerState();
    expect(state.open).toBe(true);
    expect(state.type).toBe(DrawerType.OrgAtRiskMembers);
    expect(state.invokerId).toBe("summary-card");
  });

  it("should close drawer", () => {
    service.openDrawer(DrawerType.OrgAtRiskMembers, "summary-card");
    service.closeDrawer();
    const state = service.drawerState();
    expect(state.open).toBe(false);
  });

  it("should toggle drawer - close if already open with same type/invoker", () => {
    service.openDrawer(DrawerType.AppAtRiskMembers, "gmail.com");
    service.toggleDrawer(DrawerType.AppAtRiskMembers, "gmail.com");
    expect(service.drawerState().open).toBe(false);
  });

  it("should toggle drawer - open if different type", () => {
    service.openDrawer(DrawerType.AppAtRiskMembers, "gmail.com");
    service.toggleDrawer(DrawerType.OrgAtRiskMembers, "summary-card");
    const state = service.drawerState();
    expect(state.open).toBe(true);
    expect(state.type).toBe(DrawerType.OrgAtRiskMembers);
  });
});
```

### Integration Tests

**Test component integration:**

```typescript
describe("RiskInsightsComponent with DrawerStateService", () => {
  let component: RiskInsightsComponent;
  let drawerStateService: DrawerStateService;
  let dataService: AccessIntelligenceDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DrawerStateService, useClass: DefaultDrawerStateService },
        { provide: AccessIntelligenceDataService, useValue: mockDataService },
      ],
    });

    component = TestBed.inject(RiskInsightsComponent);
    drawerStateService = TestBed.inject(DrawerStateService);
    dataService = TestBed.inject(AccessIntelligenceDataService);
  });

  it("should open drawer and compute content", (done) => {
    // Mock report data
    dataService.report$ = of(mockReport);

    // Subscribe to drawer details
    component.ngOnInit();

    // Open drawer
    component.openAtRiskMembersDrawer();

    // Verify drawer dialog opens with correct data
    // (Implementation depends on dialog service mock)
    done();
  });
});
```

### Manual Testing Checklist

- [ ] Open "At-Risk Members" drawer from summary card
- [ ] Verify member list displays correctly
- [ ] Export members to CSV - verify file contents
- [ ] Open "App Members" drawer from application table row
- [ ] Verify app-specific members display
- [ ] Click same row again - drawer should close (toggle)
- [ ] Open different app row - drawer should switch to new app
- [ ] Open "At-Risk Apps" drawer
- [ ] Verify app list displays correctly
- [ ] Export apps to CSV - verify file contents
- [ ] Close drawer via X button
- [ ] Generate new report - verify drawer content updates if drawer is open

---

## 6. Rollback Plan

If issues arise during migration:

### Step 1: Disable New Service

```typescript
// In access-intelligence.module.ts
@NgModule({
  providers: [
    // Comment out new providers
    // ...ACCESS_INTELLIGENCE_PROVIDERS,

    // Keep old services
    RiskInsightsOrchestratorService,
    RiskInsightsDataService,
  ]
})
```

### Step 2: Revert Component Changes

```bash
git checkout HEAD -- bitwarden_license/bit-web/src/app/dirt/access-intelligence/risk-insights.component.ts
```

### Step 3: Verify Old Behavior

- [ ] All drawers open correctly
- [ ] CSV exports work
- [ ] No console errors

### Step 4: Document Issue

Create GitHub issue with:

- What broke
- Error messages
- Steps to reproduce
- Difference between expected vs actual behavior

---

## 7. Known Limitations

1. **Signal → Observable conversion:** Uses `toObservable()` which requires RxJS interop. Available in Angular 16+.

2. **DrawerDetails interface:** Current migration keeps old interface for compatibility. Future optimization: migrate drawer dialog to use state + report$ directly.

3. **View model methods required:** Migration depends on `RiskInsightsView` having all query methods implemented. These are created in future batches.

---

## 8. Future Improvements

**After initial migration:**

1. **Migrate drawer dialog to reactive pattern:**
   - Pass `DrawerState` + `report$` instead of pre-computed `DrawerDetails`
   - Use `async` pipe in template
   - Eliminate `createDrawerDetails()` helper

2. **Add drawer state persistence:**
   - Remember open drawer across page refreshes
   - Store in localStorage or session state

3. **Add drawer animations:**
   - Smooth open/close transitions
   - Content fade-in

4. **Performance optimization:**
   - Memoize `createDrawerDetails()` results
   - Use `distinctUntilChanged()` on content comparison

---

## References

- [DrawerStateService Abstract](../../../services/abstractions/drawer-state.service.ts) - Service definition
- [DefaultDrawerStateService](../../../services/implementations/default-drawer-state.service.ts) - Implementation
- [Playbook](../playbook.md) - Overall workflow
