import { NgIf } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { pairwise, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { getWebStoreUrl } from "@bitwarden/common/vault/utils/get-web-store-url";

import { WebBrowserInteractionService } from "../../services/web-browser-interaction.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonComponent } from "@bitwarden/components";

const SetupExtensionState = {
  Loading: "loading",
  NeedsExtension: "needs-extension",
} as const;

type SetupExtensionState = UnionOfValues<typeof SetupExtensionState>;

@Component({
  selector: "vault-setup-extension",
  templateUrl: "./setup-extension.component.html",
  imports: [NgIf, JslibModule, ButtonComponent],
})
export class SetupExtensionComponent implements OnInit {
  private webBrowserExtensionInteractionService = inject(WebBrowserInteractionService);
  private configService = inject(ConfigService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformUtilsService = inject(PlatformUtilsService);

  protected SetupExtensionState = SetupExtensionState;
  /**
   * The current state of the setup extension component.
   */
  protected state: SetupExtensionState = SetupExtensionState.Loading;

  /** Download Url for the extension based on the browser */
  protected webStoreUrl: string = "";

  async ngOnInit() {
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
        }

        // Extension is not installed
        if (currentState === false) {
          this.state = SetupExtensionState.NeedsExtension;
        }
      });
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
}
