// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { UntypedFormBuilder, FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  OrganizationApiKeyType,
  OrganizationConnectionType,
} from "@bitwarden/common/admin-console/enums";
import { ScimConfigApi } from "@bitwarden/common/admin-console/models/api/scim-config.api";
import { OrganizationApiKeyRequest } from "@bitwarden/common/admin-console/models/request/organization-api-key.request";
import { OrganizationConnectionRequest } from "@bitwarden/common/admin-console/models/request/organization-connection.request";
import { ScimConfigRequest } from "@bitwarden/common/admin-console/models/request/scim-config.request";
import { OrganizationConnectionResponse } from "@bitwarden/common/admin-console/models/response/organization-connection.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-manage-scim",
  templateUrl: "scim.component.html",
  standalone: false,
})
export class ScimComponent implements OnInit {
  loading = true;
  organizationId: string;
  existingConnectionId: string;
  enabled = new FormControl(false);
  showScimSettings = false;
  showScimKey = false;

  formData = this.formBuilder.group({
    endpointUrl: new FormControl({ value: "", disabled: true }),
    clientSecret: new FormControl({ value: "", disabled: true }),
  });

  constructor(
    private formBuilder: UntypedFormBuilder,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      await this.load();
    });
  }

  async load() {
    const connection = await this.apiService.getOrganizationConnection(
      this.organizationId,
      OrganizationConnectionType.Scim,
      ScimConfigApi,
    );
    await this.setConnectionFormValues(connection);
  }

  async loadApiKey() {
    const apiKeyRequest = new OrganizationApiKeyRequest();
    apiKeyRequest.type = OrganizationApiKeyType.Scim;
    apiKeyRequest.masterPasswordHash = "N/A";
    const apiKeyResponse = await this.organizationApiService.getOrCreateApiKey(
      this.organizationId,
      apiKeyRequest,
    );
    this.formData.setValue({
      endpointUrl: await this.getScimEndpointUrl(),
      clientSecret: apiKeyResponse.apiKey,
    });
  }

  copyScimUrl = async () => {
    this.platformUtilsService.copyToClipboard(await this.getScimEndpointUrl());
    this.toastService.showToast({
      message: this.i18nService.t("valueCopied", this.i18nService.t("scimUrl")),
      variant: "success",
      title: null,
    });
  };

  rotateScimKey = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "rotateScimKey" },
      content: { key: "rotateScimKeyWarning" },
      acceptButtonText: { key: "rotateKey" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    const request = new OrganizationApiKeyRequest();
    request.type = OrganizationApiKeyType.Scim;
    request.masterPasswordHash = "N/A";

    const response = await this.organizationApiService.rotateApiKey(this.organizationId, request);
    this.formData.setValue({
      endpointUrl: await this.getScimEndpointUrl(),
      clientSecret: response.apiKey,
    });
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("scimApiKeyRotated"),
    });
  };

  copyScimKey = async () => {
    this.platformUtilsService.copyToClipboard(this.formData.get("clientSecret").value);
    this.toastService.showToast({
      message: this.i18nService.t("valueCopied", this.i18nService.t("scimApiKey")),
      variant: "success",
      title: null,
    });
  };

  submit = async () => {
    const request = new OrganizationConnectionRequest(
      this.organizationId,
      OrganizationConnectionType.Scim,
      true,
      new ScimConfigRequest(this.enabled.value),
    );
    let response: OrganizationConnectionResponse<ScimConfigApi>;

    if (this.existingConnectionId == null) {
      response = await this.apiService.createOrganizationConnection(request, ScimConfigApi);
    } else {
      response = await this.apiService.updateOrganizationConnection(
        request,
        ScimConfigApi,
        this.existingConnectionId,
      );
    }

    await this.setConnectionFormValues(response);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("scimSettingsSaved"),
    });
  };

  async getScimEndpointUrl() {
    const env = await firstValueFrom(this.environmentService.environment$);
    return env.getScimUrl() + "/" + this.organizationId;
  }

  toggleScimKey = () => {
    this.showScimKey = !this.showScimKey;
    document.getElementById("clientSecret").focus();
  };

  private async setConnectionFormValues(connection: OrganizationConnectionResponse<ScimConfigApi>) {
    this.existingConnectionId = connection?.id;
    if (connection !== null && connection.config?.enabled) {
      this.showScimSettings = true;
      this.enabled.setValue(true);
      this.formData.setValue({
        endpointUrl: await this.getScimEndpointUrl(),
        clientSecret: "",
      });
      await this.loadApiKey();
    } else {
      this.showScimSettings = false;
      this.enabled.setValue(false);
    }
    this.loading = false;
  }
}
