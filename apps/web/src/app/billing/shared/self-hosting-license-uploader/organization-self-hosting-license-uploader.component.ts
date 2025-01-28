// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrgKey } from "@bitwarden/common/types/key";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { AbstractSelfHostingLicenseUploaderComponent } from "../../shared/self-hosting-license-uploader/abstract-self-hosting-license-uploader.component";

/**
 * Processes license file uploads for organizations.
 * @remarks Requires self-hosting.
 */
@Component({
  selector: "organization-self-hosting-license-uploader",
  templateUrl: "./self-hosting-license-uploader.component.html",
})
export class OrganizationSelfHostingLicenseUploaderComponent extends AbstractSelfHostingLicenseUploaderComponent {
  /**
   * Notifies the parent component of the `organizationId` the license was created for.
   */
  @Output() onLicenseFileUploaded: EventEmitter<string> = new EventEmitter<string>();

  constructor(
    protected readonly formBuilder: FormBuilder,
    protected readonly i18nService: I18nService,
    protected readonly platformUtilsService: PlatformUtilsService,
    protected readonly toastService: ToastService,
    protected readonly tokenService: TokenService,
    private readonly apiService: ApiService,
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
    private readonly organizationApiService: OrganizationApiServiceAbstraction,
    private readonly syncService: SyncService,
  ) {
    super(formBuilder, i18nService, platformUtilsService, toastService, tokenService);
  }

  protected async submit(): Promise<void> {
    await super.submit();

    const orgKey = await this.keyService.makeOrgKey<OrgKey>();
    const key = orgKey[0].encryptedString;
    const collection = await this.encryptService.encrypt(
      this.i18nService.t("defaultCollection"),
      orgKey[1],
    );
    const collectionCt = collection.encryptedString;
    const orgKeys = await this.keyService.makeKeyPair(orgKey[1]);

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
