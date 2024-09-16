import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrgKey } from "@bitwarden/common/types/key";
import { ToastService } from "@bitwarden/components";

import { AbstractSelfHostingLicenseUploaderComponent } from "../../shared/self-hosting-license-uploader/abstract-self-hosting-license-uploader.component";
import { LicenseUploadedEvent } from "../../shared/self-hosting-license-uploader/license-uploaded-event";

/**
 * Processes license file uploads for organizations.
 * @remarks Requires self-hosting.
 */
@Component({
  selector: "organization-self-hosting-license-uploader",
  templateUrl: "./self-hosting-license-uploader.component.html",
})
export class OrganizationSelfHostingLicenseUploaderComponent extends AbstractSelfHostingLicenseUploaderComponent {
  constructor(
    protected readonly formBuilder: FormBuilder,
    protected readonly i18nService: I18nService,
    protected readonly platformUtilsService: PlatformUtilsService,
    protected readonly toastService: ToastService,
    protected readonly tokenService: TokenService,
    private readonly apiService: ApiService,
    private readonly cryptoService: CryptoService,
    private readonly organizationApiService: OrganizationApiService,
    private readonly syncService: SyncService,
  ) {
    super(formBuilder, i18nService, platformUtilsService, toastService, tokenService);
  }

  protected async submit() {
    await super.submit();

    const orgKey = await this.cryptoService.makeOrgKey<OrgKey>();
    const key = orgKey[0].encryptedString;
    const collection = await this.cryptoService.encrypt(
      this.i18nService.t("defaultCollection"),
      orgKey[1],
    );
    const collectionCt = collection.encryptedString;
    const orgKeys = await this.cryptoService.makeKeyPair(orgKey[1]);

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

    const event = new LicenseUploadedEvent();
    event.organizationId = orgId;
    this.onLicenseFileUploaded.emit(event);
  }

  get description(): string {
    return "uploadLicenseFileOrg";
  }

  get hintFileName(): string {
    return "bitwarden_organization_license.json";
  }
}
