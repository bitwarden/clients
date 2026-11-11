import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { EventSecurity } from "../../utils/event-security";

import { InlineMenuListMessagingService } from "./inline-menu-list-messaging.service";
import { InlineMenuListComponent } from "./inline-menu-list.component";

/**
 * Root of the inline menu list iframe page. Besides binding state, it owns the page-level DOM
 * behavior the background relies on: height reports, focus requests, and focus checks.
 */
@Component({
  selector: "autofill-inline-menu-list-page",
  imports: [InlineMenuListComponent],
  providers: [InlineMenuListMessagingService],
  host: {
    class: "tw-block",
    "(keyup)": "moveFocus($event)",
  },
  template: `
    @if (messaging.state(); as state) {
      <autofill-inline-menu-list
        [state]="state"
        (unlock)="messaging.unlock()"
        (addNewItem)="messaging.addNewItem()"
        (saveLogin)="messaging.addNewItem()"
        (fillCipher)="messaging.fillCipher($event)"
        (viewCipher)="messaging.viewCipher($event)"
        (totpPeriodElapsed)="messaging.refreshCiphers()"
        (fillPassword)="messaging.fillGeneratedPassword()"
        (regeneratePassword)="messaging.regeneratePassword()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuListPageComponent {
  protected readonly messaging = inject(InlineMenuListMessagingService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const resizeObserver = new ResizeObserver(([entry]) =>
      this.messaging.reportHeight(entry.contentRect.height),
    );
    resizeObserver.observe(this.host);
    inject(DestroyRef).onDestroy(() => resizeObserver.disconnect());

    this.messaging.focusRequested$.pipe(takeUntilDestroyed()).subscribe(() => this.focusList());
    this.messaging.focusCheckRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.checkFocused());
  }

  /** Arrow keys move between the list's buttons; the page channel suppresses their default. */
  protected moveFocus(event: KeyboardEvent) {
    if (!EventSecurity.isEventTrusted(event)) {
      return;
    }
    const direction = event.code === "ArrowDown" ? 1 : event.code === "ArrowUp" ? -1 : 0;
    if (!direction) {
      return;
    }

    const buttons = Array.from(this.host.querySelectorAll<HTMLElement>("button"));
    const index = buttons.indexOf(globalThis.document.activeElement as HTMLElement);
    buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  }

  private focusList() {
    this.host.setAttribute("role", "dialog");
    this.host.setAttribute("aria-modal", "true");
    this.host.querySelector<HTMLElement>("button")?.focus();
  }

  /** While the pointer is over the list, wait for it to leave before reporting lost focus. */
  private checkFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    if (this.host.matches(":hover")) {
      globalThis.document.addEventListener("mouseout", () => this.checkFocused(), { once: true });
      return;
    }

    this.messaging.checkButtonFocused();
  }
}
