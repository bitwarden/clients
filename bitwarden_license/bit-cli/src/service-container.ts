// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationAuthRequestService,
  OrganizationAuthRequestApiService,
} from "@bitwarden/bit-common/admin-console/auth-requests";
import { CliLicenseType } from "@bitwarden/cli/platform/cli-license-type";
import { ServiceContainer as OssServiceContainer } from "@bitwarden/cli/service-container/service-container";

/**
 * Instantiates services and makes them available for dependency injection.
 * Any Bitwarden-licensed services should be registered here.
 */
export class ServiceContainer extends OssServiceContainer {
  override readonly licenseType: CliLicenseType = CliLicenseType.Bit;

  organizationAuthRequestApiService: OrganizationAuthRequestApiService;
  organizationAuthRequestService: OrganizationAuthRequestService;

  constructor() {
    super();
    this.organizationAuthRequestApiService = new OrganizationAuthRequestApiService(this.apiService);
    this.organizationAuthRequestService = new OrganizationAuthRequestService(
      this.organizationAuthRequestApiService,
      this.keyService,
      this.legacyCompatKeyService,
      this.encryptService,
      this.organizationUserApiService,
      this.accountService,
    );
  }
}
