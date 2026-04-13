// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, effect, input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-export-scope-description",
  templateUrl: "export-scope-description.component.html",
  imports: [I18nPipe, TypographyModule],
})
export class ExportScopeDescriptionComponent {
  show = false;
  scopeConfig: {
    title: string;
    description: string;
    scopeIdentifier: string;
  };

  /* Optional OrganizationId, if not provided, it will display individual vault export message */
  readonly organizationId = input<OrganizationId>();
  /* The description key to use for organizational exports */
  readonly orgExportDescription = input<string>();

  constructor(
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {
    effect(async () => {
      this.show = false;
      await this.getScopeMessage(this.organizationId(), this.orgExportDescription());
      this.show = true;
    });
  }

  private async getScopeMessage(
    organizationId: OrganizationId | undefined,
    orgExportDescription: string,
  ): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (organizationId) {
      // exporting from organizational vault
      const org = await firstValueFrom(
        this.organizationService.organizations$(userId).pipe(getById(organizationId)),
      );

      this.scopeConfig = {
        title: "exportingOrganizationVaultTitle",
        description: orgExportDescription,
        scopeIdentifier: org?.name ?? "",
      };

      return;
    }

    // exporting from individual vault
    this.scopeConfig = {
      title: "exportingPersonalVaultTitle",
      description: "exportingIndividualVaultScopeDescription",
      scopeIdentifier: "",
    };
  }
}
