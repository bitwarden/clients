import { DOCUMENT, NgIf } from "@angular/common";
import { Component, DestroyRef, inject, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import { pairwise, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { getWebStoreUrl } from "@bitwarden/common/vault/utils/get-web-store-url";
import {
  ButtonComponent,
  DialogRef,
  DialogService,
  IconModule,
  LinkModule,
} from "@bitwarden/components";
import { VaultIcons } from "@bitwarden/vault";

import { WebBrowserInteractionService } from "../../services/web-browser-interaction.service";

import { AddExtensionLaterDialogComponent } from "./add-extension-later-dialog.component";
import { AddExtensionVideosComponent } from "./add-extension-videos.component";

const SetupExtensionState = {
  Loading: "loading",
  NeedsExtension: "needs-extension",
  Success: "success",
} as const;

type SetupExtensionState = UnionOfValues<typeof SetupExtensionState>;

@Component({
  selector: "vault-setup-extension",
  templateUrl: "./setup-extension.component.html",
  imports: [
    NgIf,
    JslibModule,
    ButtonComponent,
    LinkModule,
    IconModule,
    RouterModule,
    AddExtensionVideosComponent,
  ],
})
export class SetupExtensionComponent implements OnInit, OnDestroy {
  private webBrowserExtensionInteractionService = inject(WebBrowserInteractionService);
  private configService = inject(ConfigService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformUtilsService = inject(PlatformUtilsService);
  private dialogService = inject(DialogService);
  private document = inject(DOCUMENT);

  protected SetupExtensionState = SetupExtensionState;
  protected PartyIcon = VaultIcons.Party;

  /** The current state of the setup extension component. */
  protected state: SetupExtensionState = SetupExtensionState.Loading;

  /** Download Url for the extension based on the browser */
  protected webStoreUrl: string = "";

  /** Reference to the add it later dialog */
  protected dialogRef: DialogRef | null = null;
  private viewportContent: string | null = null;

  async ngOnInit() {
    // It is not be uncommon for users to hit this page from smaller viewports.
    // There are global styles that set a min-width for the page which cause it to render poorly.
    // Remove them here.
    // https://github.com/bitwarden/clients/blob/main/apps/web/src/scss/base.scss#L6
    this.document.body.style.minWidth = "auto";

    const viewportMeta = this.document.querySelector('meta[name="viewport"]');

    // Save the current viewport content to reset it when the component is destroyed
    this.viewportContent = viewportMeta?.getAttribute("content") ?? null;
    viewportMeta?.setAttribute("content", "width=device-width, initial-scale=1.0");

    await this.conditionallyRedirectUser();

    this.webStoreUrl = getWebStoreUrl(this.platformUtilsService.getDevice());

    this.webBrowserExtensionInteractionService.extensionInstalled$
      .pipe(takeUntilDestroyed(this.destroyRef), startWith(null), pairwise())
      .subscribe(([previousState, currentState]) => {
        // Initial state transitioned to extension installed, redirect the user
        if (previousState === null && currentState) {
          void this.router.navigate(["/vault"]);
        }

        // Extension was not installed and now it is, show success state
        if (previousState === false && currentState) {
          this.dialogRef?.close();
          this.state = SetupExtensionState.Success;
        }

        // Extension is not installed
        if (currentState === false) {
          this.state = SetupExtensionState.NeedsExtension;
        }
      });
  }

  ngOnDestroy(): void {
    // Reset the body min-width when the component is destroyed
    this.document.body.style.minWidth = "";

    if (this.viewportContent !== null) {
      this.document
        .querySelector('meta[name="viewport"]')
        ?.setAttribute("content", this.viewportContent);
    }
  }

  /** Conditionally redirects the user to the vault upon landing on the page. */
  async conditionallyRedirectUser() {
    const isFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19315EndUserActivationMvp,
    );
    const isMobile = Utils.isMobileBrowser;

    if (!isFeatureEnabled || isMobile) {
      await this.router.navigate(["/vault"]);
    }
  }

  /** Opens the add extension later dialog */
  addItLater() {
    this.dialogRef = this.dialogService.open(AddExtensionLaterDialogComponent);
  }

  /** Opens the browser extension */
  openExtension() {
    void this.webBrowserExtensionInteractionService.openExtension();
  }
}
