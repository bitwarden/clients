// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { NoItemsModule, SearchModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared/shared.module";

@Component({
  selector: "app-sm-landing",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule],
  templateUrl: "sm-landing.component.html",
})
export class SMLandingComponent implements OnInit {
  tryItNowUrl: string;
  learnMoreUrl: string = "https://bitwarden.com/help/secrets-manager-overview/";
  imageSrc: string = "../images/sm.webp";
  showSecretsManagerInformation: boolean = true;
  showGiveMembersAccessInstructions: boolean = false;

  constructor(
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const enabledOrganizations = (
      await firstValueFrom(this.organizationService.organizations$(userId))
    ).filter((e) => e.enabled);

    if (enabledOrganizations.length > 0) {
      this.handleEnabledOrganizations(enabledOrganizations);
    } else {
      // Person is not part of any orgs they need to be in an organization in order to use SM
      this.tryItNowUrl = "/create-organization";
    }
  }

  private handleEnabledOrganizations(enabledOrganizations: Organization[]) {
    // People get to this page because SM (Secrets Manager) isn't enabled for them (or the Organization they are a part of)
    // 1 - SM is enabled for the Organization but not that user
    //1a - person is Admin+ (Admin or higher) and just needs instructions on how to enable it for themselves
    //1b - person is beneath admin status and needs to request SM access from Administrators/Owners
    // 2 - SM is not enabled for the organization yet
    //2a - person is Owner/Provider - Direct them to the subscription/billing page
    //2b - person is Admin - Direct them to request access page where an email is sent to owner/admins
    //2c - person is user - Direct them to request access page where an email is sent to owner/admins

    // We use useSecretsManager because we want to get the first org the person is a part of where SM is enabled but they don't have access enabled yet
    const adminPlusNeedsInstructionsToEnableSM = enabledOrganizations.find(
      (o) => o.isAdmin && o.useSecretsManager,
    );
    const ownerNeedsToEnableSM = enabledOrganizations.find(
      (o) => o.isOwner && !o.useSecretsManager,
    );

    // 1a If Organization has SM Enabled, but this logged in person does not have it enabled, but they are admin+ then give them instructions to enable.
    if (adminPlusNeedsInstructionsToEnableSM != undefined) {
      this.showHowToEnableSMForMembers(adminPlusNeedsInstructionsToEnableSM.id);
    }
    // 2a Owners can enable SM in the subscription area of Admin Console.
    else if (ownerNeedsToEnableSM != undefined) {
      this.tryItNowUrl = `/organizations/${ownerNeedsToEnableSM.id}/billing/subscription`;
    }
    // 1b and 2b 2c, they must be lower than an Owner, and they need access, or want their org to have access to SM.
    else {
      this.tryItNowUrl = "/request-sm-access";
    }
  }

  private showHowToEnableSMForMembers(orgId: string) {
    this.showGiveMembersAccessInstructions = true;
    this.showSecretsManagerInformation = false;
    this.learnMoreUrl =
      "https://bitwarden.com/help/secrets-manager-quick-start/#give-members-access";
    this.imageSrc = "../images/sm-give-access.png";
    this.tryItNowUrl = `/organizations/${orgId}/members`;
  }
}
