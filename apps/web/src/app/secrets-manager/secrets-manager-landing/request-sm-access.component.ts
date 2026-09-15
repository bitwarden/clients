// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SearchModule, ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { OssModule } from "../../oss.module";
import { clientIsGovMode$ } from "../../platform/gov-mode";
import { SharedModule } from "../../shared/shared.module";
import { RequestSMAccessRequest } from "../models/requests/request-sm-access.request";

import { SmLandingApiService } from "./sm-landing-api.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-request-sm-access",
  templateUrl: "request-sm-access.component.html",
  imports: [SharedModule, SearchModule, HeaderModule, OssModule],
})
export class RequestSMAccessComponent implements OnInit {
  requestAccessForm = new FormGroup({
    requestAccessEmailContents: new FormControl(
      this.i18nService.t("requestAccessSMDefaultEmailContent"),
      [Validators.required],
    ),
    selectedOrganization: new FormControl<Organization>(null, [Validators.required]),
  });
  organizations: Organization[] = [];

  constructor(
    private router: Router,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
    private smLandingApiService: SmLandingApiService,
    private toastService: ToastService,
    private accountService: AccountService,
    private govModeService: GovModeService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations = (await firstValueFrom(this.organizationService.organizations$(userId)))
      .filter((e) => e.enabled)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (this.organizations === null || this.organizations.length < 1) {
      // govModeBlockedGuard would bounce a Gov user off /create-organization with an
      // access-denied toast, so send them back to the landing page instead.
      const isGovMode = await firstValueFrom(
        clientIsGovMode$(this.accountService, this.govModeService),
      );
      if (isGovMode) {
        await this.router.navigate(["/sm-landing"]);
        return;
      }

      await this.navigateToCreateOrganizationPage();
    }
  }

  submit = async () => {
    this.requestAccessForm.markAllAsTouched();
    if (this.requestAccessForm.invalid) {
      return;
    }

    const formValue = this.requestAccessForm.value;
    const request = new RequestSMAccessRequest();
    request.OrganizationId = formValue.selectedOrganization.id;
    request.EmailContent = formValue.requestAccessEmailContents;

    await this.smLandingApiService.requestSMAccessFromAdmins(request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("smAccessRequestEmailSent"),
    });
    await this.router.navigate(["/"]);
  };

  async navigateToCreateOrganizationPage() {
    await this.router.navigate(["/create-organization"]);
  }
}
