import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { AnchorLinkDirective, CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AtRiskPasswordPageService } from "../at-risk-passwords/at-risk-password-page.service";

@Component({
  selector: "vault-at-risk-password-callout",
  imports: [CommonModule, AnchorLinkDirective, RouterModule, CalloutModule, I18nPipe],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private atRiskPasswordPageService = inject(AtRiskPasswordPageService);

  protected atRiskItems$ = this.atRiskPasswordPageService.atRiskItems$;
}
