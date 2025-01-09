// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, inject } from "@angular/core";
import { Params } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { OrganizationSponsorshipResponse } from "@bitwarden/common/admin-console/models/response/organization-sponsorship.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ToastService } from "@bitwarden/components";

import { BaseAcceptComponent } from "../../../common/base.accept.component";

/*
 * This component is responsible for handling the acceptance of a families plan sponsorship invite.
 * "Bitwarden allows all members of Enterprise Organizations to redeem a complimentary Families Plan with their
 * personal email address." - https://bitwarden.com/learning/free-families-plan-for-enterprise/
 */
@Component({
  selector: "app-accept-family-sponsorship",
  templateUrl: "accept-family-sponsorship.component.html",
})
export class AcceptFamilySponsorshipComponent extends BaseAcceptComponent {
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
      // TODO: update logic when email verification flag is removed
      let queryParams: Params;
      let registerRoute = await firstValueFrom(this.registerRoute$);
      if (registerRoute === "/register") {
        queryParams = {
          email: qParams.email,
        };
      } else if (registerRoute === "/signup") {
        // We have to override the base component route as we don't need users to
        // complete email verification if they are coming directly an emailed invite.

        // TODO: in the future, to allow users to enter a name, consider sending all invite users to
        // start registration page with prefilled email and a named token to be passed directly
        // along to the finish-signup page without requiring email verification as
        // we can treat the existence of the token as a form of email verification.

        registerRoute = "/finish-signup";
        queryParams = {
          email: qParams.email,
          orgSponsoredFreeFamilyPlanToken: qParams.token,
        };
      }

      await this.router.navigate([registerRoute], {
        queryParams: queryParams,
      });
    }
  }
}
