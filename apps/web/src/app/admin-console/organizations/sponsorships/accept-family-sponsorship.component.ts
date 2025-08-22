// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { Params } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { OrganizationSponsorshipResponse } from "@bitwarden/common/admin-console/models/response/organization-sponsorship.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IconModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BaseAcceptComponent } from "../../../common/base.accept.component";

/*
 * This component is responsible for handling the acceptance of a families plan sponsorship invite.
 * "Bitwarden allows all members of Enterprise Organizations to redeem a complimentary Families Plan with their
 * personal email address." - https://bitwarden.com/learning/free-families-plan-for-enterprise/
 */
@Component({
  templateUrl: "accept-family-sponsorship.component.html",
  imports: [CommonModule, I18nPipe, IconModule],
})
export class AcceptFamilySponsorshipComponent extends BaseAcceptComponent {
  protected logo = BitwardenLogo;
  failedShortMessage = "inviteAcceptFailedShort";
  failedMessage = "inviteAcceptFailed";

  requiredParameters = ["email", "token"];

  policyResponse!: OrganizationSponsorshipResponse;
  policyApiService = inject(PolicyApiServiceAbstraction);
  configService = inject(ConfigService);
  toastService = inject(ToastService);

  async authedHandler(qParams: Params) {
    await this.router.navigate(["/setup/families-for-enterprise"], { queryParams: qParams });
  }

  async unauthedHandler(qParams: Params) {
    if (!qParams.register) {
      await this.router.navigate(["/login"], { queryParams: { email: qParams.email } });
    } else {
      // We don't need users to complete email verification if they are coming directly from an emailed invite.
      // Therefore, we skip /signup and navigate directly to /finish-signup.

      // TODO: in the future, to allow users to enter a name, consider sending all invite users to
      // start registration page with prefilled email and a named token to be passed directly
      // along to the finish-signup page without requiring email verification as
      // we can treat the existence of the token as a form of email verification.
      await this.router.navigate(["/finish-signup"], {
        queryParams: {
          email: qParams.email,
          orgSponsoredFreeFamilyPlanToken: qParams.token,
        },
      });
    }
  }
}
