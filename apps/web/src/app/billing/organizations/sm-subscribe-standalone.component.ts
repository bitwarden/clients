// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SecretsManagerSubscribeRequest } from "@bitwarden/common/billing/models/request/sm-subscribe.request";
import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { secretsManagerSubscribeFormFactory } from "../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-subscribe-standalone",
  templateUrl: "sm-subscribe-standalone.component.html",
  standalone: false,
})
export class SecretsManagerSubscribeStandaloneComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() plan: PlanResponse;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organization: Organization;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() customerDiscount: BillingCustomerDiscount;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSubscribe = new EventEmitter<void>();

  formGroup = secretsManagerSubscribeFormFactory(this.formBuilder);

  constructor(
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationService: InternalOrganizationServiceAbstraction,
    private toastService: ToastService,
    private accountService: AccountService,
  ) {}

  submit = async () => {
    const request = new SecretsManagerSubscribeRequest();
    request.additionalSmSeats = this.plan.SecretsManager.hasAdditionalSeatsOption
      ? this.formGroup.value.userSeats
      : 0;
    request.additionalServiceAccounts = this.plan.SecretsManager.hasAdditionalServiceAccountOption
      ? this.formGroup.value.additionalServiceAccounts
      : 0;

    const profileOrganization = await this.organizationApiService.subscribeToSecretsManager(
      this.organization.id,
      request,
    );
    const organizationData = new OrganizationData(profileOrganization, {
      isMember: this.organization.isMember,
      isProviderUser: this.organization.isProviderUser,
    });
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.organizationService.upsert(organizationData, userId);

    /*
      Because subscribing to Secrets Manager automatically provides access to Secrets Manager for the
      subscribing user, we need to refresh the identity token to account for their updated permissions.
    */
    await this.apiService.refreshIdentityToken();

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("subscribedToSecretsManager"),
    });

    this.onSubscribe.emit();
  };
}
