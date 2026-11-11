import { MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/user-core";

import { SmOrganization } from "../sm-command.utils";

export const smUserId = "user-id" as UserId;
export const smOrgId = "11111111-1111-1111-1111-111111111111";
export const smOtherOrgId = "99999999-9999-9999-9999-999999999999";

/** A validated organization, as the program layer hands it to a command's `run()`. */
export function createSmOrg(organization: Partial<Organization> = {}): SmOrganization {
  return {
    organizationId: smOrgId,
    organization: { id: smOrgId, canAccessSecretsManager: true, ...organization } as Organization,
  };
}

export const smOrg = createSmOrg();

/** Makes `smUserId` the active user. */
export function mockSmActiveAccount(accountService: MockProxy<AccountService>) {
  accountService.activeAccount$ = of({
    id: smUserId,
    ...mockAccountInfoWith({ email: "user@example.com", name: "Test User" }),
  });
}

/**
 * Wires the account and organization mocks so `smOrgId` resolves to an organization the
 * active user is a member of.
 */
export function mockSmOrganization(
  accountService: MockProxy<AccountService>,
  organizationService: MockProxy<OrganizationService>,
  canAccessSecretsManager = true,
  organization: Partial<Organization> = {},
) {
  mockSmActiveAccount(accountService);
  organizationService.organizations$.mockReturnValue(
    of([{ id: smOrgId, canAccessSecretsManager, ...organization } as Organization]),
  );
}

export function smNotFoundError() {
  return new ErrorResponse({ Message: "Resource not found." }, 404);
}

export function encodeSmRequest(request: unknown): string {
  return Buffer.from(JSON.stringify(request)).toString("base64");
}
