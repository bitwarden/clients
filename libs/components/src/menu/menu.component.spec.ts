import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { MenuTriggerForDirective } from "./menu-trigger-for.directive";

import { MenuModule } from "./index";

describe("Menu", () => {
  let fixture: ComponentFixture<TestApp>;
  const getMenuTriggerDirective = () => {
    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    return buttonDebugElement.injector.get(MenuTriggerForDirective);
  };

  // The overlay is created outside the root debugElement, so we need to query its parent
  const getBitMenuPanel = () => document.querySelector(".bit-menu-panel");

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestApp],
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(TestApp);
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
class TestApp {}
