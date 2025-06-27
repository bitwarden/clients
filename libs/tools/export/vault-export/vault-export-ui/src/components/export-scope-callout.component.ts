// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, effect, input } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CalloutModule } from "@bitwarden/components";

@Component({
  selector: "tools-export-scope-callout",
  templateUrl: "export-scope-callout.component.html",
  imports: [CommonModule, JslibModule, CalloutModule],
})
export class ExportScopeCalloutComponent {
  show = false;
  scopeConfig: {
    title: string;
    description: string;
    scopeIdentifier: string;
  };

  /* Optional OrganizationId, if not provided, it will display individual vault export message */
  readonly organizationId = input<string>();
  /* Optional export format, determines which individual export description to display */
  readonly exportFormat = input<string>();

  constructor(
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {
    effect(async () => {
      this.show = false;
      await this.getScopeMessage(this.organizationId(), this.exportFormat());
      this.show = true;
    });
  }

  private async getScopeMessage(organizationId: string, exportFormat: string): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.scopeConfig =
      organizationId != null
        ? {
            title: "exportingOrganizationVaultTitle",
            description: "exportingOrganizationVaultDesc",
            scopeIdentifier: (
              await firstValueFrom(
                this.organizationService
                  .organizations$(userId)
                  .pipe(getOrganizationById(organizationId)),
              )
            ).name,
          }
        : {
            title: "exportingPersonalVaultTitle",
            description:
              exportFormat == "zip"
                ? "exportingIndividualVaultWithAttachmentsDescription"
                : "exportingIndividualVaultDescription",
            scopeIdentifier: await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a?.email)),
            ),
          };
  }
}
