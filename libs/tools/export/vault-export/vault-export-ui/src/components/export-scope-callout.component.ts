// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, effect, input } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";
import { ExportFormat } from "@bitwarden/vault-export-core";

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
  readonly organizationId = input<OrganizationId | undefined>();
  /* Optional export format, determines which individual export description to display */
  readonly exportFormat = input<ExportFormat | undefined>();
  /* The description key to use for organizational exports */
  readonly orgExportDescription = input<string>();

  constructor(
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {
    effect(async () => {
      this.show = false;
      await this.getScopeMessage(
        this.organizationId(),
        this.exportFormat(),
        this.orgExportDescription(),
      );
      this.show = true;
    });
  }

  private async getScopeMessage(
    organizationId: OrganizationId | undefined,
    exportFormat: ExportFormat | undefined,
    orgExportDescription: string,
  ): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (organizationId != null) {
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
      description:
        exportFormat === "zip"
          ? "exportingIndividualVaultWithAttachmentsDescription"
          : "exportingIndividualVaultDescription",
      scopeIdentifier:
        (await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email)))) ?? "",
    };
  }
}
