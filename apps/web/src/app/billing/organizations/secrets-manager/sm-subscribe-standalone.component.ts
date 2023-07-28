import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SecretsManagerSubscribeRequest } from "@bitwarden/common/billing/models/request/sm-subscribe.request";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { secretsManagerSubscribeFormFactory } from "./sm-subscribe.component";

@Component({
  selector: "sm-subscribe-standalone",
  templateUrl: "sm-subscribe-standalone.component.html",
})
export class SecretsManagerSubscribeStandaloneComponent {
  @Input() plan: PlanResponse;
  @Input() organization: Organization;
  @Output() onSubscribe = new EventEmitter<void>();

  formGroup = secretsManagerSubscribeFormFactory(this.formBuilder);

  constructor(
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction
  ) {}

  submit = async () => {
    const request = new SecretsManagerSubscribeRequest();
    request.additionalSmSeats = this.plan.hasAdditionalSeatsOption
      ? this.formGroup.value.userSeats
      : 0;
    request.additionalServiceAccounts = this.plan.hasAdditionalServiceAccountOption
      ? this.formGroup.value.additionalServiceAccounts
      : 0;

    await this.organizationApiService.subscribeToSecretsManager(this.organization.id, request);

    this.platformUtilsService.showToast("success", null, this.i18nService.t("subscriptionUpdated"));

    this.onSubscribe.emit();
  };
}
