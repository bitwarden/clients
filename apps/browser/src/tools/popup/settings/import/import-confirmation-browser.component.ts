import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import { SvgModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserApi } from "../../../../platform/browser/browser-api";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";
import {
  ExtensionPhase,
  ImportConfirmationStatesComponent,
} from "./import-confirmation-states.component";

const POPUP_POLL_ATTEMPTS = 5;
const POPUP_POLL_INTERVAL_MS = 200;

// Where opening the popup from a page can work. BrowserActionsService only handles Chrome,
// DuckDuckGo, Firefox and Safari, and Firefox fails from a page
// (libs/common/src/platform/actions/README.md), so a button could not help on the others.
const POPUP_OPENABLE_DEVICES: ReadonlySet<DeviceType> = new Set([
  DeviceType.ChromeExtension,
  DeviceType.DuckDuckGoExtension,
  DeviceType.SafariExtension,
]);

/** The page the import tab ends on. It brings the extension popup forward, which shows the result,
 *  and offers a button, then the toolbar instructions, if that fails. */
@Component({
  templateUrl: "import-confirmation-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, ImportConfirmationStatesComponent, SvgModule],
})
export class ImportConfirmationBrowserComponent {
  private readonly router = inject(Router);
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly actionsService = inject(ActionsService);
  private readonly canOpenPopup = POPUP_OPENABLE_DEVICES.has(
    inject(PlatformUtilsService).getDevice(),
  );

  protected readonly logo = BitwardenLogo;

  // A refresh or deep link lands here with nothing to show.
  protected readonly confirmation = this.confirmationState.current();

  protected readonly phase = signal<ExtensionPhase>("opening");
  protected readonly retrying = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.confirmationState.clear());

    if (this.confirmation == null) {
      void this.router.navigate(["/tabs/vault"]);
      return;
    }

    void this.tryOpenExtension(this.canOpenPopup ? "button" : "toolbar");
  }

  protected async onOpenExtension(): Promise<void> {
    this.retrying.set(true);
    try {
      await this.tryOpenExtension("toolbar");
    } finally {
      this.retrying.set(false);
    }
  }

  // openPopup() swallows its own failures, so success is confirmed by finding the popup.
  private async tryOpenExtension(onFailure: "button" | "toolbar"): Promise<void> {
    await this.confirmationState.resetPopupHistory();
    await this.actionsService.openPopup();
    this.phase.set((await this.popupOpened()) ? "opened" : onFailure);
  }

  private async popupOpened(): Promise<boolean> {
    for (let attempt = 0; attempt < POPUP_POLL_ATTEMPTS; attempt++) {
      if (await BrowserApi.isPopupOpen()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, POPUP_POLL_INTERVAL_MS));
    }
    return false;
  }
}
