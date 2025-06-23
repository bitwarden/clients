import { NgIf } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

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
  private configService = inject(ConfigService);
  private router = inject(Router);

  protected SetupExtensionState = SetupExtensionState;
  /**
   * The current state of the setup extension component.
   */
  protected state: SetupExtensionState = SetupExtensionState.Loading;

  async ngOnInit() {
    await this.conditionallyRedirectUser();
  }

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
