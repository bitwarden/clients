# Component Migration Playbook — Access Intelligence

**Purpose:** Systematic migration of UI components to Angular 19+ standards (OnPush, Signals, Storybook, Tests)

**Related:** [Service Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md) - Use for service implementation

---

## 🚀 New to Component Migration?

**Start here first:** [Component Migration Quick Start](./component-migration-quickstart.md)

The Quick Start guide will walk you through your first component migration in ~1 hour with a detailed walkthrough of `empty-state-card`. It provides copy-paste Claude prompts and an encouraging tutorial-style introduction.

**Then return here** for comprehensive reference on all migration patterns, detailed troubleshooting, and advanced scenarios.

---

## 📋 Which Playbook Should I Use?

| Task                                     | Use This Playbook     | Use Service Playbook                                                                                            |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Migrating components to OnPush + Signals | ✅ Component Playbook | ❌                                                                                                              |
| Creating V2 components                   | ✅ Component Playbook | ❌                                                                                                              |
| Adding Storybook for components          | ✅ Component Playbook | ❌                                                                                                              |
| Adding component tests                   | ✅ Component Playbook | ❌                                                                                                              |
| **Implementing services**                | ❌                    | ✅ [Service Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md) |
| **Adding model methods**                 | ❌                    | ✅ [Service Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md) |

**See:** [Component CLAUDE.md](../CLAUDE.md) for guidance on which playbook Claude should use automatically.

---

## 🎯 Migration Strategy Decision Tree

**CRITICAL:** Not all components migrate the same way. Use this decision tree:

```
Does component depend on OLD services?
├─ NO (or minimal dependencies)
│  └─ Strategy: UPDATE IN PLACE
│     ├─ Migrate to OnPush
│     ├─ Migrate to Signals
│     ├─ Add Storybook
│     └─ Add Tests
│
└─ YES (uses RiskInsightsDataService, old facade)
   └─ Strategy: CREATE V2
      ├─ Create new V2 component
      ├─ Use new AccessIntelligenceDataService
      ├─ Follow V2 reference patterns
      ├─ Add Storybook
      ├─ Add Tests
      └─ Deprecate V1 when ready
```

**Reference:** See [Component Audit](./component-standardization-audit.md) for each component's recommended strategy.

---

## 📊 Session Types & When to Use Them

| When                                | Session Type              | Duration  | Output                                |
| ----------------------------------- | ------------------------- | --------- | ------------------------------------- |
| Component only needs OnPush/Signals | **Component Update**      | 1-3 hours | Updated component + tests + storybook |
| Component uses old services         | **Component V2 Creation** | 2-4 hours | New V2 component + tests + storybook  |
| Multiple related components         | **Batch Migration**       | 4-6 hours | Multiple components updated together  |
| Already compliant, needs docs       | **Documentation Only**    | 1 hour    | Storybook + tests only                |

---

## 🔢 Component Migration Order (Easy → Hard)

**Source:** [Component Audit](./component-standardization-audit.md)

### Tier 1: Easy Wins (1-2 hours each)

| #   | Component                | Strategy | Why Easy                                                | Estimate |
| --- | ------------------------ | -------- | ------------------------------------------------------- | -------- |
| 1   | `empty-state-card`       | UPDATE   | ✅ Already OnPush + Signals, just needs storybook/tests | 1h       |
| 2   | `report-loading`         | UPDATE   | Simple, 1 FIXME (OnPush), already uses signal inputs    | 1-2h     |
| 3   | `password-change-metric` | UPDATE   | Small presentational component                          | 1-2h     |
| 4   | `page-loading`           | UPDATE   | Very simple loading spinner                             | 0.5-1h   |

**Total Tier 1:** 3.5-6 hours

---

### Tier 2: Moderate (2-3 hours each)

| #   | Component                      | Strategy | Challenge                                      | Estimate |
| --- | ------------------------------ | -------- | ---------------------------------------------- | -------- |
| 5   | `activity-card`                | UPDATE   | 8 FIXME comments but straightforward migration | 2-3h     |
| 6   | `critical-applications`        | UPDATE   | OnPush ✅, needs signal migration + toSignal() | 2-3h     |
| 7   | `app-table-row-scrollable`     | UPDATE   | Table row complexity, test edge cases          | 2-3h     |
| 8   | `app-table-row-scrollable-m11` | UPDATE   | Similar to above, may consolidate              | 2-3h     |

**Total Tier 2:** 8-12 hours

---

### Tier 3: Complex (3-5 hours each)

| #   | Component                      | Strategy  | Challenge                                                 | Estimate |
| --- | ------------------------------ | --------- | --------------------------------------------------------- | -------- |
| 9   | `all-activity`                 | UPDATE    | Multiple subscriptions, state management, 3 child dialogs | 3-4h     |
| 10  | `all-applications` (container) | CREATE V2 | Uses old services, container complexity                   | 3-4h     |
| 11  | `applications` (table)         | UPDATE    | ✅ Already best V1 example, minimal work                  | 1-2h     |
| 12  | `assign-tasks-view`            | UPDATE    | Dialog with form state                                    | 2-3h     |
| 13  | `review-applications-view`     | UPDATE    | Dialog with complex interactions                          | 2-3h     |
| 14  | `new-applications-dialog`      | UPDATE    | Dialog with batch operations                              | 2-3h     |

**Total Tier 3:** 16-21 hours

---

### Tier 4: V2 Replacements (Don't Migrate)

| #   | Component                     | Strategy   | Action                          | Estimate |
| --- | ----------------------------- | ---------- | ------------------------------- | -------- |
| 15  | `risk-insights` (main)        | ⏭️ Replace | V2 already exists, deprecate V1 | N/A      |
| 16  | `risk-insights-drawer-dialog` | ⏭️ Replace | V2 drawer already exists        | N/A      |

**Total Tier 4:** 0 hours (already done)

---

### V2 Reference Components (Use as Examples)

| #   | Component                       | Status  | Use For                             |
| --- | ------------------------------- | ------- | ----------------------------------- |
| 17  | `risk-insights-v2`              | ✅ Done | Container pattern reference         |
| 18  | `access-intelligence-drawer-v2` | ✅ Done | Pure presentation pattern reference |

---

## **Grand Total Estimate:** 27.5-39 hours (~3.5-5 sprints)

---

## 🎨 Session Type 1: Component Update (UPDATE Strategy)

**When:** Component doesn't use old services, needs OnPush/Signals/Storybook/Tests

**Duration:** 1-3 hours

**Example Components:** `empty-state-card`, `activity-card`, `report-loading`, `critical-applications`

---

### Pre-Session Checklist

- [ ] Read [Component Audit](./component-standardization-audit.md) for this component
- [ ] Verify component does NOT use old services (RiskInsightsDataService)
- [ ] Check current OnPush/Signal status
- [ ] Review V2 reference components (`risk-insights-v2`, `access-intelligence-drawer-v2`)
- [ ] (Optional) Create session log: `~/Documents/bitwarden-notes/access-intelligence-sessions/component-updates/YYYY-MM-DD-<component>.md`

---

### Session Goals

1. [ ] Migrate to OnPush (if needed)
2. [ ] Migrate to Signal inputs/outputs (if needed)
3. [ ] Convert subscriptions to toSignal() (if needed)
4. [ ] Add Storybook with all variants
5. [ ] Add comprehensive test spec
6. [ ] (Optional) Update session log

---

### Step-by-Step Process

#### Step 1: Read Current Component (5 min)

**Prompt:**

```
Read the component file and analyze:
- Current change detection strategy (OnPush or Default?)
- Input/output declarations (@Input/@Output vs input()/output())
- Observable subscriptions (manual .subscribe() vs toSignal())
- State management patterns
- Dependencies injected
```

**Check for:**

- FIXME comments (CL-764, CL-903)
- Manual subscriptions in ngOnInit/constructor
- Plain properties vs signals
- Lint disable comments

---

#### Step 2: Migrate to OnPush (10-15 min)

**Only if component is NOT already OnPush.**

**Prompt:**

```
Migrate this component to use ChangeDetectionStrategy.OnPush:

1. Add changeDetection: ChangeDetectionStrategy.OnPush to @Component
2. Convert any plain properties to signals if they change over time
3. Ensure template uses signals correctly (call with ())
4. Test that change detection works with OnPush

Remove any lint disable comments for OnPush.
```

**What Changes:**

```typescript
// Before
@Component({
  selector: "dirt-my-component",
  // No changeDetection specified = Default
})
export class MyComponent {
  data: string = ""; // Plain property
}

// After
@Component({
  selector: "dirt-my-component",
  changeDetection: ChangeDetectionStrategy.OnPush, // ← Added
})
export class MyComponent {
  data = signal(""); // ← Signal
}
```

---

#### Step 3: Migrate to Signal Inputs/Outputs (15-20 min)

**Only if component uses @Input()/@Output().**

**Prompt:**

```
Migrate all @Input() and @Output() to signal-based equivalents:

1. Replace @Input() with input<T>() or input.required<T>()
2. Replace @Output() with output<T>()
3. Update template to call signals with ()
4. Remove FIXME comments (CL-903)
5. Remove lint disable comments for prefer-signals

Follow this pattern:
@Input() title: string = '' → title = input<string>('')
@Input() required!: boolean → required = input.required<boolean>()
@Output() save = new EventEmitter<void>() → save = output<void>()
```

**What Changes:**

```typescript
// Before
@Input() title: string = '';
@Input() count: number = 0;
@Output() clicked = new EventEmitter<void>();

// After
title = input<string>('');
count = input<number>(0);
clicked = output<void>();

// Template Before
<h1>{{ title }}</h1>

// Template After
<h1>{{ title() }}</h1>
```

---

#### Step 4: Convert Subscriptions to toSignal() (15-20 min)

**Only if component has manual .subscribe() calls.**

**Prompt:**

```
Convert manual Observable subscriptions to toSignal():

1. Find all .subscribe() calls in ngOnInit/constructor
2. Replace with toSignal() at class property level
3. Use computed() for derived values
4. Remove ngOnInit/ngOnDestroy if they only handled subscriptions
5. Clean up any takeUntilDestroyed() imports

Example:
this.service.data$.subscribe(d => this.data = d)
→ protected data = toSignal(this.service.data$)
```

**What Changes:**

```typescript
// Before
export class MyComponent implements OnInit {
  data: MyData | null = null;

  ngOnInit() {
    this.dataService.data$.subscribe((data) => {
      this.data = data;
    });
  }
}

// After
export class MyComponent {
  protected data = toSignal(this.dataService.data$);

  // No ngOnInit needed!
}
```

---

#### Step 5: Add Storybook (30-45 min)

**Prompt:**

```
Create a Storybook file for this component at <component-name>.stories.ts:

1. Create Meta with title "Access Intelligence/<ComponentName>"
2. Add "autodocs" tag
3. Create stories for all variants:
   - Default (base configuration)
   - [Variant 1] (e.g., "With Icon", "Loading State", etc.)
   - [Variant 2] (e.g., "With Button", "Error State", etc.)
   - [Edge cases] (e.g., "Empty", "Long Text", etc.)
4. Add argTypes with controls for interactive testing
5. Use actions() for output events

Reference the empty-state-card.component.stories.ts pattern if it exists.
```

**Storybook Template:**

```typescript
import type { Meta, StoryObj } from "@storybook/angular";
import { MyComponent } from "./my-component.component";

const meta: Meta<MyComponent> = {
  title: "Access Intelligence/My Component",
  component: MyComponent,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "danger"],
    },
  },
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    title: "Example Title",
    count: 0,
  },
};

export const WithIcon: Story = {
  args: {
    ...Default.args,
    icon: "bwi-star",
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
  },
};
```

---

#### Step 6: Add Test Spec (45-90 min)

**Prompt:**

```
Create a comprehensive test spec for this component at <component-name>.component.spec.ts:

1. Test component creation
2. Test all signal inputs (default values, changes, edge cases)
3. Test all signal outputs (event emissions)
4. Test computed properties (derived values)
5. Test user interactions (clicks, forms, etc.)
6. Test conditional rendering (@if blocks)
7. Test loops (@for blocks)
8. Test edge cases (empty state, loading, error)

Follow this structure:
- describe('ComponentName')
  - describe('Component Creation')
  - describe('Signal Inputs')
  - describe('Signal Outputs')
  - describe('Computed Properties')
  - describe('User Interactions')
  - describe('Edge Cases')

Use ComponentFixture and fixture.componentRef.setInput() for signal inputs.
```

**Test Template:**

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MyComponent } from "./my-component.component";

describe("MyComponent", () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // Standalone
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
  });

  describe("Component Creation", () => {
    it("should create", () => {
      expect(component).toBeTruthy();
    });
  });

  describe("Signal Inputs", () => {
    it("should accept title input", () => {
      fixture.componentRef.setInput("title", "Test Title");
      expect(component.title()).toBe("Test Title");
    });

    it("should display title in template", () => {
      fixture.componentRef.setInput("title", "Test Title");
      fixture.detectChanges();

      const titleElement = fixture.nativeElement.querySelector("h1");
      expect(titleElement.textContent).toContain("Test Title");
    });
  });

  describe("Signal Outputs", () => {
    it("should emit clicked event", () => {
      const emitSpy = jest.fn();
      component.clicked.subscribe(emitSpy);

      component.handleClick();

      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe("Computed Properties", () => {
    it("should compute derived values", () => {
      fixture.componentRef.setInput("count", 5);
      expect(component.doubleCount()).toBe(10);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty state", () => {
      fixture.componentRef.setInput("items", []);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("No items");
    });
  });
});
```

---

### Session Completion

- [ ] All migration steps complete
- [ ] Tests passing: `npm test -- <component>.spec.ts`
- [ ] Storybook renders: `npm run storybook`
- [ ] Type check passes: `npm run test:types`
- [ ] (Optional) Update session log
- [ ] Update [Component Audit](./component-standardization-audit.md) - mark as ✅

---

## 🚀 Session Type 2: Component V2 Creation (CREATE V2 Strategy)

**When:** Component uses old services and needs full rewrite

**Duration:** 2-4 hours

**Example Components:** `all-applications` (container), any component depending on old RiskInsightsDataService

---

### Pre-Session Checklist

- [ ] Read [Component Audit](./component-standardization-audit.md) for this component
- [ ] Verify new services are implemented (AccessIntelligenceDataService, DrawerStateService)
- [ ] Review V1 component to understand features
- [ ] Review V2 reference components for patterns
- [ ] (Optional) Create session log: `~/Documents/bitwarden-notes/access-intelligence-sessions/component-v2/YYYY-MM-DD-<component>-v2.md`

---

### Session Goals

1. [ ] Analyze V1 component features
2. [ ] Create V2 component from scratch
3. [ ] Use new services (AccessIntelligenceDataService)
4. [ ] Follow V2 patterns (OnPush, Signals, toSignal())
5. [ ] Add Storybook
6. [ ] Add test spec
7. [ ] (Optional) Update session log

---

### Step-by-Step Process

#### Step 1: Analyze V1 Component (10-15 min)

**Prompt:**

```
Read the V1 component and document:
1. What UI features does it provide?
2. What data does it display?
3. What user actions does it handle?
4. What services does it use? (identify old vs new)
5. What is the component structure? (container, presentational, mixed)

Create a feature list that V2 must implement.
```

**Example Output:**

```
V1 Features:
- Displays table of applications
- Filters by critical/non-critical
- Allows bulk selection
- Marks applications as critical
- Opens drawer on row click

Old Services Used:
- RiskInsightsDataService → Replace with AccessIntelligenceDataService
- RiskInsightsOrchestratorService → Remove (logic in models now)

New Services to Use:
- AccessIntelligenceDataService (report$)
- DrawerStateService (drawer open/close)
```

---

#### Step 2: Create V2 Component Skeleton (10-15 min)

**Prompt:**

```
Create a new V2 component at v2/<feature>/<component>-v2.component.ts:

1. Create standalone component with OnPush
2. Use inject() for dependencies
3. Inject AccessIntelligenceDataService
4. Use toSignal() to convert report$ to signal
5. Create signal properties for local state
6. Create computed properties for derived state
7. Add minimal template structure

Follow the risk-insights-v2.component.ts pattern.
```

**V2 Component Template:**

```typescript
import { Component, ChangeDetectionStrategy, computed, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { inject } from "@angular/core";
import { AccessIntelligenceDataService } from "../../services/access-intelligence-data.service";

@Component({
  selector: "dirt-my-component-v2",
  templateUrl: "./my-component-v2.component.html",
  styleUrls: ["./my-component-v2.component.scss"],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule /* other imports */],
})
export class MyComponentV2Component {
  private dataService = inject(AccessIntelligenceDataService);

  // Convert observables at boundary
  protected report = toSignal(this.dataService.report$);
  protected loading = toSignal(this.dataService.loading$);

  // Local state as signals
  protected selectedItems = signal(new Set<string>());
  protected filterText = signal("");

  // Computed derived state
  protected filteredItems = computed(() => {
    const report = this.report();
    const filter = this.filterText();
    if (!report) return [];
    return report.reports.filter((r) => r.applicationName.includes(filter));
  });

  protected selectedCount = computed(() => this.selectedItems().size);

  // Methods
  protected handleSelect(id: string) {
    this.selectedItems.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });
  }
}
```

---

#### Step 3: Implement V2 Component Logic (30-60 min)

**Prompt:**

```
Implement all V1 features in V2 component:

1. Data display (use report signal from AccessIntelligenceDataService)
2. User interactions (mark critical, filter, select, etc.)
3. Computed properties for derived data
4. Event handlers that call service methods or model methods
5. Integrate with DrawerStateService if component opens drawers

Use model methods for business logic:
- report.markApplicationAsCritical(appName)
- report.getCriticalApplications()
- report.getAtRiskMembers()

Then persist via dataService:
- this.dataService.saveReport(updatedReport)
```

**Key Pattern:**

```typescript
// ✅ V2 Pattern: Model handles business logic
protected markCritical(appName: string) {
  const report = this.report();
  if (!report) return;

  // Model method handles mutation
  report.markApplicationAsCritical(appName);

  // Service persists
  this.dataService.saveReport(report);
}

// ❌ Old V1 Pattern: Service has business logic
protected markCritical(appName: string) {
  this.oldService.markApplicationAsCritical(appName); // Logic in service
}
```

---

#### Step 4: Create V2 Template (20-30 min)

**Prompt:**

```
Create the template for V2 component:

1. Use @if/@for control flow (not *ngIf/*ngFor)
2. Call signals with () in template
3. Bind to computed properties
4. Wire up event handlers
5. Use Bitwarden component library (bitButton, bitTable, etc.)

Example:
@if (loading()) {
  <bit-loading-spinner />
} @else if (report(); as report) {
  @for (item of filteredItems(); track item.id) {
    <div>{{ item.applicationName }}</div>
  }
}
```

---

#### Step 5: Add Storybook (30-45 min)

Same as Session Type 1, Step 5.

---

#### Step 6: Add Test Spec (45-90 min)

**Additional V2-specific tests:**

- Test service integration (mock AccessIntelligenceDataService)
- Test toSignal() conversions
- Test computed property updates
- Test model method calls

```typescript
it("should call model method when marking critical", () => {
  const mockReport = new RiskInsightsView();
  mockReport.markApplicationAsCritical = jest.fn();

  component.report = signal(mockReport);
  component.markCritical("app-name");

  expect(mockReport.markApplicationAsCritical).toHaveBeenCalledWith("app-name");
});
```

---

#### Step 7: Update Routing (10 min)

**Prompt:**

```
Update access-intelligence-routing.module.ts to use V2 component:

1. Add route for V2 component
2. Feature flag if needed (switch between V1 and V2)
3. Update navigation links
```

---

### Session Completion

- [ ] V2 component fully implements V1 features
- [ ] New services integrated correctly
- [ ] Tests passing
- [ ] Storybook working
- [ ] Routing updated
- [ ] (Optional) Update session log
- [ ] Update [Component Audit](./component-standardization-audit.md)
- [ ] Plan V1 deprecation timeline

---

## 📦 Session Type 3: Batch Migration

**When:** Multiple related components need migration together

**Duration:** 4-6 hours

**Example:** All 3 dialog components in `application-review-dialog/`

---

### Approach

1. **Group related components** (dialogs, table rows, cards)
2. **Follow UPDATE strategy** for all components in batch
3. **Share patterns** (same Storybook structure, same test patterns)
4. **Reuse code** (shared test helpers, shared story configurations)

**Prompt for batch migration:**

```
Migrate all 3 dialog components together:
1. assign-tasks-view.component.ts
2. review-applications-view.component.ts
3. new-applications-dialog.component.ts

For each component:
- Migrate to OnPush + Signals
- Add Storybook
- Add tests

Use consistent patterns across all 3 components.
```

---

## 🔀 Component → Service Handoff

**When your component needs data or functionality not yet available**, follow this handoff process:

### Handoff Checklist

- [ ] **Identify what's missing**
  - New query method on view model?
  - New mutation method on view model?
  - New service needed?
  - New data loading needed?

- [ ] **Document the requirement**
  - What data the component needs
  - What format it should be in
  - What user action triggers this
  - Performance requirements (if any)

- [ ] **File Jira ticket** (if significant work)
  - Link to component that needs it
  - Include wireframe/mock if available

### What to Communicate

**Tell service developers:**

1. **What you need:** "Component needs list of at-risk members for a specific application"
2. **Proposed API:** `report.getMembersForApplication(applicationName): MemberRegistryEntry[]`
3. **Why:** "User clicks application row, drawer shows members with access"
4. **Format:** "Array of { id, email, name, hasAccess: boolean }"
5. **Performance:** "Could be 1000+ members for large orgs"

### Example: Blocked Component Work

**Component:** At-Risk Applications Filter
**Status:** BLOCKED - waiting for service

**Missing:**

- `RiskInsightsView.getCriticalApplications(): RiskInsightsReportView[]`

**Ticket:** [Link to Jira]
**Notified:** Service team on [date]

**Unblocked when:** Method is implemented and tested

### See Also

- **[Integration Guide](/bitwarden_license/bit-common/src/dirt/docs/integration-guide.md)** - Full service ↔ component integration patterns
- **[Service Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md)** - For service developers

---

## 📂 File Structure Reference

### UPDATE Strategy File Structure

```
bit-web/src/app/dirt/access-intelligence/
└── <feature>/
    ├── <component>.component.ts         ← Updated in place
    ├── <component>.component.html
    ├── <component>.component.scss
    ├── <component>.component.spec.ts    ← NEW (tests)
    └── <component>.stories.ts           ← NEW (storybook)
```

### CREATE V2 Strategy File Structure

```
bit-web/src/app/dirt/access-intelligence/
├── <feature>/
│   └── <component>.component.ts         ← V1 (keep for now)
│
└── v2/
    └── <feature>/
        ├── <component>-v2.component.ts      ← NEW V2
        ├── <component>-v2.component.html
        ├── <component>-v2.component.scss
        ├── <component>-v2.component.spec.ts ← NEW (tests)
        └── <component>-v2.stories.ts        ← NEW (storybook)
```

---

## 📋 Component Session Checklist (Copy for Each Session)

Use this checklist for tracking:

### Component: [ComponentName]

**Date:** YYYY-MM-DD
**Strategy:** [UPDATE | CREATE V2]
**Tier:** [1 | 2 | 3]
**Estimated:** X hours
**Actual:** X hours

#### Pre-Session ✓

- [ ] Read component audit
- [ ] Verified strategy (UPDATE or CREATE V2)
- [ ] Reviewed V2 reference components
- [ ] (Optional) Created session log

#### Migration Steps ✓

- [ ] OnPush migration (if needed)
- [ ] Signal inputs/outputs migration (if needed)
- [ ] toSignal() conversion (if needed)
- [ ] [V2 only] Created V2 component
- [ ] [V2 only] Integrated new services

#### Documentation & Testing ✓

- [ ] Added Storybook with [N] stories
- [ ] Added test spec with [N] tests
- [ ] All tests passing
- [ ] Type check passing
- [ ] Storybook renders correctly

#### Completion ✓

- [ ] Updated component audit
- [ ] (Optional) Updated session log
- [ ] Ready for PR

**Status:** ✅ COMPLETE | ⚠️ PARTIAL | ❌ BLOCKED

---

## 🔄 Component Migration Order (Full List)

Based on [Component Audit](./component-standardization-audit.md):

### Phase 1: Quick Wins (4 components, 3.5-6 hours)

1. **empty-state-card** (1h) - UPDATE
   - Already OnPush ✅ + Signals ✅
   - Just add storybook + tests

2. **report-loading** (1-2h) - UPDATE
   - 1 FIXME (OnPush)
   - Already uses signal inputs

3. **password-change-metric** (1-2h) - UPDATE
   - Small presentational component
   - Unknown status, likely simple

4. **page-loading** (0.5-1h) - UPDATE
   - Very simple loading spinner
   - Minimal work

### Phase 2: Standard Migrations (4 components, 8-12 hours)

5. **activity-card** (2-3h) - UPDATE
   - 8 FIXME comments
   - Reusable component (HIGH PRIORITY)

6. **critical-applications** (2-3h) - UPDATE
   - OnPush ✅ already
   - Needs signal migration

7. **app-table-row-scrollable** (2-3h) - UPDATE
   - Table row complexity
   - Test edge cases

8. **app-table-row-scrollable-m11** (2-3h) - UPDATE
   - May consolidate with above

### Phase 3: Complex Components (6 components, 16-21 hours)

9. **all-activity** (3-4h) - UPDATE
   - Multiple subscriptions
   - State management
   - 3 child dialogs

10. **all-applications (container)** (3-4h) - CREATE V2
    - Uses old services
    - Container complexity

11. **applications (table)** (1-2h) - UPDATE
    - Already best V1 example ✅
    - Minimal work

12. **assign-tasks-view** (2-3h) - UPDATE
    - Dialog with form state

13. **review-applications-view** (2-3h) - UPDATE
    - Dialog with complex interactions

14. **new-applications-dialog** (2-3h) - UPDATE
    - Dialog with batch operations

### Phase 4: V2 References (2 components, already done)

15. **risk-insights-v2** ✅ - Reference implementation
16. **access-intelligence-drawer-v2** ✅ - Reference implementation

### Phase 5: V1 Deprecation (2 components, future)

17. **risk-insights (V1)** ⏭️ - Deprecate when V2 stable
18. **risk-insights-drawer-dialog (V1)** ⏭️ - Deprecate when V2 stable

---

## 📊 Progress Tracking

Track progress using the [Component Audit](./component-standardization-audit.md).

### Metrics

- **Components Completed:** X / 17
- **Storybook Coverage:** X% (X/17)
- **Test Coverage:** X% (X/17)
- **OnPush Compliance:** X% (X/17)
- **Signal Compliance:** X% (X/17)

### Update Audit After Each Component

```markdown
## [ComponentName]

**Status:** ✅ Complete (was: 🔴 Needs Migration)

| Standard       | Status | Notes                  |
| -------------- | ------ | ---------------------- |
| **OnPush**     | ✅ Yes | Migrated on YYYY-MM-DD |
| **Signals**    | ✅ Yes | Migrated on YYYY-MM-DD |
| **toSignal()** | ✅ Yes | Migrated on YYYY-MM-DD |
| **Storybook**  | ✅ Yes | Added X stories        |
| **Test Spec**  | ✅ Yes | Added X tests          |

**Completed:** YYYY-MM-DD
**Duration:** X hours
**PR:** #XXXX
```

---

## 🎯 Success Criteria

### Component is "Done" When:

- ✅ Uses `ChangeDetectionStrategy.OnPush`
- ✅ Uses `input()`/`output()` for inputs/outputs (no `@Input/@Output`)
- ✅ Uses `toSignal()` for observables (no manual `.subscribe()`)
- ✅ Has Storybook file with ≥3 stories (default + variants)
- ✅ Has test spec with ≥80% coverage
- ✅ All tests passing (`npm test`)
- ✅ Type check passing (`npm run test:types`)
- ✅ Storybook renders (`npm run storybook`)
- ✅ Component audit updated
- ✅ No FIXME comments (CL-764, CL-903)
- ✅ No lint disable comments for OnPush/Signals

### Feature is "Done" When:

- ✅ All components in feature completed
- ✅ Integration tests added
- ✅ End-to-end user flows tested
- ✅ Documentation updated
- ✅ PR merged
- ✅ [If V2] V1 deprecated or scheduled for deprecation

---

## 🔗 References

### Component Documentation

- [Component Quick Start](./component-migration-quickstart.md) - **Start here!** 1-hour tutorial for your first component
- [Component Audit](./component-standardization-audit.md) - Component inventory and status
- [Component Session Template](./component-session-template.md) - Optional session log template

### Team Documentation

- [Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/standards.md) - Team coding standards
- [Component Testing Standards](/bitwarden_license/bit-common/src/dirt/docs/standards/testing-standards-components.md) - Testing guidelines
- [Service Playbook](/bitwarden_license/bit-common/src/dirt/docs/playbooks/service-implementation-playbook.md) - For service work
- [Integration Guide](/bitwarden_license/bit-common/src/dirt/docs/integration-guide.md) - Service ↔ Component integration
- [Bitwarden Angular Guide](https://contributing.bitwarden.com/contributing/code-style/web/angular/)
- [Angular Signals](https://angular.io/guide/signals)
- [Storybook for Angular](https://storybook.js.org/docs/angular)

---

## 🆘 Troubleshooting

### "Component won't update with OnPush"

**Problem:** Component has OnPush but UI doesn't update
**Solution:**

- Check that state is in signals (not plain properties)
- Ensure template calls signals with `()`
- Verify inputs are changed by reference (signals auto-handle this)

### "Tests failing after signal migration"

**Problem:** Tests fail with "Cannot read property of undefined"
**Solution:**

- Use `fixture.componentRef.setInput('name', value)` for signal inputs
- Call `fixture.detectChanges()` after setInput
- Initialize signals with defaults: `input<T>(defaultValue)`

### "Storybook not rendering component"

**Problem:** Component shows blank in Storybook
**Solution:**

- Check that all dependencies are in `imports: []`
- Verify signal inputs have default values
- Check browser console for errors

### "Type errors after migration"

**Problem:** TypeScript errors about signal types
**Solution:**

- Run `npm run test:types` to see full errors
- Ensure signal types match: `input<string>()` not `input()`
- Use `computed<T>()` with explicit type if inference fails

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** DIRT Team (Access Intelligence)
