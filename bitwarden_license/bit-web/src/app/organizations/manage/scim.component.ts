import { Component, OnInit } from "@angular/core";
import { UntypedFormBuilder, FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/abstractions/organization/organization-api.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { OrganizationApiKeyType } from "@bitwarden/common/auth/enums/organization-api-key-type";
import { ApiKeyResponse } from "@bitwarden/common/auth/models/response/api-key.response";
import { OrganizationConnectionType } from "@bitwarden/common/enums/organizationConnectionType";
import { ScimConfigApi } from "@bitwarden/common/models/api/scim-config.api";
import { OrganizationApiKeyRequest } from "@bitwarden/common/models/request/organization-api-key.request";
import { OrganizationConnectionRequest } from "@bitwarden/common/models/request/organization-connection.request";
import { ScimConfigRequest } from "@bitwarden/common/models/request/scim-config.request";
import { OrganizationConnectionResponse } from "@bitwarden/common/models/response/organization-connection.response";
import { Guid } from "@bitwarden/common/types/guid";

@Component({
  selector: "app-org-manage-scim",
  templateUrl: "scim.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ScimComponent implements OnInit {
  loading = true;
  organizationId: Guid;
  existingConnectionId: Guid;
  formPromise: Promise<OrganizationConnectionResponse<ScimConfigApi>>;
  rotatePromise: Promise<ApiKeyResponse>;
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
    private organizationApiService: OrganizationApiServiceAbstraction
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
      ScimConfigApi
    );
    await this.setConnectionFormValues(connection);
  }

  async loadApiKey() {
    const apiKeyRequest = new OrganizationApiKeyRequest();
    apiKeyRequest.type = OrganizationApiKeyType.Scim;
    apiKeyRequest.masterPasswordHash = "N/A";
    const apiKeyResponse = await this.organizationApiService.getOrCreateApiKey(
      this.organizationId,
      apiKeyRequest
    );
    this.formData.setValue({
      endpointUrl: this.getScimEndpointUrl(),
      clientSecret: apiKeyResponse.apiKey,
    });
  }

  async copyScimUrl() {
    this.platformUtilsService.copyToClipboard(this.getScimEndpointUrl());
  }

  async rotateScimKey() {
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("rotateScimKeyWarning"),
      this.i18nService.t("rotateScimKey"),
      this.i18nService.t("rotateKey"),
      this.i18nService.t("cancel"),
      "warning"
    );
    if (!confirmed) {
      return false;
    }

    const request = new OrganizationApiKeyRequest();
    request.type = OrganizationApiKeyType.Scim;
    request.masterPasswordHash = "N/A";

    this.rotatePromise = this.organizationApiService.rotateApiKey(this.organizationId, request);

    try {
      const response = await this.rotatePromise;
      this.formData.setValue({
        endpointUrl: this.getScimEndpointUrl(),
        clientSecret: response.apiKey,
      });
      this.platformUtilsService.showToast("success", null, this.i18nService.t("scimApiKeyRotated"));
    } catch {
      // Logged by appApiAction, do nothing
    }

    this.rotatePromise = null;
  }

  async copyScimKey() {
    this.platformUtilsService.copyToClipboard(this.formData.get("clientSecret").value);
  }

  async submit() {
    try {
      const request = new OrganizationConnectionRequest(
        this.organizationId,
        OrganizationConnectionType.Scim,
        true,
        new ScimConfigRequest(this.enabled.value)
      );
      if (this.existingConnectionId == null) {
        this.formPromise = this.apiService.createOrganizationConnection(request, ScimConfigApi);
      } else {
        this.formPromise = this.apiService.updateOrganizationConnection(
          request,
          ScimConfigApi,
          this.existingConnectionId
        );
      }
      const response = (await this.formPromise) as OrganizationConnectionResponse<ScimConfigApi>;
      await this.setConnectionFormValues(response);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("scimSettingsSaved"));
    } catch (e) {
      // Logged by appApiAction, do nothing
    }

    this.formPromise = null;
  }

  getScimEndpointUrl() {
    return this.environmentService.getScimUrl() + "/" + this.organizationId;
  }

  toggleScimKey() {
    this.showScimKey = !this.showScimKey;
    document.getElementById("clientSecret").focus();
  }

  private async setConnectionFormValues(connection: OrganizationConnectionResponse<ScimConfigApi>) {
    this.existingConnectionId = connection?.id;
    if (connection !== null && connection.config?.enabled) {
      this.showScimSettings = true;
      this.enabled.setValue(true);
      this.formData.setValue({
        endpointUrl: this.getScimEndpointUrl(),
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
