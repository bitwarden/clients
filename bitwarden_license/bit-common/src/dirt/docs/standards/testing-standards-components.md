# Access Intelligence - Component Testing Standards

**Purpose:** Testing guidelines for Angular components in the Access Intelligence module

**Related:** [testing-standards-services.md](./testing-standards-services.md) for service/model testing

---

## Table of Contents

1. [Component Test Coverage Goals](#component-test-coverage-goals)
2. [Angular Testing Utilities](#angular-testing-utilities)
3. [Testing OnPush Components](#testing-onpush-components)
4. [Testing Signal Inputs/Outputs](#testing-signal-inputsoutputs)
5. [Testing with toSignal()](#testing-with-tosignal)
6. [Storybook as Living Documentation](#storybook-as-living-documentation)
7. [Component Test Structure](#component-test-structure)
8. [Common Patterns](#common-patterns)
9. [Running Component Tests](#running-component-tests)

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

- `risk-insights-v2.component.spec.ts` - Container with state management
- `risk-insights-drawer-v2.component.spec.ts` - Pure presentation component

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

**Every reusable component should have a Storybook.**

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
- ✅ **Follows Angular best practices** - Recommended in [Angular testing guide](https://angular.io/guide/testing-components-basics#testing-private-members)
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
- [ ] Type check passes (npm run test:types)

---

## Reference Components

**V2 Components (completed, use as examples):**

- `v2/risk-insights-v2.component.ts` - Container with state management
  - Tests: Signal inputs, service integration, user actions
- `v2/shared/risk-insights-drawer-v2.component.ts` - Pure presentation
  - Tests: Signal inputs/outputs, conditional rendering

**Study these for patterns:**

- How to mock `AccessIntelligenceDataService`
- How to test `toSignal()` conversions
- How to test computed signals
- How to test OnPush change detection

---

## Related Documentation

**Playbooks:**

- [Component Migration Playbook](../playbooks/component-migration-playbook.md) - Migrating components to modern patterns

**Standards:**

- [Angular Standards](./angular-standards.md) - Angular-specific patterns
- [Service Testing Standards](./testing-standards-services.md) - Service/model testing
- [Code Organization Standards](./code-organization-standards.md) - Naming and structure

**External Resources:**

- [Bitwarden Angular Guide](https://contributing.bitwarden.com/contributing/code-style/web/angular/)
- [Angular Testing Guide](https://angular.io/guide/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

**Navigation:**

- [Standards Hub](./README.md) - All DIRT team standards

---

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** DIRT Team
