// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationAuthRequestService,
  OrganizationAuthRequestApiService,
} from "@bitwarden/bit-common/admin-console/auth-requests";
import {
  AccessPolicyService,
  AccessService,
  CountService,
  ProjectService,
  SecretService,
  SecretVersionService,
  SecretsManagerPortingApiService,
  ServiceAccountEventLogApiService,
  ServiceAccountService,
} from "@bitwarden/bit-sm";
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
  accessPolicyService: AccessPolicyService;
  projectService: ProjectService;
  secretService: SecretService;
  secretVersionService: SecretVersionService;
  serviceAccountService: ServiceAccountService;
  accessService: AccessService;
  serviceAccountEventLogApiService: ServiceAccountEventLogApiService;
  countService: CountService;
  secretsManagerPortingApiService: SecretsManagerPortingApiService;

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

    this.accessPolicyService = new AccessPolicyService(
      this.keyService,
      this.apiService,
      this.encryptService,
      this.accountService,
      this.logService,
    );
    this.projectService = new ProjectService(
      this.keyService,
      this.apiService,
      this.encryptService,
      this.accountService,
    );
    this.secretService = new SecretService(
      this.keyService,
      this.apiService,
      this.encryptService,
      this.accessPolicyService,
      this.accountService,
    );
    this.secretVersionService = new SecretVersionService(
      this.keyService,
      this.apiService,
      this.encryptService,
      this.accountService,
    );
    this.serviceAccountService = new ServiceAccountService(
      this.keyService,
      this.apiService,
      this.encryptService,
      this.accountService,
      this.logService,
    );
    this.accessService = new AccessService(
      this.keyService,
      this.apiService,
      this.keyGenerationService,
      this.encryptService,
      this.accountService,
      this.logService,
    );
    this.serviceAccountEventLogApiService = new ServiceAccountEventLogApiService(this.apiService);
    this.countService = new CountService(this.apiService);
    this.secretsManagerPortingApiService = new SecretsManagerPortingApiService(
      this.apiService,
      this.encryptService,
      this.keyService,
      this.accountService,
    );
  }
}
