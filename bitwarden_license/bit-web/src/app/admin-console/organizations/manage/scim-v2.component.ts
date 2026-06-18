import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Signal,
  signal,
  viewChild,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationConnectionType } from "@bitwarden/common/admin-console/enums";
import { ScimConfigApi } from "@bitwarden/common/admin-console/models/api/scim-config.api";
import { OrganizationConnectionRequest } from "@bitwarden/common/admin-console/models/request/organization-connection.request";
import { ScimConfigRequest } from "@bitwarden/common/admin-console/models/request/scim-config.request";
import { OrganizationConnectionResponse } from "@bitwarden/common/admin-console/models/response/organization-connection.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AriaDisableDirective,
  BaseCardDirective,
  BitActionDirective,
  BitIconButtonComponent,
  CalloutComponent,
  CardComponent,
  DialogService,
  FormFieldModule,
  LinkComponent,
  SpinnerComponent,
  SwitchComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { WebHeaderComponent } from "@bitwarden/web-vault/app/layouts/header/web-header.component";

import { ScimApiKeyDialogComponent } from "./scim-api-key-dialog.component";
import { ScimBannerService } from "./scim-banner.service";

let nextId = 0;

@Component({
  selector: "app-org-manage-scim-v2",
  templateUrl: "scim-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WebHeaderComponent,
    ReactiveFormsModule,
    BaseCardDirective,
    CalloutComponent,
    CardComponent,
    TypographyModule,
    LinkComponent,
    AriaDisableDirective,
    SwitchComponent,
    FormFieldModule,
    BitIconButtonComponent,
    BitActionDirective,
    I18nPipe,
    SpinnerComponent,
  ],
})
export class ScimV2Component {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly environmentService = inject(EnvironmentService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly scimBannerService = inject(ScimBannerService);

  protected readonly loading = signal(true);
  protected readonly showScimSettings = signal(false);
  protected readonly showScimKey = signal(false);

  protected readonly descriptionId = `scim-description-${nextId++}`;
  protected readonly labelId = `scim-label-${nextId++}`;
  protected readonly switchId = `scim-switch-${nextId++}`;
  protected readonly switchInputId = `${this.switchId}-input`;
  private readonly switchRef = viewChild.required(SwitchComponent);

  protected readonly enabled = new FormControl(false);
  protected readonly formData = new FormGroup({
    endpointUrl: new FormControl(""),
    clientSecret: new FormControl(""),
  });

  private readonly bannerSeen: Signal<boolean>;
  protected readonly showProvisioningBanner: Signal<boolean>;

  private readonly organizationId: Signal<OrganizationId>;
  private readonly existingConnectionId = signal<string | undefined>(undefined);
  private readonly cachedApiKey = signal<string | undefined>(undefined);

  constructor() {
    this.organizationId = toSignal(this.route.params.pipe(map((params) => params.organizationId)));

    this.bannerSeen = toSignal(
      toObservable(this.organizationId).pipe(
        switchMap((orgId) => (orgId ? this.scimBannerService.bannerSeen$(orgId) : of(false))),
      ),
      { initialValue: false },
    );

    this.showProvisioningBanner = computed(() => !this.showScimSettings() && !this.bannerSeen());

    effect(() => {
      if (this.organizationId()) {
        void this.load();
      }
    });

    effect(() => {
      this.switchRef().ariaDescribedBy.set(this.descriptionId);
      this.switchRef().ariaLabelledBy.set(this.labelId);
      this.switchRef().size.set("large");
    });
  }

  async load() {
    const connection = await this.apiService.getOrganizationConnection(
      this.organizationId(),
      OrganizationConnectionType.Scim,
      ScimConfigApi,
    );
    await this.setConnectionFormValues(connection);
  }

  protected readonly loadApiKey = async () => {
    if (this.showScimKey()) {
      this.showScimKey.set(false);
      this.formData.patchValue({ clientSecret: "••••••••••••••••" });
      return;
    }

    const apiKey = await this.getOrFetchApiKey("viewScimApiKey");
    if (apiKey) {
      this.formData.setValue({
        endpointUrl: await this.getScimEndpointUrl(),
        clientSecret: apiKey,
      });
      this.showScimKey.set(true);
    }
  };

  protected readonly copyScimUrl = async () => {
    this.platformUtilsService.copyToClipboard(await this.getScimEndpointUrl());
    this.toastService.showToast({
      message: this.i18nService.t("valueCopied", this.i18nService.t("scimUrl")),
      variant: "success",
    });
  };

  protected readonly copyScimKey = async () => {
    const apiKey = await this.getOrFetchApiKey("copyScimKey");
    if (apiKey) {
      this.platformUtilsService.copyToClipboard(apiKey);
      this.toastService.showToast({
        message: this.i18nService.t("valueCopied", this.i18nService.t("scimApiKey")),
        variant: "success",
      });
    }
  };

  protected readonly rotateScimKey = async () => {
    const dialogRef = ScimApiKeyDialogComponent.open(this.dialogService, {
      organizationId: this.organizationId(),
      titleKey: "rotateScimKey",
      isRotation: true,
    });

    const result = await firstValueFrom(dialogRef.closed);
    if (result?.apiKey) {
      this.cachedApiKey.set(result.apiKey);
      this.formData.setValue({
        endpointUrl: await this.getScimEndpointUrl(),
        clientSecret: result.apiKey,
      });
      this.showScimKey.set(true);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("scimApiKeyRotated"),
      });
    }
  };

  protected readonly submit = async () => {
    if (this.enabled.value === true && !this.showScimSettings()) {
      await this.scimBannerService.markBannerSeen(this.organizationId());
    }

    const request = new OrganizationConnectionRequest(
      this.organizationId(),
      OrganizationConnectionType.Scim,
      true,
      new ScimConfigRequest(this.enabled.value ?? false),
    );
    let response: OrganizationConnectionResponse<ScimConfigApi>;

    const connectionId = this.existingConnectionId();
    if (connectionId == null) {
      response = await this.apiService.createOrganizationConnection(request, ScimConfigApi);
    } else {
      response = await this.apiService.updateOrganizationConnection(
        request,
        ScimConfigApi,
        connectionId,
      );
    }

    await this.setConnectionFormValues(response);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("scimSettingsSaved"),
    });
  };

  private async getScimEndpointUrl() {
    const env = await firstValueFrom(this.environmentService.environment$);
    return env.getScimUrl() + "/" + this.organizationId();
  }

  private async getOrFetchApiKey(titleKey: string): Promise<string | undefined> {
    if (this.cachedApiKey()) {
      return this.cachedApiKey();
    }

    const dialogRef = ScimApiKeyDialogComponent.open(this.dialogService, {
      organizationId: this.organizationId(),
      titleKey,
      isRotation: false,
    });

    const result = await firstValueFrom(dialogRef.closed);
    if (result?.apiKey) {
      this.cachedApiKey.set(result.apiKey);
      return result.apiKey;
    }

    return;
  }

  private async setConnectionFormValues(connection: OrganizationConnectionResponse<ScimConfigApi>) {
    this.existingConnectionId.set(connection?.id);
    this.cachedApiKey.set(undefined);
    this.showScimKey.set(false);
    if (connection !== null && connection.config?.enabled) {
      await this.scimBannerService.markBannerSeen(this.organizationId());
      this.showScimSettings.set(true);
      this.enabled.setValue(true);
      this.formData.setValue({
        endpointUrl: await this.getScimEndpointUrl(),
        clientSecret: "••••••••••••••••",
      });
    } else {
      this.showScimSettings.set(false);
      this.enabled.setValue(false);
    }
    this.loading.set(false);
  }
}
