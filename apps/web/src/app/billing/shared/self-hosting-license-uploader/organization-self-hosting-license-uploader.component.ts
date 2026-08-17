// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Output, inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrgKey } from "@bitwarden/common/types/key";
import { ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";

import { AbstractSelfHostingLicenseUploaderComponent } from "../../shared/self-hosting-license-uploader/abstract-self-hosting-license-uploader.component";

/**
 * Processes license file uploads for organizations.
 * @remarks Requires self-hosting.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "organization-self-hosting-license-uploader",
  templateUrl: "./self-hosting-license-uploader.component.html",
  standalone: false,
})
export class OrganizationSelfHostingLicenseUploaderComponent extends AbstractSelfHostingLicenseUploaderComponent {
  protected readonly formBuilder: FormBuilder;
  protected readonly i18nService: I18nService;
  protected readonly platformUtilsService: PlatformUtilsService;
  protected readonly toastService: ToastService;
  protected readonly tokenService: TokenService;
  private readonly apiService = inject(ApiService);
  private readonly encryptService = inject(EncryptService);
  private readonly legacyCompatKeyService = inject(LegacyCompatKeyService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly syncService = inject(SyncService);
  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);

  /**
   * Notifies the parent component of the `organizationId` the license was created for.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onLicenseFileUploaded: EventEmitter<string> = new EventEmitter<string>();

  constructor() {
    const formBuilder = inject(FormBuilder);
    const i18nService = inject(I18nService);
    const platformUtilsService = inject(PlatformUtilsService);
    const toastService = inject(ToastService);
    const tokenService = inject(TokenService);

    super(formBuilder, i18nService, platformUtilsService, toastService, tokenService);

    this.formBuilder = formBuilder;
    this.i18nService = i18nService;
    this.platformUtilsService = platformUtilsService;
    this.toastService = toastService;
    this.tokenService = tokenService;
  }

  protected async submit(): Promise<void> {
    await super.submit();
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const orgKey = await this.legacyCompatKeyService.makeOrgKey<OrgKey>(activeUserId);
    const key = orgKey[0].encryptedString;
    const vfo1Enabled = await this.configService.getFeatureFlag(FeatureFlag.VFO1Foundation);
    const collection = await this.encryptService.encryptString(
      this.i18nService.t(vfo1Enabled ? "defaultSharedFolder" : "defaultCollection"),
      orgKey[1],
    );
    const collectionCt = collection.encryptedString;
    const orgKeys = await this.legacyCompatKeyService.makeKeyPair(orgKey[1]);

    const fd = new FormData();
    fd.append("license", this.formValue.file);
    fd.append("key", key);
    fd.append("collectionName", collectionCt);
    const response = await this.organizationApiService.createLicense(fd);
    const orgId = response.id;

    await this.apiService.refreshIdentityToken();

    // Org Keys live outside of the OrganizationLicense - add the keys to the org here
    const request = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    await this.organizationApiService.updateKeys(orgId, request);

    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);

    this.onLicenseFileUploaded.emit(orgId);
  }

  get description(): string {
    return "uploadLicenseFileOrg";
  }

  get hintFileName(): string {
    return "bitwarden_organization_license.json";
  }
}
