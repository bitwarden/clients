import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import type { PamClient, PasswordManagerClient } from "@bitwarden/sdk-internal";

import { PamSdkService } from "../pam-sdk.service";

/**
 * Spec helpers for the PAM code. None of them load wasm: every SDK type is a type import, and the
 * PAM client is a `jest-mock-extended` mock whose sub-clients each spec supplies.
 */

export const PAM_TEST_USER_ID = "11111111-1111-4111-8111-111111111111" as UserId;
export const PAM_TEST_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222" as OrganizationId;

export function pamTestAccountService(userId: UserId = PAM_TEST_USER_ID): FakeAccountService {
  return mockAccountServiceWith(userId, { email: "user@example.com", name: "Test User" });
}

/**
 * An organization that uses PAM, where the caller is a seated member with no admin rights.
 * Override `type`, `accessPam`, `isProviderUser` or `permissions` to model other callers.
 */
export function pamTestOrganization(overrides: Partial<Organization> = {}): Organization {
  const organization = new Organization();
  organization.id = PAM_TEST_ORGANIZATION_ID;
  organization.name = "Test Organization";
  organization.enabled = true;
  organization.type = OrganizationUserType.User;
  organization.usePam = true;
  organization.accessPam = true;
  organization.isProviderUser = false;
  organization.permissions = new PermissionsApi();
  return Object.assign(organization, overrides);
}

export interface PamSdkTestKit {
  /** Set the sub-clients on this, for example `pam.leases.mockReturnValue(leasesMock)`. */
  readonly pam: MockProxy<PamClient>;
  readonly sdkService: MockProxy<SdkService>;
  readonly logService: MockProxy<LogService>;
  readonly accountService: FakeAccountService;
  /** A real `PamSdkService` over the mocks above. */
  readonly pamSdkService: PamSdkService;
  /** How many times the SDK reference was released, to prove it is taken and freed per call. */
  readonly freed: jest.Mock;
}

/** A `PamSdkService` whose `userClient$` yields a client that serves `pam()` from a mock. */
export function createPamSdkTestKit(userId: UserId = PAM_TEST_USER_ID): PamSdkTestKit {
  const pam = mock<PamClient>();
  const freed = jest.fn();
  const passwordManager = {
    free: freed,
    commercial: () => ({ pam: () => pam }),
  } as unknown as PasswordManagerClient;

  const sdkService = mock<SdkService>();
  sdkService.userClient$.mockReturnValue(of(new Rc(passwordManager)));
  const logService = mock<LogService>();
  const accountService = pamTestAccountService(userId);

  return {
    pam,
    sdkService,
    logService,
    accountService,
    pamSdkService: new PamSdkService(sdkService, accountService, logService),
    freed,
  };
}
