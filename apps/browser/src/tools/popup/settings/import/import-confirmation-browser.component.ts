import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { BitwardenIcon, BitwardenLogo } from "@bitwarden/assets/svg";
import { ActionsService } from "@bitwarden/common/platform/actions";
import { ButtonModule, SvgModule, TypographyModule } from "@bitwarden/components";
import { ImportConfirmationSummaryComponent } from "@bitwarden/importer-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserApi } from "../../../../platform/browser/browser-api";

import { ImportConfirmationStateService } from "./import-confirmation-state.service";

/** What shows under the summary: nothing once the popup opened, then a button to retry, then the
 *  toolbar instructions. */
type ExtensionFallback = "none" | "button" | "toolbar";

const POPUP_POLL_ATTEMPTS = 5;
const POPUP_POLL_INTERVAL_MS = 200;

/** The page the import tab ends on. It also tries to bring the extension popup forward, and
 *  shows a button, then the toolbar instructions, under the summary if that fails. */
@Component({
  templateUrl: "import-confirmation-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    I18nPipe,
    ImportConfirmationSummaryComponent,
    SvgModule,
    TypographyModule,
  ],
})
export class ImportConfirmationBrowserComponent {
  private readonly router = inject(Router);
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly actionsService = inject(ActionsService);

  protected readonly logo = BitwardenLogo;
  protected readonly toolbarIcon = BitwardenIcon;

  // A refresh or deep link lands here with nothing to show.
  protected readonly confirmation = this.confirmationState.current();

  protected readonly fallback = signal<ExtensionFallback>("none");
  protected readonly opening = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.confirmationState.clear());

    if (this.confirmation == null) {
      void this.router.navigate(["/tabs/vault"]);
      return;
    }

    void this.tryOpenExtension("button");
  }

  protected viewImportedItems(): void {
    void this.router.navigate(["/tabs/vault"]);
  }

  protected async onOpenExtension(): Promise<void> {
    this.opening.set(true);
    try {
      await this.tryOpenExtension("toolbar");
    } finally {
      this.opening.set(false);
    }
  }

  // openPopup() swallows its own failures, so success is confirmed by finding the popup.
  private async tryOpenExtension(onFailure: Exclude<ExtensionFallback, "none">): Promise<void> {
    await this.actionsService.openPopup();
    this.fallback.set((await this.popupOpened()) ? "none" : onFailure);
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
