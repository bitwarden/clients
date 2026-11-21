import { ChangeDetectionStrategy, Component, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { InlineMenuButtonMessagingService } from "./inline-menu-button-messaging.service";
import { InlineMenuButtonComponent } from "./inline-menu-button.component";

/** Root of the inline menu button iframe page. */
@Component({
  selector: "autofill-inline-menu-button-page",
  imports: [InlineMenuButtonComponent],
  providers: [InlineMenuButtonMessagingService],
  host: { class: "tw-block tw-w-full" },
  template: `
    @if (messaging.initialized()) {
      <autofill-inline-menu-button
        [unlocked]="messaging.unlocked()"
        (toggle)="messaging.toggle()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuButtonPageComponent {
  protected readonly messaging = inject(InlineMenuButtonMessagingService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    this.messaging.focusCheckRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.checkFocused());
  }

  /** While the pointer is over the button, wait for it to leave before reporting lost focus. */
  private checkFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    if (this.host.matches(":hover")) {
      globalThis.document.addEventListener("mouseout", () => this.checkFocused(), { once: true });
      return;
    }

    this.messaging.requestDelayedClosure();
  }
}
