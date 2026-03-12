# Access Intelligence - Component Testing Standards

**Purpose:** Testing guidelines for Angular components in the Access Intelligence module

**Related:** [testing-standards-services.md](./testing-standards-services.md) for service/model testing

---

## Table of Contents

1. [Component Test Coverage Goals](#component-test-coverage-goals)
2. [Angular Testing Utilities](#angular-testing-utilities)
3. [Mock Services vs overrideComponent](#mock-services-vs-overridecomponent)
4. [Testing OnPush Components](#testing-onpush-components)
5. [Testing Signal Inputs/Outputs](#testing-signal-inputsoutputs)
6. [Testing with toSignal()](#testing-with-tosignal)
7. [Storybook as Living Documentation](#storybook-as-living-documentation)
8. [Component Test Structure](#component-test-structure)
9. [Common Patterns](#common-patterns)
10. [Running Component Tests](#running-component-tests)

---

## Component Test Coverage Goals

**Follow Angular testing best practices** with comprehensive coverage for all component interactions.

### Coverage Targets

- **Component Creation:** Verify component initializes without errors
- **Signal Inputs:** Test all input variations and edge cases
- **Signal Outputs:** Test all event emissions
- **User Interactions:** Test clicks, form inputs, keyboard events
- **Computed Properties:** Test all derived state
- **Conditional Rendering:** Test @if/@for blocks
- **Edge Cases:** Empty states, loading states, error states

### Example Coverage

**V2 Reference Components:**

- `access-intelligence-page.component.spec.ts` — Container with state management, overrideComponent pattern
- `all-activity-v2.component.spec.ts` — Service integration, BehaviorSubject mocks, computed signals
- `new-applications-dialog-v2.component.spec.ts` — DIALOG_DATA injection, async, static open spy
- `applications-table-v2.component.spec.ts` — Signal inputs, DOM interaction

---

## Angular Testing Utilities

### Required Imports

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { By } from "@angular/platform-browser";
```

### TestBed Setup for OnPush Components

```typescript
describe("MyComponent", () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // Standalone component
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
```

---

## Mock Services vs overrideComponent

This is the most common source of confusion when writing component tests. The two tools solve
**different problems** and are often used together.

### The Core Distinction

| Problem                                                                         | Solution                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Component calls `inject(MyService)`                                             | Mock the service via `providers: [{ provide: MyService, useValue: mockMyService }]` |
| Component `imports: [HeaderModule]` and Angular can't resolve HeaderModule's DI | Use `overrideComponent` to strip the heavy import                                   |

**Rule:** Always mock services the component **injects**. Use `overrideComponent` to handle
heavy **template imports** that bring in their own DI chains you don't want to satisfy.

---

### When to Mock Services

**ALWAYS** provide mocks for services the component injects via `inject()`:

```typescript
// Component
export class MyComponent {
  private dataService = inject(AccessIntelligenceDataService); // ← must mock
  private toastService = inject(ToastService); // ← must mock
}

// Test
await TestBed.configureTestingModule({
  imports: [MyComponent],
  providers: [
    { provide: AccessIntelligenceDataService, useValue: mockDataService },
    { provide: ToastService, useValue: mockToastService },
  ],
  schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
```

**Use `BehaviorSubject` mocks for observable-based services** so you can call `.next()` in
individual tests to change state:

```typescript
type MockDataService = {
  report$: BehaviorSubject<RiskInsightsView | null>;
  loading$: BehaviorSubject<boolean>;
  markApplicationAsCritical$: jest.Mock;
};

const mockDataService: MockDataService = {
  report$: new BehaviorSubject<RiskInsightsView | null>(null),
  loading$: new BehaviorSubject<boolean>(false),
  markApplicationAsCritical$: jest.fn().mockReturnValue(of(undefined)),
};
```

---

### When to use `overrideComponent`

Use `overrideComponent` when the component imports modules that bring in complex DI chains
you don't need for your tests. The most common case is `HeaderModule`:

```typescript
// applications-v2.component.ts
@Component({
  imports: [
    HeaderModule, // ← Has its own DI requirements
    SharedModule, // ← Brings in pipes, directives with DI
    ApplicationsTableV2Component,
    // ...
  ],
})
export class ApplicationsV2Component {
  private dataService = inject(AccessIntelligenceDataService); // ← still mock this
}
```

```typescript
// applications-v2.component.spec.ts
await TestBed.configureTestingModule({
  imports: [ApplicationsV2Component],
  providers: [
    // ✅ Still mock all injected services
    { provide: AccessIntelligenceDataService, useValue: mockDataService },
    { provide: ToastService, useValue: mockToastService },
    // ...
  ],
  schemas: [NO_ERRORS_SCHEMA],
})
  // ✅ Also strip template to avoid HeaderModule DI hell
  .overrideComponent(ApplicationsV2Component, {
    set: { template: "", imports: [] },
  })
  .compileComponents();
```

**Important:** `overrideComponent` strips the template AND imports. This means:

- Child components are not rendered
- Template-based behavior can't be tested
- Use it when you're testing **component logic** (signals, computed, async methods)

---

### Components with No Service Injection

If a component has **no `inject()` calls**, you may only need `overrideComponent` to handle
template dependencies (pipes, directives backed by services):

```typescript
// review-applications-view-v2.component.ts — NO inject() calls
@Component({
  imports: [I18nPipe, SharedModule], // ← template dependencies only
})
export class ReviewApplicationsViewV2Component {
  readonly applications = input.required<RiskInsightsReportView[]>();
  // ... signals and computed only
}
```

```typescript
// review-applications-view-v2.component.spec.ts
await TestBed.configureTestingModule({
  imports: [ReviewApplicationsViewV2Component],
  schemas: [NO_ERRORS_SCHEMA],
  // No providers needed — component has no inject() calls
})
  .overrideComponent(ReviewApplicationsViewV2Component, {
    set: { template: "", imports: [] },
  })
  .compileComponents();
```

---

### Decision Guide

```
Does the component call inject(MyService)?
  YES → Mock that service in providers array
  NO  → No service mock needed for it

Does the component import [HeaderModule] or heavy modules with DI?
  YES → Add .overrideComponent(..., { set: { template: "", imports: [] } })
  NO  → Can test with template intact (or use NO_ERRORS_SCHEMA for child components)

Do you need to test DOM / template rendering?
  YES → Provide full module deps OR use Pattern B (MockHeaderComponent declaration)
  NO  → overrideComponent is fine; all logic tests can run without the template
```

---

### Pattern B: MockHeaderComponent (when template testing is needed)

When you need to test template output but the component includes `<app-header>`:

```typescript
// Declare a minimal stub matching the selector
@Component({ selector: "app-header", template: "<div></div>", standalone: false })
class MockHeaderComponent {}

await TestBed.configureTestingModule({
  declarations: [MockHeaderComponent], // ← declare the stub
  imports: [MyComponent],
  providers: [
    /* service mocks */
  ],
}).compileComponents();
```

Use this when:

- Testing `@if` blocks that depend on header state
- Testing that specific template elements render correctly
- Integration-style tests that need the full component tree

**Prefer `overrideComponent`** for pure logic tests (most of our unit tests). Use
`MockHeaderComponent` only when template rendering is the focus.

---

### Summary Table

| Component Type                                  | Has inject()? | Has HeaderModule? | Pattern                             |
| ----------------------------------------------- | ------------- | ----------------- | ----------------------------------- |
| Pure presenter (no services)                    | No            | No                | `NO_ERRORS_SCHEMA` only             |
| Pure presenter (no services, has heavy imports) | No            | Yes               | `overrideComponent`                 |
| Feature component                               | Yes           | No                | Service mocks + `NO_ERRORS_SCHEMA`  |
| Feature component with header                   | Yes           | Yes               | Service mocks + `overrideComponent` |
| Container/page component                        | Yes           | Yes               | Service mocks + `overrideComponent` |

**Reference implementations:**

- Pure logic, no services: [review-applications-view-v2.component.spec.ts](../../../bit-web/src/app/dirt/access-intelligence/v2/shared/review-applications-view-v2/review-applications-view-v2.component.spec.ts)
- Service mocks only: [all-activity-v2.component.spec.ts](../../../bit-web/src/app/dirt/access-intelligence/v2/all-activity-v2/all-activity-v2.component.spec.ts)
- Service mocks + overrideComponent: [access-intelligence-page.component.spec.ts](../../../bit-web/src/app/dirt/access-intelligence/v2/access-intelligence-page/access-intelligence-page.component.spec.ts)

---

## Testing OnPush Components

**CRITICAL:** OnPush components only update when:

- Signal changes (automatic)
- Input references change
- Events fire
- `async` pipe emits

### Pattern: Testing with OnPush

```typescript
it("should update when input changes", () => {
  // Set initial input
  fixture.componentRef.setInput("count", 5);
  fixture.detectChanges();

  expect(screen.getByText("Count: 5")).toBeInTheDocument();

  // Change input
  fixture.componentRef.setInput("count", 10);
  fixture.detectChanges();

  expect(screen.getByText("Count: 10")).toBeInTheDocument();
});
```

**Key:** Always call `fixture.detectChanges()` after setting inputs or triggering events.

---

## Testing Signal Inputs/Outputs

### Signal Inputs (`input<T>()` or `input.required<T>()`)

**Angular 19+ Pattern:**

```typescript
// Component
export class MyComponent {
  count = input<number>(0);
  name = input.required<string>();
}

// Test
it("should handle signal inputs", () => {
  fixture.componentRef.setInput("count", 5);
  fixture.componentRef.setInput("name", "Test");
  fixture.detectChanges();

  expect(component.count()).toBe(5);
  expect(component.name()).toBe("Test");
});
```

### Signal Outputs (`output<T>()`)

**Angular 19+ Pattern:**

```typescript
// Component
export class MyComponent {
  clicked = output<string>();

  handleClick() {
    this.clicked.emit("button-clicked");
  }
}

// Test
it("should emit output when clicked", () => {
  const emitSpy = jest.fn();
  component.clicked.subscribe(emitSpy);

  component.handleClick();

  expect(emitSpy).toHaveBeenCalledWith("button-clicked");
});
```

---

## Testing with toSignal()

**Pattern:** Components convert Observables to Signals at the boundary

```typescript
// Component
export class MyComponent {
  private dataService = inject(AccessIntelligenceDataService);
  report = toSignal(this.dataService.report$);
}

// Test - Mock the service
it("should display report data", () => {
  const mockReport = new RiskInsightsView();
  mockReport.getTotalMemberCount = jest.fn(() => 42);

  const mockDataService = {
    report$: of(mockReport),
  };

  TestBed.overrideProvider(AccessIntelligenceDataService, {
    useValue: mockDataService,
  });

  fixture = TestBed.createComponent(MyComponent);
  component = fixture.componentInstance;
  fixture.detectChanges();

  expect(screen.getByText("42 members")).toBeInTheDocument();
});
```

**Key Pattern:** Mock the service Observable, not the Signal.

---

## Storybook as Living Documentation

### When Storybook is Required

| Component Type                              | Stories Required? | Rationale                                    |
| ------------------------------------------- | ----------------- | -------------------------------------------- |
| Presentational / reusable component         | ✅ Required       | Visual catalog and documentation             |
| Feature component with meaningful UI states | ✅ Required       | Documents loading, empty, populated variants |
| Pure routing container (no UI of its own)   | ❌ Skip           | No visual states to document                 |
| Simple wrapper that only adds a layout slot | ❌ Skip           | No independent visual identity               |

**Examples:**

- ✅ `activity-card`, `all-activity-v2`, `applications-v2`, `review-applications-view-v2` — have
  meaningful UI states (loading, empty, with data, with selections) → stories required
- ❌ `access-intelligence-page` — routes to tab children, no content of its own → skip
- ❌ Simple containers that only pass inputs to one child → skip

**Practical test:** If you can meaningfully show "Default", "Loading", and "With Data" states in
isolation, that component needs Storybook. If the only story would be a blank frame with child
components filling it, skip it.

---

### ⚠️ CRITICAL: Deterministic Data for Chromatic

**All Storybook data MUST be deterministic (no random data).**

We use **Chromatic** for visual regression testing, which takes snapshots of Storybook stories. Random data causes snapshot differences and breaks visual testing.

#### ❌ DON'T - Random Data

```typescript
// ❌ BAD - Random data breaks Chromatic snapshots
export const Example: Story = {
  render: () => ({
    props: {
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        value: Math.random() * 100, // ❌ Different every time!
      })),
    },
  }),
};
```

#### ✅ DO - Deterministic Data

```typescript
// ✅ GOOD - Same data every time
export const Example: Story = {
  render: () => ({
    props: {
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        value: (i + 1) * 10, // ✅ Deterministic pattern
      })),
    },
  }),
};
```

#### Deterministic Patterns

**Use these patterns instead of random data:**

1. **Index-based values:** `value: i * 10` or `value: i + 1`
2. **Modulo patterns:** `isAtRisk: i % 2 === 0` (alternating)
3. **Fixed seed values:** Define specific test data upfront
4. **Predictable cycles:** `value: [10, 20, 30][i % 3]`

#### Example: Large Dataset

```typescript
// Generate 50 deterministic items
const items = Array.from({ length: 50 }, (_, i) => ({
  id: `item-${i}`,
  name: `Item ${i + 1}`,
  score: (i + 1) * 10, // 10, 20, 30, ...
  isActive: i % 3 === 0, // Every 3rd item
  priority: ["low", "medium", "high"][i % 3], // Cycle through priorities
}));
```

### Storybook File Structure

```typescript
// my-component.stories.ts
import type { Meta, StoryObj } from "@storybook/angular";
import { MyComponent } from "./my-component.component";

const meta: Meta<MyComponent> = {
  title: "Access Intelligence/MyComponent",
  component: MyComponent,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    title: "Default Title",
    count: 0,
  },
};

export const WithData: Story = {
  args: {
    title: "With Data",
    count: 42,
  },
};

export const Loading: Story = {
  args: {
    title: "Loading",
    isLoading: true,
  },
};
```

### Storybook Coverage Goals

- **Default state** - Base configuration
- **With data** - Populated with realistic data
- **Loading state** - Show loading indicators
- **Error state** - Show error messages
- **Empty state** - No data available
- **Edge cases** - Long text, large numbers, etc.

---

## Component Test Structure

**File Location:** Tests MUST be in same folder as component.

Pattern: `[component-folder]/[component-name].component.spec.ts`

See: [Component Folder Structure](./code-organization-standards.md#component-folder-structure)

### Recommended Test Organization

```typescript
describe("MyComponent", () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
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
    it("should accept count input", () => {
      fixture.componentRef.setInput("count", 10);
      expect(component.count()).toBe(10);
    });

    it("should handle count changes", () => {
      fixture.componentRef.setInput("count", 5);
      fixture.detectChanges();
      expect(screen.getByText("5")).toBeInTheDocument();

      fixture.componentRef.setInput("count", 10);
      fixture.detectChanges();
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });

  describe("Signal Outputs", () => {
    it("should emit clicked event", () => {
      const emitSpy = jest.fn();
      component.clicked.subscribe(emitSpy);

      const button = fixture.debugElement.query(By.css("button"));
      button.nativeElement.click();

      expect(emitSpy).toHaveBeenCalledWith("clicked");
    });
  });

  describe("User Interactions", () => {
    it("should handle button click", () => {
      fixture.componentRef.setInput("count", 0);
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css("button"));
      button.nativeElement.click();
      fixture.detectChanges();

      expect(component.count()).toBe(1);
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

      expect(screen.getByText("No items")).toBeInTheDocument();
    });

    it("should handle loading state", () => {
      fixture.componentRef.setInput("isLoading", true);
      fixture.detectChanges();

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });
});
```

---

## Common Patterns

### Testing Conditional Rendering (@if)

```typescript
// Component template
@if (showDetails()) {
  <div>Details</div>
}

// Test
it("should show details when flag is true", () => {
  component.showDetails = signal(true);
  fixture.detectChanges();

  expect(screen.getByText("Details")).toBeInTheDocument();
});

it("should hide details when flag is false", () => {
  component.showDetails = signal(false);
  fixture.detectChanges();

  expect(screen.queryByText("Details")).not.toBeInTheDocument();
});
```

### Testing Loops (@for)

```typescript
// Component template
@for (item of items(); track item.id) {
  <div>{{ item.name }}</div>
}

// Test
it("should render all items", () => {
  const items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  component.items = signal(items);
  fixture.detectChanges();

  expect(screen.getByText("Item 1")).toBeInTheDocument();
  expect(screen.getByText("Item 2")).toBeInTheDocument();
});
```

### Testing Service Integration

```typescript
it("should call service method on action", () => {
  const mockService = {
    save: jest.fn().mockReturnValue(of(void 0)),
  };

  TestBed.overrideProvider(MyService, { useValue: mockService });

  fixture = TestBed.createComponent(MyComponent);
  component = fixture.componentInstance;
  fixture.detectChanges();

  const button = fixture.debugElement.query(By.css(".save-button"));
  button.nativeElement.click();

  expect(mockService.save).toHaveBeenCalled();
});
```

### Testing Async Operations

```typescript
it("should handle async data loading", fakeAsync(() => {
  const mockData = new RiskInsightsView();
  const mockService = {
    report$: of(mockData).pipe(delay(100)),
  };

  TestBed.overrideProvider(AccessIntelligenceDataService, {
    useValue: mockService,
  });

  fixture = TestBed.createComponent(MyComponent);
  component = fixture.componentInstance;
  fixture.detectChanges();

  // Initially loading
  expect(component.report()).toBeUndefined();

  // Advance time
  tick(100);
  fixture.detectChanges();

  // Now loaded
  expect(component.report()).toBe(mockData);
}));
```

### Testing Protected/Private Members

**Pattern:** Use type assertions to access protected or private members in tests.

Components use `protected` or `private` for encapsulation, but tests need access to verify internal state. Type assertions are the recommended approach per Angular testing best practices.

```typescript
describe("MyComponent", () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  /**
   * Helper to access protected/private members for testing.
   * Angular components use protected/private for encapsulation, but tests need access to verify internal state.
   * Using type assertion is the recommended approach per Angular testing best practices.
   */
  const testAccess = (comp: MyComponent) => comp as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
  });

  it("should access protected signal", () => {
    // Component has: protected organizationId = signal<string>("org-123");
    expect(testAccess(component).organizationId()).toBe("org-123");
  });

  it("should access protected computed signal", () => {
    // Component has: protected hasData = computed(() => this.items().length > 0);
    testAccess(component).items.set([1, 2, 3]);
    expect(testAccess(component).hasData()).toBe(true);
  });

  it("should call private method", () => {
    // Component has: private calculateTotal(): number
    const result = testAccess(component).calculateTotal();
    expect(result).toBe(42);
  });
});
```

**Why this pattern?**

- ✅ **Minimal boilerplate** - Single helper function
- ✅ **Type-safe for tests** - TypeScript allows `any` assertions in tests
- ✅ **Follows Angular best practices** - Recommended in [Angular testing guide](https://angular.dev/guide/testing)
- ✅ **Clear intent** - `testAccess()` clearly signals "test-only access"

**Alternative: Intersection Types (NOT recommended)**

Avoid using intersection types to expose protected members. This pattern fails when redefining existing private/protected methods:

```typescript
// ❌ DON'T - Intersection types fail for existing members
type TestType = MyComponent & {
  organizationId: Signal<string>; // Error: reduces to 'never'
  calculateTotal(): number; // Error: property is private in some constituents
};
```

**When to use:**

- Testing protected signals, computed signals, or properties
- Testing private helper methods
- Verifying internal state changes

**Reference implementation:**

- See `access-intelligence-page.component.spec.ts` for real-world example

---

## Running Component Tests

### Run All Tests

```bash
npm test
```

### Run Specific Component Test

```bash
npm test -- my-component.component.spec.ts
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Storybook

```bash
npm run storybook
```

### Type Check After Tests

```bash
npm run test:types
```

**ALWAYS run type check after tests** to catch TypeScript errors that Jest might miss.

---

## ESLint Compliance for Tests and Stories

**All test and story files must pass ESLint checks.**

### Common ESLint Violations to Avoid

#### 1. Console Statements (`no-console`)

**❌ DON'T:**

```typescript
// In story files
const mockService = {
  save: () => {
    console.log("Saved!"); // ❌ Violates no-console
  },
};
```

**✅ DO:**

```typescript
// Use Storybook action() for logging
import { action } from "@storybook/addon-actions";

const mockService = {
  save: action("save"), // ✅ Shows in Storybook Actions panel
};
```

#### 2. Exposed BehaviorSubjects (`rxjs/no-exposed-subjects`)

**❌ DON'T:**

```typescript
// Mock service exposing subject
class MockDataService {
  data$ = new BehaviorSubject<Data[]>([]); // ❌ Subject exposed
}
```

**✅ DO:**

```typescript
// Expose observable, hide subject
class MockDataService {
  private _data = new BehaviorSubject<Data[]>([]);
  readonly data$ = this._data.asObservable(); // ✅ Observable exposed

  updateData(data: Data[]) {
    this._data.next(data); // Helper for tests
  }
}
```

#### 3. Missing Subscription Cleanup (`rxjs-angular/prefer-takeuntil`)

**❌ DON'T:**

```typescript
// In component tests
it("should handle subscription", () => {
  component.observable$.subscribe(() => {
    // ❌ No cleanup - memory leak
  });
});
```

**✅ DO:**

```typescript
// Use takeUntilDestroyed() in component code
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

constructor() {
  this.observable$
    .pipe(takeUntilDestroyed())  // ✅ Auto cleanup
    .subscribe(() => {});
}

// Or use toSignal() to avoid subscriptions
protected data = toSignal(this.service.data$);  // ✅ Preferred
```

#### 4. Floating Promises (`@typescript-eslint/no-floating-promises`)

**❌ DON'T:**

```typescript
// In test files
it("should save", () => {
  component.save(); // ❌ Returns promise but not awaited
});
```

**✅ DO:**

```typescript
// Await async operations
it("should save", async () => {
  await component.save(); // ✅ Properly awaited
});
```

#### 5. Unused Imports/Variables (`@typescript-eslint/no-unused-vars`)

**❌ DON'T:**

```typescript
import { SomeHelper, UnusedHelper } from './helpers';  // ❌ UnusedHelper not used

// For unused error params
.catch((error) => {  // ❌ error defined but not used
  this.showError();
});
```

**✅ DO:**

```typescript
import { SomeHelper } from './helpers';  // ✅ Only import what's used

// Omit parameter if not used
.catch(() => {  // ✅ No parameter defined
  this.showError();
});
```

### Pre-Commit ESLint Check

**Before committing test/story files:**

```bash
npm run lint:fix
npm run prettier
```

### Why These Rules Matter

- **Security:** Console statements can leak sensitive data
- **Memory:** Unmanaged subscriptions cause memory leaks
- **Quality:** Proper patterns make code maintainable
- **Consistency:** Mock services should follow production patterns

**See also:** [Storybook and Test Standards in DIRT CLAUDE.md](/bitwarden_license/bit-common/src/dirt/CLAUDE.md#storybook-and-test-standards-critical)

---

## Testing Checklist

Use this checklist for each component:

- [ ] Component creates without errors
- [ ] All signal inputs tested (default + edge cases)
- [ ] All signal outputs tested (event emissions)
- [ ] User interactions tested (clicks, forms, keyboard)
- [ ] Computed properties tested (derived state)
- [ ] Conditional rendering tested (@if blocks)
- [ ] Loops tested (@for blocks with track)
- [ ] Service integrations tested (mocked services)
- [ ] Async operations tested (loading, error states)
- [ ] Edge cases tested (empty, loading, error)
- [ ] Storybook created with all variants
- [ ] **ESLint passes** (`npm run lint:fix`)
- [ ] Type check passes (`npm run test:types`)

---

## Reference Components

**V2 Components (use as examples):**

- `v2/access-intelligence-page/access-intelligence-page.component.spec.ts`
  — Container with service mocks + `overrideComponent` (strips HeaderModule)
- `v2/all-activity-v2/all-activity-v2.component.spec.ts`
  — Feature component with BehaviorSubject mocks, computed signals, dialog spy
- `v2/new-applications-dialog-v2/new-applications-dialog-v2.component.spec.ts`
  — DIALOG_DATA injection, async operations, static open spy pattern
- `v2/shared/applications-table-v2/applications-table-v2.component.spec.ts`
  — Signal inputs, DOM interaction with `dispatchEvent`
- `v2/shared/review-applications-view-v2/review-applications-view-v2.component.spec.ts`
  — No-service component, `overrideComponent` for template deps, signal output testing

**Study these for patterns:**

- How to mock `AccessIntelligenceDataService` with `BehaviorSubject`
- How to test `toSignal()` conversions via BehaviorSubject emissions
- How to test computed signals
- How to use `overrideComponent` for heavy imports vs mocking injected services

---

## Related Documentation

**Standards:**

- [Angular Standards](./angular-standards.md) - Angular-specific patterns
- [Service Testing Standards](./testing-standards-services.md) - Service/model testing
- [Code Organization Standards](./code-organization-standards.md) - Naming and structure

**External Resources:**

- [Bitwarden Angular Guide](https://contributing.bitwarden.com/contributing/code-style/web/angular/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.3
**Last Updated:** 2026-03-03
**Maintainer:** DIRT Team
