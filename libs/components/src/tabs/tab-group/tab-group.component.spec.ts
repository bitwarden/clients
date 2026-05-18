import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../../utils/i18n-mock.service";
import { TabsModule } from "../tabs.module";

import { BitTabChangeEvent, TabGroupComponent } from "./tab-group.component";
import { TabComponent } from "./tab.component";

// JSDOM does not implement ResizeObserver — provide a no-op stub so the
// component can construct without throwing.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

// ---------------------------------------------------------------------------
// Test host components
// ---------------------------------------------------------------------------

@Component({
  template: `
    <bit-tab-group [(selectedIndex)]="selectedIndex">
      <bit-tab label="Tab One">Content One</bit-tab>
      <bit-tab label="Tab Two">Content Two</bit-tab>
      <bit-tab label="Tab Three">Content Three</bit-tab>
    </bit-tab-group>
  `,
  imports: [TabsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestAppComponent {
  readonly selectedIndex = signal(0);
}

/** Unbound host — no parent signal can reset the child model. Used for DOM-state tests. */
@Component({
  template: `
    <bit-tab-group>
      <bit-tab label="Tab One">Content One</bit-tab>
      <bit-tab label="Tab Two">Content Two</bit-tab>
      <bit-tab label="Tab Three">Content Three</bit-tab>
    </bit-tab-group>
  `,
  imports: [TabsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class UnboundTestAppComponent {}

@Component({
  template: `
    <bit-tab-group [(selectedIndex)]="selectedIndex">
      <bit-tab label="Enabled One">Enabled Content</bit-tab>
      <bit-tab label="Disabled" [disabled]="true">Disabled Content</bit-tab>
      <bit-tab label="Enabled Two">More Content</bit-tab>
    </bit-tab-group>
  `,
  imports: [TabsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DisabledTestAppComponent {
  readonly selectedIndex = signal(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTabGroup(fixture: ComponentFixture<unknown>): TabGroupComponent {
  return fixture.debugElement.query(By.directive(TabGroupComponent))
    .componentInstance as TabGroupComponent;
}

function getTabListEl(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.debugElement.query(By.css('[role="tablist"]')).nativeElement as HTMLElement;
}

/** Visible tab buttons — excludes the hidden More button */
function getTabButtons(fixture: ComponentFixture<unknown>): HTMLButtonElement[] {
  return fixture.debugElement
    .queryAll(By.css('button[role="tab"]:not([hidden])'))
    .map((d) => d.nativeElement as HTMLButtonElement);
}

/** Retrieves TabComponent instances via the TabGroupComponent's content-child signal. */
function getTabComponents(fixture: ComponentFixture<unknown>): TabComponent[] {
  return (getTabGroup(fixture) as unknown as { tabs: () => TabComponent[] }).tabs();
}

// ---------------------------------------------------------------------------
// Shared provider list
// ---------------------------------------------------------------------------

const providers = [{ provide: I18nService, useValue: new I18nMockService({ more: "More" }) }];

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("TabGroupComponent — initial state", () => {
  let fixture: ComponentFixture<TestAppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();
  });

  it("first tab is active on init", fakeAsync(() => {
    flushMicrotasks();
    const tabs = getTabComponents(fixture);
    expect(tabs[0].isActive()).toBe(true);
    expect(tabs[1].isActive()).toBe(false);
    expect(tabs[2].isActive()).toBe(false);
  }));

  it("first tab button has aria-selected=true after init", () => {
    const buttons = getTabButtons(fixture);
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
    expect(buttons[1].getAttribute("aria-selected")).toBe("false");
    expect(buttons[2].getAttribute("aria-selected")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// selectedTabChange output
// beforeEach defers detectChanges so the "does not emit on first render" test
// can subscribe before Angular runs its first change-detection pass.
// ---------------------------------------------------------------------------

describe("TabGroupComponent — selectedTabChange output", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let events: BitTabChangeEvent[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    events = [];
  });

  it("does not emit on first render", () => {
    getTabGroup(fixture).selectedTabChange.subscribe((e: BitTabChangeEvent) => events.push(e));
    fixture.detectChanges();
    expect(events).toHaveLength(0);
  });

  it("emits correct index when selectTab() is called", () => {
    fixture.detectChanges();
    getTabGroup(fixture).selectedTabChange.subscribe((e: BitTabChangeEvent) => events.push(e));
    getTabGroup(fixture).selectTab(1);
    fixture.detectChanges();
    expect(events).toHaveLength(1);
    expect(events[0].index).toBe(1);
  });

  it("emits correct tab reference", () => {
    fixture.detectChanges();
    const tabs = getTabComponents(fixture);
    getTabGroup(fixture).selectedTabChange.subscribe((e: BitTabChangeEvent) => events.push(e));
    getTabGroup(fixture).selectTab(2);
    fixture.detectChanges();
    expect(events[0].tab).toBe(tabs[2]);
  });

  it("does not emit when clicking the already-active tab", () => {
    fixture.detectChanges();
    getTabGroup(fixture).selectedTabChange.subscribe((e: BitTabChangeEvent) => events.push(e));
    getTabButtons(fixture)[0].click();
    fixture.detectChanges();
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectTab() API
// ---------------------------------------------------------------------------

describe("TabGroupComponent — selectTab()", () => {
  let fixture: ComponentFixture<TestAppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();
  });

  it("activates the nth tab", fakeAsync(() => {
    getTabGroup(fixture).selectTab(2);
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[2].isActive()).toBe(true);
  }));

  it("deactivates the previously active tab", fakeAsync(() => {
    getTabGroup(fixture).selectTab(1);
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[0].isActive()).toBe(false);
  }));
});

// ---------------------------------------------------------------------------
// Two-way binding [(selectedIndex)]
// ---------------------------------------------------------------------------

describe("TabGroupComponent — two-way binding [(selectedIndex)]", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let testApp: TestAppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    testApp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("selectedIndex model updates when a tab is selected via click", () => {
    // Click fires through Zone.js, which completes signal propagation in one pass.
    getTabButtons(fixture)[1].click();
    expect(getTabGroup(fixture).selectedIndex()).toBe(1);
  });

  it("changing parent signal activates the corresponding tab", fakeAsync(() => {
    testApp.selectedIndex.set(2);
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[2].isActive()).toBe(true);
  }));
});

// ---------------------------------------------------------------------------
// Index clamping
// ---------------------------------------------------------------------------

describe("TabGroupComponent — index clamping", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let testApp: TestAppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    testApp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("clamps out-of-bounds high index: last tab becomes active", fakeAsync(() => {
    testApp.selectedIndex.set(99);
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[2].isActive()).toBe(true);
  }));

  it("clamps negative index: first tab becomes active", fakeAsync(() => {
    testApp.selectedIndex.set(-5);
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[0].isActive()).toBe(true);
  }));
});

// ---------------------------------------------------------------------------
// Click to select
// ---------------------------------------------------------------------------

describe("TabGroupComponent — click to select", () => {
  let fixture: ComponentFixture<TestAppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();
  });

  it("clicking a tab button selects it", fakeAsync(() => {
    getTabButtons(fixture)[1].click();
    fixture.detectChanges();
    flushMicrotasks();
    expect(getTabComponents(fixture)[1].isActive()).toBe(true);
  }));
});

// ---------------------------------------------------------------------------
// Keyboard navigation
//
// CDK's ListKeyManager uses event.keyCode (not event.key), so we call
// keyManager().onKeydown() directly rather than dispatching DOM events.
// This tests the same contract: that the template wires keyboard events
// to the key manager, and that the key manager handles each key correctly.
// ---------------------------------------------------------------------------

describe("TabGroupComponent — keyboard navigation", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let dispatchKey: (key: string, keyCode: number) => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();

    dispatchKey = (key: string, keyCode: number) => {
      const event = new KeyboardEvent("keydown", { key, keyCode, bubbles: true });
      getTabListEl(fixture).dispatchEvent(event);
    };
  });

  it("ArrowRight moves key manager focus to the next tab", () => {
    dispatchKey("ArrowRight", 39);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(1);
  });

  it("ArrowLeft moves focus to the previous tab", () => {
    getTabGroup(fixture).selectTab(1);
    fixture.detectChanges();
    dispatchKey("ArrowLeft", 37);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(0);
  });

  it("ArrowRight on last tab wraps to first tab", () => {
    getTabGroup(fixture).selectTab(2);
    fixture.detectChanges();
    dispatchKey("ArrowRight", 39);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(0);
  });

  it("ArrowLeft on first tab wraps to last tab", () => {
    dispatchKey("ArrowLeft", 37);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(2);
  });

  it("Home key moves focus to the first tab", () => {
    getTabGroup(fixture).selectTab(2);
    fixture.detectChanges();
    dispatchKey("Home", 36);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(0);
  });

  it("End key moves focus to the last tab", () => {
    dispatchKey("End", 35);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ARIA attributes
// Uses UnboundTestAppComponent (no [(selectedIndex)] parent binding) so that
// fixture.detectChanges() does not re-apply a stale parent input that would
// reset the model signal back to 0.
// ---------------------------------------------------------------------------

describe("TabGroupComponent — ARIA attributes", () => {
  let fixture: ComponentFixture<UnboundTestAppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnboundTestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(UnboundTestAppComponent);
    fixture.detectChanges();
  });

  it("aria-selected is true on the active tab button", () => {
    expect(getTabButtons(fixture)[0].getAttribute("aria-selected")).toBe("true");
  });

  it("aria-selected is false on inactive tab buttons", () => {
    expect(getTabButtons(fixture)[1].getAttribute("aria-selected")).toBe("false");
    expect(getTabButtons(fixture)[2].getAttribute("aria-selected")).toBe("false");
  });

  it("aria-selected updates when a tab is selected", () => {
    getTabGroup(fixture).selectTab(1);
    fixture.detectChanges();
    const buttons = getTabButtons(fixture);
    expect(buttons[0].getAttribute("aria-selected")).toBe("false");
    expect(buttons[1].getAttribute("aria-selected")).toBe("true");
    expect(buttons[2].getAttribute("aria-selected")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// Disabled tab
// ---------------------------------------------------------------------------

describe("TabGroupComponent — disabled tab", () => {
  let fixture: ComponentFixture<DisabledTestAppComponent>;
  let testApp: DisabledTestAppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledTestAppComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(DisabledTestAppComponent);
    testApp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("clicking a disabled tab does not change selectedIndex", fakeAsync(() => {
    const disabledButton = fixture.debugElement
      .queryAll(By.css('button[role="tab"]:not([hidden])'))
      .map((d) => d.nativeElement as HTMLButtonElement)
      .find((b) => b.disabled || b.getAttribute("disabled") !== null);

    expect(disabledButton).toBeDefined();
    disabledButton?.click();
    fixture.detectChanges();
    flushMicrotasks();

    expect(testApp.selectedIndex()).toBe(0);
  }));

  it("keyboard navigation skips disabled tabs", () => {
    // Tab 1 is disabled; skipPredicate excludes it from FocusKeyManager.
    // ArrowRight from tab 0 should jump directly to tab 2.
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true });
    getTabListEl(fixture).dispatchEvent(event);
    expect(getTabGroup(fixture).keyManager()?.activeItemIndex).toBe(2);
  });
});
