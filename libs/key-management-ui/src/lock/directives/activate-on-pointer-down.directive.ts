import { Directive, ElementRef, inject } from "@angular/core";

// `PointerEvent.button` of the main button: left click, or a touch or pen contact.
const PRIMARY_BUTTON = 0;
// A click this soon after an activating press is that press's release.
const RELEASE_WINDOW_MS = 1000;

/**
 * Activates a button when it is pressed rather than released, so an unlock starts as soon as
 * the user commits to it. The click the release would cause is swallowed, so the button acts
 * once. Keyboard activation (Enter, Space) is unchanged.
 */
@Directive({
  selector: "button[appActivateOnPointerDown]",
  host: { "(pointerdown)": "activate($event)" },
})
export class ActivateOnPointerDownDirective {
  private readonly button = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  private pressedAt: number | undefined;
  private activating = false;

  constructor() {
    // Capture runs before the button's own click handlers, which lets it swallow the release.
    this.button.addEventListener("click", (event) => this.swallowRelease(event), {
      capture: true,
    });
  }

  protected activate(event: PointerEvent) {
    if (event.button !== PRIMARY_BUTTON || this.button.disabled) {
      return;
    }

    this.pressedAt = performance.now();
    this.activating = true;
    try {
      // A real click: runs the button's handlers, or submits its form for a submit button.
      this.button.click();
    } finally {
      this.activating = false;
    }
  }

  private swallowRelease(event: MouseEvent) {
    if (this.activating || this.pressedAt == null) {
      return;
    }

    const isRelease = performance.now() - this.pressedAt < RELEASE_WINDOW_MS;
    this.pressedAt = undefined;
    if (!isRelease) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
