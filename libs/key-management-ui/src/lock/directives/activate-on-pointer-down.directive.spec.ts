import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ActivateOnPointerDownDirective } from "./activate-on-pointer-down.directive";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivateOnPointerDownDirective],
  template: `
    <form (submit)="submits = submits + 1; $event.preventDefault()">
      <button type="submit" appActivateOnPointerDown id="submit">Unlock</button>
    </form>
    <button type="button" appActivateOnPointerDown id="action" (click)="clicks = clicks + 1">
      Unlock with biometrics
    </button>
    <button
      type="button"
      appActivateOnPointerDown
      id="disabled"
      disabled
      (click)="clicks = clicks + 1"
    >
      Unavailable
    </button>
  `,
})
class HostComponent {
  submits = 0;
  clicks = 0;
}

describe("ActivateOnPointerDownDirective", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const button = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement;
  // jsdom has no PointerEvent; the directive only reads `button`, which MouseEvent carries.
  const press = (id: string, mouseButton = 0) =>
    button(id).dispatchEvent(new MouseEvent("pointerdown", { button: mouseButton, bubbles: true }));
  const release = (id: string) => button(id).click();

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("runs the button's action on press, not on release", () => {
    press("action");
    expect(host.clicks).toBe(1);

    release("action");
    expect(host.clicks).toBe(1);
  });

  it("submits the form on press, once", () => {
    press("submit");
    release("submit");

    expect(host.submits).toBe(1);
  });

  it("keeps keyboard activation, which clicks without a press", () => {
    release("action");
    release("action");

    expect(host.clicks).toBe(2);
  });

  it("ignores presses of other mouse buttons", () => {
    press("action", 2);

    expect(host.clicks).toBe(0);
  });

  it("does nothing for a disabled button", () => {
    press("disabled");

    expect(host.clicks).toBe(0);
  });
});
