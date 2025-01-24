// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
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
  standalone: true,
  imports: [CommonModule, JslibModule, CalloutModule],
})
export class ExportScopeCalloutComponent implements OnInit {
  show = false;
  scopeConfig: {
    title: string;
    description: string;
    scopeIdentifier: string;
  };

  private _organizationId: string;

  get organizationId(): string {
    return this._organizationId;
  }

  @Input() set organizationId(value: string) {
    this._organizationId = value;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.getScopeMessage(this._organizationId);
  }

  constructor(
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    if (!(await firstValueFrom(this.organizationService.hasOrganizations(userId)))) {
      return;
    }

    await this.getScopeMessage(this.organizationId);
    this.show = true;
  }

  private async getScopeMessage(organizationId: string) {
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
            description: "exportingIndividualVaultDescription",
            scopeIdentifier: await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a?.email)),
            ),
          };
  }
}
