// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { fromEvent, Subscription } from "rxjs";

@Injectable()
export class PopupCloseWarningService {
  private unloadSubscription: Subscription;

  /**
   * Enables a pop-up warning before the user exits the window/tab, or navigates away.
   * This warns the user that they may lose unsaved data if they leave the page.
   * (Note: navigating within the Angular app will not trigger it because it's an SPA.)
   * Make sure you call `PopupCloseWarningService.disable` when it is no longer relevant.
   */
  enable() {
    this.disable();

    this.unloadSubscription = fromEvent(window, "beforeunload").subscribe(
      (e: BeforeUnloadEvent) => {
        // Recommended method but not widely supported
        e.preventDefault();

        // Modern browsers do not display this message, it just needs to be a non-nullish value
        // Exact wording is determined by the browser
        const confirmationMessage = "";

        // Older methods with better support
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      },
    );
  }

  /**
   * Disables the warning enabled by PopupCloseWarningService.enable.
   */
  disable() {
    this.unloadSubscription?.unsubscribe();
  }
}
