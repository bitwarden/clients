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

import { WebBrowserInteractionService } from "../../services/web-browser-interaction.service";

const SetupExtensionState = {
  Loading: "loading",
} as const;

type SetupExtensionState = UnionOfValues<typeof SetupExtensionState>;

@Component({
  selector: "vault-setup-extension",
  templateUrl: "./setup-extension.component.html",
  imports: [NgIf, JslibModule],
})
export class SetupExtensionComponent implements OnInit {
  private webBrowserExtensionInteractionService = inject(WebBrowserInteractionService);
  private configService = inject(ConfigService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  protected SetupExtensionState = SetupExtensionState;
  /**
   * The current state of the setup extension component.
   */
  protected state: SetupExtensionState = SetupExtensionState.Loading;

  async ngOnInit() {
    await this.conditionallyRedirectUser();

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
