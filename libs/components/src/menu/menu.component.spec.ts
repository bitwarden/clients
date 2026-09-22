import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { TooltipDirective } from "../tooltip/tooltip.directive";

import { defaultPositions } from "./default-positions";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";

import { MenuModule } from "./index";

// eslint-disable-next-line no-console
const originalError = console.error;

// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "object" &&
    (args[0] as Error).message.includes("Could not parse CSS stylesheet")
  ) {
    // Opening the overlay container in tests causes stylesheets to be parsed,
    // which can lead to JSDOM unable to parse CSS errors. These can be ignored safely.
    return;
  }
  originalError(...args);
};

describe("Menu", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  const getMenuTriggerDirective = () => {
    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    return buttonDebugElement.injector.get(MenuTriggerForDirective);
  };

  // The overlay is created outside the root debugElement, so we need to query its parent
  const getBitMenuPanel = () => document.querySelector(".bit-menu-panel");

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestAppComponent],
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();
  });

  it("should open when the trigger is clicked", async () => {
    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    (buttonDebugElement.nativeElement as HTMLButtonElement).click();

    expect(getBitMenuPanel()).toBeTruthy();
  });

  it("should close when the trigger is clicked", () => {
    getMenuTriggerDirective().toggleMenu();

    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    (buttonDebugElement.nativeElement as HTMLButtonElement).click();

    expect(getBitMenuPanel()).toBeFalsy();
  });

  it("should close when a menu item is clicked", () => {
    getMenuTriggerDirective().toggleMenu();

    (document.querySelector("#item1") as HTMLAnchorElement).click();

    expect(getBitMenuPanel()).toBeFalsy();
  });

  it("should close when the backdrop is clicked", () => {
    getMenuTriggerDirective().toggleMenu();

    (document.querySelector(".cdk-overlay-backdrop") as HTMLAnchorElement).click();

    expect(getBitMenuPanel()).toBeFalsy();
  });

  it("should not open when the trigger button is disabled", () => {
    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    buttonDebugElement.nativeElement.setAttribute("disabled", "true");
    (buttonDebugElement.nativeElement as HTMLButtonElement).click();

    expect(getBitMenuPanel()).toBeFalsy();
  });

  it("opens on right-click using the shared default positions", () => {
    getMenuTriggerDirective().toggleMenuOnRightClick(
      new MouseEvent("contextmenu", { clientX: 10, clientY: 10 }),
    );

    expect(getBitMenuPanel()).toBeTruthy();
  });

  it("blocks page scrolling while a right-click menu is open", () => {
    getMenuTriggerDirective().toggleMenuOnRightClick(
      new MouseEvent("contextmenu", { clientX: 10, clientY: 10 }),
    );

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    fixture.nativeElement.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    expect(getBitMenuPanel()).toBeTruthy();
  });

  it("allows scrolling inside a right-click menu", () => {
    getMenuTriggerDirective().toggleMenuOnRightClick(
      new MouseEvent("contextmenu", { clientX: 10, clientY: 10 }),
    );

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    getBitMenuPanel()!.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  it("allows page scrolling once the right-click menu closes", () => {
    const directive = getMenuTriggerDirective();
    const contextMenuEvent = new MouseEvent("contextmenu", { clientX: 10, clientY: 10 });
    directive.toggleMenuOnRightClick(contextMenuEvent);
    directive.toggleMenu();

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    fixture.nativeElement.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  it("does not block page scrolling for a click-opened menu", () => {
    getMenuTriggerDirective().toggleMenu();

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    fixture.nativeElement.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  describe("position preference", () => {
    // The `positions` getter is private; the unknown cast lets us assert
    // ordering without depending on CDK overlay internals.
    const readPositions = (d: MenuTriggerForDirective) =>
      (d as unknown as { positions: { id?: string }[] }).positions;

    it("returns defaultPositions unchanged when no position input is set", () => {
      const directive = getMenuTriggerDirective();
      expect(readPositions(directive)).toBe(defaultPositions);
    });
  });
});

describe("Menu — with position input", () => {
  let fixture: ComponentFixture<TestAppWithPositionComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestAppWithPositionComponent],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppWithPositionComponent);
    fixture.detectChanges();
  });

  it("moves the preferred position to the front and keeps the rest as fallbacks", () => {
    const directive = fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(MenuTriggerForDirective);
    const positions = (directive as unknown as { positions: { id?: string }[] }).positions;
    expect(positions[0].id).toBe("above-end");
    expect(positions.slice(1).map((p) => p.id)).toEqual([
      "below-start",
      "below-end",
      "above-start",
    ]);
  });
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app",
  template: `
    <button type="button" [bitMenuTriggerFor]="testMenu">Open menu</button>

    <bit-menu #testMenu>
      <a id="item1" bitMenuItem>Item 1</a>
      <a id="item2" bitMenuItem>Item 2</a>
    </bit-menu>
  `,
  imports: [MenuModule],
})
class TestAppComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app-with-position",
  template: `
    <button type="button" [bitMenuTriggerFor]="testMenu" menuPosition="above-end">Open menu</button>
    <bit-menu #testMenu>
      <a id="item1" bitMenuItem>Item 1</a>
    </bit-menu>
  `,
  imports: [MenuModule],
})
class TestAppWithPositionComponent {}

describe("Menu — open state in an OnPush host", () => {
  let fixture: ComponentFixture<TestAppOnPushParentComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TestAppOnPushParentComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppOnPushParentComponent);
    fixture.detectChanges();
  });

  const getTriggerEl = () =>
    fixture.debugElement.query(By.directive(MenuTriggerForDirective))
      .nativeElement as HTMLButtonElement;

  it("clears open state bindings when the menu is closed from outside the host's view", async () => {
    const trigger = getTriggerEl();

    trigger.click();
    fixture.detectChanges();
    expect(trigger.classList).toContain("is-open");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // The backdrop click happens outside the OnPush component's view, so nothing marks that
    // view dirty on its own — the open state has to be reactive for the bindings to update.
    (document.querySelector(".cdk-overlay-backdrop") as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger.classList).not.toContain("is-open");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

@Component({
  selector: "test-app-on-push",
  template: `
    <button
      type="button"
      #menuTrigger="menuTrigger"
      [bitMenuTriggerFor]="testMenu"
      [class.is-open]="menuTrigger.isOpen()"
    >
      Open menu
    </button>
    <bit-menu #testMenu>
      <a id="item1" bitMenuItem>Item 1</a>
    </bit-menu>
  `,
  imports: [MenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestAppOnPushComponent {}

/**
 * The trigger lives in a child component so that `fixture.detectChanges()` can't force-refresh
 * the OnPush view the way it would if the trigger sat on the fixture's own component.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app-on-push-parent",
  template: `<test-app-on-push></test-app-on-push>`,
  imports: [TestAppOnPushComponent],
})
class TestAppOnPushParentComponent {}

describe("Menu — host tooltip suppression", () => {
  let fixture: ComponentFixture<TestAppWithTooltipComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TestAppWithTooltipComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppWithTooltipComponent);
    fixture.detectChanges();
  });

  const getTriggerEl = () =>
    fixture.debugElement.query(By.directive(MenuTriggerForDirective))
      .nativeElement as HTMLButtonElement;

  const getTooltipDirective = () =>
    fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);

  it("suppresses the host tooltip while the menu is open and restores on close", () => {
    const tooltip = getTooltipDirective();
    const trigger = getTriggerEl();

    expect(tooltip.suppressed()).toBe(false);

    trigger.click();
    expect(tooltip.suppressed()).toBe(true);

    trigger.click();
    expect(tooltip.suppressed()).toBe(false);
  });
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app-with-tooltip",
  template: `
    <button type="button" bitTooltip="Open menu" [bitMenuTriggerFor]="testMenu">Open menu</button>
    <bit-menu #testMenu>
      <a id="item1" bitMenuItem>Item 1</a>
    </bit-menu>
  `,
  imports: [MenuModule, TooltipDirective],
})
class TestAppWithTooltipComponent {}
