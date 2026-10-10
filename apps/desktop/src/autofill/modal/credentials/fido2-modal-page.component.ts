import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Page layout for the passkey modal window: a fixed header above a scrollable content region.
 * Mirrors the browser extension's `popup-page`.
 */
@Component({
  selector: "app-fido2-modal-page",
  templateUrl: "fido2-modal-page.component.html",
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ModalPageComponent {}
