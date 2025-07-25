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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { NoItemsModule, SearchModule, ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { OssModule } from "../../oss.module";
import { SharedModule } from "../../shared/shared.module";
import { RequestSMAccessRequest } from "../models/requests/request-sm-access.request";

import { SmLandingApiService } from "./sm-landing-api.service";

@Component({
  selector: "app-request-sm-access",
  templateUrl: "request-sm-access.component.html",
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule, OssModule],
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
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations = (await firstValueFrom(this.organizationService.organizations$(userId)))
      .filter((e) => e.enabled)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (this.organizations === null || this.organizations.length < 1) {
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
