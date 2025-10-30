import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleGroupModule } from "./toggle-group.module";

describe("Toggle", () => {
  let fixture: ComponentFixture<TestComponent>;
  let toggleGroup: ToggleGroupComponent;
  let toggleButtons: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    toggleGroup = fixture.debugElement.query(By.directive(ToggleGroupComponent)).componentInstance;
    toggleButtons = fixture.debugElement.queryAll(By.css("input[type=radio]"));
  });

  it("should emit value when clicking on radio button", () => {
    const spyFn = jest.spyOn(toggleGroup, "onInputInteraction");

    toggleButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(spyFn).toHaveBeenCalledWith(1);
  });

  it("should select toggle button only when selected matches value", () => {
    fixture.detectChanges();

    expect(toggleButtons[0].nativeElement.checked).toBe(true);
    expect(toggleButtons[1].nativeElement.checked).toBe(false);

    toggleButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(toggleButtons[0].nativeElement.checked).toBe(false);
    expect(toggleButtons[1].nativeElement.checked).toBe(true);
  });
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-component",
  template: `
    <bit-toggle-group [(selected)]="selected">
      <bit-toggle [value]="0">Zero</bit-toggle>
      <bit-toggle [value]="1">One</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule],
})
class TestComponent {
  selected = 0;
}
